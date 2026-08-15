"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useTicketStore, useUnreadStore } from "./store"
import { viewersApi, Viewer } from "./api"

const LG_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < LG_BREAKPOINT)
    }

    checkMobile()

    const mediaQuery = window.matchMedia(`(max-width: ${LG_BREAKPOINT - 1}px)`)

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    // Fallback for older browsers
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return isMobile
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false)

  useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth
      setIsTablet(width >= 640 && width < LG_BREAKPOINT)
    }

    checkTablet()
    window.addEventListener("resize", checkTablet)
    return () => window.removeEventListener("resize", checkTablet)
  }, [])

  return isTablet
}

export function useDebounce<T>(value: T, delay = 150): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export function useFilteredTickets() {
  const { tickets, searchQuery, statusFilter, projectFilter, unreadFirst } = useTicketStore()
  const { unreadItems } = useUnreadStore()
  const debouncedSearch = useDebounce(searchQuery, 150)

  return useMemo(() => {
    let filtered = tickets

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter)
    }

    // Project filter
    if (projectFilter !== "all") {
      filtered = filtered.filter((t) => t.projectId === projectFilter)
    }

    // Search filter with null-safe checks (includes ticket number search)
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase().trim()
      filtered = filtered.filter((t) => {
        const subject = t.subject?.toLowerCase() ?? ""
        const description = t.description?.toLowerCase() ?? ""
        const id = t.id?.toLowerCase() ?? ""
        const clientEmail = t.clientEmail?.toLowerCase() ?? ""
        const ticketNumberStr = t.ticketNumber?.toString() ?? ""

        return (
          subject.includes(query) ||
          description.includes(query) ||
          id.includes(query) ||
          clientEmail.includes(query) ||
          ticketNumberStr.includes(query)
        )
      })
    }

    // Sort by: unreadFirst puts unread tickets first, otherwise sort by updatedAt descending
    return [...filtered].sort((a, b) => {
      if (unreadFirst) {
        const aUnread = unreadItems.some((item) => item.ticketId === a.id)
        const bUnread = unreadItems.some((item) => item.ticketId === b.id)
        if (aUnread && !bUnread) return -1
        if (!aUnread && bUnread) return 1
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [tickets, statusFilter, projectFilter, debouncedSearch, unreadFirst, unreadItems])
}


// Heartbeat interval in milliseconds (30 seconds)
const VIEWER_HEARTBEAT_INTERVAL = 30000
// Fetch viewers interval (30 seconds)
const VIEWER_FETCH_INTERVAL = 30000
// Delay before starting viewer tracking (5 seconds)
const VIEWER_START_DELAY = 5000

/**
 * Hook to manage ticket viewers
 * - Waits 5 seconds before registering viewer (to avoid quick ticket switches)
 * - Registers viewer when ticket is focused
 * - Sends heartbeat every 45 seconds
 * - Fetches active viewers every 60 seconds
 * - Removes viewer when ticket is unfocused
 */
export function useTicketViewers(ticketId: string | null) {
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startDelayRef = useRef<NodeJS.Timeout | null>(null)
  const currentTicketIdRef = useRef<string | null>(null)
  const isTrackingRef = useRef(false)

  // Fetch viewers for the current ticket
  const fetchViewers = useCallback(async (id: string) => {
    try {
      const response = await viewersApi.getViewers(id)
      if (response.data) {
        setViewers(response.data)
      }
    } catch {
      // Silently fail - don't disrupt user experience for network issues
      // This is a non-critical feature
    }
  }, [])

  // Send heartbeat to register/update viewer presence
  const sendHeartbeat = useCallback(async (id: string) => {
    try {
      await viewersApi.addViewer(id)
    } catch {
      // Silently fail - don't disrupt user experience for network issues
    }
  }, [])

  // Remove viewer when leaving ticket
  const removeViewer = useCallback(async (id: string) => {
    try {
      await viewersApi.removeViewer(id)
    } catch {
      // Silently fail - don't disrupt user experience for network issues
    }
  }, [])

  // Clear all intervals and timeouts
  const clearIntervals = useCallback(() => {
    if (startDelayRef.current) {
      clearTimeout(startDelayRef.current)
      startDelayRef.current = null
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    if (fetchIntervalRef.current) {
      clearInterval(fetchIntervalRef.current)
      fetchIntervalRef.current = null
    }
  }, [])

  // Actually start the viewer tracking (called after delay)
  const beginTracking = useCallback(async (id: string) => {
    isTrackingRef.current = true

    // Initial heartbeat and fetch
    await sendHeartbeat(id)
    await fetchViewers(id)

    setIsLoading(false)

    // Set up heartbeat interval (every 45 seconds)
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(id)
    }, VIEWER_HEARTBEAT_INTERVAL)

    // Set up fetch interval (every 60 seconds)
    fetchIntervalRef.current = setInterval(() => {
      fetchViewers(id)
    }, VIEWER_FETCH_INTERVAL)
  }, [sendHeartbeat, fetchViewers])

  // Start tracking for a ticket (with 5 second delay)
  const startTracking = useCallback((id: string) => {
    // Clear any existing intervals/timeouts
    clearIntervals()
    isTrackingRef.current = false

    setIsLoading(true)

    // Wait 5 seconds before actually starting to track
    startDelayRef.current = setTimeout(() => {
      // Only start if we're still on the same ticket
      if (currentTicketIdRef.current === id) {
        beginTracking(id)
      }
    }, VIEWER_START_DELAY)
  }, [clearIntervals, beginTracking])

  // Stop tracking for a ticket
  const stopTracking = useCallback(async (id: string) => {
    clearIntervals()
    // Only remove viewer if we actually started tracking
    if (isTrackingRef.current) {
      await removeViewer(id)
    }
    isTrackingRef.current = false
    setViewers([])
    setIsLoading(false)
  }, [clearIntervals, removeViewer])

  // Handle ticket changes
  useEffect(() => {
    const previousTicketId = currentTicketIdRef.current

    // If we had a previous ticket, stop tracking it
    if (previousTicketId && previousTicketId !== ticketId) {
      stopTracking(previousTicketId)
    }

    // If we have a new ticket, start tracking it
    if (ticketId && ticketId !== previousTicketId) {
      startTracking(ticketId)
    }

    // Update ref
    currentTicketIdRef.current = ticketId

    // Cleanup on unmount
    return () => {
      if (currentTicketIdRef.current) {
        // Use the ref value in cleanup to avoid stale closure
        const id = currentTicketIdRef.current
        clearIntervals()
        // Only remove viewer if we actually started tracking
        if (isTrackingRef.current) {
          // Fire and forget - don't await in cleanup
          viewersApi.removeViewer(id).catch(() => { })
        }
      }
    }
  }, [ticketId, startTracking, stopTracking, clearIntervals])

  // Handle page visibility changes (tab switching, minimizing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!currentTicketIdRef.current) return

      if (document.hidden) {
        // Page is hidden - stop heartbeat but don't remove viewer yet
        // (they might come back quickly)
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
      } else {
        // Page is visible again - resume heartbeat
        const id = currentTicketIdRef.current
        sendHeartbeat(id)
        heartbeatIntervalRef.current = setInterval(() => {
          sendHeartbeat(id)
        }, VIEWER_HEARTBEAT_INTERVAL)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sendHeartbeat])

  // Handle beforeunload (page close/refresh)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only send beacon if we actually started tracking
      if (currentTicketIdRef.current && isTrackingRef.current) {
        // Use sendBeacon for reliable delivery on page close
        const apiVersion = process.env.NEXT_PUBLIC_API_VERSION || 'v2'
        const url = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/${apiVersion}/viewers/${currentTicketIdRef.current}`
        navigator.sendBeacon(url, JSON.stringify({ _method: 'DELETE' }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  return {
    viewers,
    isLoading,
    refreshViewers: () => ticketId && fetchViewers(ticketId),
  }
}
