# SendDesk

A portfolio build of **SendDesk**, a multi-tenant support-ticket inbox: a shared queue
across projects, threaded conversations, canned responses, live viewer presence, and an
embeddable customer-facing widget. Frontend-only extraction — see `UPSTREAM.md`.

**Demo — sample data, no backend.** Every screen runs against an in-memory mock API
(`mock/`) that intercepts `fetch` itself rather than swapping out the app's real HTTP
client, so the actual request/response path — retries, token refresh, loading states,
optimistic UI — all still runs, just against seeded data instead of a live server.

## What's real

- The full Next.js UI: inbox (`/`), settings (`/settings`), canned-response templates
  (`/templates`), and the embeddable customer widget (`/widget`).
- The 1345-line `lib/store.ts` zustand state machine — auth, tickets, unread tracking,
  pagination, viewer presence — completely untouched. The mock layer was built to satisfy
  what the store already expects from the API, not the other way around.
- Threaded ticket conversations, internal notes, canned-response search, attachment
  upload/preview/download, drag-and-drop file staging, deep message search, project/status
  filtering, and the agent role switcher (admin/agent) in the demo badge.
- **The inbox moves on its own.** A background ticker (`mock/ticker.ts`) periodically adds
  a new incoming ticket or a follow-up client message, and the app's own unread-poll
  (every 30s) and viewer-fetch (every 30-60s) loops — unmodified upstream code — pick up
  the change and show it. A second agent will sometimes show up as "also viewing" a ticket
  you have open.
- **The `/widget` → inbox round trip actually works.** Submit the customer-facing widget
  form and the ticket lands in the inbox live, same as it would against a real backend.

## What's mocked / synthetic

- **All API responses** (`mock/handlers/`) — 9 services covering auth, tickets, projects
  and project members, users/team, unread items, canned-response templates, per-project
  auto-email responses, attachments, and viewer presence.
- **`mock/seed.ts`** — ~40 tickets across all five statuses, spread across 3 invented
  products (Nimbus Docs, Brightleaf Market, Pixel Forge Studio), with real-looking
  multi-message conversation threads, a few escalations (internal notes), a few resolved
  with canned-response-style replies, and invented customers throughout. Expanded from
  upstream's dead `lib/mock-data.ts` (176 lines, imported by nothing) rather than shipping
  that file half-used.
- **Attachments** — a handful of small self-hosted sample files under `public/attachments/`
  (a couple of generated screenshots, a GIF, a minimal PDF) so the attachment viewer opens
  something real. Anything uploaded during a session is kept as a real in-browser blob
  (`URL.createObjectURL`), so what you upload is exactly what you get back.
- **Auth** — a demo agent session auto-authenticates on load (no password wall for a
  visitor). The real login screen is still reachable — log out from Settings and it's
  right there, credentials prefilled. Three of upstream's raw `fetch` calls that bypass the
  shared API client (`lib/api/auth.ts`, `lib/api/attachments.ts`,
  `lib/api/tickets.ts:154`) are still caught, because the mock patches `fetch` itself
  rather than the client wrapper — see `mock/install.ts`.
- **Mutations persist for the session** — creating a ticket, replying, changing status,
  adding a template, editing a project — all write into the in-memory db and mirror to
  `sessionStorage`, so a refresh doesn't lose your edits. Use **Reset demo data** in the
  badge at the bottom of the screen to wipe it back to the seed.

## Run it

```sh
bun install
bun run dev     # http://localhost:3000
```

```sh
bun run build
PORT=4000 bun run ./node_modules/.bin/next start -p 4000
```

No `.env` is required — see `.env.example` for what the placeholder values are (they're
never actually dialed; the mock intercepts every request before it reaches the network).

## Deploy

Vercel — `vercel.json` is already configured. Connect the repo in the Vercel dashboard; no
environment variables are required, though you can override `NEXT_PUBLIC_DEMO=0` if you
ever point this build at a real backend instead.

**Live URL:** not yet deployed — will be added here once connected.

## Repo layout

```
app/                 4 routes: / (inbox), /settings, /templates, /widget
components/          upstream UI, byte-identical except widget-form.tsx and
                      auth-page.tsx (see UPSTREAM.md "Judgment calls")
components/demo/     demo-only: mock-mount.tsx, demo-badge.tsx
lib/                 upstream store, API services, types, hooks — untouched
mock/                the whole mock API layer
  install.ts         patches window.fetch, mounts the ticker, auto-logs-in
  router.ts          [method, path] route table
  db.ts              in-memory store, mirrored to sessionStorage
  seed.ts            deterministic seed data (~40 tickets, invented customers)
  ticker.ts          background "the inbox moves on its own" simulation
  session.ts          demo-token <-> agent identity plumbing
  handlers/          one file per lib/api/*.ts service
public/attachments/  self-hosted sample files for the attachment viewer
```

## Source

Extracted from a real product build. See `UPSTREAM.md` for the exact source commit, what
was cut, the three small judgment-call edits to otherwise-untouched files, and how to pull
a future UI update (`scripts/sync-ui.sh`).
