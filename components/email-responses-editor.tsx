"use client"

import { useState, useEffect, useCallback } from "react"
import { emailResponsesApi } from "@/lib/api"
import type { EmailResponse, EmailResponseStatus } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Mail, Plus, Check } from "lucide-react"

interface EmailResponsesEditorProps {
  projectId: string
  projectName: string
}

interface ResponseState {
  id?: string
  body: string
  isEnabled: boolean
  isDirty: boolean
  isSaving: boolean
}

export function EmailResponsesEditor({ projectId, projectName }: EmailResponsesEditorProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [createdResponse, setCreatedResponse] = useState<ResponseState>({
    body: "",
    isEnabled: true,
    isDirty: false,
    isSaving: false,
  })
  const [resolvedResponse, setResolvedResponse] = useState<ResponseState>({
    body: "",
    isEnabled: true,
    isDirty: false,
    isSaving: false,
  })

  const fetchResponses = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await emailResponsesApi.listByProject(projectId)
      const responses = response.data

      const created = responses.find((r) => r.status === "created")
      const resolved = responses.find((r) => r.status === "resolved")

      if (created) {
        setCreatedResponse({
          id: created.id,
          body: created.body,
          isEnabled: created.isEnabled,
          isDirty: false,
          isSaving: false,
        })
      }

      if (resolved) {
        setResolvedResponse({
          id: resolved.id,
          body: resolved.body,
          isEnabled: resolved.isEnabled,
          isDirty: false,
          isSaving: false,
        })
      }
    } catch {
      // No responses yet, that's fine
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchResponses()
  }, [fetchResponses])

  const handleSave = async (status: EmailResponseStatus) => {
    const state = status === "created" ? createdResponse : resolvedResponse
    const setState = status === "created" ? setCreatedResponse : setResolvedResponse

    setState((prev) => ({ ...prev, isSaving: true }))

    try {
      if (state.id) {
        // Update existing
        await emailResponsesApi.update(state.id, {
          body: state.body,
          isEnabled: state.isEnabled,
        })
      } else {
        // Create new
        const response = await emailResponsesApi.create({
          projectId,
          status,
          body: state.body,
          isEnabled: state.isEnabled,
        })
        setState((prev) => ({ ...prev, id: response.data.id }))
      }

      setState((prev) => ({ ...prev, isDirty: false, isSaving: false }))
      toast({
        title: "Saved",
        description: `${status === "created" ? "Ticket created" : "Ticket resolved"} response saved.`,
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save email response.",
      })
      setState((prev) => ({ ...prev, isSaving: false }))
    }
  }

  const handleCreate = async (status: EmailResponseStatus) => {
    const setState = status === "created" ? setCreatedResponse : setResolvedResponse
    const defaultBody =
      status === "created"
        ? `Your ticket has been received by ${projectName} Team!\n\nThanks and Regards,\n${projectName} Team`
        : `Your ticket has been resolved by ${projectName} Team!\n\nThanks and Regards,\n${projectName} Team`

    setState((prev) => ({ ...prev, isSaving: true }))

    try {
      const response = await emailResponsesApi.create({
        projectId,
        status,
        body: defaultBody,
        isEnabled: true,
      })

      setState({
        id: response.data.id,
        body: response.data.body,
        isEnabled: response.data.isEnabled,
        isDirty: false,
        isSaving: false,
      })

      toast({
        title: "Created",
        description: `${status === "created" ? "Ticket created" : "Ticket resolved"} response created.`,
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create email response.",
      })
      setState((prev) => ({ ...prev, isSaving: false }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const renderResponseEditor = (
    status: EmailResponseStatus,
    state: ResponseState,
    setState: React.Dispatch<React.SetStateAction<ResponseState>>
  ) => {
    const label = status === "created" ? "When Ticket Created" : "When Ticket Resolved"

    if (!state.id) {
      return (
        <div className="p-3 border border-dashed border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" />
              {label}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreate(status)}
              disabled={state.isSaving}
            >
              {state.isSaving ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Plus className="w-3 h-3 mr-1" />
              )}
              Add Response
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4" />
            {label}
          </Label>
          <div className="flex items-center gap-2">
            <Label htmlFor={`${status}-enabled`} className="text-xs text-muted-foreground">
              Enabled
            </Label>
            <Switch
              id={`${status}-enabled`}
              checked={state.isEnabled}
              onCheckedChange={(checked) =>
                setState((prev) => ({ ...prev, isEnabled: checked, isDirty: true }))
              }
            />
          </div>
        </div>
        <Textarea
          value={state.body}
          onChange={(e) => setState((prev) => ({ ...prev, body: e.target.value, isDirty: true }))}
          placeholder="Email body text..."
          className="min-h-[100px] text-sm"
        />
        {state.isDirty && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => handleSave(status)} disabled={state.isSaving}>
              {state.isSaving ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      <h4 className="text-sm font-medium text-muted-foreground">Auto Email Responses</h4>
      {renderResponseEditor("created", createdResponse, setCreatedResponse)}
      {renderResponseEditor("resolved", resolvedResponse, setResolvedResponse)}
    </div>
  )
}
