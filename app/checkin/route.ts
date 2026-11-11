import { checkinPage } from "@/lib/queue/lite-pages";
import { emptyState, ensureDay } from "@/lib/queue/reducer";
import { getBackend } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

/**
 * /checkin: the short address the QR poster uses (same page as /queue/checkin). A new address also means no phone has an
 * old copy saved: Safari kept the earlier app page and showed it stuck on "Loading…".
 */
export async function GET() {
  const now = Date.now();
  const backend = getBackend();
  const state = backend ? ensureDay((await backend.load()).state, now) : emptyState(now);
  return new Response(checkinPage(state), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, max-age=0" } });
}
