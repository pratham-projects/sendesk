import { fakeAccessToken } from "./util"
import { setCurrentAgentId } from "./session"
import type { AgentRecord } from "./schema"

const FAR_FUTURE_MS = () => Date.now() + 1000 * 60 * 60 * 24 * 365

/** Writes the localStorage keys lib/store.ts's tryAutoLogin() already knows
 *  how to read, so signing in — or switching identity from the demo badge —
 *  never requires touching store.ts itself. */
export function writeSession(agent: AgentRecord): { accessToken: string; tokenExpiresAt: number } {
  const accessToken = fakeAccessToken(agent.id)
  const tokenExpiresAt = FAR_FUTURE_MS()
  if (typeof window !== "undefined") {
    window.localStorage.setItem("accessToken", accessToken)
    window.localStorage.setItem("tokenExpiresAt", String(tokenExpiresAt))
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        createdAt: agent.createdAt,
      }),
    )
    setCurrentAgentId(agent.id)
  }
  return { accessToken, tokenExpiresAt }
}

export function clearSession(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem("accessToken")
  window.localStorage.removeItem("tokenExpiresAt")
  window.localStorage.removeItem("user")
  window.localStorage.removeItem("refreshToken")
  window.localStorage.removeItem("sendesk_demo_current_agent")
}
