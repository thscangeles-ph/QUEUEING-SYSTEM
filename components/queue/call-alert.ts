"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The patient's phone rings when their number is called: a chime made with Web Audio (no sound file to download)
// and a vibration where the phone supports it. Phones only allow sound after the patient taps the page once, so the
// ticket page asks for one tap ("Turn on the call sound"). The ring repeats until the patient taps "I'm on my way",
// and every "Call again" from the staff rings it again.

const REPEAT_MS = 8000;
const MAX_RINGS = 8; // about a minute of ringing per call
const ACK_KEY = "thsc-queue-call-ack";

type AudioWindow = typeof window & { webkitAudioContext?: typeof AudioContext };
type SessionNavigator = Navigator & { audioSession?: { type: string } };

let shared: AudioContext | null = null;

function context(): AudioContext | null {
  if (shared) return shared;
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    // iPhone (iOS 17+): play even when the ringer switch is on silent.
    const nav = navigator as SessionNavigator;
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch { /* older phones */ }
  shared = new Ctor();
  return shared;
}

/** One "ding-dong-ding" chime, loud and clear on a phone speaker. */
function chime(ctx: AudioContext) {
  const start = ctx.currentTime + 0.05;
  const notes: [number, number][] = [[1046.5, 0], [784, 0.42], [1046.5, 0.84], [784, 1.6], [1046.5, 2.02], [1318.5, 2.44]];
  for (const [frequency, at] of notes) {
    for (const [type, level] of [["sine", 0.55], ["triangle", 0.25]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(level, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.95);
    }
  }
}

function ring() {
  const ctx = shared;
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    chime(ctx);
  }
  try { navigator.vibrate?.([500, 200, 500, 200, 800]); } catch { /* not supported */ }
}

function readAck() {
  try { return sessionStorage.getItem(ACK_KEY) ?? ""; } catch { return ""; }
}
function writeAck(key: string) {
  try { sessionStorage.setItem(ACK_KEY, key); } catch { /* private mode */ }
}

/**
 * Rings the phone while `callKey` is set (it changes with every call and "Call again") until the patient
 * acknowledges it. Returns whether sound is on, a function to turn it on (from a tap), and the acknowledge action.
 */
export function useCallAlert(callKey: string | null, label: string) {
  const [soundOn, setSoundOn] = useState(false);
  // The page shows the ticket only after the queue loads in the browser, so reading sessionStorage here is safe.
  const [acked, setAcked] = useState(() => (typeof window === "undefined" ? "" : readAck()));
  const rings = useRef(0);

  const turnOn = useCallback(() => {
    const ctx = context();
    if (!ctx) return false;
    void ctx.resume().catch(() => undefined);
    // A short, almost silent sound inside the tap unlocks the speaker on iPhones.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
    setSoundOn(true);
    return true;
  }, []);

  // Any tap on the page turns the sound on, not only the button.
  useEffect(() => {
    if (soundOn) return;
    // The "turn on" button handles its own tap, so it can also play the test chime.
    const unlock = (event: Event) => { if (!(event.target instanceof Element && event.target.closest("[data-sound-button]"))) turnOn(); };
    const events = ["pointerdown", "touchend", "keydown"] as const;
    events.forEach((name) => document.addEventListener(name, unlock, { passive: true }));
    return () => events.forEach((name) => document.removeEventListener(name, unlock));
  }, [soundOn, turnOn]);

  const ringing = Boolean(callKey) && acked !== callKey;

  useEffect(() => {
    if (!ringing) return;
    rings.current = 0;
    const once = () => {
      if (rings.current >= MAX_RINGS) return;
      rings.current += 1;
      ring();
    };
    once();
    const timer = window.setInterval(once, REPEAT_MS);
    // A phone that comes back from the lock screen rings at once if the patient has not answered yet.
    const back = () => { if (document.visibilityState === "visible") { rings.current = Math.min(rings.current, MAX_RINGS - 1); once(); } };
    document.addEventListener("visibilitychange", back);
    // The browser tab shows the call too.
    const title = document.title;
    let flip = false;
    const blink = window.setInterval(() => { flip = !flip; document.title = flip ? `🔔 Your turn! ${label}` : title; }, 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(blink);
      document.removeEventListener("visibilitychange", back);
      document.title = title;
    };
  }, [ringing, callKey, label]);

  const acknowledge = useCallback(() => {
    if (!callKey) return;
    writeAck(callKey);
    setAcked(callKey);
    try { navigator.vibrate?.(0); } catch { /* not supported */ }
  }, [callKey]);

  const test = useCallback(() => { if (turnOn()) ring(); }, [turnOn]);

  return { soundOn, turnOn, ringing, acknowledge, test };
}
