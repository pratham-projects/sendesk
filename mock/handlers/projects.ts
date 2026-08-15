import { getDB, saveDB } from "../db"
import { route, type RequestCtx } from "../router"
import { errorResponse, ok, runtimeId } from "../util"
import type { ProjectMemberRecord } from "../schema"

route("GET", "/projects", async (ctx: RequestCtx) => {
  const db = getDB()
  const status = ctx.query.get("status")
  let items = db.projects
  if (status) items = items.filter((p) => p.status === status)
  return ok(items)
})

route("POST", "/projects", async (ctx: RequestCtx) => {
  const db = getDB()
  const body = ctx.body as Record<string, unknown>
  const project = {
    id: runtimeId("proj"),
    name: String(body.name ?? "Untitled project"),
    slug: String(body.slug ?? "untitled"),
    domain: body.domain ? String(body.domain) : undefined,
    status: "active" as const,
    apiKey: `key_demo_${runtimeId("k").slice(4)}`,
    ownerUserId: db.agents[0].id,
    smtpEmail: body.smtpEmail ? String(body.smtpEmail) : undefined,
    smtpUsername: body.smtpUsername ? String(body.smtpUsername) : undefined,
    smtpHost: body.smtpHost ? String(body.smtpHost) : "smtp.gmail.com",
    smtpPort: typeof body.smtpPort === "number" ? body.smtpPort : 587,
    smtpPassword: body.smtpPassword ? String(body.smtpPassword) : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.projects.push(project)
  saveDB()
  return ok(project)
})

route("GET", "/projects/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  const p = db.projects.find((x) => x.id === ctx.params.id)
  if (!p) return errorResponse("Project not found", 404)
  return ok(p)
})

route("PATCH", "/projects/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  const p = db.projects.find((x) => x.id === ctx.params.id)
  if (!p) return errorResponse("Project not found", 404)
  Object.assign(p, ctx.body ?? {}, { updatedAt: new Date().toISOString() })
  saveDB()
  return ok(p)
})

route("DELETE", "/projects/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  db.projects = db.projects.filter((p) => p.id !== ctx.params.id)
  saveDB()
  return ok({ success: true, id: ctx.params.id })
})

route("POST", "/projects/:id/regenerate-api-key", async (ctx: RequestCtx) => {
  const db = getDB()
  const p = db.projects.find((x) => x.id === ctx.params.id)
  if (!p) return errorResponse("Project not found", 404)
  p.apiKey = `key_demo_${runtimeId("k").slice(4)}`
  p.updatedAt = new Date().toISOString()
  saveDB()
  return ok({ id: p.id, apiKey: p.apiKey, updatedAt: p.updatedAt })
})

route("GET", "/projects/:id/credentials", async (ctx: RequestCtx) => {
  const db = getDB()
  const p = db.projects.find((x) => x.id === ctx.params.id)
  if (!p) return errorResponse("Project not found", 404)
  return ok({
    email: p.smtpEmail ?? "",
    username: p.smtpUsername,
    password: p.smtpPassword ?? "",
    smtpHost: p.smtpHost,
    smtpPort: p.smtpPort,
  })
})

route("GET", "/projects/:id/members/search", async (ctx: RequestCtx) => {
  const db = getDB()
  const q = (ctx.query.get("q") ?? "").toLowerCase()
  const members = db.projectMembers
    .filter((m) => m.projectId === ctx.params.id)
    .map(serializeMember)
    .filter((m) => m.user?.name.toLowerCase().includes(q) || m.user?.email.toLowerCase().includes(q))
  return ok(members)
})

function serializeMember(m: ProjectMemberRecord) {
  const db = getDB()
  const user = db.agents.find((a) => a.id === m.userId)
  return {
    id: m.id,
    projectId: m.projectId,
    userId: m.userId,
    role: m.role,
    shouldNotify: m.shouldNotify,
    canViewAllTickets: m.canViewAllTickets,
    canManageTemplates: m.canManageTemplates,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    user: user ? { id: user.id, email: user.email, name: user.name } : undefined,
  }
}

route("GET", "/projects/:id/members", async (ctx: RequestCtx) => {
  const db = getDB()
  return ok(db.projectMembers.filter((m) => m.projectId === ctx.params.id).map(serializeMember))
})

route("POST", "/projects/:id/members", async (ctx: RequestCtx) => {
  const db = getDB()
  const body = (ctx.body ?? {}) as { userId: string; role?: "admin" | "agent"; shouldNotify?: boolean }
  const existing = db.projectMembers.find((m) => m.projectId === ctx.params.id && m.userId === body.userId)
  if (existing) {
    Object.assign(existing, { role: body.role ?? existing.role, shouldNotify: body.shouldNotify ?? existing.shouldNotify })
    saveDB()
    return ok(serializeMember(existing))
  }
  const member: ProjectMemberRecord = {
    id: runtimeId("pm"),
    projectId: ctx.params.id,
    userId: body.userId,
    role: body.role ?? "agent",
    shouldNotify: !!body.shouldNotify,
    canViewAllTickets: true,
    canManageTemplates: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.projectMembers.push(member)
  saveDB()
  return ok(serializeMember(member))
})

route("PATCH", "/projects/:id/members/:userId", async (ctx: RequestCtx) => {
  const db = getDB()
  const member = db.projectMembers.find((m) => m.projectId === ctx.params.id && m.userId === ctx.params.userId)
  if (!member) return errorResponse("Member not found", 404)
  Object.assign(member, ctx.body ?? {}, { updatedAt: new Date().toISOString() })
  saveDB()
  return ok(serializeMember(member))
})

route("DELETE", "/projects/:id/members/:userId", async (ctx: RequestCtx) => {
  const db = getDB()
  db.projectMembers = db.projectMembers.filter(
    (m) => !(m.projectId === ctx.params.id && m.userId === ctx.params.userId),
  )
  saveDB()
  return ok({ success: true })
})

export {}
