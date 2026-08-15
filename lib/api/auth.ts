/**
 * Auth API Service (JWT-based with refresh token rotation)
 */

import { API_VERSION } from './client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status?: string;
  phone?: string;
  timezone?: string;
  avatarUrl?: string | null;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string; // Returned for cross-origin/cross-subdomain setups (stored in localStorage)
}

export interface RefreshResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string; // New refresh token (token rotation) - for cross-origin/cross-subdomain setups
}

export interface AuthApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  code?: string;
}

// Auth API uses credentials: 'include' for refresh token cookies
export const authApi = {
  /**
   * Create a new user account
   */
  signUp: async (data: SignUpRequest): Promise<AuthApiResponse<User>> => {
    const response = await fetch(`${API_BASE_URL}/api/${API_VERSION}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * Sign in and receive access token (refresh token set via HTTP-only cookie)
   */
  signIn: async (data: SignInRequest): Promise<AuthApiResponse<SignInResponse>> => {
    try {
      console.log("[AuthAPI] Sending signIn request to:", `${API_BASE_URL}/api/${API_VERSION}/auth/signin`)
      const response = await fetch(`${API_BASE_URL}/api/${API_VERSION}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      console.log("[AuthAPI] Response status:", response.status, response.statusText)
      
      const result = await response.json();
      console.log("[AuthAPI] Response body:", result)
      
      return result;
    } catch (err) {
      console.error("[AuthAPI] SignIn request failed:", err)
      // Return error response format
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR'
      };
    }
  },

  /**
   * Sign out and invalidate refresh token
   */
  signOut: async (): Promise<AuthApiResponse<{ message: string }>> => {
    const response = await fetch(`${API_BASE_URL}/api/${API_VERSION}/auth/signout`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.json();
  },

  /**
   * Refresh access token using refresh token cookie (production) or x-refresh-token header (dev mode)
   * Cookie-based flow is the default - header is only used for cross-origin dev environments
   */
  refresh: async (refreshToken?: string): Promise<AuthApiResponse<RefreshResponse>> => {
    const headers: Record<string, string> = {};

    // Only use x-refresh-token header for cross-origin dev mode when we have a stored token
    // In production (same-origin), the cookie will be sent automatically via credentials: 'include'
    const storedRefreshToken =
      refreshToken || (typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null);

    // eslint-disable-next-line no-console
    console.log("[Auth] Refresh called, stored token:", storedRefreshToken ? storedRefreshToken.substring(0, 30) + "..." : "none (will use cookie)");

    // Only add header if we have a stored token (cross-origin dev mode)
    // Otherwise rely on the cookie being sent automatically
    if (storedRefreshToken) {
      headers["x-refresh-token"] = storedRefreshToken;
      // eslint-disable-next-line no-console
      console.log("[Auth] Using x-refresh-token header");
    } else {
      // eslint-disable-next-line no-console
      console.log("[Auth] No stored token, relying on HTTP-only cookie");
    }

    // eslint-disable-next-line no-console
    console.log("[Auth] Request headers:", headers);

    const response = await fetch(`${API_BASE_URL}/api/${API_VERSION}/auth/refresh`, {
      method: "POST",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      credentials: "include",
    });
    
    const result = await response.json();
    // eslint-disable-next-line no-console
    console.log("[Auth] Refresh response:", result);
    
    return result;
  },

  /**
   * Get current authenticated user
   */
  me: async (accessToken: string): Promise<AuthApiResponse<{ user: User }>> => {
    const response = await fetch(`${API_BASE_URL}/api/${API_VERSION}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });
    return response.json();
  },
};
