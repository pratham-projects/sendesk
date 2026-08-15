import { create } from "zustand"
import type { Ticket, Message, TicketStatus, Project, Agent, AgentRole } from "./types"
import { authApi, projectsApi, ticketsApi, unreadApi, templatesApi } from "./api"
import type { UnreadItem, TemplateResponse, TicketCounts } from "./api"
import { setTokenGetter, setLogoutHandler, setTokenExpiredChecker, setTokenRefresher } from "./api/client"
import { setAttachmentSessionIdGetter } from "./api/attachments"

interface AuthStore {
  agent: Agent | null
  token: string | null
  tokenExpiresAt: number
  isAuthenticated: boolean
  isLoading: boolean
  isInitializing: boolean
  error: string | null
  getToken: () => string | null
  isTokenExpired: () => boolean
  refreshToken: () => Promise<boolean>
  tryAutoLogin: () => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  signup: (name: string, email: string, password: string, role: AgentRole) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
}

// No persist middleware - sessions are tab-specific and don't survive page reload
// But we try to auto-login using refresh token cookie on app load
export const useAuthStore = create<AuthStore>()((set, get) => ({
  agent: null,
  token: null,
  tokenExpiresAt: 0,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true, // Start as true - we'll check for existing session on mount
  error: null,

  getToken: () => get().token,

  isTokenExpired: () => Date.now() >= get().tokenExpiresAt,

  refreshToken: async () => {
    try {
      // eslint-disable-next-line no-console
      console.log("[Auth] Starting token refresh, current token:", get().token?.substring(0, 30) + "...")

      const response = await authApi.refresh()
      if (response.status !== 'success' || !response.data) {
        // eslint-disable-next-line no-console
        console.log("[Auth] Refresh failed - response:", response)
        return false
      }

      const { user, accessToken, expiresIn, refreshToken: newRefreshToken } = response.data
      // Set expiry 30 seconds early to avoid edge cases
      const tokenExpiresAt = Date.now() + (expiresIn - 30) * 1000

      // eslint-disable-next-line no-console
      console.log("[Auth] Token refreshed successfully!")
      console.log("[Auth] New access token:", accessToken.substring(0, 30) + "...")
      console.log("[Auth] Expires in:", expiresIn, "seconds")

      // Save new refresh token (token rotation) - important for dev mode
      if (newRefreshToken && typeof window !== "undefined") {
        localStorage.setItem("refreshToken", newRefreshToken)
        // eslint-disable-next-line no-console
        console.log("[Auth] New refresh token saved (rotation)")
      }

      set({
        agent: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user.role as AgentRole) || "agent",
          createdAt: new Date(user.createdAt || Date.now()),
        },
        token: accessToken,
        tokenExpiresAt,
        isAuthenticated: true,
      })

      // Verify the token was updated
      // eslint-disable-next-line no-console
      console.log("[Auth] Token in store after set:", get().token?.substring(0, 30) + "...")

      return true
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Auth] Refresh error:", err)
      return false
    }
  },

  // Try to auto-login using stored session or refresh token on app load
  tryAutoLogin: async () => {
    // eslint-disable-next-line no-console
    console.log("[Auth] Attempting auto-login...")
    set({ isInitializing: true })

    try {
      // First, try to restore session from localStorage (if token not expired)
      if (typeof window !== "undefined") {
        const storedToken = localStorage.getItem("accessToken")
        const storedExpiry = localStorage.getItem("tokenExpiresAt")
        const storedUser = localStorage.getItem("user")

        if (storedToken && storedExpiry && storedUser) {
          const expiresAt = parseInt(storedExpiry, 10)

          // Check if token is still valid (with 60 second buffer)
          if (Date.now() < expiresAt - 60000) {
            const user = JSON.parse(storedUser)
            // eslint-disable-next-line no-console
            console.log("[Auth] Restored session from localStorage, expires in:", Math.round((expiresAt - Date.now()) / 1000), "seconds")

            set({
              agent: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: (user.role as AgentRole) || "agent",
                createdAt: new Date(user.createdAt || Date.now()),
              },
              token: storedToken,
              tokenExpiresAt: expiresAt,
              isAuthenticated: true,
              isInitializing: false,
            })
            return true
          } else {
            // eslint-disable-next-line no-console
            console.log("[Auth] Stored token expired, trying refresh...")
          }
        }
      }

      // If no valid stored session, try refresh token
      const success = await get().refreshToken()
      if (success) {
        // eslint-disable-next-line no-console
        console.log("[Auth] Auto-login via refresh token successful")
      } else {
        // eslint-disable-next-line no-console
        console.log("[Auth] Auto-login failed - no valid session or refresh token")
        // Clear any stale localStorage data
        if (typeof window !== "undefined") {
          localStorage.removeItem("accessToken")
          localStorage.removeItem("tokenExpiresAt")
          localStorage.removeItem("user")
        }
      }
      set({ isInitializing: false })
      return success
    } catch {
      // eslint-disable-next-line no-console
      console.log("[Auth] Auto-login failed with error")
      set({ isInitializing: false })
      return false
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.signIn({ email, password })

      if (response.status !== 'success' || !response.data) {
        const errorMsg = response.message || "Login failed"
        set({ error: errorMsg, isLoading: false })
        return false
      }

      const { user, accessToken, expiresIn, refreshToken } = response.data
      // Set expiry 30 seconds early to avoid edge cases
      const tokenExpiresAt = Date.now() + (expiresIn - 30) * 1000

      // eslint-disable-next-line no-console
      console.log("[Auth] Access token saved, expires in:", expiresIn, "seconds")

      // Store tokens in localStorage for auto-login
      if (typeof window !== "undefined") {
        // Store refresh token if provided (preferred)
        if (refreshToken) {
          localStorage.setItem("refreshToken", refreshToken)
          // eslint-disable-next-line no-console
          console.log("[Auth] Refresh token saved to localStorage")
        }
        // Also store access token and expiry for session restoration
        localStorage.setItem("accessToken", accessToken)
        localStorage.setItem("tokenExpiresAt", tokenExpiresAt.toString())
        localStorage.setItem("user", JSON.stringify(user))
        // eslint-disable-next-line no-console
        console.log("[Auth] Session data saved to localStorage for auto-login")
      }

      set({
        agent: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user.role as AgentRole) || "agent",
          createdAt: new Date(user.createdAt || Date.now()),
        },
        token: accessToken,
        tokenExpiresAt,
        isAuthenticated: true,
        isLoading: false,
      })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
      set({ error: message, isLoading: false })
      return false
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.signUp({ name, email, password })

      if (response.status !== 'success' || !response.data) {
        const errorMsg = response.message || "Signup failed"
        set({ error: errorMsg, isLoading: false })
        return false
      }

      const user = response.data

      set({
        agent: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user.role as AgentRole) || "agent",
          createdAt: new Date(user.createdAt || Date.now()),
        },
        isAuthenticated: true,
        isLoading: false,
      })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed"
      set({ error: message, isLoading: false })
      return false
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await authApi.signOut()
    } catch {
      // Continue with logout even if API call fails
    }
    // Clear all auth data from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("refreshToken")
      localStorage.removeItem("accessToken")
      localStorage.removeItem("tokenExpiresAt")
      localStorage.removeItem("user")
    }
    // Clear local token state
    set({ agent: null, token: null, tokenExpiresAt: 0, isAuthenticated: false, isLoading: false, error: null })
  },

  clearError: () => set({ error: null }),
}))

