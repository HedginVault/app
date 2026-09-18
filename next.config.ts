import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit the traced production server consumed by the container image.
  output: "standalone",
  // Keep Next rooted at this standalone repository.
  turbopack: { root: __dirname },
  // Node-only SDKs stay out of the server bundle.
  serverExternalPackages: ["@meteora-ag/dlmm", "@coral-xyz/anchor"],
  // `next dev` otherwise writes AGENTS.md / CLAUDE.md into app/ whenever it detects a coding agent.
  agentRules: false,
};

export default nextConfig;
