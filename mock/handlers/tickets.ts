import { getDB, saveDB } from "../db"
import { route, type RequestCtx } from "../router"
import { agentFromHeaders } from "../session"
import { errorResponse, ok, paginated, runtimeId } from "../util"
import type { MessageRecord, TicketRecord, TicketStatus } from "../schema"

function serializeTicket(t: TicketRecord) {
  const db = getDB()
  const client = db.clients.find((c) => c.id === t.clientId)
  const project = db.projects.find((p) => p.id === t.projectId)
  const assignedTo = t.assignedToUserId ? db.agents.find((a) => a.id === t.assignedToUserId) : null
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    projectId: t.projectId,
    clientId: t.clientId,
    subject: t.subject,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignedToUserId: t.assignedToUserId ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    client: client ? { id: client.id, email: client.email, name: client.name } : undefined,
    project: project ? { id: project.id, name: project.name } : undefined,
    assignedTo: assignedTo ? { id: assignedTo.id, email: assignedTo.email, name: assignedTo.name } : null,
  }
}

function serializeMessage(m: MessageRecord) {
  return {
    id: m.id,
    ticketId: m.ticketId,
    senderUserId: m.senderUserId ?? null,
    senderType: m.senderType,
    senderEmail: m.senderEmail,
    senderName: m.senderName,
    body: m.body,
    htmlBody: null,
    messageType: "reply",
    isInternal: m.isInternal,
    isPublished: true,
    attachmentIds: m.attachmentIds.map((id) => {
      const db = getDB()
      const att = db.attachments[id]
      return att ? { id: att.id, url: att.src } : { id }
    }),
    createdAt: m.createdAt,
    updatedAt: m.createdAt,
    sender:
      m.senderType === "agent" && m.senderUserId
        ? (() => {
            const a = getDB().agents.find((x) => x.id === m.senderUserId)
            return a ? { id: a.id, email: a.email, name: a.name } : null
          })()
        : null,
  }
}

function computeStats(tickets: TicketRecord[]) {
  const stats = { pending: 0, in_progress: 0, on_hold: 0, resolved: 0, closed: 0, all: 0 }
  for (const t of tickets) {
    stats[t.status]++
    stats.all++
  }
  return stats
}

async function parseMultipart(ctx: RequestCtx) {
  // FormData bodies are handed through as-is by install.ts.
  const fd = ctx.body as FormData
  return {
    projectId: String(fd.get("projectId") ?? ""),
    clientEmail: String(fd.get("clientEmail") ?? ""),
    clientName: fd.get("clientName") ? String(fd.get("clientName")) : undefined,
    subject: String(fd.get("subject") ?? ""),
    description: fd.get("description") ? String(fd.get("description")) : undefined,
    priority: (fd.get("priority") as TicketRecord["priority"]) || "normal",
    files: fd.getAll("files") as File[],
  }
}

