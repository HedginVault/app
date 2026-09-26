import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HowItWorksFlow } from "@/components/landing/how-it-works-flow";
import { DepositVisual } from "@/components/landing/deposit-visual";
import { TerminalTabs } from "@/components/landing/terminal-tabs";
import { BrandLogo } from "@/components/shell/brand-logo";

export const metadata: Metadata = {
  title: "Hedgin — Managed liquidity vaults on Solana",
  description:
    "Earn from liquidity pools without doing the work. Deposit into a Hedgin vault and a vetted manager provides liquidity, swaps and hedges for you on Meteora, Jupiter and Phoenix.",
};

const visibility = [
  { title: "What the vault holds", body: "Every token and position, with its value in dollars." },
  { title: "How it's performing", body: "The vault token's price over time, so you can see gains and losses." },
  { title: "Every move the manager makes", body: "A full history of trades, each linked to the transaction on Solana." },
];

const safety = [
  {
    title: "Your funds sit in a smart contract",
    body: "Not in the manager's wallet, and not in ours.",
  },
  {
    title: "Managers are vetted",
    body: "Our team approves every manager before they can run a vault.",
  },
  {
    title: "Everything is public",
    body: "Every deposit, trade and withdrawal is on Solana for anyone to check.",
  },
];

const faqs = [
  {
    q: "What do I need to get started?",
    a: "A Solana wallet such as Phantom or Solflare, and some USDC. Pick a vault, connect your wallet and deposit.",
  },
  {
    q: "How long does a withdrawal take?",
    a: "Deposits and withdrawals are processed in batches every 4 hours. Your request fills in the next batch.",
  },
  {
    q: "Can I lose money?",
    a: "Yes. Vaults trade real markets, so their value can go down as well as up. Look at a vault's history before you deposit.",
  },
  {
    q: "What are the fees?",
    a: "Each vault shows its fees up front: a performance fee on profits and a yearly management fee.",
  },
  {
    q: "Can I become a manager?",
    a: "Managers are invited and vetted by our team. There is no open sign-up.",
  },
];

const integrations = [
  { name: "Meteora", role: "Liquidity pools", src: "/meteora.svg", width: 32, height: 32 },
  { name: "Jupiter", role: "Swaps", src: "/jupiter.svg", width: 32, height: 32 },
  { name: "Phoenix", role: "Hedging perps", src: "/phoenix.svg", width: 27, height: 32 },
];

const primaryCta =
  "group inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 to-sky-500 px-7 text-[15px] font-semibold text-slate-950 transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080c14]";
