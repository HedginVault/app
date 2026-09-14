"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { SEND_RPC_URL } from "@/lib/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

// Empty adapter list: Phantom, Solflare, Backpack etc. are picked up via Wallet Standard.
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ConnectionProvider endpoint={SEND_RPC_URL}>
        <WalletProvider wallets={[]} autoConnect>
          <WalletModalProvider>
            {children}
            <Toaster position="bottom-right" theme="light" richColors closeButton />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
