"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle, Send } from "lucide-react"
import { ticketsApi } from "@/lib/api"

interface WidgetFormProps {
  // Matches mock/seed.ts's first demo project — upstream shipped this widget
  // form pointed at a placeholder "proj_1" that never actually submitted
  // anywhere (see the note in UPSTREAM.md). Wired to ticketsApi.create here
  // so a real ticket lands in the inbox, same as production would.
  projectId?: string
}

export function WidgetForm({ projectId = "proj_nimbus" }: WidgetFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await ticketsApi.create({
        projectId,
        clientEmail: email,
        clientName: name,
        subject,
        description: message,
        priority: "normal",
        sendNotification: false,
      })
      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-12 h-12 mx-auto text-status-resolved mb-4" />
        <h3 className="text-lg font-medium mb-2">Message Sent</h3>
        <p className="text-muted-foreground text-sm">We will get back to you as soon as possible.</p>
        <Button
          variant="outline"
          className="mt-4 bg-transparent"
          onClick={() => {
            setIsSubmitted(false)
            setName("")
            setEmail("")
            setSubject("")
            setMessage("")
          }}
        >
          Send Another Message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          placeholder="How can we help?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          placeholder="Describe your issue or question..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          className="mt-1.5 min-h-[120px]"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          "Sending..."
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Send Message
          </>
        )}
      </Button>
    </form>
  )
}
