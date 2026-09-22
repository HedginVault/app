import "server-only";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import type { ConfigView, VaultDetail, VaultSummary } from "@/lib/types";
import { cached } from "../cache";
import { ApiError } from "../errors";
import { getConfigPda, getShareMintPda } from "../pda";
import { getConnection, getProgram, TOKEN_PROGRAM_ID } from "../program";
import { getVaultMetadata } from "../registry";
import { decodeMint, decodeTokenAmount, getMultipleAccounts, getOwnedTokenAccounts } from "../rpc";
import { getTokenInfos, getTokenProgram, TOKEN_2022_PROGRAM_ID } from "../tokens";
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

/**
 * 4 RPC: the vault, a batched read of the share mint and the vault's idle token account, and one
 * `getTokenAccountsByOwner` per token program to catch balances the vault holds outside any
 * strategy (airdrops, dust) — otherwise invisible since every other read targets a specific mint.
 */
export const readVaultDetail = (address: string) =>
  cached(`vault:${address}`, TTL, async (): Promise<VaultDetail> => {
    const { key, account } = await fetchVaultAccount(address);
    // `getTokenProgram` fills the mint cache that `getTokenInfos` then reuses, so a cold cache reads
    // the deposit mint once instead of twice; on a warm cache neither call touches the network.
    const tokenProgram = await getTokenProgram(account.depositMint);
    const connection = getConnection();
    const [owned, config] = await Promise.all([
      Promise.all([
        getOwnedTokenAccounts(connection, key, TOKEN_PROGRAM_ID),
        getOwnedTokenAccounts(connection, key, TOKEN_2022_PROGRAM_ID),
      ]),
      readConfig(),
    ]);
    const depositMintKey = account.depositMint.toBase58();
    const unmanaged = new Map<string, bigint>();
    for (const { mint, amount } of [...owned[0], ...owned[1]]) {
      if (mint === depositMintKey || amount === 0n) continue;
      unmanaged.set(mint, (unmanaged.get(mint) ?? 0n) + amount);
    }
    const [tokens, unmanagedTokens] = await Promise.all([
      getTokenInfos([account.depositMint]),
      getTokenInfos([...unmanaged.keys()].map((m) => new PublicKey(m))),
    ]);
    const shareMint = getShareMintPda(key);
    const vaultTokenAccount = getAssociatedTokenAddressSync(account.depositMint, key, true, tokenProgram);
    const [shareMintInfo, idleInfo] = await getMultipleAccounts(connection, [shareMint, vaultTokenAccount]);
    const share = decodeMint(shareMintInfo);
    if (!share) throw new ApiError(500, "Internal", "Share mint account is missing");
    return {
      ...toVaultSummary(address, account, tokens.get(depositMintKey)!, getVaultMetadata(address)),
      authority: account.authority.toBase58(),
      shareMint: shareMint.toBase58(),
      shareSupply: share.supply.toString(),
      idleBalance: decodeTokenAmount(idleInfo).toString(),
      unmanagedHoldings: [...unmanaged.entries()].map(([mint, amount]) => ({
        token: unmanagedTokens.get(mint)!,
        amount: amount.toString(),
      })),
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
