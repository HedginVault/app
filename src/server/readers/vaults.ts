import "server-only";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import type { ConfigView, VaultDetail, VaultSummary } from "@/lib/types";
import { cached } from "../cache";
import { ApiError } from "../errors";
import { getConfigPda, getShareMintPda } from "../pda";
import { getConnection, getProgram } from "../program";
import { getVaultMetadata } from "../registry";
import { decodeMint, decodeTokenAmount, getMultipleAccounts } from "../rpc";
import { getTokenInfos, getTokenProgram } from "../tokens";
import { bn, decodeStatus, toVaultSummary } from "./decode";

const TTL = 15_000;

/** 1 RPC. */
export const readConfig = () =>
  cached("config", TTL, async (): Promise<ConfigView> => {
    const c = await getProgram().account.config.fetch(getConfigPda());
    return {
      admin: c.admin.toBase58(),
      navUpdater: c.navUpdater.toBase58(),
      treasuryAuthority: c.treasuryAuthority.toBase58(),
      guardian: c.guardian.toBase58(),
      nextVaultId: bn(c.nextVaultId),
      status: decodeStatus(c.status),
      platformPerformanceFeeBps: c.platformPerformanceFeeBps,
      platformManagementFeeBps: c.platformManagementFeeBps,
      maxNavDeviationBps: c.maxNavDeviationBps,
      maxEpochOutflowBps: c.maxEpochOutflowBps,
      maxSlippageBps: c.maxSlippageBps || 300,
    };
  });

/** 1 RPC (getProgramAccounts on the Vault discriminator) + one batched token lookup for all deposit mints. */
export const readVaults = () =>
  cached("vaults", TTL, async (): Promise<VaultSummary[]> => {
    const all = await getProgram().account.vault.all();
    const tokens = await getTokenInfos(all.map((v) => v.account.depositMint));
    return all
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
  });

// Anchor throws rather than returning null when the account exists but is not a Vault.
const NOT_A_VAULT = /invalid account discriminator|does not belong to this program/i;

/** 1 RPC. Throws 404 for a missing vault or an address that is not a vault. */
export async function fetchVaultAccount(address: string) {
  let key: PublicKey;
  try {
    key = new PublicKey(address);
  } catch {
    throw new ApiError(400, "Validation", "address must be a public key");
  }
  const account = await getProgram()
    .account.vault.fetchNullable(key)
    .catch((e: unknown) => {
      if (NOT_A_VAULT.test(e instanceof Error ? e.message : String(e))) return null;
      throw e;
    });
  if (!account) throw new ApiError(404, "NotFound", "Vault not found");
  return { key, account };
}

/** 2 RPC: the vault, then one batched read of the share mint and the vault's idle token account. */
export const readVaultDetail = (address: string) =>
  cached(`vault:${address}`, TTL, async (): Promise<VaultDetail> => {
    const { key, account } = await fetchVaultAccount(address);
    // `getTokenProgram` fills the mint cache that `getTokenInfos` then reuses, so a cold cache reads
    // the deposit mint once instead of twice; on a warm cache neither call touches the network.
    const tokenProgram = await getTokenProgram(account.depositMint);
    const [tokens, config] = await Promise.all([getTokenInfos([account.depositMint]), readConfig()]);
    const shareMint = getShareMintPda(key);
    const vaultTokenAccount = getAssociatedTokenAddressSync(account.depositMint, key, true, tokenProgram);
    const [shareMintInfo, idleInfo] = await getMultipleAccounts(getConnection(), [shareMint, vaultTokenAccount]);
    const share = decodeMint(shareMintInfo);
    if (!share) throw new ApiError(500, "Internal", "Share mint account is missing");
    return {
      ...toVaultSummary(address, account, tokens.get(account.depositMint.toBase58())!, getVaultMetadata(address)),
      authority: account.authority.toBase58(),
      shareMint: shareMint.toBase58(),
      shareSupply: share.supply.toString(),
      idleBalance: decodeTokenAmount(idleInfo).toString(),
      pendingDeposits: bn(account.pendingDeposits),
      pendingWithdrawalShares: bn(account.pendingWithdrawalShares),
      unclaimedManagerFeeShares: bn(account.unclaimedManagerFeeShares),
      unclaimedPlatformFeeShares: bn(account.unclaimedPlatformFeeShares),
      epochOutflow: bn(account.epochOutflow),
      highWaterMark: bn(account.highWaterMark),
      navEpoch: bn(account.navEpoch),
      minDeposit: bn(account.minDeposit),
      minWithdrawalShares: bn(account.minWithdrawalShares),
      depositPaused: account.depositPaused !== 0,
      withdrawalPaused: account.withdrawalPaused !== 0,
      pendingPerformanceFeeBps: account.pendingPerformanceFeeBps,
      pendingManagementFeeBps: account.pendingManagementFeeBps,
      feeEffectiveTs: account.feeEffectiveTs.toNumber(),
      openStrategyCount: account.openStrategyCount,
      protocol: {
        status: config.status,
        maxEpochOutflowBps: config.maxEpochOutflowBps,
        maxSlippageBps: config.maxSlippageBps,
      },
    };
  });
