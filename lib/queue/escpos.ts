// The queue number slip for thermal receipt printers (58 mm or 80 mm), as ESC/POS commands.
// Printed by the clinic server (app/api/print) for the kiosk tablet's Regular and HMO buttons.

const ESC = 0x1b;
const GS = 0x1d;

const slipTime = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Receipt printers only print plain ASCII reliably: accents are dropped (ñ → n), anything else becomes "?". */
const ascii = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‐-―]/g, "-").replace(/[^\x20-\x7e]/g, "?");

/** Splits a text into lines of at most `width` characters, breaking between words. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) { lines.push(line); line = ""; }
    line = line ? `${line} ${word}` : word.slice(0, width);
  }
  if (line) lines.push(line);
  return lines;
}

/** Receipt paper widths in mm, with the characters per line in the printer's normal font. */
export const SLIP_PAPER = { 58: 32, 76: 40, 80: 48, 112: 64 } as const;
export type SlipWidth = keyof typeof SLIP_PAPER;

/** A paper width from settings or a form; anything else means 58 mm, the common small Bluetooth printer. */
export const slipWidthOf = (value: unknown): SlipWidth => (Number(value) in SLIP_PAPER ? (Number(value) as SlipWidth) : 58);

export type SlipInput = { label: string; clinic: string; issuedAt: number; width?: SlipWidth; hmo?: boolean };

/** The slip: clinic name, "Your queue number", the number as large as the paper allows, the time and what to do next. */
export function slipBytes({ label, clinic, issuedAt, width = 58, hmo = false }: SlipInput): Uint8Array {
  const cols = SLIP_PAPER[slipWidthOf(width)];
  const bytes: number[] = [];
  const cmd = (...values: number[]) => bytes.push(...values);
  const text = (value: string) => bytes.push(...Array.from(ascii(value), (c) => c.charCodeAt(0)));
  const line = (value = "") => { text(value); cmd(0x0a); };

  cmd(ESC, 0x40); // reset
  cmd(ESC, 0x61, 1); // centre
  cmd(ESC, 0x45, 1, GS, 0x21, 0x01); // bold, double height
  wrap(clinic.toUpperCase(), cols).forEach((part) => line(part));
  cmd(GS, 0x21, 0x00, ESC, 0x45, 0);
  line();
  line(hmo ? "Your HMO queue number" : "Your queue number");
  // The number as large as fits the paper: up to 6 times the normal size.
  const size = Math.max(1, Math.min(6, Math.floor(cols / Math.max(label.length, 1))));
  cmd(ESC, 0x45, 1, GS, 0x21, ((size - 1) << 4) | (size - 1));
  line(label);
  cmd(GS, 0x21, 0x00, ESC, 0x45, 0);
  line(slipTime.format(new Date(issuedAt)));
  line("-".repeat(cols));
  wrap("Please take a seat. Watch the TV screen - your number will be called for registration. Keep this number for every service today.", cols).forEach((part) => line(part));
  line();
  line();
  line();
  cmd(GS, 0x56, 0x42, 0x00); // feed and cut (printers without a cutter ignore it)
  return Uint8Array.from(bytes);
}
