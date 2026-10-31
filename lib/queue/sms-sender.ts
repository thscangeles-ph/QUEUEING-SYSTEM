import { applyAction, arrivalLabel, clinicNameOf, clinicOf, currentStep, ensureDay, findStation, isRegistered, preRegisteredList, vitalsPlaceOf, waitingFor } from "./reducer";
import { getBackend } from "./server-store";
import { smsPhone, smsText, smsTextOf } from "./sms";
import { saveTelegramMessage, sendTelegram, startTelegram, telegramChatOf, unlinkTelegramChat } from "./telegram";
import type { ActionResult, QueueAction, QueueState, SmsSettings, Visit } from "./types";

// Sends reminders to patients by the clinic's Telegram bot (lib/queue/telegram.ts): a pre-registered patient's number,
// and for every patient who linked their cellphone, "next in line" and "your turn" at each of their services.
// Only on the clinic server (QUEUE_STORE=sqlite or file). Reminders go one at a time, and each result is saved on the patient
// (smsResult) for the front desk to see.

/** station: the service a "next in line", "your turn" or vital signs reminder is about. */
export type SmsJob = { visitId: string; kind: "assigned" | "issued" | "next" | "turn" | "vitals" | "thanks"; station?: string; force?: boolean };

const GAP_MS = 300;
export const NOT_ON_TELEGRAM = "Not on Telegram yet — it is sent when the patient opens the bot link and shares their number.";

/** Whether this server can send: the clinic's own server. */
export const smsAvailable = () => { const name = getBackend()?.name; return name === "sqlite" || name === "file"; };

/** A patient's open step at a station (being called, waiting, or still to come). */
const stepAt = (visit: Visit, station: string) => visit.steps.find((step) => step.station === station && step.status !== "done");

/**
 * The reminders an action calls for: the number when a patient is pre-registered; and when a station calls a patient,
 * "your turn" to that patient and "next in line" to the one after them (at a clinic, the first pre-registered patient
 * not arrived yet when no one is waiting). A vital signs call sends "your turn" to the vital signs place, and a call back
 * sends "your turn" again.
 * Patients without a cellphone are left out here; one not linked to Telegram is skipped when sending.
 */
export function smsJobsAfter(state: QueueState, action: QueueAction, result: ActionResult): SmsJob[] {
  const sms = state.settings.sms;
  if (!sms?.enabled || !result.ok) return [];
  const find = (id?: string) => state.visits.find((item) => item.id === id && !item.cancelled && smsPhone(item.mobile));
  if (action.type === "register" && action.preRegister && !action.visitId && sms.autoAssigned) {
    const visit = find(result.visitId);
    return visit?.expected ? [{ visitId: visit.id, kind: "assigned" }] : [];
  }
  // Issue queue number (regular, HMO, clinic walk-in): the number goes to the patient's Telegram at once.
  if (action.type === "register" && !action.preRegister && sms.autoIssued !== false) {
    const visit = find(result.visitId);
    return visit ? [{ visitId: visit.id, kind: "issued" }] : [];
  }
  // The visit is complete: ✓ Complete visit, Complete visit in "Served here today" (the rest of the route removed), or the
  // last service finished by Call next. Then they get "thank you for visiting" (once a visit).
  if (sms.autoThanks !== false && ["complete", "setRoute", "call"].includes(action.type)) {
    const now = Date.now();
    const finished = (visit: (typeof state.visits)[number]) => !visit.cancelled && !visit.expected && isRegistered(visit) && visit.steps.length > 0 && !currentStep(visit) && !visit.smsThanksAt;
    // Call next finishes whoever the station was serving: the visits whose last service ended just now.
    const thanks = action.type === "call"
      ? state.visits.filter((visit) => find(visit.id) && finished(visit) && now - Math.max(...visit.steps.map((step) => step.doneAt ?? 0)) < 5000)
      : [find(result.visitId)].filter((visit): visit is NonNullable<typeof visit> => Boolean(visit && finished(visit)));
    const jobs: SmsJob[] = thanks.map((visit) => ({ visitId: visit.id, kind: "thanks" }));
    return action.type === "call" ? [...jobs, ...callJobs(state, action, result, sms)] : jobs;
  }
  // Call back (a station calling a patient it served back to it): "your turn" again, for the new step.
  if (action.type === "callBack") {
    const visit = find(result.visitId);
    return visit && sms.autoTurn !== false ? [{ visitId: visit.id, kind: "turn", station: String(action.station).toUpperCase() }] : [];
  }
  return action.type === "call" || action.type === "callVitals" ? callJobs(state, action, result, sms) : [];
}

/** A station's call: "your turn" (or vital signs) to the patient called, and "next in line" to the one after them. */
function callJobs(state: QueueState, action: Extract<QueueAction, { type: "call" | "callVitals" }>, result: ActionResult, sms: SmsSettings): SmsJob[] {
  const find = (id?: string) => state.visits.find((item) => item.id === id && !item.cancelled && smsPhone(item.mobile));
  const code = String(action.station).toUpperCase();
  const jobs: SmsJob[] = [];
  const called = find(result.ok ? result.visitId : undefined);
  if (called && sms.autoTurn !== false) jobs.push({ visitId: called.id, kind: action.type === "callVitals" ? "vitals" : "turn", station: code });
  if (action.type === "call" && sms.autoNext) {
    const clinic = /^C([123])$/.exec(code);
    const next = [...waitingFor(state, code), ...(clinic ? preRegisteredList(state, `Clinic ${clinic[1]}`) : [])][0];
    if (next && find(next.id) && !stepAt(next, code)?.smsNextAt) jobs.push({ visitId: next.id, kind: "next", station: code });
  }
  return jobs;
}

