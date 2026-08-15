"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuthStore } from "@/lib/store"
import { DEMO_AGENTS } from "@/mock/seed"
import { writeSession } from "@/mock/write-session"
import { resetDemo } from "@/mock/reset"
import { RotateCcw, ChevronUp, ChevronDown, ExternalLink, Sparkles } from "lucide-react"

export function DemoBadge() {
  const { agent, isAuthenticated } = useAuthStore()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const isWidget = pathname === "/widget"

  const switchAgent = (agentId: string) => {
    const target = DEMO_AGENTS.find((a) => a.id === agentId)
    if (!target) return
    const { accessToken, tokenExpiresAt } = writeSession(target)
    useAuthStore.setState({
      agent: {
        id: target.id,
        email: target.email,
        name: target.name,
        role: target.role,
        createdAt: new Date(target.createdAt),
      },
      token: accessToken,
      tokenExpiresAt,
      isAuthenticated: true,
    })
    // Reload so every store's already-fetched data (assignments, member
    // lists, etc.) reflects the newly switched identity from a clean slate.
    window.location.reload()
  }

  const handleReset = () => {
    setIsResetting(true)
    resetDemo()
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
      <div className="pointer-events-auto mb-2 flex max-w-[calc(100vw-1rem)] flex-col items-stretch gap-1 rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="whitespace-nowrap">Demo — sample data, no backend</span>
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>

        {isOpen && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 sm:border-t-0 sm:border-l">
            {isAuthenticated && agent && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Viewing as</span>
                <select
                  value={agent.id}
                  onChange={(e) => switchAgent(e.target.value)}
                  className="text-xs bg-muted border border-border rounded px-1.5 py-1 text-foreground"
                >
                  {DEMO_AGENTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isWidget && (
              <Link
                href="/widget"
                target="_blank"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open customer widget
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            {isWidget && (
              <Link href="/" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Back to inbox
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}

            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              title="Wipe all demo edits and reseed"
            >
              <RotateCcw className="w-3 h-3" />
              {isResetting ? "Resetting…" : "Reset demo data"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
