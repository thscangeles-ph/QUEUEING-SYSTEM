"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { BellRing, CheckCircle2, Clock, Printer, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arrivalLabel, clinicNameOf, currentStep, DEFAULT_CLINIC, findStation, waitingToRegister } from "@/lib/queue/reducer";
import { estimatedWait, formatEstimate, patientsAhead, visitStatus } from "@/lib/queue/format";
import type { QueueState } from "@/lib/queue/types";
import { readStorage, useNow, useQueue, writeStorage } from "./use-queue";

const TICKET_KEY = "thsc-queue-ticket";

function PatientFrame({ children, clinic = DEFAULT_CLINIC }: { children: React.ReactNode; clinic?: string }) {
  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#2e291f]">
      <header className="bg-[#2f281c] px-5 py-4 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/theheartspecialists.png" alt="The Heart Specialists Clinic logo" width="52" height="40" className="h-10 w-[52px] object-contain" />
          <div><p className="text-xs font-semibold tracking-[0.08em] text-[#f0c864]">{clinic.toUpperCase()}</p><p className="text-lg font-bold">Queue</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-md px-5 py-6">{children}</div>
    </main>
  );
}

function storedTicket(state: QueueState) {
  try {
    const saved = JSON.parse(readStorage(TICKET_KEY) || "null") as { id: string; day: string } | null;
    const visit = saved && saved.day === state.day ? state.visits.find((item) => item.id === saved.id && !item.cancelled) : undefined;
    // A finished visit no longer counts, so a patient who comes back later can take a new number.
    return visit && visitStatus(visit) !== "completed" ? visit : null;
  } catch {
    return null;
  }
}

/** The QR code at the Concierge: it only hands out a queue number. The Concierge registers the patient when calling it. */
export function CheckIn() {
  const queue = useQueue();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const state = queue.state;

  if (!state) return <PatientFrame><p className="py-16 text-center text-[#756b59]">{queue.error || "Loading…"}</p></PatientFrame>;
  // One number per phone: a phone that already has today's number sees it again instead of taking another.
  const existing = storedTicket(state);

  const take = async () => {
    setBusy(true);
    const result = await queue.dispatch({ type: "qrArrive" });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    writeStorage(TICKET_KEY, JSON.stringify({ id: result.visitId, day: state.day }));
    router.push(`/queue/ticket?id=${result.visitId}`);
  };

  return (
    <PatientFrame clinic={clinicNameOf(state.settings)}>
      <h1 className="text-2xl font-bold tracking-tight">Get your queue number</h1>
      <p className="mt-1 text-[#6a604f]">Then please wait in the lobby. The Concierge will call your number to register you.</p>
      {queue.mode === "local" && <p className="mt-5 rounded-xl bg-[#fff9e9] px-4 py-3 text-sm text-[#5f4307]">This page is running in single-device mode and only works on the front-desk computer.</p>}
      {existing ? (
        <Link href={`/queue/ticket?id=${existing.id}`} className="mt-6 flex items-center gap-4 rounded-2xl bg-[#2f281c] p-5 text-white">
          <Ticket className="shrink-0 text-[#f0c864]" />
          <span className="flex-1"><span className="block text-sm text-[#e8dec7]">Your queue number today</span><span className="font-mono text-3xl font-extrabold">{arrivalLabel(existing)}</span></span>
          <span className="font-semibold">View →</span>
        </Link>
      ) : (
        <div className="mt-6 grid gap-3">
          {error && <p role="alert" className="text-sm font-semibold text-[#b4233c]">{error}</p>}
          <Button onClick={() => void take()} disabled={busy} className="h-14 bg-[#8b6512] text-lg text-white hover:bg-[#6f4e0a]">{busy ? "Getting your number…" : "Get my queue number"}</Button>
          <p className="text-xs leading-5 text-[#857967]">One number per person. Watch the lobby TV for your number.</p>
        </div>
      )}
    </PatientFrame>
  );
}

