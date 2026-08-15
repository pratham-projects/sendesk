#!/usr/bin/env bash
# Pulls UI-only changes from the real Sendesk repo into this demo repo.
#
# The source has a real GitHub remote, and this demo only ever took the
# `frontend/` subtree of it (see UPSTREAM.md) — `backend/`, `drizzle/` and
# `monitor-404s.sh` were left behind and must never be pulled in.
#
# Usage:
#   scripts/sync-ui.sh <new-sha>
#
# What it does:
#   1. Ensures a git remote named `upstream` points at Pratham-Jobs/sendesk and fetches it.
#   2. Diffs frontend/{app,components,hooks,lib,public,styles} between the
#      last-synced sha (read from UPSTREAM.md) and <new-sha>.
#   3. Applies that diff here with `git apply --3way -p2`, which strips the
#      leading `frontend/` path segment so it lands at this repo's root.
#
# Protected paths this must never overwrite (see UPSTREAM.md): mock/,
# components/demo/, README.md, UPSTREAM.md, scripts/, vercel.json,
# .env.example. None of those exist upstream, so the diff can't touch them —
# but always read the diff before committing; a renamed/moved upstream file
# could still collide with something demo-specific.
#
# After a successful apply:
#   - If any new screen calls a lib/api/*.ts service that mock/handlers/ doesn't
#     cover yet, add the handler (and route() registration) before shipping —
#     never leave a screen silently hitting the real network.
#   - If frontend/lib/mock-data.ts reappears upstream, ignore/delete it here —
#     its content already lives in mock/seed.ts (see UPSTREAM.md).
#   - Bump the synced sha in UPSTREAM.md.
#   - bun install && bun run build.
#   - Re-run the §7 scrub checklist.
#   - Commit.

set -euo pipefail

UPSTREAM_URL="https://github.com/Pratham-Jobs/sendesk.git"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <new-sha>" >&2
  exit 1
fi
NEW_SHA="$1"

cd "$REPO_ROOT"

if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "Adding upstream remote: $UPSTREAM_URL"
  git remote add upstream "$UPSTREAM_URL"
fi

echo "Fetching upstream ..."
git fetch upstream --quiet

LAST_SHA="$(grep -oE '\`[0-9a-f]{7,40}\`' "$REPO_ROOT/UPSTREAM.md" | head -1 | tr -d '\`')"
if [ -z "$LAST_SHA" ]; then
  echo "Could not find the last-synced sha in UPSTREAM.md" >&2
  exit 1
fi

echo "Diffing frontend/{app,components,hooks,lib,public,styles}: $LAST_SHA..$NEW_SHA"
git diff "$LAST_SHA..$NEW_SHA" -- \
  frontend/app frontend/components frontend/hooks frontend/lib frontend/public frontend/styles \
  > /tmp/sendesk-sync.patch

if [ ! -s /tmp/sendesk-sync.patch ]; then
  echo "No changes in the frontend UI paths between those commits."
  exit 0
fi

echo "Applying (3-way, frontend/ prefix stripped) ..."
git apply --3way -p2 /tmp/sendesk-sync.patch
rm -f /tmp/sendesk-sync.patch

cat <<EOF

Applied. Next steps:
  1. Review the diff for any new lib/api/*.ts service or endpoint — extend
     mock/handlers/ and mock/seed.ts before shipping the screen that uses it.
  2. Update the synced sha in UPSTREAM.md: $LAST_SHA -> $NEW_SHA
  3. bun install && bun run build
  4. Re-run the scrub checklist (README.md §7 / demo-repos-plan.md §7).
  5. Commit.
EOF
