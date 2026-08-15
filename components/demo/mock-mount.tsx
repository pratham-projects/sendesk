"use client"

import { installMockApi } from "@/mock/install"

// Module scope — runs once at import time, before any child component's
// effects fire, which is what lets tryAutoLogin() (called from app/page.tsx,
// app/settings/page.tsx, app/templates/page.tsx on mount) find a valid
// pre-seeded session already sitting in localStorage. See mock/install.ts.
installMockApi()

export function MockMount() {
  return null
}
