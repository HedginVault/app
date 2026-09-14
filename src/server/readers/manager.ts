import "server-only";
import { PublicKey } from "@solana/web3.js";
import type { ManagerView } from "@/lib/types";
import { cached } from "../cache";
import { getManagerPda } from "../pda";
import { getProgram } from "../program";
import { getVaultMetadata } from "../registry";
import { getTokenInfos } from "../tokens";
import { toVaultSummary } from "./decode";

// Vault layout: 8 discriminator + 8 id, then authority.
const AUTHORITY_OFFSET = 16;

/**
 * 2 RPC: the Manager PDA and a getProgramAccounts filtered by authority, run in parallel, plus a
 * batched token lookup for the deposit mints. Summaries are built from the filtered accounts, so a
 * vault created moments ago shows up immediately rather than waiting on the cached vault list.
 */
export const readManager = (wallet: string) =>
  cached(`manager:${wallet}`, 15_000, async (): Promise<ManagerView> => {
    const authority = new PublicKey(wallet);
    const program = getProgram();
    const [manager, owned] = await Promise.all([
      program.account.manager.fetchNullable(getManagerPda(authority)),
      program.account.vault.all([{ memcmp: { offset: AUTHORITY_OFFSET, bytes: wallet } }]),
    ]);
    const tokens = await getTokenInfos(owned.map((v) => v.account.depositMint));
    const vaults = owned
      .map(({ publicKey, account }) => {
        const address = publicKey.toBase58();
        return toVaultSummary(
          address,
          account,
          tokens.get(account.depositMint.toBase58())!,
          getVaultMetadata(address),
        );
      })
      .sort((a, b) => Number(a.id) - Number(b.id));
    return { isManager: !!manager, vaults };
  });
