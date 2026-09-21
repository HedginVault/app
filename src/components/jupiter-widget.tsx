"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clusterApiUrl } from "@solana/web3.js";

// Jupiter's own client-side endpoint for quotes/swaps — distinct from the
// server-only RPC_URL used for vault reads/sends (never shipped to the browser).
const ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("mainnet-beta");
// The DOM node Jupiter's script injects directly into <body>, outside React's tree.
const CONTAINER_ID = "jupiter-plugin-instance";

function isManageVaultDetail(pathname: string) {
  return /^\/manage\/[^/]+$/.test(pathname);
}

export function JupiterWidget() {
  const pathname = usePathname();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const show = isManageVaultDetail(pathname);

  useEffect(() => {
    if (show && scriptLoaded) {
      window.Jupiter?.init({
        displayMode: "widget",
        widgetStyle: { position: "bottom-left", size: "sm" },
        endpoint: ENDPOINT,
      });
    } else {
      document.getElementById(CONTAINER_ID)?.remove();
    }
  }, [show, scriptLoaded]);

  return (
    <Script
      src="https://plugin.jup.ag/plugin-v1.js"
      strategy="afterInteractive"
      onReady={() => setScriptLoaded(true)}
    />
  );
}
