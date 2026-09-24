import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { DLMM_INITIAL_POSITION_WIDTH, DLMM_MAX_POSITION_WIDTH, DLMM_MAX_RESIZE_LENGTH } from "@/lib/constants";
import { getActiveBinIds, getPool } from "@/server/dlmm-pool";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import {
  dlmmAddLiquidityForRangeIx,
  dlmmExtendPositionIx,
  dlmmInitializePositionIx,
  missingBinArrayIxs,
  onChainUpper,
} from "@/server/tx/dlmm";
import { dlmmOpenBody } from "@/server/tx/schemas";
import { fitsInTransaction } from "@/server/tx/size";
import { buildWideAddPlan } from "@/server/tx/wide-add";

/**
 * Opens a position and prepares resize and funding transactions as one wallet-signable batch.
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

    if (b.upperBinId - b.lowerBinId > DLMM_INITIAL_POSITION_WIDTH) {
      const activeBinId = (await getActiveBinIds([dlmm])).get(lbPair.toBase58()) ?? dlmm.lbPair.activeId;
      if ((BigInt(b.amountX) > 0n && upper < activeBinId) || (BigInt(b.amountY) > 0n && b.lowerBinId > activeBinId))
        throw new ApiError(400, "Validation", "the selected range cannot hold the supplied token amount");
      const initialUpperExclusive = b.lowerBinId + DLMM_INITIAL_POSITION_WIDTH;
      const { ix, position } = await dlmmInitializePositionIx(
        program, ctx, authority, lbPair, b.lowerBinId, initialUpperExclusive,
      );
      const positionAddress = position.publicKey.toBase58();
      const instructionGroups = [[ix]];
      let createdUpper = onChainUpper(initialUpperExclusive);
      while (createdUpper < upper) {
        const binsToAdd = Math.min(DLMM_MAX_RESIZE_LENGTH, upper - createdUpper);
        const resize = await dlmmExtendPositionIx(program, ctx, authority, position.publicKey, lbPair, binsToAdd);
        const current = instructionGroups.at(-1)!;
        if (fitsInTransaction(authority, [...current, resize])) current.push(resize);
        else instructionGroups.push([resize]);
        createdUpper += binsToAdd;
      }
      const resizeTransactions = [];
      for (let index = 0; index < instructionGroups.length; index++) {
        resizeTransactions.push(await assemble(authority, instructionGroups[index], {
          signers: index === 0 ? [position] : [],
          deferSimulation: index > 0,
        }));
      }
      const fundingTransactions = await buildWideAddPlan({
        authority,
        ctx,
        position: position.publicKey,
        program,
        dlmm,
        lowerBinId: b.lowerBinId,
        upperBinId: upper,
        cursorBinId: b.lowerBinId,
        activeBinId,
        amountXBaseUnits: BigInt(b.amountX),
        amountYBaseUnits: BigInt(b.amountY),
        shape: b.shape,
        maxActiveBinSlippage: b.maxActiveBinSlippage,
        deferFirstSimulation: true,
      });
      return [
        {
          ...resizeTransactions[0],
          position: positionAddress,
          lowerBinId: b.lowerBinId,
          upperBinId: upper,
        },
        ...resizeTransactions.slice(1),
        ...fundingTransactions,
      ];
    }

    const { ix: initIx, position } = await dlmmInitializePositionIx(program, ctx, authority, lbPair, b.lowerBinId, b.upperBinId);
    const binArrays = await missingBinArrayIxs(dlmm, b.lowerBinId, upper, authority);
    const add = await dlmmAddLiquidityForRangeIx(
      program, ctx, authority, position.publicKey, dlmm, b.lowerBinId, upper,
      new BN(b.amountX), new BN(b.amountY), b.shape, b.maxActiveBinSlippage,
    );
    const meta = { position: position.publicKey.toBase58(), lowerBinId: b.lowerBinId, upperBinId: upper };
    const all = [...binArrays, initIx, ...add];

    if (fitsInTransaction(authority, all)) return { ...(await assemble(authority, all, { signers: [position] })), ...meta };
    return [
      { ...(await assemble(authority, [...binArrays, initIx], { signers: [position] })), ...meta },
      await assemble(authority, add, { deferSimulation: true }),
    ];
  },
);
