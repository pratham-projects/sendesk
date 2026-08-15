"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { useTicketStore, useProjectStore, useUnreadStore } from "@/lib/store"
import { useIsMobile } from "@/lib/hooks"
import { useToast } from "@/hooks/use-toast"
import { CreateTicketModal } from "@/components/create-ticket-modal"
import {
  Inbox,
  Clock,
  CheckCircle,
  Settings,
  LayoutTemplate,
  AlertCircle,
  X,
  Menu,
  Loader2,
  RefreshCw,
  Globe,
  Plus,
  Archive,
  PauseCircle,
} from "lucide-react"
import { useMemo, useEffect, useState } from "react"
import type { TicketStatus } from "@/lib/types"

export function Sidebar() {
  const {
    statusFilter,
    setStatusFilter,
    projectFilter,
    setProjectFilter,
    tickets,
    ticketStats,
    ticketCounts,
    selectedTicketId,
    fetchMessages,
    fetchTickets,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
  } = useTicketStore()
  const { projects, isLoading: projectsLoading } = useProjectStore()
  const { fetchUnread, hasUnreadForProject, markAsRead } = useUnreadStore()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    if (!isMobile && isMobileSidebarOpen) {
      setMobileSidebarOpen(false)
    }
  }, [isMobile, isMobileSidebarOpen, setMobileSidebarOpen])

  // Get counts depending on whether a specific project filter is selected or global
  const currentCounts = useMemo(() => {
    if (!ticketCounts) {
      return {
        pending: 0,
        in_progress: 0,
        on_hold: 0,
        resolved: 0,
        closed: 0,
        all: 0,
      }
    }
    if (projectFilter === "all") {
      return ticketCounts.global
    }
    return ticketCounts.projects[projectFilter] || {
      pending: 0,
      in_progress: 0,
      on_hold: 0,
      resolved: 0,
      closed: 0,
      all: 0,
    }
  }, [ticketCounts, projectFilter])

  const { pendingCount, inProgressCount, onHoldCount, resolvedCount, closedCount, allCount } = useMemo(
    () => ({
      pendingCount: currentCounts.pending,
      inProgressCount: currentCounts.in_progress,
      onHoldCount: currentCounts.on_hold,
      resolvedCount: currentCounts.resolved,
      closedCount: currentCounts.closed,
      allCount: currentCounts.all,
    }),
    [currentCounts],
  )

  const globalActiveCount = useMemo(() => {
    if (!ticketCounts || !ticketCounts.global) return 0
    const g = ticketCounts.global
    return g.pending + g.in_progress + g.on_hold
  }, [ticketCounts])

  const getProjectActiveCount = (projectId: string) => {
    if (!ticketCounts || !ticketCounts.projects) return 0
    const p = ticketCounts.projects[projectId]
    if (!p) return 0
    return p.pending + p.in_progress + p.on_hold
  }

  const handleStatusChange = (status: "all" | TicketStatus) => {
    setStatusFilter(status)
    if (isMobile) setMobileSidebarOpen(false)
  }

  const handleProjectChange = (projectId: string | "all") => {
    setProjectFilter(projectId)
    if (isMobile) setMobileSidebarOpen(false)
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">SendDesk</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Ticket Management</p>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="p-2 hover:bg-muted rounded-md lg:hidden"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors mb-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          <span>Create Ticket</span>
        </button>

        <p className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">Status</p>

        <button
          onClick={() => handleStatusChange("all")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
            statusFilter === "all"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
          )}
        >
          <Inbox className="w-4 h-4 shrink-0" />
          <span className="truncate">All Tickets</span>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded shrink-0">{allCount}</span>
        </button>

        <button
          onClick={() => handleStatusChange("pending")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
            statusFilter === "pending"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
          )}
        >
          <AlertCircle className="w-4 h-4 text-status-pending shrink-0" />
          <span className="truncate">Pending</span>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded shrink-0">{pendingCount}</span>
        </button>

        <button
          onClick={() => handleStatusChange("in_progress")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
            statusFilter === "in_progress"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
          )}
        >
          <Clock className="w-4 h-4 text-status-in-progress shrink-0" />
          <span className="truncate">In Progress</span>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded shrink-0">{inProgressCount}</span>
        </button>

        <button
          onClick={() => handleStatusChange("on_hold")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
            statusFilter === "on_hold"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
          )}
        >
          <PauseCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">On Hold</span>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded shrink-0">{onHoldCount}</span>
        </button>

        <button
          onClick={() => handleStatusChange("resolved")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
            statusFilter === "resolved"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
          )}
        >
          <CheckCircle className="w-4 h-4 text-status-resolved shrink-0" />
          <span className="truncate">Resolved</span>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded shrink-0">{resolvedCount}</span>
        </button>

        <button
          onClick={() => handleStatusChange("closed")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
            statusFilter === "closed"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
          )}
        >
          <Archive className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="truncate">Closed</span>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded shrink-0">{closedCount}</span>
        </button>

        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">Projects</p>

          <button
            onClick={() => handleProjectChange("all")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
              projectFilter === "all"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span className="truncate">All Projects</span>
            {globalActiveCount > 0 && (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                {globalActiveCount}
              </span>
            )}
          </button>

          {projectsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            projects.map((project) => {
              let pressTimer: ReturnType<typeof setTimeout> | null = null

              const copyProjectId = async () => {
                try {
                  await navigator.clipboard.writeText(project.id)
                  toast({ title: "Copied", description: "Project ID copied to clipboard" })
                } catch {
                  toast({ variant: "destructive", title: "Error", description: "Failed to copy" })
                }
              }

              const handlePressStart = () => {
                pressTimer = setTimeout(() => {
                  copyProjectId()
                }, 500)
              }

              const handlePressEnd = () => {
                if (pressTimer) {
                  clearTimeout(pressTimer)
                  pressTimer = null
                }
              }

              return (
                <button
                  key={project.id}
                  onClick={() => handleProjectChange(project.id)}
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                    projectFilter === project.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )}
                  title="Long press to copy ID"
                >
                  <div className="relative w-4 h-4 rounded bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                    {project.name.charAt(0)}
                    {hasUnreadForProject(project.id) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                  <span className="truncate">{project.name}</span>
                  {getProjectActiveCount(project.id) > 0 && (
                    <span className="ml-auto text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                      {getProjectActiveCount(project.id)}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </nav>

      <div className="p-3 border-t border-border space-y-1 shrink-0">
        <Link
          href="/templates"
          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <LayoutTemplate className="w-4 h-4 shrink-0" />
          <span>Templates</span>
        </Link>
        <Link
          href="/settings"
          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
        </Link>
      </div>
    </>
  )

  return (
    <>
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "border-r border-border bg-card flex flex-col h-full shrink-0 transition-transform duration-300 ease-in-out",
          // Desktop: always visible, static position
          "lg:relative lg:translate-x-0 lg:w-64",
          // Mobile/Tablet: fixed overlay that slides in
          "fixed inset-y-0 left-0 z-50 w-72 lg:z-auto",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {sidebarContent}
      </aside>

      <CreateTicketModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </>
  )
}

export function MobileMenuButton() {
  const { setMobileSidebarOpen } = useTicketStore()

  return (
    <button
      onClick={() => setMobileSidebarOpen(true)}
      className="p-2 hover:bg-muted rounded-md lg:hidden"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}
