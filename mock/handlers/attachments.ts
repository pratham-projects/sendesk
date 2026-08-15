import { getDB, saveDB } from "../db"
import { route, type RequestCtx } from "../router"
import { errorResponse, runtimeId } from "../util"
import type { MessageRecord } from "../schema"

route("GET", "/attachments/file/:id", async (ctx: RequestCtx) => {
  const db = getDB()
  const att = db.attachments[ctx.params.id]
  if (!att) return errorResponse("Attachment not found", 404)

  // Uploaded-in-session files are already a blob: object URL; seeded files are
  // static assets under public/attachments/ — either way we fetch the real
  // bytes via the native, unpatched fetch and re-wrap them as this handler's
  // response so the attachment viewer gets a genuine Blob to render/download.
  const res = await ctx.nativeFetch(att.src)
  const blob = await res.blob()
  return new Response(blob, {
    status: 200,
    headers: { "Content-Type": att.mimeType || blob.type || "application/octet-stream" },
  })
})

route("PUT", "/attachments/:ticketId", async (ctx: RequestCtx) => {
  const db = getDB()
  const ticket = db.tickets.find((t) => t.id === ctx.params.ticketId)
  if (!ticket) return errorResponse("Ticket not found", 404)

  const file = ctx.body as File
  const filename = ctx.headers.get("X-Filename") || file.name || "attachment"
  const id = runtimeId("att")
  db.attachments[id] = {
    id,
    ticketId: ticket.id,
    filename,
    mimeType: file.type || "application/octet-stream",
    src: URL.createObjectURL(file),
  }

  const message: MessageRecord = {
    id: runtimeId("msg"),
    ticketId: ticket.id,
    senderType: "agent",
    body: ctx.headers.get("X-Message") || `Sent an attachment: ${filename}`,
    isInternal: false,
    attachmentIds: [id],
    createdAt: new Date().toISOString(),
  }
  db.messages.push(message)
  ticket.updatedAt = message.createdAt
  saveDB()

  return new Response(JSON.stringify({ attachmentId: id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})

route("POST", "/attachments/:ticketId/multiple", async (ctx: RequestCtx) => {
  const db = getDB()
  const ticket = db.tickets.find((t) => t.id === ctx.params.ticketId)
  if (!ticket) return errorResponse("Ticket not found", 404)

  const fd = ctx.body as FormData
  const files = fd.getAll("files") as File[]
  const message = fd.get("message") ? String(fd.get("message")) : undefined

  const attachmentIds: string[] = []
  for (const file of files) {
    const id = runtimeId("att")
    db.attachments[id] = {
      id,
      ticketId: ticket.id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      src: URL.createObjectURL(file),
    }
    attachmentIds.push(id)
  }

  const msg: MessageRecord = {
    id: runtimeId("msg"),
    ticketId: ticket.id,
    senderType: "agent",
    body: message || `Sent ${files.length} attachment${files.length > 1 ? "s" : ""}`,
    isInternal: false,
    attachmentIds,
    createdAt: new Date().toISOString(),
  }
  db.messages.push(msg)
  ticket.updatedAt = msg.createdAt
  saveDB()

  return new Response(JSON.stringify({ attachmentIds }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})

export {}
