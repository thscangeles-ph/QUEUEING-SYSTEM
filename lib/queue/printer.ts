import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { open, readdir } from "node:fs/promises";

// Sends slips to the receipt printer of the clinic server computer. A Bluetooth thermal printer paired with Windows
// appears either as a printer (when a driver is installed) or as a Bluetooth COM port; both are supported.
// On Linux, a printer device under /dev (e.g. /dev/rfcomm0 or /dev/usb/lp0) is written to directly.

export type PrinterChoice = { id: string; name: string; kind: "printer" | "port" };

/** Printing is only for the clinic's own server (QUEUE_STORE=file), not the website. */
export const printingAvailable = () => process.env.QUEUE_STORE === "file" && (process.platform === "win32" || process.platform === "linux");

function powershell(script: string, env: Record<string, string> = {}, timeout = 30000) {
  return new Promise<string>((resolve, reject) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { timeout, windowsHide: true, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr).trim().split(/\r?\n/).find((l) => l.trim()) || error.message));
      else resolve(String(stdout).trim());
    });
  });
}

const LIST_SCRIPT = `
$out = @()
try { Get-Printer | ForEach-Object { $out += @{ id = $_.Name; name = $_.Name; kind = 'printer' } } } catch {}
$names = @{}
try { Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\((COM\\d+)\\)' } | ForEach-Object { if ($_.Name -match '\\((COM\\d+)\\)') { $names[$Matches[1]] = $_.Name } } } catch {}
foreach ($p in [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object -Unique) { $n = if ($names[$p]) { $names[$p] } else { $p }; $out += @{ id = $p; name = $n; kind = 'port' } }
ConvertTo-Json -Compress -InputObject @($out)
`;

/** The printers and COM ports of this computer, for the printer list in System configuration. */
export async function listPrinters(): Promise<PrinterChoice[]> {
  if (process.platform === "win32") {
    const out = await powershell(LIST_SCRIPT).catch(() => "[]");
    try {
      return (JSON.parse(out || "[]") as PrinterChoice[]).filter((item) => item && typeof item.id === "string");
    } catch {
      return [];
    }
  }
  const found: PrinterChoice[] = [];
  for (const [dir, pattern] of [["/dev", /^(rfcomm\d+|ttyUSB\d+|ttyACM\d+)$/], ["/dev/usb", /^lp\d+$/]] as const) {
    const names = await readdir(/*turbopackIgnore: true*/ dir).catch(() => [] as string[]);
    names.filter((name) => pattern.test(name)).forEach((name) => found.push({ id: `${dir}/${name}`, name: `${dir}/${name}`, kind: "port" }));
  }
  return found;
}

