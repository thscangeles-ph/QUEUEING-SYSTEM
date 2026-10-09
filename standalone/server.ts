import { readStorage, writeStorage } from "@/components/queue/use-queue";

/** The deployed Queue Board. Every computer that uses the same sync server shares one queue. */
export const DEFAULT_SERVER = "https://queueing-system-self.vercel.app";
const SERVER_KEY = "thsc-queue-server";

/** Sync server origin for this computer; an empty string keeps the queue on this computer only. */
export function syncServer() {
  return readStorage(SERVER_KEY) ?? DEFAULT_SERVER;
}

export function setSyncServer(server: string) {
  writeStorage(SERVER_KEY, server);
}

/** Turns what staff type ("192.168.1.10:3000", "https://…/queue") into an origin, or null if it is not an address. */
export function normalizeServer(input: string) {
  const value = input.trim();
  if (!value) return null;
  const local = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/.test(value);
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `${local ? "http" : "https"}://${value}`);
    return url.origin;
  } catch {
    return null;
  }
}

export type ServerCheck = { ok: boolean; text: string };

/** Asks the sync server whether its shared queue is ready. */
export async function checkServer(server: string): Promise<ServerCheck> {
  try {
    const response = await fetch(`${server}/api/queue`, { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as { mode?: string; error?: string } | null;
    if (!body || !body.mode) return { ok: false, text: `The address answered, but it is not a Queue Board server (status ${response.status}). Check the address.` };
    if (body.mode === "local") return { ok: false, text: "The server is running, but shared storage is not set up, so computers will not sync. Add the Upstash Redis database and QUEUE_STAFF_PIN to the server (see the README), then redeploy." };
    if (body.error) return { ok: false, text: body.error };
    return { ok: true, text: "Connected. The shared queue is ready on this server." };
  } catch {
    return { ok: false, text: "Could not reach the server. Check the address and this computer's internet or clinic network. If the address is right, the server needs the latest Queue Board update so this HTML file can connect." };
  }
}
