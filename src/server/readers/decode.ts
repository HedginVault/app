import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import type {
  DepositRequestView,
  Status,
  TokenInfo,
  VaultMetadata,
  VaultSummary,
  WithdrawalRequestView,
} from "@/lib/types";
import { isDepositCancellable, requestState } from "@/lib/vault-logic";

export const decodeName = (bytes: number[]) => new TextDecoder().decode(Uint8Array.from(bytes)).replace(/\0+$/, "");

export const decodeStatus = (s: object): Status => Object.keys(s)[0] as Status;

export const bn = (v: BN) => v.toString();
export const ts = (v: BN) => v.toNumber();

interface VaultSummaryFields {
  id: BN;
  name: number[];
  status: object;
  depositMint: PublicKey;
  totalAssets: BN;
  navPerShare: BN;
  depositCap: BN;
  performanceFeeBps: number;
  managementFeeBps: number;
  lastNavTs: BN;
}

export function toVaultSummary(
  address: string,
  a: VaultSummaryFields,
  token: TokenInfo,
  metadata: VaultMetadata | null,
): VaultSummary {
  return {
    address,
    id: bn(a.id),
    name: decodeName(a.name) || `Vault #${a.id.toString()}`,
    status: decodeStatus(a.status),
    depositMint: a.depositMint.toBase58(),
    depositSymbol: token.symbol,
    depositDecimals: token.decimals,
    depositLogo: token.logo,
    depositPriceUsd: token.priceUsd,
    totalAssets: bn(a.totalAssets),
    navPerShare: bn(a.navPerShare),
    depositCap: bn(a.depositCap),
    performanceFeeBps: a.performanceFeeBps,
    managementFeeBps: a.managementFeeBps,
    lastNavTs: ts(a.lastNavTs),
    metadata,
  };
}

interface DepositRequestFields {
  authority: PublicKey;
  amount: BN;
  epoch: BN;
  createdTs: BN;
}

export function toDepositRequestView(
  r: DepositRequestFields,
  navEpoch: bigint,
  navPerShare: bigint,
): DepositRequestView {
  const state = requestState(navEpoch, BigInt(r.epoch.toString()));
  return {
    owner: r.authority.toBase58(),
    amount: bn(r.amount),
    epoch: bn(r.epoch),
    createdTs: ts(r.createdTs),
    state,
    cancellable: isDepositCancellable(state, navPerShare),
  };
}

interface WithdrawalRequestFields {
  authority: PublicKey;
  shares: BN;
  epoch: BN;
  createdTs: BN;
}

export function toWithdrawalRequestView(r: WithdrawalRequestFields, navEpoch: bigint): WithdrawalRequestView {
  const state = requestState(navEpoch, BigInt(r.epoch.toString()));
  return {
    owner: r.authority.toBase58(),
    shares: bn(r.shares),
    epoch: bn(r.epoch),
    createdTs: ts(r.createdTs),
    state,
    cancellable: state === "pending",
  };
}
