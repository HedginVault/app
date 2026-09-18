import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { DLMM_MAX_POSITION_WIDTH } from "@/lib/constants";
import { getPool } from "@/server/dlmm-pool";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import {
  dlmmAddLiquidityForRangeIx,
  dlmmInitializePositionIx,
  missingBinArrayIxs,
  onChainUpper,
} from "@/server/tx/dlmm";
import { addNextStep } from "@/server/tx/next-steps";
import { dlmmOpenBody } from "@/server/tx/schemas";
import { fitsInTransaction } from "@/server/tx/size";

/**
 * Opens a position: missing bin arrays, `meteora_dlmm_initialize_position`, then add liquidity — in one
 * transaction when it fits, otherwise the first transaction plus a `next` step for `dlmm/add`.
 * `upperBinId` is exclusive, as in `dlmm/initialize`.
 */
export const POST = handlePost(
  dlmmOpenBody,
  async (b) => {
    if (b.upperBinId <= b.lowerBinId)
      throw new ApiError(400, "Validation", "upperBinId must be greater than lowerBinId");
    if (b.upperBinId - b.lowerBinId > DLMM_MAX_POSITION_WIDTH)
      throw new ApiError(400, "Validation", `range must span at most ${DLMM_MAX_POSITION_WIDTH} bins`);
    if (BigInt(b.amountX) === 0n && BigInt(b.amountY) === 0n)
      throw new ApiError(400, "Validation", "amountX or amountY must be greater than zero");

    const authority = new PublicKey(b.payer);
    const ctx = await loadVaultCtx(b.vault);
    assertAuthority(ctx, authority);
    const program = getProgram();
    const lbPair = new PublicKey(b.lbPair);
    const dlmm = await getPool(lbPair);
    const upper = onChainUpper(b.upperBinId);

    const { ix: initIx, position } = await dlmmInitializePositionIx(program, ctx, authority, lbPair, b.lowerBinId, b.upperBinId);
    const binArrays = await missingBinArrayIxs(dlmm, b.lowerBinId, upper, authority);
    const add = await dlmmAddLiquidityForRangeIx(
      program, ctx, authority, position.publicKey, dlmm, b.lowerBinId, upper,
      new BN(b.amountX), new BN(b.amountY), b.shape, b.maxActiveBinSlippage,
    );
    const meta = { position: position.publicKey.toBase58(), lowerBinId: b.lowerBinId, upperBinId: upper };
    const all = [...binArrays, initIx, ...add];

    if (fitsInTransaction(authority, all)) return { ...(await assemble(authority, all, { signers: [position] })), ...meta };
    return {
      ...(await assemble(authority, [...binArrays, initIx], { signers: [position] })),
      ...meta,
      next: addNextStep(b, meta.position),
    };
  },
);
