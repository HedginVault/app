"use client";

import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import "@solana/wallet-adapter-react-ui/styles.css";

// Empty adapter list: Phantom, Solflare, Backpack etc. are picked up via Wallet Standard.
// No ConnectionProvider: the browser never talks to an RPC. The wallet only signs; the server sends.
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          {children}
          <Toaster position="bottom-right" theme="dark" richColors closeButton />
        </WalletModalProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
