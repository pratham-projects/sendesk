export type TicketStatus = "pending" | "in_progress" | "on_hold" | "resolved" | "closed"

export type AgentRole = "admin" | "developer" | "agent"

export interface Project {
  id: string
  name: string
  domain: string
  apiKey: string
  smtpEmail?: string
  smtpUsername?: string
  smtpHost?: string
  smtpPort?: number
  createdAt: Date
}

export interface Agent {
  id: string
  email: string
  name: string
  role: AgentRole
  createdAt: Date
}

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  createdAt: Date
}

export interface Ticket {
  id: string
  ticketNumber?: number
  subject: string
  description?: string
  status: TicketStatus
  priority?: string
  projectId: string
  userId?: string
  clientName?: string
  clientEmail?: string
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  ticketId: string
  senderType: "agent" | "user" | "client"
  senderName?: string
  senderEmail?: string
  body: string
  isInternal?: boolean
  attachmentIds?: (string | { id: string; url?: string })[]
  createdAt: Date
}

export interface CannedResponse {
  id: string
  title: string
  body: string
  projectId?: string
}

export type EmailResponseStatus = "created" | "resolved"

export interface EmailResponse {
  id: string
  projectId: string
  status: EmailResponseStatus
  subject: string
  body: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}
