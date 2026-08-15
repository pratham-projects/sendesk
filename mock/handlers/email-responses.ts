import { getDB, saveDB } from "../db"
import { route, type RequestCtx } from "../router"
import { errorResponse, ok } from "../util"
import { runtimeId } from "../util"

route("GET", "/email-responses/", async (ctx: RequestCtx) => {
  const db = getDB()
  const projectId = ctx.query.get("projectId")
  const items = projectId ? db.emailResponses.filter((r) => r.projectId === projectId) : db.emailResponses
  return ok(items)
})

route("POST", "/email-responses", async (ctx: RequestCtx) => {
  const db = getDB()
  const body = (ctx.body ?? {}) as {
    projectId: string
    status: "created" | "resolved"
    body: string
    isEnabled?: boolean
  }
  const record = {
    id: runtimeId("er"),
    projectId: body.projectId,
    status: body.status,
    subject: "",
    body: body.body,
    isEnabled: body.isEnabled ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.emailResponses.push(record)
  saveDB()
  return ok(record)
})

route("PATCH", "/email-responses/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  const r = db.emailResponses.find((x) => x.id === ctx.params.id)
  if (!r) return errorResponse("Email response not found", 404)
  Object.assign(r, ctx.body ?? {}, { updatedAt: new Date().toISOString() })
  saveDB()
  return ok(r)
})

export {}