// Initialize token getter for API client
setTokenGetter(() => useAuthStore.getState().token)
setTokenExpiredChecker(() => useAuthStore.getState().isTokenExpired())
setTokenRefresher(() => useAuthStore.getState().refreshToken())
setAttachmentSessionIdGetter(() => useAuthStore.getState().token)

// Initialize logout handler for API client (auto-logout on invalid/expired token)
setLogoutHandler(() => {
  // Clear all auth data from localStorage
  if (typeof window !== "undefined") {
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("accessToken")
    localStorage.removeItem("tokenExpiresAt")
    localStorage.removeItem("user")
  }
  // Clear auth state immediately without waiting for API call
  // Don't set error message - just silently show login screen
  useAuthStore.setState({
    agent: null,
    token: null,
    tokenExpiresAt: 0,
    isAuthenticated: false,
    isLoading: false,
    isInitializing: false,
    error: null,
  })
})

interface SmtpAuth {
  type: 'email' | 'username_email'
  email: string
  username?: string
}

interface ProjectStore {
  projects: Project[]
  isLoading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  addProject: (name: string, domain: string, smtpAuth: SmtpAuth, smtpPassword: string, advancedOptions?: { smtpHost?: string; smtpPort?: number }) => Promise<boolean>
  updateProject: (id: string, name: string, domain: string, smtpAuth?: SmtpAuth, smtpPassword?: string, advancedOptions?: { smtpHost?: string; smtpPort?: number }) => Promise<boolean>
  deleteProject: (id: string) => Promise<boolean>
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectsApi.list()
      // eslint-disable-next-line no-console
      console.log("[Projects] Fetched projects:", response.data)
      const mappedProjects = response.data.map((p) => ({
        id: p.id,
        name: p.name,
        domain: p.domain || "",
        apiKey: p.apiKey,
        smtpEmail: p.smtpEmail,
        smtpUsername: p.smtpUsername,
        smtpHost: p.smtpHost,
        smtpPort: p.smtpPort,
        createdAt: new Date(p.createdAt),
      }))
      // eslint-disable-next-line no-console
      console.log("[Projects] Mapped projects:", mappedProjects)
      set({
        projects: mappedProjects,
        isLoading: false,
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Projects] Error fetching projects:", err)
      const message = err instanceof Error ? err.message : "Failed to fetch projects"
      set({ error: message, isLoading: false })
    }
  },

  addProject: async (name, domain, smtpAuth, smtpPassword, advancedOptions?: { smtpHost?: string; smtpPort?: number }) => {
    set({ isLoading: true, error: null })
    try {
      const slug = name.toLowerCase().replace(/\s+/g, "-")

      // Build auth data based on type
      // Email only: send smtpEmail
      // Username + Email: send both smtpUsername and smtpEmail
      const authData: Record<string, string> = { smtpEmail: smtpAuth.email }
      if (smtpAuth.type === 'username_email' && smtpAuth.username) {
        authData.smtpUsername = smtpAuth.username
      }

      const response = await projectsApi.create({
        name,
        slug,
        domain,
        ...authData,
        smtpPassword,
        smtpHost: advancedOptions?.smtpHost || "smtp.gmail.com",
        smtpPort: advancedOptions?.smtpPort || 587,
      })
      const p = response.data
      set((state) => ({
        projects: [
          ...state.projects,
          {
            id: p.id,
            name: p.name,
            domain: p.domain || "",
            apiKey: p.apiKey,
            createdAt: new Date(p.createdAt),
          },
        ],
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project"
      // eslint-disable-next-line no-console
      console.log("[Projects] Create error:", message)
      set({ error: message, isLoading: false })
      return false
    }
  },

  updateProject: async (id, name, domain, smtpAuth, smtpPassword, advancedOptions?: { smtpHost?: string; smtpPort?: number }) => {
    set({ isLoading: true, error: null })
    try {
      const updateData: Record<string, unknown> = { name, domain }

      // Build auth data based on type
      // Email only: send smtpEmail
      // Username + Email: send both smtpUsername and smtpEmail
      if (smtpAuth) {
        updateData.smtpEmail = smtpAuth.email
        if (smtpAuth.type === 'username_email') {
          updateData.smtpUsername = smtpAuth.username
        } else {
          // Clear username if switching to email only mode
          updateData.smtpUsername = ""
        }
      }

      if (smtpPassword) updateData.smtpPassword = smtpPassword
      if (advancedOptions?.smtpHost) updateData.smtpHost = advancedOptions.smtpHost
      if (advancedOptions?.smtpPort) updateData.smtpPort = advancedOptions.smtpPort

      const response = await projectsApi.update(id, updateData)
      const updatedProject = response.data

      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? {
          ...p,
          name: updatedProject.name,
          domain: updatedProject.domain || "",
          smtpEmail: updatedProject.smtpEmail,
          smtpUsername: updatedProject.smtpUsername,
          smtpHost: updatedProject.smtpHost,
          smtpPort: updatedProject.smtpPort,
          // usage of apiKey should remain if it's not in the update response or if it matches
          // apiKey: updatedProject.apiKey, // API key usually doesn't change on update unless regenerated
          updatedAt: new Date(updatedProject.updatedAt)
        } : p)),
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update project"
      // eslint-disable-next-line no-console
      console.log("[Projects] Update error:", message)
      set({ error: message, isLoading: false })
      return false
    }
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await projectsApi.delete(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete project"
      set({ error: message, isLoading: false })
      return false
    }
  },
}))

