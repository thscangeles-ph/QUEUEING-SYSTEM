import os from "node:os";

export const dynamic = "force-dynamic";

const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

/**
 * This computer's network addresses. A QR poster opened on the clinic server itself (http://localhost) uses one of
 * them, because "localhost" on a patient's phone means the phone, not the server.
 */
export function GET() {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254."))
    .map((item) => item!.address)
    .sort((a, b) => Number(isPrivate(b)) - Number(isPrivate(a)));
  return Response.json({ addresses }, { headers: { "Cache-Control": "no-store" } });
}
