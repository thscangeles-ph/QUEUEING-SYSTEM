import { configPinOk } from "@/lib/queue/pin";
import { getBackend, staffPinOk } from "@/lib/queue/server-store";
import { listUsers, manageUsers, setupAdmin, signIn, signOut, SESSION_PREFIX, staffOf, todaysActivity } from "@/lib/queue/users";

export const dynamic = "force-dynamic";

// Staff accounts (System configuration → Users): sign in and out, the first administrator, and the administrator's
// changes to the accounts. A signed-in screen sends "session:<token>" in the x-queue-pin header.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const backend = getBackend();
  if (!backend) return json({ ok: false, error: "Staff accounts need the clinic's queue server." }, 404);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }
  const { user, usersOn } = await staffOf(request);
  switch (body.type) {
    case "status":
      return json({ ok: true, usersOn, user });
    case "signIn": {
      const result = await signIn(body.username, body.pin, body.remember !== false);
      return "error" in result ? json({ ok: false, error: result.error }, 401) : json({ ok: true, token: `${SESSION_PREFIX}${result.token}`, user: result.user });
    }
    case "signOut":
      await signOut(request);
      return json({ ok: true });
    case "setupAdmin": {
      if (usersOn) return json({ ok: false, error: "The administrator is already set up. Sign in instead." }, 409);
      // Only someone who manages the Queue Board: the configuration PIN, or the old staff PIN where there is none.
      const settings = (await backend.load()).state?.settings;
      const allowed = settings?.configPin ? configPinOk(settings.configPin, body.configPin) : staffPinOk(request);
      if (!allowed) return json({ ok: false, error: settings?.configPin ? "The configuration PIN is not right." : "The staff PIN is not right." }, 401);
      const made = await setupAdmin(body);
      if ("error" in made) return json({ ok: false, error: made.error }, 422);
      const signed = await signIn(body.username, body.pin, true);
      return "error" in signed ? json({ ok: false, error: signed.error }, 401) : json({ ok: true, token: `${SESSION_PREFIX}${signed.token}`, user: signed.user });
    }
    case "list":
    case "manage": {
      if (user?.role !== "admin") return json({ ok: false, error: "Only an administrator can manage users." }, 403);
      if (body.type === "manage") {
        const result = await manageUsers((body.change ?? {}) as Parameters<typeof manageUsers>[0]);
        if ("error" in result) return json({ ok: false, error: result.error }, 422);
      }
      return json({ ok: true, users: await listUsers(), activity: (await todaysActivity()).slice(-200).reverse() });
    }
    default:
      return json({ ok: false, error: "Unknown request." }, 400);
  }
}
