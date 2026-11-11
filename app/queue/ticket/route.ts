import { ticketPage } from "@/lib/queue/lite-pages";
import { emptyState, ensureDay } from "@/lib/queue/reducer";
import { getBackend } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

/** The patient's queue number page (/queue/ticket?id=…), one small page that reads /api/ticket every 3 seconds. */
export async function GET() {
  const now = Date.now();
  const backend = getBackend();
  const state = backend ? ensureDay((await backend.load()).state, now) : emptyState(now);
  return new Response(ticketPage(state), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, max-age=0" } });
}
