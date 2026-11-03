import { spawn } from "node:child_process";

// The clinic server must not sleep: while it sleeps the front desk, stations, TVs and kiosk stop. While the queue
// server runs on Windows, a small PowerShell asks Windows to stay awake (the screen may still turn off). It checks
// every minute that the queue server is still running and ends with it, so Windows sleeps normally afterwards.
const SCRIPT = `
Add-Type -Namespace Thsc -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);'
$parent = [int]$env:THSC_QUEUE_PID
# ES_CONTINUOUS | ES_SYSTEM_REQUIRED: no sleep while this runs; the display may still turn off.
[Thsc.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null
while (Get-Process -Id $parent -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 60 }
`;

const shared = globalThis as typeof globalThis & { __thscAwake?: { on: boolean } };

/** Whether this server keeps Windows awake (for System configuration). */
export const keepingAwake = () => Boolean(shared.__thscAwake?.on);

export function keepAwake() {
  if (process.platform !== "win32" || shared.__thscAwake) return;
  const state: { on: boolean } = (shared.__thscAwake = { on: false });
  try {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", Buffer.from(SCRIPT, "utf16le").toString("base64")], {
      env: { ...process.env, THSC_QUEUE_PID: String(process.pid) },
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("spawn", () => {
      state.on = true;
      console.log("Keeping this computer awake while the queue server runs (the screen can still turn off).");
    });
    child.on("exit", () => { state.on = false; });
    child.on("error", () => { state.on = false; });
  } catch {
    state.on = false;
  }
}
