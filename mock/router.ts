export interface RequestCtx {
  method: string
  /** pathname with the /api/v{n} prefix already stripped, e.g. "/tickets/abc/messages" */
  pathname: string
  params: Record<string, string>
  query: URLSearchParams
  headers: Headers
  body: unknown // parsed JSON body, or FormData for multipart requests, or null
  nativeFetch: typeof fetch
}

export type RouteHandler = (ctx: RequestCtx) => Promise<Response> | Response

interface Route {
  method: string
  segments: string[]
  handler: RouteHandler
}

const routes: Route[] = []

function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean)
}

/** Register a route. More specific (literal) routes must be registered before
 *  routes with a param in the same position — the router tries registration
 *  order and returns the first structural match. */
export function route(method: string, path: string, handler: RouteHandler): void {
  routes.push({ method: method.toUpperCase(), segments: splitPath(path), handler })
}

export function matchRoute(
  method: string,
  pathname: string,
): { handler: RouteHandler; params: Record<string, string> } | null {
  const segs = splitPath(pathname)
  for (const r of routes) {
    if (r.method !== method.toUpperCase()) continue
    if (r.segments.length !== segs.length) continue
    const params: Record<string, string> = {}
    let matched = true
    for (let i = 0; i < segs.length; i++) {
      const rs = r.segments[i]
      if (rs.startsWith(":")) {
        params[rs.slice(1)] = decodeURIComponent(segs[i])
      } else if (rs !== segs[i]) {
        matched = false
        break
      }
    }
    if (matched) return { handler: r.handler, params }
  }
  return null
}

/** Strips a leading /api/v{n} prefix (any version number) from a pathname. */
export function stripApiPrefix(pathname: string): string {
  return pathname.replace(/^\/api\/v\d+/, "") || "/"
}
