import { ensureDay } from "@/lib/queue/reducer";
import { getBackend } from "@/lib/queue/server-store";
import { ticketView } from "@/lib/queue/patient-view";

export const dynamic = "force-dynamic";

/** GET /api/ticket?id=<visit id>: what the patient's phone shows for that queue number (no names, no other patients). */
export async function GET(request: Request) {
  const backend = getBackend();
  if (!backend) return Response.json({ error: "The queue server is not running." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const now = Date.now();
  const state = ensureDay((await backend.load()).state, now);
  return Response.json(ticketView(state, id, now), { headers: { "Cache-Control": "no-store" } });
}
