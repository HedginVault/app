import { shareBps } from "./allocation";
import { usdValue } from "./format";
import type {
  HoldingsView,
  Money,
  PositionView,
  StrategyView,
  TokenExposure,
  TokenInfo,
  VaultDetail,
} from "./types";
import { valueHoldings, type RawHolding, type ValuedHolding } from "./valuation";

export const depositTokenOf = (v: VaultDetail): TokenInfo => ({
  mint: v.depositMint,
  symbol: v.depositSymbol,
  decimals: v.depositDecimals,
  logo: v.depositLogo,
  priceUsd: v.depositPriceUsd,
});

/** Stable React/allocation identity for every position, including multiple idle token balances. */
export const positionKey = (position: PositionView): string =>
  position.kind === "idle" ? `idle:${position.token.mint}` : `${position.kind}:${position.strategy}`;

const sumValues = (list: ValuedHolding[]): bigint | null =>
  list.some((h) => h.value === null) ? null : list.reduce((a, h) => a + (h.value as bigint), 0n);

const byValueDesc = (a: { value: string | null }, b: { value: string | null }) => {
  if (a.value === null) return b.value === null ? 0 : 1;
  if (b.value === null) return -1;
  const d = BigInt(b.value) - BigInt(a.value);
  return d === 0n ? 0 : d > 0n ? 1 : -1;
};

/** Live holdings from the vault detail and strategy views; valuation follows the keeper's rules. */
export function buildHoldingsView(v: VaultDetail, strategies: StrategyView[]): HoldingsView {
  const deposit = depositTokenOf(v);
  const tokens = new Map<string, TokenInfo>([[deposit.mint, deposit]]);
  const raw: RawHolding[] = [
    { kind: "idle", strategy: null, mint: deposit.mint, decimals: deposit.decimals, amount: BigInt(v.idleBalance) },
  ];
  for (const h of v.unmanagedHoldings) {
    if (!tokens.has(h.token.mint)) tokens.set(h.token.mint, h.token);
    raw.push({ kind: "idle", strategy: null, mint: h.token.mint, decimals: h.token.decimals, amount: BigInt(h.amount) });
  }

  for (const s of strategies) {
    if (s.type === "jupiter") {
      if (!tokens.has(s.targetMint))
        tokens.set(s.targetMint, { mint: s.targetMint, symbol: s.symbol, decimals: s.decimals, logo: s.logo, priceUsd: s.priceUsd });
      raw.push({ kind: "jupiter", strategy: s.address, mint: s.targetMint, decimals: s.decimals, amount: BigInt(s.vaultBalance) });
    } else if (s.type === "dlmm") {
      for (const t of [s.tokenX, s.tokenY]) if (!tokens.has(t.mint)) tokens.set(t.mint, t);
      const x = { mint: s.tokenX.mint, decimals: s.tokenX.decimals, strategy: s.address };
      const y = { mint: s.tokenY.mint, decimals: s.tokenY.decimals, strategy: s.address };
      raw.push(
        { kind: "dlmm_x", ...x, amount: BigInt(s.amountX) },
        { kind: "dlmm_y", ...y, amount: BigInt(s.amountY) },
        { kind: "dlmm_fee_x", ...x, amount: BigInt(s.pendingFeeX) },
        { kind: "dlmm_fee_y", ...y, amount: BigInt(s.pendingFeeY) },
      );
    }
  }

  const prices = new Map<string, number>();
  for (const t of tokens.values()) if (t.priceUsd !== null) prices.set(t.mint, t.priceUsd);
  const valued = valueHoldings({ deposit: { mint: deposit.mint, decimals: deposit.decimals }, holdings: raw, prices });
  const total = valued.total;

  const money = (value: bigint | null): Money => ({
    value: value === null ? null : value.toString(),
    usd: value === null ? null : usdValue(value, deposit.decimals, deposit.priceUsd),
    shareBps: shareBps(value, total),
  });

  const idle: PositionView = { kind: "idle", token: deposit, amount: v.idleBalance, ...money(valued.holdings[0].value) };
  const unmanaged: PositionView[] = v.unmanagedHoldings.map((h, i) => ({
    kind: "idle",
    token: h.token,
    amount: h.amount,
    ...money(valued.holdings[1 + i].value),
  }));
  const others: PositionView[] = strategies.map((s) => {
    if (s.type === "unreadable")
      return {
        kind: "error",
        strategy: s.address,
        position: s.position,
        reason: s.reason,
        value: null,
        usd: null,
        shareBps: null,
        lastActionTs: s.lastActionTs,
      };
    const value = sumValues(valued.holdings.filter((h) => h.strategy === s.address));
    if (s.type === "jupiter") {
      return {
        kind: "swap",
        strategy: s.address,
        token: tokens.get(s.targetMint)!,
        amount: s.vaultBalance,
        lastActionTs: s.lastActionTs,
        closable: BigInt(s.vaultBalance) === 0n,
        ...money(value),
      };
    }
    return {
      kind: "lp",
      strategy: s.address,
      position: s.position,
      lbPair: s.lbPair,
      tokenX: s.tokenX,
      tokenY: s.tokenY,
      amountX: s.amountX,
      amountY: s.amountY,
      feeX: s.pendingFeeX,
      feeY: s.pendingFeeY,
      lastActionTs: s.lastActionTs,
      range: {
        lowerBinId: s.lowerBinId,
        upperBinId: s.upperBinId,
        activeBinId: s.activeBinId,
        binStep: s.binStep,
        lowerPrice: s.lowerPrice,
        upperPrice: s.upperPrice,
        activePrice: s.activePrice,
        inRange: s.activeBinId >= s.lowerBinId && s.activeBinId <= s.upperBinId,
      },
      bins: s.bins,
      closable: [s.amountX, s.amountY, s.pendingFeeX, s.pendingFeeY].every((a) => BigInt(a) === 0n),
      pnlUsd: s.pnlUsd,
      pnlPct: s.pnlPct,
      ...money(value),
    };
  });
  // ponytail: idle, then spot, then LP, then unreadable; value-desc inside each group.
  // Keeps the tall LP cards together instead of scattering them between one-line spot rows.
  const groupRank = { swap: 0, lp: 1, error: 2 } as const;
  others.sort((a, b) => groupRank[a.kind as keyof typeof groupRank] - groupRank[b.kind as keyof typeof groupRank] || byValueDesc(a, b));

  const byMint = new Map<string, ValuedHolding[]>();
  for (const h of valued.holdings) byMint.set(h.mint, [...(byMint.get(h.mint) ?? []), h]);
  const exposure: TokenExposure[] = [...byMint.entries()]
    .map(([mint, list]) => ({
      token: tokens.get(mint)!,
      amount: list.reduce((a, h) => a + h.amount, 0n).toString(),
      ...money(sumValues(list)),
    }))
    .sort(byValueDesc);

  const nav = BigInt(v.totalAssets);
  return {
    depositToken: deposit,
    totalValue: total.toString(),
    totalUsd: usdValue(total, deposit.decimals, deposit.priceUsd),
    navTotalAssets: v.totalAssets,
    navDeltaBps: nav > 0n ? Number(((total - nav) * 10_000n) / nav) : null,
    // An unreadable position has an unknown value, so the total cannot be complete.
    partial: valued.partial || strategies.some((s) => s.type === "unreadable"),
    unpriced: valued.unpriced.map((m) => tokens.get(m)!.symbol),
    tokens: exposure,
    positions: [idle, ...unmanaged, ...others],
  };
}
