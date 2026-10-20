import { randomBytes } from "node:crypto";
import { getBackend, isStaff, staffPinConfigured } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

// Pictures for the lobby TV's slideshow. The board shrinks each picture before uploading it.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
const PICTURE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;
/** About 1.5 MB of picture; the board sends far less. */
const MAX_BASE64 = 2_000_000;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const backend = getBackend();
  if (!backend) return json({ error: "Pictures need the queue server (shared mode)." }, 404);
  if (!staffPinConfigured() || !isStaff(request)) return json({ error: "Staff PIN required." }, 401);
  let data = "";
  try {
    data = String(((await request.json()) as { data?: unknown }).data ?? "");
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const match = PICTURE.exec(data);
  if (!match) return json({ error: "That file is not a JPEG, PNG, WebP or GIF picture." }, 400);
  if (match[2].length > MAX_BASE64) return json({ error: "That picture is too big. Use one under 1.5 MB." }, 413);
  const id = randomBytes(12).toString("hex");
  await backend.saveMedia(id, { type: match[1], data: match[2] });
  return json({ id, src: `/api/media/${id}` });
}
