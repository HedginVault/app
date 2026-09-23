import "server-only";
import { DLMM_INITIAL_POSITION_WIDTH, DLMM_MAX_POSITION_WIDTH } from "@/lib/constants";
import { cached } from "./cache";
import { ApiError } from "./errors";
import { getConnection } from "./program";

// Meteora's 8,112-byte PositionV2 payload is preceded by an 8-byte Anchor discriminator.
// Each bin beyond the first 70 adds 112 bytes to the account.
export const positionAccountSize = (binCount: number) =>
  8 + 8_112 + Math.max(0, binCount - DLMM_INITIAL_POSITION_WIDTH) * 112;

/** Refundable PositionV2 account rent. Bin-array rent and transaction fees are separate. */
export function readPositionRent(binCount: number) {
  if (!Number.isInteger(binCount) || binCount < 1 || binCount > DLMM_MAX_POSITION_WIDTH)
    throw new ApiError(400, "Validation", `bin count must be from 1 to ${DLMM_MAX_POSITION_WIDTH}`);
  return cached(`dlmm-position-rent:v2:${binCount}`, 10 * 60_000, async () => ({
    binCount,
    lamports: String(await getConnection().getMinimumBalanceForRentExemption(positionAccountSize(binCount))),
  }));
}
