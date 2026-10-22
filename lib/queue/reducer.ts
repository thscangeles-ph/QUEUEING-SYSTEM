import type { ActionResult, AnnounceLanguage, Announcement, Billing, NumberGroup, PatientKind, QueueAction, QueueState, Settings, Station, Step, Visit, VisitInput } from "./types";
import { slipWidthOf } from "./escpos";
import { configPinOk, hashConfigPin } from "./pin";
import { cleanTvMedia } from "./youtube";

export const TIME_ZONE = "Asia/Manila";
const MAX_ANNOUNCEMENTS = 20;
const MAX_STEPS = 8;

export const DEFAULT_CLINIC = "The Heart Specialists Clinic";
/** The clinic's name as set in System configuration. */
export const clinicNameOf = (settings?: Partial<Settings>) => clean(settings?.clinicName, 80) || DEFAULT_CLINIC;

/** The purposes of a visit a patient can choose on the QR check-in page; each test or procedure brings its station. */
export function purposeOptions(settings: Settings): { label: string; station?: string }[] {
  const options: { label: string; station?: string }[] = [{ label: "Doctor consultation" }];
  const seen = new Set<string>();
  for (const station of settings.stations.filter((item) => item.active && ["procedure", "laboratory", "imaging"].includes(item.service))) {
    // "2D Echo 1" and "2D Echo 2" are one choice for the patient.
    const label = station.name.replace(/\s+\d+$/, "");
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    options.push({ label, station: station.code });
  }
  options.push({ label: "Get results / medical certificate" }, { label: "Other" });
  return options;
}

/** The stations for the purposes a patient chose, in the order of the choices, to start the Concierge's services list. */
export function purposeStations(settings: Settings, purposes: string[] = []): string[] {
  const options = purposeOptions(settings);
  return [...new Set(purposes.map((purpose) => options.find((option) => option.label === purpose)?.station).filter((code): code is string => Boolean(code)))];
}

/** The address patients' phones open from the QR code poster, e.g. "http://172.16.100.62:3000": "" means automatic, null means it is not an address. */
export function qrAddressOf(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/\s/.test(text)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `http://${text}`);
    return /^https?:$/.test(url.protocol) && /^([a-z0-9-]+\.)*[a-z0-9-]+$|^\[[0-9a-f:.]+\]$/i.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

export const DEFAULT_SETTINGS: Settings = {
  stations: [
    { code: "C1", name: "Consultation 1", service: "consultation", location: "Clinic Room 1", selfCheckIn: true, active: true },
    { code: "C2", name: "Consultation 2", service: "consultation", location: "Clinic Room 2", selfCheckIn: true, active: true },
    { code: "C3", name: "Consultation 3", service: "consultation", location: "Clinic Room 3", selfCheckIn: true, active: true },
    { code: "E1", name: "2D Echo 1", service: "procedure", location: "2D Echo Room 1", selfCheckIn: false, active: true },
    { code: "E2", name: "2D Echo 2", service: "procedure", location: "2D Echo Room 2", selfCheckIn: false, active: true },
    { code: "ECG", name: "ECG", service: "procedure", location: "ECG Room", selfCheckIn: false, active: true },
    { code: "ABPM", name: "ABPM", service: "procedure", location: "ABPM Room", selfCheckIn: false, active: true },
    { code: "HT", name: "Holter", service: "procedure", location: "Holter Room", selfCheckIn: false, active: true },
    { code: "TM", name: "Treadmill", service: "procedure", location: "Treadmill Room", selfCheckIn: false, active: true },
    { code: "ABI", name: "ABI", service: "procedure", location: "ABI Room", selfCheckIn: false, active: true },
    { code: "BIO", name: "Biosensor", service: "procedure", location: "Biosensor Room", selfCheckIn: false, active: true },
    { code: "WT", name: "6-Minute Walk", service: "procedure", location: "6-Minute Walk Area", selfCheckIn: false, active: true },
    { code: "L1", name: "Laboratory", service: "laboratory", location: "Laboratory", selfCheckIn: false, active: true },
    { code: "HD", name: "HMO Desk", service: "hmo", location: "HMO Desk", selfCheckIn: false, active: true },
    { code: "CA", name: "Cashier", service: "cashier", location: "Cashier", selfCheckIn: false, active: true },
    { code: "XR", name: "X-ray", service: "imaging", location: "X-ray Room", selfCheckIn: false, active: true },
    { code: "US", name: "Ultrasound", service: "imaging", location: "Ultrasound Room", selfCheckIn: false, active: true },
    { code: "CN", name: "Concierge", service: "other", location: "Concierge", selfCheckIn: false, active: true },
  ],
  cardCount: 30,
  ticker: "Please wait for your queue number to be called. Senior citizens, PWDs and pregnant patients are served through the priority lane.",
};

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export const clinicDay = (now: number) => dayFormat.format(new Date(now));

