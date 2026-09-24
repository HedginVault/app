import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

interface Packed { owner: string; data: string }

export const accountInfo = (data: Buffer, owner: PublicKey): AccountInfo<Buffer> => ({ data, owner, lamports: 1, executable: false });
const unpack = (p: Packed) => accountInfo(gunzipSync(Buffer.from(p.data, "base64")), new PublicKey(p.owner));

/** Hawkeye ViewMargin's answer; equity = max(0, collateral + unrealizedPnl + unsettledFunding). */
export interface HawkeyeMargin { collateral: bigint; unrealizedPnl: bigint; unsettledFunding: bigint }
export const hawkeyeEquity = (m: HawkeyeMargin) => {
  const e = m.collateral + m.unrealizedPnl + m.unsettledFunding;
  return e > 0n ? e : 0n;
};

interface RawTrader {
  trader: string;
  slot: number;
  hawkeye: Record<"collateral" | "unrealizedPnl" | "unsettledFunding", string>;
  accounts: Record<"trader" | "perpAssetMap" | "globalConfig", Packed>;
}

/** Mainnet traders with the accounts Hawkeye ViewMargin saw and its answer (ported from hedgin_keeper). */
export function loadPhoenixFixture() {
  const raw = JSON.parse(readFileSync(new URL("./data/phoenix-mainnet.json", import.meta.url), "utf8")) as { traders: RawTrader[] };
  return raw.traders.map((t) => ({
    trader: new PublicKey(t.trader),
    slot: t.slot as number,
    hawkeye: {
      collateral: BigInt(t.hawkeye.collateral),
      unrealizedPnl: BigInt(t.hawkeye.unrealizedPnl),
      unsettledFunding: BigInt(t.hawkeye.unsettledFunding),
    } as HawkeyeMargin,
    accounts: { trader: unpack(t.accounts.trader), perpAssetMap: unpack(t.accounts.perpAssetMap), globalConfig: unpack(t.accounts.globalConfig) },
  })) as {
    trader: PublicKey;
    slot: number;
    hawkeye: HawkeyeMargin;
    accounts: { trader: AccountInfo<Buffer>; perpAssetMap: AccountInfo<Buffer>; globalConfig: AccountInfo<Buffer> };
  }[];
}
