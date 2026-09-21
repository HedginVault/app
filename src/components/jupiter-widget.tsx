"use client";

import Script from "next/script";
import { clusterApiUrl } from "@solana/web3.js";

// Jupiter's own client-side endpoint for quotes/swaps — distinct from the
// server-only RPC_URL used for vault reads/sends (never shipped to the browser).
const ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("mainnet-beta");

export function JupiterWidget() {
  return (
    <Script
      src="https://plugin.jup.ag/plugin-v1.js"
      strategy="afterInteractive"
      onReady={() => {
        window.Jupiter?.init({
          displayMode: "widget",
          widgetStyle: { position: "bottom-left", size: "sm" },
          endpoint: ENDPOINT,
        });
      }}
    />
  );
}
