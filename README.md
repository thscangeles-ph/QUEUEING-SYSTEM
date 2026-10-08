# QUEUEING-SYSTEM

Patient queuing system for The Heart Specialists Clinic — Clinic 1, Clinic 2 and Clinic 3 — for patients waiting for their appointment with the doctor.

The project has no database, server-side handler, or required environment variables.

## Run locally

Requirements: Node.js 20.9 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

Import the repository in Vercel (**Add New → Project**). It is detected as **Next.js**; keep the default build command (`next build`). No environment variables are required.

## Using the queue

**Front desk (`/`)**

- **Add patient**: enter the name, pick Clinic 1, 2 or 3, and choose the Regular or Priority lane (senior citizens, PWD, pregnant women). The patient receives a queue number such as `C2-004`, which can be printed.
- **Per clinic**: set the doctor's name, mark the clinic open or closed, **Call next**, **Call again**, mark **Done** or **No-show**, call someone out of turn, transfer a patient to another clinic, or remove them.
- **Order**: Priority lane first, then first come, first served. Estimated waits use the clinic's average consultation time today (15 minutes until there is data).
- **History**: patients seen and no-shows for the day; a late no-show can be put back in line in their original place.

**Waiting-room display (`/display`)**

Open it on a TV or second monitor. It shows each clinic's current and next numbers, and after **Turn on announcements** is clicked it plays a chime and reads out each call. Patient names are never shown on the display.

## How data is stored

Queue data is saved in the browser (`localStorage`) and shared live between tabs and windows of the same browser on the same computer, so run the front desk and the waiting-room display on one computer (the display on an extended screen). Ticket numbers restart at 001 each new day; doctor names and open/closed status are kept.
