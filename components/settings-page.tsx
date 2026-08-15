"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useProjectStore, useAuthStore, useTeamStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import type { Project, AgentRole } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"

// SMTP Auth type for project creation/update
type SmtpAuth = {
  type: 'email' | 'username_email'
  email: string
  username?: string
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Copy, Trash2, Globe, Key, Pencil, Check, X, LogOut, Shield, Lock, Users, Loader2, ChevronDown, ChevronUp, Search } from "lucide-react"
import { EmailResponsesEditor } from "./email-responses-editor"
import { projectsApi } from "@/lib/api"
import { useDebounce } from "@/lib/hooks"

export function SettingsPage() {
  const { projects, isLoading: projectsLoading, fetchProjects, addProject, updateProject, deleteProject, error: projectError } = useProjectStore()
  const { agent, logout } = useAuthStore()
  const { members, isLoading: membersLoading, membersTotal, fetchMembers, addMember, deleteMember } = useTeamStore()

  // Pagination state for members
  const [membersPage, setMembersPage] = useState(1)
  const MEMBERS_PER_PAGE = 5

  // Search state for members
  const [memberSearchQuery, setMemberSearchQuery] = useState("")
  const debouncedMemberSearch = useDebounce(memberSearchQuery, 300)

  // Reset page when search changes
  useEffect(() => {
    setMembersPage(1)
  }, [debouncedMemberSearch])
  const { toast } = useToast()

  const isAdmin = agent?.role === "admin"

  // Fetch projects and members on mount (only admins fetch all members)
  useEffect(() => {
    fetchProjects()
    if (isAdmin) {
      fetchMembers()
    }
  }, [fetchProjects, fetchMembers, isAdmin])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDomain, setNewDomain] = useState("")
  const [newSmtpEmail, setNewSmtpEmail] = useState("")
  const [newSmtpUsername, setNewSmtpUsername] = useState("")
  const [newSmtpAuthType, setNewSmtpAuthType] = useState<"email" | "username_email">("email")
  const [newSmtpPassword, setNewSmtpPassword] = useState("")
  const [newSmtpHost, setNewSmtpHost] = useState("smtp.gmail.com")
  const [newSmtpPort, setNewSmtpPort] = useState("587")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [emailValidationError, setEmailValidationError] = useState("")

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDomain, setEditDomain] = useState("")
  const [editSmtpEmail, setEditSmtpEmail] = useState("")
  const [editSmtpUsername, setEditSmtpUsername] = useState("")
  const [editSmtpAuthType, setEditSmtpAuthType] = useState<"email" | "username_email">("email")
  const [editSmtpPassword, setEditSmtpPassword] = useState("")
  const [editSmtpHost, setEditSmtpHost] = useState("smtp.gmail.com")
  const [editSmtpPort, setEditSmtpPort] = useState("587")
  const [showEditAdvanced, setShowEditAdvanced] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editEmailValidationError, setEditEmailValidationError] = useState("")

  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false)
  const [newMemberName, setNewMemberName] = useState("")
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [newMemberPassword, setNewMemberPassword] = useState("")
  const [newMemberRole, setNewMemberRole] = useState<AgentRole>("agent")
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedProjectsNotifications, setSelectedProjectsNotifications] = useState<Record<string, boolean>>({})

  // Edit member projects state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editMemberProjects, setEditMemberProjects] = useState<string[]>([])
  const [initialMemberProjects, setInitialMemberProjects] = useState<string[]>([]) // Track initial state for comparison
  const [editMemberNotifications, setEditMemberNotifications] = useState<Record<string, boolean>>({})
  const [initialMemberNotifications, setInitialMemberNotifications] = useState<Record<string, boolean>>({})
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [isLoadingMemberProjects, setIsLoadingMemberProjects] = useState(false)

  // Delete project confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Delete member confirmation state
  const [deleteMemberConfirmId, setDeleteMemberConfirmId] = useState<string | null>(null)
  const [isDeletingMember, setIsDeletingMember] = useState(false)

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleCreateProject = async () => {
    // Validate required fields
    if (!newName.trim() || !newDomain.trim() || !newSmtpPassword.trim()) return

    // Validate based on auth type
    if (!newSmtpEmail.trim()) {
      setEmailValidationError("Email is required")
      return
    }
    if (!validateEmail(newSmtpEmail)) {
      setEmailValidationError("Please enter a valid email address")
      return
    }
    if (newSmtpAuthType === "username_email" && !newSmtpUsername.trim()) {
      setEmailValidationError("Username is required when using Username + Email mode")
      return
    }
    setEmailValidationError("")

    setIsCreating(true)
    try {
      const advancedOptions = {
        smtpHost: newSmtpHost || "smtp.gmail.com",
        smtpPort: parseInt(newSmtpPort) || 587,
      }

      // Prepare auth data based on type
      // Email only: { type: 'email', email: '...' }
      // Username + Email: { type: 'username_email', username: '...', email: '...' }
      const smtpAuth = newSmtpAuthType === "email"
        ? { type: 'email' as const, email: newSmtpEmail }
        : { type: 'username_email' as const, username: newSmtpUsername, email: newSmtpEmail }

      const success = await addProject(
        newName,
        newDomain,
        smtpAuth,
        newSmtpPassword,
        advancedOptions
      )

      if (success) {
        // Reset form
        setNewName("")
        setNewDomain("")
        setNewSmtpEmail("")
        setNewSmtpUsername("")
        setNewSmtpAuthType("email")
        setNewSmtpPassword("")
        setNewSmtpHost("smtp.gmail.com")
        setNewSmtpPort("587")
        setShowAdvanced(false)
        setEmailValidationError("")
        setIsDialogOpen(false)
        toast({
          title: "Project Created",
          description: "Your project has been created successfully.",
        })
      } else {
        // Get the latest error from the store
        const latestError = useProjectStore.getState().error
        toast({
          variant: "destructive",
          title: "Failed to Create Project",
          description: latestError || "An error occurred while creating the project.",
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim() || !newMemberPassword.trim()) return

    try {
      const success = await addMember(newMemberName, newMemberEmail, newMemberPassword, newMemberRole)
      if (success) {
        // Get the newly created user and assign to selected projects
        const newMembers = useTeamStore.getState().members
        const newUser = newMembers.find(m => m.email === newMemberEmail)
        if (newUser && selectedProjects.length > 0) {
          for (const projectId of selectedProjects) {
            try {
              await projectsApi.addMember(projectId, {
                userId: newUser.id,
                role: 'agent',
                shouldNotify: selectedProjectsNotifications[projectId] || false
              })
            } catch (err) {
              console.error('Failed to assign project:', err)
            }
          }
        }

        // Reset form and close dialog
        setNewMemberName("")
        setNewMemberEmail("")
        setNewMemberPassword("")
        setNewMemberRole("agent") // Reset to default role
        setSelectedProjects([])
        setSelectedProjectsNotifications({})
        setIsTeamDialogOpen(false)

        toast({
          title: "Member Added",
          description: selectedProjects.length > 0
            ? `Member added and assigned to ${selectedProjects.length} project(s).`
            : "Member added successfully.",
        })
      } else {
        // Handle case where addMember returns false but doesn't throw
        const latestError = useTeamStore.getState().error
        toast({
          variant: "destructive",
          title: "Failed to Add Member",
          description: latestError || "An error occurred while adding the member.",
        })
      }
    } catch (err) {
      // Handle unexpected errors
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    }
  }

  const handleToggleProject = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const handleToggleProjectNotification = (projectId: string) => {
    setSelectedProjectsNotifications(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }))
  }

  const handleToggleEditProject = (projectId: string) => {
    setEditMemberProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const handleToggleEditProjectNotification = (projectId: string) => {
    setEditMemberNotifications(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }))
  }

  const startEditMemberProjects = async (memberId: string) => {
    // Clear previous state and show loading
    setEditMemberProjects([])
    setInitialMemberProjects([])
    setEditMemberNotifications({})
    setInitialMemberNotifications({})
    setEditingMemberId(memberId)
    setIsLoadingMemberProjects(true)

    // Fetch current project assignments for this member
    const memberProjects: string[] = []
    const memberNotifications: Record<string, boolean> = {}

    // eslint-disable-next-line no-console
    console.log(`[Settings] Checking member ${memberId} access across ${projects.length} projects`)

    for (const project of projects) {
      try {
        // eslint-disable-next-line no-console
        console.log(`[Settings] Calling GET /api/v2/projects/${project.id}/members`)
        const response = await projectsApi.getMembers(project.id)
        // eslint-disable-next-line no-console
        console.log(`[Settings] Project ${project.name} (${project.id}) members response:`, response)

        // Check if this member is in the project's member list
        const members = response.data || []
        // eslint-disable-next-line no-console
        console.log(`[Settings] Members array for project ${project.name}:`, members)

        // Find the member record
        // Find the member record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memberRecord = members.find((m: any) => m.userId === memberId)

        // eslint-disable-next-line no-console
        console.log(`[Settings] Member ${memberId} is ${memberRecord ? 'IN' : 'NOT IN'} project ${project.name}`)

        if (memberRecord) {
          memberProjects.push(project.id)
          // Handle both camelCase and snake_case to be safe
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          memberNotifications[project.id] = memberRecord.shouldNotify || (memberRecord as any).should_notify || false
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[Settings] API ERROR for project ${project.id}:`, err)
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[Settings] Member ${memberId} is assigned to projects:`, memberProjects)
    setEditMemberProjects(memberProjects)
    setInitialMemberProjects(memberProjects) // Save initial state for comparison
    setEditMemberNotifications(memberNotifications)
    setInitialMemberNotifications(memberNotifications)
    setIsLoadingMemberProjects(false)
  }

  const saveMemberProjects = async () => {
    if (!editingMemberId) return
    setIsSavingMember(true)

    try {
      // Get current assignments
      const currentMemberState: Record<string, { isMember: boolean, shouldNotify: boolean }> = {}

      for (const project of projects) {
        try {
          const response = await projectsApi.getMembers(project.id)
          const members = response.data || []
          const record = members.find((m: { userId: string, shouldNotify?: boolean }) => m.userId === editingMemberId)

          if (record) {
            currentMemberState[project.id] = { isMember: true, shouldNotify: record.shouldNotify || false }
          }
        } catch {
          // Skip
        }
      }

      // eslint-disable-next-line no-console
      console.log(`[Settings] SAVE: Current state:`, currentMemberState)
      // eslint-disable-next-line no-console
      console.log(`[Settings] SAVE: Target projects: [${editMemberProjects.join(', ')}]`)

      // Add new assignments or update existing
      for (const projectId of editMemberProjects) {
        const current = currentMemberState[projectId]
        const targetNotify = editMemberNotifications[projectId] || false

        if (!current) {
          // Add member
          // eslint-disable-next-line no-console
          console.log(`[Settings] API CALL: POST /api/v2/projects/${projectId}/members - Adding member ${editingMemberId}`)
          await projectsApi.addMember(projectId, {
            userId: editingMemberId,
            role: 'agent',
            shouldNotify: targetNotify
          })
        } else if (current.shouldNotify !== targetNotify) {
          // Update member notification settings if changed
          // eslint-disable-next-line no-console
          console.log(`[Settings] API CALL: PATCH /api/v2/projects/${projectId}/members/${editingMemberId} - Update notify to ${targetNotify}`)
          await projectsApi.updateMember(projectId, editingMemberId, { shouldNotify: targetNotify })
        }
      }

      // Remove old assignments
      for (const projectId of Object.keys(currentMemberState)) {
        if (!editMemberProjects.includes(projectId)) {
          // eslint-disable-next-line no-console
          console.log(`[Settings] API CALL: DELETE /api/v2/projects/${projectId}/members/${editingMemberId}`)
          await projectsApi.removeMember(projectId, editingMemberId)
        }
      }

      const savedCount = editMemberProjects.length

      toast({
        title: "Projects Updated",
        description: `Member assigned to ${savedCount} project${savedCount !== 1 ? 's' : ''}.`,
      })

      // Close the edit panel and reset state
      setEditingMemberId(null)
      setEditMemberProjects([])
      setInitialMemberProjects([])
      setEditMemberNotifications({})
      setInitialMemberNotifications({})
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update project assignments.",
      })
    } finally {
      setIsSavingMember(false)
    }
  }

  const handleDeleteProject = async (id: string) => {
    setIsDeleting(true)
    try {
      const success = await deleteProject(id)
      if (success) {
        toast({
          title: "Project Deleted",
          description: "The project has been deleted successfully.",
        })
      } else {
        const latestError = useProjectStore.getState().error
        toast({
          variant: "destructive",
          title: "Failed to Delete Project",
          description: latestError || "An error occurred while deleting the project.",
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  const handleDeleteMember = async (id: string) => {
    if (id === agent?.id) return
    setIsDeletingMember(true)
    try {
      const success = await deleteMember(id)
      if (success) {
        toast({
          title: "Member Removed",
          description: "The team member has been removed successfully.",
        })
      } else {
        const latestError = useTeamStore.getState().error
        toast({
          variant: "destructive",
          title: "Failed to Remove Member",
          description: latestError || "An error occurred while removing the member.",
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setIsDeletingMember(false)
      setDeleteMemberConfirmId(null)
    }
  }

  const startEdit = async (project: Project) => {
    setEditingId(project.id)
    setEditName(project.name)
    setEditDomain(project.domain)
    // Determine auth type based on existing data
    if (project.smtpUsername) {
      setEditSmtpAuthType("username_email")
      setEditSmtpEmail(project.smtpEmail || "")
      setEditSmtpUsername(project.smtpUsername)
    } else {
      setEditSmtpAuthType("email")
      setEditSmtpEmail(project.smtpEmail || "")
      setEditSmtpUsername("")
    }

    // Default to empty, then try to fetch actual password
    setEditSmtpPassword("")
    setEditSmtpHost(project.smtpHost || "smtp.gmail.com")
    setEditSmtpPort(String(project.smtpPort || 587))
    setShowEditAdvanced(false)
    setEditEmailValidationError("")

    // Fetch decrypted credentials
    try {
      const response = await projectsApi.getCredentials(project.id)
      if (response.data && response.data.password) {
        setEditSmtpPassword(response.data.password)
      }
    } catch (error) {
      console.error("Failed to fetch project credentials:", error)
      // If fetch fails, we just leave the password field empty (secure default)
    }
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || !editDomain.trim()) return

    // Validate email if provided
    if (editSmtpEmail.trim() && !validateEmail(editSmtpEmail)) {
      setEditEmailValidationError("Please enter a valid email address")
      return
    }
    // Validate username is provided if using username_email mode
    if (editSmtpAuthType === "username_email" && editSmtpEmail.trim() && !editSmtpUsername.trim()) {
      setEditEmailValidationError("Username is required when using Username + Email mode")
      return
    }
    setEditEmailValidationError("")

    setIsSaving(true)
    try {
      const advancedOptions: Record<string, string | number> = {}
      if (editSmtpHost) advancedOptions.smtpHost = editSmtpHost
      if (editSmtpPort) advancedOptions.smtpPort = parseInt(editSmtpPort)

      // Prepare auth data based on type (only if email is provided)
      let smtpAuth: SmtpAuth | undefined
      if (editSmtpEmail.trim()) {
        smtpAuth = {
          type: editSmtpAuthType,
          email: editSmtpEmail,
          username: editSmtpAuthType === "username_email" ? editSmtpUsername : "",
        }
      }

      const success = await updateProject(
        editingId,
        editName,
        editDomain,
        smtpAuth,
        editSmtpPassword || undefined,
        advancedOptions
      )

      if (success) {
        setEditingId(null)
        setShowEditAdvanced(false)
        setEditSmtpEmail("")
        setEditSmtpUsername("")
        setEditSmtpPassword("")
        setEditEmailValidationError("")
        toast({
          title: "Project Updated",
          description: "Your project has been updated successfully.",
        })
      } else {
        const latestError = useProjectStore.getState().error
        toast({
          variant: "destructive",
          title: "Failed to Update Project",
          description: latestError || "An error occurred while updating the project.",
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditDomain("")
    setEditSmtpEmail("")
    setEditSmtpUsername("")
    setEditSmtpAuthType("email")
    setEditSmtpPassword("")
    setEditSmtpHost("smtp.gmail.com")
    setEditSmtpPort("587")
    setShowEditAdvanced(false)
    setEditEmailValidationError("")
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    // Responsive padding and layout
    <div className="flex-1 p-4 sm:p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        {/* Responsive header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold">Settings</h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage your projects and integrations</p>
            </div>
          </div>
          {agent && (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                >
                  <Shield className="w-3 h-3" />
                  {isAdmin ? "Admin" : "Developer"}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-none">
                  {agent.email}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6 sm:space-y-8">
          {/* Team Members Section */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-medium flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Manage admins and developers with access to SendDesk
                </p>
              </div>
              {isAdmin ? (
                <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Team Member</DialogTitle>
                      <DialogDescription>Add a new team member to SendDesk.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          placeholder="Full name"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="email@company.com"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Password</Label>
                        <PasswordInput
                          placeholder="••••••••"
                          value={newMemberPassword}
                          onChange={(e) => setNewMemberPassword(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Role</Label>
                        <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as AgentRole)}>
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin - Full access</SelectItem>
                            <SelectItem value="agent">Agent - Reply & manage tickets only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Assign to Projects
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1 mb-2">
                          Select which projects this member can access
                        </p>
                        <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                          {projects.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No projects available</p>
                          ) : (
                            projects.map((project, index) => (
                              <div
                                key={project.id}
                                className={cn(
                                  "flex items-center justify-between p-3 transition-colors",
                                  "hover:bg-muted/50",
                                  selectedProjects.includes(project.id) && "bg-primary/5",
                                  index !== projects.length - 1 && "border-b border-border"
                                )}
                              >
                                <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 pr-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedProjects.includes(project.id)}
                                    onChange={() => handleToggleProject(project.id)}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium">{project.name}</span>
                                    {project.domain && (
                                      <p className="text-xs text-muted-foreground truncate">{project.domain}</p>
                                    )}
                                  </div>
                                </label>

                                {selectedProjects.includes(project.id) && (
                                  <div
                                    className="flex items-center gap-2 pl-4 border-l border-border/50 shrink-0 ml-2"
                                    title="Notify on new tickets"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span
                                      className="text-xs text-muted-foreground mr-1 cursor-pointer select-none"
                                      onClick={() => handleToggleProjectNotification(project.id)}
                                    >
                                      Notify
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={!!selectedProjectsNotifications[project.id]}
                                      onChange={() => handleToggleProjectNotification(project.id)}
                                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0 cursor-pointer"
                                    />
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        {selectedProjects.length > 0 && (
                          <p className="text-xs text-primary mt-2">
                            {selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsTeamDialogOpen(false)
                            setSelectedProjects([])
                            setSelectedProjectsNotifications({})
                          }}
                          className="w-full sm:w-auto"
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleAddMember} className="w-full sm:w-auto">
                          Add Member
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  Admin only
                </div>
              )}
            </div>

            {/* Member search bar */}
            {isAdmin && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members by name or email..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className={`pl-9 ${memberSearchQuery ? 'pr-8' : ''}`}
                  />
                  {memberSearchQuery && (
                    <button
                      onClick={() => setMemberSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {debouncedMemberSearch && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Searching for "{debouncedMemberSearch}"
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              {isAdmin && membersLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {/* For non-admins, show only their own user info */}
              {!isAdmin && agent && (
                <div className="p-3 bg-card border border-border rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          <span className="truncate">{agent.name}</span>
                          <span className="text-xs text-muted-foreground">(You)</span>
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground truncate">{agent.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-12 sm:ml-0">
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        {agent.role === "admin" ? "Admin" : "Agent"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* For admins, show paginated members */}
              {isAdmin && !membersLoading && (() => {
                // Filter members based on search query
                const filteredMembers = debouncedMemberSearch.trim()
                  ? members.filter(member =>
                    member.name.toLowerCase().includes(debouncedMemberSearch.toLowerCase()) ||
                    member.email.toLowerCase().includes(debouncedMemberSearch.toLowerCase())
                  )
                  : members;

                return filteredMembers
                  .slice((membersPage - 1) * MEMBERS_PER_PAGE, membersPage * MEMBERS_PER_PAGE)
                  .map((member) => (
                    <div
                      key={member.id}
                      className="p-3 bg-card border border-border rounded-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium flex items-center gap-2 flex-wrap">
                              <span className="truncate">{member.name}</span>
                              {member.email === agent?.email && <span className="text-xs text-muted-foreground">(You)</span>}
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-12 sm:ml-0">
                          <span
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${member.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              }`}
                          >
                            <Shield className="w-3 h-3" />
                            {member.role === "admin" ? "Admin" : "Agent"}
                          </span>
                          {isAdmin && member.email !== agent?.email && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Toggle: if already editing this member, close the panel
                                  if (editingMemberId === member.id) {
                                    setEditingMemberId(null)
                                    setEditMemberProjects([])
                                    setInitialMemberProjects([])
                                  } else {
                                    startEditMemberProjects(member.id)
                                  }
                                }}
                                className="h-8 text-xs"
                              >
                                <Globe className="w-3 h-3 mr-1" />
                                {editingMemberId === member.id ? 'Cancel' : 'Projects'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteMemberConfirmId(member.id)}
                                className="text-destructive hover:text-destructive h-8 w-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Edit Projects Panel */}
                      {editingMemberId === member.id && (
                        <div className="mt-3 pt-3 border-t border-border animate-in slide-in-from-top-2 duration-200">
                          <Label className="text-sm flex items-center gap-2 mb-3">
                            <Globe className="w-4 h-4" />
                            Assigned Projects
                            {editMemberProjects.length > 0 && (
                              <span className="text-xs font-normal text-primary">
                                ({editMemberProjects.length} selected)
                              </span>
                            )}
                          </Label>
                          <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                            {isLoadingMemberProjects ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
                              </div>
                            ) : projects.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">No projects available</p>
                            ) : (
                              projects.map((project, index) => (
                                <div
                                  key={project.id}
                                  className={cn(
                                    "flex items-center justify-between p-3 transition-colors",
                                    "hover:bg-muted/50",
                                    editMemberProjects.includes(project.id) && "bg-primary/5",
                                    index !== projects.length - 1 && "border-b border-border",
                                    (isSavingMember || isLoadingMemberProjects) && "opacity-50"
                                  )}
                                >
                                  <label className={cn(
                                    "flex items-center gap-3 cursor-pointer flex-1 min-w-0 pr-2",
                                    (isSavingMember || isLoadingMemberProjects) && "cursor-not-allowed"
                                  )}>
                                    <input
                                      type="checkbox"
                                      checked={editMemberProjects.includes(project.id)}
                                      onChange={() => handleToggleEditProject(project.id)}
                                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0"
                                      disabled={isSavingMember || isLoadingMemberProjects}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-medium">{project.name}</span>
                                      {project.domain && (
                                        <p className="text-xs text-muted-foreground truncate">{project.domain}</p>
                                      )}
                                    </div>
                                  </label>

                                  {editMemberProjects.includes(project.id) && (
                                    <div
                                      className={cn(
                                        "flex items-center gap-2 pl-4 border-l border-border/50 shrink-0 ml-2",
                                        (isSavingMember || isLoadingMemberProjects) && "opacity-50"
                                      )}
                                      title="Notify on new tickets"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span
                                        className="text-xs text-muted-foreground mr-1 cursor-pointer select-none"
                                        onClick={() => !isSavingMember && !isLoadingMemberProjects && handleToggleEditProjectNotification(project.id)}
                                      >
                                        Notify
                                      </span>
                                      <input
                                        type="checkbox"
                                        checked={!!editMemberNotifications[project.id]}
                                        onChange={() => handleToggleEditProjectNotification(project.id)}
                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0 cursor-pointer"
                                        disabled={isSavingMember || isLoadingMemberProjects}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-xs text-muted-foreground">
                              {editMemberProjects.length === 0
                                ? "No projects assigned"
                                : `Access to ${editMemberProjects.length} project${editMemberProjects.length !== 1 ? 's' : ''}`}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingMemberId(null)
                                  setEditMemberProjects([])
                                  setInitialMemberProjects([])
                                }}
                                disabled={isSavingMember}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={saveMemberProjects}
                                disabled={
                                  isSavingMember ||
                                  isLoadingMemberProjects ||
                                  (
                                    // Check if project assignments match
                                    editMemberProjects.length === initialMemberProjects.length &&
                                    editMemberProjects.every(p => initialMemberProjects.includes(p)) &&
                                    // Check if notification settings match for the assigned projects
                                    editMemberProjects.every(p => (editMemberNotifications[p] || false) === (initialMemberNotifications[p] || false))
                                  )
                                }
                              >
                                {isSavingMember && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
              })()}

              {isAdmin && !membersLoading && members.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No other users found.</div>
              )}

              {/* Horizontal pagination for members */}
              {isAdmin && !membersLoading && (() => {
                const filteredMembers = debouncedMemberSearch.trim()
                  ? members.filter(member =>
                    member.name.toLowerCase().includes(debouncedMemberSearch.toLowerCase()) ||
                    member.email.toLowerCase().includes(debouncedMemberSearch.toLowerCase())
                  )
                  : members;

                const totalPages = Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE);

                return filteredMembers.length > MEMBERS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMembersPage(p => Math.max(1, p - 1))}
                      disabled={membersPage === 1}
                      className="text-xs"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={membersPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMembersPage(page)}
                          className="text-xs w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMembersPage(p => Math.min(totalPages, p + 1))}
                      disabled={membersPage >= totalPages}
                      className="text-xs"
                    >
                      Next
                    </Button>
                  </div>
                );
              })()}
              {isAdmin && !membersLoading && (() => {
                const filteredMembers = debouncedMemberSearch.trim()
                  ? members.filter(member =>
                    member.name.toLowerCase().includes(debouncedMemberSearch.toLowerCase()) ||
                    member.email.toLowerCase().includes(debouncedMemberSearch.toLowerCase())
                  )
                  : members;

                return filteredMembers.length > 0 && (
                  <div className="text-center py-2 text-xs text-muted-foreground">
                    {debouncedMemberSearch.trim() ? (
                      `Found ${filteredMembers.length} member${filteredMembers.length !== 1 ? 's' : ''} matching "${debouncedMemberSearch}"`
                    ) : (
                      `Showing ${Math.min((membersPage - 1) * MEMBERS_PER_PAGE + 1, filteredMembers.length)}-${Math.min(membersPage * MEMBERS_PER_PAGE, filteredMembers.length)} of ${filteredMembers.length} members`
                    )}
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Projects Section */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-medium">Projects</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Manage websites connected to SendDesk
                </p>
              </div>
              {isAdmin ? (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Project</DialogTitle>
                      <DialogDescription>Create a new project to connect to SendDesk.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
                      <div>
                        <Label>Project Name</Label>
                        <Input
                          placeholder="My Website"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Domain</Label>
                        <Input
                          placeholder="example.com"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>SMTP Authentication</Label>
                        <div className="flex gap-2 mt-2 mb-2">
                          <Button
                            type="button"
                            variant={newSmtpAuthType === "email" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setNewSmtpAuthType("email")
                              setNewSmtpUsername("") // Clear username when switching to email only
                              setEmailValidationError("")
                            }}
                            className="flex-1"
                          >
                            Email Only
                          </Button>
                          <Button
                            type="button"
                            variant={newSmtpAuthType === "username_email" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setNewSmtpAuthType("username_email")
                              setEmailValidationError("")
                            }}
                            className="flex-1"
                          >
                            Username + Email
                          </Button>
                        </div>

                        {/* Username field - only shown for username_email mode */}
                        {newSmtpAuthType === "username_email" && (
                          <div className="mb-2">
                            <Input
                              type="text"
                              placeholder="AKIAIOSFODNN7EXAMPLE"
                              value={newSmtpUsername}
                              onChange={(e) => {
                                setNewSmtpUsername(e.target.value)
                                setEmailValidationError("")
                              }}
                              autoComplete="off"
                              data-lpignore="true"
                              data-form-type="other"
                            />
                            <p className="text-xs text-muted-foreground mt-1">SMTP Username (e.g., AWS SES username)</p>
                          </div>
                        )}

                        {/* Email field - always shown */}
                        <Input
                          type="email"
                          placeholder="your-email@gmail.com"
                          value={newSmtpEmail}
                          onChange={(e) => {
                            setNewSmtpEmail(e.target.value)
                            setEmailValidationError("")
                          }}
                          autoComplete="off"
                          data-lpignore="true"
                          data-form-type="other"
                        />
                        {emailValidationError && (
                          <p className="text-xs text-destructive mt-1">{emailValidationError}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {newSmtpAuthType === "email"
                            ? "Gmail email address or SMTP email for authentication"
                            : "SMTP email address (sender email)"}
                        </p>
                      </div>
                      <div>
                        <Label>SMTP Password (App Password)</Label>
                        <PasswordInput
                          placeholder="••••••••••••••••"
                          value={newSmtpPassword}
                          onChange={(e) => setNewSmtpPassword(e.target.value)}
                          className="mt-2"
                          autoComplete="new-password"
                          data-lpignore="true"
                          data-form-type="other"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Use Gmail App Password, not your regular password
                        </p>
                      </div>

                      {/* Advanced Options */}
                      <div className="border-t border-border pt-4">
                        <button
                          type="button"
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          Advanced Options
                        </button>
                        {showAdvanced && (
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">SMTP Host</Label>
                                <Input
                                  placeholder="smtp.gmail.com"
                                  value={newSmtpHost}
                                  onChange={(e) => setNewSmtpHost(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">SMTP Port</Label>
                                <Input
                                  type="number"
                                  placeholder="587"
                                  value={newSmtpPort}
                                  onChange={(e) => setNewSmtpPort(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto" disabled={isCreating}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateProject} className="w-full sm:w-auto" disabled={isCreating}>
                          {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {isCreating ? "Creating..." : "Create Project"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  Admin only
                </div>
              )}
            </div>

            <div className="space-y-3">
              {projectsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!projectsLoading && projects.map((project) => (
                <div key={project.id} className="p-3 sm:p-4 bg-card border border-border rounded-lg">
                  {editingId === project.id ? (
                    <div className="space-y-3">
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Project name"
                        />
                        <Input
                          value={editDomain}
                          onChange={(e) => setEditDomain(e.target.value)}
                          placeholder="domain.com"
                        />

                        {/* SMTP Authentication Toggle */}
                        <div>
                          <Label className="text-sm">SMTP Authentication (optional)</Label>
                          <div className="flex gap-2 mt-2 mb-2">
                            <Button
                              type="button"
                              variant={editSmtpAuthType === "email" ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setEditSmtpAuthType("email")
                                setEditSmtpUsername("") // Clear username when switching to email only
                                setEditEmailValidationError("")
                              }}
                              className="flex-1"
                            >
                              Email Only
                            </Button>
                            <Button
                              type="button"
                              variant={editSmtpAuthType === "username_email" ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setEditSmtpAuthType("username_email")
                                setEditEmailValidationError("")
                              }}
                              className="flex-1"
                            >
                              Username + Email
                            </Button>
                          </div>

                          {/* Username field - only shown for username_email mode */}
                          {editSmtpAuthType === "username_email" && (
                            <div className="mb-2">
                              <Input
                                type="text"
                                value={editSmtpUsername}
                                onChange={(e) => {
                                  setEditSmtpUsername(e.target.value)
                                  setEditEmailValidationError("")
                                }}
                                placeholder="SMTP Username (leave empty to keep current)"
                                autoComplete="off"
                                data-lpignore="true"
                                data-form-type="other"
                              />
                              <p className="text-xs text-muted-foreground mt-1">SMTP Username (e.g., AWS SES username)</p>
                            </div>
                          )}

                          {/* Email field - always shown */}
                          <Input
                            type="email"
                            value={editSmtpEmail}
                            onChange={(e) => {
                              setEditSmtpEmail(e.target.value)
                              setEditEmailValidationError("")
                            }}
                            placeholder="SMTP Email (leave empty to keep current)"
                            autoComplete="off"
                            data-lpignore="true"
                            data-form-type="other"
                          />
                          {editEmailValidationError && (
                            <p className="text-xs text-destructive mt-1">{editEmailValidationError}</p>
                          )}
                        </div>

                        <PasswordInput
                          value={editSmtpPassword}
                          onChange={(e) => setEditSmtpPassword(e.target.value)}
                          placeholder="SMTP Password (leave empty to keep current)"
                          autoComplete="new-password"
                          data-lpignore="true"
                          data-form-type="other"
                        />
                      </div>

                      {/* Advanced Options for Edit */}
                      <div className="border-t border-border pt-3">
                        <button
                          type="button"
                          onClick={() => setShowEditAdvanced(!showEditAdvanced)}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                          {showEditAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          Advanced Options
                        </button>
                        {showEditAdvanced && (
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">SMTP Host</Label>
                                <Input
                                  placeholder="smtp.gmail.com"
                                  value={editSmtpHost}
                                  onChange={(e) => setEditSmtpHost(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">SMTP Port</Label>
                                <Input
                                  type="number"
                                  placeholder="587"
                                  value={editSmtpPort}
                                  onChange={(e) => setEditSmtpPort(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving}>
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveEdit} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">{project.name}</h3>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">{project.domain}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => startEdit(project)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmId(project.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm overflow-hidden cursor-pointer hover:bg-muted transition-colors group"
                        onClick={() => copyToClipboard(project.id)}
                        title="Click to copy Project ID"
                      >
                        <span className="text-xs text-muted-foreground shrink-0">ID:</span>
                        <code className="flex-1 font-mono text-xs truncate">{project.id}</code>
                        <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm overflow-hidden mt-2">
                        <Key className="w-4 h-4 text-muted-foreground shrink-0" />
                        <code className="flex-1 font-mono text-xs truncate">{project.apiKey}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copyToClipboard(project.apiKey)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>

                      {isAdmin && (
                        <EmailResponsesEditor projectId={project.id} projectName={project.name} />
                      )}
                    </>
                  )}
                </div>
              ))}

              {!projectsLoading && projects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No projects yet.{" "}
                  {isAdmin ? "Add your first project to get started." : "Ask an admin to add projects."}
                </div>
              )}
            </div>
          </section>


        </div>
      </div>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone and will remove all associated tickets and data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteProject(deleteConfirmId)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isDeleting ? "Deleting..." : "Delete Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation Dialog */}
      <Dialog open={deleteMemberConfirmId !== null} onOpenChange={(open) => !open && setDeleteMemberConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this team member? They will lose access to all projects and tickets.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteMemberConfirmId(null)} disabled={isDeletingMember}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMemberConfirmId && handleDeleteMember(deleteMemberConfirmId)}
              disabled={isDeletingMember}
            >
              {isDeletingMember ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isDeletingMember ? "Removing..." : "Remove Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
