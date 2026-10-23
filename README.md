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

**Credits:** [credits/CREDITS.md](credits/CREDITS.md) lists who the system is for and every open-source component it uses, with the full license texts in `credits/licenses/`. Refresh it after changing dependencies with `node scripts/build-credits.mjs`.

## Run on a clinic computer (local server)

One Windows computer in the clinic (for example the front desk PC) can be the queue server instead of the Vercel website. The front desk, stations, the TV and patients' phones on the clinic network (LAN or Wi-Fi) then use that computer, and the queue keeps working when the internet is down (only YouTube on the TV needs internet). Queue data stays on that computer.

**Ready-to-run package (recommended):** `THSC-Queue-Server.zip` sets up any Windows 10 or 11 computer as the server with no internet, installation or build: it contains the app already built and a portable Node.js. Extract it to `C:\` (right-click → *Extract All…*, never run it from inside the ZIP) and double-click `C:\THSC-Queue-Server\SETUP.cmd`: it asks for the staff PIN, opens the firewall port, offers to start with Windows, starts the server and lists the addresses for the other computers. `START-SERVER.cmd` starts it by hand; `README.txt` inside has the steps for staff. Build the package with `scripts/build-server-package.sh` (Linux or macOS; it downloads Node.js for Windows and checks its checksum) and share `dist/THSC-Queue-Server.zip`. To update a clinic computer, close the server window, extract the new ZIP over the folder and run `START-SERVER.cmd`; the PIN and the queue are kept.

**From the source code** (needs the internet and builds on the computer):

1. Download the app (GitHub: **Code → Download ZIP**) and unzip it to a folder such as `C:\THSC-Queue`.
2. Double-click `local-server\install-local-server.cmd`. The first time it needs the internet. It installs Node.js if needed (run it again after that), asks for the **staff PIN**, builds the app, opens port 3000 in the Windows firewall (click **Yes**), and asks whether to start the server with Windows.
3. It then starts the server and lists this computer's addresses, e.g. `http://192.168.1.20:3000`. Open that address on the other computers and tablets: add `/queue/station?s=C1` for a station and `/queue/display` for the TV. On the server computer itself, use `http://localhost:3000`.

`local-server\start-local-server.cmd` starts the server by hand. Keep its window open; minimizing it is fine. It restarts the server if it stops, and does nothing if the server is already running. Settings are in `local-server\settings.cmd` (PIN, port, data file); the queue is saved in `%LOCALAPPDATA%\THSC-Queue\queue.json`, outside the app folder, so it is kept when you install a new version. **To update the server**, double-click `local-server\update-server.cmd`. It downloads the newest version from GitHub (needs the internet), stops the server, copies the new files over the app (keeping `settings.cmd`, `tv-setup\queue-server.txt`, the queue and the TV pictures), builds it and starts the server again; the screens reconnect by themselves. Without a download, drag a THSC-Queue ZIP file onto `update-server.cmd` to update from that file. (Unzipping the new version over the folder and running `install-local-server.cmd` again still works too.)

**Desktop icons:** setup offers to put three icons with the THSC logo on the server's desktop: *THSC Queue Board* (the front desk at `http://localhost:3000`), *THSC Front Desk + TV* (runs `tv-setup\start-desk-and-tv.cmd`: the front desk, and the TV full screen on the extended screen) and *THSC Queue Server* (starts the server if it is not running). Double-click `local-server\make-desktop-icons.cmd` (in the package: `make-desktop-icons.cmd`) to add them later or put back one that was deleted.

Setup also asks whether to **open the front desk and the TV display when the server starts**: with *Y*, every start of the server (including at power-on) runs `tv-setup\start-desk-and-tv.cmd` once the server answers, so the front desk opens on the main screen and the TV full screen with sound on the extended screen. It is saved as `OPEN_DESK_AND_TV` in the settings file; remove a copy of `start-desk-and-tv.cmd` from the Startup folder if one was put there before, or the screens open twice.

The TV startup files in `tv-setup` open the local server on that computer (setup writes `tv-setup\queue-server.txt`). On a separate TV computer, put a `queue-server.txt` next to the startup file with the server's address, e.g. `http://192.168.1.20:3000`. They wait for the server to answer before opening the TV.

