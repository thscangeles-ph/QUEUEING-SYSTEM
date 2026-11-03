import { applyAction, CONFIG_PIN_NEEDED, ensureDay, publicView, withoutSecrets } from "@/lib/queue/reducer";
import { getBackend, staffPinConfigured } from "@/lib/queue/server-store";
import { queueSms, smsAvailable, smsJobsAfter } from "@/lib/queue/sms-sender";
import { PUBLIC_ACTIONS, READ_ONLY_ACTIONS, type QueueAction, type QueueState } from "@/lib/queue/types";
import { logActivity, staffOf, type PublicUser } from "@/lib/queue/users";

export const dynamic = "force-dynamic";

// Any origin may call the API so the single-file HTML Queue Board (opened from disk or another host) can sync.
// Staff data still needs the PIN header, and no cookies are used, so this exposes nothing new.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const HEADERS = { ...CORS, "Cache-Control": "no-store" };
// "now" lets screens use the server's clock, so a computer whose clock is off still treats new calls as new.
const json = (body: Record<string, unknown>, status = 200) => Response.json({ ...body, now: Date.now() }, { status, headers: HEADERS });
const view = (state: QueueState, staff: boolean) => (staff ? withoutSecrets(state) : publicView(state));
// users: staff sign in with their own accounts; user: who is signed in on this screen.
const who = (user: PublicUser | null, usersOn: boolean) => ({ users: usersOn, user: user ? { name: user.name, username: user.username, role: user.role } : null });
const misconfigured = () => json({ mode: "server", error: "Shared queue storage is set up but QUEUE_STAFF_PIN is missing. Add it to the environment variables and redeploy." }, 500);

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const backend = getBackend();
  if (!backend) return json({ mode: "local" });
  if (!staffPinConfigured()) return misconfigured();
  const { staff, user, usersOn } = await staffOf(request);
  const since = new URL(request.url).searchParams.get("since");
  const { state, version } = await backend.load();
  const current = ensureDay(state, Date.now());
  // A day rollover changes the state without changing the stored version, so only skip the body when the day still matches.
  if (since !== null && Number(since) === version && state?.day === current.day) return json({ mode: "server", staff, ...who(user, usersOn), version, unchanged: true });
  return json({ mode: "server", staff, ...who(user, usersOn), version, state: view(current, staff) });
}

export async function POST(request: Request) {
  const backend = getBackend();
  if (!backend) return json({ mode: "local", error: "Shared queue storage is not configured." }, 404);
  if (!staffPinConfigured()) return misconfigured();
  const { staff, user, usersOn } = await staffOf(request);
  let action: QueueAction;
  try {
    action = ((await request.json()) as { action: QueueAction }).action;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!action || typeof action.type !== "string") return json({ error: "Invalid request." }, 400);
  if (!staff && !PUBLIC_ACTIONS.includes(action.type)) return json({ error: usersOn ? "Sign in first." : "Staff PIN required." }, 401);
  // With staff accounts, only administrators change System configuration (no configuration PIN).
  const options = usersOn ? { configOk: user?.role === "admin" } : {};

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stored = await backend.load();
    const now = Date.now();
    const { state, result } = applyAction(stored.state, action, now, options);
    if (!result.ok) {
      // With staff accounts there is no configuration PIN: say who may change it instead.
      const shown = usersOn && result.error === CONFIG_PIN_NEEDED ? { ok: false as const, error: "Only an administrator can change System configuration." } : result;
      return json({ mode: "server", staff, ...who(user, usersOn), version: stored.version, result: shown, state: view(state, staff) }, 422);
    }
    if (READ_ONLY_ACTIONS.includes(action.type)) return json({ mode: "server", staff, ...who(user, usersOn), version: stored.version, result });
    if (await backend.save(state, stored.version)) {
      // Texts for pre-registered patients (System configuration → SMS) go out after the change is saved.
      if (smsAvailable()) queueSms(smsJobsAfter(state, action, result));
      if (user && action.type !== "tvStatus") void logActivity({ at: now, user: user.name, action: action.type, label: result.label });
      return json({ mode: "server", staff, ...who(user, usersOn), version: stored.version + 1, result, state: view(state, staff) });
    }
    await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 80));
  }
  return json({ error: "The queue is busy. Please try again." }, 409);
}
