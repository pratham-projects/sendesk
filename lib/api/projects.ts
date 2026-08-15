/**
 * Projects API Service
 */

import { apiClient, ApiResponse, API_VERSION } from './client';

export interface Project {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  description?: string;
  status: 'active' | 'archived';
  apiKey: string;
  ownerUserId: string;
  replyToEmail?: string;
  smtpEmail?: string;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  slug: string;
  domain?: string;
  description?: string;
  replyToEmail?: string;
  smtpEmail?: string;
  smtpPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'archived';
  replyToEmail?: string;
  smtpEmail?: string;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
}

export interface ListProjectsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'admin' | 'agent';
  shouldNotify: boolean;
  canViewAllTickets?: boolean;
  canManageTemplates?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AddProjectMemberRequest {
  userId: string;
  role?: 'admin' | 'agent';
  shouldNotify?: boolean;
}

export interface UpdateProjectMemberRequest {
  role?: 'admin' | 'agent';
  shouldNotify?: boolean;
  canViewAllTickets?: boolean;
  canManageTemplates?: boolean;
}

export interface SearchProjectMembersParams {
  q: string;
  limit?: number;
  offset?: number;
}

export const projectsApi = {
  /**
   * Get all projects for the authenticated user
   */
  list: async (params?: ListProjectsParams): Promise<ApiResponse<Project[]>> => {
    const queryParams: Record<string, string> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return apiClient.get<ApiResponse<Project[]>>(`/api/${API_VERSION}/projects`, queryParams);
  },

  /**
   * Create a new project
   */
  create: async (data: CreateProjectRequest): Promise<ApiResponse<Project>> => {
    return apiClient.post<ApiResponse<Project>>(`/api/${API_VERSION}/projects`, data);
  },

  /**
   * Get a specific project by ID
   */
  getById: async (id: string): Promise<ApiResponse<Project>> => {
    return apiClient.get<ApiResponse<Project>>(`/api/${API_VERSION}/projects/${id}`);
  },

  /**
   * Update a project
   */
  update: async (id: string, data: UpdateProjectRequest): Promise<ApiResponse<Project>> => {
    return apiClient.patch<ApiResponse<Project>>(`/api/${API_VERSION}/projects/${id}`, data);
  },

  /**
   * Soft delete a project
   */
  delete: async (id: string): Promise<ApiResponse<{ success: boolean; id: string }>> => {
    return apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(`/api/${API_VERSION}/projects/${id}`);
  },

  /**
   * Generate a new API key for the project
   */
  regenerateApiKey: async (id: string): Promise<ApiResponse<{ id: string; apiKey: string; updatedAt: string }>> => {
    return apiClient.post<ApiResponse<{ id: string; apiKey: string; updatedAt: string }>>(`/api/${API_VERSION}/projects/${id}/regenerate-api-key`);
  },

  /**
   * Get project email credentials (decrypted)
   */
  getCredentials: async (id: string): Promise<ApiResponse<{ email: string; username?: string; password?: string; smtpHost?: string; smtpPort?: number }>> => {
    return apiClient.get<ApiResponse<{ email: string; username?: string; password?: string; smtpHost?: string; smtpPort?: number }>>(`/api/${API_VERSION}/projects/${id}/credentials`);
  },

  // Project Members API

  /**
   * Get all members of a project
   */
  getMembers: async (projectId: string): Promise<ApiResponse<ProjectMember[]>> => {
    return apiClient.get<ApiResponse<ProjectMember[]>>(`/api/${API_VERSION}/projects/${projectId}/members`);
  },

  /**
   * Add a member to a project
   */
  addMember: async (projectId: string, data: AddProjectMemberRequest): Promise<ApiResponse<ProjectMember>> => {
    return apiClient.post<ApiResponse<ProjectMember>>(`/api/${API_VERSION}/projects/${projectId}/members`, data);
  },

  /**
   * Update a project member's permissions
   */
  updateMember: async (projectId: string, userId: string, data: UpdateProjectMemberRequest): Promise<ApiResponse<ProjectMember>> => {
    return apiClient.patch<ApiResponse<ProjectMember>>(`/api/${API_VERSION}/projects/${projectId}/members/${userId}`, data);
  },

  /**
   * Remove a member from a project
   */
  removeMember: async (projectId: string, userId: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete<ApiResponse<{ success: boolean }>>(`/api/${API_VERSION}/projects/${projectId}/members/${userId}`);
  },

  /**
   * Search project members
   */
  searchMembers: async (projectId: string, params: SearchProjectMembersParams): Promise<ApiResponse<ProjectMember[]>> => {
    const queryParams: Record<string, string> = {
      q: params.q,
    };
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.offset) queryParams.offset = params.offset.toString();

    return apiClient.get<ApiResponse<ProjectMember[]>>(`/api/${API_VERSION}/projects/${projectId}/members/search`, queryParams);
  },
};
