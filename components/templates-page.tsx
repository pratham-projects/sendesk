"use client"

import Link from "next/link"
import { useState, useMemo, useCallback, useEffect } from "react"
import { useTemplateStore } from "@/lib/store"
import type { TemplateResponse } from "@/lib/api"
import { templatesApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, ArrowLeft, Search, Loader2, X } from "lucide-react"
import { useDebounce } from "@/lib/hooks"

export function TemplatesPage() {
  const { 
    templates, 
    isLoading, 
    isLoadingMore,
    templatesHasMore,
    fetchTemplates, 
    fetchMoreTemplates,
    addTemplate, 
    updateTemplate, 
    deleteTemplate 
  } = useTemplateStore()
  const [editingTemplate, setEditingTemplate] = useState<TemplateResponse | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newBody, setNewBody] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  // Search functionality
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<TemplateResponse[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debouncedSearch = useDebounce(searchQuery, 300)
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && templatesHasMore && !isLoadingMore && !isLoading && !debouncedSearch) {
          fetchMoreTemplates()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [templatesHasMore, isLoadingMore, isLoading, fetchMoreTemplates, debouncedSearch])

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Search templates when debounced query changes
  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      setIsSearching(true)
      templatesApi.search({ q: debouncedSearch, limit: 50 })
        .then(response => {
          setSearchResults(response.data || [])
        })
        .catch(err => {
          console.error("Template search failed:", err)
          setSearchResults([])
        })
        .finally(() => {
          setIsSearching(false)
        })
    } else {
      setSearchResults([])
      setIsSearching(false)
    }
  }, [debouncedSearch])

  // Use search results if searching, otherwise show all templates
  const filteredTemplates = useMemo(() => {
    if (debouncedSearch.trim().length >= 2) {
      return searchResults
    }
    return templates
  }, [templates, searchResults, debouncedSearch])

  const handleSave = useCallback(async () => {
    if (!newTitle.trim() || !newBody.trim()) return

    setIsSaving(true)
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, newTitle, newBody)
      } else {
        await addTemplate(newTitle, newBody)
      }

      setNewTitle("")
      setNewBody("")
      setEditingTemplate(null)
      setIsDialogOpen(false)
    } finally {
      setIsSaving(false)
    }
  }, [newTitle, newBody, editingTemplate, updateTemplate, addTemplate])

  const handleEdit = useCallback((template: TemplateResponse) => {
    setEditingTemplate(template)
    setNewTitle(template.title)
    setNewBody(template.body)
    setIsDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await deleteTemplate(id)
  }, [deleteTemplate])

  const handleNewTemplate = useCallback(() => {
    setEditingTemplate(null)
    setNewTitle("")
    setNewBody("")
    setIsDialogOpen(true)
  }, [])

  return (
    // Responsive padding
    <div className="flex-1 p-4 sm:p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Response Templates</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage canned responses for quick replies</p>
          </div>
        </div>

        {/* Search and add section */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-9 ${searchQuery ? 'pr-8' : ''}`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewTemplate} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
                <DialogDescription>
                  {editingTemplate ? "Modify your response template." : "Create a new canned response template."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Title</label>
                  <Input placeholder="Template name" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Content</label>
                  <Textarea
                    placeholder="Template content..."
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    className="min-h-[150px] max-h-48 overflow-y-auto resize-none"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto" disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="w-full sm:w-auto" disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingTemplate ? "Save Changes" : "Create Template"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Results count */}
        {debouncedSearch.trim().length >= 2 && (
          <p className="text-xs text-muted-foreground mb-3">
            {isSearching ? "Searching..." : `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? "s" : ""} found`}
          </p>
        )}

        <div className="space-y-3">
          {(isLoading && !debouncedSearch) ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {debouncedSearch.trim().length >= 2 ? "No templates match your search" : "No templates yet. Create your first one!"}
            </div>
          ) : (
            <>
              {filteredTemplates.map((template) => (
                <div key={template.id} className="p-3 sm:p-4 bg-card border border-border rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{template.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{template.body}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {/* Load more trigger - only show when not searching */}
              {!debouncedSearch && <div ref={loadMoreRef} className="h-1" />}
              {isLoadingMore && !debouncedSearch && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading more...</span>
                </div>
              )}
              {!templatesHasMore && !debouncedSearch && filteredTemplates.length > 0 && (
                <div className="text-center py-3 text-xs text-muted-foreground">
                  All templates loaded
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
