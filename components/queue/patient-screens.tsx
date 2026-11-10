"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicNameOf, DEFAULT_CLINIC, patientWifiOf, qrAddressOf, wifiQrText } from "@/lib/queue/reducer";
import type { PatientWifi, QueueState } from "@/lib/queue/types";

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
              {wifi.security !== "nopass" && (wifi.showPassword !== false
                ? <p className="text-sm text-[#5e5443]">Password: <b className="font-mono">{wifi.password}</b></p>
                : <p className="text-xs text-[#756b59]">Password: scan the code, or ask the Concierge</p>)}
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
