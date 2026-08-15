/**
 * Deterministic seed data. Expanded from the upstream (dead-code) lib/mock-data.ts
 * shape into the shapes lib/api/*.ts + lib/store.ts actually expect.
 * Every customer, company and domain below is invented for this demo.
 */

import { Rng } from "./rng"
import type {
  AgentRecord,
  AttachmentRecord,
  ClientRecord,
  DemoDB,
  EmailResponseRecord,
  MessageRecord,
  ProjectMemberRecord,
  ProjectRecord,
  TemplateRecord,
  TicketRecord,
  TicketStatus,
  UnreadRecord,
} from "./schema"

const SEED = 1337
const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString()
}

// ---------------------------------------------------------------------------
// Agents (the support team)
// ---------------------------------------------------------------------------

export const DEMO_AGENTS: AgentRecord[] = [
  {
    id: "agent_priya",
    email: "priya@sendesk-demo.dev",
    name: "Priya Shah",
    role: "admin",
    password: "demodemo123",
    phone: "+1 415-555-0148",
    timezone: "America/Los_Angeles",
    avatarUrl: null,
    createdAt: iso(240 * DAY),
    updatedAt: iso(1 * DAY),
  },
  {
    id: "agent_marcus",
    email: "marcus@sendesk-demo.dev",
    name: "Marcus Webb",
    role: "agent",
    password: "demodemo123",
    phone: "+1 646-555-0117",
    timezone: "America/New_York",
    avatarUrl: null,
    createdAt: iso(190 * DAY),
    updatedAt: iso(2 * DAY),
  },
  {
    id: "agent_elena",
    email: "elena@sendesk-demo.dev",
    name: "Elena Cho",
    role: "agent",
    password: "demodemo123",
    phone: "+1 312-555-0182",
    timezone: "America/Chicago",
    avatarUrl: null,
    createdAt: iso(150 * DAY),
    updatedAt: iso(3 * DAY),
  },
]

// ---------------------------------------------------------------------------
// Projects (invented products — no real client names)
// ---------------------------------------------------------------------------

export const DEMO_PROJECTS: ProjectRecord[] = [
  {
    id: "proj_nimbus",
    name: "Nimbus Docs",
    slug: "nimbus-docs",
    domain: "nimbusdocs.example",
    description: "Cloud document collaboration suite",
    status: "active",
    apiKey: "key_demo_nimbus_7f2a9c1e",
    ownerUserId: "agent_priya",
    replyToEmail: "support@nimbusdocs.example",
    smtpEmail: "support@nimbusdocs.example",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpPassword: "demo-app-password",
    createdAt: iso(240 * DAY),
    updatedAt: iso(20 * DAY),
  },
  {
    id: "proj_brightleaf",
    name: "Brightleaf Market",
    slug: "brightleaf-market",
    domain: "brightleafmarket.example",
    description: "Storefront and checkout for an independent grocer network",
    status: "active",
    apiKey: "key_demo_brightleaf_5b3d7f42",
    ownerUserId: "agent_priya",
    replyToEmail: "help@brightleafmarket.example",
    smtpEmail: "help@brightleafmarket.example",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpPassword: "demo-app-password",
    createdAt: iso(210 * DAY),
    updatedAt: iso(12 * DAY),
  },
  {
    id: "proj_pixelforge",
    name: "Pixel Forge Studio",
    slug: "pixel-forge-studio",
    domain: "pixelforgestudio.example",
    description: "Design-tool SaaS for small creative teams",
    status: "active",
    apiKey: "key_demo_pixelforge_9a1e6d20",
    ownerUserId: "agent_priya",
    replyToEmail: "care@pixelforgestudio.example",
    smtpEmail: "care@pixelforgestudio.example",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpPassword: "demo-app-password",
    createdAt: iso(150 * DAY),
    updatedAt: iso(8 * DAY),
  },
]

