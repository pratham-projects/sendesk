/**
 * Viewers API Service
 * Tracks who is currently viewing a ticket
 */

import { apiClient, ApiResponse, API_VERSION } from './client';

export interface Viewer {
  userId: string;
  name: string;
}

export const viewersApi = {
  /**
   * Get active viewers for a ticket
   */
  getViewers: async (ticketId: string): Promise<ApiResponse<Viewer[]>> => {
    return apiClient.get<ApiResponse<Viewer[]>>(`/api/${API_VERSION}/viewers/${ticketId}`);
  },

  /**
   * Add/update viewer (heartbeat) - call every 30-60 seconds
   */
  addViewer: async (ticketId: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.post<ApiResponse<{ success: boolean }>>(`/api/${API_VERSION}/viewers/${ticketId}`);
  },

  /**
   * Remove viewer (user left the ticket)
   */
  removeViewer: async (ticketId: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete<ApiResponse<{ success: boolean }>>(`/api/${API_VERSION}/viewers/${ticketId}`);
  },
};
