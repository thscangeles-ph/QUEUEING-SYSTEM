import type { SlipWidth } from "./escpos";
import type { ConfigPin } from "./pin";
import type { TvMedia } from "./youtube";

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
  /** Set when a consultation is finished: the professional fee (or no charge) and other items to pay at the cashier. */
  billing?: Billing;
};

export type Billing = { fee: "pf" | "none"; items: string[] };

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
  /** The clinic's name on every screen, slip, message and report; missing means The Heart Specialists Clinic. */
  clinicName?: string;
  stations: Station[];
  cardCount: number;
  ticker: string;
  /** The lobby TV's playlist while patients wait: YouTube videos, playlists and channels, and pictures, played in turn and repeated. */
  tvMedia?: TvMedia[];
  /** Seconds each picture stays on the TV; missing means 10. */
  slideSeconds?: number;
  /** The first YouTube link of tvMedia, kept for Queue Boards saved before the TV had a playlist. */
  youtube?: string;
  videoSound?: boolean;
  /** How the TV and other screens reach a clinic server: its Wi-Fi or its LAN cable (Ethernet) address. Missing means Wi-Fi. */
  displayConnection?: "wifi" | "lan";
  /** Volume of the TV video's sound, 0–100; set from the front desk. Missing means 60. */
  videoVolume?: number;
  /** The clinic server's receipt printer for kiosk slips: a Windows printer name, a COM port (e.g. a Bluetooth printer's COM5) or a /dev device. Empty means no printer. */
  slipPrinter?: string;
  /** Paper width of that printer in mm (58, 76, 80 or 112); missing means 58. */
  slipWidth?: SlipWidth;
  /** Salted hash of the configuration PIN that protects System configuration. Never sent to any screen. */
  configPin?: ConfigPin;
  /** Sent to the screens instead of configPin: whether System configuration has a PIN. */
  configPinSet?: boolean;
  /** Language of the TV's spoken announcements; missing means English only. */
  announceLanguage?: AnnounceLanguage;
};

export type AnnounceLanguage = "en" | "en+fil" | "fil";

export type QueueState = {
  day: string;
  nextSeq: number;
  /** Next HMO number (HMO-01, HMO-02, …); missing on queues saved before HMO numbers existed. */
  nextHmoSeq?: number;
  /** Last report from the lobby TV: when it was seen and whether its sound is on, shown on the staff screens. */
  tv?: { seenAt: number; sound: boolean };
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
  | { type: "qrArrive" }
  | { type: "verify"; visitId: string }
  | { type: "updateVisit"; visitId: string; name?: string; mobile?: string; notes?: string; priority?: boolean; newPatient?: boolean }
  | { type: "markMessaged"; visitId: string }
  | { type: "call"; station: string; visitId?: string }
  | { type: "recall"; visitId: string }
  | { type: "complete"; visitId: string; sendTo?: string; billing?: Billing }
  | { type: "miss"; visitId: string }
  | { type: "callBack"; station: string; visitId: string }
  | { type: "tvStatus"; sound: boolean }
  | { type: "requeue"; visitId: string }
  /** Replaces the services still to come; finished services and the one being served now stay as they are. */
  | { type: "setRoute"; visitId: string; stations: string[] }
  | { type: "cancel"; visitId: string }
  /** configPin is the configuration PIN; the front desk's TV sound control may change only the video's sound without it. */
  | { type: "updateSettings"; settings: Settings; configPin?: string }
  | { type: "resetDay"; configPin?: string }
  /** Sets or changes the configuration PIN; current is needed when one is already set. */
  | { type: "setConfigPin"; current?: string; pin: string }
  /** Only checks the configuration PIN (to open System configuration); nothing is saved. */
  | { type: "checkConfigPin"; pin: string };

export type ActionResult = { ok: true; visitId?: string; label?: string; card?: number } | { ok: false; error: string };

export const PUBLIC_ACTIONS: QueueAction["type"][] = ["qrArrive", "tvStatus"];
/** Actions that only check something: the server answers them without saving. */
export const READ_ONLY_ACTIONS: QueueAction["type"][] = ["checkConfigPin"];
