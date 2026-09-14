"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CLUSTER } from "@/lib/constants";
import { WalletButton } from "@/components/wallet-button";
import { Badge } from "@/components/ui/badge";

const links = [
  { href: "/", label: "Vaults" },
  { href: "/manage", label: "Manage" },
];

export function TopBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">
              H
            </span>
            Hedge Vault
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((l) => {
              const active =
                l.href === "/"
                  ? path === "/" || path.startsWith("/vault")
                  : path.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium",
                    active
                      ? "bg-slate-100 text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {CLUSTER !== "mainnet-beta" && <Badge tone="warning">{CLUSTER}</Badge>}
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
