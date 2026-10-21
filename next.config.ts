import type { NextConfig } from "next";

const BOARD = "/thsc-queue-board.html";

const nextConfig: NextConfig = {
  // The ready-to-run clinic server package (scripts/build-server-package.sh) needs a self-contained build.
  // Images are not resized on the server there, so it needs no platform-specific image library.
  ...(process.env.QUEUE_STANDALONE === "1" ? { output: "standalone" as const, images: { unoptimized: true } } : {}),
  // The staff screens are the single-file Queue Board (public/thsc-queue-board.html), served at the website's own
  // addresses so the address bar stays clean. The board picks its screen from the path (/queue/display → TV).
  // The patient pages (/queue/checkin, /queue/ticket, /queue/poster) stay on the website.
  async rewrites() {
    return {
      // beforeFiles: these take over from the older React staff pages at the same addresses.
      beforeFiles: ["/", "/queue", "/queue/station", "/queue/display", "/queue/config", "/queue/kiosk"].map((source) => ({ source, destination: BOARD })),
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
