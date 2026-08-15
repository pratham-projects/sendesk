import { getDB } from "../db"
import { Rng } from "../rng"
import { route, type RequestCtx } from "../router"
import { agentFromHeaders } from "../session"
import { ok } from "../util"
import type { ViewerRecord } from "../schema"

// Real heartbeats from the current browser tab. Kept out of the persisted
// db/sessionStorage on purpose — presence is inherently ephemeral.
const heartbeats = new Map<string, ViewerRecord[]>()
const HEARTBEAT_TTL_MS = 90_000

route("POST", "/viewers/:ticketId", async (ctx: RequestCtx) => {
  const agent = agentFromHeaders(ctx.headers)
  if (agent) {
    const list = (heartbeats.get(ctx.params.ticketId) ?? []).filter((v) => v.userId !== agent.id)
    list.push({ userId: agent.id, name: agent.name, lastSeen: Date.now() })
    heartbeats.set(ctx.params.ticketId, list)
  }
  return ok({ success: true })
})

route("DELETE", "/viewers/:ticketId", async (ctx: RequestCtx) => {
  const agent = agentFromHeaders(ctx.headers)
  if (agent) {
    const list = (heartbeats.get(ctx.params.ticketId) ?? []).filter((v) => v.userId !== agent.id)
    heartbeats.set(ctx.params.ticketId, list)
  }
  return ok({ success: true })
})

route("GET", "/viewers/:ticketId", async (ctx: RequestCtx) => {
  const now = Date.now()
  const real = (heartbeats.get(ctx.params.ticketId) ?? []).filter((v) => now - v.lastSeen < HEARTBEAT_TTL_MS)

  // Simulate a second agent occasionally glancing at the same ticket — the
  // decision is reseeded every minute (deterministic per ticket+minute, not
  // Math.random) so it flips over time instead of freezing at one value.
  const db = getDB()
  const bucket = Math.floor(now / 60_000)
  const rng = new Rng(`${ctx.params.ticketId}:${bucket}`)
  const synthetic: ViewerRecord[] = []
  if (rng.bool(0.35) && db.agents.length > 1) {
    const candidate = rng.pick(db.agents)
    if (!real.some((v) => v.userId === candidate.id)) {
      synthetic.push({ userId: candidate.id, name: candidate.name, lastSeen: now })
    }
  }

  return ok([...real, ...synthetic].map((v) => ({ userId: v.userId, name: v.name })))
})

export {}
