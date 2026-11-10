import { estimatedWait, formatEstimate, patientsAhead, setWaitMinutes, visitStatus } from "./format";
import { arrivalLabel, clinicNameOf, currentStep, findStation, vitalsPlaceOf, waitingToRegister } from "./reducer";
import type { QueueState } from "./types";

// What a patient's phone shows for their queue number (the light ticket page, /queue/ticket). Worked out on the
// server, so the phone downloads only this small summary: no names, no other patients.

export type TicketTone = "turn" | "waiting" | "missed" | "expected" | "done";
export type TicketView =
  | { found: false; day: string; clinic: string }
  | {
      found: true;
      day: string;
      clinic: string;
      label: string;
      status: string;
      title: string;
      /** The message; "{place}" marks where the place name goes (shown in a dark box). */
      text: string;
      place: string | null;
      tone: TicketTone;
      wait: string | null;
      waitNote: string | null;
      steps: { name: string; code: string; state: "done" | "current" | "next" }[];
      verified: boolean;
      /** Changes with every call and "Call again", so the phone rings each time; null while not called. */
      callKey: string | null;
    };

export function ticketView(state: QueueState, id: string, now: number): TicketView {
  const clinic = clinicNameOf(state.settings);
  const visit = state.visits.find((item) => item.id === id);
  if (!visit || visit.cancelled) return { found: false, day: state.day, clinic };
  const status = visitStatus(visit);
  const step = currentStep(visit);
  const station = step ? findStation(state, step.station) : undefined;
  // A clinic calling the patient for vital signs counts as called too.
  const vitalsNow = status === "waiting" && Boolean(step?.vitalsCalledAt) && !step?.vitalsDoneAt;
  const calledNow = status === "called" || vitalsNow || (status === "registration" && Boolean(visit.regCalledAt));
  const callKey = !calledNow ? null
    : vitalsNow ? `vitals:${step?.id}:${step?.vitalsCalledAt}`
    : status === "called" ? `call:${step?.id}:${step?.calledAt}`
    : `reg:${visit.id}:${visit.regCalledAt}`;
  const toRegister = waitingToRegister(state).filter((item) => !item.regCalledAt);
  const ahead = status === "registration" ? Math.max(0, toRegister.findIndex((item) => item.id === visit.id)) : patientsAhead(state, visit);
  const aheadTitle = ahead === 0 ? "You're next" : `${ahead} patient${ahead > 1 ? "s" : ""} ahead of you`;
  const stationName = station?.name ?? "your station";
  const desk = visit.kind === "H" ? "HMO Desk" : "Concierge";
  let message: { title: string; text: string; place: string | null; tone: TicketTone };
  if (vitalsNow) message = { title: "Vital signs first", text: `Please proceed to {place} before ${station?.name ?? "your clinic"}.`, place: vitalsPlaceOf(state.settings), tone: "turn" };
  else if (status === "called") message = { title: "It's your turn!", text: "Please proceed to {place}", place: stationName, tone: "turn" };
  else if (status === "missed") message = { title: "We called your number", text: "Please approach the front desk so we can put you back in line.", place: null, tone: "missed" };
  else if (status === "expected") message = { title: "You're pre-registered", text: `Your number is ready${visit.appointment ? ` for ${visit.appointment}` : ""}. When you arrive, please check in at the kiosk or tell the Concierge so you join the line.`, place: null, tone: "expected" };
  else if (status === "completed") message = { title: "All done for today", text: `Thank you for visiting ${clinicNameOf(state.settings)}.`, place: null, tone: "done" };
  else if (status === "registration") message = visit.regCalledAt
    ? { title: "It's your turn!", text: "Please proceed to {place}", place: desk, tone: "turn" }
    : { title: aheadTitle, text: `Please wait in the lobby. The ${desk} will call your number to register you. Watch the lobby TV.`, place: null, tone: "waiting" };
  else message = { title: aheadTitle, text: `Waiting for ${station?.name ?? "your service"}. Watch the lobby TV for your number.`, place: null, tone: "waiting" };
  const minutes = estimatedWait(state, visit, now);
  const set = step ? setWaitMinutes(state, step.station) : null;
  return {
    found: true,
    day: state.day,
    clinic,
    label: arrivalLabel(visit),
    status,
    ...message,
    wait: minutes === null ? null : formatEstimate(minutes),
    waitNote: minutes === null ? null : `${set !== null ? `About ${set} min per patient at ${stationName}.` : `Based on today's pace at ${station?.name ?? "this station"}.`} Priority lane patients may be called first.`,
    steps: visit.steps.map((item) => ({ name: findStation(state, item.station)?.name ?? item.station, code: item.station, state: item.status === "done" ? "done" : item === step ? "current" : "next" })),
    verified: visit.verified !== false,
    callKey,
  };
}
