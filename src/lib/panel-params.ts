export type LpMode = "add" | "remove" | "claim";

export type PanelState =
  | { panel: "swap"; from?: string; to?: string; amount?: string }
  | { panel: "lp"; pool?: string }
  | { panel: "lp"; position: string; mode: LpMode };

export const PANEL_KEYS = ["panel", "from", "to", "amount", "pool", "position", "mode"] as const;
const MODES: LpMode[] = ["add", "remove", "claim"];

const opt = (search: URLSearchParams, key: string) => search.get(key) || undefined;

export function parsePanel(search: URLSearchParams): PanelState {
  if (search.get("panel") === "lp") {
    const position = opt(search, "position");
    if (position) {
      const mode = search.get("mode") as LpMode;
      return { panel: "lp", position, mode: MODES.includes(mode) ? mode : "add" };
    }
    const pool = opt(search, "pool");
    return pool ? { panel: "lp", pool } : { panel: "lp" };
  }
  const state: PanelState = { panel: "swap" };
  for (const key of ["from", "to", "amount"] as const) {
    const value = opt(search, key);
    if (value) state[key] = value;
  }
  return state;
}

/** Query string for `state`, preserving params that do not belong to the panel. */
export function serializePanel(state: PanelState, base?: URLSearchParams): string {
  const out = new URLSearchParams(base);
  for (const key of PANEL_KEYS) out.delete(key);
  for (const [key, value] of Object.entries(state)) if (value) out.set(key, String(value));
  return out.toString();
}
