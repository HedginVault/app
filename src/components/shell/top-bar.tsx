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

function NavLinks({ path, className }: { path: string; className?: string }) {
  return (
    <>
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
              className,
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
    </>
  );
}

export function TopBar() {
  const path = usePathname();
  return (
    <div className="top-bar sticky top-0 z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:top-4 sm:pt-4">
      <Link
        href="/"
        className="flex h-12 shrink-0 items-center gap-2.5 text-lg font-semibold tracking-tight sm:h-16 sm:text-xl"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-base font-bold text-accent-foreground sm:size-9">
          H
        </span>
        <span className="truncate">Hedge Vault</span>
      </Link>

      <nav className="hidden h-16 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 backdrop-blur sm:flex">
        <NavLinks
          path={path}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
        />
      </nav>

      <div className="flex h-12 shrink-0 items-center gap-2 sm:h-16 sm:gap-3">
        {CLUSTER !== "mainnet-beta" && <Badge tone="warning">{CLUSTER}</Badge>}
        <WalletButton />
      </div>
    </div>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-white/10 bg-background/95 px-2 py-2 backdrop-blur sm:hidden">
      <NavLinks
        path={path}
        className="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors"
      />
    </nav>
  );
}
