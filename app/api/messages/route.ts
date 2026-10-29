import { arrivalLabel, clinicOf, ensureDay } from "@/lib/queue/reducer";
import { getBackend, isStaff } from "@/lib/queue/server-store";
import { smsPhone } from "@/lib/queue/sms";
import { smsAvailable } from "@/lib/queue/sms-sender";
import { markTelegramRead, saveTelegramMessage, sendTelegram, telegramContacts, telegramMessages } from "@/lib/queue/telegram";

export const dynamic = "force-dynamic";

// The front desk's 💬 Messages: what patients write to the clinic's Telegram bot, and the staff's replies.
// Staff PIN needed; only on the clinic server (QUEUE_STORE=file), with reminders set to Telegram.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** The chats, newest first, each with its messages and who the patient is in today's queue (by their linked cellphone). */
export async function GET(request: Request) {
  const backend = getBackend();
  if (!smsAvailable() || !backend) return json({ available: false, chats: [] });
  if (!isStaff(request)) return json({ error: "Staff PIN required." }, 401);
  const [messages, contacts, stored] = await Promise.all([telegramMessages(), telegramContacts(), backend.load()]);
  const state = ensureDay(stored.state, Date.now());
  const phoneOf = new Map(Object.entries(contacts).map(([phone, contact]) => [contact.chatId, phone]));
  const chats = new Map<number, typeof messages>();
  for (const message of messages) chats.set(message.chatId, [...(chats.get(message.chatId) ?? []), message]);
  const list = [...chats.entries()].map(([chatId, items]) => {
    const phone = phoneOf.get(chatId) ?? null;
    // Today's visit with this cellphone: the one still open, else the latest.
    const visits = phone ? state.visits.filter((visit) => smsPhone(visit.mobile) === phone).sort((a, b) => Number(a.cancelled) - Number(b.cancelled) || b.createdAt - a.createdAt) : [];
    const visit = visits[0];
    return {
      chatId,
      name: items.findLast((item) => item.from === "patient")?.name || "",
      phone: phone ? `0${phone.slice(3)}` : null,
      patient: visit ? { label: arrivalLabel(visit), name: visit.name, clinic: clinicOf(visit.kind), cancelled: visit.cancelled } : null,
      unread: items.filter((item) => item.from === "patient" && !item.read).length,
      last: items.at(-1)!.at,
      messages: items.slice(-100),
    };
  }).sort((a, b) => b.last - a.last);
  return json({ available: true, chats: list, unread: list.reduce((sum, chat) => sum + chat.unread, 0) });
}

/** { chatId, text }: replies to a patient through the bot. { read: chatId }: marks a chat as read. */
export async function POST(request: Request) {
  const backend = getBackend();
  if (!smsAvailable() || !backend) return json({ ok: false, error: "Messages work only on the clinic's own queue server." });
  if (!isStaff(request)) return json({ ok: false, error: "Staff PIN required." }, 401);
  let body: { chatId?: unknown; text?: unknown; read?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }
  if (body.read !== undefined) {
    await markTelegramRead(Number(body.read));
    return json({ ok: true });
  }
  const chatId = Number(body.chatId);
  const text = String(body.text ?? "").trim().slice(0, 1000);
  if (!text) return json({ ok: false, error: "Type the reply first." });
  if (!(await telegramMessages()).some((message) => message.chatId === chatId)) return json({ ok: false, error: "That chat was not found." }, 404);
  const { state } = await backend.load();
  const token = state?.settings.sms?.telegramToken;
  if (!token) return json({ ok: false, error: "The Telegram bot is not set up (System configuration → Patient reminders)." });
  try {
    await sendTelegram(token, chatId, text);
  } catch (error) {
    return json({ ok: false, error: (error as Error).message });
  }
  await saveTelegramMessage({ chatId, from: "staff", text, read: true });
  await markTelegramRead(chatId);
  return json({ ok: true });
}
