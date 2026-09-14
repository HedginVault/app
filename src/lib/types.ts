export type Status = "normal" | "paused" | "reduceOnly";

export interface TokenInfo {
  mint: string;
  symbol: string;
  name?: string;
  decimals: number;
  logo: string | null;
  priceUsd: number | null;
}

export interface VaultMetadata {
  description: string;
  strategy: string;
  managerName: string;
  tags: string[];
  logo?: string;
}

export interface ConfigView {
  admin: string;
  navUpdater: string;
  treasuryAuthority: string;
  guardian: string;
  nextVaultId: string;
  status: Status;
  platformPerformanceFeeBps: number;
  platformManagementFeeBps: number;
  maxNavDeviationBps: number;
  maxEpochOutflowBps: number;
  maxSlippageBps: number;
}

export interface VaultSummary {
  address: string;
  id: string;
  name: string;
  status: Status;
  depositMint: string;
  depositSymbol: string;
  depositDecimals: number;
  depositLogo: string | null;
  depositPriceUsd: number | null;
  totalAssets: string;
  navPerShare: string;
  depositCap: string;
  performanceFeeBps: number;
  managementFeeBps: number;
  lastNavTs: number;
  metadata: VaultMetadata | null;
}

export interface VaultDetail extends VaultSummary {
  authority: string;
  shareMint: string;
  shareSupply: string;
  idleBalance: string;
  pendingDeposits: string;
  pendingWithdrawalShares: string;
  unclaimedManagerFeeShares: string;
  unclaimedPlatformFeeShares: string;
  epochOutflow: string;
  highWaterMark: string;
  navEpoch: string;
  minDeposit: string;
  minWithdrawalShares: string;
  pendingPerformanceFeeBps: number;
  pendingManagementFeeBps: number;
  feeEffectiveTs: number;
  openStrategyCount: number;
  protocol: {
    status: Status;
    maxEpochOutflowBps: number;
    maxSlippageBps: number;
  };
}

export type RequestState = "pending" | "resolvable";

export interface DepositRequestView {
  owner: string;
  amount: string;
  epoch: string;
  createdTs: number;
  state: RequestState;
  cancellable: boolean;
}

export interface WithdrawalRequestView {
  owner: string;
  shares: string;
  epoch: string;
  createdTs: number;
  state: RequestState;
  cancellable: boolean;
}

export interface UserPosition {
  shares: string;
  valueAtNav: string;
  depositTokenBalance: string;
  depositRequest: DepositRequestView | null;
  withdrawalRequest: WithdrawalRequestView | null;
}

export interface RequestQueue {
  deposits: DepositRequestView[];
  withdrawals: WithdrawalRequestView[];
}

interface StrategyBase {
  address: string;
  id: number;
  createdTs: number;
  lastActionTs: number;
}

export interface JupiterStrategyView extends StrategyBase {
  type: "jupiter";
  targetMint: string;
  symbol: string;
  decimals: number;
  logo: string | null;
  priceUsd: number | null;
  vaultBalance: string;
}

export interface DlmmStrategyView extends StrategyBase {
  type: "dlmm";
  position: string;
  lbPair: string;
  tokenX: TokenInfo;
  tokenY: TokenInfo;
  lowerBinId: number;
  upperBinId: number;
  activeBinId: number;
  amountX: string;
  amountY: string;
  pendingFeeX: string;
  pendingFeeY: string;
}

export type StrategyView = JupiterStrategyView | DlmmStrategyView;

export interface ManagerView {
  isManager: boolean;
  vaults: VaultSummary[];
}

export interface PoolInfo {
  lbPair: string;
  tokenX: TokenInfo;
  tokenY: TokenInfo;
  binStep: number;
  activeBinId: number;
  activePrice: string;
}

export interface QuoteView {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routeLabels: string[];
}

export interface BuiltTransaction {
  transaction: string;
  simulation: { unitsConsumed: number };
}

export interface SentTransaction {
  signature: string;
}

export type TransactionStatus =
  | { status: "pending" | "confirmed" | "expired" }
  | { status: "failed"; code: string; message: string; logs: string[] };

export interface ApiError {
  error: { code: string; message: string; logs?: string[] };
}

export type DlmmShape = "spot" | "curve" | "bidAsk";
