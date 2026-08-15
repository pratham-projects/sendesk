import { getDB, saveDB } from "../db"
import { route, type RequestCtx } from "../router"
import { errorResponse, ok, paginated, runtimeId } from "../util"

route("GET", "/template-responses/search", async (ctx: RequestCtx) => {
  const db = getDB()
  const q = (ctx.query.get("q") ?? "").toLowerCase()
  const limit = Number(ctx.query.get("limit") ?? 50)
  const results = db.templates
    .filter((t) => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q))
    .slice(0, limit)
  return paginated(results, limit, 0)
})

route("GET", "/template-responses/", async (ctx: RequestCtx) => {
  const db = getDB()
  const limit = Number(ctx.query.get("limit") ?? 10)
  const offset = Number(ctx.query.get("offset") ?? 0)
  return paginated(db.templates, limit, offset)
})

route("POST", "/template-responses/", async (ctx: RequestCtx) => {
  const db = getDB()
  const body = (ctx.body ?? {}) as { title: string; body: string }
  const template = {
    id: runtimeId("tpl"),
    title: body.title,
    body: body.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.templates.push(template)
  saveDB()
  return ok(template)
})

route("PATCH", "/template-responses/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  const t = db.templates.find((x) => x.id === ctx.params.id)
  if (!t) return errorResponse("Template not found", 404)
  Object.assign(t, ctx.body ?? {}, { updatedAt: new Date().toISOString() })
  saveDB()
  return ok(t)
})

route("DELETE", "/template-responses/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  db.templates = db.templates.filter((t) => t.id !== ctx.params.id)
  saveDB()
  return ok({ success: true })
})

export {}