export function TicketView() {
  const queue = useQueue();
  const id = useSearchParams().get("id");
  const state = queue.state;
  const visit = state?.visits.find((item) => item.id === id);
  const status = visit ? visitStatus(visit) : null;
  // An arrival number the Concierge has called to register counts as called, so the phone buzzes for it too.
  const calledNow = status === "called" || (status === "registration" && Boolean(visit?.regCalledAt));
  const lastStatus = useRef(false);
  const now = useNow(30000);

  useEffect(() => {
    if (calledNow && !lastStatus.current) navigator.vibrate?.([400, 150, 400]);
    lastStatus.current = calledNow;
  }, [calledNow]);

  if (!state) return <PatientFrame><p className="py-16 text-center text-[#756b59]">{queue.error || "Loading…"}</p></PatientFrame>;
  if (!visit || visit.cancelled) return <PatientFrame><h1 className="text-xl font-bold">Queue number not found</h1><p className="mt-2 text-[#6a604f]">It may be from a previous day. Please ask the front desk for help.</p><Link href="/queue/checkin" className="mt-5 inline-block font-semibold text-[#8b6512] underline">Go to check-in</Link></PatientFrame>;

  const step = currentStep(visit);
  const station = step ? findStation(state, step.station) : undefined;
  const toRegister = waitingToRegister(state).filter((item) => !item.regCalledAt);
  const ahead = status === "registration" ? Math.max(0, toRegister.findIndex((item) => item.id === visit.id)) : patientsAhead(state, visit);
  // Where to go, in a dark box that stands out on the gold "It's your turn" card.
  const place = (name: string) => <span className="ml-1 inline-block rounded-md bg-[#2f281c] px-2 py-0.5 font-bold text-[#f0c864]">{name}</span>;
  const messages: Record<string, { title: string; text: React.ReactNode; icon: React.ReactNode; tone: string }> = {
    called: { title: "It's your turn!", text: <>Please proceed to {place(station?.name ?? "your station")}</>, icon: <BellRing />, tone: "bg-[#d8a321] text-[#2f281c]" },
    waiting: { title: ahead === 0 ? "You're next" : `${ahead} patient${ahead > 1 ? "s" : ""} ahead of you`, text: `Waiting for ${station?.name ?? "your service"}. Watch the lobby TV for your number.`, icon: <Clock />, tone: "bg-[#fff2c8] text-[#5f4307]" },
    missed: { title: "We called your number", text: "Please approach the front desk so we can put you back in line.", icon: <BellRing />, tone: "bg-[#fde8eb] text-[#9b1f35]" },
    registration: visit.regCalledAt
      ? { title: "It's your turn!", text: <>Please proceed to {place("the Concierge")}</>, icon: <BellRing />, tone: "bg-[#d8a321] text-[#2f281c]" }
      : { title: ahead === 0 ? "You're next" : `${ahead} patient${ahead > 1 ? "s" : ""} ahead of you`, text: "Please wait in the lobby. The Concierge will call your number to register you. Watch the lobby TV.", icon: <Clock />, tone: "bg-[#fff2c8] text-[#5f4307]" },
    completed: { title: "All done for today", text: `Thank you for visiting ${clinicNameOf(state.settings)}.`, icon: <CheckCircle2 />, tone: "bg-[#edf5e8] text-[#41612c]" },
  };
  const message = messages[status ?? "waiting"] ?? messages.waiting;
  const wait = now ? estimatedWait(state, visit, now) : null;

  return (
    <PatientFrame clinic={clinicNameOf(state.settings)}>
      <section className="rounded-2xl bg-[#2f281c] p-6 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f0c864]">Your queue number</p>
        <p className="mt-2 font-mono text-5xl font-extrabold tracking-wide">{arrivalLabel(visit)}</p>
        <p className="mt-2 text-sm text-[#e8dec7]">Keep this number for every service today.</p>
      </section>
      <div className={`mt-4 flex items-start gap-3 rounded-2xl p-4 ${message.tone}`} role="status" aria-live="polite">
        <span className="mt-0.5 shrink-0">{message.icon}</span>
        <div><p className="text-lg font-bold">{message.title}</p><p className="text-sm">{message.text}</p></div>
      </div>
      {wait !== null && (
        <div className="mt-3 rounded-2xl border border-[#e2d7c2] bg-white p-4">
          <p className="text-sm font-semibold text-[#756b59]">Estimated waiting time</p>
          <p className="text-2xl font-extrabold">{formatEstimate(wait)}</p>
          <p className="mt-1 text-xs leading-5 text-[#857967]">Based on today&apos;s pace at {station?.name ?? "this station"}. Priority lane patients may be called first.</p>
        </div>
      )}
      {visit.steps.length > 0 && <ol className="mt-5 grid gap-2">
        {visit.steps.map((item, index) => (
          <li key={item.id} className="flex items-center gap-3 rounded-xl border border-[#e2d7c2] bg-white px-4 py-3">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${item.status === "done" ? "bg-[#edf5e8] text-[#41612c]" : item === step ? "bg-[#2f281c] text-[#f0c864]" : "bg-[#f2ecdf] text-[#857967]"}`}>{item.status === "done" ? "✓" : index + 1}</span>
            <span className="flex-1">{findStation(state, item.station)?.name ?? item.station}</span>
            <span className="font-mono text-sm text-[#756b59]">{item.station}</span>
          </li>
        ))}
      </ol>}
      {!visit.verified && <p className="mt-5 text-sm text-[#6a604f]">Please drop by the front desk once so staff can confirm your check-in.</p>}
      <p className="mt-6 text-center text-xs text-[#857967]">This page updates automatically.</p>
    </PatientFrame>
  );
}

function QrCode({ value }: { value: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#2f281c", light: "#ffffff" } }).then((markup) => { if (active) setSvg(markup); });
    return () => { active = false; };
  }, [value]);
  return <div className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full" role="img" aria-label={`QR code for ${value}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function CheckInPoster() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setUrl(`${window.location.origin}/queue/checkin`), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <main className="min-h-screen bg-[#f7f4ed] py-8 text-[#2e291f] print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[680px] justify-between gap-3 px-5 print:hidden">
        <Link href="/queue" className="font-semibold text-[#8b6512] underline">← Front desk</Link>
        <Button onClick={() => window.print()} className="bg-[#8b6512] text-white hover:bg-[#6f4e0a]"><Printer size={16} /> Print poster</Button>
      </div>
      <article className="mx-auto max-w-[680px] rounded-3xl border border-[#e2d7c2] bg-white p-10 text-center shadow-sm print:border-0 print:shadow-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/theheartspecialists.png" alt="The Heart Specialists Clinic logo" width="104" height="80" className="mx-auto h-20 w-auto object-contain" />
        <p className="mt-3 text-sm font-semibold tracking-[0.12em] text-[#8b6512]">THE HEART SPECIALISTS CLINIC</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Get your queue number</h1>
        <p className="mt-2 text-xl text-[#5e5443]">Scan with your phone camera.</p>
        <div className="mx-auto mt-8 w-72 rounded-2xl border-4 border-[#2f281c] p-3">{url && <QrCode value={url} />}</div>
        <p className="mt-3 break-all font-mono text-sm text-[#756b59]">{url}</p>
        <ol className="mx-auto mt-8 grid max-w-md gap-3 text-left text-lg">
          <li><strong>1.</strong> Scan the code and tap <em>Get my queue number</em>.</li>
          <li><strong>2.</strong> Your queue number (e.g. 07) appears on your phone.</li>
          <li><strong>3.</strong> Wait in the lobby. The Concierge calls your number on the TV to register you.</li>
        </ol>
      </article>
    </main>
  );
}
