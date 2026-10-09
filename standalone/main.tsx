import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckCircle2, Cloud, Monitor, MonitorSmartphone, QrCode, Stethoscope, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DisplayBoard } from "@/components/queue/display-board";
import { FrontDesk } from "@/components/queue/front-desk";
import { CheckIn, CheckInPoster, TicketView } from "@/components/queue/patient-screens";
import { StationScreen } from "@/components/queue/station-screen";
import { checkServer, DEFAULT_SERVER, normalizeServer, setSyncServer, syncServer, type ServerCheck } from "./server";
import { navigate, usePathname } from "./shims/navigation";

// The build script inlines this image into the HTML file.
const LOGO = "/theheartspecialists.png";

type Route = { title: string; screen: () => React.ReactNode; serverBar?: boolean };

const ROUTES: Record<string, Route> = {
  "/queue": { title: "Front Desk", screen: () => <FrontDesk />, serverBar: true },
  "/queue/station": { title: "Stations", screen: () => <StationScreen />, serverBar: true },
  "/queue/display": { title: "TV Display", screen: () => <DisplayBoard /> },
  "/queue/poster": { title: "Check-in QR Poster", screen: () => <CheckInPoster />, serverBar: true },
  "/queue/checkin": { title: "Check-in", screen: () => <CheckIn /> },
  "/queue/ticket": { title: "My Queue Number", screen: () => <TicketView /> },
  "/setup": { title: "Sync Setup", screen: () => <Setup /> },
};

function host(server: string) {
  try {
    return new URL(server).host;
  } catch {
    return server;
  }
}

/** Strip above the staff screens saying which sync server this computer uses. */
function ServerBar() {
  const server = syncServer();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#1f1a12] px-4 py-1.5 text-xs text-[#e8dec7] print:hidden">
      {server
        ? <span className="inline-flex items-center gap-1.5"><Cloud size={13} className="text-[#f0c864]" /> Synced through <strong className="font-semibold text-white">{host(server)}</strong></span>
        : <span className="inline-flex items-center gap-1.5"><Monitor size={13} className="text-[#f0c864]" /> Not synced: this computer only</span>}
      <a href="#/setup" className="font-semibold text-[#f0c864] underline underline-offset-2">Change</a>
    </div>
  );
}

const SCREENS = [
  { href: "/queue", label: "Front desk", note: "Concierge: cards, registration, patient list", icon: <Users size={18} /> },
  { href: "/queue/station", label: "Stations", note: "Doctors, procedures and laboratory", icon: <Stethoscope size={18} /> },
  { href: "/queue/display", label: "TV display", note: "Lobby TV (opens in a new window)", icon: <Monitor size={18} />, newTab: true },
  { href: "/queue/poster", label: "Check-in QR poster", note: "Print for the entrance", icon: <QrCode size={18} /> },
];

