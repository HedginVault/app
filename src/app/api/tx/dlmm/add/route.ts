import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { DLMM_INITIAL_POSITION_WIDTH } from "@/lib/constants";
import { getActiveBinIds, getPool } from "@/server/dlmm-pool";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmAddLiquidityIx } from "@/server/tx/dlmm";
import { dlmmAddBody } from "@/server/tx/schemas";
import { buildWideAdd } from "@/server/tx/wide-add";

export const POST = handlePost(
  dlmmAddBody,
  async (b) => {
    const authority = new PublicKey(b.payer);
    const ctx = await loadVaultCtx(b.vault);
    assertAuthority(ctx, authority);
    const position = new PublicKey(b.position);
    const account = await getProgram().account.positionV2.fetch(position);
    if (account.upperBinId - account.lowerBinId + 1 > DLMM_INITIAL_POSITION_WIDTH) {
      const dlmm = await getPool(account.lbPair);
      const activeBinId = (await getActiveBinIds([dlmm])).get(account.lbPair.toBase58()) ?? dlmm.lbPair.activeId;
      return buildWideAdd({
        ...b,
        targetUpperBinId: account.upperBinId,
        cursorBinId: account.lowerBinId,
        activeBinId,
      });
    }
    const ixs = await dlmmAddLiquidityIx(
      getProgram(),
      ctx,
      authority,
      position,
      new BN(b.amountX),
      new BN(b.amountY),
      b.shape,
      b.maxActiveBinSlippage,
    );
    return assemble(authority, ixs);
  },
);
