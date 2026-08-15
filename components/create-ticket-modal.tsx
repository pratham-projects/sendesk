"use client"

import { useState, useRef, useCallback } from "react"
import { X, Upload, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTicketStore, useProjectStore, useUnreadStore } from "@/lib/store"
import { ticketsApi } from "@/lib/api"
import { isAllowedFileType } from "@/lib/api/attachments"
import { useToast } from "@/hooks/use-toast"

interface CreateTicketModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateTicketModal({ isOpen, onClose }: CreateTicketModalProps) {
  const [clientEmail, setClientEmail] = useState("")
  const [clientName, setClientName] = useState("")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState("")
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const { projects } = useProjectStore()
  const { fetchTickets, selectedTicketId, fetchMessages } = useTicketStore()
  const { fetchUnread } = useUnreadStore()
  const { toast } = useToast()


  const handleFileSelect = useCallback((files: FileList | File[]) => {
    setFileError(null)
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter(isAllowedFileType)
    const invalidCount = fileArray.length - validFiles.length
    
    if (invalidCount > 0) {
      setFileError(`${invalidCount} file(s) skipped. Supported: JPEG, PNG, GIF, WebP, BMP, MP4, WebM, MOV, AVI`)
    }
    
    const newFiles = [...stagedFiles, ...validFiles].slice(0, 5)
    if (stagedFiles.length + validFiles.length > 5) {
      setFileError("Maximum 5 files allowed. Some files were not added.")
    }
    
    setStagedFiles(newFiles)
  }, [stagedFiles])

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
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }, [handleFileSelect])

  const removeStagedFile = useCallback((index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleCreate = async () => {
    if (!clientEmail || !subject || !projectId || isCreating) return

    setIsCreating(true)
    setFileError(null)

    // Save form data
    const ticketData = {
      projectId,
      clientEmail,
      clientName: clientName.trim() || undefined,
      subject,
      description: description || undefined,
      priority: "normal" as const,
      sendNotification: true,
    }
    const filesToUpload = stagedFiles.length > 0 ? [...stagedFiles] : undefined
    const ticketSubject = subject

    // Show creating toast with progress bar (stays until API responds)
    const { update } = toast({
      title: "Creating ticket...",
      description: (
        <div className="space-y-2">
          <p className="text-sm text-white/90">{ticketSubject.length > 40 ? ticketSubject.substring(0, 40) + "..." : ticketSubject}</p>
          <div className="h-1 bg-amber-300 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full animate-progress-indeterminate" />
          </div>
        </div>
      ),
      className: "bg-amber-500 border-amber-600 text-white",
      duration: Infinity, // Never auto-dismiss - we'll update it when API responds
    })

    try {
      await ticketsApi.create(ticketData, filesToUpload)

      // Success - reset form and close modal
      setClientEmail("")
      setClientName("")
      setSubject("")
      setDescription("")
      setProjectId("")
      setStagedFiles([])
      setFileError(null)
      setIsCreating(false)
      onClose()

      // Update the toast to show success (solid green)
      update({
        title: "Ticket created",
        description: "The ticket has been created and email sent to customer.",
        className: "bg-green-600 border-green-700 text-white",
        duration: 4000, // Auto-dismiss after 4 seconds
      })

      // Run background calls to refresh data
      fetchUnread().catch(() => {})
      fetchTickets().catch(() => {})
      if (selectedTicketId) {
        fetchMessages(selectedTicketId).catch(() => {})
      }
    } catch (err) {
      setIsCreating(false)
      const errorMessage = err instanceof Error ? err.message : String(err)
      
      // Check if it's a file size limit error
      const isFileSizeError = 
        errorMessage.includes("Email size limit exceeded") || 
        errorMessage.includes("Max total:") ||
        errorMessage.toLowerCase().includes("file size too large") ||
        (errorMessage.toLowerCase().includes("exceed") && errorMessage.toLowerCase().includes("limit"))
      
      if (isFileSizeError) {
        // Show inline error in the modal (don't close modal)
        setFileError("File size limit exceeded. Please reduce file sizes or send fewer attachments.")
      }
      
      // Update the toast to show error (solid red)
      update({
        variant: "destructive",
        title: "Failed to create ticket",
        description: errorMessage || "An error occurred while creating the ticket.",
        className: "bg-red-600 border-red-700 text-white",
        duration: 8000, // Auto-dismiss after 8 seconds for errors
      })
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Create Ticket</h2>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={isCreating}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Customer Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Customer Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject * <span className="text-xs text-muted-foreground font-normal">(min 5 characters)</span></Label>
              <Input
                id="subject"
                type="text"
                placeholder="Issue with login"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isCreating}
                className={subject.length > 0 && subject.length < 5 ? "border-destructive" : ""}
              />
              {subject.length > 0 && subject.length < 5 && (
                <p className="text-xs text-destructive">Subject must be at least 5 characters</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                disabled={isCreating}
                className="max-h-32 overflow-y-auto resize-none"
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div
                className={`relative border-2 border-dashed rounded-md p-3 transition-colors ${
                  isDragging 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-muted-foreground"
                } ${isCreating ? "opacity-50 pointer-events-none" : ""}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                />
                
                {stagedFiles.length === 0 ? (
                  <div 
                    className="flex flex-col items-center gap-2 py-2 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                      Drop files here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Max 5 files · Images and videos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {stagedFiles.map((file, index) => (
                        <div 
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-1.5 px-2 py-1.5 bg-primary/10 border border-primary/20 rounded-md max-w-[140px]"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
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
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-primary hover:underline"
                      disabled={stagedFiles.length >= 5}
                    >
                      + Add more files ({stagedFiles.length}/5)
                    </button>
                  </div>
                )}
              </div>
              {fileError && (
                <p className="text-xs text-destructive">{fileError}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <Button variant="outline" onClick={onClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!clientEmail || !subject || subject.length < 5 || !projectId || !description.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Ticket"}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
