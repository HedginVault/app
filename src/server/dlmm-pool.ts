import "server-only";
import { createRequire } from "node:module";
import type { PublicKey } from "@solana/web3.js";
import { getCached, setCached } from "./cache";
import { ApiError } from "./errors";
import { getConnection } from "./program";
import { getMultipleAccounts } from "./rpc";

// The SDK ships an ESM entry that directory-imports its CJS Anchor copy, which Node refuses to
// resolve for a `serverExternalPackages` module. Requiring the CJS build side-steps that.
type Sdk = typeof import("@meteora-ag/dlmm");
type DLMM = InstanceType<Sdk["default"]>;
const sdk = createRequire(import.meta.url)("@meteora-ag/dlmm") as Sdk;
// The CJS build's interop footer replaces `module.exports` with the DLMM class and copies every
// named export onto it, so `.default` is undefined there while the ESM build keeps it. Accept both.
const DLMM = (sdk.default ?? (sdk as unknown as Sdk["default"])) as Sdk["default"];

/**
 * Named SDK helpers, re-exported off the same CJS handle. Nothing outside this module may
 * `import ... from "@meteora-ag/dlmm"` at runtime: the ESM entry breaks the Next build.
 */
export const {
  deriveBinArray,
  getBinArrayAccountMetasCoverage,
  getBinArrayIndexesCoverage,
  StrategyType,
  toStrategyParameters,
} = sdk;
/** The enum's value type (the re-exported `StrategyType` const only carries the value meaning). */
export type StrategyTypeValue = import("@meteora-ag/dlmm").StrategyType;
export type { DLMM };

const POOL_TTL_MS = 5 * 60_000;

const poolKey = (lbPair: string) => `pool:${lbPair}`;

/**
 * Partitions lbPairs into pools already in the 5-minute cache and the distinct keys still to
 * hydrate. Duplicate lbPairs collapse, so N positions in one pool cost one hydration.
 */
export function splitCachedPools(lbPairs: PublicKey[]): { hits: Map<string, DLMM>; misses: PublicKey[] } {
  const hits = new Map<string, DLMM>();
  const misses: PublicKey[] = [];
  const seen = new Set<string>();
  for (const lbPair of lbPairs) {
    const key = lbPair.toBase58();
    if (seen.has(key)) continue;
    seen.add(key);
    const hit = getCached<DLMM>(poolKey(key));
    if (hit) hits.set(key, hit);
    else misses.push(lbPair);
  }
  return { hits, misses };
}

/**
 * Hydrated SDK pools keyed by lbPair, cached 5 minutes each. Every cache miss in the batch is
 * hydrated by a single `DLMM.createMultiple` (~4 batched RPC for the whole batch, not per pool);
 * a fully warm batch costs 0 RPC.
 */
export async function getPools(lbPairs: PublicKey[]): Promise<Map<string, DLMM>> {
  const { hits, misses } = splitCachedPools(lbPairs);
  if (misses.length === 0) return hits;
  for (const pool of await hydrate(misses)) {
    const key = pool.pubkey.toBase58();
    setCached(poolKey(key), pool, POOL_TTL_MS);
    hits.set(key, pool);
  }
  return hits;
}

/**
 * The SDK throws a plain Error for a key that is not a usable lbPair — "LB Pair account … not found"
 * when nothing is there, "Invalid account discriminator" when the account exists but belongs to
 * something else. Both are the caller naming the wrong account, so both are 404 rather than 500.
 */
async function hydrate(lbPairs: PublicKey[]) {
  try {
    return await DLMM.createMultiple(getConnection(), lbPairs);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/not found/i.test(message)) throw new ApiError(404, "NotFound", "LB pair not found");
    if (/discriminator/i.test(message)) throw new ApiError(404, "NotFound", "Account is not an LB pair");
    throw e;
  }
}

/** One hydrated pool. Prefer `getPools` when more than one lbPair is in play. */
export const getPool = async (lbPair: PublicKey): Promise<DLMM> =>
  (await getPools([lbPair])).get(lbPair.toBase58())!;

/** Live active bin ids for many pools in ceil(n / 100) RPC, decoded with the SDK's own account coder. */
export async function getActiveBinIds(pools: DLMM[]): Promise<Map<string, number>> {
  if (pools.length === 0) return new Map();
  const keys = [...new Map(pools.map((p) => [p.pubkey.toBase58(), p.pubkey])).values()];
  const infos = await getMultipleAccounts(getConnection(), keys);
  const out = new Map<string, number>();
  infos.forEach((info, i) => {
    if (!info) return;
    const lbPair = pools[0].program.coder.accounts.decode("lbPair", info.data) as { activeId: number };
    out.set(keys[i].toBase58(), lbPair.activeId);
  });
  return out;
}
