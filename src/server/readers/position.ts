import "server-only";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import type { RequestQueue, UserPosition } from "@/lib/types";
import { estimatePayout } from "@/lib/vault-logic";
import { cached } from "../cache";
import { getDepositRequestPda, getShareMintPda, getWithdrawalRequestPda } from "../pda";
import { getConnection, getProgram } from "../program";
import { decodeTokenAmount, getMultipleAccounts } from "../rpc";
import { getTokenProgram } from "../tokens";
import { toDepositRequestView, toWithdrawalRequestView } from "./decode";
import { fetchVaultAccount } from "./vaults";

const TTL = 10_000;

/**
 * 2 RPC: the vault, then one batched read of share ATA, deposit ATA, deposit request and withdrawal
 * request.
 *
 * `shares` is the balance of the owner's share ATA only. Shares moved into the vault's share escrow
 * by a pending withdrawal are NOT counted here — those live in `withdrawalRequest.shares`. A holder's
 * full economic exposure is `shares + (withdrawalRequest?.shares ?? 0)`, and `valueAtNav` likewise
 * values the wallet balance alone.
 */
export const readPosition = (vault: string, owner: string) =>
  cached(`position:${vault}:${owner}`, TTL, async (): Promise<UserPosition> => {
    const { key, account } = await fetchVaultAccount(vault);
    const user = new PublicKey(owner);
    const program = getProgram();
    const tokenProgram = await getTokenProgram(account.depositMint);
    const navEpoch = BigInt(account.navEpoch.toString());
    const nav = BigInt(account.navPerShare.toString());

    const [shareInfo, depositInfo, depInfo, wdInfo] = await getMultipleAccounts(getConnection(), [
      getAssociatedTokenAddressSync(getShareMintPda(key), user, false),
      getAssociatedTokenAddressSync(account.depositMint, user, false, tokenProgram),
      getDepositRequestPda(key, user),
      getWithdrawalRequestPda(key, user),
    ]);
    const shares = decodeTokenAmount(shareInfo);
    const dep = depInfo ? program.coder.accounts.decode<DepositRequestAccount>("depositRequest", depInfo.data) : null;
    const wd = wdInfo
      ? program.coder.accounts.decode<WithdrawalRequestAccount>("withdrawalRequest", wdInfo.data)
      : null;

    return {
      shares: shares.toString(),
      valueAtNav: estimatePayout(shares, nav).toString(),
      depositTokenBalance: decodeTokenAmount(depositInfo).toString(),
      depositRequest: dep ? toDepositRequestView(dep, navEpoch, nav) : null,
      withdrawalRequest: wd ? toWithdrawalRequestView(wd, navEpoch) : null,
    };
  });

type DepositRequestAccount = Awaited<ReturnType<ReturnType<typeof getProgram>["account"]["depositRequest"]["fetch"]>>;
type WithdrawalRequestAccount = Awaited<
  ReturnType<ReturnType<typeof getProgram>["account"]["withdrawalRequest"]["fetch"]>
>;

// DepositRequest / WithdrawalRequest layout: 8 discriminator + 32 authority, then vault.
const VAULT_OFFSET = 40;

/**
 * 3 RPC: the vault, then one getProgramAccounts per request type filtered by vault. Uncached — the
 * resolve builders must never build against a memoized queue, or a second "Resolve all" would
 * rebuild instructions for requests that were just resolved.
 */
export async function fetchRequestQueue(vault: string): Promise<RequestQueue> {
  const { key, account } = await fetchVaultAccount(vault);
  const program = getProgram();
  const navEpoch = BigInt(account.navEpoch.toString());
  const nav = BigInt(account.navPerShare.toString());
  const filter = [{ memcmp: { offset: VAULT_OFFSET, bytes: key.toBase58() } }];
  const [deposits, withdrawals] = await Promise.all([
    program.account.depositRequest.all(filter),
    program.account.withdrawalRequest.all(filter),
  ]);
  const byAge = (a: { createdTs: number }, b: { createdTs: number }) => a.createdTs - b.createdTs;
  return {
    deposits: deposits.map((d) => toDepositRequestView(d.account, navEpoch, nav)).sort(byAge),
    withdrawals: withdrawals.map((w) => toWithdrawalRequestView(w.account, navEpoch)).sort(byAge),
  };
}

/** The read-path wrapper: same 3 RPC, memoized for 10 s. */
export const readRequestQueue = (vault: string) =>
  cached(`requests:${vault}`, TTL, () => fetchRequestQueue(vault));
