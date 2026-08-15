import { Rng } from "./rng"

// Runtime rng — reseeded from wall clock so live-created records (new tickets,
// replies, viewers) don't repeat the exact same "random" pattern every load,
// while the initial seed data (mock/seed.ts) stays fully deterministic.
const runtimeRng = new Rng(Date.now())

export function runtimeId(prefix: string): string {
  return runtimeRng.id(prefix)
}

export function randomLatencyMs(): number {
  return 120 + Math.floor(runtimeRng.next() * 230) // 120-350ms, per plan §3
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function ok<T extends object>(data: T): Response {
  return jsonResponse({ data })
}

export function paginated<T>(
  items: T[],
  limit: number,
  offset: number,
  extra?: Record<string, unknown>,
): Response {
  const page = items.slice(offset, offset + limit)
  return jsonResponse({
    data: page,
    pagination: {
      total: items.length,
      limit,
      offset,
      hasMore: offset + limit < items.length,
    },
    ...extra,
  })
}

export function errorResponse(message: string, status = 400, code?: string): Response {
  return jsonResponse({ error: { message, code: code ?? "DEMO_ERROR" } }, status)
}

/** A structurally JWT-shaped but entirely inert demo token — never a real signing key. */
export function fakeAccessToken(agentId: string): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "demo" }))
  const payload = btoa(JSON.stringify({ sub: agentId, demo: true, iat: Date.now() }))
  return `demo.${header}.${payload}`
}

export function fakeRefreshToken(): string {
  return `demo_refresh_${runtimeRng.id("rt")}`
}