export function newId() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function emptyState(now: number, settings: Settings = DEFAULT_SETTINGS): QueueState {
  return { day: clinicDay(now), nextSeq: 1, nextHmoSeq: 1, nextClinicSeq: {}, visits: [], cards: [], announcements: [], settings: structuredClone(settings) };
}

/** Queues reset at midnight Manila time; settings carry over. */
export function ensureDay(state: QueueState | null | undefined, now: number): QueueState {
  if (!state) return emptyState(now);
  return state.day === clinicDay(now) ? state : emptyState(now, state.settings);
}

const pad2 = (seq: number) => String(seq).padStart(2, "0");

/** Pre-scheduled patients of Clinic 1, 2 and 3: each clinic has its own numbering, like HMO. */
export const CLINIC_KINDS = ["P1", "P2", "P3"] as const;
/** The numbering a kind uses: walk-in and scheduled share the regular numbers; HMO and each clinic count on their own. */
export const numberGroup = (kind: PatientKind): NumberGroup => (kind === "W" || kind === "S" ? "R" : kind);
const LABEL_PREFIX: Partial<Record<NumberGroup, string>> = { H: "HMO-", P1: "CL1-", P2: "CL2-", P3: "CL3-" };
/** "Clinic 1" for a Clinic 1 patient (P1), otherwise null. */
export const clinicOf = (kind: PatientKind) => ((CLINIC_KINDS as readonly string[]).includes(kind) ? `Clinic ${kind.slice(1)}` : null);

/** 01-C1-W for walk-in and scheduled patients; HMO-01-C1 and CL1-01-C1 for HMO and Clinic 1–3 patients, who have their own numbering. */
export const ticketLabel = (visit: Pick<Visit, "seq" | "kind">, station: string) => {
  const prefix = LABEL_PREFIX[numberGroup(visit.kind)];
  return prefix ? `${prefix}${pad2(visit.seq)}-${station}` : `${pad2(visit.seq)}-${station}-${visit.kind}`;
};

/** The number given on arrival, before registration: just 01 (walk-in or scheduled is chosen at registration), HMO-01 or CL1-01. */
export const arrivalLabel = (visit: Pick<Visit, "seq" | "kind">) => `${LABEL_PREFIX[numberGroup(visit.kind)] ?? ""}${pad2(visit.seq)}`;

const kindOf = (kind: unknown): PatientKind => (kind === "S" || kind === "H" || kind === "P1" || kind === "P2" || kind === "P3" ? kind : "W");

/** Visits saved before arrival numbers existed have no `registered` flag; they were always registered. */
export const isRegistered = (visit: Visit) => visit.registered !== false;

export function currentStep(visit: Visit): Step | null {
  return visit.steps.find((step) => step.status !== "done") ?? null;
}

export function currentLabel(visit: Visit) {
  const step = currentStep(visit) ?? visit.steps[visit.steps.length - 1];
  return step ? ticketLabel(visit, step.station) : arrivalLabel(visit);
}

export const findStation = (state: QueueState, code: string): Station | undefined => state.settings.stations.find((station) => station.code === code);

const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const fail = (error: string): ActionResult => ({ ok: false, error });

function makeStep(station: string, now: number, first: boolean): Step {
  return { id: newId(), station, status: first ? "waiting" : "pending", queuedAt: first ? now : null, calledAt: null, doneAt: null, calls: 0 };
}

