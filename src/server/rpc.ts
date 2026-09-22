import { AccountLayout, MintLayout } from "@solana/spl-token";
import type { AccountInfo, Connection, PublicKey } from "@solana/web3.js";

export interface OwnedTokenAccount {
  mint: string;
  amount: bigint;
}

/** Every token account an owner holds under one token program; a malformed account is skipped. */
export async function getOwnedTokenAccounts(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
): Promise<OwnedTokenAccount[]> {
  const { value } = await connection.getTokenAccountsByOwner(owner, { programId });
  const out: OwnedTokenAccount[] = [];
  for (const { account } of value) {
    if (account.data.length < AccountLayout.span) continue;
    const decoded = AccountLayout.decode(account.data.subarray(0, AccountLayout.span));
    out.push({ mint: decoded.mint.toBase58(), amount: decoded.amount });
  }
  return out;
}

/** RPC cap for getMultipleAccounts. */
const MAX_ACCOUNTS_PER_CALL = 100;

/** Batched account read: ceil(keys / 100) RPC calls, results aligned to `keys`. */
export async function getMultipleAccounts(
  connection: Connection,
  keys: PublicKey[],
): Promise<(AccountInfo<Buffer> | null)[]> {
  const out: (AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < keys.length; i += MAX_ACCOUNTS_PER_CALL) {
    out.push(...(await connection.getMultipleAccountsInfo(keys.slice(i, i + MAX_ACCOUNTS_PER_CALL))));
  }
  return out;
}

/** Amount of an SPL / Token-2022 token account; a missing or malformed account counts as 0. */
export function decodeTokenAmount(info: AccountInfo<Buffer> | null): bigint {
  if (!info || info.data.length < AccountLayout.span) return 0n;
  return AccountLayout.decode(info.data.subarray(0, AccountLayout.span)).amount;
}

/** Decimals and supply of an SPL / Token-2022 mint (extensions live past the base 82 bytes). */
export function decodeMint(info: AccountInfo<Buffer> | null): { decimals: number; supply: bigint } | null {
  if (!info || info.data.length < MintLayout.span) return null;
  const raw = MintLayout.decode(info.data.subarray(0, MintLayout.span));
  return { decimals: raw.decimals, supply: raw.supply };
}
