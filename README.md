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
2. **Concierge** gives the patient a plain queue number on arrival (Front desk → *Queue number*: `01`, `02`, …) and calls it when it is their turn to register. The number shows on the TV. Walk-in or scheduled is chosen at registration.
3. **Concierge registers the patient** on the Queue Board (and in the Lab Info System as usual), picks their services in order, and tells the patient their queue number, e.g. `01-C1-W`.
4. **The patient watches the TV**, which shows every queue number being called and who is next.

### Queue numbers

`01-C1-W` = `[daily number]-[station]-[W walk-in / S scheduled]`.

**Consultation charges:** on a consultation station, the doctor ticks any of *Clearance*, *Medical certificate* and *Additional procedure*, then finishes with **💳 Professional fee → Cashier** or **No charge**. Anything to pay sends the patient to the Cashier station next (before their other services); the Cashier screen shows what to collect, and the front desk shows *To pay* / *Paid*. Charges appear in the Excel report and never on the TV.

**Route:** in Today's patients, *✎ Edit* on a patient's route adds, removes or reorders the services still to come, or deletes the rest of the route. Finished services and the one being served now stay as they are; a patient who stays first in a line keeps their place.

- The daily number starts at 01 every day (Manila time) and is shared by walk-in and scheduled patients.
- **One number per visit.** A patient keeps the same daily number for consultation, procedures and laboratory; only the station code changes (`01-C1-W` → `01-L1-W`).
- Station codes, names and rooms are set in Front desk → **Settings**. Defaults: C1–C3 Consultation, P1 Procedures (ECG / 2D Echo), L1 Laboratory, HD HMO Desk, CA Cashier, XR X-ray, US Ultrasound. If saved settings are missing any of these, Settings offers *Add missing standard stations*. With more than six stations, the TV shows tiles only for stations serving someone and lists only stations with someone waiting.
- Patients marked **Priority lane** (senior citizen, PWD, pregnant) are called ahead of the regular line.
- **HMO patients** have their own tab on the front desk and their own numbering: `HMO-01`, then `HMO-01-C1` at a station (also starting at 01 each day). The HMO tab asks for the HMO company and LOA / approval number, and starts the patient's services with the **HMO Desk** station (code `HD`, service *HMO desk*), which has its own *Call next* screen at `/queue/station?s=HD`. After the HMO Desk, HMO patients join each doctor's single line in arrival order. HMO details stay on staff screens and in the Excel report; the TV shows the number only.

### Screens

| Screen | URL | Used by |
| --- | --- | --- |
| Front desk | `/` or `/queue` | Concierge: arrival numbers, registration, today's patient list, one-time queue message, Excel report, settings |
| Stations | `/queue/station?s=C1` | Doctors, procedure and lab staff: *Call next*, call again, did not respond, complete, or complete and send to another station |
| TV display | `/queue/display` | Lobby TV: now calling, now serving at each station, next in line. Tap once to turn on the chime and voice announcement |
| QR check-in | `/queue/checkin` | Scheduled patients scan the QR poster on arrival and get their `S` queue number on their phone |
| Check-in poster | `/queue/poster` | Printable QR poster for the entrance |
| Patient ticket | `/queue/ticket?id=…` | Live status on the patient's phone (opened after QR check-in, or from the link in the queue message) |

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

**YouTube on the TV:** YouTube refuses to play videos on a page opened from disk (error 153, "video player configuration error"), because the page has no web address. So when the file is opened from disk, the TV loads the video through `youtube-frame.html` on the sync server (the Vercel site by default). The TV needs internet for this.

**Tagalog announcements:** the TV reads each call in English, then Tagalog (e.g. "Numero zero one, C one, W. Pakipunta po sa Clinic Room 1."). Choose English only, Tagalog only or both in Settings, and use *Test announcement* to hear it. The Tagalog voice comes from the TV computer's browser: Microsoft Edge includes natural Filipino voices, while Chrome on Windows usually has none and reads the Tagalog with its default voice (the TV shows a note when that happens).

**Estimated waiting time:** the patient's ticket page shows an estimate such as "About 20 min": the patients ahead × the station's typical time per patient today (the median of its last 10 patients), plus what is left of the current patient's turn. Until a station has served 3 patients that day it assumes 15 min for consultation, 20 min for procedures and 10 min for laboratory.

Every computer that uses the same sync server shares one live queue, updated every 2 seconds. The server must be in shared mode (see [Sync modes](#sync-modes)) and running this version of the app: it accepts the file's actions (arrival numbers, YouTube settings) and lets the file call its queue API. If the server has no shared storage, the file says so and keeps its own queue on that computer. **This computer only** keeps the queue in the file's browser storage and works offline.

The file carries its own copy of the queue rules (`lib/queue/reducer.ts`, `format.ts`, `youtube.ts`). When you change those rules, make the same change in the file.

### Install as an app on tablets and phones

The Queue Board installs like an app: a home-screen icon that opens full screen, without the browser's address bar.

- **Android tablets and phones (Chrome):** open the screen you want (e.g. `/queue/station`), then tap **Install app** in the header, or use Chrome's menu → **Install app** / **Add to Home screen**.
- **iPad and iPhone (Safari):** tap **Share** → **Add to Home Screen** → **Add**. The **Install app** button shows these steps.
- **Windows PC (Chrome or Edge):** click the install icon in the address bar, or use **Install app** in the header.

The staff app opens on the front desk and has shortcuts to Stations and the TV display. A station tablet reopens on the last station it used. Patients who install from the check-in page get a separate patient app that opens on check-in, not on the staff PIN screen.

If a device loses its connection, it shows a "No connection" page or a retry message and reconnects by itself. Queue data is never cached, so a screen never shows an old queue.

**Lobby TV as the front desk's second (extended) screen:** press Windows+P and choose *Extend*. Then either:
- **Automatic:** put `tv-setup/start-desk-and-tv.cmd` in the Startup folder (Windows+R → `shell:startup`). At startup it opens the front desk on the main screen and finds the extended screen by itself, then opens the TV display full screen there with sound allowed. If no extended screen is found, it says so and opens only the front desk.
- **By hand:** click *TV display ↗* on the front desk. The first time, allow the browser to manage windows on all your screens. The TV window then opens filling the extended screen; click its gold button once for full screen and sound.

**Automatic lobby TV (Windows):** copy `tv-setup/start-tv-display.cmd` to the TV computer, press Windows+R, type `shell:startup`, press Enter and put the file in the folder that opens. When the computer starts, Microsoft Edge opens `/queue/display` full screen with sound allowed: the chime and the English/Tagalog announcements work without a click, and the screen is kept awake. Press Alt+F4 to close it. Opened any other way, the TV still shows *Click to turn on chime & voice announcements* once.