interface TicketStore {
  tickets: Ticket[]
  messages: Message[]
  selectedTicketId: string | null
  searchQuery: string
  statusFilter: TicketStatus | "all"
  projectFilter: string | "all"
  isLoading: boolean
  isLoadingMore: boolean
  isLoadingMessages: boolean
  isLoadingMoreMessages: boolean
  error: string | null
  // Pagination state
  ticketsTotal: number
  ticketsHasMore: boolean
  ticketsOffset: number
  messagesTotal: number
  messagesHasMore: boolean
  messagesOffset: number
  // Added mobile UI state
  isMobileSidebarOpen: boolean
  isMobileTicketListOpen: boolean
  ticketStats: {
    pending: number
    in_progress: number
    on_hold: number
    resolved: number
    closed: number
    all: number
  }
  ticketCounts: TicketCounts

  unreadFirst: boolean
  setUnreadFirst: (value: boolean) => void

  fetchTickets: (reset?: boolean) => Promise<void>
  softRefreshTickets: () => Promise<void>
  fetchCounts: () => Promise<void>
  fetchMoreTickets: () => Promise<void>
  fetchMessages: (ticketId: string, reset?: boolean) => Promise<void>
  fetchMoreMessages: (ticketId: string) => Promise<void>
  setSelectedTicket: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: TicketStatus | "all") => void
  setProjectFilter: (projectId: string | "all") => void
  updateTicketStatus: (ticketId: string, status: TicketStatus) => Promise<void>
  addMessage: (ticketId: string, body: string, isInternal?: boolean) => Promise<void>
  // Mobile UI controls
  setMobileSidebarOpen: (open: boolean) => void
  setMobileTicketListOpen: (open: boolean) => void
}

const TICKETS_PAGE_SIZE = 10
const MESSAGES_PAGE_SIZE = 5

