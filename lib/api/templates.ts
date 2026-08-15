/**
 * Template Responses API Service
 */

import { apiClient, ApiResponse, API_VERSION } from './client';

export interface TemplateResponse {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  title: string;
  body: string;
}

export interface UpdateTemplateRequest {
  title?: string;
  body?: string;
}

export interface ListTemplatesParams {
  limit?: number;
  offset?: number;
}

export interface SearchTemplatesParams {
  q: string;
  limit?: number;
  offset?: number;
}

export const templatesApi = {
  /**
   * Get template responses with pagination
   */
  list: async (params?: ListTemplatesParams): Promise<ApiResponse<TemplateResponse[]> & { pagination?: { total: number; limit: number; offset: number; hasMore: boolean } }> => {
    const queryParams: Record<string, string> = {};
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();
    
    return apiClient.get<ApiResponse<TemplateResponse[]> & { pagination?: { total: number; limit: number; offset: number; hasMore: boolean } }>(`/api/${API_VERSION}/template-responses/`, queryParams);
  },

  /**
   * Create a new template response
   */
  create: async (data: CreateTemplateRequest): Promise<ApiResponse<TemplateResponse>> => {
    return apiClient.post<ApiResponse<TemplateResponse>>(`/api/${API_VERSION}/template-responses/`, data);
  },

  /**
   * Update a template response
   */
  update: async (id: string, data: UpdateTemplateRequest): Promise<ApiResponse<TemplateResponse>> => {
    return apiClient.patch<ApiResponse<TemplateResponse>>(`/api/${API_VERSION}/template-responses/${id}`, data);
  },

  /**
   * Delete a template response
   */
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete<ApiResponse<{ success: boolean }>>(`/api/${API_VERSION}/template-responses/${id}`);
  },

  /**
   * Search template responses
   */
  search: async (params: SearchTemplatesParams): Promise<ApiResponse<TemplateResponse[]> & { pagination?: { total: number; limit: number; offset: number; hasMore: boolean } }> => {
    const queryParams: Record<string, string> = {
      q: params.q,
    };
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.offset) queryParams.offset = params.offset.toString();
    
    return apiClient.get<ApiResponse<TemplateResponse[]> & { pagination?: { total: number; limit: number; offset: number; hasMore: boolean } }>(`/api/${API_VERSION}/template-responses/search`, queryParams);
  },
};
