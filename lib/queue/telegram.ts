import { getBackend } from "./server-store";
import { smsPhone } from "./sms";
import type { QueueState } from "./types";

// Reminders by Telegram: the clinic's own bot (made with @BotFather) sends the texts for free.
// Telegram does not let a bot message a phone number, so each patient links once: they open the bot's link
// (t.me/<bot>), tap Start and share their phone number with the button. The number → chat link is kept
// (telegram-contacts) for every later visit. The clinic server asks Telegram for new messages itself
// (getUpdates), so it only needs internet going out: nothing has to be opened in the router.

export type TelegramContact = { chatId: number; name: string; linkedAt: number };
type Contacts = Record<string, TelegramContact>;
const CONTACTS = "telegram-contacts";
/** A message in a patient's chat with the bot: theirs, a staff reply, or an automatic reminder. */
export type ChatMessage = { id: string; chatId: number; from: "patient" | "staff" | "bot"; text: string; at: number; name?: string; read?: boolean };
const MESSAGES = "telegram-messages";
const KEEP_DAYS = 30;
const KEEP_MESSAGES = 1000;

type TelegramAnswer<T> = { ok: boolean; result?: T; description?: string; error_code?: number };
// TELEGRAM_API_URL is only for testing with a stand-in for Telegram.
const API = (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/+$/, "");

/** Calls the Telegram Bot API; throws with a message staff can act on. */
export async function telegram<T>(token: string, method: string, body: Record<string, unknown> = {}, timeoutMs = 15000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error("The server could not reach Telegram. Check the server computer's internet connection.");
  }
  const answer = (await response.json().catch(() => ({ ok: false }))) as TelegramAnswer<T>;
  if (answer.ok) return answer.result as T;
  if (response.status === 401 || response.status === 404) throw new Error("Telegram does not know this bot token. Copy it again from @BotFather.");
  if (response.status === 403) throw Object.assign(new Error("The patient stopped the clinic's Telegram bot."), { blocked: true });
  throw new Error(`Telegram answered: ${answer.description ?? response.status}.`);
}

/** The bot's username and name, to check a token. */
export const telegramBotOf = (token: string) => telegram<{ username: string; first_name: string }>(token, "getMe");

export async function telegramContacts(): Promise<Contacts> {
  return (await getBackend()?.loadData<Contacts>(CONTACTS)) ?? {};
}

// Changes to the contacts and messages one at a time, so two at the same moment never undo each other.
const changing = globalThis as typeof globalThis & { __thscTelegramData?: Promise<unknown> };
function changeData<T>(name: string, empty: T, change: (value: T) => T): Promise<void> {
  const task = (changing.__thscTelegramData ?? Promise.resolve()).then(async () => {
    const backend = getBackend();
    if (!backend) return;
    await backend.saveData(name, change((await backend.loadData<T>(name)) ?? empty));
  });
  changing.__thscTelegramData = task.catch(() => undefined);
  return task;
}

/** The chats' messages of the last 30 days, oldest first. */
export async function telegramMessages(): Promise<ChatMessage[]> {
  return (await getBackend()?.loadData<ChatMessage[]>(MESSAGES)) ?? [];
}

/** Keeps a message of a patient's chat, for the front desk's 💬 Messages. */
export function saveTelegramMessage(message: Omit<ChatMessage, "id" | "at">) {
  const now = Date.now();
  const entry: ChatMessage = { ...message, text: message.text.slice(0, 1000), id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: now };
  return changeData<ChatMessage[]>(MESSAGES, [], (list) => [...list.filter((item) => item.at > now - KEEP_DAYS * 86400000), entry].slice(-KEEP_MESSAGES));
}

/** Marks a chat's patient messages as read by staff. */
export function markTelegramRead(chatId: number) {
  return changeData<ChatMessage[]>(MESSAGES, [], (list) => list.map((item) => (item.chatId === chatId && item.from === "patient" && !item.read ? { ...item, read: true } : item)));
}

/** The Telegram chat of a patient's cellphone number, if they linked it. */
export async function telegramChatOf(mobile: string | undefined): Promise<number | null> {
  const phone = smsPhone(mobile);
  return phone ? ((await telegramContacts())[phone]?.chatId ?? null) : null;
}

/** Forgets a chat (the patient stopped the bot). */
export function unlinkTelegramChat(chatId: number) {
  return changeData<Contacts>(CONTACTS, {}, (contacts) => Object.fromEntries(Object.entries(contacts).filter(([, contact]) => contact.chatId !== chatId)));
}

export const sendTelegram = (token: string, chatId: number, text: string) => telegram(token, "sendMessage", { chat_id: chatId, text });

