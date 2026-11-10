"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { BellRing, CheckCircle2, Clock, Printer, Ticket, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arrivalLabel, clinicNameOf, currentStep, DEFAULT_CLINIC, findStation, patientWifiOf, phMobile, purposeOptions, qrAddressOf, vitalsPlaceOf, waitingToRegister, wifiQrText } from "@/lib/queue/reducer";
import { estimatedWait, formatEstimate, patientsAhead, setWaitMinutes, visitStatus } from "@/lib/queue/format";
import type { PatientWifi, QueueState } from "@/lib/queue/types";
import { useCallAlert } from "./call-alert";
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

/** The QR code at the Concierge: the patient gives their name and purpose of visit and gets a queue number. The Concierge registers them when calling it. */
export function CheckIn() {
  const queue = useQueue();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [other, setOther] = useState("");
  // "I have an appointment": a pre-scheduled patient checks in with the name and cellphone they gave when booking.
  const [appointment, setAppointment] = useState(false);
  const state = queue.state;

  if (!state) return <PatientFrame><p className="py-16 text-center text-[#756b59]">{queue.error || "Loading…"}</p></PatientFrame>;
  // One number per phone: a phone that already has today's number sees it again instead of taking another.
  const existing = storedTicket(state);

  const options = purposeOptions(state.settings);
  const toggle = (label: string) => setPurposes((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]));
  const ready = name.trim().length >= 2 && purposes.length > 0;
  const take = async () => {
    if (!ready) { setError(name.trim().length < 2 ? "Please type your full name." : "Please choose the purpose of your visit."); return; }
    const phone = phMobile(mobile);
    if (phone === null) { setError("Please check your cellphone number (11 digits, e.g. 0917 123 4567), or leave it empty."); return; }
    setBusy(true);
    // "Other" carries what the patient typed, e.g. "Other: follow-up for my mother".
    const chosen = purposes.map((purpose) => (purpose === "Other" && other.trim() ? `Other: ${other.trim()}` : purpose));
    const result = await queue.dispatch({ type: "qrArrive", name: name.trim(), mobile: phone, purposes: chosen });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    writeStorage(TICKET_KEY, JSON.stringify({ id: result.visitId, day: state.day }));
    router.push(`/queue/ticket?id=${result.visitId}`);
  };
  const checkIn = async () => {
    if (name.trim().length < 2) { setError("Please type your full name."); return; }
    const phone = phMobile(mobile);
    if (!phone) { setError("Please type the cellphone number you gave for your appointment (11 digits, e.g. 0917 123 4567)."); return; }
    setBusy(true);
    const result = await queue.dispatch({ type: "selfCheckIn", name: name.trim(), mobile: phone });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    writeStorage(TICKET_KEY, JSON.stringify({ id: result.visitId, day: state.day }));
    router.push(`/queue/ticket?id=${result.visitId}`);
  };
  const tab = (on: boolean) => `h-11 flex-1 rounded-lg text-sm font-bold ${on ? "bg-white text-[#2f281c] shadow-sm" : "text-[#756b59]"}`;

  return (
    <PatientFrame clinic={clinicNameOf(state.settings)}>
      <h1 className="text-2xl font-bold tracking-tight">{appointment && !existing ? "Check in for your appointment" : "Get your queue number"}</h1>
      <p className="mt-1 text-[#6a604f]">{existing ? "Please wait in the lobby and watch the TV for your number." : appointment ? "Type the name and cellphone number you gave when your appointment was made. You are marked as arrived and get your queue number." : "Tell us your name and why you are here. The Concierge sees it when calling your number to register you."}</p>
      {!existing && (
        <div className="mt-5 flex gap-1 rounded-xl bg-[#ece4d3] p-1" role="tablist" aria-label="Type of visit">
          <button type="button" role="tab" aria-selected={!appointment} className={tab(!appointment)} onClick={() => { setAppointment(false); setError(""); }}>🎫 New visit</button>
          <button type="button" role="tab" aria-selected={appointment} className={tab(appointment)} onClick={() => { setAppointment(true); setError(""); }}>📅 Appointment</button>
        </div>
      )}
      {queue.mode === "local" && <p className="mt-5 rounded-xl bg-[#fff9e9] px-4 py-3 text-sm text-[#5f4307]">This page is running in single-device mode and only works on the front-desk computer.</p>}
      {existing ? (
        <Link href={`/queue/ticket?id=${existing.id}`} className="mt-6 flex items-center gap-4 rounded-2xl bg-[#2f281c] p-5 text-white">
          <Ticket className="shrink-0 text-[#f0c864]" />
          <span className="flex-1"><span className="block text-sm text-[#e8dec7]">Your queue number today</span><span className="font-mono text-3xl font-extrabold">{arrivalLabel(existing)}</span></span>
          <span className="font-semibold">View →</span>
        </Link>
      ) : appointment ? (
        <form className="mt-6 grid gap-5" onSubmit={(event) => { event.preventDefault(); void checkIn(); }}>
          <label className="grid gap-1.5 text-sm font-semibold text-[#514838]">
            Your full name
            <input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} autoComplete="name" maxLength={80} placeholder="e.g. Juan Dela Cruz" className="h-12 rounded-xl border border-[#d8c79f] bg-white px-3 text-base font-normal text-[#2e291f]" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-[#514838]">
            Cellphone number
            <input value={mobile} onChange={(event) => { setMobile(event.target.value); setError(""); }} type="tel" inputMode="numeric" autoComplete="tel" maxLength={16} placeholder="09XX XXX XXXX" className="h-12 rounded-xl border border-[#d8c79f] bg-white px-3 font-mono text-base font-normal tracking-wide text-[#2e291f]" />
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-[#b4233c]">{error}</p>}
          <Button type="submit" disabled={busy} className="h-14 bg-[#1f7a70] text-lg text-white hover:bg-[#17625a]">{busy ? "Finding your appointment…" : "✓ Check in"}</Button>
          <p className="text-xs leading-5 text-[#857967]">No appointment found? Choose <b>New visit</b> above, or ask the Concierge.</p>
        </form>
      ) : (
        <form className="mt-6 grid gap-5" onSubmit={(event) => { event.preventDefault(); void take(); }}>
          <label className="grid gap-1.5 text-sm font-semibold text-[#514838]">
            Your full name
            <input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} autoComplete="name" maxLength={80} placeholder="e.g. Juan Dela Cruz" className="h-12 rounded-xl border border-[#d8c79f] bg-white px-3 text-base font-normal text-[#2e291f]" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-[#514838]">
            <span>Cellphone number <span className="font-normal text-[#857967]">(optional, so the Concierge does not need to ask)</span></span>
            <input value={mobile} onChange={(event) => { setMobile(event.target.value); setError(""); }} type="tel" inputMode="numeric" autoComplete="tel" maxLength={16} placeholder="09XX XXX XXXX" className="h-12 rounded-xl border border-[#d8c79f] bg-white px-3 font-mono text-base font-normal tracking-wide text-[#2e291f]" />
          </label>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-semibold text-[#514838]">Purpose of your visit <span className="font-normal text-[#857967]">(choose all that apply)</span></legend>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => {
                const on = purposes.includes(option.label);
                return (
                  <button key={option.label} type="button" aria-pressed={on} onClick={() => { toggle(option.label); setError(""); }}
                    className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold ${on ? "border-[#8b6512] bg-[#8b6512] text-white" : "border-[#d8c79f] bg-white text-[#514838]"}`}>
                    {on ? "✓ " : ""}{option.label}
                  </button>
                );
              })}
            </div>
            {purposes.includes("Other") && <input value={other} onChange={(event) => setOther(event.target.value)} maxLength={60} placeholder="Please tell us (optional)" aria-label="Other purpose" className="h-11 rounded-xl border border-[#d8c79f] bg-white px-3 text-base text-[#2e291f]" />}
          </fieldset>
          {error && <p role="alert" className="text-sm font-semibold text-[#b4233c]">{error}</p>}
          <Button type="submit" disabled={busy} className="h-14 bg-[#8b6512] text-lg text-white hover:bg-[#6f4e0a]">{busy ? "Getting your number…" : "Get my queue number"}</Button>
          <p className="text-xs leading-5 text-[#857967]">One number per person. Your name and cellphone are seen only by the clinic staff, never on the TV. Watch the lobby TV for your number.</p>
        </form>
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
  // A clinic calling the patient for vital signs counts as called too.
  const vitalsStep = visit ? currentStep(visit) : null;
  const vitalsNow = status === "waiting" && Boolean(vitalsStep?.vitalsCalledAt) && !vitalsStep?.vitalsDoneAt;
  const calledNow = status === "called" || vitalsNow || (status === "registration" && Boolean(visit?.regCalledAt));
  const now = useNow(30000);
  // Changes with every call and "Call again", so the phone rings each time the staff calls the number.
  const callKey = !visit || !calledNow ? null
    : vitalsNow ? `vitals:${vitalsStep?.id}:${vitalsStep?.vitalsCalledAt}`
    : status === "called" ? `call:${vitalsStep?.id}:${vitalsStep?.calledAt}`
    : `reg:${visit.id}:${visit.regCalledAt}`;
  const callAlert = useCallAlert(callKey, visit ? arrivalLabel(visit) : "");

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
    vitals: { title: "Vital signs first", text: <>Please proceed to {place(vitalsPlaceOf(state.settings))} before {station?.name ?? "your clinic"}.</>, icon: <BellRing />, tone: "bg-[#d8a321] text-[#2f281c]" },
    waiting: { title: ahead === 0 ? "You're next" : `${ahead} patient${ahead > 1 ? "s" : ""} ahead of you`, text: `Waiting for ${station?.name ?? "your service"}. Watch the lobby TV for your number.`, icon: <Clock />, tone: "bg-[#fff2c8] text-[#5f4307]" },
    missed: { title: "We called your number", text: "Please approach the front desk so we can put you back in line.", icon: <BellRing />, tone: "bg-[#fde8eb] text-[#9b1f35]" },
    expected: { title: "You're pre-registered", text: `Your number is ready${visit.appointment ? ` for ${visit.appointment}` : ""}. When you arrive, please tell the Concierge so you join the line.`, icon: <Clock />, tone: "bg-[#dff1ef] text-[#1d5a56]" },
    registration: visit.regCalledAt
      ? { title: "It's your turn!", text: <>Please proceed to {place(visit.kind === "H" ? "HMO Desk" : "Concierge")}</>, icon: <BellRing />, tone: "bg-[#d8a321] text-[#2f281c]" }
      : { title: ahead === 0 ? "You're next" : `${ahead} patient${ahead > 1 ? "s" : ""} ahead of you`, text: `Please wait in the lobby. ${visit.kind === "H" ? "The HMO Desk" : "The Concierge"} will call your number to register you. Watch the lobby TV.`, icon: <Clock />, tone: "bg-[#fff2c8] text-[#5f4307]" },
    completed: { title: "All done for today", text: `Thank you for visiting ${clinicNameOf(state.settings)}.`, icon: <CheckCircle2 />, tone: "bg-[#edf5e8] text-[#41612c]" },
  };
  const message = (vitalsNow ? messages.vitals : messages[status ?? "waiting"]) ?? messages.waiting;
  const wait = now ? estimatedWait(state, visit, now) : null;

  return (
    <PatientFrame clinic={clinicNameOf(state.settings)}>
      <section className="rounded-2xl bg-[#2f281c] p-6 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f0c864]">Your queue number</p>
        <p className="mt-2 font-mono text-5xl font-extrabold tracking-wide">{arrivalLabel(visit)}</p>
        <p className="mt-2 text-sm text-[#e8dec7]">Keep this number for every service today.</p>
      </section>
      <div className={`mt-4 rounded-2xl p-4 ${message.tone} ${callAlert.ringing ? "ring-4 ring-[#d8a321]/40" : ""}`} role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 shrink-0 ${callAlert.ringing ? "animate-bounce" : ""}`}>{message.icon}</span>
          <div><p className="text-lg font-bold">{message.title}</p><p className="text-sm">{message.text}</p></div>
        </div>
        {callAlert.ringing && (
          <button type="button" onClick={callAlert.acknowledge} className="mt-3 h-12 w-full rounded-xl bg-[#2f281c] text-base font-bold text-[#f0c864]">
            ✓ OK, I&apos;m on my way
          </button>
        )}
      </div>
      {status !== "completed" && (callAlert.soundOn ? (
        <p className="mt-3 flex items-center justify-center gap-2 text-center text-sm text-[#41612c]">
          <Volume2 className="h-4 w-4 shrink-0" /> <span>Sound on: your phone rings when it&apos;s your turn.</span>
          <button type="button" onClick={callAlert.test} className="font-semibold text-[#8b6512] underline">Test</button>
        </p>
      ) : (
        <button type="button" data-sound-button onClick={callAlert.test} className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-[#c9962b] bg-white p-4 text-left">
          <Volume2 className="shrink-0 text-[#8b6512]" />
          <span><span className="block font-bold text-[#2f281c]">Tap here to turn on the call sound</span><span className="block text-sm text-[#6a604f]">Your phone will ring and vibrate when your number is called. Keep this page open and your volume up.</span></span>
        </button>
      ))}
      {wait !== null && (
        <div className="mt-3 rounded-2xl border border-[#e2d7c2] bg-white p-4">
          <p className="text-sm font-semibold text-[#756b59]">Estimated waiting time</p>
          <p className="text-2xl font-extrabold">{formatEstimate(wait)}</p>
          <p className="mt-1 text-xs leading-5 text-[#857967]">{step && setWaitMinutes(state, step.station) !== null ? `About ${setWaitMinutes(state, step.station)} min per patient at ${station?.name ?? "this station"}.` : `Based on today's pace at ${station?.name ?? "this station"}.`} Priority lane patients may be called first.</p>
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
    // Black on white with the standard 4-module white border ("quiet zone"): phone camera apps (iPhone Camera, Samsung and
    // other Android cameras) need it to find the code; Google Lens also reads codes without it.
    void QRCode.toString(value, { type: "svg", margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then((markup) => { if (active) setSvg(markup); });
    return () => { active = false; };
  }, [value]);
  return <div className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full" role="img" aria-label={`QR code for ${value}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const CHECKIN_PATH = "/queue/checkin";

export function CheckInPoster() {
  const [url, setUrl] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [warning, setWarning] = useState("");
  // The address set in System configuration → QR code poster, if any.
  const [saved, setSaved] = useState("");
  // What staff type in "QR code address" above the poster, to change it for this print.
  const [typed, setTyped] = useState<string | null>(null);
  // The patient Wi-Fi (System configuration → QR code poster): a second QR code to join it.
  const [wifi, setWifi] = useState<PatientWifi | undefined>(undefined);
  useEffect(() => {
    const { hostname, port, protocol, origin } = window.location;
    let cancelled = false;
    const automatic = () => {
      if (!LOCAL_HOSTS.includes(hostname)) { setUrl(`${origin}${CHECKIN_PATH}`); return; }
      // Opened on the clinic server itself: "localhost" on a phone is the phone, so use this computer's network address.
      const fallback = () => {
        setUrl(`${origin}${CHECKIN_PATH}`);
        setWarning("This QR code points to localhost, which phones cannot open. Type the server's address in QR code address above, or set it in System configuration → QR code poster.");
      };
      fetch("/api/server-info", { cache: "no-store" })
        .then((response) => response.json() as Promise<{ addresses?: string[] }>)
        .then(({ addresses = [] }) => {
          if (cancelled) return;
          const list = addresses.map((address) => `${protocol}//${address}${port ? `:${port}` : ""}${CHECKIN_PATH}`);
          setChoices(list);
          if (list.length) setUrl(list[0]);
          else fallback();
        })
        .catch(() => { if (!cancelled) fallback(); });
    };
    fetch("/api/queue", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ state?: QueueState }>)
      .then(({ state }) => {
        if (cancelled) return;
        setWifi(patientWifiOf(state?.settings.patientWifi));
        const address = qrAddressOf(state?.settings.qrAddress);
        if (address) { setSaved(address); setUrl(`${address}${CHECKIN_PATH}`); } else automatic();
      })
      .catch(() => { if (!cancelled) automatic(); });
    return () => { cancelled = true; };
  }, []);
  const typedAddress = typed === null ? undefined : qrAddressOf(typed);
  const shown = typedAddress ? `${typedAddress}${CHECKIN_PATH}` : url;
  const changeAddress = (value: string) => {
    setTyped(value);
    const address = qrAddressOf(value);
    if (address) setWarning("");
  };
  // A local network address only works on the clinic Wi-Fi, so the printed poster says so.
  const onClinicNetwork = /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(shown);

  return (
    <main className="min-h-screen bg-[#f7f4ed] py-8 text-[#2e291f] print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[680px] justify-between gap-3 px-5 print:hidden">
        <Link href="/queue" className="font-semibold text-[#8b6512] underline">← Front desk</Link>
        <Button onClick={() => window.print()} className="bg-[#8b6512] text-white hover:bg-[#6f4e0a]"><Printer size={16} /> Print poster</Button>
      </div>
      <label className="mx-auto mb-4 grid max-w-[680px] gap-1.5 px-5 text-sm font-semibold text-[#514838] print:hidden">
        QR code address
        <span className="text-xs font-normal text-[#756b59]">The address patients&apos; phones open, e.g. http://172.16.100.62:3000. {saved ? "Set in System configuration → QR code poster." : "Set it in System configuration → QR code poster to keep it for every poster."} A change here is only for this print.</span>
        <input value={typed ?? shown.replace(CHECKIN_PATH, "")} onChange={(event) => changeAddress(event.target.value)} spellCheck={false} className="rounded-lg border border-[#e2d7c2] bg-white px-3 py-2 font-mono font-normal" aria-label="QR code address" />
        {typed !== null && typedAddress === null && <span role="alert" className="text-xs font-semibold text-[#9b1f35]">That is not an address. Use one like http://172.16.100.62:3000.</span>}
      </label>
      {!saved && typed === null && choices.length > 1 && (
        <label className="mx-auto mb-4 grid max-w-[680px] gap-1.5 px-5 text-sm font-semibold text-[#514838] print:hidden">
          This computer has more than one network address. Choose the one on the clinic Wi-Fi:
          <select value={url} onChange={(event) => setUrl(event.target.value)} className="rounded-lg border border-[#e2d7c2] bg-white px-3 py-2 font-mono font-normal">
            {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </select>
        </label>
      )}
      {warning && <p role="alert" className="mx-auto mb-4 max-w-[680px] rounded-xl bg-[#fde8eb] px-5 py-3 text-sm font-semibold text-[#9b1f35] print:hidden">{warning}</p>}
      <article className="mx-auto max-w-[680px] rounded-3xl border border-[#e2d7c2] bg-white p-10 text-center shadow-sm print:border-0 print:shadow-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/theheartspecialists.png" alt="The Heart Specialists Clinic logo" width="104" height="80" className="mx-auto h-20 w-auto object-contain" />
        <p className="mt-3 text-sm font-semibold tracking-[0.12em] text-[#8b6512]">THE HEART SPECIALISTS CLINIC</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Get your queue number</h1>
        <p className="mt-2 text-xl text-[#5e5443]">{wifi ? "Two quick scans with your phone camera." : "Scan with your phone camera."}</p>
        {wifi ? (
          <div className="mt-7 grid grid-cols-2 gap-5 text-left">
            <div className="flex flex-col items-center rounded-2xl border border-[#e2d7c2] p-3 text-center">
              <p className="text-lg font-extrabold"><span className="mr-1 inline-grid h-7 w-7 place-items-center rounded-full bg-[#2f281c] text-sm text-[#f0c864]">1</span> Connect to our Wi-Fi</p>
              <p className="text-xs text-[#756b59]">Scan with the camera, then tap Join</p>
              <div className="mt-2 w-full max-w-[250px]"><QrCode value={wifiQrText(wifi)} /></div>
              <p className="text-sm text-[#5e5443]">📶 <b className="font-mono">{wifi.ssid}</b></p>
              {wifi.security !== "nopass" && <p className="text-sm text-[#5e5443]">Password: <b className="font-mono">{wifi.password}</b></p>}
            </div>
            <div className="flex flex-col items-center rounded-2xl border-2 border-[#2f281c] p-3 text-center">
              <p className="text-lg font-extrabold"><span className="mr-1 inline-grid h-7 w-7 place-items-center rounded-full bg-[#2f281c] text-sm text-[#f0c864]">2</span> Get your queue number</p>
              <p className="text-xs text-[#756b59]">Scan with the camera, then open the link</p>
              <div className="mt-2 w-full max-w-[250px]">{shown && <QrCode value={shown} />}</div>
              <p className="text-xs text-[#756b59]">No QR scanner? Type in the browser:</p>
              <p className="break-all font-mono text-sm font-bold text-[#2f281c]">{shown.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>
        ) : (
          <>
          <div className="mx-auto mt-8 w-96 max-w-full rounded-2xl border border-[#e2d7c2] bg-white p-1">{shown && <QrCode value={shown} />}</div>
          <p className="mt-3 text-sm text-[#756b59]">No QR scanner? Type this in the browser:</p>
          <p className="mt-1 break-all font-mono text-xl font-bold text-[#2f281c]">{shown.replace(/^https?:\/\//, "")}</p>
          {onClinicNetwork && <p className="mt-4 rounded-xl bg-[#fff2c8] px-4 py-2 text-lg font-semibold text-[#5f4307]">Connect to the clinic Wi-Fi first.</p>}
          </>
        )}
        <ol className="mx-auto mt-8 grid max-w-md gap-3 text-left text-lg">
          <li><strong>1.</strong> {wifi ? <>Scan QR 1 to join our Wi-Fi (on mobile data the page will not open), then scan QR 2 and tap <em>Get my queue number</em>.</> : <>Scan the code and tap <em>Get my queue number</em>.</>}</li>
          <li><strong>2.</strong> Your queue number (e.g. 07) appears on your phone.</li>
          <li><strong>3.</strong> Wait in the lobby. The Concierge calls your number on the TV to register you.</li>
        </ol>
      </article>
    </main>
  );
}

/** A printable poster with the QR code of the clinic's Telegram bot, so patients link their number for queue reminders. */
export function TelegramPoster() {
  const [bot, setBot] = useState<string | null>(null);
  const [clinic, setClinic] = useState(DEFAULT_CLINIC);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/queue", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ state?: QueueState }>)
      .then(({ state }) => {
        if (cancelled) return;
        setBot(state?.settings.sms?.telegramBot || "");
        setClinic(clinicNameOf(state?.settings));
      })
      .catch(() => { if (!cancelled) setBot(""); });
    return () => { cancelled = true; };
  }, []);
  const link = bot ? `https://t.me/${bot}` : "";

  return (
    <main className="min-h-screen bg-[#f7f4ed] py-8 text-[#2e291f] print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[680px] justify-between gap-3 px-5 print:hidden">
        <Link href="/queue" className="font-semibold text-[#8b6512] underline">← Front desk</Link>
        <Button onClick={() => window.print()} disabled={!link} className="bg-[#8b6512] text-white hover:bg-[#6f4e0a]"><Printer size={16} /> Print poster</Button>
      </div>
      {bot === "" && <p role="alert" className="mx-auto mb-4 max-w-[680px] rounded-xl bg-[#fde8eb] px-5 py-3 text-sm font-semibold text-[#9b1f35] print:hidden">Telegram reminders are not set up yet. In System configuration → Patient reminders, choose Telegram, paste the bot token, click Check bot and Save configuration.</p>}
      <article className="mx-auto max-w-[680px] rounded-3xl border border-[#e2d7c2] bg-white p-10 text-center shadow-sm print:border-0 print:shadow-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/theheartspecialists.png" alt="The Heart Specialists Clinic logo" width="104" height="80" className="mx-auto h-20 w-auto object-contain" />
        <p className="mt-3 text-sm font-semibold tracking-[0.12em] text-[#8b6512]">{clinic.toUpperCase()}</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Queue reminders on Telegram</h1>
        <p className="mt-2 text-xl text-[#5e5443]">Get your queue number and a message when you are next in line.</p>
        <div className="mx-auto mt-8 w-96 max-w-full rounded-2xl border border-[#229ED9] bg-white p-1">{link && <QrCode value={link} />}</div>
        {link && <p className="mt-3 font-mono text-lg font-semibold text-[#229ED9]">t.me/{bot}</p>}
        <ol className="mx-auto mt-8 grid max-w-md gap-3 text-left text-lg">
          <li><strong>1.</strong> Scan the code with your phone camera. Telegram opens.</li>
          <li><strong>2.</strong> Tap <em>Start</em>.</li>
          <li><strong>3.</strong> Tap <em>📱 Share my phone number</em>. Use the cellphone number you gave the clinic.</li>
        </ol>
        <p className="mt-6 text-base text-[#756b59]">You only do this once. Send /stop to the bot anytime to stop the reminders.</p>
      </article>
    </main>
  );
}