async function createTicket(ctx: RequestCtx, opts: { fromAgent: boolean }) {
  const db = getDB()
  const input = await parseMultipart(ctx)

  if (!input.clientEmail || !input.subject) {
    return errorResponse("clientEmail and subject are required", 400)
  }

  let client = db.clients.find((c) => c.email.toLowerCase() === input.clientEmail.toLowerCase())
  if (!client) {
    client = {
      id: runtimeId("client"),
      email: input.clientEmail,
      name: input.clientName?.trim() || input.clientEmail.split("@")[0],
    }
    db.clients.push(client)
  }

  const project = db.projects.find((p) => p.id === input.projectId) ?? db.projects[0]
  const ticket: TicketRecord = {
    id: runtimeId("ticket"),
    ticketNumber: db.meta.nextTicketNumber++,
    projectId: project.id,
    clientId: client.id,
    subject: input.subject,
    description: input.description,
    status: "pending",
    priority: input.priority,
    assignedToUserId: opts.fromAgent ? agentFromHeaders(ctx.headers)?.id ?? null : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.tickets.unshift(ticket)

  const attachmentIds: string[] = []
  for (const file of input.files) {
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

  const message: MessageRecord = {
    id: runtimeId("msg"),
    ticketId: ticket.id,
    senderType: opts.fromAgent ? "agent" : "client",
    senderUserId: opts.fromAgent ? ticket.assignedToUserId : null,
    senderEmail: client.email,
    senderName: client.name,
    body: input.description || input.subject,
    isInternal: false,
    attachmentIds,
    createdAt: ticket.createdAt,
  }
  db.messages.push(message)

  db.unread.push({ id: runtimeId("unread"), ticketId: ticket.id, projectId: project.id })

  saveDB()
  return ok(serializeTicket(ticket))
}

route("POST", "/tickets/admin", (ctx) => createTicket(ctx, { fromAgent: true }))
route("POST", "/tickets", (ctx) => createTicket(ctx, { fromAgent: false }))

route("GET", "/tickets/counts", async () => {
  const db = getDB()
  const projects: Record<string, ReturnType<typeof computeStats>> = {}
  for (const p of db.projects) {
    projects[p.id] = computeStats(db.tickets.filter((t) => t.projectId === p.id))
  }
  return ok({ global: computeStats(db.tickets), projects })
})

route("GET", "/tickets/search", async (ctx) => {
  const db = getDB()
  const q = (ctx.query.get("q") ?? "").toLowerCase()
  const projectId = ctx.query.get("projectId")
  const limit = Number(ctx.query.get("limit") ?? 50)
  let results = db.tickets.filter((t) => {
    if (projectId && t.projectId !== projectId) return false
    if (!q) return true
    const inSubject = t.subject.toLowerCase().includes(q)
    const inDesc = (t.description ?? "").toLowerCase().includes(q)
    const inMessages = db.messages.some((m) => m.ticketId === t.id && m.body.toLowerCase().includes(q))
    return inSubject || inDesc || inMessages
  })
  results = results.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, limit)
  return ok(results.map(serializeTicket))
})

route("GET", "/tickets", async (ctx) => {
  const db = getDB()
  const limit = Number(ctx.query.get("limit") ?? 10)
  const offset = Number(ctx.query.get("offset") ?? 0)
  const status = ctx.query.get("status") as TicketStatus | null
  const projectId = ctx.query.get("projectId")
  const unreadFirst = ctx.query.get("unreadFirst") === "true"

  let items = [...db.tickets]
  if (status) items = items.filter((t) => t.status === status)
  if (projectId) items = items.filter((t) => t.projectId === projectId)

  items.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))

  if (unreadFirst) {
    const unreadIds = new Set(db.unread.map((u) => u.ticketId))
    items.sort((a, b) => Number(unreadIds.has(b.id)) - Number(unreadIds.has(a.id)))
  }

  return paginated(items.map(serializeTicket), limit, offset, {
    stats: computeStats(projectId ? db.tickets.filter((t) => t.projectId === projectId) : db.tickets),
  })
})

route("GET", "/tickets/:id", async (ctx) => {
  const db = getDB()
  const t = db.tickets.find((x) => x.id === ctx.params.id)
  if (!t) return errorResponse("Ticket not found", 404)
  return ok(serializeTicket(t))
})

route("PATCH", "/tickets/:id", async (ctx) => {
  const db = getDB()
  const t = db.tickets.find((x) => x.id === ctx.params.id)
  if (!t) return errorResponse("Ticket not found", 404)
  Object.assign(t, ctx.body ?? {}, { updatedAt: new Date().toISOString() })
  saveDB()
  return ok(serializeTicket(t))
})

route("DELETE", "/tickets/:id", async (ctx) => {
  const db = getDB()
  db.tickets = db.tickets.filter((t) => t.id !== ctx.params.id)
  saveDB()
  return ok({ success: true, id: ctx.params.id })
})

route("GET", "/tickets/:id/messages", async (ctx) => {
  const db = getDB()
  const limit = Number(ctx.query.get("limit") ?? 5)
  const offset = Number(ctx.query.get("offset") ?? 0)
  const all = db.messages
    .filter((m) => m.ticketId === ctx.params.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) // latest first, per upstream contract
  return paginated(all.map(serializeMessage), limit, offset)
})

route("POST", "/tickets/:id/messages", async (ctx) => {
  const db = getDB()
  const ticket = db.tickets.find((t) => t.id === ctx.params.id)
  if (!ticket) return errorResponse("Ticket not found", 404)
  const agent = agentFromHeaders(ctx.headers)
  const body = (ctx.body ?? {}) as { body?: string; isInternal?: boolean }
  if (!body.body) return errorResponse("Message body is required", 400)

  const message: MessageRecord = {
    id: runtimeId("msg"),
    ticketId: ticket.id,
    senderType: "agent",
    senderUserId: agent?.id ?? null,
    senderEmail: agent?.email,
    senderName: agent?.name ?? "Agent",
    body: body.body,
    isInternal: !!body.isInternal,
    attachmentIds: [],
    createdAt: new Date().toISOString(),
  }
  db.messages.push(message)
  ticket.updatedAt = message.createdAt
  saveDB()
  return ok(serializeMessage(message))
})

export {}
