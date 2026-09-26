"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

const tabs = [
  {
    id: "portfolio",
    label: "Portfolio",
    steps: [
      "See everything the vault holds and what it's worth.",
      "Spot positions that need attention.",
      "Swap idle funds into the tokens you need.",
    ],
    src: "/landing/app-allocation.png",
    width: 837,
    height: 991,
  },
  {
    id: "liquidity",
    label: "Liquidity",
    steps: [
      "Pick a Meteora pool.",
      "Drag the price range on the chart and choose an amount.",
      "Add, remove or close the position as the price moves, and collect the fees it earns.",
    ],
    src: "/landing/app-manage-liquidity.png",
    width: 1897,
    height: 1023,
  },
  {
    id: "perps",
    label: "Perps",
    steps: [
      "Move margin into the vault's Phoenix account.",
      "Go long or short to hedge what the vault holds.",
      "Close the trade and move the margin back.",
    ],
    src: "/landing/app-manage-perps.png",
    width: 1901,
    height: 1017,
  },
] as const;

export function TerminalTabs() {
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("portfolio");
  const tab = tabs.find((t) => t.id === active)!;
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        <div role="tablist" aria-label="Manager app" className="flex gap-1 rounded-xl bg-white/[0.05] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={t.id === active}
              aria-controls="terminal-panel"
              onClick={() => setActive(t.id)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                t.id === active ? "bg-white/10 text-white" : "text-white/55 hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <ol className="mt-6 space-y-4">
          {tab.steps.map((s, i) => (
            <li key={s} className="flex gap-4 text-white/75">
              <span className="text-white/35 tabular-nums">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div
        id="terminal-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab.id}`}
        className="flex max-h-[32rem] justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0b0f17]"
      >
        <Image
          key={tab.id}
          src={tab.src}
          alt={`Manager ${tab.label} screen`}
          width={tab.width}
          height={tab.height}
          sizes="(min-width: 1024px) 760px, 100vw"
          className={cn("h-auto", tab.id === "portfolio" ? "w-full max-w-md" : "w-full")}
        />
      </div>
    </div>
  );
}
