# QUEUEING-SYSTEM

**THSC Queue Board**: the patient queuing system for The Heart Specialists Clinic. It covers the front desk, consultation rooms, procedures, laboratory, the lobby TV and patient check-in, and installs on tablets and phones as an app (PWA).

The website serves the Queue Board (`public/thsc-queue-board.html`) at its staff addresses: `/` and `/queue` open the front desk, `/queue/station?s=C1` the C1 station and `/queue/display` the lobby TV. The address bar keeps these addresses; the board picks its screen from the path. Opened from the website, the board syncs with that website without any setup; staff enter the PIN once per device.

## Run locally

Requirements: Node.js 20.9 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

Import the repository in Vercel (**Add New → Project**). `vercel.json` sets the framework to Next.js; keep the default build command (`next build`).

No environment variables are required. They are only needed to turn on shared mode (see [Sync modes](#sync-modes)).

## How the queue works

The queue follows the clinic's arrival flow:

1. **Patient arrives** and goes to the front desk.
2. **Concierge** gives the patient a plain queue number on arrival (Front desk → *Queue number*: `01`, `02`, …) and calls it when it is their turn to register. The number shows on the TV. A number removed with ✕ before registering (the patient left) is given again to the next arrival, lowest first, so numbers are not skipped; this works the same for `HMO-01` numbers. Walk-in or scheduled is chosen at registration.
3. **Concierge registers the patient** on the Queue Board (and in the Lab Info System as usual), picks their services in order, and tells the patient their queue number, e.g. `01-C1-W`.
4. **The patient watches the TV**, which shows every queue number being called and who is next.

### Queue numbers

`01-C1-W` = `[daily number]-[station]-[W walk-in / S scheduled]`.

**Consultation charges:** on a consultation station, the doctor ticks any of *Admin fee*, *Clearance*, *Medical certificate* and *Additional procedure*, then finishes with **💳 Professional fee → Cashier** or **No charge**. Anything to pay sends the patient to the Cashier station next (before their other services); the Cashier screen shows what to collect, and the front desk shows *To pay* / *Paid*. Charges appear in the Excel report and never on the TV.

**Route:** in Today's patients, *✎ Edit* on a patient's route adds, removes or reorders the services still to come, or deletes the rest of the route. Finished services and the one being served now stay as they are; a patient who stays first in a line keeps their place.

- The daily number starts at 01 every day (Manila time) and is shared by walk-in and scheduled patients.
- **One number per visit.** A patient keeps the same daily number for consultation, procedures and laboratory; only the station code changes (`01-C1-W` → `01-L1-W`).
- Station codes, names and rooms are set in **⚙ System configuration** (`/queue/config`, also the front desk's *Settings* button). Defaults: C1–C3 Consultation; procedures E1 2D Echo 1, E2 2D Echo 2, ECG, ABPM, HT Holter, TM Treadmill, ABI, BIO Biosensor, WT 6-Minute Walk; L1 Laboratory; HD HMO Desk; CA Cashier; XR X-ray; US Ultrasound; CN Concierge. If saved settings differ, Settings offers *Update to the standard stations* (it also turns the old P1 "Procedures (ECG / 2D Echo)" into 2D Echo 1, keeping code P1 while patients are queued there). With more than six stations, the TV shows tiles only for stations serving someone and lists only stations with someone waiting.
- Patients marked **Priority lane** (senior citizen, PWD, pregnant) are called ahead of the regular line.
- **HMO patients** have their own tab on the front desk and their own numbering: `HMO-01`, then `HMO-01-C1` at a station (also starting at 01 each day). The HMO tab asks for the HMO company and LOA / approval number, and the patient's services start blank, like every patient's. Pick the services in order; the **HMO Desk** station (code `HD`, service *HMO desk*, with its own *Call next* screen at `/queue/station?s=HD`) can be added like any other service when needed. HMO patients join each doctor's single line in arrival order. HMO details stay on staff screens and in the Excel report; the TV shows the number only.

### Screens

| Screen | URL | Used by |
| --- | --- | --- |
| Front desk | `/` or `/queue` | Concierge: arrival numbers, registration, today's patient list, one-time queue message, Excel report |
| System configuration | `/queue/config` | Every setting in one place (staff PIN): stations, clinic name, TV message, TV video and volume, announcement language, today's queue numbers and *Clear today's queue*, and how this computer is connected. Edits are a draft until *Save configuration*; saved changes reach every computer within a few seconds |
| Stations | `/queue/station?s=C1` | Doctors, procedure and lab staff: *Call next*, call again, did not respond, complete, or complete and send to another station. *Served here today* keeps every number the station served, with *Call again* to call that patient back (their next service waits until they are done) |
| TV display | `/queue/display` | Lobby TV: now calling (a number leaves it once the patient is registered or the station completes them), now serving at each station, next in line. Tap once to turn on the chime and voice announcement |
| QR check-in | `/queue/checkin` | Scheduled patients scan the QR poster on arrival and get their `S` queue number on their phone |
| Check-in poster | `/queue/poster` | Printable QR poster for the entrance |
| Patient ticket | `/queue/ticket?id=…` | Live status on the patient's phone (opened after QR check-in, or from the link in the queue message) |
| ECG Strip Extractor | `/ecg` | ECG staff: save only the tracing from an ECG PDF, without the patient details (see [ECG Strip Extractor](#ecg-strip-extractor)) |
| DICOM Viewer | `/dicom` | Echo, X-ray and ultrasound staff: open DICOM files from a CD, USB or folder, play echo clips and measure (see [DICOM Viewer](#dicom-viewer)) |

**Scheduled patients** get their queue number by scanning the QR poster at the entrance (advance registration). Their check-in shows as *QR check-in · verify* on the front desk until a concierge confirms it. The concierge can also register a scheduled patient manually by choosing *Scheduled (S)*.

**One-time message:** *Copy message* on the front desk copies an SMS/Viber text with the patient's queue number (and a live-status link in shared mode) and marks the patient as messaged, so the message is sent only once.

**Privacy:** patient names and mobile numbers appear only on staff screens. The TV and patient phones receive queue numbers only. In shared mode, staff screens require the staff PIN.

### Sync modes

**Single-device mode (default, no setup).** Queue data stays in the browser of one computer and syncs between its tabs and windows. Use this when the lobby TV is connected to the front-desk PC as a second screen: open `/queue` on the desk monitor and `/queue/display` full-screen on the TV. In this mode, station pages and QR check-in only work on that same computer.

**Shared mode (multiple devices).** The front desk, station tablets, the TV and patient phones all see the same queue. Choose one storage option and set a staff PIN:

| Where it runs | Environment variables |
| --- | --- |
| Vercel | Add an Upstash Redis database from the Vercel Marketplace (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`), or set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` yourself. Then add `QUEUE_STAFF_PIN` and redeploy. |
| A clinic PC on the local network | `QUEUE_STORE=file` and `QUEUE_STAFF_PIN=…`. Data is saved to `.queue-data/queue.json` (change it with `QUEUE_DATA_FILE`). Run `pnpm build && pnpm start`, then open `http://<pc-address>:3000/queue` on the other devices. |

Screens refresh every 2 seconds. With Upstash, each open screen makes about one request every 2 seconds, so a full clinic day goes over the free tier; expect a small pay-as-you-go charge.

### Single-file HTML (multiple computers)

`public/thsc-queue-board.html` is the Queue Board in one HTML file: front desk (arrival numbers, registration, today's patients, Excel report, settings), stations and the lobby TV (with optional YouTube). Copy it to each computer (USB, email or shared folder) and open it in Chrome or Edge, or download it from `https://<your-site>/thsc-queue-board.html`.

1. On each computer, open the file and click **Sync setup**.
2. Keep **Sync with other computers** and the sync server address (the clinic's Vercel site by default, or a clinic PC running `QUEUE_STORE=file`). On staff computers, enter the staff PIN. Click *Test connection*, then *Save*.
3. Open the screen that computer is for: `#desk`, `#station/C1` or `#display` after the file name.

**QR check-in for scheduled patients:** in sync mode, *Check-in QR ↗* on the front desk opens the printable poster on the sync server. Patients scan it, check in on their phone and get their `S` queue number with a live status page. Their check-in shows as *QR check-in · verify* in Today's patients until the front desk presses **Verify**. Choose which stations patients may pick in Settings (the *QR check-in* column). When synced, *Copy message* also adds the patient's live-status link.

**TV sound status:** browsers only play sound on a page after a click on it, so after the TV is opened or refreshed it needs one click (or the startup file, which allows sound by itself). The TV reports every 30 seconds, and every staff screen shows a badge next to the sync status: *📺 TV sound on*, *🔇 TV sound off* (blinking), or *📺 TV not open*. Calling a number while the TV is silent or closed shows a warning to the person calling, and the TV shows a large red *click anywhere* notice. The TV uses the sync server's clock, so a TV computer whose clock is off still announces new calls and shows the right time.

**TV video sound:** the front desk has a *TV video sound* control above the patient list: an On/Off button and a volume slider (0–100%, starts at 60%). Changes reach the TV within about 2 seconds; the video is still muted while queue numbers are announced, then returns to the chosen volume. The TV's sound must be turned on (the gold start button) for the video to be heard.

**YouTube on the TV:** YouTube refuses to play videos on a page opened from disk (error 153, "video player configuration error"), because the page has no web address. So when the file is opened from disk, the TV loads the video through `youtube-frame.html` on the sync server (the Vercel site by default). The TV needs internet for this.

**Tagalog announcements:** the TV reads each call in English only by default; in Settings it can read English, then Tagalog (e.g. "Numero zero one, C one, W. Pakipunta po sa Clinic Room 1."). Choose English only (the default), both, or Tagalog only in Settings, and use *Test announcement* to hear it. The Tagalog voice comes from the TV computer's browser: Microsoft Edge includes natural Filipino voices, while Chrome on Windows usually has none and reads the Tagalog with its default voice (the TV shows a note when that happens).

**Estimated waiting time:** the patient's ticket page shows an estimate such as "About 20 min": the patients ahead × the station's typical time per patient today (the median of its last 10 patients), plus what is left of the current patient's turn. Until a station has served 3 patients that day it assumes 15 min for consultation, 20 min for procedures and 10 min for laboratory.

Every computer that uses the same sync server shares one live queue, updated every 2 seconds. The server must be in shared mode (see [Sync modes](#sync-modes)) and running this version of the app: it accepts the file's actions (arrival numbers, YouTube settings) and lets the file call its queue API. If the server has no shared storage, the file says so and keeps its own queue on that computer. **This computer only** keeps the queue in the file's browser storage and works offline.

The file carries its own copy of the queue rules (`lib/queue/reducer.ts`, `format.ts`, `youtube.ts`). When you change those rules, make the same change in the file.

### ECG Strip Extractor

`/ecg` (also *ECG strips ↗* on the Queue Board) saves only the tracing from an ECG PDF, leaving out the patient's name, ID and other text printed around it.

1. Drop the ECG PDF on the page (or click to choose it). *Try a sample ECG* shows how it works with a synthetic tracing.
2. The box finds the pink grid paper by itself (*Grid found*). Drag it, resize it by its handles, or draw a new one; *Auto-detect tracing* and *Full page* reset it, and *Use this box on all pages* copies it to every page.
3. Tick the pages to save (page 1 by default), pick the quality (300 dpi for printing) and click **Save tracing as PDF**. Each page keeps its true size, so 25 mm/s and 10 mm/mV stay correct when printed at 100%.

*Report values* lists the text printed outside the box (rate, intervals, axes, interpretation); click a value to copy it. Scanned PDFs have no text to list.

The PDF is read and saved in the browser; it is never uploaded, even from the Vercel site. The page is `public/ecg-strip-extractor.html` and its PDF libraries (pdf.js 3.11.174 and pdf-lib 1.17.1) are in `public/ecg-lib/`, so it works on the clinic network without internet. To use it on a computer from disk, copy the HTML file together with the `ecg-lib` folder; a copy without the folder loads the libraries from cdnjs (needs internet).

### DICOM Viewer

`/dicom` (also *DICOM viewer ↗* on the Queue Board) opens DICOM images in the browser: 2D Echo clips, X-ray, ultrasound, MPEG-4 video clips and studies exported to CD or USB.

1. Drop DICOM files or a whole folder on the page, or use *Open files* / *Open folder*. Files that are not images (DICOMDIR, reports, viewer programs on the CD) are skipped. *Try a sample echo clip* shows how it works with a synthetic clip.
2. The left column lists each patient's studies. Every echo clip is its own item and plays by itself at its recorded frame rate; single images of a series form a stack you scroll through. Encapsulated PDF reports open with *Open the PDF*.
3. Tools: *Contrast* (drag; right-drag works with any tool), *Pan* (or middle-drag), *Zoom* (or Ctrl+wheel, or pinch), *Measure*, plus *Invert*, *Rotate*, *Flip* and *Reset*. The wheel or ← → change frame, Space plays or pauses, ↑ ↓ change item, H hides the patient's name and ID.
4. **Measurements** use the calibration in the file: ultrasound regions (echo distances in cm or mm; on a Doppler strip, time in ms and velocities in cm/s), else pixel spacing, else the X-ray detector's spacing (marked *at detector*). Uncalibrated images measure in pixels. Pointing at a Doppler strip shows the velocity under the cursor.
5. **Save image** saves the current frame as PNG at its own resolution, with contrast, rotation and measurements, but without the patient's name or ID.

*Details* shows the patient, study and image information; *All tags* lists every DICOM tag with a search box.

It reads uncompressed (implicit/explicit VR, big endian, deflated), JPEG Baseline, JPEG Extended (12-bit), JPEG Lossless, JPEG-LS, JPEG 2000, HTJ2K and RLE images, in grayscale, RGB, YBR and palette colour.

**Video clips** (MPEG-4 AVC/H.264, stored either as an MP4 file or as a raw stream, in one or several fragments) play like any other clip: frame by frame, with contrast, measurements and *Save image*. They are decoded by the browser's own video decoder (WebCodecs), so they need a recent Chrome or Edge; Firefox and Safari may not play them. HEVC/H.265 clips play only where the browser can decode HEVC (usually Chrome or Edge on Windows with hardware video decoding); elsewhere the item says so. MPEG-2 clips cannot be played in a browser. Files are read on the computer and never uploaded, even from the Vercel site. It is a quick reference viewer, not a diagnostic workstation.

The page is `public/dicom-viewer.html`; its libraries (dicom-parser 1.8.21, jpeg-lossless-decoder-js 2.0.7, and the OpenJPEG 1.2.4, CharLS 1.2.3 and libjpeg-turbo 12-bit 0.4.7 WebAssembly codecs from Cornerstone) are in `public/dicom-lib/`, so it works on the clinic network without internet. To use it from disk, copy the HTML file with the `dicom-lib` folder; without the folder it loads the libraries from jsDelivr (needs internet). Opened from disk, JPEG 2000, JPEG-LS and 12-bit JPEG images always need internet, because browsers do not load WebAssembly from local files.

### Install as an app on tablets and phones

The Queue Board installs like an app: a home-screen icon that opens full screen, without the browser's address bar.

- **Android tablets and phones (Chrome):** open the screen you want (e.g. `/queue/station`), then tap **Install app** in the header, or use Chrome's menu → **Install app** / **Add to Home screen**.
- **iPad and iPhone (Safari):** tap **Share** → **Add to Home Screen** → **Add**. The **Install app** button shows these steps.
- **Windows PC (Chrome or Edge):** click the install icon in the address bar, or use **Install app** in the header.

The staff app opens on the front desk and has shortcuts to Stations and the TV display. A station tablet reopens on the last station it used. Patients who install from the check-in page get a separate patient app that opens on check-in, not on the staff PIN screen.

If a device loses its connection, it shows a "No connection" page or a retry message and reconnects by itself. Queue data is never cached, so a screen never shows an old queue.

**Lobby TV as the front desk's second (extended) screen:** press Windows+P and choose *Extend*. Then either:
- **Automatic:** put `tv-setup/start-desk-and-tv.cmd` in the Startup folder (Windows+R → `shell:startup`). At startup it opens the front desk on the main screen and finds the extended screen by itself, then opens the TV display full screen there with sound allowed. If no extended screen is found, it says so and opens only the front desk.
- **By hand:** click *TV display ↗* on the front desk. The first time, allow the browser to manage windows on all your screens. The TV window then opens filling the extended screen; click once anywhere on it for full screen and sound (browsers only allow full screen after a click on the TV window itself, so the startup file above is the zero-click option).
- **One screen:** on a computer without an extended screen, *TV display ↗* turns that window into the TV in full screen straight away, with sound on. Press Esc to leave full screen and go back to the front desk.

**Automatic lobby TV (Windows):** copy `tv-setup/start-tv-display.cmd` to the TV computer, press Windows+R, type `shell:startup`, press Enter and put the file in the folder that opens. When the computer starts, Microsoft Edge opens `/queue/display` full screen with sound allowed: the chime and the English/Tagalog announcements work without a click, and the screen is kept awake. Press Alt+F4 to close it. Opened any other way, the TV still shows *Click to turn on chime & voice announcements* once.