/** Where a call sends the patient: HMO arrival numbers to the HMO Desk and other arrival numbers to the Concierge (to register), everyone else straight to the station that called them. */
export function callDestination(state: QueueState, entry: Pick<Announcement, "kind" | "station" | "label">) {
  if (entry.kind === "ticket") return findStation(state, entry.station)?.name ?? entry.station;
  return entry.label.startsWith("HMO-") ? "HMO Desk" : "Concierge";
}

function announce(state: QueueState, entry: Omit<Announcement, "id" | "destination">) {
  state.announcements = [...state.announcements, { id: newId(), ...entry, destination: callDestination(state, entry) }].slice(-MAX_ANNOUNCEMENTS);
}

function validateStations(state: QueueState, codes: unknown): string[] | string {
  if (!Array.isArray(codes) || !codes.length) return "Choose at least one service.";
  if (codes.length > MAX_STEPS) return `A visit can have at most ${MAX_STEPS} services.`;
  const result: string[] = [];
  for (const raw of codes) {
    const code = String(raw);
    const station = findStation(state, code);
    if (!station || !station.active) return `Station ${code} is not available.`;
    result.push(code);
  }
  return result;
}

/**
 * The number the next arrival gets: the lowest number freed by an arrival removed before registering
 * (so 03 is given again after 03 is removed), otherwise the next new number.
 */
export function nextNumber(state: QueueState, numbering: NumberGroup | boolean): number {
  // true and false are the older way to ask for the HMO or the regular numbers.
  const group: NumberGroup = numbering === true ? "H" : numbering === false ? "R" : numbering;
  const next = counterOf(state, group);
  const used = new Set(state.visits.filter((visit) => numberGroup(visit.kind) === group && !(visit.cancelled && !isRegistered(visit))).map((visit) => visit.seq));
  for (let seq = 1; seq < next; seq += 1) if (!used.has(seq)) return seq;
  return next;
}

const counterOf = (state: QueueState, group: NumberGroup) => (group === "R" ? state.nextSeq : group === "H" ? state.nextHmoSeq ?? 1 : state.nextClinicSeq?.[group] ?? 1);
function setCounter(state: QueueState, group: NumberGroup, value: number) {
  if (group === "R") state.nextSeq = value;
  else if (group === "H") state.nextHmoSeq = value;
  else state.nextClinicSeq = { ...state.nextClinicSeq, [group]: value };
}

function newVisit(state: QueueState, kind: PatientKind, priority: boolean, newPatient: boolean, now: number, source: Visit["source"]): Visit | string {
  const group = numberGroup(kindOf(kind));
  if (state.visits.filter((visit) => numberGroup(visit.kind) === group).length >= 999) return "The daily queue limit of 999 patients has been reached.";
  const visit: Visit = {
    id: newId(),
    seq: nextNumber(state, group),
    kind: kindOf(kind),
    name: "",
    mobile: "",
    notes: "",
    priority,
    newPatient,
    hmo: "",
    loa: "",
    source,
    verified: source === "desk",
    cancelled: false,
    card: null,
    registered: false,
    regCalledAt: null,
    regCalls: 0,
    createdAt: now,
    registeredAt: null,
    messagedAt: null,
    steps: [],
  };
  // A reused number leaves the counter where it is.
  if (visit.seq === counterOf(state, group)) setCounter(state, group, visit.seq + 1);
  state.visits.push(visit);
  return visit;
}

/** Fills in the patient's details and services, turning an arrival number (01-W) into a ticket (01-C1-W). */
function registerVisit(state: QueueState, visit: Visit, input: VisitInput, now: number): string | null {
  const name = clean(input.name, 80);
  if (!name) return "Enter the patient's name.";
  const stations = validateStations(state, input.stations);
  if (typeof stations === "string") return stations;
  // HMO and clinic numbers come from their own count, so those visits keep their kind; walk-in and scheduled can switch.
  visit.kind = numberGroup(visit.kind) !== "R" ? visit.kind : input.kind === "S" ? "S" : "W";
  visit.name = name;
  visit.mobile = clean(input.mobile, 20);
  visit.notes = clean(input.notes, 200);
  visit.priority = Boolean(input.priority) || visit.priority;
  if (input.newPatient !== undefined) visit.newPatient = Boolean(input.newPatient);
  if (visit.kind === "H") {
    visit.hmo = clean(input.hmo, 60);
    visit.loa = clean(input.loa, 40);
  }
  if (typeof input.card === "number") visit.card = input.card;
  visit.registered = true;
  visit.registeredAt = now;
  visit.steps = stations.map((code, index) => makeStep(code, now, index === 0));
  return null;
}

