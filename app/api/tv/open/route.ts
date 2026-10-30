import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isClinicServer, isStaff } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

// The board file opened from disk or another computer calls this with the staff PIN header.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-queue-pin", "Access-Control-Max-Age": "86400" };
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
const TV_PROFILE = "THSC-TV-Screen";

const powershell = (command: string) =>
  new Promise<string>((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-Command", command], { timeout: 15000, windowsHide: true }, (error, stdout) => resolve(error ? "" : String(stdout).trim()));
  });

/** A point inside the first screen that is not the main one (the TV as an extended screen), or null. */
async function tvScreen() {
  const out = await powershell("Add-Type -AssemblyName System.Windows.Forms; $s = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1; if ($s) { '{0} {1}' -f ($s.Bounds.X + 50), ($s.Bounds.Y + 50) }");
  if (!out) return null;
  const [x, y] = out.split(/\s+/).map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

const edgePath = () =>
  [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA]
    .filter(Boolean)
    .map((dir) => path.join(dir!, "Microsoft", "Edge", "Application", "msedge.exe"))
    .find((file) => fs.existsSync(file));

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Opens the TV display on the clinic server computer's extended screen (the lobby TV), full screen with sound.
 * Browsers cannot place a window on another screen from a page at a network address, so the server does it.
 * Only on a Windows clinic server (QUEUE_STORE=sqlite or file); elsewhere the board opens the TV itself.
 */
export async function POST(request: Request) {
  if (process.platform !== "win32" || !isClinicServer()) return json({ ok: false, reason: "unavailable" });
  if (!isStaff(request)) return json({ ok: false, error: "Staff PIN required." }, 401);
  const screen = await tvScreen();
  if (!screen) return json({ ok: false, reason: "no-tv", error: "The server computer has no extended screen. On it, press Windows+P and choose Extend, then try again." });
  // Close a TV window opened earlier, so the new one gets the position and full screen.
  await powershell(`Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${TV_PROFILE}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`);
  await new Promise((resolve) => setTimeout(resolve, 800));
  const url = `http://localhost:${process.env.PORT || 3000}/queue/display`;
  const args = [`--app=${url}`, `--window-position=${screen.x},${screen.y}`, "--window-size=800,600", "--start-fullscreen", "--no-first-run", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${path.join(process.env.LOCALAPPDATA || os.tmpdir(), TV_PROFILE)}`];
  const edge = edgePath();
  const child = edge
    ? spawn(edge, args, { detached: true, stdio: "ignore", windowsHide: false })
    : spawn("cmd.exe", ["/c", "start", "msedge", ...args], { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => undefined);
  child.unref();
  return json({ ok: true });
}
