import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // app/ has its own lockfile; don't let Next treat the Anchor workspace as the root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
