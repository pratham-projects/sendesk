"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useTicketStore, useProjectStore, useTemplateStore, useAuthStore } from "@/lib/store"
import { useIsMobile, useIsTablet, useTicketViewers } from "@/lib/hooks"
import type { TicketStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send, Lock, Mail, Clock, MessageSquare, ArrowLeft, User, X, Loader2, Upload, Search } from "lucide-react"
import { AttachmentButton } from "./attachment-viewer"
import { attachmentsApi, isAllowedFileType } from "@/lib/api/attachments"
import { useToast } from "@/hooks/use-toast"

// Pending message type for optimistic UI
interface PendingMessage {
  id: string
  body: string
  isInternal: boolean
  status: 'sending' | 'failed'
  createdAt: Date
}

export function TicketDetail() {
  const {
    tickets,
    messages,
    selectedTicketId,
    updateTicketStatus,
    addMessage,
    setSelectedTicket,
    setMobileTicketListOpen,
    fetchMessages,
    fetchMoreMessages,
    isLoadingMessages,
    isLoadingMoreMessages,
    messagesHasMore,
  } = useTicketStore()
  const { projects } = useProjectStore()
  const { templates } = useTemplateStore()
  const { toast } = useToast()
  const [replyText, setReplyText] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateSearchQuery, setTemplateSearchQuery] = useState("")
  const [showUserPanel, setShowUserPanel] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isSendingWithAttachment, setIsSendingWithAttachment] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)
  const previousMessagesLengthRef = useRef(0)
  const lastLoadTimeRef = useRef(0)
  const scrollPositionRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null)
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  
  // Track viewers for the selected ticket
  const { viewers } = useTicketViewers(selectedTicketId)
  const { agent } = useAuthStore()
  
  // Filter out current user from viewers
  const otherViewers = useMemo(() => 
    viewers.filter(v => v.userId !== agent?.id),
    [viewers, agent?.id]
  )

  const ticket = useMemo(() => tickets.find((t) => t.id === selectedTicketId), [tickets, selectedTicketId])

  const project = useMemo(() => (ticket ? projects.find((p) => p.id === ticket.projectId) : null), [ticket, projects])

  const ticketMessages = useMemo(
    () =>
      ticket
        ? messages
            .filter((m) => m.ticketId === ticket.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) // Sort chronologically (oldest first)
        : [],
    [messages, ticket],
  )

  const internalNotes = useMemo(
    () => ticketMessages.filter((m) => m.isInternal),
    [ticketMessages],
  )

  // Preserve scroll position when loading older messages
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    // If we're loading more messages, save the current scroll position
    if (isLoadingMoreMessages && !scrollPositionRef.current) {
      scrollPositionRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight
      }
      console.log("[Messages] Saved scroll position:", scrollPositionRef.current)
    }

    // If we just finished loading more messages, restore scroll position
    if (!isLoadingMoreMessages && scrollPositionRef.current) {
      const savedPosition = scrollPositionRef.current
      const newScrollHeight = container.scrollHeight
      const heightDifference = newScrollHeight - savedPosition.scrollHeight
      
      // Adjust scroll position to account for new content added at the top
      const newScrollTop = savedPosition.scrollTop + heightDifference
      
      console.log("[Messages] Restoring scroll position:", {
        oldScrollTop: savedPosition.scrollTop,
        oldScrollHeight: savedPosition.scrollHeight,
        newScrollHeight,
        heightDifference,
        newScrollTop
      })
      
      container.scrollTop = newScrollTop
      scrollPositionRef.current = null
    }
  }, [isLoadingMoreMessages])

  useEffect(() => {
    // Only auto-scroll if new messages were added (not when loading older messages)
    const currentLength = ticketMessages.filter(m => !m.isInternal).length
    const previousLength = previousMessagesLengthRef.current
    
    if (currentLength > previousLength && previousLength > 0) {
      // New message arrived - only scroll if user is near the bottom
      const container = messagesContainerRef.current
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100 // Within 100px of bottom
        
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
      }
    } else if (previousLength === 0 && currentLength > 0) {
      // Initial load - always scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
      }, 100)
    }
    
    previousMessagesLengthRef.current = currentLength
  }, [ticketMessages])

  // Intersection observer for loading older messages when scrolling to top
  useEffect(() => {
    if (!loadMoreRef.current || !messagesHasMore) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && messagesHasMore && !isLoadingMoreMessages && !isLoadingMessages && ticket) {
          // Debounce API calls - only allow one call per 1.5 seconds
          const now = Date.now()
          if (now - lastLoadTimeRef.current < 1500) {
            console.log("[Messages] Debouncing auto-load request")
            return
          }
          
          console.log("[Messages] Auto-loading more messages due to scroll")
          lastLoadTimeRef.current = now
          fetchMoreMessages(ticket.id)
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '20px' // Trigger when element is 20px away from viewport
      }
    )
    
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [messagesHasMore, isLoadingMoreMessages, isLoadingMessages, ticket, fetchMoreMessages])

  const handleSendReply = useCallback(async () => {
    if (!ticket) return
    
    // If there are staged files, upload with attachments (always use multipart for single message)
    if (stagedFiles.length > 0) {
      if (!replyText.trim() && stagedFiles.length === 0) return
      setIsSendingWithAttachment(true)
      
      // Create pending message for attachment upload
      const pendingId = `pending-${Date.now()}`
      const pendingMsg: PendingMessage = {
        id: pendingId,
        body: replyText.trim() || `Sending ${stagedFiles.length} attachment${stagedFiles.length > 1 ? 's' : ''}...`,
        isInternal: false,
        status: 'sending',
        createdAt: new Date(),
      }
      setPendingMessages(prev => [...prev, pendingMsg])
      
      // Clear input immediately for better UX
      const savedText = replyText
      const savedFiles = [...stagedFiles]
      setReplyText("")
      setStagedFiles([])
      setIsInternal(false)
      
      // Scroll to bottom to show pending message
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
      
      // Show yellow toast while uploading (stays until API responds)
      const { update } = toast({
        title: "Sending message...",
        description: `Uploading ${savedFiles.length} attachment${savedFiles.length > 1 ? 's' : ''}`,
        className: "bg-amber-500 border-amber-600 text-white",
        duration: Infinity,
      })
      
      try {
        await attachmentsApi.uploadMultiple(ticket.id, savedFiles, {
          message: savedText.trim() || undefined,
          sendEmail: true,
        })
        
        // Remove pending message and refresh
        setPendingMessages(prev => prev.filter(m => m.id !== pendingId))
        await fetchMessages(ticket.id)
        
        // Update toast to green success
        update({
          title: "Message sent",
          description: "Your message with attachments was delivered successfully.",
          className: "bg-green-600 border-green-700 text-white",
          duration: 4000,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to send attachment"
        
        // Mark pending message as failed
        setPendingMessages(prev => prev.map(m => 
          m.id === pendingId ? { ...m, status: 'failed' as const } : m
        ))
        
        // Check if it's a file size limit error
        const isFileSizeError = 
          errorMessage.includes("Email size limit exceeded") || 
          errorMessage.includes("Max total:") ||
          errorMessage.toLowerCase().includes("file size too large") ||
          (errorMessage.toLowerCase().includes("exceed") && errorMessage.toLowerCase().includes("limit"))
        
        if (isFileSizeError) {
          setUploadError("Message not sent - File size limit exceeded. Please reduce file sizes or send fewer attachments.")
        }
        
        // Update toast to red error
        update({
          variant: "destructive",
          title: "Failed to send",
          description: isFileSizeError ? "File size limit exceeded" : errorMessage,
          className: "bg-red-600 border-red-700 text-white",
          duration: 6000,
        })
      } finally {
        setIsSendingWithAttachment(false)
      }
      return
    }
    
    // Regular message without attachment
    if (!replyText.trim()) return
    
    // Create pending message for optimistic UI
    const pendingId = `pending-${Date.now()}`
    const messageBody = replyText.trim()
    const messageIsInternal = isInternal
    
    const pendingMsg: PendingMessage = {
      id: pendingId,
      body: messageBody,
      isInternal: messageIsInternal,
      status: 'sending',
      createdAt: new Date(),
    }
    
    // Add to pending messages and clear input immediately
    setPendingMessages(prev => [...prev, pendingMsg])
    setReplyText("")
    setIsInternal(false)
    
    // Scroll to bottom to show pending message
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    
    try {
      await addMessage(ticket.id, messageBody, messageIsInternal)
      
      // Remove pending message on success (real message is now in store)
      setPendingMessages(prev => prev.filter(m => m.id !== pendingId))
      
      toast({
        title: messageIsInternal ? "Note added" : "Message sent",
        description: messageIsInternal ? "Internal note was added successfully." : "Your reply was delivered successfully.",
        className: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
      })
    } catch (err) {
      // Mark pending message as failed
      setPendingMessages(prev => prev.map(m => 
        m.id === pendingId ? { ...m, status: 'failed' as const } : m
      ))
      
      const errorMessage = err instanceof Error ? err.message : "Failed to send message"
      toast({
        variant: "destructive",
        title: "Failed to send",
        description: errorMessage,
      })
    }
  }, [replyText, ticket, isInternal, stagedFiles, addMessage, fetchMessages, toast])

  const insertTemplate = useCallback((body: string) => {
    setReplyText(body)
    setShowTemplates(false)
    setTemplateSearchQuery("") // Clear search when template is selected
  }, [])

  // Filter templates based on search query
  const filteredTemplates = useMemo(() => {
    if (!templateSearchQuery.trim()) return templates
    const search = templateSearchQuery.toLowerCase()
    return templates.filter((t) => 
      t.title.toLowerCase().includes(search) || 
      t.body.toLowerCase().includes(search)
    )
  }, [templates, templateSearchQuery])

  const handleBack = useCallback(() => {
    setSelectedTicket(null)
    setMobileTicketListOpen(true)
  }, [setSelectedTicket, setMobileTicketListOpen])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    setUploadError(null)

    if (!ticket) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    // Filter valid files and limit to max 5 total
    const validFiles = files.filter(isAllowedFileType)
    const invalidCount = files.length - validFiles.length
    
    if (invalidCount > 0) {
      setUploadError(`${invalidCount} file(s) skipped. Supported: JPEG, PNG, GIF, WebP, BMP, MP4, WebM, MOV, AVI`)
    }
    
    if (validFiles.length === 0) return

    // Combine with existing staged files, max 5 total
    const newFiles = [...stagedFiles, ...validFiles].slice(0, 5)
    if (stagedFiles.length + validFiles.length > 5) {
      setUploadError("Maximum 5 files allowed. Some files were not added.")
    }
    
    setStagedFiles(newFiles)
  }, [ticket, stagedFiles])

  const removeStagedFile = useCallback((index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  if (!ticket) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground bg-background">
        <div className="text-center p-4">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm sm:text-base">Select a ticket to view details</p>
        </div>
      </div>
    )
  }

  const userPanel = (
    <div
      className={cn(
        "border-l border-border bg-muted/30 shrink-0 flex flex-col",
        isMobile ? "fixed inset-y-0 right-0 w-72 z-50 bg-card shadow-xl" : "w-64",
        isMobile && !showUserPanel && "hidden",
      )}
    >
      {isMobile && (
        <button onClick={() => setShowUserPanel(false)} className="absolute top-4 right-4 p-1 hover:bg-muted rounded">
          <X className="w-5 h-5" />
        </button>
      )}
      
      {/* Customer Info Section */}
      <div className="p-4 shrink-0">
        <h3 className="text-sm font-medium mb-4">Customer Info</h3>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-medium shrink-0">
              {ticket.clientName
                ?.split(" ")
                .map((n) => n[0])
                .join("") ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{ticket.clientName ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground">Customer</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4 shrink-0" />
              <span className="truncate">{ticket.clientEmail ?? "No email"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Created {formatDate(ticket.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Internal Notes Section */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-border">
        <div className="p-4 pb-2 shrink-0">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            Internal Notes
            {(internalNotes.length > 0 || pendingMessages.filter(m => m.isInternal).length > 0) && (
              <span className="text-xs text-muted-foreground">
                ({internalNotes.length + pendingMessages.filter(m => m.isInternal).length})
              </span>
            )}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {internalNotes.length === 0 && pendingMessages.filter(m => m.isInternal).length === 0 ? (
            <p className="text-xs text-muted-foreground">No internal notes yet</p>
          ) : (
            <>
              {internalNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm"
                >
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{note.senderName || "Agent"}</span>
                    <span>·</span>
                    <span>{formatTime(note.createdAt)}</span>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{note.body}</p>
                </div>
              ))}
              {/* Pending internal notes */}
              {pendingMessages.filter(m => m.isInternal).map((pending) => (
                <div
                  key={pending.id}
                  className={cn(
                    "p-2.5 rounded-md text-sm",
                    pending.status === 'sending'
                      ? "bg-amber-500/30 border border-amber-500/40"
                      : "bg-destructive/20 border border-destructive/30"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{agent?.name || "You"}</span>
                    <span>·</span>
                    {pending.status === 'sending' ? (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span className="text-destructive">Failed</span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{pending.body}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div 
      className={cn("flex-1 flex h-full min-w-0 relative", isMobile && "absolute inset-0 z-40 bg-background")}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto mb-2 text-primary" />
            <p className="text-lg font-medium text-primary">Drop file to upload</p>
            <p className="text-sm text-muted-foreground mt-1">Images and videos supported</p>
          </div>
        </div>
      )}

      {/* Mobile overlay for user panel */}
      {isMobile && showUserPanel && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowUserPanel(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 sm:p-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {isMobile && (
                <button onClick={handleBack} className="p-1.5 hover:bg-muted rounded-md shrink-0 mt-0.5">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                {ticket.ticketNumber && (
                  <div className="text-sm font-medium text-foreground mb-1">
                    Ticket #{ticket.ticketNumber}
                  </div>
                )}
                <h2 className="text-base sm:text-lg font-medium line-clamp-2">{ticket.subject}</h2>
                <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
                  <span>ID: {ticket.id}</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{project?.name ?? "Unknown"}</span>
                  {otherViewers.length > 0 && (
                    <>
                      <span className="hidden sm:inline">·</span>
                      <span 
                        className="flex items-center gap-1 text-primary cursor-default"
                        title={otherViewers.map(v => v.name).join(', ')}
                      >
                        <span className="flex -space-x-1">
                          {otherViewers.slice(0, 3).map((viewer) => (
                            <span
                              key={viewer.userId}
                              className="w-5 h-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[10px] font-medium"
                            >
                              {viewer.name.charAt(0).toUpperCase()}
                            </span>
                          ))}
                          {otherViewers.length > 3 && (
                            <span className="w-5 h-5 rounded-full bg-primary/30 border border-background flex items-center justify-center text-[10px] font-medium">
                              +{otherViewers.length - 3}
                            </span>
                          )}
                        </span>
                        <span className="text-xs">
                          {otherViewers.length === 1 
                            ? `${otherViewers[0].name} viewing` 
                            : `${otherViewers.length} others viewing`}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(isMobile || isTablet) && (
                <button onClick={() => setShowUserPanel(true)} className="p-2 hover:bg-muted rounded-md lg:hidden">
                  <User className="w-5 h-5" />
                </button>
              )}
              <Select
                value={ticket.status}
                onValueChange={(value) => updateTicketStatus(ticket.id, value as TicketStatus)}
              >
                <SelectTrigger className="w-28 sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 overscroll-contain"
        >
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading messages...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Auto-load trigger for older messages - always show when there are more messages */}
              {messagesHasMore && (
                <div ref={loadMoreRef} className="h-px w-full" />
              )}
              
              {/* Loading indicator for older messages */}
              {isLoadingMoreMessages && (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Loading older messages...</span>
                  </div>
                </div>
              )}
              
              {/* No more messages indicator */}
              {!messagesHasMore && ticketMessages.filter(m => !m.isInternal).length > 0 && (
                <div className="text-center py-2">
                  <div className="text-xs text-muted-foreground">
                    All messages loaded
                  </div>
                </div>
              )}
              
              {ticketMessages
            .filter((m) => !m.isInternal)
            .map((message) => {
              const rawAttachments = message.attachmentIds || []
              // Handle both string[] and {id: string, url: string}[] formats
              const attachments = rawAttachments.map((item: string | { id: string; url?: string }) => 
                typeof item === 'string' ? { id: item } : item
              )
              // Client messages on right, Agent/Support messages on left
              const isClientMessage = message.senderType === "client"
              return (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[90%] sm:max-w-[80%] p-3 sm:p-4 rounded-lg",
                    isClientMessage ? "ml-auto bg-secondary" : "bg-muted",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground flex-wrap">
                    {isClientMessage ? (
                      <span className="font-medium text-foreground">
                        {ticket.clientName || "Customer"}
                      </span>
                    ) : (
                      <span className="font-medium text-foreground">{message.senderName || "Support"}</span>
                    )}
                    <span>·</span>
                    <span>{formatTime(message.createdAt)}</span>
                  </div>
                  {message.body && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.body.replace(/https:\/\/[^\s]*\/sendesk-mails\/[^\s]*/g, '').trim()}
                    </p>
                  )}
                  {attachments.length > 0 && (
                    <div className={cn("flex flex-wrap gap-2", message.body && "mt-3")}>
                      {attachments.map((attachment: { id: string; url?: string }) => (
                        <AttachmentButton key={attachment.id} attachment={attachment} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
              
              {/* Pending messages (optimistic UI) - Support messages go on left */}
              {pendingMessages.filter(m => !m.isInternal).map((pending) => (
                <div
                  key={pending.id}
                  className={cn(
                    "max-w-[90%] sm:max-w-[80%] p-3 sm:p-4 rounded-lg",
                    pending.status === 'sending' 
                      ? "bg-amber-500/20 border border-amber-500/30" 
                      : "bg-destructive/20 border border-destructive/30",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground">{agent?.name || "Support"}</span>
                    <span>·</span>
                    {pending.status === 'sending' ? (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      <span className="text-destructive">Failed to send</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {pending.body}
                  </p>
                  {pending.status === 'failed' && (
                    <button
                      onClick={() => setPendingMessages(prev => prev.filter(m => m.id !== pending.id))}
                      className="mt-2 text-xs text-destructive hover:underline"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="p-3 sm:p-4 border-t border-border shrink-0">
          {uploadError && (
            <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md flex items-center justify-between">
              <span className="text-sm text-destructive">{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="p-1 hover:bg-destructive/20 rounded">
                <X className="w-4 h-4 text-destructive" />
              </button>
            </div>
          )}
          <div className="flex gap-2 mb-3 flex-wrap">
            <Button
              variant={isInternal ? "outline" : "secondary"}
              size="sm"
              onClick={() => setIsInternal(false)}
              className="text-xs sm:text-sm"
            >
              Reply
            </Button>
            <Button
              variant={isInternal ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsInternal(true)}
              className={cn("text-xs sm:text-sm", isInternal && "text-amber-500")}
            >
              <Lock className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Internal</span> Note
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowTemplates(!showTemplates)
                if (!showTemplates) {
                  setTemplateSearchQuery("") // Clear search when closing
                }
              }}
              className="ml-auto text-xs sm:text-sm"
            >
              Templates
            </Button>
          </div>

          {showTemplates && (
            <div className="mb-3 p-3 bg-muted rounded-lg max-h-80 overflow-hidden flex flex-col">
              {/* Search bar */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={templateSearchQuery}
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                  className={`pl-9 bg-background border-border ${templateSearchQuery ? 'pr-8' : ''}`}
                />
                {templateSearchQuery && (
                  <button
                    onClick={() => setTemplateSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              {/* Results count */}
              {templateSearchQuery && (
                <p className="text-xs text-muted-foreground mb-2">
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""} found
                </p>
              )}
              
              {/* Templates list */}
              <div className="flex-1 overflow-y-auto space-y-1">
                {filteredTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-3 py-2 text-center">
                    {templateSearchQuery ? "No templates match your search" : "No templates available"}
                  </p>
                ) : (
                  filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => insertTemplate(template.body)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-secondary transition-colors"
                    >
                      <div className="text-sm font-medium">{template.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {template.body}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Staged attachments indicator */}
          {stagedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {stagedFiles.map((file, index) => (
                <div 
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-primary/10 border border-primary/20 rounded-md max-w-[140px]"
                >
                  <Upload className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs text-primary truncate" title={file.name}>
                    {file.name}
                  </span>
                  <button 
                    onClick={() => removeStagedFile(index)} 
                    className="p-0.5 hover:bg-primary/20 rounded shrink-0"
                  >
                    <X className="w-3 h-3 text-primary" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              placeholder={isInternal ? "Add an internal note..." : stagedFiles.length > 0 ? "Add a message with your attachments..." : "Type your reply..."}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-[80px] sm:min-h-[100px] max-h-40 bg-muted border-0 resize-none focus-visible:ring-1 overflow-y-auto"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSendReply()
                }
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {stagedFiles.length > 0 
                ? `${stagedFiles.length}/5 files · Drop more to add` 
                : "Press Cmd+Enter to send"}
            </span>
            <Button 
              onClick={handleSendReply} 
              disabled={(!replyText.trim() && stagedFiles.length === 0) || isSendingWithAttachment} 
              className="ml-auto"
            >
              {isSendingWithAttachment ? (
                <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                {isSendingWithAttachment 
                  ? "Sending..." 
                  : isInternal 
                    ? "Add Note" 
                    : stagedFiles.length > 0 
                      ? `Send with ${stagedFiles.length} Attachment${stagedFiles.length > 1 ? 's' : ''}` 
                      : "Send Reply"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {!isMobile && !isTablet && userPanel}
      {(isMobile || isTablet) && showUserPanel && userPanel}
    </div>
  )
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
