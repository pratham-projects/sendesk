/**
 * API Client - Centralized HTTP client for all API calls (JWT-based auth with refresh)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v2";

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code: number;
}

// Function to get JWT token from auth store (will be set after store is initialized)
let getToken: (() => string | null) | null = null;
// Function to check if token is expired
let isTokenExpired: (() => boolean) | null = null;
// Function to refresh the token
let refreshToken: (() => Promise<boolean>) | null = null;
// Function to handle logout (will be set after store is initialized)
let handleLogout: (() => void) | null = null;

export const setTokenGetter = (getter: () => string | null) => {
  getToken = getter;
};

export const setTokenExpiredChecker = (checker: () => boolean) => {
  isTokenExpired = checker;
};

export const setTokenRefresher = (refresher: () => Promise<boolean>) => {
  refreshToken = refresher;
};

export const setLogoutHandler = (handler: () => void) => {
  handleLogout = handler;
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Proactively refresh token if expired (skip for auth endpoints)
    if (!endpoint.includes('/auth/') && isTokenExpired?.() && refreshToken) {
      // eslint-disable-next-line no-console
      console.log("[API] Token expired, attempting refresh...");
      console.log("[API] Token before refresh:", getToken?.()?.substring(0, 30) + "...");
      const refreshed = await refreshToken();
      if (!refreshed) {
        // eslint-disable-next-line no-console
        console.log("[API] Token refresh failed, logging out silently...");
        handleLogout?.();
        // Return a rejected promise that won't show as unhandled error
        // The UI will redirect to login, no need to show error
        return new Promise(() => {});
      }
      // eslint-disable-next-line no-console
      console.log("[API] Token refreshed successfully, continuing request...");
      console.log("[API] Token after refresh:", getToken?.()?.substring(0, 30) + "...");
    }

    // Get JWT token if available
    const token = getToken?.();
    // eslint-disable-next-line no-console
    console.log("[API] Using token for request:", token?.substring(0, 30) + "...");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add Authorization Bearer token if available
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Include cookies for refresh token
    };

    // Log request
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body as string) : "";
    const tokenInfo = token ? "(token: " + token.substring(0, 20) + "...)" : "(no token)";
    // eslint-disable-next-line no-console
    console.log("[API] " + method + " " + endpoint, body, tokenInfo);

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch {
      // Handle network errors (offline, DNS issues, etc.)
      // Don't logout on network errors - user might just be temporarily offline
      // Let the calling code handle the error gracefully
      throw new Error("Network connection failed");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: "An unexpected error occurred",
        code: response.status,
      }));
      // eslint-disable-next-line no-console
      console.log("[API] Error " + response.status + ":", errorData);

      // Extract error message from various response formats:
      // { success: false, error: { message: "...", code: "..." } }
      // { error: "..." }
      // { message: "..." }
      const errorCode = errorData.error?.code || errorData.code || "";
      const errorMessage =
        errorData.error?.message ||
        (typeof errorData.error === "string" ? errorData.error : "") ||
        errorData.message ||
        "An unexpected error occurred";
      
      // Check if this is an auth-related error
      const isAuthError = 
        response.status === 401 ||
        errorCode === "TOKEN_EXPIRED" ||
        errorCode === "TOKEN_INVALID" ||
        errorCode === "TOKEN_MISSING" ||
        errorCode === "UNAUTHORIZED" ||
        errorMessage.toLowerCase().includes("invalid token") || 
        errorMessage.toLowerCase().includes("token expired") ||
        errorMessage.toLowerCase().includes("unauthorized");
      
      // If auth error and we haven't tried refreshing yet, attempt refresh
      if (isAuthError && !isRetry && refreshToken) {
        // eslint-disable-next-line no-console
        console.log("[API] Auth error received, attempting token refresh...");
        const refreshed = await refreshToken();
        if (refreshed) {
          // eslint-disable-next-line no-console
          console.log("[API] Token refreshed successfully, retrying request...");
          // Retry the original request with new token
          return this.request<T>(endpoint, options, true);
        }
        // Refresh failed - logout silently (UI will redirect to login)
        // eslint-disable-next-line no-console
        console.log("[API] Token refresh failed, logging out silently...");
        handleLogout?.();
        return new Promise(() => {});
      }
      
      // If auth error after retry (refresh already attempted), just logout
      if (isAuthError && isRetry) {
        // eslint-disable-next-line no-console
        console.log("[API] Auth still failing after refresh, logging out silently...");
        handleLogout?.();
        return new Promise(() => {});
      }
      
      // Handle validation errors
      if (errorData.type === "validation" && errorData.message) {
        throw new Error(errorData.message);
      }
      if (errorData.summary) {
        throw new Error(errorData.summary);
      }
      throw new Error(errorMessage || "An unexpected error occurred");
    }

    const data = await response.json();
    // eslint-disable-next-line no-console
    console.log("[API] Response " + endpoint + ":", data);
    return data;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export { API_BASE_URL, API_VERSION };

// Legacy alias for backward compatibility
export const setSessionIdGetter = setTokenGetter;