// One queue for the whole server process (route bundles may each load this file).
const shared = globalThis as typeof globalThis & { __thscSms?: { jobs: SmsJob[]; keys: Set<string>; running: boolean; lastSent: number } };
const queue = (shared.__thscSms ??= { jobs: [], keys: new Set(), running: false, lastSent: 0 });

/** Adds texts to send; a patient's text that is already waiting is not added twice. */
export function queueSms(jobs: SmsJob[]) {
  for (const job of jobs) {
    const key = `${job.visitId}:${job.kind}:${job.station ?? ""}`;
    if (queue.keys.has(key)) continue;
    queue.keys.add(key);
    queue.jobs.push(job);
  }
  if (!queue.running && queue.jobs.length) void run();
}

async function run() {
  queue.running = true;
  try {
    while (queue.jobs.length) {
      // A moment after the last reminder, also when they were asked for one by one (a pasted list).
      const wait = queue.lastSent + GAP_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      const job = queue.jobs.shift()!;
      try {
        if (await sendJob(job)) queue.lastSent = Date.now();
      } catch {
        // A failure to save the result must not stop the other texts.
      } finally {
        queue.keys.delete(`${job.visitId}:${job.kind}:${job.station ?? ""}`);
      }
    }
  } finally {
    queue.running = false;
  }
}

/** Sends one patient's reminder and saves the result; false when nothing was tried (already sent, cancelled …). */
async function sendJob(job: SmsJob): Promise<boolean> {
  const backend = getBackend();
  if (!backend) return false;
  const { state } = await backend.load();
  const visit = state?.visits.find((item) => item.id === job.visitId);
  if (!state || !visit || visit.cancelled) return false;
  const step = job.station ? stepAt(visit, job.station) : undefined;
  const sentBefore = { assigned: visit.smsAssignedAt, issued: visit.smsAssignedAt, thanks: visit.smsThanksAt, next: step?.smsNextAt, turn: step?.smsTurnAt, vitals: step?.smsVitalsAt }[job.kind];
  if (!job.force && (sentBefore || (job.station && !step))) return false;
  const sms = state.settings.sms;
  // A service reminder for a patient who is not on Telegram (most walk-ins) is simply not sent, without a warning on the screen.
  const quiet = (job.kind !== "assigned" && !job.force);
  const fail = (error: string) => (quiet ? Promise.resolve(false) : record({ type: "smsResult", visitId: visit.id, kind: job.kind, station: job.station, ok: false, error }).then(() => true));
  if (!sms?.enabled) return job.force ? fail("Reminders are turned off in System configuration.") : false;
  if (!sms.telegramToken) return fail("Set up the Telegram bot in System configuration → Patient reminders.");
  if (!smsPhone(visit.mobile)) return fail(visit.mobile ? "Check the cellphone number." : "No cellphone number.");
  const chat = await telegramChatOf(visit.mobile);
  if (!chat) return fail(NOT_ON_TELEGRAM);
  // The service by its name and where it is, e.g. "Laboratory (2nd floor)"; a vital signs call names the vital signs place.
  const station = job.station ? findStation(state, job.station) : undefined;
  const where = station?.location && station.location.toLowerCase() !== station.name.toLowerCase() ? ` (${station.location})` : "";
  const service = job.kind === "vitals" ? vitalsPlaceOf(state.settings) : station ? `${station.name}${where}` : undefined;
  const template = smsTextOf(sms, job.kind === "vitals" ? "turn" : job.kind);
  const message = smsText(template, { name: visit.name, label: arrivalLabel(visit), clinic: clinicOf(visit.kind) ?? clinicNameOf(state.settings), appointment: visit.appointment, service });
  try {
    await sendTelegram(sms.telegramToken, chat, message);
  } catch (error) {
    // The patient stopped the bot: forget the link, so they can link again with /start.
    if ((error as { blocked?: boolean }).blocked) await unlinkTelegramChat(chat);
    return record({ type: "smsResult", visitId: visit.id, kind: job.kind, station: job.station, ok: false, error: (error as Error).message }).then(() => true);
  }
  // Shown in the patient's chat on the front desk (💬 Messages), with what they write back.
  await saveTelegramMessage({ chatId: chat, from: "bot", text: message, read: true }).catch(() => undefined);
  await record({ type: "smsResult", visitId: visit.id, kind: job.kind, station: job.station, ok: true });
  return true;
}

/** On the clinic server: answers the Telegram bot, and when a patient links their number, sends today's reminder they are still owed. */
export function startTelegramReminders() {
  const backend = getBackend();
  if (!smsAvailable() || !backend) return;
  startTelegram(
    async () => (await backend.load()).state?.settings ?? null,
    (settings) => clinicNameOf(settings),
    (phone) => {
      void backend.load().then(({ state }) => {
        if (!state) return;
        const today = ensureDay(state, Date.now());
        // A pre-registered patient gets their number; one already registered today and still in the queue gets theirs too.
        const owed = today.visits.filter((visit) => !visit.cancelled && !visit.smsAssignedAt && smsPhone(visit.mobile) === phone && (visit.expected || currentStep(visit)));
        queueSms(owed.map((visit) => ({ visitId: visit.id, kind: visit.expected ? "assigned" : "issued" })));
      });
    },
  );
}

/** Saves an action on the server's queue, trying again when another computer saved at the same moment. */
async function record(action: QueueAction) {
  const backend = getBackend();
  if (!backend) return;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stored = await backend.load();
    const { state, result } = applyAction(stored.state, action, Date.now());
    if (!result.ok || (await backend.save(state, stored.version))) return;
    await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 80));
  }
}