Notes:
- **TV over Wi-Fi or a LAN cable:** in System configuration → *Display connection*, choose **Wi-Fi** or **LAN cable (Ethernet)** for the TV and screens. It shows the server's address on that connection (a server on both has one address for each), the TV, front desk and station links, and *Download TV startup file*, a `start-tv-display.cmd` set to that address for the TV computer's Startup folder. The setup windows label each address *Wi-Fi* or *LAN cable* too. The QR poster prefers the Wi-Fi address, since phones use Wi-Fi.
- Give the server computer a fixed address (a DHCP reservation in the router), so the address does not change.
- If Windows treats the clinic network as **Public**, the other computers cannot connect: in Settings → Network & Internet, set it to **Private**. Setup warns about this.
- **Phones or computers get "This site can't be reached" / "took too long to respond":** double-click `local-server\fix-network.cmd` (in the package: `fix-network.cmd`) on the server computer. With administrator rights it sets the network to Private, removes Windows Firewall rules that block Node.js (Windows adds them when *Cancel* is clicked on its firewall question, and they win over the allow rule), and allows the queue port on every network. The phone must be on the same Wi-Fi as the server, not a guest network.
- Patients' phones must be on the clinic Wi-Fi to use the QR code. A poster opened on the server computer itself (`http://localhost:3000`) puts the computer's network address in the QR code, not `localhost` (which on a phone means the phone), and prints *Connect to the clinic Wi-Fi first*; if the computer has several addresses, choose the clinic Wi-Fi one above the poster.
- On plain `http://192…` addresses browsers turn off a few extras: copying the queue message uses a copy box, the screen can sleep (set the TV computer to never sleep) and the board cannot be installed as an app. The TV opened on the server computer (`localhost`) is not affected.
- The Vercel website and the local server keep separate queues. Use one or the other.

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
- **Clinic 1, Clinic 2 and Clinic 3** (pre-scheduled patients) each have their own tab on the front desk and their own numbering, like HMO: `CL1-01`, `CL2-01`, `CL3-01` (from 01 each day), then e.g. `CL2-01-C2` at a station. The Concierge calls them to register (*Queue number, Clinic 2, 0 1. Please proceed to Concierge.*), and registration starts with that clinic's consultation room (C1, C2 or C3) as the first service. The TV's *Next in line* shows a group for each clinic while someone in it is waiting, and the Excel report counts them. **Pre-register:** on a clinic tab, tick *📅 Pre-register* in Step 2 to enter a scheduled patient before they come (name, services, optional appointment time). They get their own numbering per clinic, separate from the clinic's other numbers, so no two patients share a number: `PS1-01`, `PS2-01`, `PS3-01` (e.g. `PS1-03-C1` at the station). Their number is ready at once and listed under *Pre-registered, not arrived yet*, sorted by appointment time until staff drag a patient up or down by the ⠿ handle (mouse or touch; ↑ ↓ keys on the handle work too), after which the list keeps that order and later pre-registrations go to the end; they join no line until the Concierge taps *✅ Arrived*, which puts them straight into their first service's line (no registration). ✕ cancels a patient who does not come.
- **HMO patients** have their own tab on the front desk and their own numbering: `HMO-01`, then `HMO-01-C1` at a station (also starting at 01 each day). The HMO tab asks for the HMO company and LOA / approval number, and the patient's services start blank, like every patient's. Pick the services in order; the **HMO Desk** station (code `HD`, service *HMO desk*, with its own *Call next* screen at `/queue/station?s=HD`) can be added like any other service when needed. HMO patients join each doctor's single line in arrival order. HMO details stay on staff screens and in the Excel report; the TV shows the number only.

### Screens

