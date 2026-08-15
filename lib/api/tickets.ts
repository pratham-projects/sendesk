/**
 * Tickets API Service
 */

import { apiClient, ApiResponse, API_VERSION } from './client';

export interface Client {
  id: string;
  email: string;
  name?: string;
}

export interface TicketMessage {
  id: string;
  ticketId?: string;
  senderUserId?: string | null;
  senderType: 'client' | 'agent';
  senderEmail?: string;
  senderName?: string;
  body: string;
  htmlBody?: string | null;
  messageType?: string;
  isInternal: boolean;
  isPublished?: boolean;
  attachmentIds?: (string | { id: string; url?: string })[];
  createdAt: string;
  updatedAt?: string;
  sender?: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  projectId: string;
  clientId: string;
  subject: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedToUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  project?: {
    id: string;
    name: string;
  };
  assignedTo?: {
    id: string;
    email: string;
    name: string;
  } | null;
  messages?: TicketMessage[];
}

export interface CreateTicketRequest {
  projectId: string;
  clientEmail: string;
  clientName?: string;
  subject: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface UpdateTicketRequest {
  subject?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedToUserId?: string;
}

export interface ListTicketsParams {
  projectId?: string;
  status?: string;
  assignedToUserId?: string;
  priority?: string;
  limit?: number;
  offset?: number;
  unreadFirst?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface GetMessagesParams {
  limit?: number;
  offset?: number;
}

export interface AddMessageRequest {
  body: string;
  senderType?: 'agent' | 'client';
  isInternal?: boolean;
}

// Get API base URL and session for multipart requests
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export const ticketsApi = {
  /**
   * Create a new support ticket (with optional attachments)
   * Uses /admin endpoint for admin/agent users (plain email), /tickets for public (template email)
   * Supports optional file attachments via multipart form data
   */
  create: async (
    data: CreateTicketRequest & { sendNotification?: boolean },
    files?: File[]
  ): Promise<ApiResponse<Ticket>> => {
    // Check if user is authenticated (admin/agent)
    const { useAuthStore } = await import("@/lib/store");
    const { isAuthenticated, token } = useAuthStore.getState();

    // Use admin endpoint for authenticated users
    const endpoint = isAuthenticated
      ? `${API_BASE_URL}/api/${API_VERSION}/tickets/admin`
      : `${API_BASE_URL}/api/${API_VERSION}/tickets`;

    // Use multipart form data to support optional attachments
    const formData = new FormData();
    formData.append("projectId", data.projectId);
    formData.append("clientEmail", data.clientEmail);
    if (data.clientName && data.clientName.trim()) {
      formData.append("clientName", data.clientName.trim());
    }
    formData.append("subject", data.subject);
    if (data.description) formData.append("description", data.description);
    formData.append("priority", data.priority || "normal");
    if (data.sendNotification !== false) formData.append("sendNotification", "true");

    // Add files if provided
    if (files && files.length > 0) {
      files.forEach((file) => {
        formData.append("files", file);
      });
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: "Failed to create ticket" } }));
      // Handle nested error structure: { success: false, error: { message: "..." } }
      const errorMessage = errorData.error?.message || errorData.message || errorData.error || "Failed to create ticket";
      throw new Error(errorMessage);
    }

    return response.json();
  },

  /**
   * Get all tickets with optional filters and pagination
   */
  list: async (params?: ListTicketsParams): Promise<ApiResponse<Ticket[]> & {
    pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
    stats?: { pending: number; in_progress: number; on_hold: number; resolved: number; closed: number; all: number };
  }> => {
    const queryParams: Record<string, string> = {};
    if (params?.projectId) queryParams.projectId = params.projectId;
    if (params?.status) queryParams.status = params.status;
    if (params?.assignedToUserId) queryParams.assignedToUserId = params.assignedToUserId;
    if (params?.priority) queryParams.priority = params.priority;
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();
    if (params?.unreadFirst !== undefined) queryParams.unreadFirst = params.unreadFirst.toString();

    return apiClient.get<ApiResponse<Ticket[]> & {
      pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
      stats?: { pending: number; in_progress: number; on_hold: number; resolved: number; closed: number; all: number };
    }>(`/api/${API_VERSION}/tickets`, queryParams);
  },

  /**
   * Get detailed information about a specific ticket (protected)
   */
  getById: async (id: string): Promise<ApiResponse<Ticket>> => {
    return apiClient.get<ApiResponse<Ticket>>(`/api/${API_VERSION}/tickets/${id}`);
  },

  /**
   * Update a ticket (protected)
   */
  update: async (id: string, data: UpdateTicketRequest): Promise<ApiResponse<Ticket>> => {
    return apiClient.patch<ApiResponse<Ticket>>(`/api/${API_VERSION}/tickets/${id}`, data);
  },

  /**
   * Soft delete a ticket (protected)
   */
  delete: async (id: string): Promise<ApiResponse<{ success: boolean; id: string }>> => {
    return apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(`/api/${API_VERSION}/tickets/${id}`);
  },

  /**
   * Get messages for a specific ticket with pagination
   */
  getMessages: async (ticketId: string, params?: GetMessagesParams): Promise<ApiResponse<TicketMessage[]> & { pagination?: { total: number; limit: number; offset: number; hasMore: boolean } }> => {
    const queryParams: Record<string, string> = {};
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return apiClient.get<ApiResponse<TicketMessage[]> & { pagination?: { total: number; limit: number; offset: number; hasMore: boolean } }>(`/api/${API_VERSION}/tickets/${ticketId}/messages`, queryParams);
  },

  /**
   * Add a new message to a ticket
   */
  addMessage: async (ticketId: string, data: AddMessageRequest): Promise<ApiResponse<TicketMessage>> => {
    return apiClient.post<ApiResponse<TicketMessage>>(`/api/${API_VERSION}/tickets/${ticketId}/messages`, data);
  },

  /**
   * Search tickets by subject, description, and message content
   */
  search: async (params: {
    q: string;
    projectId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Ticket[]>> => {
    const queryParams: Record<string, string> = { q: params.q };
    if (params.projectId) queryParams.projectId = params.projectId;
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.offset) queryParams.offset = params.offset.toString();

    return apiClient.get<ApiResponse<Ticket[]>>(`/api/${API_VERSION}/tickets/search`, queryParams);
  },

  /**
   * Get all comprehensive ticket counts (global & per-project)
   */
  getCounts: async (): Promise<ApiResponse<TicketCounts>> => {
    return apiClient.get<ApiResponse<TicketCounts>>(`/api/${API_VERSION}/tickets/counts`);
  },
};

export interface TicketCounts {
  global: {
    pending: number;
    in_progress: number;
    on_hold: number;
    resolved: number;
    closed: number;
    all: number;
  };
  projects: Record<string, {
    pending: number;
    in_progress: number;
    on_hold: number;
    resolved: number;
    closed: number;
    all: number;
  }>;
}
