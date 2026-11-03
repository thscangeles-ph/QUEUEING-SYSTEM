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
const shared = globalThis as typeof globalThis & { __thscTts?: Map<string, Promise<Buffer | null>> };
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

async function speak(lines: { text: string; lang: string }[]): Promise<Buffer | null> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "thsc-tts-"));
  const out = path.join(dir, "call.wav");
  const job = path.join(dir, "job.json");
  try {
    await fs.writeFile(job, JSON.stringify({ out, lines }), "utf8");
    await new Promise<void>((resolve, reject) => {
      execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(SCRIPT, "utf16le").toString("base64")], { timeout: 20000, windowsHide: true, env: { ...process.env, THSC_TTS_JOB: job } }, (error) => (error ? reject(error) : resolve()));
    });
    return await fs.readFile(out);
  } catch {
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** GET /api/tts?id=<call id>: the call read out as a WAV sound, made by the Windows clinic server. */
export async function GET(request: Request) {
  if (process.platform !== "win32" || !isClinicServer()) return json({ ok: false, reason: "unavailable" }, 501);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const state = (await getBackend()?.load())?.state;
  const item = state?.announcements.find((entry) => entry.id === id);
  if (!state || !item) return json({ ok: false, error: "That call is not on the board." }, 404);
  const language = state.settings.announceLanguage ?? "en";
  const key = `${id}|${language}`;
  if (!made.has(key)) {
    made.set(key, speak(announcementSpeech(item, language)));
    while (made.size > 40) made.delete(made.keys().next().value!);
  }
  const sound = await made.get(key)!;
  if (!sound) {
    made.delete(key);
    return json({ ok: false, error: "The server could not make the announcement sound." }, 500);
  }
  return new Response(new Uint8Array(sound), { headers: { ...CORS, "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" } });
}
