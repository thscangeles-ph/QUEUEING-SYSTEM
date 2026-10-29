import type { SmsSettings } from "./types";

// Reminders to pre-registered patients: the settings, the cellphone number format and the texts.
// Sent by the clinic server (lib/queue/sms-sender.ts) through the clinic's Telegram bot.

export const SMS_TEXTS = {
  assigned: "THSC: Hi {name}, your queue number for {clinic} is {number}{appointment}. Please show this number at the Concierge when you arrive.",
  next: "THSC: Your queue number {number} ({clinic}) is NEXT IN LINE. Please be ready at the Concierge.",
} as const;

export const DEFAULT_SMS: SmsSettings = { enabled: false, telegramBot: "", autoAssigned: true, autoNext: true, assignedText: SMS_TEXTS.assigned, nextText: SMS_TEXTS.next };

const text = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The reminder settings from the settings form; the bot token is kept when the form leaves it empty (screens never get it). */
export function smsSettingsOf(input: Partial<SmsSettings> | undefined, previous?: SmsSettings): SmsSettings | string {
  const raw = { ...DEFAULT_SMS, ...previous, ...input };
  const typedToken = String(input?.telegramToken ?? "").replace(/\s+/g, "");
  if (typedToken && !/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(typedToken)) return "Telegram bot token: copy the whole token @BotFather gave, like 123456789:AAH…";
  const telegramToken = typedToken || (previous?.telegramToken ?? "");
  const telegramBot = String(raw.telegramBot ?? "").replace(/^@/, "").trim();
  return {
    enabled: Boolean(raw.enabled),
    ...(telegramToken ? { telegramToken } : {}),
    telegramBot: /^[A-Za-z0-9_]{5,32}$/.test(telegramBot) ? telegramBot : "",
    autoAssigned: raw.autoAssigned !== false,
    autoNext: raw.autoNext !== false,
    assignedText: text(raw.assignedText, 320) || SMS_TEXTS.assigned,
    nextText: text(raw.nextText, 320) || SMS_TEXTS.next,
  };
}

/** A Philippine cellphone number in international form (+639171234567), from 0917 123 4567, +63 917…, 63917… or 917…; null if it is not one. */
export function smsPhone(mobile: string | undefined): string | null {
  const digits = String(mobile ?? "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  return null;
}

/** "DELA CRUZ, JUAN MIGUEL" → "Juan", "maria santos" → "Maria". */
export function smsFirstName(name: string): string {
  const given = name.includes(",") ? name.slice(name.indexOf(",") + 1) : name;
  const first = given.trim().split(/\s+/)[0] ?? "";
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : "";
}

/** "14:30" → "2:30 PM". */
export function appointmentText(time: string | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!match) return time ?? "";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/** A text with the patient's details filled in. */
export function smsText(template: string, patient: { name: string; label: string; clinic: string; appointment?: string }): string {
  const fields: Record<string, string> = {
    name: smsFirstName(patient.name) || patient.name,
    fullname: patient.name,
    number: patient.label,
    clinic: patient.clinic,
    appointment: patient.appointment ? `, appointment ${appointmentText(patient.appointment)}` : "",
  };
  return template.replace(/\{(name|fullname|number|clinic|appointment)\}/gi, (_, key: string) => fields[key.toLowerCase()]).replace(/\s+/g, " ").trim();
}
