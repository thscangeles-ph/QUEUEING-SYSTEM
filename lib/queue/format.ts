import { currentLabel, currentStep, findStation, isRegistered, TIME_ZONE, waitingFor } from "./reducer";
import type { Announcement, AnnounceLanguage, QueueState, Station, Visit } from "./types";

export type VisitStatus = "registration" | "waiting" | "called" | "missed" | "completed" | "cancelled" | "pending";

export function visitStatus(visit: Visit): VisitStatus {
  if (visit.cancelled) return "cancelled";
  if (!isRegistered(visit)) return "registration";
  const step = currentStep(visit);
  if (!step) return "completed";
  return step.status === "done" ? "completed" : step.status;
}

export const STATUS_LABEL: Record<VisitStatus, string> = {
  registration: "To register",
  waiting: "Waiting",
  called: "Now serving",
  missed: "Missed call",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending",
};

export const STATUS_TONE: Record<VisitStatus, string> = {
  registration: "bg-[#e8eef7] text-[#2d4a6e]",
  waiting: "bg-[#fff2c8] text-[#6f4e0a]",
  called: "bg-[#2f281c] text-[#f0c864]",
  missed: "bg-[#fde8eb] text-[#9b1f35]",
  completed: "bg-[#edf5e8] text-[#41612c]",
  cancelled: "bg-[#efebe4] text-[#7d725f]",
  pending: "bg-[#efebe4] text-[#7d725f]",
};

export const stationName = (state: QueueState, code: string) => findStation(state, code)?.name ?? code;

const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
export const formatTime = (timestamp: number) => timeFormat.format(new Date(timestamp));

export function minutesSince(timestamp: number | null, now: number | null) {
  if (!timestamp || !now) return 0;
  return Math.max(0, Math.floor((now - timestamp) / 60000));
}

export const formatWait = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`);

/** How many patients will be called before this one at their current station. */
export function patientsAhead(state: QueueState, visit: Visit) {
  const step = currentStep(visit);
  if (!step || step.status !== "waiting") return 0;
  return waitingFor(state, step.station).findIndex((item) => item.id === visit.id);
}

/** Text for the one-time queue message sent to the patient (SMS or Viber). */
export function queueMessage(state: QueueState, visit: Visit, trackingUrl?: string) {
  const step = currentStep(visit);
  const firstName = visit.name.split(" ")[0] || "there";
  const service = step ? stationName(state, step.station) : "your visit";
  const lines = [
    `The Heart Specialists Clinic: Hi ${firstName}, your queue number today is ${currentLabel(visit)} for ${service}.`,
    "Please stay in the lobby and watch the TV screen for your number. Keep this same number for your consultation, procedures and laboratory tests.",
  ];
  if (trackingUrl) lines.push(`Live status: ${trackingUrl}`);
  return lines.join(" ");
}

/** Reads a queue number aloud in a way TTS voices pronounce clearly, e.g. "zero 1, C 1, W". */
export function spokenLabel(label: string) {
  return label
    .split("-")
    .map((part) => part.split("").join(" "))
    .join(", ");
}

const DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** The queue number for the Tagalog announcement. Digits stay in English, as clinics in the Philippines usually call them. */
export function spokenLabelTagalog(label: string) {
  return label
    .split("-")
    .map((part) => part.split("").map((char) => (/\d/.test(char) ? DIGIT_WORDS[Number(char)] : char)).join(" "))
    .join(", ");
}

export type SpokenLine = { text: string; lang: "en-US" | "fil-PH" };

/** What the TV says for a call, in the clinic's announcement language(s). */
export function announcementSpeech(item: Announcement, language: AnnounceLanguage = "en+fil"): SpokenLine[] {
  const card = item.label.replace(/\D/g, "");
  const english: SpokenLine = item.kind === "card"
    ? { lang: "en-US", text: `Card number ${card}. Please proceed to the ${item.destination}.` }
    : { lang: "en-US", text: `Queue number, ${spokenLabel(item.label)}. Please proceed to ${item.destination}.` };
  const tagalog: SpokenLine = item.kind === "card"
    ? { lang: "fil-PH", text: `Card number ${spokenLabelTagalog(card)}. Pakipunta po sa Front Desk.` }
    : { lang: "fil-PH", text: `Numero ${spokenLabelTagalog(item.label)}. Pakipunta po sa ${item.kind === "registration" ? "Front Desk para magpa-rehistro" : item.destination}.` };
  return language === "en" ? [english] : language === "fil" ? [tagalog] : [english, tagalog];
}

/** Seconds to leave for each call so two languages never talk over the next call. */
export const announcementGap = (language: AnnounceLanguage = "en+fil") => (language === "en+fil" ? 11000 : 6000);

/** Starting guess for minutes per patient, used until a station has served a few patients today. */
const DEFAULT_SERVICE_MINUTES: Record<Station["service"], number> = { consultation: 15, procedure: 20, laboratory: 10, hmo: 10, other: 10 };
const PACE_SAMPLES = 10;
const MIN_PACE_SAMPLES = 3;

/** Typical minutes per patient at a station: the median of its last few completed patients today. */
export function minutesPerPatient(state: QueueState, code: string) {
  const durations = state.visits
    .flatMap((visit) => visit.steps)
    .filter((step) => step.station === code && step.status === "done" && step.calledAt && step.doneAt)
    .sort((a, b) => b.doneAt! - a.doneAt!)
    .map((step) => (step.doneAt! - step.calledAt!) / 60000)
    // Ignore taps that completed a patient by mistake and visits left open over a break.
    .filter((minutes) => minutes >= 1 && minutes <= 120)
    .slice(0, PACE_SAMPLES)
    .sort((a, b) => a - b);
  if (durations.length < MIN_PACE_SAMPLES) return DEFAULT_SERVICE_MINUTES[findStation(state, code)?.service ?? "other"];
  const middle = Math.floor(durations.length / 2);
  return durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
}

/** Estimated minutes until a waiting patient is called at their current station, or null if they are not waiting. */
export function estimatedWait(state: QueueState, visit: Visit, now: number) {
  const step = currentStep(visit);
  if (!step || step.status !== "waiting") return null;
  const pace = minutesPerPatient(state, step.station);
  // The patient now being served still has part of their turn left.
  const serving = state.visits
    .map((item) => currentStep(item))
    .filter((item) => item?.station === step.station && item.status === "called" && item.calledAt)
    .map((item) => Math.max(0, pace - (now - item!.calledAt!) / 60000));
  return patientsAhead(state, visit) * pace + (serving.length ? Math.min(...serving) : 0);
}

/** "Less than 5 min", "About 20 min" or "About 1 h 15 min": rounded to 5 minutes, as an estimate should be. */
export function formatEstimate(minutes: number) {
  if (minutes < 5) return "Less than 5 min";
  const rounded = Math.round(minutes / 5) * 5;
  return `About ${rounded < 60 ? `${rounded} min` : `${Math.floor(rounded / 60)} h${rounded % 60 ? ` ${rounded % 60} min` : ""}`}`;
}
