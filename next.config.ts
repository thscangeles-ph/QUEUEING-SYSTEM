import type { NextConfig } from "next";

const BOARD = "/thsc-queue-board.html";

const nextConfig: NextConfig = {
  // The staff screens are the single-file Queue Board (public/thsc-queue-board.html), served at the website's own
  // addresses so the address bar stays clean. The board picks its screen from the path (/queue/display → TV).
  // The patient pages (/queue/checkin, /queue/ticket, /queue/poster) stay on the website.
  async rewrites() {
    return {
      // beforeFiles: these take over from the older React staff pages at the same addresses.
      beforeFiles: ["/", "/queue", "/queue/station", "/queue/display"].map((source) => ({ source, destination: BOARD })),
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
