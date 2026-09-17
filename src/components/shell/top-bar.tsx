"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CLUSTER } from "@/lib/constants";
import { WalletButton } from "@/components/wallet-button";
import { Badge } from "@/components/ui/badge";

const links = [
  // vault: stacked layers; manage: sliders
  { href: "/vaults", label: "Vaults", icon: "M10 2.5 17.5 6.5 10 10.5 2.5 6.5zM2.5 10l7.5 4 7.5-4M2.5 13.5l7.5 4 7.5-4" },
  { href: "/manage", label: "Manage", icon: "M4 5h7M15 5h1M4 10h1M9 10h7M4 15h9M17 15h-1M13 3v4M7 8v4M15 13v4" },
];

export function TopBar() {
  const path = usePathname();
  return (
    <div className="top-bar sticky top-4 z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-4">
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-2.5 text-xl font-semibold tracking-tight"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-accent text-base font-bold text-accent-foreground">
          H
        </span>
        Hedge Vault
      </Link>

      <nav
        className="hidden h-16 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 backdrop-blur sm:flex"
      >
        {links.map((l) => {
          const active =
            l.href === "/vaults"
              ? path === "/vaults" || path.startsWith("/vault")
              : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                "transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <svg
                viewBox="0 0 20 20"
                className="size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={l.icon} />
              </svg>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex h-16 shrink-0 items-center gap-3">
        {CLUSTER !== "mainnet-beta" && <Badge tone="warning">{CLUSTER}</Badge>}
        <WalletButton />
      </div>
    </div>
  );
}
