import { getBackend, isStaff, staffPinConfigured } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const ID = /^[a-f0-9]{24}$/;
type Context = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** A TV slideshow picture. Anyone may view it (the TV has no PIN); its id never changes, so browsers keep it cached. */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const backend = getBackend();
  const media = backend && ID.test(id) ? await backend.loadMedia(id) : null;
  if (!media) return new Response("Not found", { status: 404, headers: CORS });
  return new Response(Buffer.from(media.data, "base64"), { headers: { ...CORS, "Content-Type": media.type, "Cache-Control": "public, max-age=31536000, immutable" } });
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const backend = getBackend();
  if (!backend) return Response.json({ error: "Pictures need the queue server (shared mode)." }, { status: 404, headers: CORS });
  if (!staffPinConfigured() || !isStaff(request)) return Response.json({ error: "Staff PIN required." }, { status: 401, headers: CORS });
  if (ID.test(id)) await backend.deleteMedia(id);
  return Response.json({ ok: true }, { headers: CORS });
}
