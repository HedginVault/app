"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatTokenAmount, formatUsd, rawToInput } from "@/lib/format";
import { TokenLogo, type TokenLike } from "./token-logo";

/** Swap-style amount row: label + balance, big numeric input, token button, USD value, % presets. */
export function AmountInput({
  label,
  token,
  tokenSlot,
  value,
  onChange,
  balance,
  balanceLabel = "Vault",
  usd,
  presets = [],
  readOnly,
  disabled,
  error,
}: {
  label: string;
  token: (TokenLike & { decimals: number }) | null;
  /** Replaces the static token badge, e.g. with a token-select button. */
  tokenSlot?: ReactNode;
  value: string;
  onChange?: (value: string) => void;
  /** Base units available, or null when unknown. */
  balance?: string | null;
  balanceLabel?: string;
  usd?: number | null;
  presets?: number[];
  readOnly?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  const setPct = (pct: number) => {
    if (!token || balance == null || !onChange) return;
    onChange(rawToInput((BigInt(balance) * BigInt(pct)) / 100n, token.decimals));
  };
  return (
    <div
      className={cn(
        "rounded-card border bg-slate-50/60 px-4 py-3",
        error ? "border-red-300" : "border-border",
        disabled && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className="font-medium">{label}</span>
        {token && balance != null && (
          <span className="tabular-nums">
            {balanceLabel} {formatTokenAmount(balance, token.decimals, { maxFraction: 4 })} {token.symbol}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          readOnly={readOnly}
          disabled={disabled}
          aria-label={`${label} amount`}
          onChange={(e) => onChange?.(e.target.value.replace(/,/g, "."))}
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums tracking-tight outline-none placeholder:text-slate-300"
        />
        {tokenSlot ??
          (token && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm font-medium">
              <TokenLogo token={token} size="sm" />
              {token.symbol}
            </span>
          ))}
      </div>
      <div className="mt-1.5 flex min-h-5 items-center justify-between gap-2">
        <span className={cn("text-[12px] tabular-nums", error ? "text-danger" : "text-muted")}>
          {error ?? (usd !== undefined ? formatUsd(usd) : "")}
        </span>
        {!readOnly && presets.length > 0 && (
          <span className="flex gap-1">
            {presets.map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={disabled || !token || balance == null}
                onClick={() => setPct(pct)}
                className="rounded-md px-1.5 py-0.5 text-[12px] font-medium text-emerald-700 hover:bg-accent-soft disabled:text-slate-400"
              >
                {pct === 100 ? "Max" : `${pct}%`}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
