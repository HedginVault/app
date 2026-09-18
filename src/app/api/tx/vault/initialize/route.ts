import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { ApiError } from "@/server/errors";
import { getConfigPda, getManagerPda, getVaultPda } from "@/server/pda";
import { getProgram } from "@/server/program";
import { amountString, bps, handlePost, pubkey } from "@/server/route";
import { getTokenProgram } from "@/server/tokens";
import { assemble } from "@/server/tx/assemble";
import { vaultInitializeIx } from "@/server/tx/vault";

export const POST = handlePost(
  z.object({
    payer: pubkey,
    // encodeName truncates at 32 UTF-8 bytes, so bound bytes rather than UTF-16 units.
    name: z
      .string()
      .min(1)
      .refine((s) => Buffer.byteLength(s, "utf8") <= 32, "name must be at most 32 bytes"),
    depositMint: pubkey,
    performanceFeeBps: bps,
    managementFeeBps: bps,
    depositCap: amountString,
    minDeposit: amountString,
    minWithdrawalShares: amountString,
  }),
  async (b) => {
    const program = getProgram();
    const authority = new PublicKey(b.payer);
    const manager = await program.account.manager.fetchNullable(getManagerPda(authority));
    if (!manager) throw new ApiError(403, "Forbidden", "Connected wallet is not a whitelisted manager");
    const config = await program.account.config.fetch(getConfigPda());
    const depositMint = new PublicKey(b.depositMint);
    const ix = await vaultInitializeIx(
      program,
      authority,
      {
        name: b.name,
        performanceFeeBps: b.performanceFeeBps,
        managementFeeBps: b.managementFeeBps,
        depositCap: new BN(b.depositCap),
        minDeposit: new BN(b.minDeposit),
        minWithdrawalShares: new BN(b.minWithdrawalShares),
      },
      depositMint,
      await getTokenProgram(depositMint),
      config.nextVaultId,
    );
    // BuiltTransaction & { vault } so the client can navigate after confirmation.
    return { ...(await assemble(authority, [ix])), vault: getVaultPda(config.nextVaultId).toBase58() };
  },
);
