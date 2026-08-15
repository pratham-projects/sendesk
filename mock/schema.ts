/**
 * Shape of the in-memory demo database. Field names mirror the upstream
 * lib/api/*.ts interfaces exactly so handlers can return real upstream shapes
 * without any translation layer.
 */

export type AgentRole = "admin" | "agent" | "developer"

export interface AgentRecord {
  id: string
  email: string
  name: string
  role: AgentRole
  status?: string
  phone?: string
  timezone?: string
  avatarUrl?: string | null
  password: string // demo-only plaintext, never a real credential
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectRecord {
  id: string
  name: string
  slug: string
  domain?: string
  description?: string
  status: "active" | "archived"
  apiKey: string
  ownerUserId: string
  replyToEmail?: string
  smtpEmail?: string
  smtpUsername?: string
  smtpPassword?: string
  smtpHost?: string
  smtpPort?: number
  createdAt: string
  updatedAt: string
}

export interface ProjectMemberRecord {
  id: string
  projectId: string
  userId: string
  role: "admin" | "agent"
  shouldNotify: boolean
  canViewAllTickets?: boolean
  canManageTemplates?: boolean
  createdAt: string
  updatedAt: string
}

export interface ClientRecord {
  id: string
  email: string
  name: string
}

export type TicketStatus = "pending" | "in_progress" | "on_hold" | "resolved" | "closed"
export type TicketPriority = "low" | "normal" | "high" | "urgent"

export interface TicketRecord {
  id: string
  ticketNumber: number
  projectId: string
  clientId: string
  subject: string
  description?: string
  status: TicketStatus
  priority: TicketPriority
  assignedToUserId?: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageRecord {
  id: string
  ticketId: string
  senderType: "client" | "agent"
  senderUserId?: string | null
  senderEmail?: string
  senderName?: string
  body: string
  isInternal: boolean
  attachmentIds: string[]
  createdAt: string
}

export interface TemplateRecord {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export type EmailResponseStatus = "created" | "resolved"

export interface EmailResponseRecord {
  id: string
  projectId: string
  status: EmailResponseStatus
  subject: string
  body: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface UnreadRecord {
  id: string
  ticketId: string
  projectId: string
}

export interface ViewerRecord {
  userId: string
  name: string
  lastSeen: number
}

export interface AttachmentRecord {
  id: string
  ticketId: string
  filename: string
  mimeType: string
  /** either a /attachments/*.ext static asset or an object URL for user uploads */
  src: string
}

export interface DemoDB {
  agents: AgentRecord[]
  projects: ProjectRecord[]
  projectMembers: ProjectMemberRecord[]
  clients: ClientRecord[]
  tickets: TicketRecord[]
  messages: MessageRecord[]
  templates: TemplateRecord[]
  emailResponses: EmailResponseRecord[]
  unread: UnreadRecord[]
  attachments: Record<string, AttachmentRecord>
  refreshTokens: Record<string, string> // refreshToken -> agentId
  meta: {
    nextTicketNumber: number
    seedVersion: number
  }
}
