/** W walk-in, S scheduled, H HMO (its own numbering: HMO-01-C1). */
export type PatientKind = "W" | "S" | "H";
export type ServiceType = "consultation" | "procedure" | "laboratory" | "imaging" | "cashier" | "hmo" | "other";
export type StepStatus = "pending" | "waiting" | "called" | "done" | "missed";

export type Station = {
  /** Short code used inside the queue number, e.g. C1 in 01-C1-W. */
  code: string;
  name: string;
  service: ServiceType;
  /** Where the patient should go when called, read out on the TV. */
  location: string;
  /** Scheduled patients may choose this station on the QR self check-in page. */
  selfCheckIn: boolean;
  active: boolean;
};

export type Step = {
  id: string;
  station: string;
  status: StepStatus;
  queuedAt: number | null;
  calledAt: number | null;
  doneAt: number | null;
  calls: number;
};

export type Visit = {
  id: string;
  /** Daily sequence number shared by every service of the visit (the 01 in 01-C1-W). */
  seq: number;
  kind: PatientKind;
  name: string;
  mobile: string;
  notes: string;
  priority: boolean;
  /** First visit to the clinic. */
  newPatient?: boolean;
  /** HMO patients: the HMO company and the LOA / approval number. Staff only; never sent to the TV or phones. */
  hmo?: string;
  loa?: string;
  source: "desk" | "self";
  verified: boolean;
  cancelled: boolean;
  card: number | null;
  /** False while the patient holds only an arrival number (01-W); visits saved before arrival numbers have no flag and were registered. */
  registered?: boolean;
  /** When the arrival number was last called to the front desk for registration. */
  regCalledAt?: number | null;
  regCalls?: number;
  registeredAt?: number | null;
  createdAt: number;
  /** When the one-time queue message was sent to the patient. */
  messagedAt: number | null;
  steps: Step[];
};

export type Card = { number: number; issuedAt: number; calledAt: number | null; calls: number };

export type Announcement = {
  id: string;
  at: number;
  kind: "ticket" | "card" | "registration";
  label: string;
  /** Station code for tickets, or "DESK" for registration cards and arrival numbers. */
  station: string;
  destination: string;
};

export type Settings = {
  stations: Station[];
  cardCount: number;
  ticker: string;
  /** YouTube channel, playlist or video shown on the TV while patients wait. */
  youtube?: string;
  videoSound?: boolean;
  /** Language of the TV's spoken announcements; missing means English, then Tagalog. */
  announceLanguage?: AnnounceLanguage;
};

export type AnnounceLanguage = "en" | "en+fil" | "fil";

export type QueueState = {
  day: string;
  nextSeq: number;
  /** Next HMO number (HMO-01, HMO-02, …); missing on queues saved before HMO numbers existed. */
  nextHmoSeq?: number;
  visits: Visit[];
  cards: Card[];
  announcements: Announcement[];
  settings: Settings;
};

export type VisitInput = {
  kind: PatientKind;
  name: string;
  mobile?: string;
  notes?: string;
  priority?: boolean;
  newPatient?: boolean;
  hmo?: string;
  loa?: string;
  stations: string[];
  card?: number | null;
};

export type QueueAction =
  | { type: "issueCard"; card?: number }
  | { type: "callCard"; card?: number }
  | { type: "removeCard"; card: number }
  | { type: "arrive"; kind: PatientKind; priority?: boolean; newPatient?: boolean }
  | { type: "callRegistration"; visitId?: string; hmo?: boolean }
  | { type: "register"; visitId?: string; visit: VisitInput }
  | { type: "selfCheckIn"; visit: Omit<VisitInput, "kind" | "card"> }
  | { type: "verify"; visitId: string }
  | { type: "updateVisit"; visitId: string; name?: string; mobile?: string; notes?: string; priority?: boolean; newPatient?: boolean }
  | { type: "markMessaged"; visitId: string }
  | { type: "call"; station: string; visitId?: string }
  | { type: "recall"; visitId: string }
  | { type: "complete"; visitId: string; sendTo?: string }
  | { type: "miss"; visitId: string }
  | { type: "requeue"; visitId: string }
  /** Replaces the services still to come; finished services and the one being served now stay as they are. */
  | { type: "setRoute"; visitId: string; stations: string[] }
  | { type: "cancel"; visitId: string }
  | { type: "updateSettings"; settings: Settings }
  | { type: "resetDay" };

export type ActionResult = { ok: true; visitId?: string; label?: string; card?: number } | { ok: false; error: string };

export const PUBLIC_ACTIONS: QueueAction["type"][] = ["selfCheckIn"];
