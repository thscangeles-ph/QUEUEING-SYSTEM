import { checkinPage } from "@/lib/queue/lite-pages";
import { emptyState, ensureDay } from "@/lib/queue/reducer";
import { getBackend } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

/** The QR check-in page, as one small page (see lib/queue/lite-pages.ts) so it opens at once on every phone. */
export async function GET() {
  const now = Date.now();
  const backend = getBackend();
  const state = backend ? ensureDay((await backend.load()).state, now) : emptyState(now);
  return new Response(checkinPage(state), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, max-age=0" } });
}
