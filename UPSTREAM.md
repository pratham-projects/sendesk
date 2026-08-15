# Upstream

This repo is a frontend-only extraction of **SendDesk**, a real multi-tenant support-ticket
product. It is packaged for a portfolio, not maintained as a product.

- **Source:** `Pratham-Jobs/sendesk` (GitHub, real remote).
- **Synced commit:** `617172f` — "unread tickets api". This was `main`'s HEAD at extraction
  time (2026-08-15).
- **Subtree taken:** `frontend/` only. `backend/` (the Node API + Postgres/Drizzle layer),
  `drizzle/` (migrations), and `monitor-404s.sh` all stayed behind — no backend source,
  schema, or ops tooling belongs in a public demo repo.
- **Protected paths — sync must never overwrite these:** `mock/`, `components/demo/`,
  `README.md`, `UPSTREAM.md`, `scripts/`, `vercel.json`, `.env.example`.

## What changed from upstream

Everything under `app/`, `components/` (other than `components/demo/`), `hooks/`, `lib/`
(other than `lib/mock-data.ts`, deleted — see below), `public/` (other than
`public/attachments/`, added — see below) and `styles/` is byte-identical to upstream at
`617172f`. On top of that, this demo adds:

- **`mock/`** — the whole mock API layer (see `mock/install.ts` for the design). This is
  the only thing that makes the app run without `backend/`.
- **`components/demo/`** — `mock-mount.tsx` (calls `installMockApi()` at module scope) and
  `demo-badge.tsx` (the "Demo — sample data, no backend" badge, agent role switcher, and
  reset-demo-data control), both mounted from a two-line addition to `app/layout.tsx`.
- **`public/attachments/`** — small self-hosted sample files (a couple of generated PNG/JPG
  screenshots, a GIF, and a minimal PDF) so the attachment viewer has something real to
  open. Nothing here is a real customer upload.
- **Three small, deliberate edits to otherwise-untouched upstream files** (see "Judgment
  calls" below): `components/widget-form.tsx`, `components/auth-page.tsx`, and
  `app/layout.tsx`.
- **`lib/mock-data.ts` was deleted.** It was dead code upstream (176 lines, imported by
  nothing) and its shape has been absorbed into `mock/seed.ts`'s scenario data instead of
  shipping two versions of the same fixtures.

## Judgment calls — deviations from "byte-identical + additive only"

The general rule for this whole set of demos is: add files, never edit upstream ones. Two
places in Sendesk genuinely couldn't satisfy the plan's explicit requirements without a
small, targeted edit:

1. **`components/widget-form.tsx`** — upstream's version doesn't call any API; it just
   fakes a 1-second delay and `console.log`s the form data. The plan calls the `/widget` →
   inbox round trip "the single most convincing thing to show" in this whole demo, which is
   impossible without wiring the form to `ticketsApi.create()`. Rewired `handleSubmit` to
   call the real service (which itself goes through the mock's intercepted fetch, same as
   everywhere else); everything else in the file — markup, validation, success state — is
   unchanged. Default `projectId` prop updated from the placeholder `"proj_1"` to match
   `mock/seed.ts`'s actual first project id, `"proj_nimbus"`.
2. **`components/auth-page.tsx`** — the plan requires the real login screen stay reachable
   "with demo credentials prefilled." Prefilled the `email`/`password` `useState` initial
   values with a seeded demo agent's credentials and added one line of helper text. No
   structural change.
3. **`app/layout.tsx`** — two-line addition (import + mount) for `MockMount` and
   `DemoBadge`, exactly as described in plan §3's "Mount point" note.

Everything else — `lib/store.ts` (1345 lines, drives auth/tickets/unread state) most
notably — is genuinely untouched. The mock layer was built to satisfy what `store.ts`
already expects from the API, not the other way around.

## Syncing a future UI change

```sh
scripts/sync-ui.sh <new-sha>
```

See the script's header comment for exactly what it diffs and how the `frontend/` prefix
gets stripped. After applying: check whether any new screen calls a `lib/api/*.ts` service
that `mock/handlers/` doesn't cover yet (add the handler before shipping it), bump the
synced sha in this file, `bun install && bun run build`, re-run the scrub checklist, commit.