| Screen | URL | Used by |
| --- | --- | --- |
| Front desk | `/` or `/queue` | Concierge: arrival numbers, registration, today's patient list, one-time queue message, Excel report |
| System configuration | `/queue/config` | Every setting in one place (staff PIN, then the **configuration PIN**): stations, clinic name, TV message, TV playlist (videos, playlists and slideshow pictures) and volume, announcement language, today's queue numbers and *Clear today's queue*, and how this computer is connected. Edits are a draft until *Save configuration*; saved changes reach every computer within a few seconds |
| Stations | `/queue/station?s=C1` | Doctors, procedure and lab staff: *Call next*, call again, did not respond, complete, or complete and send to another station. On clinic (consultation) stations, the *Waiting for …* line can be dragged by the ⠿ handle (mouse or touch, or ↑ ↓ keys) to change who is called next; *Call next* and the TV follow that order, and patients who join later wait after it. *Served here today* keeps every number the station served, with *Call again* to call that patient back (their next service waits until they are done) |
| TV display | `/queue/display` | Lobby TV: now calling (a number leaves it once the patient is registered or the station completes them), now serving at each station, next in line in two groups, *Regular patients* and *HMO patients* (each with its registration line at the Concierge or HMO Desk and the stations where they wait). Tap once to turn on the chime and voice announcement |
| Kiosk | `/queue/kiosk` | A tablet or phone at the entrance: patients tap **Regular patient** or **HMO patient**, get the next queue number (`07` or `HMO-07`, added to *Waiting to register*) and the clinic server prints the slip on its receipt printer. Staff enter the staff PIN once; the tab then stays on the kiosk (hold the logo 3 seconds and enter the staff PIN to leave). On tablets and phones it goes full screen by itself on the first touch (browsers need a touch first); the small round button at the bottom right turns full screen on or off (off stays off until it is turned on again). iPhones cannot show web pages full screen: add the kiosk to the home screen there |
| QR queue number | `/queue/checkin` | Patients scan the QR code at the Concierge, type their full name, choose the purpose of their visit (Doctor consultation, each test or procedure such as ECG or Laboratory, Get results / medical certificate, Other) and tap *Get my queue number* |
| Check-in poster | `/queue/poster` | Printable QR poster for the entrance |
| Patient ticket | `/queue/ticket?id=…` | Live status on the patient's phone (opened after taking a number with the QR code, or from the link in the queue message) |

**QR code address:** System configuration → *QR code poster* sets the address inside the QR code, e.g. `http://172.16.100.62:3000` (the server address the clinic Wi-Fi can reach; the kiosk address uses it too). Empty means automatic: the website's own address, or on the clinic server its Wi-Fi address. The poster page also has a *QR code address* box to change it for one print. When phones are on a different network from the server (e.g. Wi-Fi `172.16.20.x`, server `172.16.100.x`), the router must allow it; in pfSense add a *Pass* rule on the Wi-Fi interface to the server's address, TCP port 3000.

**QR code at the Concierge:** it is only for getting a queue number. The patient scans it and taps *Get my queue number*; their phone shows the next number (e.g. `07`) and a live page: patients ahead, then *It's your turn! Please proceed to Concierge* when called. The number joins *Waiting to register* on the front desk with a *📱 QR* tag, and the Concierge registers the patient as usual (walk-in or scheduled, services). A phone that already has today's number sees it again instead of taking another. The patient also types their name and chooses the purpose of the visit: the front desk shows both in *Waiting to register*, and *Register* fills in the name, "Purpose: …" in the notes and the chosen tests or procedures as the first services (the Concierge adds the doctor). Names and purposes are shown only on staff screens.

**One-time message:** *Copy message* on the front desk copies an SMS/Viber text with the patient's queue number (and a live-status link in shared mode) and marks the patient as messaged, so the message is sent only once.

**Privacy:** patient names and mobile numbers appear only on staff screens. The TV and patient phones receive queue numbers only. In shared mode, staff screens require the staff PIN.

### Sync modes

**Single-device mode (default, no setup).** Queue data stays in the browser of one computer and syncs between its tabs and windows. Use this when the lobby TV is connected to the front-desk PC as a second screen: open `/queue` on the desk monitor and `/queue/display` full-screen on the TV. In this mode, station pages and QR check-in only work on that same computer.

**Shared mode (multiple devices).** The front desk, station tablets, the TV and patient phones all see the same queue. Choose one storage option and set a staff PIN:

