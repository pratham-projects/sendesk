"use client"

import { cn } from "@/lib/utils"

interface CupertinoSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function CupertinoSpinner({ size = "md", className }: CupertinoSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  }

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-0 h-[30%] w-[8%] -translate-x-1/2 rounded-full bg-current"
          style={{
            transform: `rotate(${i * 45}deg) translateY(0)`,
            transformOrigin: "center center",
            opacity: 0.125 + i * 0.125,
            animation: `cupertino-spin 1s linear infinite`,
            animationDelay: `${-i * 0.125}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes cupertino-spin {
          0% { opacity: 1; }
          100% { opacity: 0.125; }
        }
      `}</style>
    </div>
  )
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin", className)} />
  )
}

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <CupertinoSpinner size="lg" className="text-muted-foreground" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  )
}

export function TicketSkeleton() {
  return (
    <div className="w-full p-3 sm:p-4 border-b border-border animate-pulse">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-5 bg-muted rounded-full w-16" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 bg-muted rounded w-20" />
        <div className="h-3 bg-muted rounded w-16 hidden sm:block" />
      </div>
      <div className="h-3 bg-muted rounded w-12 mt-1" />
    </div>
  )
}

export function MessageSkeleton({ isAgent = false }: { isAgent?: boolean }) {
  return (
    <div
      className={cn(
        "max-w-[90%] sm:max-w-[80%] p-3 sm:p-4 rounded-lg animate-pulse",
        isAgent ? "ml-auto bg-secondary" : "bg-muted",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-3 bg-muted-foreground/20 rounded w-16" />
        <div className="h-3 bg-muted-foreground/20 rounded w-12" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted-foreground/20 rounded w-full" />
        <div className="h-3 bg-muted-foreground/20 rounded w-4/5" />
      </div>
    </div>
  )
}
