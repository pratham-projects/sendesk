/**
 * Email Responses API Service
 */

import { apiClient, ApiResponse, API_VERSION } from "./client"
import type { EmailResponse, EmailResponseStatus } from "../types"

export interface CreateEmailResponseRequest {
  projectId: string
  status: EmailResponseStatus
  body: string
  isEnabled?: boolean
}

export interface UpdateEmailResponseRequest {
  body?: string
  isEnabled?: boolean
}

export const emailResponsesApi = {
  /**
   * Get email responses for a project
   */
  listByProject: async (projectId: string): Promise<ApiResponse<EmailResponse[]>> => {
    return apiClient.get<ApiResponse<EmailResponse[]>>(`/api/${API_VERSION}/email-responses/`, { projectId })
  },

  /**
   * Create a new email response
   */
  create: async (data: CreateEmailResponseRequest): Promise<ApiResponse<EmailResponse>> => {
    return apiClient.post<ApiResponse<EmailResponse>>(`/api/${API_VERSION}/email-responses`, {
      ...data,
      subject: "",
    })
  },

  /**
   * Update an email response
   */
  update: async (id: string, data: UpdateEmailResponseRequest): Promise<ApiResponse<EmailResponse>> => {
    return apiClient.patch<ApiResponse<EmailResponse>>(`/api/${API_VERSION}/email-responses/${id}`, {
      ...data,
      subject: "",
    })
  },
}
