"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/lib/store"
import type { AgentRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Inbox, AlertCircle, Shield, User, Loader2 } from "lucide-react"

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState("")
  // Prefilled with demo credentials (see mock/seed.ts DEMO_AGENTS) — the demo
  // auto-authenticates on load already, so this screen is mainly reachable
  // after a manual "Logout", and shouldn't be a dead end when it is.
  const [email, setEmail] = useState("priya@sendesk-demo.dev")
  const [password, setPassword] = useState("demodemo123")
  const [role, setRole] = useState<AgentRole>("developer")

  const { login, signup, isLoading, error, clearError } = useAuthStore()

  // Clear error when switching between login/signup
  useEffect(() => {
    clearError()
  }, [isLogin, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLogin) {
      await login(email, password)
    } else {
      if (!name.trim()) {
        return
      }
      await signup(name, email, password, role)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <Inbox className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">SendDesk</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Role</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                      role === "admin"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-medium">Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("developer")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                      role === "developer"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">Developer</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {role === "admin"
                    ? "Admins can manage projects and all settings"
                    : "Developers can reply to tickets and change statuses"}
                </p>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isLogin ? "Signing in..." : "Creating account..."}
              </>
            ) : (
              isLogin ? "Sign In" : "Create Account"
            )}
          </Button>
        </form>

        {isLogin && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Demo credentials are prefilled above — just hit Sign In.
          </p>
        )}
      </div>
    </div>
  )
}