export const useTicketStore = create<TicketStore>((set, get) => ({
  tickets: [],
  messages: [],
  selectedTicketId: null,
  searchQuery: "",
  statusFilter: "all",
  projectFilter: "all",
  isLoading: false,
  isLoadingMore: false,
  isLoadingMessages: false,
  isLoadingMoreMessages: false,
  error: null,
  // Pagination state
  ticketsTotal: 0,
  ticketsHasMore: true,
  ticketsOffset: 0,
  messagesTotal: 0,
  messagesHasMore: false,
  messagesOffset: 0,
  isMobileSidebarOpen: false,
  isMobileTicketListOpen: true,
  unreadFirst: false,
  ticketStats: {
    pending: 0,
    in_progress: 0,
    on_hold: 0,
    resolved: 0,
    closed: 0,
    all: 0,
  },
  ticketCounts: {
    global: {
      pending: 0,
      in_progress: 0,
      on_hold: 0,
      resolved: 0,
      closed: 0,
      all: 0,
    },
    projects: {},
  },

  fetchTickets: async (reset = true) => {
    const { statusFilter, projectFilter } = get()
    if (reset) {
      set({ isLoading: true, error: null, tickets: [], ticketsOffset: 0, ticketsHasMore: true })
    }
    try {
      // Concurrently fetch tickets list and global/per-project counts to optimize network performance
      const [response, countsResponse] = await Promise.all([
        ticketsApi.list({
          limit: TICKETS_PAGE_SIZE,
          offset: 0,
          status: statusFilter === "all" ? undefined : statusFilter,
          projectId: projectFilter === "all" ? undefined : projectFilter,
          unreadFirst: get().unreadFirst,
        }),
        ticketsApi.getCounts()
      ])

      // eslint-disable-next-line no-console
      console.log("[Tickets] Raw API response:", response.data, "pagination:", response.pagination)

      const mappedTickets = (response.data || []).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        projectId: t.projectId,
        subject: t.subject,
        description: t.description || "",
        status: t.status as TicketStatus,
        priority: t.priority,
        clientName: t.client?.name?.trim() || "Unknown",
        clientEmail: t.client?.email || "",
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }))

      const pagination = response.pagination
      const stats = response.stats
      set({
        tickets: mappedTickets,
        ticketsTotal: pagination?.total || mappedTickets.length,
        ticketsHasMore: pagination?.hasMore ?? mappedTickets.length >= TICKETS_PAGE_SIZE,
        ticketsOffset: TICKETS_PAGE_SIZE,
        isLoading: false,
        ...(stats && { ticketStats: stats }),
        ...(countsResponse.data && { ticketCounts: countsResponse.data }),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch tickets"
      set({ error: message, isLoading: false })
    }
  },

  // Soft refresh: fetch latest tickets and MERGE into existing list without clearing.
  // This preserves the selected ticket and visual state during background polling.
  softRefreshTickets: async () => {
    const { statusFilter, projectFilter } = get()
    try {
      // Concurrently fetch updated list and counts
      const [response, countsResponse] = await Promise.all([
        ticketsApi.list({
          limit: TICKETS_PAGE_SIZE,
          offset: 0,
          status: statusFilter === "all" ? undefined : statusFilter,
          projectId: projectFilter === "all" ? undefined : projectFilter,
          unreadFirst: get().unreadFirst,
        }),
        ticketsApi.getCounts()
      ])

      const mappedTickets = (response.data || []).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        projectId: t.projectId,
        subject: t.subject,
        description: t.description || "",
        status: t.status as TicketStatus,
        priority: t.priority,
        clientName: t.client?.name?.trim() || "Unknown",
        clientEmail: t.client?.email || "",
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }))

      const pagination = response.pagination

      set((state) => {
        // Build a map of incoming tickets for fast lookup
        const incomingMap = new Map(mappedTickets.map(t => [t.id, t]))
        // Update any existing tickets that changed, keep order
        const updatedExisting = state.tickets.map(t => incomingMap.get(t.id) ?? t)
        // Find brand-new tickets not yet in the list, prepend them
        const existingIds = new Set(state.tickets.map(t => t.id))
        const newTickets = mappedTickets.filter(t => !existingIds.has(t.id))
        return {
          tickets: [...newTickets, ...updatedExisting],
          ticketsTotal: pagination?.total || state.ticketsTotal,
          ticketsHasMore: pagination?.hasMore ?? state.ticketsHasMore,
          ...(response.stats && { ticketStats: response.stats }),
          ...(countsResponse.data && { ticketCounts: countsResponse.data }),
        }
      })

      // eslint-disable-next-line no-console
      console.log("[Tickets] Soft refresh merged, no UI reset.")
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Tickets] Soft refresh failed (non-critical):", err)
    }
  },

  fetchCounts: async () => {
    try {
      const response = await ticketsApi.getCounts()
      if (response.data) {
        set({ ticketCounts: response.data })
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Tickets] Failed to fetch counts:", err)
    }
  },

  fetchMoreTickets: async () => {
    const { ticketsHasMore, isLoadingMore, ticketsOffset, statusFilter, projectFilter } = get()
    if (!ticketsHasMore || isLoadingMore) return

    set({ isLoadingMore: true })
    try {
      const response = await ticketsApi.list({
        limit: TICKETS_PAGE_SIZE,
        offset: ticketsOffset,
        status: statusFilter === "all" ? undefined : statusFilter,
        projectId: projectFilter === "all" ? undefined : projectFilter,
        unreadFirst: get().unreadFirst,
      })
      // eslint-disable-next-line no-console
      console.log("[Tickets] Load more response:", response.data?.length, "items, offset:", ticketsOffset)

      const mappedTickets = (response.data || []).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        projectId: t.projectId,
        subject: t.subject,
        description: t.description || "",
        status: t.status as TicketStatus,
        priority: t.priority,
        clientName: t.client?.name?.trim() || "Unknown",
        clientEmail: t.client?.email || "",
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }))

      const pagination = response.pagination
      set((state) => {
        // Deduplicate tickets by id to prevent duplicate key errors
        const existingIds = new Set(state.tickets.map(t => t.id))
        const newTickets = mappedTickets.filter(t => !existingIds.has(t.id))
        return {
          tickets: [...state.tickets, ...newTickets],
          ticketsTotal: pagination?.total || state.ticketsTotal,
          ticketsHasMore: pagination?.hasMore ?? mappedTickets.length >= TICKETS_PAGE_SIZE,
          ticketsOffset: state.ticketsOffset + mappedTickets.length,
          isLoadingMore: false,
          ...(response.stats && { ticketStats: response.stats }),
        }
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Tickets] Failed to load more:", err)
      set({ isLoadingMore: false })
    }
  },

  fetchMessages: async (ticketId: string, reset = true) => {
    if (reset) {
      set({ isLoadingMessages: true, messages: [], messagesOffset: 0, messagesHasMore: false })
    }
    try {
      // eslint-disable-next-line no-console
      console.log("[Messages] Fetching messages for ticket:", ticketId, "with limit:", MESSAGES_PAGE_SIZE, "offset: 0")
      // Fetch latest messages first with pagination
      const response = await ticketsApi.getMessages(ticketId, { limit: MESSAGES_PAGE_SIZE, offset: 0 })
      // eslint-disable-next-line no-console
      console.log("[Messages] API response:", response)

      // Response format: { data: TicketMessage[], pagination: {...} }
      const messages = response.data || []
      const pagination = response.pagination

      // eslint-disable-next-line no-console
      console.log("[Messages] Extracted", messages.length, "messages (expected max", MESSAGES_PAGE_SIZE, ") - pagination:", pagination)

      const mappedMessages = messages.map((m) => ({
        id: m.id,
        ticketId: ticketId,
        senderType: m.senderType as "client" | "agent",
        senderName: m.senderName || m.sender?.name || (m.senderType === "agent" ? "Agent" : "Customer"),
        senderEmail: m.senderEmail || m.sender?.email,
        body: m.body,
        isInternal: m.isInternal,
        attachmentIds: m.attachmentIds || [],
        createdAt: new Date(m.createdAt),
      })) // No need to reverse - backend now returns latest first

      // eslint-disable-next-line no-console
      console.log("[Messages] Mapped messages:", mappedMessages)

      set({
        messages: mappedMessages,
        messagesTotal: pagination?.total || messages.length,
        messagesHasMore: pagination?.hasMore ?? messages.length >= MESSAGES_PAGE_SIZE,
        messagesOffset: MESSAGES_PAGE_SIZE,
        isLoadingMessages: false,
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Messages] Failed to fetch messages:", err)
      set({ isLoadingMessages: false })
    }
  },

  fetchMoreMessages: async (ticketId: string) => {
    const { messagesHasMore, isLoadingMoreMessages, messagesOffset } = get()
    if (!messagesHasMore || isLoadingMoreMessages) return

    set({ isLoadingMoreMessages: true })
    try {
      // eslint-disable-next-line no-console
      console.log("[Messages] Loading more messages with limit:", MESSAGES_PAGE_SIZE, "offset:", messagesOffset)
      const response = await ticketsApi.getMessages(ticketId, { limit: MESSAGES_PAGE_SIZE, offset: messagesOffset })

      // Response format: { data: TicketMessage[], pagination: {...} }
      const messages = response.data || []
      const pagination = response.pagination

      // eslint-disable-next-line no-console
      console.log("[Messages] Load more API returned", messages.length, "messages (expected max", MESSAGES_PAGE_SIZE, ") - pagination:", pagination)

      const mappedMessages = messages.map((m) => ({
        id: m.id,
        ticketId: ticketId,
        senderType: m.senderType as "client" | "agent",
        senderName: m.senderName || m.sender?.name || (m.senderType === "agent" ? "Agent" : "Customer"),
        senderEmail: m.senderEmail || m.sender?.email,
        body: m.body,
        isInternal: m.isInternal,
        attachmentIds: m.attachmentIds || [],
        createdAt: new Date(m.createdAt),
      })) // No need to reverse - backend returns in correct order

      set((state) => {
        // Deduplicate messages by id to prevent duplicate key errors
        const existingIds = new Set(state.messages.map(m => m.id))
        const newMessages = mappedMessages.filter(m => !existingIds.has(m.id))
        return {
          // Append older messages to the end (backend returns latest first, so older messages go at the end)
          messages: [...state.messages, ...newMessages],
          messagesTotal: pagination?.total || state.messagesTotal,
          messagesHasMore: pagination?.hasMore ?? messages.length >= MESSAGES_PAGE_SIZE,
          messagesOffset: state.messagesOffset + messages.length,
          isLoadingMoreMessages: false,
        }
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Messages] Failed to load more:", err)
      set({ isLoadingMoreMessages: false })
    }
  },

  setSelectedTicket: (id) => {
    set({ selectedTicketId: id, isMobileTicketListOpen: false })
    if (id) {
      get().fetchMessages(id)
    }
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => {
    set({ statusFilter: status, isMobileSidebarOpen: false })
    get().fetchTickets()
  },
  setProjectFilter: (projectId) => {
    set({ projectFilter: projectId, isMobileSidebarOpen: false })
    get().fetchTickets()
  },
  setUnreadFirst: (value) => {
    set({ unreadFirst: value })
    get().fetchTickets()
  },

  updateTicketStatus: async (ticketId, status) => {
    try {
      await ticketsApi.update(ticketId, { status })
      set((state) => ({
        tickets: state.tickets.map((t) => (t.id === ticketId ? { ...t, status, updatedAt: new Date() } : t)),
      }))
      await get().softRefreshTickets()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Tickets] Failed to update status:", err)
    }
  },

  addMessage: async (ticketId, body, isInternal = false) => {
    const response = await ticketsApi.addMessage(ticketId, { body, isInternal })

    // Check if response indicates failure
    if (!response.data) {
      const errorMessage = (response as { error?: { message?: string } }).error?.message || "Failed to send message"
      throw new Error(errorMessage)
    }

    const m = response.data
    const currentAgent = useAuthStore.getState().agent

    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: m.id,
          ticketId,
          senderType: "agent" as const,
          body: m.body,
          isInternal: m.isInternal,
          createdAt: new Date(m.createdAt),
          senderName: currentAgent?.name || "Agent",
          senderEmail: currentAgent?.email || "",
        },
      ],
      tickets: state.tickets.map((t) => (t.id === ticketId ? { ...t, updatedAt: new Date() } : t)),
    }))
  },

  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  setMobileTicketListOpen: (open) => set({ isMobileTicketListOpen: open }),
}))

