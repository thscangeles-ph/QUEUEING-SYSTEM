import { ensureDay } from "@/lib/queue/reducer";
import { getBackend, isStaff } from "@/lib/queue/server-store";
import { smsPhone, smsSettingsOf } from "@/lib/queue/sms";
import { queueSms, sendSms, smsAvailable } from "@/lib/queue/sms-sender";
import { sendTelegram, telegramBotOf, telegramChatOf } from "@/lib/queue/telegram";

export const dynamic = "force-dynamic";

// Reminders to pre-registered patients (System configuration → Patient reminders): by the clinic's Telegram bot,
// or SMS through the clinic's Android gateway phone. Staff PIN needed; only on the clinic server (QUEUE_STORE=file).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
const UNAVAILABLE = "Reminders work only on the clinic's own queue server (local-server).";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Whether this server can send SMS. */
export function GET() {
  return json({ available: smsAvailable() });
}

/**
 * { telegramCheck: true, token? }: the Telegram bot's name for a token (typed, or the saved one).
 * { test: true, channel: "telegram", phone, token? }: sends a test reminder to a cellphone number that linked the bot.
 * { test: true, phone, gateway?, username?, password?, sim? }: sends a test SMS now, with the settings being edited.
 * { visitIds: [...], kind: "assigned" | "next" }: sends those patients' reminders (again), one after another.
 */
export async function POST(request: Request) {
  const backend = getBackend();
  if (!smsAvailable() || !backend) return json({ ok: false, reason: "unavailable", error: UNAVAILABLE });
  if (!isStaff(request)) return json({ ok: false, error: "Staff PIN required." }, 401);
  let body: { telegramCheck?: unknown; channel?: unknown; token?: unknown; test?: unknown; phone?: unknown; gateway?: unknown; username?: unknown; password?: unknown; sim?: unknown; visitIds?: unknown; kind?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }
  const state = ensureDay((await backend.load()).state, Date.now());
  const saved = state.settings.sms;

  const token = String(body.token ?? "").replace(/\s+/g, "") || saved?.telegramToken || "";
  if (body.telegramCheck) {
    if (!token) return json({ ok: false, error: "Paste the bot token from @BotFather first." });
    try {
      const bot = await telegramBotOf(token);
      return json({ ok: true, bot: bot.username, name: bot.first_name });
    } catch (error) {
      return json({ ok: false, error: (error as Error).message });
    }
  }

  if (body.test && body.channel === "telegram") {
    const phone = String(body.phone ?? "");
    if (!smsPhone(phone)) return json({ ok: false, error: "Type the cellphone number for the test, e.g. 0917 123 4567." });
    if (!token) return json({ ok: false, error: "Paste the bot token from @BotFather first." });
    const chat = await telegramChatOf(phone);
    if (!chat) return json({ ok: false, error: `${phone} has not linked the bot yet. On that phone open ${saved?.telegramBot ? `t.me/${saved.telegramBot}` : "the bot's link"}, tap Start and Share my phone number, then test again.` });
    try {
      await sendTelegram(token, chat, "THSC Queue Board: test reminder. It works! ✅");
      return json({ ok: true });
    } catch (error) {
      return json({ ok: false, error: (error as Error).message });
    }
  }

  if (body.test) {
    const phone = smsPhone(String(body.phone ?? ""));
    if (!phone) return json({ ok: false, error: "Type the cellphone number for the test, e.g. 0917 123 4567." });
    // The saved password is only used with the saved phone address, so it never goes to another address.
    const gateway = String(body.gateway ?? saved?.gateway ?? "");
    const typed = String(body.password ?? "");
    const draft = smsSettingsOf({ gateway, username: String(body.username ?? saved?.username ?? ""), password: typed, sim: Number(body.sim ?? saved?.sim ?? 0) as 0 | 1 | 2 }, typed || gateway.replace(/\/+$/, "") !== saved?.gateway ? undefined : saved);
    if (typeof draft === "string") return json({ ok: false, error: draft });
    if (!draft.gateway) return json({ ok: false, error: "Type the gateway phone address first." });
    if (!draft.password && saved?.password) return json({ ok: false, error: "This is a new gateway phone address: type its password too, then test again." });
    try {
      await sendSms(draft, phone, `THSC Queue Board: test SMS from ${draft.sim ? `SIM ${draft.sim} of ` : ""}the gateway phone. It works!`);
      return json({ ok: true });
    } catch (error) {
      return json({ ok: false, error: (error as Error).message });
    }
  }

  if (!saved?.enabled) return json({ ok: false, error: "Turn on reminders in System configuration → Patient reminders first." });
  const kind = body.kind === "next" ? "next" : "assigned";
  const ids = Array.isArray(body.visitIds) ? body.visitIds.map(String).slice(0, 300) : [];
  const visits = state.visits.filter((visit) => ids.includes(visit.id) && !visit.cancelled);
  if (!visits.length) return json({ ok: false, error: "That patient was not found." }, 404);
  queueSms(visits.map((visit) => ({ visitId: visit.id, kind, force: true })));
  return json({ ok: true, queued: visits.length });
}
