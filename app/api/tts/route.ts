import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { announcementSpeech } from "@/lib/queue/format";
import { getBackend, isClinicServer } from "@/lib/queue/server-store";

export const dynamic = "force-dynamic";

// Smart TV browsers (Samsung, LG …) cannot speak: the clinic server (Windows) says the call with its own voice
// and the TV plays the sound file. Only a call that is on the board can be read out, so no other text is spoken.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" };
const json = (body: Record<string, unknown>, status: number) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

// The last calls' sound, so five TVs asking for the same call make it once.
const shared = globalThis as typeof globalThis & { __thscTts?: Map<string, Promise<Made>> };
const made = (shared.__thscTts ??= new Map());

// The text is passed in a file, never inside the command, so nothing in a station name can run as a command.
const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$job = Get-Content -Raw -Encoding UTF8 $env:THSC_TTS_JOB | ConvertFrom-Json
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.Rate = -1
$voice.Volume = 100
$voice.SetOutputToWaveFile($job.out)
$filipino = $voice.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -match '^(fil|tl)' } | Select-Object -First 1
$english = $voice.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en*' } | Select-Object -First 1
foreach ($line in $job.lines) {
  $pick = if ($line.lang -eq 'fil-PH' -and $filipino) { $filipino } elseif ($english) { $english } else { $null }
  if ($pick) { $voice.SelectVoice($pick.VoiceInfo.Name) }
  $voice.Speak($line.text)
  $prompt = New-Object System.Speech.Synthesis.PromptBuilder
  $prompt.AppendBreak([TimeSpan]::FromMilliseconds(600))
  $voice.Speak($prompt)
}
$voice.Dispose()
`;

type Made = { sound: Buffer } | { error: string };

async function speak(lines: { text: string; lang: string }[]): Promise<Made> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "thsc-tts-"));
  const out = path.join(dir, "call.wav");
  const job = path.join(dir, "job.json");
  try {
    await fs.writeFile(job, JSON.stringify({ out, lines }), "utf8");
    const problem = await new Promise<string>((resolve) => {
      execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(SCRIPT, "utf16le").toString("base64")], { timeout: 20000, windowsHide: true, env: { ...process.env, THSC_TTS_JOB: job } }, (error, _stdout, stderr) =>
        resolve(error ? String(stderr || error.message).replace(/\s+/g, " ").trim().slice(0, 300) || "PowerShell failed." : ""),
      );
    });
    if (problem) return { error: `The server's voice did not work: ${problem}` };
    const sound = await fs.readFile(out);
    return sound.length > 100 ? { sound } : { error: "The server's voice made an empty sound. Check that Windows has a voice (Settings, Time & language, Speech)." };
  } catch (error) {
    return { error: `The server's voice did not work: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET /api/tts?id=<call id>: the call read out as a WAV sound, made by the Windows clinic server.
 * GET /api/tts?test=1: a fixed test sentence, for System configuration's "Test the server voice".
 */
export async function GET(request: Request) {
  if (process.platform !== "win32" || !isClinicServer()) return json({ ok: false, reason: "unavailable", error: "Only a Windows clinic server can make the announcement voice for smart TVs." }, 501);
  const params = new URL(request.url).searchParams;
  const state = (await getBackend()?.load())?.state;
  if (!state) return json({ ok: false, error: "The queue is not ready yet." }, 503);
  const language = state.settings.announceLanguage ?? "en";
  let key: string;
  let lines: { text: string; lang: string }[];
  if (params.get("test")) {
    key = `test|${language}`;
    lines = announcementSpeech({ id: "test", at: Date.now(), kind: "ticket", label: "07-C1-W", station: "C1", destination: "Consultation 1" }, language);
  } else {
    const id = params.get("id") ?? "";
    const item = state.announcements.find((entry) => entry.id === id);
    if (!item) return json({ ok: false, error: "That call is not on the board." }, 404);
    key = `${id}|${language}`;
    lines = announcementSpeech(item, language);
  }
  if (!made.has(key)) {
    made.set(key, speak(lines));
    while (made.size > 40) made.delete(made.keys().next().value!);
  }
  const result = await made.get(key)!;
  if ("error" in result) {
    made.delete(key);
    return json({ ok: false, error: result.error }, 500);
  }
  return new Response(new Uint8Array(result.sound), { headers: { ...CORS, "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" } });
}
