import { applyAction, arrivalLabel, clinicNameOf, clinicOf, preRegisteredList, waitingFor } from "./reducer";
import { getBackend } from "./server-store";
import { smsPhone, smsText } from "./sms";
import type { ActionResult, QueueAction, QueueState, SmsSettings } from "./types";

// Sends SMS to pre-registered patients through the clinic's Android gateway phone ("SMS Gateway for Android",
// Local Server mode: POST http://<phone>:8080/message with basic auth). Only on the clinic server (QUEUE_STORE=file),
// which is on the same network as the phone. Texts go one at a time, a few seconds apart, so Android does not
// stop a long list, and each result is saved on the patient (smsResult) for the front desk to see.

export type SmsJob = { visitId: string; kind: "assigned" | "next"; force?: boolean };

const GAP_MS = 4000;

/** Whether this server can send: the clinic's own server, on the same network as the gateway phone. */
export const smsAvailable = () => getBackend()?.name === "file";

/** The texts an action calls for: the number when a patient is pre-registered, and "next in line" when a clinic calls the one before them. */
export function smsJobsAfter(state: QueueState, action: QueueAction, result: ActionResult): SmsJob[] {
  const sms = state.settings.sms;
  if (!sms?.enabled || !result.ok) return [];
  if (action.type === "register" && action.preRegister && !action.visitId && sms.autoAssigned && result.visitId) {
    const visit = state.visits.find((item) => item.id === result.visitId);
    return visit?.expected && smsPhone(visit.mobile) ? [{ visitId: visit.id, kind: "assigned" }] : [];
  }
  if (action.type === "call" && sms.autoNext) {
    const code = String(action.station).toUpperCase();
    const clinic = /^C([123])$/.exec(code);
    if (!clinic) return [];
    // Next in line: the first one waiting at the clinic, or else the first pre-registered patient who has not arrived yet.
    const next = [...waitingFor(state, code), ...preRegisteredList(state, `Clinic ${clinic[1]}`)][0];
    return next?.preRegisteredAt && !next.smsNextAt && smsPhone(next.mobile) ? [{ visitId: next.id, kind: "next" }] : [];
  }
  return [];
}

// One queue for the whole server process (route bundles may each load this file).
const shared = globalThis as typeof globalThis & { __thscSms?: { jobs: SmsJob[]; keys: Set<string>; running: boolean; lastSent: number } };
const queue = (shared.__thscSms ??= { jobs: [], keys: new Set(), running: false, lastSent: 0 });

/** Adds texts to send; a patient's text that is already waiting is not added twice. */
export function queueSms(jobs: SmsJob[]) {
  for (const job of jobs) {
    const key = `${job.visitId}:${job.kind}`;
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
      // A few seconds after the last text, also when the texts were asked for one by one (a pasted list).
      const wait = queue.lastSent + GAP_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      const job = queue.jobs.shift()!;
      try {
        if (await sendJob(job)) queue.lastSent = Date.now();
      } catch {
        // A failure to save the result must not stop the other texts.
      } finally {
        queue.keys.delete(`${job.visitId}:${job.kind}`);
      }
    }
  } finally {
    queue.running = false;
  }
}

/** Sends one patient's text and saves the result; false when nothing was sent (already sent, cancelled …). */
async function sendJob(job: SmsJob): Promise<boolean> {
  const backend = getBackend();
  if (!backend) return false;
  const { state } = await backend.load();
  const visit = state?.visits.find((item) => item.id === job.visitId);
  if (!state || !visit || visit.cancelled) return false;
  if (!job.force && (job.kind === "next" ? visit.smsNextAt : visit.smsAssignedAt)) return false;
  const sms = state.settings.sms;
  const fail = (error: string) => record({ type: "smsResult", visitId: visit.id, kind: job.kind, ok: false, error }).then(() => true);
  if (!sms?.enabled) return job.force ? fail("SMS is turned off in System configuration.") : false;
  if (!sms.gateway) return fail("Set up the SMS gateway phone in System configuration → SMS.");
  const phone = smsPhone(visit.mobile);
  if (!phone) return fail(visit.mobile ? "Check the cellphone number." : "No cellphone number.");
  const message = smsText(job.kind === "next" ? sms.nextText : sms.assignedText, { name: visit.name, label: arrivalLabel(visit), clinic: clinicOf(visit.kind) ?? clinicNameOf(state.settings), appointment: visit.appointment });
  try {
    await sendSms(sms, phone, message);
  } catch (error) {
    return fail((error as Error).message);
  }
  await record({ type: "smsResult", visitId: visit.id, kind: job.kind, ok: true });
  return true;
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

/** Sends one text through the gateway phone; throws with a message staff can act on. */
export async function sendSms(sms: Pick<SmsSettings, "gateway" | "username" | "password" | "sim">, phone: string, message: string): Promise<void> {
  const base = sms.gateway.replace(/\/+$/, "");
  const url = /\/message$/i.test(base) ? base : `${base}/message`;
  const headers = { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${sms.username}:${sms.password ?? ""}`).toString("base64")}` };
  const sim = sms.sim ? { simNumber: sms.sim } : {};
  const post = (body: Record<string, unknown>) => fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  let response: Response;
  try {
    response = await post({ textMessage: { text: message }, phoneNumbers: [phone], ...sim });
    // Older versions of the app take the text as "message".
    if (response.status === 400) response = await post({ message, phoneNumbers: [phone], ...sim });
  } catch {
    throw new Error(`The gateway phone did not answer at ${base}. Check that it is on the clinic Wi-Fi and the app's Local Server is on.`);
  }
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) throw new Error("The gateway phone refused the username or password (System configuration → SMS).");
  const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 120);
  throw new Error(`The gateway phone answered ${response.status}${detail ? `: ${detail}` : ""}.`);
}
