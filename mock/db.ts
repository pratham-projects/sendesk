/**
 * In-memory demo database, seeded once per page load and mirrored to
 * sessionStorage so a refresh doesn't lose the visitor's edits.
 */

import { buildInitialDB } from "./seed"
import type { DemoDB } from "./schema"

const STORAGE_KEY = "sendesk_demo_db_v3"

let db: DemoDB | null = null

function load(): DemoDB {
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DemoDB
        if (parsed?.meta?.seedVersion === buildInitialDB().meta.seedVersion) {
          return parsed
        }
      }
    } catch {
      // fall through to a fresh seed
    }
  }
  return buildInitialDB()
}

export function getDB(): DemoDB {
  if (!db) db = load()
  return db
}

export function saveDB(): void {
  if (!db || typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // sessionStorage full or unavailable — demo just runs in-memory for this tick
  }
}

export function resetDB(): DemoDB {
  db = buildInitialDB()
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
  return db
}
