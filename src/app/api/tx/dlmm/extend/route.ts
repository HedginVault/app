import { PublicKey } from "@solana/web3.js";
import { DLMM_MAX_POSITION_WIDTH, DLMM_MAX_RESIZE_LENGTH } from "@/lib/constants";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmExtendPositionIx } from "@/server/tx/dlmm";
import { wideStepBody } from "@/server/tx/next-steps";
import { dlmmWideStepBody } from "@/server/tx/schemas";

export const POST = handlePost(dlmmWideStepBody, async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const position = new PublicKey(b.position);
  const program = getProgram();
  const account = await program.account.positionV2.fetch(position);
  if (!account.owner.equals(ctx.key)) throw new ApiError(403, "Denied", "position does not belong to this vault");
  const width = b.targetUpperBinId - account.lowerBinId + 1;
  if (width < 1 || width > DLMM_MAX_POSITION_WIDTH || b.targetUpperBinId <= account.upperBinId)
    throw new ApiError(400, "Validation", `target range must span at most ${DLMM_MAX_POSITION_WIDTH} bins and extend the position`);
  const binsToAdd = Math.min(DLMM_MAX_RESIZE_LENGTH, b.targetUpperBinId - account.upperBinId);
  const ix = await dlmmExtendPositionIx(program, ctx, authority, position, account.lbPair, binsToAdd);
  const nextUpper = account.upperBinId + binsToAdd;
  const nextBody = wideStepBody(b);
  return {
    ...(await assemble(authority, [ix])),
    next: nextUpper < b.targetUpperBinId
      ? { path: "dlmm/extend", body: nextBody }
      : { path: "dlmm/add-range", body: { ...nextBody, cursorBinId: account.lowerBinId } },
  };
});
