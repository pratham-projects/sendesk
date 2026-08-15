"use client"

import { useEffect, useState } from "react"
import { useAuthStore, useTicketStore, useProjectStore, useTemplateStore, useUnreadStore } from "@/lib/store"
import { AuthPage } from "@/components/auth-page"
import { Sidebar } from "@/components/sidebar"
import { TicketList } from "@/components/ticket-list"
import { TicketDetail } from "@/components/ticket-detail"

export default function DashboardPage() {
  const { isAuthenticated, isInitializing, tryAutoLogin } = useAuthStore()
  const { fetchTickets } = useTicketStore()
  const { fetchProjects } = useProjectStore()
  const { fetchTemplates } = useTemplateStore()
  const { fetchUnread } = useUnreadStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Try auto-login via refresh token on mount
  useEffect(() => {
    if (isMounted && !isAuthenticated) {
      tryAutoLogin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted])

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // eslint-disable-next-line no-console
      console.log("[Page] Authenticated, fetching data...")
      fetchTickets()
      fetchProjects()
      fetchTemplates()
      fetchUnread().then(() => {
        // After fetching unread, check if focused ticket needs message refresh
        const { selectedTicketId, fetchMessages } = useTicketStore.getState()
        const { unreadItems } = useUnreadStore.getState()

        if (selectedTicketId) {
          const hasUnread = unreadItems.some(item => item.ticketId === selectedTicketId)
          if (hasUnread) {
            // eslint-disable-next-line no-console
            console.log("[Page] Focused ticket has unread messages on load, refreshing:", selectedTicketId)
            fetchMessages(selectedTicketId)
          }
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // Poll unread items every 30 seconds when authenticated
  // Also refresh messages if the focused ticket has unread items
  useEffect(() => {
    if (!isAuthenticated) return

    const checkUnreadAndRefresh = async () => {
      // Get the currently focused ticket BEFORE fetching unread
      const { selectedTicketId, fetchMessages } = useTicketStore.getState()

      // eslint-disable-next-line no-console
      console.log("[Page] Polling unread items...", selectedTicketId ? `(focused: ${selectedTicketId})` : "")

      await fetchUnread()

      // Check if the currently focused ticket has unread messages
      const { unreadItems } = useUnreadStore.getState()

      if (selectedTicketId) {
        const hasUnread = unreadItems.some(item => item.ticketId === selectedTicketId)
        if (hasUnread) {
          // eslint-disable-next-line no-console
          console.log("[Page] Focused ticket has unread messages, refreshing:", selectedTicketId)
          fetchMessages(selectedTicketId)
        }
      }
    }

    const interval = setInterval(checkUnreadAndRefresh, 30 * 1000) // 30 seconds

    return () => clearInterval(interval)
  }, [isAuthenticated, fetchUnread])

  // Wait for client-side mount and auto-login check to avoid hydration mismatch
  if (!isMounted || isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthPage />
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <Sidebar />
      <TicketList />
      <TicketDetail />
    </div>
  )
}