| Where it runs | Environment variables |
| --- | --- |
| Vercel | Add an Upstash Redis database from the Vercel Marketplace (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`), or set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` yourself. Then add `QUEUE_STAFF_PIN` and redeploy. |
| A clinic PC on the local network | See [Run on a clinic computer](#run-on-a-clinic-computer-local-server) (the setup file does this). By hand: `QUEUE_STORE=file` and `QUEUE_STAFF_PIN=…`. Data is saved to `.queue-data/queue.json` (change it with `QUEUE_DATA_FILE`). Run `pnpm build && pnpm start`, then open `http://<pc-address>:3000/queue` on the other devices. |

Screens refresh every 2 seconds. With Upstash, each open screen makes about one request every 2 seconds, so a full clinic day goes over the free tier; expect a small pay-as-you-go charge.

### Single-file HTML (multiple computers)

`public/thsc-queue-board.html` is the Queue Board in one HTML file: front desk (arrival numbers, registration, today's patients, Excel report, settings), stations and the lobby TV (with optional YouTube). Copy it to each computer (USB, email or shared folder) and open it in Chrome or Edge, or download it from `https://<your-site>/thsc-queue-board.html`.

1. On each computer, open the file and click **Sync setup**.
2. Keep **Sync with other computers** and the sync server address (the clinic's Vercel site by default, or a clinic PC running `QUEUE_STORE=file`). On staff computers, enter the staff PIN. Click *Test connection*, then *Save*.
3. Open the screen that computer is for: `#desk`, `#station/C1` or `#display` after the file name.

**QR queue numbers:** in sync mode, *Check-in QR ↗* on the front desk opens the printable poster on the sync server. Patients scan it and get a queue number with a live status page (see *QR code at the Concierge* above). When synced, *Copy message* also adds the patient's live-status link.

**TV sound status:** browsers only play sound on a page after a click on it, so after the TV is opened or refreshed it needs one click (or the startup file, which allows sound by itself). The TV reports every 30 seconds, and every staff screen shows a badge next to the sync status: *📺 TV sound on*, *🔇 TV sound off* (blinking), or *📺 TV not open*. Calling a number while the TV is silent or closed shows a warning to the person calling, and the TV shows a large red *click anywhere* notice. The TV uses the sync server's clock, so a TV computer whose clock is off still announces new calls and shows the right time.

**TV video sound:** the front desk has a *TV video sound* control above the patient list: an On/Off button and a volume slider (0–100%, starts at 60%). Changes reach the TV within about 2 seconds; the video is still muted while queue numbers are announced, then returns to the chosen volume. The TV's sound must be turned on (the gold start button) for the video to be heard.

**Kiosk and slip printer:** pair a receipt printer (for example a 58 mm Bluetooth thermal printer using ESC/POS) with the clinic server computer in Windows Settings → Bluetooth & devices. In System configuration → *Kiosk & slip printer*, choose it (it shows as a printer, or as a COM port named *Standard Serial over Bluetooth link*), pick the paper size (receipt rolls of 58, 76, 80 or 112 mm, or A4 or Letter for an office printer chosen by its name; those print one page per number with the logo, through the printer's Windows driver), click *🖨 Test print* and save. On the tablet, connect to the clinic Wi-Fi and open the kiosk address shown there (`http://<server>:3000/queue/kiosk`). Each tap gives a number and `POST /api/print` (staff PIN) prints its slip: the clinic name, *Your queue number*, the number in large print, the time and what to do next. If the printer is off or out of paper, the kiosk still gives the number and asks the patient to remember it and tell the Concierge. Printing works only on the clinic's own server (`QUEUE_STORE=file`; on Linux, printer devices such as `/dev/rfcomm0` or `/dev/usb/lp0`).

**Number tags:** System configuration → *Number tags* sets the letters before the numbers: HMO (`HMO`), Clinic 1–3 (`CL1`, `CL2`, `CL3`) and pre-scheduled Clinic 1–3 (`PS1`, `PS2`, `PS3`). Each tag is 1 to 5 letters or numbers starting with a letter, and each group needs its own. New numbers get the new tag; numbers already given today keep theirs (each visit stores its tag). Regular numbers have no tag.

**Configuration PIN:** System configuration has its own PIN, separate from the staff PIN, so staff who use the front desk and stations cannot change the settings. The first time System configuration is opened it asks to create one (4 to 8 digits); after that it asks for it every time it is opened, and *🔒 Lock* closes it straight away. Change it in the *Configuration PIN* panel. The server checks it: without it, settings cannot be saved and today's queue cannot be cleared (the front desk's TV sound control still works). Only a salted hash is stored, and it is never sent to any screen. **Forgot it?** On the clinic server, double-click `local-server\reset-config-pin.cmd` (in the ready-to-run package: `reset-config-pin.cmd`), then open System configuration and create a new one. On Vercel, remove `configPin` from the `settings` in the `thsc:queue:state` key in the Upstash console.

**TV playlist and slideshow:** in System configuration → *TV video & slideshow*, add as many YouTube videos, YouTube playlists (or the clinic's channel ID) and pictures as you like. The TV plays them from top to bottom, then starts again: a video plays to its end, a playlist plays all its videos, and each picture stays for the chosen number of seconds (3–60, 10 by default). Use ↑ ↓ to change the order and ✕ to remove. *Pictures from this computer* uploads pictures to the queue server (shrunk to TV size first; they are kept in Redis on Vercel, or in a `media` folder beside the queue file on a clinic server); *Picture link* takes an `https://` picture address. A single video or playlist on its own repeats by itself. Queue calls still cover the video or picture so no one misses their number.

**YouTube on the TV:** YouTube refuses to play videos on a page opened from disk (error 153, "video player configuration error"), because the page has no web address. So when the file is opened from disk, the TV loads the video through `youtube-frame.html` on the sync server (the Vercel site by default). The TV needs internet for this.

**Calls on the TV:** every call shows and says only the patient's number, `07` (or `HMO-07` for HMO patients), and sends the patient straight to the station that called them: *Queue number, 0 7. Please proceed to Consultation 1.* Arrival numbers are called with *Please proceed to Concierge*, and HMO arrival numbers (`HMO-07`) with *Please proceed to HMO Desk*. On the TV and the patient's phone the destination is shown in a highlighted box. The patient's phone shows the same number. Staff screens keep the full ticket, e.g. `07-C1-W`, so staff still see the station and walk-in or scheduled.

**Tagalog announcements:** the TV reads each call in English only by default; in Settings it can read English, then Tagalog (e.g. "Numero zero seven. Pakipunta po sa Consultation 1."). Choose English only (the default), both, or Tagalog only in Settings, and use *Test announcement* to hear it. The Tagalog voice comes from the TV computer's browser: Microsoft Edge includes natural Filipino voices, while Chrome on Windows usually has none and reads the Tagalog with its default voice (the TV shows a note when that happens).

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
- **By hand:** click *TV display ↗* on the front desk. The first time, allow the browser to manage windows on all your screens. The TV window then opens filling the extended screen; click once anywhere on it for full screen and sound (browsers only allow full screen after a click on the TV window itself, so the startup file above is the zero-click option).
- **One screen:** on a computer without an extended screen, *TV display ↗* turns that window into the TV in full screen straight away, with sound on. Press Esc to leave full screen and go back to the front desk.
- **With a clinic server** (Windows, `QUEUE_STORE=file`): *TV display ↗* asks the server to open the TV, from any staff computer. The server computer, the one the TV is plugged into as an extended screen, opens Edge on that screen, full screen with sound on (`/api/tv/open`, staff PIN), closing an earlier TV window first. If it has no extended screen it says so (press Windows+P → Extend on it). Without a clinic server the board opens the TV itself, as below.
- **Opened at a network address** (`http://192.168…`): browsers only let `https://` and `localhost` pages see other screens, so *TV display ↗* opens the TV in its own window; move it to the TV with **Windows+Shift+→** (or drag it), then click it once. `tv-setup\start-desk-and-tv.cmd` places it on the extended screen by itself: it opens a small app window there and makes it full screen on that screen (Edge's kiosk mode is not used for this, as it can ignore the position and open on the main screen).

**Automatic lobby TV (Windows):** copy `tv-setup/start-tv-display.cmd` to the TV computer, press Windows+R, type `shell:startup`, press Enter and put the file in the folder that opens. When the computer starts, Microsoft Edge opens `/queue/display` full screen with sound allowed: the chime and the English/Tagalog announcements work without a click, and the screen is kept awake. Press Alt+F4 to close it. Opened any other way, the TV still shows *Click to turn on chime & voice announcements* once.