// Raw printing: the slip's ESC/POS bytes go to the printer unchanged (no driver formatting).
const RAW_PRINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
$data = [Convert]::FromBase64String($env:THSC_SLIP)
$target = $env:THSC_PRINTER
if ($target -match '^COM\\d+$') {
  $port = New-Object System.IO.Ports.SerialPort $target, 9600
  $port.WriteTimeout = 15000
  $port.Open()
  try { $port.Write($data, 0, $data.Length); Start-Sleep -Milliseconds 500 } finally { $port.Close() }
  exit 0
}
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ThscRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo { [MarshalAs(UnmanagedType.LPWStr)] public string Name; [MarshalAs(UnmanagedType.LPWStr)] public string File; [MarshalAs(UnmanagedType.LPWStr)] public string Type; }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool OpenPrinter(string name, out IntPtr printer, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr printer);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool StartDocPrinter(IntPtr printer, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DocInfo info);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr printer, byte[] data, int length, out int written);
  public static void Send(string name, byte[] data) {
    IntPtr printer;
    if (!OpenPrinter(name, out printer, IntPtr.Zero)) throw new Exception("The printer " + name + " was not found.");
    try {
      if (!StartDocPrinter(printer, 1, new DocInfo { Name = "THSC queue number", Type = "RAW" })) throw new Exception("The printer did not accept the slip.");
      StartPagePrinter(printer);
      int written;
      WritePrinter(printer, data, data.Length, out written);
      EndPagePrinter(printer);
      EndDocPrinter(printer);
    } finally { ClosePrinter(printer); }
  }
}
"@
[ThscRawPrint]::Send($target, $data)
`;

// Slips are printed one at a time.
let queue: Promise<unknown> = Promise.resolve();

// A4 or Letter page for an office printer, drawn through its Windows driver: the logo, the clinic name,
// "Your queue number", the number as large as the page allows, the time and what to do next.
const PAGE_PRINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $env:THSC_PRINTER
if (-not $doc.PrinterSettings.IsValid) { throw "The printer $($env:THSC_PRINTER) was not found." }
$doc.DocumentName = 'THSC queue number'
$kind = if ($env:THSC_PAPER -eq 'letter') { [System.Drawing.Printing.PaperKind]::Letter } else { [System.Drawing.Printing.PaperKind]::A4 }
$size = $doc.PrinterSettings.PaperSizes | Where-Object { $_.Kind -eq $kind } | Select-Object -First 1
if ($size) { $doc.DefaultPageSettings.PaperSize = $size }
$doc.add_PrintPage({
  param($sender, $page)
  $g = $page.Graphics
  $area = $page.MarginBounds
  $center = New-Object System.Drawing.StringFormat
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  $ink = [System.Drawing.Brushes]::Black
  $y = [single]$area.Top
  if ($env:THSC_LOGO -and (Test-Path -LiteralPath $env:THSC_LOGO)) {
    $logo = [System.Drawing.Image]::FromFile($env:THSC_LOGO)
    $g.DrawImage($logo, [single]($area.Left + ($area.Width - 90) / 2), $y, [single]90, [single]120)
    $logo.Dispose()
    $y += 135
  }
  $write = {
    param($text, $font)
    $box = New-Object System.Drawing.RectangleF ([single]$area.Left), $script:y, ([single]$area.Width), ([single]1000)
    $height = $g.MeasureString($text, $font, [int]$area.Width, $center).Height
    $g.DrawString($text, $font, $ink, $box, $center)
    $script:y += $height + 12
  }
  $script:y = $y
  & $write $env:THSC_CLINIC (New-Object System.Drawing.Font 'Arial', 20, ([System.Drawing.FontStyle]::Bold))
  $script:y += 20
  & $write $env:THSC_HEADING (New-Object System.Drawing.Font 'Arial', 22)
  # The number as large as the page width allows.
  $points = 190
  do {
    $big = New-Object System.Drawing.Font 'Arial', $points, ([System.Drawing.FontStyle]::Bold)
    $points -= 10
  } while ($g.MeasureString($env:THSC_LABEL, $big).Width -gt $area.Width * 0.95 -and $points -gt 40)
  & $write $env:THSC_LABEL $big
  & $write $env:THSC_TIME (New-Object System.Drawing.Font 'Arial', 16)
  $script:y += 10
  $g.DrawLine([System.Drawing.Pens]::Gray, [single]$area.Left, [single]$script:y, [single]$area.Right, [single]$script:y)
  $script:y += 24
  & $write $env:THSC_MESSAGE (New-Object System.Drawing.Font 'Arial', 18)
  $page.HasMorePages = $false
})
$doc.Print()
`;

export type PageSlip = { label: string; clinic: string; heading: string; time: string; message: string; paper: "a4" | "letter"; logo?: string };

/** Prints the queue number on an A4 or Letter page through a Windows printer (an office printer). */
export function printPage(printer: string, slip: PageSlip): Promise<void> {
  const job = queue.then(async () => {
    if (process.platform !== "win32") throw new Error("A4 and Letter pages print through Windows printers only");
    if (/^COM\d+$/i.test(printer)) throw new Error("A4 and Letter need an office printer, not a COM port. Choose the printer by name, or a roll paper size");
    await powershell(PAGE_PRINT_SCRIPT, { THSC_PRINTER: printer, THSC_PAPER: slip.paper, THSC_LABEL: slip.label, THSC_CLINIC: slip.clinic.toUpperCase(), THSC_HEADING: slip.heading, THSC_TIME: slip.time, THSC_MESSAGE: slip.message, THSC_LOGO: slip.logo ?? "" }, 60000);
  });
  queue = job.catch(() => undefined);
  return job;
}

const LINUX_PRINTER = /^\/dev\/(rfcomm\d+|ttyUSB\d+|ttyACM\d+|ttyS\d+|lp\d+|usb\/lp\d+)$/;

/** Prints the bytes on a Windows printer or COM port, or a Linux printer device. */
export function printRaw(printer: string, data: Uint8Array): Promise<void> {
  const job = queue.then(async () => {
    if (process.platform === "win32") {
      await powershell(RAW_PRINT_SCRIPT, { THSC_PRINTER: printer, THSC_SLIP: Buffer.from(data).toString("base64") });
      return;
    }
    // Only printer and serial devices, never a disk or other file.
    if (!LINUX_PRINTER.test(printer)) throw new Error("Choose a printer device (e.g. /dev/rfcomm0 or /dev/usb/lp0).");
    // Opened without creating it: a printer that is not connected is an error, not a new file.
    const device = await open(/*turbopackIgnore: true*/ printer, constants.O_WRONLY | constants.O_NOCTTY);
    try {
      await device.write(data);
    } finally {
      await device.close();
    }
  });
  queue = job.catch(() => undefined);
  return job;
}
