import type {
  ApiError,
  BuiltTransaction,
  ConfigView,
  HoldingsView,
  ChartTarget,
  ManagerView,
  MarketTimeframe,
  NavHistoryPoint,
  OhlcvView,
  PoolInfo,
  PoolSearchPage,
  QuoteView,
  RequestQueue,
  SentTransaction,
  StrategyView,
  StrategyHistoryItem,
  TokenSearchResult,
  TransactionStatus,
  UserPosition,
  VaultDetail,
  VaultSummary,
} from "./types";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public logs?: string[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err =
      body && typeof body === "object" && "error" in body ? (body as ApiError).error : null;
    throw new ApiRequestError(
      res.status,
      err?.code ?? "Http",
      err?.message ?? `Request failed (${res.status})`,
      err?.logs,
    );
  }
  return body as T;
}

/** `fresh` asks the server to bypass its process cache for this one request (see `handleGet`). */
export interface GetOptions {
  fresh?: boolean;
}

const get = <T>(path: string, opts?: GetOptions) =>
  request<T>(path, opts?.fresh ? { headers: { "cache-control": "no-cache" } } : undefined);
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export interface QuoteParams {
  vault: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
}

export const api = {
  config: (o?: GetOptions) => get<ConfigView>("/api/config", o),
  vaults: (o?: GetOptions) => get<VaultSummary[]>("/api/vaults", o),
  vault: (address: string, o?: GetOptions) => get<VaultDetail>(`/api/vaults/${address}`, o),
  position: (address: string, owner: string, o?: GetOptions) =>
    get<UserPosition>(`/api/vaults/${address}/position?owner=${owner}`, o),
  requests: (address: string, o?: GetOptions) =>
    get<RequestQueue>(`/api/vaults/${address}/requests`, o),
  strategies: (address: string, o?: GetOptions) =>
    get<StrategyView[]>(`/api/vaults/${address}/strategies`, o),
  strategyHistory: (address: string, o?: GetOptions) =>
    get<StrategyHistoryItem[]>(`/api/vaults/${address}/strategy-history`, o),
  navHistory: (address: string, o?: GetOptions) =>
    get<NavHistoryPoint[]>(`/api/vaults/${address}/nav`, o),
  holdings: (address: string, o?: GetOptions) => get<HoldingsView>(`/api/vaults/${address}/holdings`, o),
  manager: (wallet: string, o?: GetOptions) => get<ManagerView>(`/api/manager/${wallet}`, o),
  pool: (lbPair: string) => get<PoolInfo>(`/api/dlmm/pool/${lbPair}`),
  ohlcv: (target: ChartTarget, tf: MarketTimeframe, before?: number) =>
    get<OhlcvView>(
      `/api/markets/ohlcv?${"mint" in target ? `mint=${target.mint}` : `pool=${target.pool}${target.base ? `&base=${target.base}` : ""}`}&tf=${tf}${before ? `&before=${before}` : ""}`,
    ),
  quote: (q: QuoteParams) =>
    get<QuoteView & { slippageBps: number }>(
      `/api/jupiter/quote?vault=${q.vault}&inputMint=${q.inputMint}&outputMint=${q.outputMint}&amount=${q.amount}&slippageBps=${q.slippageBps}`,
    ),
  build: <T = BuiltTransaction>(path: string, body: Record<string, unknown>) =>
    post<T>(`/api/tx/${path}`, body),
  send: (transaction: string) => post<SentTransaction>("/api/tx/send", { transaction }),
  txStatus: (signature: string, blockhash: string) =>
    get<TransactionStatus>(`/api/tx/status?signature=${signature}&blockhash=${blockhash}`),
  searchTokens: (query: string) =>
    get<TokenSearchResult[]>(`/api/tokens/search?query=${encodeURIComponent(query)}`),
  searchPools: (query: string, page = 1) =>
    get<PoolSearchPage>(`/api/dlmm/pools/search?query=${encodeURIComponent(query)}&page=${page}`),
};
