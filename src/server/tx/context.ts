import { PublicKey } from "@solana/web3.js";
import { ApiError } from "../errors";
import { getShareMintPda } from "../pda";
import { getProgram } from "../program";
import { fetchVaultAccount } from "../readers/vaults";
import { getTokenProgram } from "../tokens";

type VaultAccount = Awaited<ReturnType<ReturnType<typeof getProgram>["account"]["vault"]["fetch"]>>;

export interface VaultCtx {
  key: PublicKey;
  account: VaultAccount;
  depositMint: PublicKey;
  tokenProgram: PublicKey;
  shareMint: PublicKey;
}

/**
 * Fresh, uncached read of the vault — the only account fetch on a build path. `fetchVaultAccount`
 * owns the 404 logic for a missing account and for a valid key that is not a vault (Anchor throws
 * on the discriminator mismatch rather than returning null).
 */
export async function loadVaultCtx(address: string): Promise<VaultCtx> {
  const { key, account } = await fetchVaultAccount(address);
  return {
    key,
    account,
    depositMint: account.depositMint,
    tokenProgram: await getTokenProgram(account.depositMint),
    shareMint: getShareMintPda(key),
  };
}

export function assertAuthority(ctx: VaultCtx, payer: PublicKey) {
  if (!ctx.account.authority.equals(payer))
    throw new ApiError(403, "Forbidden", "Connected wallet is not the vault authority");
}
