import { PublicKey } from "@solana/web3.js";
import type { TokenInfo } from "@/lib/types";
import { getCached, setCached } from "./cache";
import { ApiError } from "./errors";
import { getPrices, JUPITER_HOST, jupiterHeaders } from "./prices";
import { CLUSTER, getConnection, TOKEN_PROGRAM_ID } from "./program";
import { decodeMint, getMultipleAccounts } from "./rpc";

export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export interface MintInfo {
  decimals: number;
  tokenProgram: PublicKey;
}

/** Mainnet mints answered with zero RPC. Decimals and symbol here are authoritative; name and logo still come from Jupiter. */
const KNOWN_MINTS: Record<string, MintInfo & { symbol: string }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", decimals: 6, tokenProgram: TOKEN_PROGRAM_ID },
  So11111111111111111111111111111111111111112: { symbol: "SOL", decimals: 9, tokenProgram: TOKEN_PROGRAM_ID },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", decimals: 6, tokenProgram: TOKEN_PROGRAM_ID },
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": { symbol: "WBTC", decimals: 8, tokenProgram: TOKEN_PROGRAM_ID },
};

/** The table is mainnet addresses; on any other cluster the same base58 may be a different mint. */
const knownMint = (key: string) => (CLUSTER === "mainnet-beta" ? KNOWN_MINTS[key] : undefined);

const MINT_TTL_MS = 60 * 60_000;
const META_TTL_MS = 60 * 60_000;
const MAX_SEARCH = 100; // Jupiter /tokens/v2/search cap

/** Decimals + owning token program for each mint: known mints cost nothing, the rest one batched read (ceil(n/100) RPC). */
export async function getMintInfos(mints: PublicKey[]): Promise<Map<string, MintInfo>> {
  const out = new Map<string, MintInfo>();
  const seen = new Set<string>();
  const missing: PublicKey[] = [];
  for (const mint of mints) {
    const key = mint.toBase58();
    if (seen.has(key)) continue;
    seen.add(key);
    const known = knownMint(key);
    const hit = known
      ? { decimals: known.decimals, tokenProgram: known.tokenProgram }
      : getCached<MintInfo>(`mint:${key}`);
    if (hit) out.set(key, hit);
    else missing.push(mint);
  }
  if (missing.length) {
    const infos = await getMultipleAccounts(getConnection(), missing);
    infos.forEach((info, i) => {
      const key = missing[i].toBase58();
      const mint = decodeMint(info);
      if (!info || !mint) throw new ApiError(404, "NotFound", `Mint ${key} not found`);
      const value = { decimals: mint.decimals, tokenProgram: info.owner };
      setCached(`mint:${key}`, value, MINT_TTL_MS);
      out.set(key, value);
    });
  }
  return out;
}

export const getTokenProgram = async (mint: PublicKey) =>
  (await getMintInfos([mint])).get(mint.toBase58())!.tokenProgram;

interface JupiterToken {
  id: string;
  symbol: string;
  name: string;
  icon: string | null;
}

/** Symbol, name and logo from Jupiter token search; ceil(uncached / 100) HTTP calls, failures leave mints unresolved. */
async function getMetadata(mints: string[]): Promise<Map<string, JupiterToken>> {
  const out = new Map<string, JupiterToken>();
  const missing: string[] = [];
  for (const mint of mints) {
    const hit = getCached<JupiterToken | null>(`meta:${mint}`);
    if (hit === undefined) missing.push(mint);
    else if (hit) out.set(mint, hit);
  }
  for (let i = 0; i < missing.length; i += MAX_SEARCH) {
    const chunk = missing.slice(i, i + MAX_SEARCH);
    try {
      const res = await fetch(`${JUPITER_HOST}/tokens/v2/search?query=${chunk.join(",")}`, {
        headers: jupiterHeaders(),
      });
      if (!res.ok) throw new Error(`Jupiter token search ${res.status}`);
      const found = new Map(((await res.json()) as JupiterToken[]).map((t) => [t.id, t]));
      for (const mint of chunk) {
        const token = found.get(mint) ?? null;
        setCached(`meta:${mint}`, token, META_TTL_MS);
        if (token) out.set(mint, token);
      }
    } catch (e) {
      console.warn("[tokens] Jupiter unavailable:", e instanceof Error ? e.message : e);
    }
  }
  return out;
}

const shortSymbol = (mint: string) => `${mint.slice(0, 4)}…${mint.slice(-4)}`;

/** Full token view for each mint: on-chain decimals, Jupiter metadata and price. RPC cost = getMintInfos; HTTP ≤ 2 calls per 50 mints. */
export async function getTokenInfos(mints: PublicKey[]): Promise<Map<string, TokenInfo>> {
  const unique = new Map(mints.map((m) => [m.toBase58(), m]));
  const keys = [...unique.keys()];
  const [mintInfos, meta, prices] = await Promise.all([
    getMintInfos([...unique.values()]),
    getMetadata(keys),
    getPrices(keys),
  ]);
  return new Map(
    keys.map((key) => {
      const m = meta.get(key);
      return [
        key,
        {
          mint: key,
          symbol: knownMint(key)?.symbol ?? m?.symbol ?? shortSymbol(key),
          name: m?.name,
          decimals: mintInfos.get(key)!.decimals,
          logo: m?.icon ?? null,
          priceUsd: prices.get(key) ?? null,
        },
      ];
    }),
  );
}

export const getTokenInfo = async (mint: PublicKey) => (await getTokenInfos([mint])).get(mint.toBase58())!;