function Setup() {
  const saved = syncServer();
  const [shared, setShared] = useState(saved !== "");
  const [address, setAddress] = useState(saved || DEFAULT_SERVER);
  const [check, setCheck] = useState<ServerCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const server = normalizeServer(address);

  const test = async () => {
    if (!server) return;
    setBusy(true);
    setCheck(await checkServer(server));
    setBusy(false);
  };
  const save = () => {
    if (shared && !server) return;
    setSyncServer(shared ? server! : "");
    navigate("/queue");
  };

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#2e291f]">
      <header className="bg-[#2f281c] px-5 py-4 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="The Heart Specialists Clinic logo" width="52" height="40" className="h-10 w-[52px] object-contain" />
          <div><p className="text-xs font-semibold tracking-[0.08em] text-[#f0c864]">THE HEART SPECIALISTS CLINIC</p><h1 className="text-lg font-bold">Queue Board · Connect this computer</h1></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-2xl gap-5 px-5 py-6">
        <section className="rounded-2xl border border-[#e2d7c2] bg-[#fffefb] p-5 shadow-sm">
          <h2 className="text-base font-bold">How this computer keeps the queue</h2>
          <p className="mt-1 text-sm leading-6 text-[#756b59]">Open this same HTML file on every computer (front desk, stations, lobby TV) and choose the same sync server. They then share one live queue, refreshed every 2 seconds.</p>
          <div className="mt-4 grid gap-2">
            <label className={`flex items-start gap-3 rounded-xl border p-3 ${shared ? "border-[#8b6512] bg-[#fff9e9]" : "border-[#e2d7c2] bg-white"}`}>
              <input type="radio" name="mode" checked={shared} onChange={() => setShared(true)} className="mt-1 h-4 w-4 accent-[#8b6512]" />
              <span><span className="flex items-center gap-2 font-semibold"><MonitorSmartphone size={16} /> Sync with other computers</span><span className="block text-sm text-[#756b59]">Needs the internet (or the clinic network for a server on a clinic PC).</span></span>
            </label>
            <label className={`flex items-start gap-3 rounded-xl border p-3 ${!shared ? "border-[#8b6512] bg-[#fff9e9]" : "border-[#e2d7c2] bg-white"}`}>
              <input type="radio" name="mode" checked={!shared} onChange={() => setShared(false)} className="mt-1 h-4 w-4 accent-[#8b6512]" />
              <span><span className="flex items-center gap-2 font-semibold"><Monitor size={16} /> This computer only</span><span className="block text-sm text-[#756b59]">Works offline. The TV must be this computer&apos;s second screen, opened from the same file.</span></span>
            </label>
          </div>
          {shared && (
            <div className="mt-4 grid gap-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[#514838]">Sync server address
                <Input value={address} onChange={(event) => { setAddress(event.target.value); setCheck(null); }} placeholder={DEFAULT_SERVER} spellCheck={false} className="font-mono text-base font-normal" />
              </label>
              {!server && <p className="text-sm font-semibold text-[#b4233c]">Enter a web address, e.g. {DEFAULT_SERVER}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void test()} disabled={!server || busy}>{busy ? "Testing…" : "Test connection"}</Button>
                {address !== DEFAULT_SERVER && <Button type="button" variant="ghost" onClick={() => { setAddress(DEFAULT_SERVER); setCheck(null); }}>Use the clinic&apos;s Vercel server</Button>}
              </div>
              {check && (
                <p role="status" className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm leading-6 ${check.ok ? "bg-[#edf5e8] text-[#41612c]" : "bg-[#fde8eb] text-[#9b1f35]"}`}>
                  {check.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <TriangleAlert size={18} className="mt-0.5 shrink-0" />}{check.text}
                </p>
              )}
              <p className="text-xs leading-5 text-[#857967]">Staff screens ask for the staff PIN once on each computer. Patients&apos; phones and the check-in QR code use the server&apos;s web pages.</p>
            </div>
          )}
          <Button type="button" onClick={save} disabled={shared && !server} className="mt-5 h-11 w-full bg-[#8b6512] text-base text-white hover:bg-[#6f4e0a]">Save and open the front desk</Button>
        </section>

        <section className="rounded-2xl border border-[#e2d7c2] bg-[#fffefb] p-5 shadow-sm">
          <h2 className="text-base font-bold">Open a screen on this computer</h2>
          <p className="mt-1 text-sm text-[#756b59]">Uses the saved setting. Bookmark the screen this computer is for.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SCREENS.map((item) => (
              <a key={item.href} href={`#${item.href}`} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noreferrer" : undefined} className="flex items-start gap-3 rounded-xl border border-[#e2d7c2] bg-white p-3 hover:border-[#d8a321]">
                <span className="mt-0.5 text-[#8b6512]">{item.icon}</span>
                <span><span className="block font-semibold">{item.label}</span><span className="block text-sm text-[#756b59]">{item.note}</span></span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function App() {
  const path = usePathname();
  const route = ROUTES[path] ?? ROUTES["/queue"];
  useEffect(() => {
    document.title = `${route.title} · THSC Queue Board`;
  }, [route]);
  return <>{route.serverBar && <ServerBar />}{route.screen()}</>;
}

createRoot(document.getElementById("root")!).render(<App />);
