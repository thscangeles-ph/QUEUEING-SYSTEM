/**
 * Where the queue screens reach the queue API, and the address patients open on their phones.
 * The single-file HTML build (standalone/) swaps this module for one that points at a configurable sync server.
 */

/** Queue API URL, or null to keep the queue on this device only. */
export function queueApiUrl(): string | null {
  return "/api/queue";
}

/** Full URL of an app page (e.g. "/queue/checkin") for links and QR codes opened on other devices. */
export function publicUrl(path: string) {
  return `${window.location.origin}${path}`;
}
