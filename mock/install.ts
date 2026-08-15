/**
 * installMockApi() — patches globalThis.fetch, once, browser-only.
 *
 * This is the one hook the whole demo layer depends on. Every upstream
 * service in lib/api/*.ts — including the three that build their own fetch
 * calls instead of going through lib/api/client.ts's apiClient (auth.ts,
 * attachments.ts, tickets.ts:154) — ultimately calls the same global fetch,
 * so patching fetch itself (rather than swapping apiClient) catches all of
 * them without editing a single upstream file. See mock/router.ts for the
 * route table and claude-outputs/docs/demo-repos-plan.md §3 for the design
 * rationale.
 */

import "./handlers/auth"
import "./handlers/users"
import "./handlers/tickets"
import "./handlers/projects"
import "./handlers/unread"
import "./handlers/templates"
import "./handlers/email-responses"
import "./handlers/attachments"
import "./handlers/viewers"

import { getDB } from "./db"
import { matchRoute, stripApiPrefix, type RequestCtx } from "./router"
import { startTicker } from "./ticker"
import { delay, randomLatencyMs } from "./util"
import { writeSession } from "./write-session"
import { getCurrentAgentId } from "./session"

declare global {
  interface Window {
    __sendeskMockInstalled?: boolean
    __sendeskMockNativeFetch?: typeof fetch
  }
}

function resolveUrl(input: RequestInfo | URL): URL {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
  try {
    return new URL(raw)
  } catch {
    return new URL(raw, window.location.origin)
  }
}

async function parseBody(init: RequestInit | undefined): Promise<unknown> {
  const raw = init?.body
  if (raw == null) return null
  if (raw instanceof FormData) return raw
  if (raw instanceof Blob) return raw // covers File, which attachments.ts uploads directly as the body
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return null
}

function ensureAutoLogin(): void {
  if (window.localStorage.getItem("accessToken")) return // an existing/switched session wins
  const db = getDB()
  const agentId = getCurrentAgentId()
  const agent = db.agents.find((a) => a.id === agentId) ?? db.agents[0]
  writeSession(agent)
}

export function installMockApi(): void {
  if (typeof window === "undefined") return
  if (process.env.NEXT_PUBLIC_DEMO === "0") return // default is demo-on
  if (window.__sendeskMockInstalled) return
  window.__sendeskMockInstalled = true

  const nativeFetch = window.fetch.bind(window)
  window.__sendeskMockNativeFetch = nativeFetch

  ensureAutoLogin()
  startTicker()

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input)
    const method = (init?.method || "GET").toUpperCase()
    const pathname = stripApiPrefix(url.pathname)
    const match = matchRoute(method, pathname)

    if (!match) {
      return nativeFetch(input, init)
    }

    const headers = new Headers(init?.headers)
    const body = await parseBody(init)

    const ctx: RequestCtx = {
      method,
      pathname,
      params: match.params,
      query: url.searchParams,
      headers,
      body,
      nativeFetch,
    }

    await delay(randomLatencyMs())
    return match.handler(ctx)
  }
}