const ghostCta =
  "inline-flex h-13 items-center justify-center rounded-xl border border-white/15 px-7 text-[15px] font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300";

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Screenshot({ src, alt, width, height, className = "" }: { src: string; alt: string; width: number; height: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f17] ${className}`}>
      <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1024px) 640px, 100vw" className="h-auto w-full" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="flex flex-col bg-[#080c14] text-white">
      {/* Hero — pulled up under the TopBar's reserved flow space (72px phone, 92px sm+) */}
      <section className="relative -mt-[72px] overflow-hidden bg-[linear-gradient(180deg,#080c14_0%,#0c3a5e_55%,#080c14_100%)] px-6 sm:-mt-[92px]">
        <div className="mx-auto max-w-[69rem] pt-28 pb-16 sm:pt-32 lg:pb-20">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <div>
              <p className="text-sm font-medium text-sky-300">Managed liquidity vaults on Solana</p>
              <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-[3.75rem]">
                Earn from liquidity pools without doing the work.
              </h1>
              <p className="mt-6 max-w-md text-lg text-white/75">
                One deposit, a basket of liquidity positions, run and hedged by a vetted manager.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link href="/vaults" className={primaryCta}>
                  Explore vaults
                  <ArrowIcon />
                </Link>
                <Link href="#how-it-works" className={ghostCta}>
                  How it works
                </Link>
              </div>

              {/* Integrations */}
              <div className="mt-12">
                <p className="text-sm text-white/55">Integrated with</p>
                <ul className="mt-4 grid grid-cols-3 gap-3">
                  {integrations.map((i) => (
                    <li
                      key={i.name}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#080c14]/40 p-4 sm:flex-row sm:items-center"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06]">
                        <Image src={i.src} alt="" width={i.width} height={i.height} className="h-6 w-auto" />
                      </span>
                      <span className="leading-tight">
                        <span className="block font-medium">{i.name}</span>
                        <span className="mt-0.5 block text-xs text-white/55">{i.role}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <DepositVisual />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-[69rem]">
          <h2 className="max-w-2xl font-serif text-4xl tracking-tight text-balance lg:text-5xl">How Hedgin works</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/60">
            Three parties, one simple arrangement. You bring the money, a manager brings the skill, and the vault
            keeps the money safe in between.
          </p>
          <div className="mt-14">
            <HowItWorksFlow />
          </div>
        </div>
      </section>

      {/* What depositors see */}
      <section className="bg-[linear-gradient(180deg,#080c14_0%,#0b1626_50%,#080c14_100%)] px-6 py-24 lg:py-32">
        <div className="mx-auto grid max-w-[69rem] items-center gap-14 lg:grid-cols-2">
          <div>
            <h2 className="font-serif text-4xl tracking-tight text-balance lg:text-5xl">Always know where your money is</h2>
            <p className="mt-4 text-lg text-white/60">
              Every vault has a public page. Check it before you deposit, and anytime after.
            </p>
            <dl className="mt-10 space-y-6">
              {visibility.map((v) => (
                <div key={v.title} className="border-l-2 border-sky-400/60 pl-5">
                  <dt className="text-lg font-medium">{v.title}</dt>
                  <dd className="mt-1 text-white/60">{v.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Screenshot
            src="/landing/vault-positions.png"
            alt="A vault's allocation by token and its list of positions"
            width={720}
            height={700}
          />
        </div>
      </section>

      {/* Safety */}
      <section className="px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-[69rem]">
          <h2 className="max-w-3xl font-serif text-4xl tracking-tight text-balance lg:text-5xl">
            Managers can trade your funds. They can never take them.
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
            {safety.map((s) => (
              <div key={s.title} className="bg-[#080c14] p-8">
                <h3 className="text-lg font-medium">{s.title}</h3>
                <p className="mt-2 text-white/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For managers: how the manager app works (managers are invited, so no sign-up CTA) */}
      <section className="bg-[linear-gradient(180deg,#080c14_0%,#0b1626_50%,#080c14_100%)] px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-[69rem]">
          <p className="text-sm font-medium text-sky-400">For managers</p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight lg:text-5xl">Running a vault</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/60">
            Managers run their vault from the Manage tab: swap tokens, provide liquidity and hedge with perps,
            all from the vault&apos;s own funds.
          </p>
          <div className="mt-14">
            <TerminalTabs />
          </div>
        </div>
      </section>

      {/* FAQ — native <details>, no JS */}
      <section className="px-6 py-24 lg:py-32">
        <div className="mx-auto grid max-w-[69rem] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <h2 className="font-serif text-4xl tracking-tight lg:text-5xl">Questions</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <details
                key={f.q}
                open={i === 0}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] open:border-sky-400/30"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-sky-400 transition-transform group-open:rotate-45">
                    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="px-6 pb-6 text-white/60">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA + footer */}
      <section className="bg-[linear-gradient(180deg,#080c14_0%,#0c3a5e_100%)] px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center py-28 text-center">
          <h2 className="font-serif text-5xl tracking-tight text-balance lg:text-6xl">Put your crypto to work</h2>
          <p className="mt-5 max-w-xl text-lg text-white/70">Browse the vaults, see how each one is doing, and deposit when you&apos;re ready.</p>
          <Link href="/vaults" className={`${primaryCta} mt-10`}>
            Explore vaults
            <ArrowIcon />
          </Link>
        </div>

        <footer className="mx-auto max-w-[69rem] pb-10">
          <div className="flex flex-col gap-6 border-t border-white/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <BrandLogo size="footer" />
            <nav className="flex gap-8 text-sm" aria-label="Footer">
              <Link href="/vaults" className="text-white/70 hover:text-white">
                Vaults
              </Link>
              <Link href="#how-it-works" className="text-white/70 hover:text-white">
                How it works
              </Link>
            </nav>
          </div>
          <p className="mt-8 text-xs text-white/40">
            &copy; {new Date().getFullYear()} Hedgin. Vaults carry risk, including loss of funds.
          </p>
        </footer>
      </section>
    </main>
  );
}
