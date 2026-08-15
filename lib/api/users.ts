/**
 * Users API Service
 */

import { apiClient, ApiResponse, API_VERSION } from './client';
import { User } from './auth';

export interface UpdateUserRequest {
  name?: string;
  phone?: string;
  timezone?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: string;
}

export interface ListUsersParams {
  role?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const usersApi = {
  /**
   * Get the authenticated user's profile
   */
  getMe: async (): Promise<ApiResponse<User>> => {
    return apiClient.get<ApiResponse<User>>(`/api/${API_VERSION}/users/me`);
  },

  /**
   * Update the authenticated user's profile
   */
  updateMe: async (data: UpdateUserRequest): Promise<ApiResponse<User>> => {
    return apiClient.patch<ApiResponse<User>>(`/api/${API_VERSION}/users/me`, data);
  },

  /**
   * Get a list of all users (admin only) with pagination
   */
  list: async (params?: ListUsersParams): Promise<ApiResponse<User[]> & { pagination?: { total: number; limit: number; offset: number; hasMore: boolean } }> => {
    const queryParams: Record<string, string> = {};
    if (params?.role) queryParams.role = params.role;
    if (params?.status) queryParams.status = params.status;
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();
    
    return apiClient.get<ApiResponse<User[]> & { pagination?: { total: number; limit: number; offset: number; hasMore: boolean } }>(`/api/${API_VERSION}/users`, queryParams);
  },

  /**
   * Create a new user (admin only)
   */
  create: async (data: CreateUserRequest): Promise<ApiResponse<User>> => {
    return apiClient.post<ApiResponse<User>>(`/api/${API_VERSION}/users`, data);
  },

  /**
   * Get a specific user by ID
   */
  getById: async (id: string): Promise<ApiResponse<User>> => {
    return apiClient.get<ApiResponse<User>>(`/api/${API_VERSION}/users/${id}`);
  },

  /**
   * Update a user (admin only)
   */
  update: async (id: string, data: Partial<User>): Promise<ApiResponse<User>> => {
    return apiClient.patch<ApiResponse<User>>(`/api/${API_VERSION}/users/${id}`, data);
  },

  /**
   * Soft delete a user (admin only)
   */
  delete: async (id: string): Promise<ApiResponse<{ success: boolean; id: string }>> => {
    return apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(`/api/${API_VERSION}/users/${id}`);
  },
};