interface TeamStore {
  members: Agent[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  membersTotal: number
  membersHasMore: boolean
  membersOffset: number
  fetchMembers: (reset?: boolean) => Promise<void>
  fetchMoreMembers: () => Promise<void>
  addMember: (name: string, email: string, password: string, role: AgentRole) => Promise<boolean>
  deleteMember: (id: string) => Promise<boolean>
  updateMemberRole: (id: string, role: AgentRole) => Promise<boolean>
}

const MEMBERS_PAGE_SIZE = 10

export const useTeamStore = create<TeamStore>((set, get) => ({
  members: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  membersTotal: 0,
  membersHasMore: true,
  membersOffset: 0,

  fetchMembers: async (reset = true) => {
    if (reset) {
      set({ isLoading: true, error: null, members: [], membersOffset: 0, membersHasMore: false })
    }
    try {
      const { usersApi } = await import("./api")
      // Fetch all members at once for client-side pagination (limit 1000 should cover most cases)
      const response = await usersApi.list({ limit: 1000, offset: 0 })
      // eslint-disable-next-line no-console
      console.log("[Team] Fetched members:", response.data?.length, "pagination:", response.pagination)

      const mappedMembers = (response.data || []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: (u.role as AgentRole) || "developer",
        createdAt: new Date(u.createdAt || Date.now()),
      }))

      set({
        members: mappedMembers,
        membersTotal: mappedMembers.length,
        membersHasMore: false,
        membersOffset: 0,
        isLoading: false,
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Team] Error fetching members:", err)
      const message = err instanceof Error ? err.message : "Failed to fetch team members"
      set({ error: message, isLoading: false })
    }
  },

  fetchMoreMembers: async () => {
    const { membersHasMore, isLoadingMore, membersOffset } = get()
    if (!membersHasMore || isLoadingMore) return

    set({ isLoadingMore: true })
    try {
      const { usersApi } = await import("./api")
      const response = await usersApi.list({ limit: MEMBERS_PAGE_SIZE, offset: membersOffset })
      // eslint-disable-next-line no-console
      console.log("[Team] Load more members:", response.data?.length, "offset:", membersOffset)

      const mappedMembers = (response.data || []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: (u.role as AgentRole) || "developer",
        createdAt: new Date(u.createdAt || Date.now()),
      }))

      const pagination = response.pagination
      set((state) => {
        // Deduplicate members by id to prevent duplicate key errors
        const existingIds = new Set(state.members.map(m => m.id))
        const newMembers = mappedMembers.filter(m => !existingIds.has(m.id))
        return {
          members: [...state.members, ...newMembers],
          membersTotal: pagination?.total || state.membersTotal,
          membersHasMore: pagination?.hasMore ?? mappedMembers.length >= MEMBERS_PAGE_SIZE,
          membersOffset: state.membersOffset + mappedMembers.length,
          isLoadingMore: false,
        }
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Team] Failed to load more members:", err)
      set({ isLoadingMore: false })
    }
  },

  addMember: async (name, email, password, role) => {
    set({ isLoading: true, error: null })
    try {
      const { usersApi } = await import("./api")
      const response = await usersApi.create({ name, email, password, role })
      const u = response.data
      set((state) => ({
        members: [
          ...state.members,
          {
            id: u.id,
            name: u.name,
            email: u.email,
            role: (u.role as AgentRole) || "developer",
            createdAt: new Date(u.createdAt || Date.now()),
          },
        ],
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add member"
      set({ error: message, isLoading: false })
      return false
    }
  },

  deleteMember: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { usersApi } = await import("./api")
      await usersApi.delete(id)
      set((state) => ({
        members: state.members.filter((m) => m.id !== id),
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete member"
      set({ error: message, isLoading: false })
      return false
    }
  },

  updateMemberRole: async (id, role) => {
    set({ isLoading: true, error: null })
    try {
      const { usersApi } = await import("./api")
      await usersApi.update(id, { role })
      set((state) => ({
        members: state.members.map((m) => (m.id === id ? { ...m, role } : m)),
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update member role"
      set({ error: message, isLoading: false })
      return false
    }
  },
}))

interface UnreadStore {
  unreadItems: UnreadItem[]
  fetchUnread: () => Promise<void>
  markAsRead: (ticketId: string) => Promise<void>
  hasUnreadForProject: (projectId: string) => boolean
  hasUnreadForTicket: (ticketId: string) => boolean
  getUnreadIdForTicket: (ticketId: string) => string | undefined
}

export const useUnreadStore = create<UnreadStore>((set, get) => ({
  unreadItems: [],

  fetchUnread: async () => {
    try {
      const response = await unreadApi.list()
      // eslint-disable-next-line no-console
      console.log("[Unread] Fetched unread items:", response.data)

      const newUnreadItems = Array.isArray(response.data) ? response.data : []

      const ticketStore = useTicketStore.getState()
      const currentTicketIds = new Set(ticketStore.tickets.map(t => t.id))

      // Check for new tickets that aren't in the currently loaded list
      const newTicketIds = newUnreadItems
        .map(item => item.ticketId)
        .filter(ticketId => !currentTicketIds.has(ticketId))

      if (newTicketIds.length > 0) {
        // eslint-disable-next-line no-console
        console.log("[Unread] Found new ticket IDs not in current list:", newTicketIds)

        // Refresh tickets based on current filter using soft refresh
        // (avoids clearing the list which would cause a UI flash and lose ticket focus)
        const { projectFilter } = ticketStore

        if (projectFilter === "all") {
          // eslint-disable-next-line no-console
          console.log("[Unread] Soft-refreshing all tickets to include new tickets")
          ticketStore.softRefreshTickets()
        } else {
          // Check if any new tickets belong to the currently filtered project
          const newTicketsInCurrentProject = newUnreadItems.filter(
            item => newTicketIds.includes(item.ticketId) && item.projectId === projectFilter
          )

          if (newTicketsInCurrentProject.length > 0) {
            // eslint-disable-next-line no-console
            console.log("[Unread] New tickets found in current project filter, soft-refreshing tickets")
            ticketStore.softRefreshTickets()
          } else {
            // eslint-disable-next-line no-console
            console.log("[Unread] New tickets found but not in current project filter, skipping refresh")
          }
        }
      }

      // Check if any unread items are for resolved tickets - if so, refresh those tickets
      // This handles the case where a client replies to a resolved ticket (backend changes status)
      const resolvedTicketsWithUnread = newUnreadItems.filter(item => {
        const ticket = ticketStore.tickets.find(t => t.id === item.ticketId)
        return ticket && ticket.status === 'resolved'
      })

      if (resolvedTicketsWithUnread.length > 0) {
        // eslint-disable-next-line no-console
        console.log("[Unread] Found unread messages for resolved tickets, refreshing:",
          resolvedTicketsWithUnread.map(item => item.ticketId))

        // Refresh each resolved ticket individually to get updated status
        const { ticketsApi } = await import("./api")
        for (const item of resolvedTicketsWithUnread) {
          try {
            const ticketResponse = await ticketsApi.getById(item.ticketId)
            if (ticketResponse.data) {
              const updatedTicket = ticketResponse.data
              // Update the ticket in the store without changing order
              useTicketStore.setState((state) => ({
                tickets: state.tickets.map(t =>
                  t.id === updatedTicket.id
                    ? {
                      ...t,
                      status: updatedTicket.status as TicketStatus,
                      updatedAt: new Date(updatedTicket.updatedAt),
                    }
                    : t
                )
              }))
              // eslint-disable-next-line no-console
              console.log("[Unread] Refreshed ticket status:", updatedTicket.id, "->", updatedTicket.status)
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.log("[Unread] Failed to refresh ticket:", item.ticketId, err)
          }
        }
      }

      // Ensure we always set an array, even if response is malformed
      set({ unreadItems: newUnreadItems })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Unread] Failed to fetch unread items:", err)
      // Don't clear existing items on fetch failure
    }
  },

  markAsRead: async (ticketId: string) => {
    // Check if ticket is actually unread before making API call
    const currentUnread = get().unreadItems || []
    const isUnread = currentUnread.some((item) => item.ticketId === ticketId)

    if (!isUnread) {
      // eslint-disable-next-line no-console
      console.log("[Unread] Ticket already read, skipping:", ticketId)
      return
    }

    // eslint-disable-next-line no-console
    console.log("[Unread] markAsRead called for ticketId:", ticketId)

    // Optimistically update UI first
    set((state) => ({
      unreadItems: (state.unreadItems || []).filter((item) => item.ticketId !== ticketId),
    }))

    try {
      await unreadApi.deleteByTicketId(ticketId)
      // eslint-disable-next-line no-console
      console.log("[Unread] Successfully marked as read:", ticketId)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Unread] Failed to mark as read:", err)
      // Revert optimistic update on failure - re-fetch to get accurate state
      try {
        const response = await unreadApi.list()
        set({ unreadItems: response.data })
      } catch {
        // If re-fetch also fails, just log it
        console.log("[Unread] Failed to re-fetch unread items after error")
      }
    }
  },

  hasUnreadForProject: (projectId: string) => {
    return (get().unreadItems || []).some((item) => item.projectId === projectId)
  },

  hasUnreadForTicket: (ticketId: string) => {
    return (get().unreadItems || []).some((item) => item.ticketId === ticketId)
  },

  getUnreadIdForTicket: (ticketId: string) => {
    return (get().unreadItems || []).find((item) => item.ticketId === ticketId)?.id
  },
}))

interface TemplateStore {
  templates: TemplateResponse[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  templatesTotal: number
  templatesHasMore: boolean
  templatesOffset: number
  fetchTemplates: (reset?: boolean) => Promise<void>
  fetchMoreTemplates: () => Promise<void>
  addTemplate: (title: string, body: string) => Promise<boolean>
  updateTemplate: (id: string, title: string, body: string) => Promise<boolean>
  deleteTemplate: (id: string) => Promise<boolean>
}

const TEMPLATES_PAGE_SIZE = 10

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  templatesTotal: 0,
  templatesHasMore: true,
  templatesOffset: 0,

  fetchTemplates: async (reset = true) => {
    if (reset) {
      set({ isLoading: true, error: null, templates: [], templatesOffset: 0, templatesHasMore: true })
    }
    try {
      const response = await templatesApi.list({ limit: TEMPLATES_PAGE_SIZE, offset: 0 })
      // eslint-disable-next-line no-console
      console.log("[Templates] Fetched templates:", response.data?.length, "pagination:", response.pagination)

      const templates = response.data || []
      const pagination = response.pagination
      set({
        templates,
        templatesTotal: pagination?.total || templates.length,
        templatesHasMore: pagination?.hasMore ?? templates.length >= TEMPLATES_PAGE_SIZE,
        templatesOffset: TEMPLATES_PAGE_SIZE,
        isLoading: false,
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Templates] Failed to fetch templates:", err)
      const message = err instanceof Error ? err.message : "Failed to fetch templates"
      set({ error: message, isLoading: false })
    }
  },

  fetchMoreTemplates: async () => {
    const { templatesHasMore, isLoadingMore, templatesOffset } = get()
    if (!templatesHasMore || isLoadingMore) return

    set({ isLoadingMore: true })
    try {
      const response = await templatesApi.list({ limit: TEMPLATES_PAGE_SIZE, offset: templatesOffset })
      // eslint-disable-next-line no-console
      console.log("[Templates] Load more templates:", response.data?.length, "offset:", templatesOffset)

      const templates = response.data || []
      const pagination = response.pagination
      set((state) => {
        // Deduplicate templates by id to prevent duplicate key errors
        const existingIds = new Set(state.templates.map(t => t.id))
        const newTemplates = templates.filter(t => !existingIds.has(t.id))
        return {
          templates: [...state.templates, ...newTemplates],
          templatesTotal: pagination?.total || state.templatesTotal,
          templatesHasMore: pagination?.hasMore ?? templates.length >= TEMPLATES_PAGE_SIZE,
          templatesOffset: state.templatesOffset + templates.length,
          isLoadingMore: false,
        }
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[Templates] Failed to load more templates:", err)
      set({ isLoadingMore: false })
    }
  },

  addTemplate: async (title, body) => {
    set({ isLoading: true, error: null })
    try {
      const response = await templatesApi.create({ title, body })
      set((state) => ({
        templates: [...state.templates, response.data],
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create template"
      set({ error: message, isLoading: false })
      return false
    }
  },

  updateTemplate: async (id, title, body) => {
    set({ isLoading: true, error: null })
    try {
      const response = await templatesApi.update(id, { title, body })
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? response.data : t)),
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update template"
      set({ error: message, isLoading: false })
      return false
    }
  },

  deleteTemplate: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await templatesApi.delete(id)
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
        isLoading: false,
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete template"
      set({ error: message, isLoading: false })
      return false
    }
  },
}))
