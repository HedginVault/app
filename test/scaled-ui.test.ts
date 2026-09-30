import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import fixture from "./data/openai-prestock-mint.json";
import { decodeMint, decodeScaledUiConfig, effectiveUiMultiplier } from "@/server/rpc";

const account = (owner: string, data: Buffer): AccountInfo<Buffer> => ({ data, owner: new PublicKey(owner), executable: false, lamports: 1 });
const openai = account(fixture.owner, Buffer.from(fixture.data, "base64"));

describe("decodeScaledUiConfig", () => {
  it("reads the ScaledUiAmount config off a live Token-2022 mint", () => {
    expect(decodeMint(openai)?.decimals).toBe(9);
    expect(decodeScaledUiConfig(openai)).toEqual({ multiplier: 1, newMultiplier: 1.4861347, newMultiplierEffectiveTs: 1784305800 });
  });

  it("is null for a classic SPL mint, a missing account or garbage Token-2022 data", () => {
    expect(decodeScaledUiConfig(account("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", openai.data))).toBeNull();
    expect(decodeScaledUiConfig(null)).toBeNull();
    expect(decodeScaledUiConfig(account(fixture.owner, Buffer.alloc(10)))).toBeNull();
  });
});

describe("effectiveUiMultiplier", () => {
  const cfg = { multiplier: 1, newMultiplier: 1.4861347, newMultiplierEffectiveTs: 1784305800 };

  it("switches to the new multiplier at its effective time", () => {
    expect(effectiveUiMultiplier(cfg, 1784305799)).toBe(1);
    expect(effectiveUiMultiplier(cfg, 1784305800)).toBe(1.4861347);
  });

  it("falls back to 1 for no config or an unusable value", () => {
    expect(effectiveUiMultiplier(null, 0)).toBe(1);
    expect(effectiveUiMultiplier({ ...cfg, newMultiplier: 0 }, 1784305800)).toBe(1);
    expect(effectiveUiMultiplier({ ...cfg, newMultiplier: Number.NaN }, 1784305800)).toBe(1);
  });
});
