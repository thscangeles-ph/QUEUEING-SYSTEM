import type { NextConfig } from "next";

const BOARD = "/thsc-queue-board.html";

const nextConfig: NextConfig = {
  // Staff screens are the single-file Queue Board (public/thsc-queue-board.html); send the bare domain,
  // the old staff addresses and installed-app shortcuts to the matching board screen. The patient pages
  // (/queue/checkin, /queue/ticket, /queue/poster) stay on the website.
  async redirects() {
    return [
      { source: "/", destination: `${BOARD}#desk`, permanent: false },
      { source: "/queue", destination: `${BOARD}#desk`, permanent: false },
      { source: "/queue/station", has: [{ type: "query", key: "s", value: "(?<code>[A-Za-z0-9]{1,4})" }], destination: `${BOARD}#station/:code`, permanent: false },
      { source: "/queue/station", destination: `${BOARD}#station`, permanent: false },
      { source: "/queue/display", destination: `${BOARD}#display`, permanent: false },
    ];
  },
};

export default nextConfig;