export const DEMO_PROJECT_MEMBERS: ProjectMemberRecord[] = DEMO_PROJECTS.flatMap((p, pi) =>
  DEMO_AGENTS.map((a, ai) => ({
    id: `pm_${p.id}_${a.id}`,
    projectId: p.id,
    userId: a.id,
    role: (a.role === "admin" ? "admin" : "agent") as "admin" | "agent",
    shouldNotify: (pi + ai) % 2 === 0,
    canViewAllTickets: true,
    canManageTemplates: a.role === "admin",
    createdAt: iso(140 * DAY),
    updatedAt: iso(140 * DAY),
  })),
)

// ---------------------------------------------------------------------------
// Canned response templates
// ---------------------------------------------------------------------------

export const DEMO_TEMPLATES: TemplateRecord[] = [
  {
    id: "tpl_greeting",
    title: "Greeting",
    body: "Hi there — thanks for reaching out! I'm looking into this now and will follow up shortly.",
    createdAt: iso(200 * DAY),
    updatedAt: iso(200 * DAY),
  },
  {
    id: "tpl_more_info",
    title: "Request more info",
    body: "Could you share a screenshot or the exact error message you're seeing? That'll help us pin this down faster.",
    createdAt: iso(200 * DAY),
    updatedAt: iso(200 * DAY),
  },
  {
    id: "tpl_resolved",
    title: "Issue resolved",
    body: "Glad we could sort that out! Let us know if anything else comes up — we're always happy to help.",
    createdAt: iso(200 * DAY),
    updatedAt: iso(200 * DAY),
  },
  {
    id: "tpl_escalation",
    title: "Escalating to engineering",
    body: "This looks like it needs a closer look from our engineering team. I've flagged it internally and will update you within 24-48 hours.",
    createdAt: iso(180 * DAY),
    updatedAt: iso(180 * DAY),
  },
  {
    id: "tpl_password_reset",
    title: "Password reset",
    body: "I've sent a fresh password reset link to your account email. It should land within a couple of minutes — don't forget to check spam.",
    createdAt: iso(180 * DAY),
    updatedAt: iso(180 * DAY),
  },
  {
    id: "tpl_refund",
    title: "Refund processed",
    body: "Your refund has been processed and should appear on your original payment method within 5-7 business days.",
    createdAt: iso(160 * DAY),
    updatedAt: iso(160 * DAY),
  },
  {
    id: "tpl_followup",
    title: "Checking in",
    body: "Just checking in — were you able to try the steps above? Happy to hop on a call if it's easier to walk through together.",
    createdAt: iso(120 * DAY),
    updatedAt: iso(120 * DAY),
  },
]

// ---------------------------------------------------------------------------
// Email auto-responses
// ---------------------------------------------------------------------------

export const DEMO_EMAIL_RESPONSES: EmailResponseRecord[] = DEMO_PROJECTS.flatMap((p) => [
  {
    id: `er_${p.id}_created`,
    projectId: p.id,
    status: "created" as const,
    subject: "",
    body: `Your ticket has been received by the ${p.name} Team!\n\nWe'll get back to you as soon as possible.\n\nThanks and Regards,\n${p.name} Team`,
    isEnabled: true,
    createdAt: iso(200 * DAY),
    updatedAt: iso(200 * DAY),
  },
  {
    id: `er_${p.id}_resolved`,
    projectId: p.id,
    status: "resolved" as const,
    subject: "",
    body: `Your ticket has been resolved by the ${p.name} Team!\n\nIf anything else comes up, just reply to this email.\n\nThanks and Regards,\n${p.name} Team`,
    isEnabled: true,
    createdAt: iso(200 * DAY),
    updatedAt: iso(200 * DAY),
  },
])

