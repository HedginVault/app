import { getCached, setCached } from "./cache";

// An env var present but blank (as `.env.example` ships it) must fall back, not become "".
const API_KEY = process.env.JUPITER_API_KEY?.trim() || undefined;
export const JUPITER_HOST =
  process.env.JUPITER_API_HOST?.trim() || (API_KEY ? "https://api.jup.ag" : "https://lite-api.jup.ag");
export const jupiterHeaders = () => ({
  "Content-Type": "application/json",
  ...(API_KEY ? { "x-api-key": API_KEY } : {}),
});

const MAX_IDS = 50; // Jupiter /price/v3 cap
const PRICE_TTL_MS = 60_000;

/** USD prices from Jupiter, ceil(unpriced-mints / 50) HTTP calls; unpriced or unreachable mints are absent. */
export async function getPrices(mints: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const missing: string[] = [];
  for (const mint of new Set(mints)) {
    const hit = getCached<number | null>(`price:${mint}`);
    if (hit === undefined) missing.push(mint);
    else if (hit !== null) out.set(mint, hit);
  }
  for (let i = 0; i < missing.length; i += MAX_IDS) {
    const chunk = missing.slice(i, i + MAX_IDS);
    let body: Record<string, { usdPrice: number } | null> = {};
    try {
      const res = await fetch(`${JUPITER_HOST}/price/v3?ids=${chunk.join(",")}`, { headers: jupiterHeaders() });
      if (!res.ok) throw new Error(`Jupiter price ${res.status}`);
      body = (await res.json()) as Record<string, { usdPrice: number } | null>;
    } catch (e) {
      console.warn("[prices] Jupiter unavailable:", e instanceof Error ? e.message : e);
      continue;
    }
    for (const mint of chunk) {
      const price = body[mint]?.usdPrice ?? null;
      setCached(`price:${mint}`, price, PRICE_TTL_MS);
      if (price !== null) out.set(mint, price);
    }
  }
  return out;
}
