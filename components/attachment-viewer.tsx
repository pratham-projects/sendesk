"use client"

import { useState, useEffect } from "react"
import { X, Download, File, Loader2, AlertTriangle, ShieldAlert, Image, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { attachmentsApi } from "@/lib/api/attachments"

// Attachment can be either a string ID or an object with id, url, and filename
export interface AttachmentData {
  id: string
  url?: string
  filename?: string
}

// Safe file extensions that can be previewed
const SAFE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4']

// Potentially unsafe file extensions
const UNSAFE_EXTENSIONS = ['.txt', '.doc', '.docx', '.xls', '.xlsx', '.pdf', '.zip', '.rar', '.exe', '.bat', '.sh']

function getExtensionFromUrl(url: string): string {
  // Extract filename from URL like "s3://bucket/attachments/xxx-filename.ext"
  const lastSlash = url.lastIndexOf('/')
  const filename = lastSlash !== -1 ? url.substring(lastSlash + 1) : url
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.substring(lastDot).toLowerCase()
}

function getFilenameFromUrl(url: string): string {
  const lastSlash = url.lastIndexOf('/')
  const fullName = lastSlash !== -1 ? url.substring(lastSlash + 1) : url
  // Remove the prefix (e.g., "mjvvnghkxrw9m0k705-")
  const dashIndex = fullName.indexOf('-')
  return dashIndex !== -1 ? fullName.substring(dashIndex + 1) : fullName
}

function getFileCategory(url: string): 'safe' | 'unsafe' | 'unknown' {
  const ext = getExtensionFromUrl(url)
  if (SAFE_EXTENSIONS.includes(ext)) return 'safe'
  if (UNSAFE_EXTENSIONS.includes(ext)) return 'unsafe'
  return 'unknown'
}

interface AttachmentViewerProps {
  attachment: AttachmentData
  onClose: () => void
}

export function AttachmentViewer({ attachment, onClose }: AttachmentViewerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [contentUrl, setContentUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<"image" | "video" | "unknown">("unknown")
  const [fileBlob, setFileBlob] = useState<Blob | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const fileCategory = attachment.url ? getFileCategory(attachment.url) : 'unknown'
  const isUnsafe = fileCategory === 'unsafe'
  const filename = attachment.url ? getFilenameFromUrl(attachment.url) : `file-${attachment.id}`
  const ext = attachment.url ? getExtensionFromUrl(attachment.url) : ''

  useEffect(() => {
    const loadAttachment = async () => {
      try {
        setIsLoading(true)
        setError(false)
        
        // Always fetch via API using attachment ID
        const blob = await attachmentsApi.getFile(attachment.id)
        const url = URL.createObjectURL(blob)
        setContentUrl(url)
        setFileBlob(blob)
        
        // Determine file type from mime type
        const mimeType = blob.type.toLowerCase()
        if (mimeType.startsWith("image/")) {
          setFileType("image")
        } else if (mimeType.startsWith("video/")) {
          setFileType("video")
        } else {
          setFileType("unknown")
        }
        setIsLoading(false)
      } catch {
        setError(true)
        setIsLoading(false)
      }
    }

    loadAttachment()

    return () => {
      if (contentUrl) {
        URL.revokeObjectURL(contentUrl)
      }
    }
  }, [attachment.id])

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      const blob = fileBlob || await attachmentsApi.getFile(attachment.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download failed:", err)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={cn(
          "relative max-w-4xl max-h-[90vh] w-full flex flex-col rounded-lg overflow-hidden",
          isUnsafe && "ring-2 ring-red-500"
        )}>
          {/* Security Warning Banner for unsafe files */}
          {isUnsafe && (
            <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">Security Alert: This file type may contain malicious content.</span>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/60">
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {isDownloading ? "Downloading..." : "Download"}
              </Button>
              <span className="text-sm text-white/70 truncate max-w-[200px]" title={filename}>{filename}</span>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className={cn(
            "flex-1 flex items-center justify-center overflow-hidden min-h-[300px]",
            isUnsafe ? "bg-red-950/50" : "bg-black/50"
          )}>
            {isLoading ? (
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : error ? (
              <div className="text-center text-white p-8">
                <File className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Unable to load this file</p>
                <Button variant="secondary" onClick={handleDownload} disabled={isDownloading}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Instead
                </Button>
              </div>
            ) : contentUrl && fileType === "image" && !isUnsafe ? (
              <img src={contentUrl} alt="Attachment" className="max-w-full max-h-[80vh] object-contain" />
            ) : contentUrl && fileType === "video" && !isUnsafe ? (
              <video src={contentUrl} controls className="max-w-full max-h-[80vh]" />
            ) : isUnsafe ? (
              <div className="text-center text-white p-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-600/20 flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <p className="text-lg font-medium mb-2 text-red-400">Potentially Unsafe File</p>
                <p className="text-sm text-white/70 mb-4">This file type ({ext}) may contain malicious content.</p>
                <Button variant="outline" onClick={handleDownload} disabled={isDownloading} className="border-red-500/50 text-red-400 hover:bg-red-500/20">
                  <Download className="w-4 h-4 mr-2" />
                  Download at Your Own Risk
                </Button>
              </div>
            ) : (
              <div className="text-center text-white p-8">
                <File className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Preview not available</p>
                <Button variant="secondary" onClick={handleDownload} disabled={isDownloading}>
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

interface AttachmentButtonProps {
  attachment: string | AttachmentData
  className?: string
}

export function AttachmentButton({ attachment, className }: AttachmentButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const attachmentData: AttachmentData = typeof attachment === 'string' ? { id: attachment } : attachment
  
  const fileCategory = attachmentData.url ? getFileCategory(attachmentData.url) : 'unknown'
  const isUnsafe = fileCategory === 'unsafe'
  const isSafe = fileCategory === 'safe'
  const filename = attachmentData.url ? getFilenameFromUrl(attachmentData.url) : 'Attachment'
  const ext = attachmentData.url ? getExtensionFromUrl(attachmentData.url) : ''

  const getIcon = () => {
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return <Image className="w-4 h-4" />
    if (['.mp4'].includes(ext)) return <Video className="w-4 h-4" />
    if (isUnsafe) return <AlertTriangle className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
          isUnsafe 
            ? "bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/50 text-red-600 dark:text-red-400"
            : isSafe
              ? "bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-700 dark:text-green-400"
              : "bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary",
          className
        )}
      >
        {getIcon()}
        <span className="truncate max-w-[120px]">{filename}</span>
        {isUnsafe && (
          <span className="text-[10px] font-semibold uppercase bg-red-500 text-white px-1.5 py-0.5 rounded">Alert</span>
        )}
      </button>

      {isOpen && <AttachmentViewer attachment={attachmentData} onClose={() => setIsOpen(false)} />}
    </>
  )
}
