import { cn } from "@/lib/cn";
import { displayFraction, formatTokenAmount, formatUsd } from "@/lib/format";

/** "1,234.56 SOL" with the symbol muted, and an optional USD line (pass `usd` to show it, null renders "—"). */
export function TokenAmount({
  raw,
  token,
  usd,
  align = "left",
  className,
}: {
  raw: string | bigint;
  token: { symbol: string; decimals: number };
  usd?: number | null;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col", align === "right" && "items-end", className)}>
      <span className="font-mono text-[13px] tabular-nums">
        {formatTokenAmount(raw, token.decimals, { maxFraction: displayFraction(raw, token.decimals) })}{" "}
        <span className="text-muted">{token.symbol}</span>
      </span>
      {usd !== undefined && <span className="text-[12px] tabular-nums text-muted">{formatUsd(usd)}</span>}
    </span>
  );
}
