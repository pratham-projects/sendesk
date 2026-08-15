import { resetDB } from "./db"
import { clearSession } from "./write-session"

/** "Reset demo data" — wipes the in-memory/sessionStorage db and the demo
 *  session, then reloads so installMockApi() reseeds everything from scratch. */
export function resetDemo(): void {
  resetDB()
  clearSession()
  if (typeof window !== "undefined") window.location.reload()
}
