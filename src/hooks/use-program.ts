"use client";

import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { useMemo } from "react";
import idl from "@/idl/hedge_vault.json";
import type { HedgeVault } from "@/idl/hedge_vault";
import { HEDGE_VAULT_PROGRAM_ID } from "@/lib/constants";

// Read-only stand-in so account fetches work before a wallet connects.
const readonlyWallet: Wallet = {
  publicKey: Keypair.generate().publicKey,
  payer: undefined as never,
  signTransaction: () => Promise.reject(new Error("wallet not connected")),
  signAllTransactions: () => Promise.reject(new Error("wallet not connected")),
};

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    const provider = new AnchorProvider(connection, (wallet as Wallet) ?? readonlyWallet, {
      commitment: "confirmed",
    });
    const program = new Program<HedgeVault>(
      { ...(idl as HedgeVault), address: HEDGE_VAULT_PROGRAM_ID.toBase58() },
      provider,
    );
    return { program, provider, connected: !!wallet };
  }, [connection, wallet]);
}
