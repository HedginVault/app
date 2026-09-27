/** Builder actions accepted by the manager API. Shared by the router (api.ts) and usage bucketing. */
export const BUILD_ACTIONS = [
  "jupiter/swap", "dlmm/open", "dlmm/add", "dlmm/add-range", "dlmm/extend",
  "dlmm/remove", "dlmm/claim-fee", "dlmm/zap-out", "dlmm/zap-out/swap", "strategy/close",
] as const;
export type BuildAction = typeof BUILD_ACTIONS[number];

const FIXED = new Set<string>(["vaults", "jupiter/quote", "dlmm/pools", "transactions/status", "transactions/send"]);
const TRANSACTION_BUILDS = new Set<string>(BUILD_ACTIONS.map((a) => `transactions/${a}`));
// Same shape as read() in api.ts. The vault address is dropped so usage rows stay bounded.
const VAULT_READ = /^vaults\/[^/]+\/(holdings|strategies)$/;

/**
 * Maps a request-derived action to a small fixed set for `api_key_usage`, so a client hitting random
 * paths cannot create unbounded rows. Bare builder names are what the send path records from a ticket.
 */
export function usageAction(action: string): string {
  if (FIXED.has(action) || TRANSACTION_BUILDS.has(action) || (BUILD_ACTIONS as readonly string[]).includes(action)) return action;
  const m = VAULT_READ.exec(action);
  return m ? `vaults/:vault/${m[1]}` : "unknown";
}
