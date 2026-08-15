/**
 * Makes the inbox move on its own. Runs on an interval well inside the app's
 * own 30s unread-poll (app/page.tsx:83) and viewer-fetch (lib/hooks.ts) loops,
 * so upstream code — unmodified — is what actually surfaces the change; this
 * file only mutates the shared db.
 */

import { getDB, saveDB } from "./db"
import { Rng } from "./rng"
import type { MessageRecord, TicketRecord, TicketStatus } from "./schema"

const TICK_MS = 22_000
const OPEN_STATUSES: TicketStatus[] = ["pending", "in_progress", "on_hold"]

const FOLLOW_UP_LINES = [
  "Just wanted to check if there's any update on this?",
  "Still seeing the same issue on my end, unfortunately.",
  "No rush, just following up when you get a chance.",
  "Thanks for looking into it — let me know if you need anything else from me.",
  "This is still happening as of this morning.",
  "Appreciate the help so far!",
  "One more detail that might be relevant: it only happens on mobile.",
  "Any timeline on when this might be fixed?",
]

const NEW_TICKET_SUBJECTS = [
  "Can't log in after changing my email",
  "Question about my recent invoice",
  "Feature isn't working as described",
  "Need help updating account details",
  "Getting an unexpected error message",
  "Request for a callback",
  "Trouble uploading a file",
  "Is there a status page for outages?",
]

const NEW_TICKET_OPENERS = [
  "Hey, running into a problem and hoping you can help.",
  "Not sure who else to ask, so trying support first.",
  "Quick one, but it's blocking me right now.",
  "Sorry if this has been asked before, couldn't find an answer in your docs.",
]

const FIRST_NAMES = ["Nadia", "Trent", "Yara", "Colin", "Priyal", "Boris", "Maëlle", "Kenji", "Ines", "Owen"]
const LAST_NAMES = ["Larkin", "Bosch", "Femi", "Strand", "Kural", "Vasquez", "Renner", "Ito", "Cabral", "Doyle"]
const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "proton.me", "icloud.com"]

let started = false

function addFollowUpMessage(rng: Rng): void {
  const db = getDB()
  const open = db.tickets.filter((t) => OPEN_STATUSES.includes(t.status))
  if (open.length === 0) return
  const ticket = rng.pick(open)

  const message: MessageRecord = {
    id: rng.id("msg"),
    ticketId: ticket.id,
    senderType: "client",
    body: rng.pick(FOLLOW_UP_LINES),
    isInternal: false,
    attachmentIds: [],
    createdAt: new Date().toISOString(),
  }
  db.messages.push(message)
  ticket.updatedAt = message.createdAt

  if (!db.unread.some((u) => u.ticketId === ticket.id)) {
    db.unread.push({ id: rng.id("unread"), ticketId: ticket.id, projectId: ticket.projectId })
  }
  saveDB()
}

function addNewTicket(rng: Rng): void {
  const db = getDB()
  const project = rng.pick(db.projects)
  const first = rng.pick(FIRST_NAMES)
  const last = rng.pick(LAST_NAMES)
  const client = {
    id: rng.id("client"),
    name: `${first} ${last}`,
    email: `${first}.${last}${rng.int(1, 77)}`.toLowerCase() + `@${rng.pick(EMAIL_DOMAINS)}`,
  }
  db.clients.push(client)

  const ticket: TicketRecord = {
    id: rng.id("ticket"),
    ticketNumber: db.meta.nextTicketNumber++,
    projectId: project.id,
    clientId: client.id,
    subject: rng.pick(NEW_TICKET_SUBJECTS),
    description: rng.pick(NEW_TICKET_OPENERS),
    status: "pending",
    priority: rng.bool(0.15) ? "high" : "normal",
    assignedToUserId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.tickets.unshift(ticket)

  db.messages.push({
    id: rng.id("msg"),
    ticketId: ticket.id,
    senderType: "client",
    senderEmail: client.email,
    senderName: client.name,
    body: ticket.description!,
    isInternal: false,
    attachmentIds: [],
    createdAt: ticket.createdAt,
  })

  db.unread.push({ id: rng.id("unread"), ticketId: ticket.id, projectId: project.id })
  saveDB()
}

export function startTicker(): void {
  if (started || typeof window === "undefined") return
  started = true

  const rng = new Rng(Date.now())

  setInterval(() => {
    const roll = rng.next()
    if (roll < 0.4) {
      addFollowUpMessage(rng)
    } else if (roll < 0.6) {
      addNewTicket(rng)
    }
    // else: quiet tick, nothing changes — real inboxes aren't nonstop either.
  }, TICK_MS)
}