type Update = { update_id: number; message?: { chat: { id: number }; from?: { id: number; first_name?: string; last_name?: string }; text?: string; caption?: string; contact?: { phone_number: string; user_id?: number } } };

const SHARE_KEYBOARD = { keyboard: [[{ text: "📱 Share my phone number", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };

/** Answers what patients send the bot: /start asks for their number, a shared number links it, /stop unlinks, and anything else is kept for the front desk's 💬 Messages. */
async function handle(token: string, update: Update, clinic: string, onLinked: (phone: string) => void) {
  const message = update.message;
  if (!message) return;
  const chatId = message.chat.id;
  const reply = (text: string, markup?: Record<string, unknown>) => telegram(token, "sendMessage", { chat_id: chatId, text, ...(markup ? { reply_markup: markup } : {}) }).catch(() => undefined);
  if (message.contact) {
    // Only the patient's own number: a forwarded contact would send someone else's reminders here.
    if (message.contact.user_id !== message.from?.id) return reply("Please share your own number with the button below.", SHARE_KEYBOARD);
    const phone = smsPhone(message.contact.phone_number);
    if (!phone) return reply("Sorry, only Philippine cellphone numbers (09…) can get queue reminders.", { remove_keyboard: true });
    await changeData<Contacts>(CONTACTS, {}, (contacts) => ({ ...contacts, [phone]: { chatId, name: String(message.from?.first_name ?? "").slice(0, 60), linkedAt: Date.now() } }));
    const shown = `0${phone.slice(3, 6)} *** ${phone.slice(-4)}`;
    await reply(`✅ Linked! ${clinic} queue reminders for ${shown} will come here: your queue number, and when you are next in line.\n\nSend /stop to stop them.`, { remove_keyboard: true });
    onLinked(phone);
    return;
  }
  const command = String(message.text ?? "").trim().toLowerCase();
  if (command === "/stop") {
    await unlinkTelegramChat(chatId);
    return reply("You will not get queue reminders here anymore. Send /start to link your number again.", { remove_keyboard: true });
  }
  if (command.startsWith("/start")) return reply(`Hi! This is ${clinic}. Tap the button below to share your phone number, then your queue reminders come here.`, SHARE_KEYBOARD);
  // A message for the clinic: kept for the front desk, where staff read it and reply.
  const name = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ").slice(0, 60);
  const text = String(message.text ?? message.caption ?? "").trim() || "(sent a photo, sticker or file — only typed messages can be shown)";
  const before = (await telegramMessages()).filter((item) => item.chatId === chatId && item.from === "patient").at(-1);
  await saveTelegramMessage({ chatId, from: "patient", text, name, read: false });
  // Say it was received, but not after every line of a conversation.
  if (before && before.at > Date.now() - 30 * 60000) return;
  const linked = Object.values(await telegramContacts()).some((contact) => contact.chatId === chatId);
  if (linked) return reply("✉️ Thank you! Your message was sent to the clinic staff. They will reply here.");
  return reply(`✉️ Thank you! Your message was sent to the staff of ${clinic}. They will reply here. To get your queue reminders here too, tap the button below to share your phone number.`, SHARE_KEYBOARD);
}

// One loop for the whole server process.
const shared = globalThis as typeof globalThis & { __thscTelegram?: { running: boolean; offset: number; token: string } };

/**
 * Starts asking Telegram for new messages to the bot (on the clinic server only). It waits while reminders are
 * turned off. onLinked runs when a patient links a number (to send them today's reminder at once).
 */
export function startTelegram(settingsOf: () => Promise<QueueState["settings"] | null>, clinicOf: (settings: QueueState["settings"]) => string, onLinked: (phone: string) => void) {
  const loop = (shared.__thscTelegram ??= { running: false, offset: 0, token: "" });
  if (loop.running) return;
  loop.running = true;
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  void (async () => {
    for (;;) {
      try {
        const settings = await settingsOf();
        const sms = settings?.sms;
        const token = sms?.enabled ? (sms.telegramToken ?? "") : "";
        if (!settings || !token) { await pause(5000); continue; }
        if (token !== loop.token) {
          // A new bot: start from its newest messages, and stop a webhook from an earlier setup (Telegram allows only one way).
          loop.token = token;
          loop.offset = 0;
          await telegram(token, "deleteWebhook").catch(() => undefined);
        }
        const updates = await telegram<Update[]>(token, "getUpdates", { offset: loop.offset, timeout: 30, allowed_updates: ["message"] }, 40000);
        for (const update of updates) {
          loop.offset = update.update_id + 1;
          await handle(token, update, clinicOf(settings), onLinked).catch(() => undefined);
        }
      } catch {
        await pause(10000);
      }
    }
  })();
}
