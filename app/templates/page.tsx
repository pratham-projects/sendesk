"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/store"
import { AuthPage } from "@/components/auth-page"
import { TemplatesPage } from "@/components/templates-page"

export default function Templates() {
  const { isAuthenticated, isInitializing, tryAutoLogin } = useAuthStore()
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
    <div className="min-h-screen bg-background">
      <TemplatesPage />
    </div>
  )
}
