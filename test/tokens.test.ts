import { MintLayout } from "@solana/spl-token";
import { PublicKey, type Connection } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMultipleAccountsInfo = vi.fn();
vi.mock("@/server/program", async (orig) => ({
  ...(await orig<typeof import("@/server/program")>()),
  // The known-mint table is mainnet-only; the suite exercises it.
  CLUSTER: "mainnet-beta",
  getConnection: () => ({ getMultipleAccountsInfo }) as unknown as Connection,
}));

import { clearCache } from "@/server/cache";
import { getTokenInfo, getTokenInfos, getTokenProgram, TOKEN_2022_PROGRAM_ID } from "@/server/tokens";
import { TOKEN_PROGRAM_ID } from "@/server/program";

const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const mintAccount = (decimals: number, owner: PublicKey) => {
  const data = Buffer.alloc(MintLayout.span);
  MintLayout.encode({ mintAuthorityOption: 0, mintAuthority: pk(0), supply: 0n, decimals, isInitialized: true, freezeAuthorityOption: 0, freezeAuthority: pk(0) }, data);
  return { data, owner, executable: false, lamports: 1 };
};

beforeEach(() => {
  clearCache();
  getMultipleAccountsInfo.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/tokens/v2/search")) {
        const ids = u.searchParams.get("query")!.split(",");
        return new Response(JSON.stringify(ids.map((id) => ({ id, symbol: `S${id.slice(0, 2)}`, name: "n", icon: "https://x/i.png", decimals: 6 }))));
      }
      if (u.pathname.endsWith("/price/v3")) {
        const ids = u.searchParams.get("ids")!.split(",");
        return new Response(JSON.stringify(Object.fromEntries(ids.map((id) => [id, { usdPrice: 2 }]))));
      }
      throw new Error(`unexpected ${url}`);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("getTokenInfos", () => {
  it("answers known mints with zero RPC and batches unknown mints into one read", async () => {
    getMultipleAccountsInfo.mockResolvedValueOnce([mintAccount(9, TOKEN_PROGRAM_ID), mintAccount(8, TOKEN_2022_PROGRAM_ID)]);
    const infos = await getTokenInfos([USDC, pk(3), pk(4)]);
    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
    expect(getMultipleAccountsInfo.mock.calls[0][0]).toHaveLength(2);
    expect(infos.get(USDC.toBase58())).toMatchObject({ symbol: "USDC", decimals: 6, priceUsd: 2 });
    expect(infos.get(pk(3).toBase58())).toMatchObject({ decimals: 9, logo: "https://x/i.png", priceUsd: 2 });
    expect(infos.get(pk(4).toBase58())?.decimals).toBe(8);
    expect(await getTokenProgram(pk(4))).toEqual(TOKEN_2022_PROGRAM_ID);

    await getTokenInfo(pk(3));
    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
  });

  it("dedupes repeated mints into a single key on the batched read", async () => {
    getMultipleAccountsInfo.mockResolvedValueOnce([mintAccount(4, TOKEN_PROGRAM_ID)]);
    const infos = await getTokenInfos([pk(3), pk(3)]);
    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
    expect(getMultipleAccountsInfo.mock.calls[0][0]).toHaveLength(1);
    expect(infos.size).toBe(1);
    expect(infos.get(pk(3).toBase58())?.decimals).toBe(4);
  });

  it("falls back to a short address symbol and null price when Jupiter fails, keeping on-chain decimals", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fetch failed"); }));
    getMultipleAccountsInfo.mockResolvedValueOnce([mintAccount(5, TOKEN_PROGRAM_ID)]);
    const info = (await getTokenInfos([pk(7)])).get(pk(7).toBase58())!;
    expect(info.decimals).toBe(5);
    expect(info.symbol).toMatch(/…/);
    expect(info.priceUsd).toBeNull();
    expect(info.logo).toBeNull();
  });

  it("throws a 404 ApiError for a mint that does not exist on chain", async () => {
    getMultipleAccountsInfo.mockResolvedValueOnce([null]);
    await expect(getTokenInfos([pk(8)])).rejects.toThrow(/not found/);
    getMultipleAccountsInfo.mockResolvedValueOnce([null]);
    await expect(getTokenInfos([pk(8)])).rejects.toMatchObject({ status: 404, code: "NotFound" });
  });
});