// ---------------------------------------------------------------------------
// Customers (all invented)
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Jordan", "Casey", "Riley", "Morgan", "Avery", "Quinn", "Rowan", "Sasha",
  "Dana", "Taylor", "Reese", "Hayden", "Emerson", "Skyler", "Drew", "Jamie",
  "Kendall", "Parker", "Blake", "Frankie", "Micah", "Nora", "Theo", "Wren",
  "Imani", "Priyanka", "Lucas", "Mateo", "Yuki", "Sofia", "Amara", "Diego",
]
const LAST_NAMES = [
  "Whitfield", "Okafor", "Marsh", "Delgado", "Lindqvist", "Novak", "Reyes",
  "Callahan", "Fontaine", "Abara", "Solheim", "Petrova", "Yamada", "Brandt",
  "Kowalski", "Alavi", "Duarte", "Sundberg", "Mercer", "Osei", "Rutherford",
  "Falk", "Ibarra", "Chapelle", "Voss", "Nakamura", "Hollis", "Tremblay",
]
const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "proton.me", "icloud.com", "fastmail.com"]

function makeClient(rng: Rng, idx: number): ClientRecord {
  const first = rng.pick(FIRST_NAMES)
  const last = rng.pick(LAST_NAMES)
  const domain = rng.pick(EMAIL_DOMAINS)
  const handle = `${first}.${last}${rng.int(1, 98)}`.toLowerCase()
  return {
    id: `client_${idx}_${first.toLowerCase()}${last.toLowerCase()}`,
    name: `${first} ${last}`,
    email: `${handle}@${domain}`,
  }
}

// ---------------------------------------------------------------------------
// Ticket scenarios — grouped by project, each with a realistic thread
// ---------------------------------------------------------------------------

interface Scenario {
  project: string
  subject: string
  priority: "low" | "normal" | "high" | "urgent"
  thread: Array<{ from: "client" | "agent"; body: string; internal?: boolean }>
  finalStatus: TicketStatus
  attachment?: "screenshot" | "photo" | "gif" | "pdf" | "settings"
}

