import { getDB } from "./db"
import type { AgentRecord } from "./schema"

/** Decodes the demo access token's payload segment to find the agent id.
 *  This is a display-shaped, unsigned token (see util.ts fakeAccessToken) —
 *  never a real credential — so "decoding" it is just base64 JSON parsing. */
export function agentFromToken(token: string | null): AgentRecord | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(atob(parts[2])) as { sub?: string }
    if (!payload.sub) return null
    return getDB().agents.find((a) => a.id === payload.sub) ?? null
  } catch {
    return null
  }
}

export function agentFromHeaders(headers: Headers): AgentRecord | null {
  const auth = headers.get("Authorization") || headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) return null
  return agentFromToken(auth.slice("Bearer ".length))
}

/** The identity the demo badge's role switcher currently has "signed in" —
 *  persisted separately from the zustand store so a page refresh keeps it. */
const CURRENT_AGENT_KEY = "sendesk_demo_current_agent"

export function getCurrentAgentId(): string {
  if (typeof window === "undefined") return getDB().agents[0].id
  return window.localStorage.getItem(CURRENT_AGENT_KEY) || getDB().agents[0].id
}

export function setCurrentAgentId(id: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CURRENT_AGENT_KEY, id)
}
