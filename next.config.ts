import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Queue Board lives under /queue; send the bare domain to the front desk.
  async redirects() {
    return [{ source: "/", destination: "/queue", permanent: false }];
  },
};

export default nextConfig;
