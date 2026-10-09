import { syncServer } from "./server";

/** Single-file build of components/queue/endpoint.ts: the queue API lives on the configured sync server. */
export function queueApiUrl(): string | null {
  const server = syncServer();
  return server ? `${server}/api/queue` : null;
}

/** Patients' phones cannot open this HTML file, so their links and QR codes go to the sync server's pages. */
export function publicUrl(path: string) {
  const server = syncServer();
  return server ? `${server}${path}` : `${window.location.href.split("#")[0]}#${path}`;
}
