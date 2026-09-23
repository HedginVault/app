import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost } from "@/server/route";
import { decodeTokenAmount } from "@/server/rpc";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmZapOutIxs } from "@/server/tx/dlmm";
import { zapSwapNextStep } from "@/server/tx/next-steps";
import { dlmmZapOutBody } from "@/server/tx/schemas";
import { getTokenProgram } from "@/server/tokens";

export const POST = handlePost(dlmmZapOutBody, async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const config = await readConfig();
  const slippageBps = Math.min(b.slippageBps, config.maxSlippageBps);
  const { ixs, tokenMints } = await dlmmZapOutIxs(
    getProgram(),
    ctx,
    authority,
    new PublicKey(b.position),
    new PublicKey(config.treasuryAuthority),
  );
  const sourceMints = [...new Set(tokenMints.map((mint) => mint.toBase58()))].filter(
    (mint) => mint !== ctx.depositMint.toBase58(),
  );
  // Snapshot every non-deposit balance before the close. The follow-up swaps only the increase,
  // so an unrelated idle balance in the same vault ATA is preserved.
  const sourceAtas = await Promise.all(
    sourceMints.map(async (mint) => {
      const key = new PublicKey(mint);
      return getAssociatedTokenAddressSync(key, ctx.key, true, await getTokenProgram(key));
    }),
  );
  const sourceInfos = await getConnection().getMultipleAccountsInfo(sourceAtas);
  const sources = sourceMints.map((mint, index) => ({
    mint,
    balanceBefore: decodeTokenAmount(sourceInfos[index]).toString(),
  }));
  const built = await assemble(authority, ixs);
  return sources.length
    ? { ...built, next: zapSwapNextStep({ vault: b.vault, slippageBps }, sources) }
    : built;
});
