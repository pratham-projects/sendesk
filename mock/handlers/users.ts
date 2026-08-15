import { getDB, saveDB } from "../db"
import { route, type RequestCtx } from "../router"
import { agentFromHeaders } from "../session"
import { errorResponse, ok, paginated, runtimeId } from "../util"
import type { AgentRecord } from "../schema"

function publicUser(a: AgentRecord) {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    status: "active",
    phone: a.phone,
    timezone: a.timezone,
    avatarUrl: a.avatarUrl ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }
}

route("GET", "/users/me", async (ctx: RequestCtx) => {
  const agent = agentFromHeaders(ctx.headers)
  if (!agent) return errorResponse("Not authenticated", 401, "TOKEN_MISSING")
  return ok(publicUser(agent))
})

route("PATCH", "/users/me", async (ctx: RequestCtx) => {
  const agent = agentFromHeaders(ctx.headers)
  if (!agent) return errorResponse("Not authenticated", 401, "TOKEN_MISSING")
  const body = (ctx.body ?? {}) as Partial<AgentRecord>
  Object.assign(agent, body, { updatedAt: new Date().toISOString() })
  saveDB()
  return ok(publicUser(agent))
})

route("GET", "/users", async (ctx: RequestCtx) => {
  const db = getDB()
  const limit = Number(ctx.query.get("limit") ?? 20)
  const offset = Number(ctx.query.get("offset") ?? 0)
  let items = db.agents
  const role = ctx.query.get("role")
  if (role) items = items.filter((a) => a.role === role)
  return paginated(items.map(publicUser), limit, offset)
})

route("POST", "/users", async (ctx: RequestCtx) => {
  const db = getDB()
  const body = (ctx.body ?? {}) as { email: string; password: string; name: string; role: string }
  const agent: AgentRecord = {
    id: runtimeId("agent"),
    email: body.email,
    name: body.name,
    role: (body.role as AgentRecord["role"]) || "agent",
    password: body.password,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.agents.push(agent)
  saveDB()
  return ok(publicUser(agent))
})

route("GET", "/users/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  const agent = db.agents.find((a) => a.id === ctx.params.id)
  if (!agent) return errorResponse("User not found", 404)
  return ok(publicUser(agent))
})

route("PATCH", "/users/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  const agent = db.agents.find((a) => a.id === ctx.params.id)
  if (!agent) return errorResponse("User not found", 404)
  Object.assign(agent, ctx.body ?? {}, { updatedAt: new Date().toISOString() })
  saveDB()
  return ok(publicUser(agent))
})

route("DELETE", "/users/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  db.agents = db.agents.filter((a) => a.id !== ctx.params.id)
  saveDB()
  return ok({ success: true, id: ctx.params.id })
})

export {}
