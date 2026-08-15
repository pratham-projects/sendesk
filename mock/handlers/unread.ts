import { getDB, saveDB } from "../db"
import { route, type RequestCtx } from "../router"
import { jsonResponse, ok } from "../util"

route("GET", "/unread/", async () => {
  return ok(getDB().unread)
})

route("DELETE", "/unread/ticket/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  db.unread = db.unread.filter((u) => u.ticketId !== ctx.params.id)
  saveDB()
  // apiClient always calls response.json() — an empty 204 body would throw there.
  return jsonResponse({}, 200)
})

export {}