/** Arrival numbers waiting to be called for registration: priority lane first, then in order of arrival. */
export function waitingToRegister(state: QueueState): Visit[] {
  return state.visits
    .filter((visit) => !visit.cancelled && !isRegistered(visit))
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.createdAt - b.createdAt || a.seq - b.seq);
}

/** Patients waiting for a station, in calling order: priority lane first, then by time queued. */
export function waitingFor(state: QueueState, station: string): Visit[] {
  return state.visits
    .filter((visit) => {
      const step = currentStep(visit);
      return !visit.cancelled && step?.station === station && step.status === "waiting";
    })
    .sort((a, b) => Number(b.priority) - Number(a.priority) || (currentStep(a)!.queuedAt ?? 0) - (currentStep(b)!.queuedAt ?? 0) || a.seq - b.seq);
}

export function servingAt(state: QueueState, station: string): Visit[] {
  return state.visits
    .filter((visit) => {
      const step = currentStep(visit);
      return !visit.cancelled && step?.station === station && step.status === "called";
    })
    .sort((a, b) => (currentStep(b)!.calledAt ?? 0) - (currentStep(a)!.calledAt ?? 0));
}

function finishStep(visit: Visit, now: number, sendTo?: string) {
  const index = visit.steps.findIndex((step) => step.status !== "done");
  if (index < 0) return;
  const step = visit.steps[index];
  step.status = "done";
  step.doneAt = now;
  const next = visit.steps[index + 1];
  if (sendTo && next?.station !== sendTo) visit.steps.splice(index + 1, 0, makeStep(sendTo, now, false));
  const following = visit.steps[index + 1];
  if (following) {
    following.status = "waiting";
    following.queuedAt = now;
  }
}

function sanitizeSettings(input: Partial<Settings>, previous: Settings): Settings | string {
  if (!input || !Array.isArray(input.stations)) return "Settings are incomplete.";
  const codes = new Set<string>();
  const stations: Station[] = [];
  for (const raw of input.stations) {
    const code = clean(raw.code, 4).toUpperCase();
    if (!/^[A-Z][A-Z0-9]{0,3}$/.test(code)) return `Station code "${raw.code}" must start with a letter and use up to 4 letters or numbers.`;
    if (codes.has(code)) return `Station code ${code} is used twice.`;
    const name = clean(raw.name, 60);
    if (!name) return `Station ${code} needs a name.`;
    codes.add(code);
    stations.push({
      code,
      name,
      service: ["consultation", "procedure", "laboratory", "imaging", "cashier", "hmo", "other"].includes(raw.service) ? raw.service : "other",
      location: clean(raw.location, 60),
      selfCheckIn: Boolean(raw.selfCheckIn),
      active: raw.active !== false,
    });
  }
  if (!stations.length) return "Add at least one station.";
  // The single-file HTML board has no laminated cards; keep the current count when it saves settings.
  const cardCount = Math.round(Number(input.cardCount ?? previous.cardCount ?? DEFAULT_SETTINGS.cardCount));
  if (!Number.isFinite(cardCount) || cardCount < 1 || cardCount > 300) return "Laminated cards must be between 1 and 300.";
  // A form from before the TV playlist existed sends only a YouTube link.
  const tvMedia = cleanTvMedia(input.tvMedia === undefined && input.youtube !== undefined ? { youtube: input.youtube } : { tvMedia: input.tvMedia ?? previous.tvMedia, youtube: previous.youtube });
  if (typeof tvMedia === "string") return tvMedia;
  const youtube = tvMedia.find((item) => item.type === "youtube")?.link ?? "";
  const seconds = Math.round(Number(input.slideSeconds ?? previous.slideSeconds ?? 10));
  const slideSeconds = Number.isFinite(seconds) ? Math.min(120, Math.max(3, seconds)) : 10;
  const language = input.announceLanguage ?? previous.announceLanguage;
  const announceLanguage: AnnounceLanguage = language === "en+fil" || language === "fil" ? language : "en";
  const volume = Math.round(Number(input.videoVolume ?? previous.videoVolume ?? 60));
  const videoVolume = Number.isFinite(volume) ? Math.min(100, Math.max(0, volume)) : 60;
  const clinicName = clinicNameOf({ clinicName: input.clinicName ?? previous.clinicName });
  const displayConnection = (input.displayConnection ?? previous.displayConnection) === "lan" ? "lan" : "wifi";
  const slipPrinter = clean(input.slipPrinter ?? previous.slipPrinter, 200);
  const slipWidth = slipWidthOf(input.slipWidth ?? previous.slipWidth);
  const qrAddress = qrAddressOf(input.qrAddress ?? previous.qrAddress);
  if (qrAddress === null) return "QR code address: use an address like http://172.16.100.62:3000.";
  // The configuration PIN only changes with setConfigPin, never from the settings form.
  const configPin = previous.configPin ? { configPin: previous.configPin } : {};
  return { clinicName, displayConnection, stations, cardCount, ticker: clean(input.ticker, 240), tvMedia, slideSeconds, youtube, videoSound: Boolean(input.videoSound ?? previous.videoSound), videoVolume, announceLanguage, slipPrinter, slipWidth, qrAddress, ...configPin };
}

