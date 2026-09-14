import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as managerGet } from "@/app/api/manager/[wallet]/route";
import { clearCache, setCached } from "@/server/cache";
import { getPool, getPools, splitCachedPools } from "@/server/dlmm-pool";
import { decodeName, decodeStatus, toDepositRequestView, toVaultSummary, toWithdrawalRequestView } from "@/server/readers/decode";

const bytes = (s: string) => Array.from(Buffer.from(s.padEnd(32, "\0")));
const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));

describe("decode helpers", () => {
  it("decodes zero-padded names and enum statuses", () => {
    expect(decodeName(bytes("USDC Vault"))).toBe("USDC Vault");
    expect(decodeStatus({ normal: {} })).toBe("normal");
    expect(decodeStatus({ reduceOnly: {} })).toBe("reduceOnly");
  });

  it("maps a vault account to a summary", () => {
    const account = {
      id: new BN(0),
      name: bytes(""),
      status: { paused: {} },
      depositMint: pk(1),
      totalAssets: new BN(5),
      navPerShare: new BN(1_000_000_000),
      depositCap: new BN(10),
      performanceFeeBps: 1000,
      managementFeeBps: 200,
      lastNavTs: new BN(123),
    };
    const token = { mint: pk(1).toBase58(), symbol: "USDC", decimals: 6, logo: "https://x/usdc.png", priceUsd: 1 };
    const summary = toVaultSummary(pk(9).toBase58(), account, token, null);
    expect(summary).toMatchObject({
      id: "0",
      name: "Vault #0",
      status: "paused",
      depositSymbol: "USDC",
      depositLogo: "https://x/usdc.png",
      depositPriceUsd: 1,
      totalAssets: "5",
      navPerShare: "1000000000",
      lastNavTs: 123,
      metadata: null,
    });
  });

  it("maps requests with state and cancellability", () => {
    const dep = { authority: pk(2), amount: new BN(7), epoch: new BN(10), createdTs: new BN(1) };
    expect(toDepositRequestView(dep, 10n, 1n)).toMatchObject({ amount: "7", state: "pending", cancellable: true });
    expect(toDepositRequestView(dep, 11n, 1n)).toMatchObject({ state: "resolvable", cancellable: false });
    expect(toDepositRequestView(dep, 11n, 0n)).toMatchObject({ state: "resolvable", cancellable: true });
    const wd = { authority: pk(2), shares: new BN(3), epoch: new BN(10), createdTs: new BN(1) };
    expect(toWithdrawalRequestView(wd, 11n)).toMatchObject({ shares: "3", state: "resolvable", cancellable: false });
  });
});

// The SDK pool is only ever read back by identity here, so a stand-in with the one field the
// cache keys on is enough; `DLMM.createMultiple` is never reached on the fully-cached paths.
const fakePool = (key: PublicKey) => ({ pubkey: key }) as unknown as Awaited<ReturnType<typeof getPool>>;
const cachePool = (key: PublicKey) => setCached(`pool:${key.toBase58()}`, fakePool(key), 60_000);

describe("dlmm pool cache", () => {
  beforeEach(clearCache);

  it("serves cached pools and reports only uncached lbPairs as misses", () => {
    const warm = pk(3);
    const cold = pk(4);
    cachePool(warm);
    const { hits, misses } = splitCachedPools([warm, cold]);
    expect([...hits.keys()]).toEqual([warm.toBase58()]);
    expect(misses.map((m) => m.toBase58())).toEqual([cold.toBase58()]);
  });

  it("deduplicates repeated lbPairs so N positions in one pool hydrate once", () => {
    const cold = pk(5);
    const { hits, misses } = splitCachedPools([cold, cold, cold]);
    expect(hits.size).toBe(0);
    expect(misses.map((m) => m.toBase58())).toEqual([cold.toBase58()]);
  });

  it("returns a fully warm batch without touching the SDK", async () => {
    const a = pk(6);
    const b = pk(7);
    cachePool(a);
    cachePool(b);
    // `DLMM.createMultiple` would need a live connection; reaching it here would throw.
    const pools = await getPools([a, b, a]);
    expect([...pools.keys()].sort()).toEqual([a.toBase58(), b.toBase58()].sort());
    expect(await getPool(a)).toBe(pools.get(a.toBase58()));
  });
});

describe("GET /api/manager/[wallet]", () => {
  it("rejects a malformed wallet with 400 Validation", async () => {
    const res = await managerGet(undefined, { params: Promise.resolve({ wallet: "nope" }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "Validation", message: "wallet must be a public key" },
    });
  });
});
