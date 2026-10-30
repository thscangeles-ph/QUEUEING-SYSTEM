import { getBackend, isStaff } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

// The 📅 History page: past visits from the clinic server's database (QUEUE_STORE=sqlite). Staff PIN needed.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["W", "S", "H", "P1", "P2", "P3", "S1", "S2", "S3"];

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD&q=…&kinds=W,S&status=completed|cancelled|open&limit=…: the visits found, newest day first, with totals.
 * ?day=YYYY-MM-DD&id=…: one visit with all its details (services and their times, notes, billing).
 */
export async function GET(request: Request) {
  const backend = getBackend();
  if (!backend?.history || !backend.historyVisit) return json({ available: false, error: "History needs the clinic server's database (local-server)." });
  if (!isStaff(request)) return json({ error: "Staff PIN required." }, 401);
  const params = new URL(request.url).searchParams;
  const day = params.get("day");
  if (day) {
    if (!DAY.test(day)) return json({ error: "Invalid date." }, 400);
    const visit = await backend.historyVisit(day, String(params.get("id") ?? ""));
    return visit ? json({ available: true, visit }) : json({ error: "That visit was not found." }, 404);
  }
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? from;
  if (!DAY.test(from) || !DAY.test(to)) return json({ error: "Choose the dates." }, 400);
  const status = params.get("status");
  const result = await backend.history({
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    q: (params.get("q") ?? "").slice(0, 80),
    kinds: (params.get("kinds") ?? "").split(",").filter((kind) => KINDS.includes(kind)),
    status: status === "completed" || status === "cancelled" || status === "open" ? status : "all",
    limit: Number(params.get("limit")) || 500,
  });
  return json({ available: true, ...result });
}
