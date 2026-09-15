import "server-only";
import type { PoolSearchPage, PoolSearchResult, TokenSearchResult } from "@/lib/types";
import { cached } from "./cache";
import { ApiError } from "./errors";
import { JUPITER_HOST, jupiterHeaders } from "./prices";
import { getTokenLogos } from "./tokens";

const METEORA_HOST = process.env.METEORA_DLMM_API_HOST?.trim() || "https://dlmm.datapi.meteora.ag";
const TOKEN_TTL_MS = 60 * 60_000;
const POOL_TTL_MS = 60_000;
const MAX_TOKENS = 20;
const PAGE_SIZE = 20;

const normalize = (q: string) => q.trim();

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ApiError(502, "SearchUnavailable", `Search unavailable: ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) throw new ApiError(502, "SearchUnavailable", `Search unavailable (${res.status})`);
  return (await res.json()) as T;
}

interface JupiterSearchToken {
  id: string;
  symbol: string;
  name: string;
  icon: string | null;
  decimals: number;
  usdPrice?: number | null;
  liquidity?: number | null;
  isVerified?: boolean;
}

/** Jupiter token search by symbol, name or mint. One HTTP call per distinct query per hour. */
export const searchTokens = (query: string) => {
  const q = normalize(query);
  return cached(`tokensearch:${q}`, TOKEN_TTL_MS, async (): Promise<TokenSearchResult[]> => {
    const rows = await getJson<JupiterSearchToken[]>(
      `${JUPITER_HOST}/tokens/v2/search?query=${encodeURIComponent(q)}`,
      { headers: jupiterHeaders() },
    );
    return rows.slice(0, MAX_TOKENS).map((t) => ({
      mint: t.id,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logo: t.icon ?? null,
      priceUsd: t.usdPrice ?? null,
      verified: t.isVerified ?? false,
      liquidityUsd: t.liquidity ?? null,
    }));
  });
};

interface MeteoraToken {
  address: string;
  symbol: string;
  decimals: number;
  is_verified: boolean;
}

interface MeteoraPool {
  address: string;
  name: string;
  token_x: MeteoraToken;
  token_y: MeteoraToken;
  pool_config: { bin_step: number; base_fee_pct: number };
  tvl: number;
  current_price: number;
  volume: Record<string, number>;
  fees: Record<string, number>;
  fee_tvl_ratio: Record<string, number>;
  is_blacklisted: boolean;
}

/** Meteora DLMM pool search by symbol, pair ("SOL-USDC") or address. Cached 60 s per query and page. */
export const searchPools = (query: string, page: number) => {
  const q = normalize(query);
  return cached(`poolsearch:${q}:${page}`, POOL_TTL_MS, async (): Promise<PoolSearchPage> => {
    const body = await getJson<{ total: number; pages: number; current_page: number; data: MeteoraPool[] }>(
      `${METEORA_HOST}/pools?query=${encodeURIComponent(query.trim())}&page=${page}&page_size=${PAGE_SIZE}`,
    );
    const pools = body.data.filter((p) => !p.is_blacklisted);
    const logos = await getTokenLogos(pools.flatMap((p) => [p.token_x.address, p.token_y.address]));
    const token = (t: MeteoraToken) => ({
      mint: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
      verified: t.is_verified,
      logo: logos.get(t.address) ?? null,
    });
    return {
      total: body.total,
      page: body.current_page,
      pages: body.pages,
      pools: pools.map(
        (p): PoolSearchResult => ({
          address: p.address,
          name: p.name,
          tokenX: token(p.token_x),
          tokenY: token(p.token_y),
          binStep: p.pool_config.bin_step,
          baseFeePct: p.pool_config.base_fee_pct,
          tvl: p.tvl,
          volume24h: p.volume["24h"] ?? 0,
          fees24h: p.fees["24h"] ?? 0,
          feeTvl24h: p.fee_tvl_ratio["24h"] ?? 0,
          currentPrice: p.current_price,
        }),
      ),
    };
  });
};
