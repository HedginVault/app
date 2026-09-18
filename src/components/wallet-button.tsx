"use client";

import dynamic from "next/dynamic";

// Rendered client-only: the button reads wallet state that doesn't exist on the server.
export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);
