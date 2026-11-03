import type { NextConfig } from "next";

const BOARD = "/thsc-queue-board.html";
// One stamp per build: the build's BUILD_ID, and built into the server's code (/api/server-info "build"), so the
// update files can check that the running server is the one just built, not an old one still on the port.
// Set once in the main build process, so the build workers (which load this file again) use the same stamp.
const BUILD_STAMP = (process.env.THSC_BUILD_STAMP ??= `thsc-${Date.now().toString(36)}`);

const nextConfig: NextConfig = {
  generateBuildId: async () => BUILD_STAMP,
  env: { THSC_BUILD: BUILD_STAMP },
  // The ready-to-run clinic server package (scripts/build-server-package.sh) needs a self-contained build.
  // Images are not resized on the server there, so it needs no platform-specific image library.
  ...(process.env.QUEUE_STANDALONE === "1" ? { output: "standalone" as const, images: { unoptimized: true } } : {}),
  // The staff screens are the single-file Queue Board (public/thsc-queue-board.html), served at the website's own
  // addresses so the address bar stays clean. The board picks its screen from the path (/queue/display → TV;
  // /tv → the TV display this browser showed last).
  // The patient pages (/queue/checkin, /queue/ticket, /queue/poster) stay on the website.
  async rewrites() {
    return {
      // beforeFiles: these take over from the older React staff pages at the same addresses.
      beforeFiles: ["/", "/queue", "/queue/station", "/queue/display", "/queue/config", "/queue/kiosk", "/tv"].map((source) => ({ source, destination: BOARD })),
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
