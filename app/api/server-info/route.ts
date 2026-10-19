import os from "node:os";

export const dynamic = "force-dynamic";

type ServerAddress = { address: string; name: string; connection: "wifi" | "lan" | "other" };

const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
// Adapters made by virtual machines, WSL, Docker or VPN software are not how screens reach this computer.
const VIRTUAL = /vethernet|virtual|vmware|vbox|hyper-v|docker|wsl|loopback|bluetooth|tailscale|zerotier|vpn|tap|tun/i;
const connectionOf = (name: string): ServerAddress["connection"] =>
  /wi-?fi|wlan|wireless|^wl/i.test(name) ? "wifi" : /ethernet|^eth|^en[opsx]|^lan/i.test(name) ? "lan" : "other";

/**
 * This computer's network addresses and whether each is Wi-Fi or a LAN cable (Ethernet), so displays and the QR
 * poster can use an address the TV or phone can reach ("localhost" on another device means that device).
 */
export function GET() {
  const servers: ServerAddress[] = Object.entries(os.networkInterfaces())
    .filter(([name]) => !VIRTUAL.test(name))
    .flatMap(([name, items]) => (items ?? []).filter((item) => item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254.")).map((item) => ({ address: item.address, name, connection: connectionOf(name) })))
    .sort((a, b) => Number(isPrivate(b.address)) - Number(isPrivate(a.address)));
  // Phones use Wi-Fi, so the Wi-Fi address comes first in the plain list the QR poster uses.
  const addresses = [...servers].sort((a, b) => Number(b.connection === "wifi") - Number(a.connection === "wifi")).map((item) => item.address);
  return Response.json({ addresses, servers }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
