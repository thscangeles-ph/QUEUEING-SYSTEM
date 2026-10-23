import { existsSync } from "node:fs";
import path from "node:path";
import { isPagePaper, PREREG_SLIP_MESSAGE, SLIP_MESSAGE, slipBytes, slipTime, slipWidthOf } from "@/lib/queue/escpos";
import { listPrinters, printingAvailable, printPage, printRaw } from "@/lib/queue/printer";
import { arrivalLabel, clinicNameOf, clinicOf, ensureDay } from "@/lib/queue/reducer";
import { getBackend, isStaff } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

// The clinic server prints queue number slips on its own receipt printer (e.g. a Bluetooth thermal printer),
// for the kiosk tablet's Regular and HMO buttons. Staff PIN needed; only on the clinic server (QUEUE_STORE=file).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
const UNAVAILABLE = "Printing on the server works only on the clinic's own queue server.";

/** The clinic logo for A4 and Letter pages (the app folder, or the ready-to-run package's app folder). */
const clinicLogo = () => [path.join(process.cwd(), "public", "theheartspecialists.png"), path.join(process.cwd(), "app", "public", "theheartspecialists.png")].find((file) => existsSync(file));

/** "14:30" → "2:30 PM". */
function appointmentText(time: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** The printers and COM ports of the server computer, for System configuration. */
export async function GET(request: Request) {
  if (!printingAvailable()) return json({ available: false, printers: [] });
  if (!isStaff(request)) return json({ error: "Staff PIN required." }, 401);
  return json({ available: true, printers: await listPrinters() });
}

/** Prints the slip of an arrival number ({ visitId }), or a test slip ({ test: true, printer?, width? }). */
export async function POST(request: Request) {
  const backend = getBackend();
  if (!printingAvailable() || !backend) return json({ ok: false, reason: "unavailable", error: UNAVAILABLE });
  if (!isStaff(request)) return json({ ok: false, error: "Staff PIN required." }, 401);
  let body: { visitId?: unknown; test?: unknown; printer?: unknown; width?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }
  const state = ensureDay((await backend.load()).state, Date.now());
  // A test slip may try a printer chosen in System configuration before it is saved.
  const printer = String((body.test ? body.printer : undefined) ?? state.settings.slipPrinter ?? "").trim().slice(0, 200);
  const width = slipWidthOf((body.test ? body.width : undefined) ?? state.settings.slipWidth);
  if (!printer) return json({ ok: false, reason: "no-printer", error: "No slip printer is set. Choose one in System configuration → Kiosk & slip printer." });
  const visit = body.test ? null : state.visits.find((item) => item.id === body.visitId && !item.cancelled);
  if (!body.test && !visit) return json({ ok: false, error: "That queue number was not found." }, 404);
  const label = visit ? arrivalLabel(visit) : "TEST";
  const clinic = clinicNameOf(state.settings);
  const hmo = visit?.kind === "H";
  // A pre-registered patient (not arrived yet) gets the clinic, their name and appointment, and goes to the Concierge on arrival.
  const expected = Boolean(visit?.expected);
  const issuedAt = (expected ? visit?.preRegisteredAt : undefined) ?? visit?.createdAt ?? Date.now();
  const heading = expected && visit ? `Pre-registered - ${clinicOf(visit.kind) ?? "Scheduled"}` : hmo ? "Your HMO queue number" : "Your queue number";
  const details = expected && visit ? [visit.name, visit.appointment ? `Appointment ${appointmentText(visit.appointment)}` : ""].filter(Boolean) : [];
  const message = expected ? PREREG_SLIP_MESSAGE : SLIP_MESSAGE;
  try {
    // A4 and Letter go through the office printer's driver; receipt rolls get ESC/POS commands.
    if (isPagePaper(width)) await printPage(printer, { label, clinic, heading, details: details.join("\n"), time: slipTime(issuedAt), message, paper: width, logo: clinicLogo() });
    else await printRaw(printer, slipBytes({ label, clinic, issuedAt, width, hmo, heading, details, message }));
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, reason: "print-failed", error: `The slip could not be printed on ${printer}: ${(error as Error).message.replace(/\.$/, "")}. Check that the printer is on, paired and has paper.` });
  }
}
