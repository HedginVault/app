import { AccountLayout, MintLayout } from "@solana/spl-token";
import { PublicKey, type AccountInfo, type Connection } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { decodeMint, decodeTokenAmount, getMultipleAccounts } from "@/server/rpc";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n % 256));
const info = (data: Buffer): AccountInfo<Buffer> => ({ data, executable: false, lamports: 1, owner: pk(1) });

describe("getMultipleAccounts", () => {
  it("chunks at 100 keys and preserves positions", async () => {
    const calls: number[] = [];
    const connection = {
      getMultipleAccountsInfo: vi.fn(async (keys: PublicKey[]) => {
        calls.push(keys.length);
        return keys.map((k) => (k.toBytes()[0] % 2 === 0 ? null : info(Buffer.from([k.toBytes()[0]]))));
      }),
    } as unknown as Connection;
    const keys = Array.from({ length: 250 }, (_, i) => pk(i));
    const out = await getMultipleAccounts(connection, keys);
    expect(calls).toEqual([100, 100, 50]);
    expect(out).toHaveLength(250);
    expect(out[0]).toBeNull();
    expect(out[1]?.data[0]).toBe(1);
    expect(out[249]?.data[0]).toBe(249);
  });
  it("makes no call for an empty key list", async () => {
    const connection = { getMultipleAccountsInfo: vi.fn() } as unknown as Connection;
    expect(await getMultipleAccounts(connection, [])).toEqual([]);
    expect(connection.getMultipleAccountsInfo).not.toHaveBeenCalled();
  });
});

describe("decoders", () => {
  it("decodes token account amounts and treats missing accounts as zero", () => {
    const buf = Buffer.alloc(AccountLayout.span);
    AccountLayout.encode(
      { mint: pk(1), owner: pk(2), amount: 1234n, delegateOption: 0, delegate: pk(0), state: 1, isNativeOption: 0, isNative: 0n, delegatedAmount: 0n, closeAuthorityOption: 0, closeAuthority: pk(0) },
      buf,
    );
    expect(decodeTokenAmount(info(buf))).toBe(1234n);
    expect(decodeTokenAmount(null)).toBe(0n);
    expect(decodeTokenAmount(info(Buffer.alloc(3)))).toBe(0n);
  });
  it("decodes mints, including token-2022 mints with trailing extension bytes", () => {
    const buf = Buffer.alloc(MintLayout.span + 40);
    MintLayout.encode({ mintAuthorityOption: 0, mintAuthority: pk(0), supply: 99n, decimals: 6, isInitialized: true, freezeAuthorityOption: 0, freezeAuthority: pk(0) }, buf);
    expect(decodeMint(info(buf))).toEqual({ decimals: 6, supply: 99n });
    expect(decodeMint(null)).toBeNull();
  });
});