export const CONFIG_PIN_NEEDED = "Enter the configuration PIN to change System configuration.";
const withoutVideoSound = (settings: Settings) => JSON.stringify({ ...settings, videoSound: undefined, videoVolume: undefined });

/**
 * Pure state transition shared by the browser (single-device mode) and the API route (shared mode).
 * Returns a new state; the input is never mutated.
 */
export function applyAction(previous: QueueState | null | undefined, action: QueueAction, now: number): { state: QueueState; result: ActionResult } {
  const base = ensureDay(previous, now);
  const state = structuredClone(base);
  const result = run(state, action, now);
  return { state: result.ok ? state : base, result };
}

function run(state: QueueState, action: QueueAction, now: number): ActionResult {
  const findVisit = (id: string) => state.visits.find((visit) => visit.id === id && !visit.cancelled);

  switch (action.type) {
    case "issueCard": {
      const used = new Set(state.cards.map((card) => card.number));
      let number = action.card;
      if (number !== undefined) {
        if (!Number.isInteger(number) || number < 1 || number > state.settings.cardCount) return fail(`Card numbers run from 1 to ${state.settings.cardCount}.`);
        if (used.has(number)) return fail(`Card ${number} is already with a patient.`);
      } else {
        number = Array.from({ length: state.settings.cardCount }, (_, index) => index + 1).find((value) => !used.has(value));
        if (number === undefined) return fail("All laminated cards are in use.");
      }
      state.cards.push({ number, issuedAt: now, calledAt: null, calls: 0 });
      return { ok: true, card: number };
    }
    case "callCard": {
      const card = action.card !== undefined
        ? state.cards.find((item) => item.number === action.card)
        : [...state.cards].sort((a, b) => a.issuedAt - b.issuedAt).find((item) => item.calledAt === null);
      if (!card) return fail(action.card !== undefined ? `Card ${action.card} is not in the registration line.` : "No cards are waiting to be called.");
      card.calledAt = now;
      card.calls += 1;
      announce(state, { at: now, kind: "card", label: `Card ${card.number}`, station: "DESK" });
      return { ok: true, card: card.number };
    }
    case "removeCard": {
      state.cards = state.cards.filter((card) => card.number !== action.card);
      return { ok: true };
    }
    case "arrive": {
      const visit = newVisit(state, action.kind, Boolean(action.priority), Boolean(action.newPatient), now, "desk");
      if (typeof visit === "string") return fail(visit);
      return { ok: true, visitId: visit.id, label: arrivalLabel(visit) };
    }
    case "callRegistration": {
      const group = action.group ?? (action.hmo === undefined ? undefined : action.hmo ? "H" : "R");
      const waiting = waitingToRegister(state).filter((item) => group === undefined || numberGroup(item.kind) === group);
      const visit = action.visitId ? waiting.find((item) => item.id === action.visitId) : waiting.find((item) => !item.regCalledAt);
      if (!visit) return fail(action.visitId ? "That number is not waiting to register." : "Everyone waiting has been called. Use Call on a number to call it again.");
      visit.regCalledAt = now;
      visit.regCalls = (visit.regCalls ?? 0) + 1;
      const label = arrivalLabel(visit);
      announce(state, { at: now, kind: "registration", label, station: "DESK" });
      return { ok: true, visitId: visit.id, label };
    }
    case "register": {
      let visit: Visit | string | undefined;
      if (action.visitId) {
        visit = findVisit(action.visitId);
        if (!visit || isRegistered(visit)) return fail("That queue number is no longer waiting to register.");
      } else {
        visit = newVisit(state, action.visit.kind, Boolean(action.visit.priority), Boolean(action.visit.newPatient), now, "desk");
        if (typeof visit === "string") return fail(visit);
      }
      const problem = registerVisit(state, visit, action.visit, now);
      if (problem) return fail(problem);
      if (visit.card !== null) state.cards = state.cards.filter((card) => card.number !== (visit as Visit).card);
      return { ok: true, visitId: visit.id, label: currentLabel(visit) };
    }
    case "qrArrive": {
      // The QR code at the Concierge only hands out an arrival number, like the desk's Queue number button.
      // The Concierge calls it and registers the patient (walk-in or scheduled, services) as usual.
      // The patient also gives their name and why they came; the Concierge sees both when registering them.
      const name = clean(action.name, 80);
      if (name.length < 2) return fail("Please type your full name.");
      const purposes = (Array.isArray(action.purposes) ? action.purposes : []).map((purpose) => clean(purpose, 80)).filter(Boolean).slice(0, 8);
      if (!purposes.length) return fail("Please choose the purpose of your visit.");
      const visit = newVisit(state, "W", false, false, now, "self");
      if (typeof visit === "string") return fail(visit);
      visit.verified = true;
      visit.name = name;
      visit.purposes = purposes;
      return { ok: true, visitId: visit.id, label: arrivalLabel(visit) };
    }
    case "verify": {
      const visit = findVisit(action.visitId);
      if (!visit) return fail("Patient not found.");
      visit.verified = true;
      return { ok: true };
    }
    case "updateVisit": {
      const visit = findVisit(action.visitId);
      if (!visit) return fail("Patient not found.");
      if (action.name !== undefined) {
        const name = clean(action.name, 80);
        if (!name) return fail("Enter the patient's name.");
        visit.name = name;
      }
      if (action.mobile !== undefined) visit.mobile = clean(action.mobile, 20);
      if (action.notes !== undefined) visit.notes = clean(action.notes, 200);
      if (action.priority !== undefined) visit.priority = Boolean(action.priority);
      if (action.newPatient !== undefined) visit.newPatient = Boolean(action.newPatient);
      return { ok: true };
    }
    case "markMessaged": {
      const visit = findVisit(action.visitId);
      if (!visit) return fail("Patient not found.");
      visit.messagedAt = now;
      return { ok: true };
    }
    case "call": {
      const station = findStation(state, action.station);
      if (!station) return fail("Unknown station.");
      let target: Visit | undefined;
      if (action.visitId) {
        target = findVisit(action.visitId);
        const step = target && currentStep(target);
        if (!target || !step || step.station !== station.code || !["waiting", "missed"].includes(step.status)) return fail("That patient is not waiting for this station.");
      } else {
        target = waitingFor(state, station.code)[0];
        if (!target) return fail(`No one is waiting for ${station.name}.`);
      }
      // Calling the next patient completes whoever the station was serving.
      servingAt(state, station.code).forEach((visit) => { if (visit.id !== target!.id) finishStep(visit, now); });
      const step = currentStep(target)!;
      step.status = "called";
      step.calledAt = now;
      step.calls += 1;
      const label = ticketLabel(target, station.code);
      announce(state, { at: now, kind: "ticket", label, station: station.code });
      return { ok: true, visitId: target.id, label };
    }
    case "recall": {
      const visit = findVisit(action.visitId);
      const step = visit && currentStep(visit);
      if (!visit || !step || step.status !== "called") return fail("That patient has not been called yet.");
      step.calls += 1;
      step.calledAt = now;
      announce(state, { at: now, kind: "ticket", label: ticketLabel(visit, step.station), station: step.station });
      return { ok: true };
    }
    case "complete": {
      const visit = findVisit(action.visitId);
      if (!visit || !currentStep(visit)) return fail("That patient has no open service.");
      if (action.sendTo) {
        const station = findStation(state, action.sendTo);
        if (!station?.active) return fail("Choose an available station to send the patient to.");
        if (visit.steps.length >= MAX_STEPS) return fail(`A visit can have at most ${MAX_STEPS} services.`);
      }
      const billing = cleanBilling(action.billing);
      if (billing) currentStep(visit)!.billing = billing;
      finishStep(visit, now, action.sendTo);
      const next = currentStep(visit);
      return { ok: true, visitId: visit.id, label: next ? ticketLabel(visit, next.station) : undefined };
    }
    case "tvStatus": {
      // The lobby TV reports every 30 seconds (it has no staff PIN), so staff can see whether calls will be heard.
      state.tv = { seenAt: now, sound: Boolean(action.sound) };
      return { ok: true };
    }
    case "callBack": {
      // Calls a patient this station already served back to it (e.g. the doctor needs them again).
      const station = findStation(state, action.station);
      if (!station) return fail("Unknown station.");
      const visit = findVisit(action.visitId);
      if (!visit || visit.cancelled || !visit.steps.some((step) => step.station === station.code && step.status === "done")) return fail(`That patient has not been served at ${station.name} today.`);
      const open = currentStep(visit);
      if (open?.station === station.code) return fail(open.status === "called" ? "That patient is already being served here." : "That patient is already in this station's line.");
      if (open?.status === "called") return fail(`${ticketLabel(visit, open.station)} is being served at ${findStation(state, open.station)?.name ?? open.station} right now.`);
      if (visit.steps.length >= MAX_STEPS) return fail(`A visit can have at most ${MAX_STEPS} services.`);
      // Like Call next, this completes whoever the station was serving.
      servingAt(state, station.code).forEach((other) => finishStep(other, now));
      // The patient's next service waits until they are done here again.
      if (open) { open.status = "pending"; open.queuedAt = null; }
      const step = makeStep(station.code, now, false);
      Object.assign(step, { status: "called", queuedAt: now, calledAt: now, calls: 1 });
      const index = visit.steps.findIndex((item) => item.status !== "done");
      visit.steps.splice(index < 0 ? visit.steps.length : index, 0, step);
      const label = ticketLabel(visit, station.code);
      announce(state, { at: now, kind: "ticket", label, station: station.code });
      return { ok: true, visitId: visit.id, label };
    }
    case "miss": {
      const visit = findVisit(action.visitId);
      const step = visit && currentStep(visit);
      if (!step || !["called", "waiting"].includes(step.status)) return fail("That patient is not in line.");
      step.status = "missed";
      return { ok: true };
    }
    case "setRoute": {
      const visit = findVisit(action.visitId);
      if (!visit || !isRegistered(visit)) return fail("Patient not found.");
      const codes = Array.isArray(action.stations) ? action.stations.map(String) : [];
      for (const code of codes) if (!findStation(state, code)?.active) return fail(`Station ${code} is not available.`);
      const done = visit.steps.filter((step) => step.status === "done");
      const open = visit.steps.filter((step) => step.status !== "done");
      // The service being given right now cannot be moved or removed.
      const locked = open[0]?.status === "called" ? [open[0]] : [];
      if (done.length + locked.length + codes.length > MAX_STEPS) return fail(`A visit can have at most ${MAX_STEPS} services.`);
      // Reuse matching steps so a patient who stays first in a line keeps their place.
      const unused = open.slice(locked.length);
      const next = codes.map((code) => {
        const index = unused.findIndex((step) => step.station === code);
        return index >= 0 ? unused.splice(index, 1)[0] : makeStep(code, now, false);
      });
      next.forEach((step, index) => {
        if (index === 0 && !locked.length) {
          if (step.status === "pending") { step.status = "waiting"; step.queuedAt = now; }
        } else {
          step.status = "pending";
          step.queuedAt = null;
        }
      });
      visit.steps = [...done, ...locked, ...next];
      return { ok: true, visitId: visit.id, label: currentLabel(visit) };
    }
    case "requeue": {
      const visit = findVisit(action.visitId);
      const step = visit && currentStep(visit);
      if (!step || step.status !== "missed") return fail("Only missed patients can be returned to the line.");
      step.status = "waiting";
      step.queuedAt = now;
      return { ok: true };
    }
    case "cancel": {
      const visit = findVisit(action.visitId);
      if (!visit) return fail("Patient not found.");
      // An arrival number removed before registering is dropped, so the next arrival can be given it again.
      if (!isRegistered(visit)) {
        state.visits = state.visits.filter((item) => item !== visit);
        return { ok: true };
      }
      visit.cancelled = true;
      return { ok: true };
    }
    case "updateSettings": {
      const settings = sanitizeSettings(action.settings, state.settings);
      if (typeof settings === "string") return fail(settings);
      // Without the configuration PIN, only the video's sound and volume may change (the front desk's TV sound control).
      if (!configPinOk(state.settings.configPin, action.configPin)) {
        const before = sanitizeSettings(state.settings, state.settings);
        if (typeof before === "string" || withoutVideoSound(before) !== withoutVideoSound(settings)) return fail(CONFIG_PIN_NEEDED);
      }
      state.settings = settings;
      return { ok: true };
    }
    case "resetDay":
      if (!configPinOk(state.settings.configPin, action.configPin)) return fail(CONFIG_PIN_NEEDED);
      Object.assign(state, emptyState(now, state.settings));
      return { ok: true };
    case "setConfigPin": {
      if (!configPinOk(state.settings.configPin, action.current)) return fail("The current configuration PIN is not right.");
      const pin = String(action.pin ?? "").trim();
      if (!/^\d{4,8}$/.test(pin)) return fail("The configuration PIN must be 4 to 8 digits.");
      state.settings.configPin = hashConfigPin(pin, newId());
      return { ok: true };
    }
    case "checkConfigPin":
      return configPinOk(state.settings.configPin, action.pin) ? { ok: true } : fail("That configuration PIN is not right.");
    default:
      return fail("Unknown action.");
  }
}

