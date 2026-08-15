import { getDB, saveDB } from "../db"
import { route, type RequestCtx } from "../router"
import { agentFromHeaders, getCurrentAgentId, setCurrentAgentId } from "../session"
import { errorResponse, fakeAccessToken, fakeRefreshToken, jsonResponse } from "../util"
import type { AgentRecord } from "../schema"

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365 // "far-future expiry" per plan §3

function publicUser(agent: AgentRecord) {
  return {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    role: agent.role,
    status: "active",
    phone: agent.phone,
    timezone: agent.timezone,
    avatarUrl: agent.avatarUrl ?? null,
    lastLoginAt: new Date().toISOString(),
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  }
}

function issueSession(agent: AgentRecord) {
  const accessToken = fakeAccessToken(agent.id)
  const refreshToken = fakeRefreshToken()
  const db = getDB()
  db.refreshTokens[refreshToken] = agent.id
  saveDB()
  setCurrentAgentId(agent.id)
  return {
    user: publicUser(agent),
    accessToken,
    expiresIn: TOKEN_TTL_SECONDS,
    refreshToken,
  }
}

route("POST", "/auth/signup", async (ctx: RequestCtx) => {
  const body = (ctx.body ?? {}) as { email?: string; password?: string; name?: string }
  if (!body.email || !body.password || !body.name) {
    return jsonResponse({ status: "error", message: "Name, email and password are required" })
  }
  const db = getDB()
  if (db.agents.some((a) => a.email.toLowerCase() === body.email!.toLowerCase())) {
    return jsonResponse({ status: "error", message: "An account with that email already exists" })
  }
  // Demo signup creates a lightweight, session-only agent (not persisted across resets).
  const agent: AgentRecord = {
    id: `agent_${Date.now().toString(36)}`,
    email: body.email,
    name: body.name,
    role: "agent",
    password: body.password,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.agents.push(agent)
  saveDB()
  return jsonResponse({ status: "success", data: publicUser(agent) })
})

route("POST", "/auth/signin", async (ctx: RequestCtx) => {
  const body = (ctx.body ?? {}) as { email?: string; password?: string }
  const db = getDB()
  const agent = db.agents.find((a) => a.email.toLowerCase() === (body.email ?? "").toLowerCase())
  if (!agent || agent.password !== body.password) {
    return jsonResponse({
      status: "error",
      message: "Invalid email or password. Demo credentials are shown on the sign-in screen.",
      code: "INVALID_CREDENTIALS",
    })
  }
  return jsonResponse({ status: "success", data: issueSession(agent) })
})

route("POST", "/auth/signout", async () => {
  return jsonResponse({ status: "success", data: { message: "Signed out" } })
})

route("POST", "/auth/refresh", async (ctx: RequestCtx) => {
  const db = getDB()
  const headerToken = ctx.headers.get("x-refresh-token")
  let agentId = headerToken ? db.refreshTokens[headerToken] : undefined
  if (!agentId) {
    // Cookie-based refresh isn't observable to the mock (no real cookie jar for
    // a fake origin), so fall back to whichever identity the demo badge/role
    // switcher currently has active — refresh should never dead-end a demo session.
    agentId = getCurrentAgentId()
  }
  const agent = db.agents.find((a) => a.id === agentId) ?? db.agents[0]
  return jsonResponse({ status: "success", data: issueSession(agent) })
})

route("GET", "/auth/me", async (ctx: RequestCtx) => {
  const agent = agentFromHeaders(ctx.headers)
  if (!agent) return errorResponse("Not authenticated", 401, "TOKEN_MISSING")
  return jsonResponse({ status: "success", data: { user: publicUser(agent) } })
})

export {}
