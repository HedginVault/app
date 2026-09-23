"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QuoteParams } from "@/lib/api";
import type { ChartTarget, MarketTimeframe } from "@/lib/types";

export const queryKeys = {
  config: ["config"] as const,
  vaults: ["vaults"] as const,
  vault: (address: string) => ["vault", address] as const,
  position: (address: string, owner: string) => ["position", address, owner] as const,
  requests: (address: string) => ["requests", address] as const,
  holdings: (address: string) => ["holdings", address] as const,
  strategyHistory: (address: string) => ["strategyHistory", address] as const,
  navHistory: (address: string) => ["navHistory", address] as const,
  manager: (wallet: string) => ["manager", wallet] as const,
  pool: (lbPair: string) => ["pool", lbPair] as const,
  positionRent: (binCount: number) => ["positionRent", binCount] as const,
  ohlcv: (target: string, tf: string) => ["ohlcv", target, tf] as const,
  quote: (q: QuoteParams) => ["quote", q] as const,
  tokenSearch: (q: string) => ["tokenSearch", q] as const,
  poolSearch: (q: string, page: number) => ["poolSearch", q, page] as const,
};

const REFRESH = 20_000;

/**
 * Post-confirmation freshness. TanStack invalidation only makes the client refetch; the server would
 * still answer a 10–15 s memoized entry, so the UI would show pre-transaction state. `useInvalidateVault`
 * marks the affected query keys here and the next fetch of each sends `cache-control: no-cache` once.
 * Markers are JSON key prefixes, so `["position", address]` covers every owner under that vault.
 */
const freshNext = new Set<string>();
const markFresh = (key: readonly unknown[]) => freshNext.add(JSON.stringify(key).slice(0, -1));
const takeFresh = (key: readonly unknown[]): { fresh: boolean } => {
  const k = JSON.stringify(key);
  for (const prefix of freshNext)
    if (k.startsWith(prefix)) {
      freshNext.delete(prefix);
      return { fresh: true };
    }
  return { fresh: false };
};

export const useConfig = () =>
  useQuery({ queryKey: queryKeys.config, queryFn: () => api.config(), refetchInterval: REFRESH });

export const useVaults = () =>
  useQuery({
    queryKey: queryKeys.vaults,
    queryFn: () => api.vaults(takeFresh(queryKeys.vaults)),
    refetchInterval: REFRESH,
  });

export const useVault = (address: string) =>
  useQuery({
    queryKey: queryKeys.vault(address),
    queryFn: () => api.vault(address, takeFresh(queryKeys.vault(address))),
    refetchInterval: REFRESH,
  });

export const usePosition = (address: string, owner: string | undefined) =>
  useQuery({
    queryKey: queryKeys.position(address, owner ?? ""),
    queryFn: () => api.position(address, owner!, takeFresh(queryKeys.position(address, owner ?? ""))),
    enabled: !!owner,
    refetchInterval: REFRESH,
  });

export const useRequests = (address: string) =>
  useQuery({
    queryKey: queryKeys.requests(address),
    queryFn: () => api.requests(address, takeFresh(queryKeys.requests(address))),
    refetchInterval: REFRESH,
  });

export const useHoldings = (address: string) =>
  useQuery({
    queryKey: queryKeys.holdings(address),
    queryFn: () => api.holdings(address, takeFresh(queryKeys.holdings(address))),
    refetchInterval: REFRESH,
  });

export const useStrategyHistory = (address: string) =>
  useQuery({
    queryKey: queryKeys.strategyHistory(address),
    queryFn: () => api.strategyHistory(address, takeFresh(queryKeys.strategyHistory(address))),
    refetchInterval: REFRESH,
    retry: false,
  });

export const useNavHistory = (address: string) =>
  useQuery({
    queryKey: queryKeys.navHistory(address),
    queryFn: () => api.navHistory(address, takeFresh(queryKeys.navHistory(address))),
    refetchInterval: REFRESH,
    retry: false,
  });

export const useManager = (wallet: string | undefined) =>
  useQuery({
    queryKey: queryKeys.manager(wallet ?? ""),
    queryFn: () => api.manager(wallet!, takeFresh(queryKeys.manager(wallet ?? ""))),
    enabled: !!wallet,
  });

/** Candles for a token (USD) or a pool (quote token). `target` undefined disables the query. */
export const useOhlcv = (target: ChartTarget | undefined, tf: MarketTimeframe) =>
  useQuery({
    queryKey: queryKeys.ohlcv(target ? ("mint" in target ? target.mint : `${target.pool}:${target.base ?? ""}`) : "", tf),
    queryFn: () => api.ohlcv(target!, tf),
    enabled: !!target,
    refetchInterval: 60_000,
    retry: false,
  });

export const usePool = (lbPair: string | undefined) =>
  useQuery({
    queryKey: queryKeys.pool(lbPair ?? ""),
    queryFn: () => api.pool(lbPair!),
    enabled: !!lbPair,
    retry: false,
  });

export const usePositionRent = (binCount: number) =>
  useQuery({
    queryKey: queryKeys.positionRent(binCount),
    queryFn: () => api.positionRent(binCount),
    retry: false,
    staleTime: 10 * 60_000,
  });

export const useQuote = (q: QuoteParams, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.quote(q),
    queryFn: () => api.quote(q),
    enabled,
    retry: false,
    staleTime: 10_000,
  });

export const useTokenSearch = (query: string) =>
  useQuery({
    queryKey: queryKeys.tokenSearch(query.trim()),
    queryFn: () => api.searchTokens(query.trim()),
    enabled: query.trim() !== "",
    staleTime: 5 * 60_000,
    retry: false,
  });

export const usePoolSearch = (query: string, page = 1) =>
  useQuery({
    queryKey: queryKeys.poolSearch(query.trim(), page),
    queryFn: () => api.searchPools(query.trim(), page),
    enabled: query.trim() !== "",
    staleTime: 60_000,
    retry: false,
    placeholderData: (prev) => prev,
  });

/** Invalidates everything derived from one vault after a confirmed transaction. */
export function useInvalidateVault() {
  const client = useQueryClient();
  return (address?: string) => {
    markFresh(queryKeys.vaults);
    void client.invalidateQueries({ queryKey: queryKeys.vaults });
    markFresh(["manager"]);
    void client.invalidateQueries({ queryKey: ["manager"] });
    if (!address) return;
    for (const key of [
      queryKeys.vault(address),
      ["position", address],
      queryKeys.requests(address),
      queryKeys.holdings(address),
      queryKeys.strategyHistory(address),
    ] as const) {
      markFresh(key);
      void client.invalidateQueries({ queryKey: key });
    }
  };
}
