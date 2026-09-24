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
  /** Non-deposit tokens sitting in the vault's wallet outside any strategy (airdrops, dust). */
  unmanagedHoldings: { token: TokenInfo; amount: string }[];
  pendingDeposits: string;
  pendingWithdrawalShares: string;
  unclaimedManagerFeeShares: string;
  unclaimedPlatformFeeShares: string;
  epochOutflow: string;
  highWaterMark: string;
  navEpoch: string;
  minDeposit: string;
  minWithdrawalShares: string;
  depositPaused: boolean;
  withdrawalPaused: boolean;
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
  binStep: number;
  /** Human prices (token Y per token X) of the lower, upper and active bins. */
  lowerPrice: string;
  upperPrice: string;
  activePrice: string;
  amountX: string;
  amountY: string;
  pendingFeeX: string;
  pendingFeeY: string;
  /** Per-bin amounts held by this position, base units. */
  bins: { binId: number; amountX: string; amountY: string }[];
  /** All-time PnL from Meteora's indexer; `null` if unavailable. */
  pnlUsd: number | null;
  pnlPct: number | null;
}

/** A DLMM strategy whose position could not be read; reported instead of dropped. */
export interface UnreadableStrategyView extends StrategyBase {
  type: "unreadable";
  position: string;
  reason: string;
}

export type StrategyView = JupiterStrategyView | DlmmStrategyView | UnreadableStrategyView;

export interface ManagerView {
  isManager: boolean;
  vaults: VaultSummary[];
}

export type MarketTimeframe = "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

/** A token in USD, or a pool priced as `base` (default: the pool's own base) in the other token. */
/** Inclusive price bounds of a DLMM range, token Y per token X. */
export interface PriceRange {
  min: number;
  max: number;
}

export type ChartTarget = { mint: string } | { pool: string; base?: string };

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OhlcvView {
  /** e.g. "SOL / USDC" */
  name: string;
  /** "usd" for a token chart, the pool's quote symbol for a pair chart. */
  quote: string;
  candles: Candle[];
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
  simulation: { unitsConsumed: number; deferred?: boolean };
  /** Consecutive marked transactions may be submitted together; surrounding unmarked steps are confirmation barriers. */
  sendConcurrently?: boolean;
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

/** A value in deposit base units with its USD estimate and share of the live total. */
export interface Money {
  value: string | null;
  usd: number | null;
  shareBps: number | null;
}

export interface TokenExposure extends Money {
  token: TokenInfo;
  amount: string;
}

export interface IdlePositionView extends Money {
  kind: "idle";
  token: TokenInfo;
  amount: string;
}

export interface SwapPositionView extends Money {
  kind: "swap";
  strategy: string;
  token: TokenInfo;
  amount: string;
  lastActionTs: number;
  closable: boolean;
}

export interface LpRange {
  lowerBinId: number;
  /** Inclusive: the last bin the position owns. */
  upperBinId: number;
  activeBinId: number;
  binStep: number;
  lowerPrice: string;
  upperPrice: string;
  activePrice: string;
  inRange: boolean;
}

export interface LpPositionView extends Money {
  kind: "lp";
  strategy: string;
  position: string;
  lbPair: string;
  tokenX: TokenInfo;
  tokenY: TokenInfo;
  amountX: string;
  amountY: string;
  feeX: string;
  feeY: string;
  lastActionTs: number;
  range: LpRange;
  bins: { binId: number; amountX: string; amountY: string }[];
  closable: boolean;
  pnlUsd: number | null;
  pnlPct: number | null;
}

/** A strategy whose position could not be read; it has no value. */
export interface ErrorPositionView {
  kind: "error";
  strategy: string;
  position: string;
  reason: string;
  value: null;
  usd: null;
  shareBps: null;
  lastActionTs: number;
}

export type PositionView = IdlePositionView | SwapPositionView | LpPositionView | ErrorPositionView;

export interface StrategyHistoryToken {
  mint: string;
  symbol: string | null;
  decimals: number | null;
  contributed: string;
  returned: string;
  feesGross: string;
  feesTreasury: string;
  feesRetained: string;
  /** Exact token-unit cash-flow result: returned + retained fees - contributed. */
  realizedPnl: string;
}

export interface NavHistoryPoint {
  epoch: number;
  ts: number | null;
  totalAssets: string;
  navPerShare: string;
  highWaterMark: string;
  overridden: boolean;
}

export interface StrategyHistoryItem {
  strategy: string;
  id: number | null;
  type: "jupiter" | "dlmm" | null;
  protocolAccount: string | null;
  openedTs: number | null;
  closedTs: number;
  openSignature: string | null;
  closeSignature: string;
  /** False for strategies opened before exact accounting fields were added to strategy events. */
  exact: boolean;
  tokens: StrategyHistoryToken[];
}

export type OrganicScoreLabel = "high" | "medium" | "low";

export interface TokenSearchResult extends TokenInfo {
  verified: boolean;
  liquidityUsd: number | null;
  /** Jupiter organic score, 0–100; null when Jupiter has not scored the token. */
  organicScore: number | null;
  organicScoreLabel: OrganicScoreLabel | null;
}

export interface PoolSearchToken {
  mint: string;
  symbol: string;
  decimals: number;
  verified: boolean;
  logo: string | null;
}

export interface PoolSearchResult {
  address: string;
  name: string;
  tokenX: PoolSearchToken;
  tokenY: PoolSearchToken;
  binStep: number;
  /** Percent, e.g. 0.04 = 0.04 %. */
  baseFeePct: number;
  tvl: number;
  volume24h: number;
  fees24h: number;
  /** Percent, 24 h fees / TVL. */
  feeTvl24h: number;
  /** Token Y per token X. */
  currentPrice: number;
}

export interface PoolSearchPage {
  total: number;
  page: number;
  pages: number;
  pools: PoolSearchResult[];
}

export interface HoldingsView {
  depositToken: TokenInfo;
  /** Live estimate, deposit base units. */
  totalValue: string;
  totalUsd: number | null;
  /** On-chain NAV total assets, for comparison. */
  navTotalAssets: string;
  navDeltaBps: number | null;
  partial: boolean;
  /** Symbols of tokens with no price. */
  unpriced: string[];
  tokens: TokenExposure[];
  positions: PositionView[];
}

/** A follow-up transaction the client builds after the previous one confirms. `body` excludes `payer`. */
export interface NextStep {
  path: string;
  body: Record<string, unknown>;
}

export interface BuiltStep extends BuiltTransaction {
  next?: NextStep;
}