const SCENARIOS: Scenario[] = [
  {
    project: "proj_nimbus",
    subject: "Cannot export document as PDF",
    priority: "normal",
    thread: [
      { from: "client", body: "Every time I hit 'Export to PDF' on a shared doc, the button spins forever and nothing downloads. Tried Chrome and Firefox." },
      { from: "agent", body: "Thanks for flagging this — could you tell me roughly how large the document is (page count) and whether it has any embedded images?" },
      { from: "client", body: "It's about 40 pages with maybe a dozen screenshots pasted in." },
      { from: "agent", body: "That matches a known issue with large embedded images timing out the export worker. I've re-queued your export manually and it should land in your downloads folder shortly — let me know if it doesn't." },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_nimbus",
    subject: "Real-time cursor not showing for teammate",
    priority: "low",
    thread: [
      { from: "client", body: "When my coworker is editing the same doc, I don't see their cursor or selection highlight anymore. Used to work fine last week." },
      { from: "agent", body: "Sorry about that! Could you both try a hard refresh (Cmd+Shift+R) and let me know if that brings it back?" },
      { from: "client", body: "Yep, that fixed it. Must have been a stale service worker or something." },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_nimbus",
    subject: "Feature request: dark mode for the editor",
    priority: "low",
    thread: [
      { from: "client", body: "Would love a dark theme for the document editor — I do most of my writing at night and the white background is rough on the eyes." },
      { from: "agent", body: "Great news — dark mode shipped in our latest release! You can enable it under Settings > Appearance." },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_nimbus",
    subject: "Workspace invite link expired immediately",
    priority: "high",
    thread: [
      { from: "client", body: "I generated an invite link for a new teammate and it says 'expired' the moment they click it, less than a minute after I created it." },
      { from: "agent", body: "That's not expected — invite links should be valid for 7 days. Can you send me the workspace ID so I can check the logs?" },
      { from: "client", body: "Workspace ID is nd-8842. This is blocking us from onboarding two new hires today, so any urgency helps." },
      { from: "agent", body: "Found it — there was a clock-skew bug on our invite service for workspaces created before March. Escalating to engineering now.", internal: false },
      { from: "agent", body: "Escalated. Workspace nd-8842 has a stale timezone offset stored — engineering ticket ENG-4471 filed.", internal: true },
    ],
    finalStatus: "in_progress",
  },
  {
    project: "proj_nimbus",
    subject: "Billing shows two charges for the same month",
    priority: "urgent",
    thread: [
      { from: "client", body: "My card was charged twice this month for the Team plan — $89 on the 1st and again $89 on the 3rd. Can you refund the duplicate?" },
      { from: "agent", body: "Sorry for the trouble — I can see both charges on your account. Refunding the duplicate now." },
      { from: "agent", body: "Refund processed. It should appear on your statement within 5-7 business days — happy to follow up if it doesn't." },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_nimbus",
    subject: "Comment notifications arriving hours late",
    priority: "normal",
    thread: [
      { from: "client", body: "Getting @mention email notifications 3-4 hours after the comment was actually posted. Slack notifications seem instant though." },
      { from: "agent", body: "Thanks for the detail — could you confirm which email address you have notifications routed to, so I can check the delivery queue?" },
    ],
    finalStatus: "pending",
  },
  {
    project: "proj_nimbus",
    subject: "How do I transfer workspace ownership?",
    priority: "low",
    thread: [
      { from: "client", body: "I'm heading to a new role and need to hand off ownership of our team workspace. What's the process?" },
      { from: "agent", body: "You can do this yourself under Settings > Members — click the ... menu next to the new owner's name and choose 'Transfer ownership'. Let me know if you don't see that option and I'll do it from our side." },
      { from: "client", body: "Found it, thank you!" },
    ],
    finalStatus: "closed",
  },
  {
    project: "proj_nimbus",
    subject: "Attaching a screenshot of the export bug",
    priority: "normal",
    attachment: "screenshot",
    thread: [
      { from: "client", body: "Here's a screenshot of the error toast that shows up when the export fails." },
      { from: "agent", body: "Thanks — that error code (EXP-503) points to a template rendering issue. Fixing now, will confirm once it's live." },
    ],
    finalStatus: "in_progress",
  },
  {
    project: "proj_brightleaf",
    subject: "Payment declined at checkout despite valid card",
    priority: "high",
    thread: [
      { from: "client", body: "My order keeps getting declined at checkout. I've tried two different cards, both work fine everywhere else." },
      { from: "agent", body: "Sorry about that! Could you share the last 4 digits of one of the cards and roughly what time you tried, so I can check the payment logs?" },
      { from: "client", body: "Ends in 4417, tried around 2:15pm today." },
      { from: "agent", body: "Found it — our payment processor flagged the transaction for manual review due to an address mismatch. I've cleared it, please try again." },
      { from: "client", body: "That worked, thank you!" },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_brightleaf",
    subject: "Order #10432 never arrived",
    priority: "urgent",
    thread: [
      { from: "client", body: "I placed order #10432 twelve days ago and the tracking hasn't updated in a week. It's stuck at 'label created'." },
      { from: "agent", body: "I'm so sorry about the delay — let me check with our fulfillment partner and get back to you today." },
      { from: "agent", body: "Following up internally with warehouse team re: order #10432, tracking has been stuck since the 4th.", internal: true },
      { from: "agent", body: "Update: the package was lost in transit. We're shipping a free replacement today with expedited delivery, and refunding your original shipping cost." },
    ],
    finalStatus: "in_progress",
  },
  {
    project: "proj_brightleaf",
    subject: "Discount code not applying at checkout",
    priority: "normal",
    thread: [
      { from: "client", body: "Trying to use code WELCOME10 but it says 'invalid code' even though I got it from your newsletter this morning." },
      { from: "agent", body: "That code is scoped to first-time customers only — looks like your account has an order from last year. I've manually applied a 10% discount to your current cart instead." },
      { from: "client", body: "Appreciate it, thanks for the quick fix!" },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_brightleaf",
    subject: "Refund request for damaged item",
    priority: "high",
    attachment: "photo",
    thread: [
      { from: "client", body: "The produce box arrived with the bottom completely soaked through and half the items crushed. Photo attached." },
      { from: "agent", body: "That's really disappointing to see, I'm sorry. Processing a full refund for this order right now, no need to return anything." },
      { from: "agent", body: "Refund processed. It should appear on your statement within 5-7 business days." },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_brightleaf",
    subject: "Can I change my delivery day?",
    priority: "low",
    thread: [
      { from: "client", body: "My weekly delivery is set for Tuesdays but I'm rarely home then. Can I switch to Saturdays?" },
      { from: "agent", body: "Yep — I've updated your subscription to Saturday deliveries starting next week." },
    ],
    finalStatus: "closed",
  },
  {
    project: "proj_brightleaf",
    subject: "Duplicate charge on my invoice",
    priority: "urgent",
    thread: [
      { from: "client", body: "My last invoice shows a charge of $99 but I'm on the $49/week plan. Can you look into this?" },
      { from: "agent", body: "Checking now — I can confirm this was a billing system glitch that double-counted one delivery. Refunding the $50 difference." },
    ],
    finalStatus: "in_progress",
  },
  {
    project: "proj_brightleaf",
    subject: "Substitution policy question",
    priority: "low",
    thread: [
      { from: "client", body: "If an item is out of stock, do you automatically substitute it or skip it?" },
      { from: "agent", body: "By default we substitute with a similar item, but you can turn that off under Preferences > Substitutions if you'd rather we just skip out-of-stock items." },
      { from: "client", body: "Perfect, turning that off now. Thanks!" },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_brightleaf",
    subject: "Account locked after failed logins",
    priority: "normal",
    thread: [
      { from: "client", body: "I mistyped my password a few times and now it says my account is locked for 24 hours. Can you unlock it sooner? I have a delivery today." },
      { from: "agent", body: "Unlocked your account just now — you should be able to log back in immediately." },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_brightleaf",
    subject: "Where do I update my delivery address?",
    priority: "low",
    thread: [
      { from: "client", body: "Moved apartments last week, where do I update my delivery address?" },
      { from: "agent", body: "Account > Addresses > Edit. Let me know if you don't see the option and I'll update it manually." },
    ],
    finalStatus: "pending",
  },
  {
    project: "proj_pixelforge",
    subject: "App crashes when importing large PSD file",
    priority: "high",
    attachment: "screenshot",
    thread: [
      { from: "client", body: "Importing a 2GB PSD file crashes the whole app after about 30 seconds. Screenshot of the crash dialog attached." },
      { from: "agent", body: "Thanks for the report and the screenshot. Could you tell me your OS and app version (Help > About)?" },
      { from: "client", body: "macOS Sonoma, app version 4.2.1." },
      { from: "agent", body: "Reproduced on our end — filing with engineering as a memory-limit issue on large PSD imports.", internal: true },
      { from: "agent", body: "This is a known limitation we're actively working on for files over 1.5GB. In the meantime, flattening layers in Photoshop before import should avoid the crash. I'll update this ticket when the fix ships." },
    ],
    finalStatus: "in_progress",
  },
  {
    project: "proj_pixelforge",
    subject: "How do I export assets at 2x resolution?",
    priority: "low",
    thread: [
      { from: "client", body: "Is there a way to batch export all my artboards at 2x for retina displays?" },
      { from: "agent", body: "Yes — select all artboards, then Export > Batch Export, and set the scale dropdown to 2x before confirming." },
      { from: "client", body: "That's exactly what I needed, thank you!" },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_pixelforge",
    subject: "Team seats billing question",
    priority: "normal",
    thread: [
      { from: "client", body: "We removed two team members last month but our invoice still shows the old seat count. Is billing not syncing automatically?" },
      { from: "agent", body: "Seat changes take effect at the next billing cycle rather than immediately — that's intentional to avoid mid-cycle proration issues, but I can see the removal is queued correctly for next month's invoice." },
    ],
    finalStatus: "pending",
  },
  {
    project: "proj_pixelforge",
    subject: "Cannot reset password — reset email never arrives",
    priority: "high",
    thread: [
      { from: "client", body: "I've requested a password reset four times now and never get the email. Checked spam too." },
      { from: "agent", body: "I've manually triggered a reset link from our end and confirmed it was sent successfully — could you check again in a few minutes?" },
      { from: "client", body: "Got it this time, thanks!" },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_pixelforge",
    subject: "Font not rendering correctly after update",
    priority: "normal",
    thread: [
      { from: "client", body: "After the latest update, one of our custom uploaded fonts is rendering with the wrong weight everywhere in the project." },
      { from: "agent", body: "Could you share the project ID and font name? Want to check if it's a caching issue on our font pipeline." },
      { from: "client", body: "Project ID pf-2291, font is 'Inter Tight SemiBold'." },
      { from: "agent", body: "Confirmed a caching bug on custom font weights introduced in the last release. Escalating to engineering.", internal: true },
    ],
    finalStatus: "in_progress",
  },
  {
    project: "proj_pixelforge",
    subject: "Feature request: version history for components",
    priority: "low",
    thread: [
      { from: "client", body: "Would be amazing to have version history specifically for shared components, not just whole files." },
      { from: "agent", body: "Really good suggestion — I've passed this along to our product team as a feature request. No timeline yet, but I'll update this ticket if it gets scheduled." },
    ],
    finalStatus: "closed",
  },
  {
    project: "proj_pixelforge",
    subject: "Integration webhook not firing on publish",
    priority: "urgent",
    attachment: "pdf",
    thread: [
      { from: "client", body: "Our Slack integration webhook stopped firing on publish events three days ago. No changes on our end. Attaching our webhook config export." },
      { from: "agent", body: "Thanks for attaching the config — that helps a lot. Checking the webhook delivery logs now." },
      { from: "agent", body: "Found repeated 522 timeouts from your endpoint over the last 3 days — looks like it might be on your receiving server's end rather than ours, but I'll keep digging in parallel." },
    ],
    finalStatus: "in_progress",
  },
  {
    project: "proj_pixelforge",
    subject: "Trial extension request",
    priority: "low",
    thread: [
      { from: "client", body: "Our trial ends tomorrow but our team eval hasn't wrapped up yet — any chance of a short extension?" },
      { from: "agent", body: "No problem, extended your trial by two weeks. Let us know if you need more time after that." },
    ],
    finalStatus: "resolved",
  },
  {
    project: "proj_pixelforge",
    subject: "Animated GIF export looks choppy",
    priority: "normal",
    attachment: "gif",
    thread: [
      { from: "client", body: "Exported GIF looks way choppier than the in-app preview. Attached the exported file for reference." },
      { from: "agent", body: "That's usually a frame-rate mismatch between preview (60fps) and export (defaults to 24fps). Try bumping the export frame rate in Export Settings > Advanced." },
    ],
    finalStatus: "pending",
  },
]

// Extra short/simple tickets to round out volume across all five statuses.
const FILLER_SUBJECTS: Array<{ project: string; subject: string; status: TicketStatus; priority: "low" | "normal" | "high" | "urgent" }> = [
  { project: "proj_nimbus", subject: "Can't invite more than 10 people to a doc", status: "pending", priority: "normal" },
  { project: "proj_nimbus", subject: "Mobile app keeps logging me out", status: "pending", priority: "normal" },
  { project: "proj_nimbus", subject: "Table formatting breaks when pasting from Excel", status: "in_progress", priority: "normal" },
  { project: "proj_nimbus", subject: "Request: increase file upload limit", status: "closed", priority: "low" },
  { project: "proj_nimbus", subject: "Search isn't finding text inside PDFs", status: "on_hold", priority: "normal" },
  { project: "proj_brightleaf", subject: "Gift card balance not showing correctly", status: "pending", priority: "normal" },
  { project: "proj_brightleaf", subject: "Can I pause my subscription for a month?", status: "resolved", priority: "low" },
  { project: "proj_brightleaf", subject: "Wrong item substituted without notice", status: "on_hold", priority: "normal" },
  { project: "proj_brightleaf", subject: "Loyalty points missing from last order", status: "pending", priority: "normal" },
  { project: "proj_brightleaf", subject: "Delivery driver left package in the rain", status: "closed", priority: "normal" },
  { project: "proj_pixelforge", subject: "Cursor lag when zoomed in past 400%", status: "on_hold", priority: "low" },
  { project: "proj_pixelforge", subject: "Can't undo after applying a filter", status: "pending", priority: "high" },
  { project: "proj_pixelforge", subject: "Shared library not syncing across projects", status: "in_progress", priority: "normal" },
  { project: "proj_pixelforge", subject: "Keyboard shortcuts reset after update", status: "closed", priority: "low" },
  { project: "proj_pixelforge", subject: "Comment threads disappear after resolving", status: "pending", priority: "normal" },
]

const GENERIC_OPENERS = [
  "Running into an issue and wanted to flag it before it gets worse.",
  "Not sure if this is expected behavior, but figured I'd ask.",
  "Second time this has happened this week, could use some help.",
  "Quick question, hoping this is a simple fix.",
]
const GENERIC_AGENT_ACK = [
  "Thanks for reaching out — taking a look now.",
  "Appreciate the detail, I'll dig into this and get back to you shortly.",
  "Got it, looking into this on our end.",
]

function buildAttachment(
  rng: Rng,
  ticketId: string,
  kind: NonNullable<Scenario["attachment"]>,
): AttachmentRecord {
  const files: Record<string, { file: string; mime: string }> = {
    screenshot: rng.bool()
      ? { file: "screenshot-error.png", mime: "image/png" }
      : { file: "screenshot-dashboard.png", mime: "image/png" },
    photo: { file: "photo-receipt.jpg", mime: "image/jpeg" },
    settings: { file: "screenshot-settings.jpg", mime: "image/jpeg" },
    gif: { file: "demo-animation.gif", mime: "image/gif" },
    pdf: { file: "invoice-copy.pdf", mime: "application/pdf" },
  }
  const { file, mime } = files[kind]
  return {
    id: rng.id("att"),
    ticketId,
    filename: file,
    mimeType: mime,
    src: `/attachments/${file}`,
  }
}

export function buildInitialDB(): DemoDB {
  const rng = new Rng(SEED)

  const clients: ClientRecord[] = []
  const usedNames = new Set<string>()
  function nextClient(): ClientRecord {
    let c = makeClient(rng, clients.length)
    let guard = 0
    while (usedNames.has(c.email) && guard < 10) {
      c = makeClient(rng, clients.length + guard)
      guard++
    }
    usedNames.add(c.email)
    clients.push(c)
    return c
  }

  const tickets: TicketRecord[] = []
  const messages: MessageRecord[] = []
  const attachments: Record<string, AttachmentRecord> = {}
  const unread: UnreadRecord[] = []
  let ticketNumber = 1001

  function statusAge(status: TicketStatus): number {
    switch (status) {
      case "pending":
        return rng.int(1, 36) // hours-ish, converted below
      case "in_progress":
        return rng.int(2, 96)
      case "on_hold":
        return rng.int(24, 200)
      case "resolved":
        return rng.int(48, 400)
      case "closed":
        return rng.int(72, 900)
    }
  }

  function pushThread(
    ticketId: string,
    projectId: string,
    client: ClientRecord,
    thread: Scenario["thread"],
    startedMsAgo: number,
    attachment?: AttachmentRecord,
  ) {
    let cursor = startedMsAgo
    thread.forEach((m, i) => {
      cursor -= rng.int(15, 90) * 60 * 1000 // 15-90 min between messages, converging toward "now"
      if (cursor < 0) cursor = Math.max(0, startedMsAgo - (thread.length - i) * 5 * 60 * 1000)
      const agent = rng.pick(DEMO_AGENTS.filter((a) => a.role !== "admin").concat(rng.bool(0.2) ? [DEMO_AGENTS[0]] : []))
      const isLast = i === thread.length - 1
      messages.push({
        id: `${ticketId}_msg_${i}`,
        ticketId,
        senderType: m.from,
        senderUserId: m.from === "agent" ? agent.id : null,
        senderEmail: m.from === "agent" ? agent.email : client.email,
        senderName: m.from === "agent" ? agent.name : client.name,
        body: m.body,
        isInternal: !!m.internal,
        attachmentIds: isLast && attachment && m.from === "client" ? [attachment.id] : attachment && i === 0 ? [attachment.id] : [],
        createdAt: iso(cursor),
      })
    })
  }

  function addTicket(
    project: string,
    subject: string,
    priority: "low" | "normal" | "high" | "urgent",
    status: TicketStatus,
    thread: Scenario["thread"],
    attachmentKind?: Scenario["attachment"],
  ) {
    const client = nextClient()
    const id = rng.id("ticket")
    const ageHours = statusAge(status)
    const startedMsAgo = ageHours * 60 * 60 * 1000
    const description = thread[0]?.body ?? subject

    let attachment: AttachmentRecord | undefined
    if (attachmentKind) {
      attachment = buildAttachment(rng, id, attachmentKind)
      attachments[attachment.id] = attachment
    }

    tickets.push({
      id,
      ticketNumber: ticketNumber++,
      projectId: project,
      clientId: client.id,
      subject,
      description,
      status,
      priority,
      assignedToUserId: status === "pending" ? null : rng.pick(DEMO_AGENTS).id,
      createdAt: iso(startedMsAgo),
      updatedAt: iso(Math.max(0, startedMsAgo - thread.length * 20 * 60 * 1000)),
    })

    pushThread(id, project, client, thread, startedMsAgo, attachment)

    // Open tickets get a plausible chance of an unread client reply.
    if ((status === "pending" || status === "in_progress" || status === "on_hold") && rng.bool(0.45)) {
      unread.push({ id: rng.id("unread"), ticketId: id, projectId: project })
    }
  }

  for (const s of SCENARIOS) {
    addTicket(s.project, s.subject, s.priority, s.finalStatus, s.thread, s.attachment)
  }

  for (const f of FILLER_SUBJECTS) {
    const opener = rng.pick(GENERIC_OPENERS)
    const ack = rng.pick(GENERIC_AGENT_ACK)
    const thread: Scenario["thread"] =
      f.status === "pending"
        ? [{ from: "client", body: opener }]
        : [
            { from: "client", body: opener },
            { from: "agent", body: ack },
          ]
    addTicket(f.project, f.subject, f.priority, f.status, thread)
  }

  return {
    agents: DEMO_AGENTS,
    projects: DEMO_PROJECTS,
    projectMembers: DEMO_PROJECT_MEMBERS,
    clients,
    tickets,
    messages,
    templates: DEMO_TEMPLATES,
    emailResponses: DEMO_EMAIL_RESPONSES,
    unread,
    attachments,
    refreshTokens: {},
    meta: {
      nextTicketNumber: ticketNumber,
      seedVersion: 3,
    },
  }
}

export { SEED as SEED_VALUE }