/** Items a doctor can mark for payment at the cashier, besides the professional fee. */
export const BILLING_ITEMS = ["Admin fee", "Clearance", "Medical certificate", "Additional procedure"];

function cleanBilling(input: Billing | undefined): Billing | null {
  if (!input || (input.fee !== "pf" && input.fee !== "none")) return null;
  const items = Array.isArray(input.items) ? input.items.map((item) => clean(item, 40)).filter((item) => BILLING_ITEMS.includes(item)) : [];
  return { fee: input.fee, items: [...new Set(items)] };
}

function withoutBilling(step: Step): Step {
  const copy = { ...step };
  delete copy.billing;
  return copy;
}

/** Removes names, mobile numbers, notes and charges so the TV board and patient phones never receive them. */
/** The state as screens get it: the configuration PIN's hash is replaced by whether one is set. */
export function withoutSecrets(state: QueueState): QueueState {
  const { configPin, ...settings } = state.settings;
  return { ...state, settings: { ...settings, configPinSet: Boolean(configPin) } };
}

export function publicView(state: QueueState): QueueState {
  return { ...withoutSecrets(state), visits: state.visits.map((visit) => ({ ...visit, name: "", mobile: "", notes: "", hmo: "", loa: "", purposes: undefined, steps: visit.steps.map(withoutBilling) })) };
}
