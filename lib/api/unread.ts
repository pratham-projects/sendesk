/**
 * Unread API Service (no authorization required)
 */

import { apiClient, ApiResponse, API_VERSION } from './client';

export interface UnreadItem {
  id: string;
  ticketId: string;
  projectId: string;
}

export const unreadApi = {
  /**
   * Get all unread items (no authorization)
   */
  list: async (): Promise<ApiResponse<UnreadItem[]>> => {
    return apiClient.get<ApiResponse<UnreadItem[]>>(`/api/${API_VERSION}/unread/`);
  },

  /**
   * Delete an unread item by ticket ID (no authorization)
   */
  deleteByTicketId: async (ticketId: string): Promise<void> => {
    await apiClient.delete<void>(`/api/${API_VERSION}/unread/ticket/${ticketId}`);
  },
};
