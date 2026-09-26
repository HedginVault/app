"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const DURATION = 14_000;
const HOLD = 2_500;
const START = 1000;
const END = 1021.4;
const W = 400;
const H = 170;

/** Deterministic wiggly climb from START to END, so server and client draw the same line. */
const values = Array.from({ length: 61 }, (_, i) => {
  const t = i / 60;
  const wiggle = Math.sin(i * 0.9) * 1.1 + Math.sin(i * 0.37) * 1.6;
  return START + (END - START) * (t * 0.85 + t * t * 0.15) + wiggle * (i === 0 || i === 60 ? 0 : 1);
});
const lo = Math.min(...values) - 2;
const hi = Math.max(...values) + 2;
const xy = values.map((v, i) => [(i / (values.length - 1)) * W, H - ((v - lo) / (hi - lo)) * H] as const);
const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const area = `${line} L${W},${H} L0,${H} Z`;

const protocols = {
  meteora: { name: "Meteora", src: "/meteora.svg" },
  jupiter: { name: "Jupiter", src: "/jupiter.svg" },
  phoenix: { name: "Phoenix", src: "/phoenix.svg" },
} as const;

/** One vault, many positions: LPs across crypto and tokenized-stock pools, plus a short to hedge. */
const positions = [
  { id: "sol", pair: "SOL-USDC", kind: "Liquidity", p: "meteora", weight: 34, color: "bg-sky-400" },
  { id: "spy", pair: "SPYx-USDC", kind: "Liquidity", p: "meteora", weight: 28, color: "bg-violet-400" },
  { id: "nvda", pair: "NVDAx-USDC", kind: "Liquidity", p: "meteora", weight: 22, color: "bg-teal-300" },
  { id: "hedge", pair: "SPYx short", kind: "Hedge", p: "phoenix", weight: 16, color: "bg-orange-400" },
] as const;

type PositionId = (typeof positions)[number]["id"];

const events: { at: number; p: keyof typeof protocols; pos: PositionId; title: string; detail: string }[] = [
  { at: 0.12, p: "meteora", pos: "spy", title: "Added liquidity", detail: "SPYx-USDC" },
  { at: 0.28, p: "meteora", pos: "sol", title: "Collected fees", detail: "+$4.82" },
  { at: 0.44, p: "phoenix", pos: "hedge", title: "Hedged", detail: "Short SPYx" },
  { at: 0.6, p: "jupiter", pos: "nvda", title: "Swapped", detail: "USDC → NVDAx" },
  { at: 0.74, p: "meteora", pos: "nvda", title: "Added liquidity", detail: "NVDAx-USDC" },
  { at: 0.88, p: "meteora", pos: "sol", title: "Rebalanced", detail: "SOL-USDC back in range" },
];

