"use client"

import { useTicketStore, useProjectStore, useUnreadStore } from "@/lib/store"
import { useFilteredTickets, useIsMobile, useIsTablet, useDebounce } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { Search, Loader2, MessageSquareText, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useCallback, useRef, memo, useState, useEffect, useMemo, useLayoutEffect } from "react"
import { MobileMenuButton } from "./sidebar"
import { ticketsApi } from "@/lib/api"
import type { Ticket } from "@/lib/types"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: "bg-status-pending/20 text-status-pending",
    in_progress: "bg-status-in-progress/20 text-status-in-progress",
    resolved: "bg-status-resolved/20 text-status-resolved",
    closed: "bg-zinc-500/20 text-zinc-500 dark:bg-zinc-500/30 dark:text-zinc-400",
    on_hold: "bg-amber-500/20 text-amber-600 dark:bg-amber-500/30 dark:text-amber-400",
  }

  const labels = {
    pending: "Pending",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
    on_hold: "On Hold",
  }

  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full whitespace-nowrap", styles[status as keyof typeof styles])}>
      {labels[status as keyof typeof labels] || status}
    </span>
  )
})

const TicketItem = memo(function TicketItem({
  ticket,
  isSelected,
  onSelect,
  projectName,
  hasUnread,
}: {
  ticket: { id: string; ticketNumber?: number; subject: string; status: string; clientName?: string; clientEmail?: string; projectId: string; updatedAt: Date }
  isSelected: boolean
  onSelect: (id: string) => void
  projectName?: string
  hasUnread?: boolean
}) {
  return (
    <button
      onClick={() => onSelect(ticket.id)}
      className={cn(
        "w-full p-3 sm:p-4 text-left border-b border-border hover:bg-muted/50 transition-colors",
        isSelected && "bg-muted",
      )}
    >
      {/* Subject as main title */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasUnread && (
            <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground line-clamp-1">{ticket.subject}</span>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      {/* Ticket number below status */}
      {ticket.ticketNumber && (
        <div className="text-xs text-muted-foreground mb-1">
          #{ticket.ticketNumber}
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="truncate max-w-[120px]">{ticket.clientName || "Unknown"}</span>
        <span className="hidden sm:inline">·</span>
        <span className="truncate max-w-[100px] hidden sm:inline">{projectName || "Unknown"}</span>
      </div>
      {ticket.clientEmail && (
        <div className="text-xs text-muted-foreground mt-0.5 truncate">{ticket.clientEmail}</div>
      )}
      <div className="text-xs text-muted-foreground mt-1">{formatRelativeTime(ticket.updatedAt)}</div>
    </button>
  )
})

export function TicketList() {
  const {
    selectedTicketId,
    setSelectedTicket,
    searchQuery,
    setSearchQuery,
    isMobileTicketListOpen,
    isLoading,
    isLoadingMore,
    ticketsHasMore,
    fetchMoreTickets,
    projectFilter,
    statusFilter,
    tickets,
    unreadFirst,
    setUnreadFirst,
  } = useTicketStore()
  const { projects } = useProjectStore()
  const { hasUnreadForTicket, markAsRead, unreadItems } = useUnreadStore()

  const filteredTickets = useFilteredTickets()
  const isMobile = useIsMobile()
  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Calculate unread tickets in the current filtered selection
  const unreadCount = useMemo(() => {
    return (unreadItems || []).filter(item => {
      // Respect project filter
      if (projectFilter !== "all" && item.projectId !== projectFilter) return false
      // Respect status filter
      if (statusFilter !== "all") {
        const ticket = tickets.find(t => t.id === item.ticketId)
        if (ticket && ticket.status !== statusFilter) return false
      }
      return true
    }).length
  }, [unreadItems, projectFilter, statusFilter, tickets])

  // Deep search state
  const [isDeepSearch, setIsDeepSearch] = useState(false)
  const [deepSearchResults, setDeepSearchResults] = useState<Ticket[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Track previous search query to detect when user starts typing
  const prevSearchQueryRef = useRef("")

  // Refs for scroll-position preservation when new tickets are prepended by soft-refresh
  const savedScrollRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null)
  const prevFirstTicketIdRef = useRef<string | null>(null)

  // Detect when tickets are prepended (background soft-refresh) and keep scroll still.
  // We save scrollTop/scrollHeight after every paint, and when the first ticket ID
  // changes (prepend happened), we compensate scrollTop by the height delta.
  useLayoutEffect(() => {
    if (showSearchResults || isDeepSearch) return
    const list = listRef.current
    if (!list) return

    const currentFirstId = filteredTickets[0]?.id ?? null

    if (
      currentFirstId !== prevFirstTicketIdRef.current &&
      prevFirstTicketIdRef.current !== null &&
      savedScrollRef.current
    ) {
      const { scrollTop, scrollHeight } = savedScrollRef.current
      const heightDiff = list.scrollHeight - scrollHeight
      // Only compensate if user is not at the very top and new items were added above
      if (scrollTop > 0 && heightDiff > 0) {
        list.scrollTop = scrollTop + heightDiff
      }
    }

    // Save current state (after any adjustment) for next layout effect
    savedScrollRef.current = {
      scrollTop: list.scrollTop,
      scrollHeight: list.scrollHeight,
    }
    prevFirstTicketIdRef.current = currentFirstId
  })

  // Unfocus ticket only when user starts typing (not when clearing search after selection)
  useEffect(() => {
    const wasEmpty = prevSearchQueryRef.current.length === 0
    const isNowTyping = searchQuery.length > 0

    // Only unfocus if user started typing from empty state
    if (wasEmpty && isNowTyping && selectedTicketId) {
      setSelectedTicket(null)
    }

    prevSearchQueryRef.current = searchQuery
  }, [searchQuery, selectedTicketId, setSelectedTicket])

  // Check if we should show the load more trigger
  // Only show if there are more tickets to load AND the current filter might have more results
  const shouldShowLoadMore = useMemo(() => {
    // If there are no more tickets from the API, don't show
    if (!ticketsHasMore) return false

    // If we're filtering by project or status, we need to be more careful
    // Only show load more if the filtered results equal the total loaded tickets
    // (meaning the filter isn't hiding any tickets)
    if (projectFilter !== "all" || statusFilter !== "all") {
      // If filtered results are less than total tickets, the filter is hiding some tickets
      // In this case, we might have all the tickets for this filter already loaded
      return filteredTickets.length === tickets.length
    }

    // No filters applied, show load more if API says there are more
    return true
  }, [ticketsHasMore, projectFilter, statusFilter, filteredTickets.length, tickets.length])

  // Infinite scroll observer for loading more tickets
  useEffect(() => {
    if (!loadMoreRef.current || isDeepSearch || !shouldShowLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && shouldShowLoadMore && !isLoadingMore && !isLoading) {
          fetchMoreTickets()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [shouldShowLoadMore, isLoadingMore, isLoading, fetchMoreTickets, isDeepSearch])

  // Deep search API call
  useEffect(() => {
    if (!isDeepSearch || debouncedQuery.length < 2) {
      setDeepSearchResults([])
      return
    }

    const searchMessages = async () => {
      setIsSearching(true)
      try {
        const response = await ticketsApi.search({
          q: debouncedQuery,
          projectId: projectFilter !== "all" ? projectFilter : undefined,
          limit: 50,
        })
        setDeepSearchResults((response.data || []).map(t => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        })))
      } catch (err) {
        console.error("Search failed:", err)
        setDeepSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    searchMessages()
  }, [debouncedQuery, isDeepSearch, projectFilter])

  // Reset deep search when toggling off
  useEffect(() => {
    if (!isDeepSearch) {
      setDeepSearchResults([])
    }
  }, [isDeepSearch])

  // Clear search when clicking outside (only for deep search results)
  const handleListClick = useCallback(() => {
    if (isDeepSearch && deepSearchResults.length > 0) {
      // Don't clear if clicking on a ticket
    }
  }, [isDeepSearch, deepSearchResults])

  // Dismiss search results when clicking outside search area
  const handleBlur = useCallback(() => {
    // Small delay to allow click on results
    setTimeout(() => {
      setIsSearchFocused(false)
    }, 200)
  }, [])

  // Check if we should show search results overlay
  const showSearchResults = isDeepSearch && isSearchFocused && debouncedQuery.length >= 2

  // Use deep search results or filtered tickets
  const displayTickets = showSearchResults
    ? deepSearchResults.map(t => ({
      ...t,
      updatedAt: new Date(t.updatedAt),
      createdAt: new Date(t.createdAt),
    }))
    : filteredTickets

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedTicket(id)
      // Mark as read when selecting a ticket
      markAsRead(id)
    },
    [setSelectedTicket, markAsRead],
  )

  const handleSearchResultSelect = useCallback(
    (ticket: Ticket) => {
      // First, ensure the ticket is in the main tickets list (in case it's not loaded yet)
      const isTicketInMainList = tickets.some(t => t.id === ticket.id)

      // Select the ticket
      handleSelect(ticket.id)

      // Close search overlay immediately to show the ticket detail
      setIsSearchFocused(false)

      // Clear search after a short delay
      setTimeout(() => {
        setSearchQuery("")
        setIsDeepSearch(false)
      }, 150)
    },
    [tickets, handleSelect, setSearchQuery, setIsDeepSearch, setIsSearchFocused]
  )

  const getProjectName = useCallback(
    (projectId: string) => projects.find((p) => p.id === projectId)?.name,
    [projects],
  )

  if (isMobile && !isMobileTicketListOpen && selectedTicketId) {
    return null
  }

  return (
    <div
      className={cn(
        "border-r border-border flex flex-col h-full bg-card shrink-0",
        "w-full sm:w-80 lg:w-80",
        isMobile && "absolute inset-0 z-30",
      )}
    >
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <MobileMenuButton />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder={isDeepSearch ? "Search in messages..." : "Search tickets..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={handleBlur}
              className={cn("pl-9 bg-muted border-0 focus-visible:ring-1 w-full", searchQuery && "pr-8")}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("")
                  setIsSearchFocused(false)
                  setIsDeepSearch(false)
                  searchInputRef.current?.blur()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setIsDeepSearch(!isDeepSearch)}
            className={cn(
              "p-2 rounded-md transition-colors shrink-0",
              isDeepSearch
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
            title={isDeepSearch ? "Searching in messages (click to disable)" : "Search in messages"}
          >
            <MessageSquareText className="w-4 h-4" />
          </button>
        </div>
        {isDeepSearch && (
          <div className="text-xs text-muted-foreground px-1">
            Deep search: searching ticket subjects, descriptions, and all messages
            {debouncedQuery.length > 0 && debouncedQuery.length < 2 && " (min 2 characters)"}
          </div>
        )}
        <div className="flex items-center justify-between px-1 pt-1 select-none">
          <div className="flex items-center gap-2">
            <Switch
              id="unread-first-toggle"
              checked={unreadFirst}
              onCheckedChange={setUnreadFirst}
            />
            <Label htmlFor="unread-first-toggle" className="text-xs text-muted-foreground font-medium cursor-pointer">
              Unread First
            </Label>
          </div>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full font-semibold animate-pulse">
              {unreadCount} unread
            </span>
          )}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain relative">
        {/* Search Results Overlay */}
        {showSearchResults && (
          <div className="absolute inset-0 z-10 bg-card">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Searching messages...</span>
              </div>
            ) : deepSearchResults.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No tickets or messages match your search
              </div>
            ) : (
              <>
                <div className="px-3 py-2 text-xs font-medium text-primary border-b border-primary/20 bg-primary/5">
                  🔍 Search Results: {deepSearchResults.length} ticket{deepSearchResults.length !== 1 ? "s" : ""} found
                </div>
                {displayTickets.map((ticket) => (
                  <TicketItem
                    key={ticket.id}
                    ticket={ticket}
                    isSelected={selectedTicketId === ticket.id}
                    onSelect={() => handleSearchResultSelect(ticket)}
                    projectName={getProjectName(ticket.projectId)}
                    hasUnread={hasUnreadForTicket(ticket.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Normal Ticket List - only render when not showing search results */}
        {!showSearchResults && (
          isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {searchQuery && !isDeepSearch ? "No tickets match your search" : "No tickets found"}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border bg-muted/30">
                {filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""}
              </div>
              {filteredTickets.map((ticket) => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  isSelected={selectedTicketId === ticket.id}
                  onSelect={handleSelect}
                  projectName={getProjectName(ticket.projectId)}
                  hasUnread={hasUnreadForTicket(ticket.id)}
                />
              ))}
              {/* Load more trigger - only render when there are more tickets to load */}
              {shouldShowLoadMore && <div ref={loadMoreRef} className="h-1" />}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading more...</span>
                </div>
              )}
              {!shouldShowLoadMore && filteredTickets.length > 0 && (
                <div className="text-center py-3 text-xs text-muted-foreground">
                  {projectFilter !== "all" || statusFilter !== "all" ? "All matching tickets loaded" : "All tickets loaded"}
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()

  if (diff < 0) return "just now"

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
