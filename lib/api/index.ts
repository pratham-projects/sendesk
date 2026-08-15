/**
 * API Module - Central export for all API services
 * 
 * Usage:
 *   import { authApi, ticketsApi, projectsApi, usersApi } from '@/lib/api';
 *   
 *   // Sign in
 *   const response = await authApi.signIn({ email, password });
 *   
 *   // List tickets
 *   const tickets = await ticketsApi.list({ status: 'pending' });
 */

export { apiClient, API_BASE_URL } from './client';
export { authApi } from './auth';
export { usersApi } from './users';
export { ticketsApi } from './tickets';
export { projectsApi } from './projects';
export { unreadApi } from './unread';
export { templatesApi } from './templates';
export { emailResponsesApi } from './email-responses';
export { attachmentsApi } from './attachments';
export { viewersApi } from './viewers';

// Re-export types
export type { ApiResponse, ApiError } from './client';
export type { User, SignUpRequest, SignInRequest, SignInResponse } from './auth';
export type { UpdateUserRequest, CreateUserRequest, ListUsersParams } from './users';
export type { 
  Ticket, 
  TicketMessage, 
  Client, 
  CreateTicketRequest, 
  UpdateTicketRequest, 
  ListTicketsParams, 
  AddMessageRequest,
  TicketCounts
} from './tickets';
export type { 
  Project, 
  CreateProjectRequest, 
  UpdateProjectRequest, 
  ListProjectsParams,
  ProjectMember,
  AddProjectMemberRequest,
  UpdateProjectMemberRequest,
} from './projects';
export type { UnreadItem } from './unread';
export type { TemplateResponse, CreateTemplateRequest, UpdateTemplateRequest } from './templates';
export type { CreateEmailResponseRequest, UpdateEmailResponseRequest } from './email-responses';
export type { Viewer } from './viewers';