function pointAt(p: number) {
  const f = Math.min(1, Math.max(0, p)) * (xy.length - 1);
  const i = Math.min(xy.length - 2, Math.floor(f));
  const k = f - i;
  const [x0, y0] = xy[i];
  const [x1, y1] = xy[i + 1];
  const v = values[i] + (values[i + 1] - values[i]) * k;
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, v };
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A deposit growing while the manager works: the balance climbs and each manager action lands on the line. */
export function DepositVisual() {
  // Starts fully drawn so the server render (and reduced motion) show the finished picture.
  const [p, setP] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      // rAF can hand back a timestamp slightly before t0 on the first frame.
      const t = Math.max(0, now - t0) % (DURATION + HOLD);
      setP(Math.min(1, t / DURATION));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const head = pointAt(p);
  const passed = events.filter((e) => e.at <= p);
  const latest = passed[passed.length - 1];
  const change = ((head.v - START) / START) * 100;

  return (
    <div
      role="img"
      aria-label="Example: a $1,000 deposit spread across a basket of liquidity positions and a hedge, growing while the manager works"
      className="w-full rounded-3xl border border-white/10 bg-[#0a1220]/85 p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur sm:p-7"
    >
      <p className="text-sm text-white/55">Your deposit</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">{usd(head.v)}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-sm font-medium tabular-nums ${
            change >= 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"
          }`}
        >
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
      <p className="mt-1 text-sm text-white/40">from {usd(START)}</p>

      <div className="relative mt-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="dv-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#34d399" stopOpacity="0.28" />
              <stop offset="1" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
            <clipPath id="dv-clip">
              <rect x="0" y="-10" width={head.x} height={H + 20} />
            </clipPath>
          </defs>
          <path d={line} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <g clipPath="url(#dv-clip)">
            <path d={area} fill="url(#dv-fill)" />
            <path d={line} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        {/* Event dots, placed in % so they track the stretched SVG */}
        {events.map((e) => {
          const pt = pointAt(e.at);
          const on = e.at <= p;
          return (
            <span
              key={e.at}
              className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0a1220] transition-[opacity,transform] duration-300 ${
                on ? "scale-100 bg-white opacity-100" : "scale-50 bg-white/40 opacity-0"
              }`}
              style={{ left: `${(pt.x / W) * 100}%`, top: `${(pt.y / H) * 100}%` }}
            />
          );
        })}

        {/* Head of the line */}
        <span
          className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(52,211,153,0.18)]"
          style={{ left: `${(head.x / W) * 100}%`, top: `${(head.y / H) * 100}%` }}
        />

        {/* Callout for the latest manager action: above the dot when there's room, else below */}
        {latest && (() => {
          const pt = pointAt(latest.at);
          const above = pt.y / H > 0.4;
          // Anchor in proportion to x so the callout never runs past either edge of the card.
          const dx = `${-latest.at * 100}%`;
          const dy = above ? "calc(-100% - 14px)" : "14px";
          return (
            <div
              className="absolute"
              style={{ left: `${(pt.x / W) * 100}%`, top: `${(pt.y / H) * 100}%`, transform: `translate(${dx}, ${dy})` }}
            >
              <div
                key={latest.at}
                className="flex items-center gap-3 whitespace-nowrap rounded-xl border border-white/10 bg-[#101a2b] py-2 pr-4 pl-2.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.7)] motion-safe:animate-[callout-in_380ms_cubic-bezier(0.22,1,0.36,1)]"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-white/[0.06]">
                  <Image src={protocols[latest.p].src} alt="" width={18} height={18} className="h-[18px] w-auto" />
                </span>
                <span className="text-sm leading-tight">
                  <span className="block font-medium text-white">{latest.title}</span>
                  <span className="block text-white/55">
                    {protocols[latest.p].name} · {latest.detail}
                  </span>
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* The basket: every position the vault holds; the one the manager just touched lights up */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/55">{positions.length} positions in this vault</span>
        </div>
        <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {positions.map((x) => (
            <span key={x.id} className={x.color} style={{ width: `${x.weight}%` }} />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {positions.map((x) => {
            const active = latest?.pos === x.id;
            return (
              <li
                key={x.id}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors duration-300 ${
                  active ? "border-white/25 bg-white/[0.07]" : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                <span className={`size-2 shrink-0 rounded-full ${x.color}`} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{x.pair}</span>
                  <span className="flex items-center gap-1 text-xs text-white/45">
                    <Image src={protocols[x.p].src} alt="" width={12} height={12} className="h-3 w-auto" />
                    {x.kind}
                  </span>
                </span>
                <span className="hidden text-xs tabular-nums text-white/50 sm:inline">{x.weight}%</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
        <span className="flex items-center gap-2 text-white/70">
          <svg viewBox="0 0 20 20" className="size-4 text-sky-400" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path d="M10 2.5l6 2.5v4.5c0 4-2.8 6.9-6 8-3.2-1.1-6-4-6-8V5l6-2.5z" strokeLinejoin="round" />
            <path d="M7.5 10l1.8 1.8L12.8 8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Managed by a vetted pro
        </span>
        <span className="text-white/35">Illustrative example</span>
      </div>
    </div>
  );
}
