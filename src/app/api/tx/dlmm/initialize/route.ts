import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { DLMM_INITIAL_POSITION_WIDTH } from "@/lib/constants";
import { getActiveBinIds, getPool, type DLMM } from "@/server/dlmm-pool";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmInitializePositionIx, onChainUpper, pairMints, rangeFromWidth } from "@/server/tx/dlmm";
import { pairStrategySetupIxs } from "@/server/tx/pair-strategy";

export const POST = handlePost(
  z.object({
    payer: pubkey,
    vault: pubkey,
    lbPair: pubkey,
    width: z.number().int().min(1).max(DLMM_INITIAL_POSITION_WIDTH).optional(),
    lowerBinId: z.number().int().optional(),
    upperBinId: z.number().int().optional(),
  }),
  async (b) => {
    const authority = new PublicKey(b.payer);
    const ctx = await loadVaultCtx(b.vault);
    assertAuthority(ctx, authority);
    const lbPair = new PublicKey(b.lbPair);

    let lower = b.lowerBinId;
    let upper = b.upperBinId;
    let dlmm: DLMM | undefined;
    if (lower === undefined || upper === undefined) {
      if (!b.width) throw new ApiError(400, "Validation", "width or lowerBinId/upperBinId required");
      dlmm = await getPool(lbPair);
      const active = (await getActiveBinIds([dlmm])).get(lbPair.toBase58()) ?? dlmm.lbPair.activeId;
      ({ lowerBinId: lower, upperBinId: upper } = rangeFromWidth(active, b.width));
    }
    if (upper <= lower) throw new ApiError(400, "Validation", "upperBinId must be greater than lowerBinId");
    if (upper - lower > DLMM_INITIAL_POSITION_WIDTH)
      throw new ApiError(400, "Validation", `range must span at most ${DLMM_INITIAL_POSITION_WIDTH} bins`);

    const program = getProgram();
    const mints = pairMints(dlmm ?? (await getPool(lbPair)));
    // the program refuses the position until each non-deposit pair mint has its Jupiter strategy
    const setup = await pairStrategySetupIxs(program, ctx, authority, mints);
    const { ix, position } = await dlmmInitializePositionIx(program, ctx, authority, lbPair, mints, lower, upper);
    const built = await assemble(authority, [...setup, ix], { signers: [position] });
    // The requested `upperBinId` is exclusive: the program creates `upper - lower` bins, so the
    // position account stores `upper - 1` as its last bin. Report what the chain will hold.
    return {
      ...built,
      position: position.publicKey.toBase58(),
      lowerBinId: lower,
      upperBinId: onChainUpper(upper),
    };
  },
);
