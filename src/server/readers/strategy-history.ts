import "server-only";
import { Pool } from "pg";
import { PublicKey } from "@solana/web3.js";
import type { StrategyHistoryItem, StrategyHistoryToken } from "@/lib/types";
import { realizedPnlBaseUnits } from "@/lib/strategy-history";
import { ApiError } from "../errors";
import { getTokenInfos } from "../tokens";

interface HistoryRow {
  strategy_address: string;
  strategy_id: number | null;
  strategy_type: "jupiter" | "dlmm" | "phoenix" | null;
  protocol_account: string | null;
  opened_ts: string | null;
  closed_ts: string;
  opened_signature: string | null;
  closed_signature: string;
  data_quality: "exact" | "legacy_incomplete";
  mint: string | null;
  contributed: string | null;
  returned: string | null;
  fees_gross: string | null;
  fees_treasury: string | null;
  fees_retained: string | null;
}

let pool: Pool | undefined;

const db = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new ApiError(503, "HistoryUnavailable", "Strategy history is not configured");
  pool ??= new Pool({ connectionString: databaseUrl, max: 5 });
  return pool;
};

const asNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

/** Reads only closed strategies. All arithmetic remains in Postgres NUMERIC/base-unit strings. */
export async function readStrategyHistory(vault: string): Promise<StrategyHistoryItem[]> {
  const result = await db().query<HistoryRow>(
    `with closed as (
       select *
         from strategy_history
        where vault_address = $1 and closed_ts is not null
        order by closed_ts desc, closed_slot desc
        limit 100
     ), flows as (
       select vault_address, strategy_id, mint,
              coalesce(sum(amount) filter (where category in ('principal_in', 'swap_spent')), 0)::text as contributed,
              coalesce(sum(amount) filter (where category in ('principal_out', 'swap_received')), 0)::text as returned,
              coalesce(sum(amount) filter (where category = 'fee_gross'), 0)::text as fees_gross,
              coalesce(sum(amount) filter (where category = 'fee_treasury'), 0)::text as fees_treasury,
              coalesce(sum(amount) filter (where category = 'fee_retained'), 0)::text as fees_retained
         from strategy_cash_flows
        where vault_address = $1
        group by vault_address, strategy_id, mint
     )
     select h.strategy_address, h.strategy_id, h.strategy_type, h.protocol_account,
            h.opened_ts, h.closed_ts, h.opened_signature, h.closed_signature, h.data_quality,
            f.mint, f.contributed, f.returned, f.fees_gross, f.fees_treasury, f.fees_retained
       from closed h
       left join flows f
         on f.vault_address = h.vault_address and f.strategy_id = h.strategy_id
      order by h.closed_ts desc, h.closed_slot desc, f.mint`,
    [vault],
  );

  const mints = [...new Set(result.rows.flatMap((row) => (row.mint ? [row.mint] : [])))];
  let tokenInfos = new Map<string, { symbol: string; decimals: number }>();
  try {
    const infos = await getTokenInfos(mints.map((mint) => new PublicKey(mint)));
    tokenInfos = new Map([...infos].map(([mint, info]) => [mint, { symbol: info.symbol, decimals: info.decimals }]));
  } catch {
    // History remains usable with raw base units if metadata providers are unavailable.
  }

  const items = new Map<string, StrategyHistoryItem>();
  for (const row of result.rows) {
    const lifecycleKey = `${row.strategy_address}:${row.strategy_id ?? row.closed_signature}`;
    let item = items.get(lifecycleKey);
    if (!item) {
      item = {
        strategy: row.strategy_address,
        id: row.strategy_id,
        type: row.strategy_type,
        protocolAccount: row.protocol_account,
        openedTs: asNumber(row.opened_ts),
        closedTs: asNumber(row.closed_ts) ?? 0,
        openSignature: row.opened_signature,
        closeSignature: row.closed_signature,
        exact: row.data_quality === "exact",
        tokens: [],
      };
      items.set(lifecycleKey, item);
    }
    if (!row.mint) continue;
    const metadata = tokenInfos.get(row.mint);
    const token: StrategyHistoryToken = {
      mint: row.mint,
      symbol: metadata?.symbol ?? null,
      decimals: metadata?.decimals ?? null,
      contributed: row.contributed ?? "0",
      returned: row.returned ?? "0",
      feesGross: row.fees_gross ?? "0",
      feesTreasury: row.fees_treasury ?? "0",
      feesRetained: row.fees_retained ?? "0",
      realizedPnl: realizedPnlBaseUnits(
        row.contributed ?? "0",
        row.returned ?? "0",
        row.fees_retained ?? "0",
      ),
    };
    item.tokens.push(token);
  }
  return [...items.values()];
}
