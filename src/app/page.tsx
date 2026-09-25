import type { Metadata } from "next";
import Link from "next/link";
import { JupiterIcon, MeteoraIcon, PhoenixIcon } from "@/components/manage/powered-by";
import { BrandLogo } from "@/components/shell/brand-logo";

export const metadata: Metadata = {
  title: "Hedgin — Managed vaults on Solana",
  description:
    "Deposit into a vault run by a vetted manager. Your money trades on-chain through Meteora and Jupiter, and its real value is posted every day — nothing hidden.",
};

const stats = [
  { value: "24h", label: "Value update cycle" },
  { value: "2", label: "DeFi venues" },
  { value: "0", label: "People holding your keys" },
  { value: "Solana", label: "Network" },
];

const steps = [
  {
    title: "Deposit",
    body: "Your money goes into a vault smart contract. It can't leave except by the program's own rules — no human holds the keys.",
  },
  {
    title: "Trade",
    body: "A vetted manager swaps and provides liquidity through Meteora and Jupiter. Every trade happens on-chain, so anyone can check it.",
  },
  {
    title: "Verify",
    body: "Once a day, the vault's true value is posted on-chain. Ask to withdraw anytime and you're paid out at that real number.",
  },
];

const features = [
  {
    title: "Daily on-chain value",
    body: "The vault's value is checked and posted on-chain every 24 hours. No screenshots, no promises.",
    icon: "M4 16l4-5 3 3 5-7M4 4v12h12",
  },
  {
    title: "Real DeFi venues",
    body: "Money trades through Meteora and Jupiter — not a black box. Every swap and position is public.",
    icon: "M4 7h10l-3-3M16 13H6l3 3",
  },
  {
    title: "A token as your receipt",
    body: "Your deposit becomes a share token in your wallet. That token is your proof of ownership.",
    icon: "M10 3l6 3v4c0 4-3 6.5-6 7-3-.5-6-3-6-7V6l6-3z",
  },
  {
    title: "Vetted managers only",
    body: "Only approved managers can trade a vault, and a guardian can freeze it instantly if something looks wrong.",
    icon: "M10 10a3 3 0 100-6 3 3 0 000 6zM4 17a6 6 0 0112 0",
  },
];

const trust = [
  {
    title: "Guardian freeze",
    body: "A guardian can halt a vault instantly if a manager's activity looks wrong.",
  },
  {
    title: "Withdraw anytime",
    body: "Request a withdrawal whenever you want. It settles at the next daily value update.",
  },
  {
    title: "Everything public",
    body: "Deposits, trades, and posted values all live on Solana. Check any of it yourself.",
  },
];

const comparison = [
  {
    feature: "Who holds your money",
    vault: "Nobody — it sits in a smart contract",
    manual: "You do, the whole time",
    cex: "The exchange does",
  },
  {
    feature: "Who makes the trades",
    vault: "A vetted manager, on-chain",
    manual: "You, every single trade",
    cex: "Hidden — you can't see it",
  },
  {
    feature: "Can you check the value",
    vault: "Yes, posted on-chain daily",
    manual: "Only if you track it yourself",
    cex: "Only what they tell you",
  },
  {
    feature: "Getting your money out",
    vault: "Ask anytime, paid at real value",
    manual: "Instant, but manual",
    cex: "Waitlists, at their discretion",
  },
];

const faqs = [
  {
    q: "What is Hedgin?",
    a: "Hedgin lets you deposit into a vault on Solana that a vetted manager trades through Meteora and Jupiter. You hold a share token that represents your slice of the vault.",
  },
  {
    q: "How is the vault's value calculated?",
    a: "Once a day, the vault's holdings are valued and the result is posted on-chain. NAV updates are posted by a centralized keeper, so every figure is public and you can verify it on-chain.",
  },
  {
    q: "How do I get my money out?",
    a: "Request a withdrawal at any time. It settles automatically at the next daily value update, and you're paid based on that posted value.",
  },
  {
    q: "What stops a manager from misusing funds?",
    a: "Funds sit in the vault program, not a manager's wallet, and trades go through on-chain venues anyone can inspect. A guardian can also freeze the vault instantly.",
  },
  {
    q: "What do I get when I deposit?",
    a: "A share token in your wallet. It's your receipt — its value tracks the vault's posted value.",
  },
];

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

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 size-4 shrink-0 text-sky-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M4 10.5 8 14.5 16 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeading({
  title,
  accent,
  sub,
}: {
  title: string;
  accent: string;
  sub: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="font-serif text-4xl tracking-tight text-balance text-white lg:text-6xl">
        {title} <span className="text-sky-400">{accent}</span>
      </h2>
      <p className="mt-4 text-white/60 md:text-lg">{sub}</p>
    </div>
  );
}

const ctaClass =
  "group inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 to-sky-500 px-8 text-[15px] font-semibold text-slate-950 shadow-[0_0_40px_-8px_rgba(56,189,248,0.6)] transition hover:shadow-[0_0_56px_-6px_rgba(56,189,248,0.8)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080c14]";

export default function LandingPage() {
  return (
    <main className="flex flex-col bg-[#080c14] text-white">
      {/* Hero — pulled up under the TopBar's reserved flow space (72px phone,
          92px sm+) so the nav floats over the gradient */}
      <section className="relative -mt-[72px] overflow-hidden sm:-mt-[92px] bg-[linear-gradient(180deg,#080c14_0%,#0c3a5e_45%,#0d1a2b_85%,#080c14_100%)]">
        {/* decorative watermark + glow */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-0 select-none font-serif text-[36rem] leading-none text-white/[0.03]"
        >
          H
        </span>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/20 blur-[120px] motion-safe:animate-pulse [animation-duration:6s]"
        />

        <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 pt-32 pb-16 text-center">
          <h1 className="font-serif text-5xl uppercase tracking-wide text-balance md:text-6xl lg:text-7xl">
            Your money, managed.
            <br />
            <span className="text-sky-400">Nothing hidden.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-base text-white/70 md:text-lg">
            Deposit into a vault run by a vetted manager. It trades on-chain
            through Meteora and Jupiter, and its real value is posted every
            single day.
          </p>
          <Link href="/vaults" className={`${ctaClass} mt-10`}>
            Launch app
            <ArrowIcon />
          </Link>
        </div>

        {/* Stats */}
        <div className="relative mx-auto max-w-6xl px-6 pb-24">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-[#080c14]/60 p-6 text-center lg:p-8">
                <dt className="text-sm text-white/50">{s.label}</dt>
                <dd className="mt-2 font-serif text-3xl text-white md:text-4xl">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works — timeline */}
      <section id="how-it-works" className="scroll-mt-24 px-6 py-24 lg:py-32">
        <SectionHeading
          title="How it"
          accent="works"
          sub="Three steps. No jargon. Here's exactly what happens to your money."
        />
        <ol className="relative mx-auto mt-16 max-w-2xl space-y-12 before:absolute before:top-2 before:bottom-2 before:left-5 before:w-px before:bg-gradient-to-b before:from-sky-400/60 before:via-sky-400/20 before:to-sky-400/60">
          {steps.map((s, i) => (
            <li key={s.title} className="relative pl-16">
              <span className="absolute left-0 top-0 grid size-10 place-items-center rounded-full border-2 border-sky-400 bg-[#080c14] font-mono text-sm text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                {i + 1}
              </span>
              <h3 className="font-serif text-2xl tracking-wide">{s.title}</h3>
              <p className="mt-2 text-white/60">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 lg:pb-32">
        <SectionHeading
          title="Why it's"
          accent="different"
          sub="Managed like a fund, transparent like a blockchain."
        />
        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 transition duration-300 hover:-translate-y-1 hover:border-sky-400/40"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-sky-400/10 text-sky-400 ring-1 ring-sky-400/20">
                <svg
                  viewBox="0 0 20 20"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden="true"
                >
                  <path d={f.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h3 className="mt-6 font-serif text-2xl">{f.title}</h3>
              <p className="mt-2 text-white/60">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security & trust */}
      <section className="bg-[linear-gradient(180deg,#080c14_0%,#0d1a2b_50%,#080c14_100%)] px-6 py-24 lg:py-32">
        <SectionHeading
          title="Security &"
          accent="trust"
          sub="Your money is guarded by program rules, not promises."
        />
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="relative overflow-hidden rounded-3xl border border-sky-400/20 bg-white/[0.03] p-8 lg:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-sky-400/20 blur-[100px]"
            />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-sky-400/10 text-sky-400 ring-1 ring-sky-400/30">
                <svg viewBox="0 0 20 20" className="size-9" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path d="M10 2.5l6 2.5v4.5c0 4-2.8 6.9-6 8-3.2-1.1-6-4-6-8V5l6-2.5z" strokeLinejoin="round" />
                  <path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="flex-1">
                <h3 className="font-serif text-3xl">Non-custodial by design</h3>
                <p className="mt-2 max-w-xl text-white/60">
                  Deposits sit inside the vault program. Managers can trade, but
                  nobody — not the manager, not us — can simply walk off with
                  the funds.
                </p>
              </div>
              <span className="w-fit rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-300">
                On-chain program
              </span>
            </div>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {trust.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <h3 className="font-serif text-xl">{t.title}</h3>
                <p className="mt-2 text-sm text-white/60">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 py-24 lg:py-32">
        <SectionHeading
          title="Why not do it"
          accent="yourself?"
          sub="See how a vault stacks up against trading solo or trusting an exchange."
        />
        <div className="mx-auto mt-16 max-w-5xl overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th scope="col" className="px-5 py-4 font-medium text-white/50">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="px-5 py-4 font-semibold text-sky-400">
                  Hedgin
                </th>
                <th scope="col" className="px-5 py-4 font-medium text-white/50">
                  Doing it yourself
                </th>
                <th scope="col" className="px-5 py-4 font-medium text-white/50">
                  Centralized exchange
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.feature} className="border-b border-white/10 last:border-0">
                  <th scope="row" className="px-5 py-4 font-medium">
                    {row.feature}
                  </th>
                  <td className="bg-sky-400/[0.04] px-5 py-4">
                    <span className="flex items-start gap-2">
                      <CheckIcon />
                      {row.vault}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white/50">{row.manual}</td>
                  <td className="px-5 py-4 text-white/50">{row.cex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ — native <details>, no JS */}
      <section className="px-6 pb-24 lg:pb-32">
        <SectionHeading
          title="Frequently asked"
          accent="questions"
          sub="Everything you need to know before you deposit."
        />
        <div className="mx-auto mt-16 max-w-3xl space-y-3">
          {faqs.map((f, i) => (
            <details
              key={f.q}
              open={i === 0}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] open:border-sky-400/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-sky-400 transition group-open:rotate-45">
                  <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="px-6 pb-6 text-white/60">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA + footer */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#080c14_0%,#0d1a2b_35%,#0e4a75_75%,#0c3a5e_100%)]">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-32 text-center">
          <h2 className="font-serif text-5xl tracking-tight text-balance lg:text-7xl">
            Ready to put your money <span className="text-sky-300">to work?</span>
          </h2>
          <p className="mt-6 max-w-xl text-white/70 md:text-lg">
            Connect a wallet, pick a vault, and deposit in under a minute.
          </p>
          <Link href="/vaults" className={`${ctaClass} mt-10`}>
            View vaults
            <ArrowIcon />
          </Link>
        </div>

        <footer className="mx-auto max-w-6xl px-6 pb-10">
          <div className="flex flex-col gap-8 border-t border-white/10 pt-10 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <BrandLogo size="footer" />
              <p className="mt-3 max-w-xs text-sm text-white/60">
                Managed vaults on Solana. Your money, on-chain, always checkable.
              </p>
              <div className="mt-5 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] p-1.5 text-xs">
                <span className="px-2.5 text-white/50">Built on</span>
                {[
                  { name: "Meteora", Icon: MeteoraIcon },
                  { name: "Jupiter", Icon: JupiterIcon },
                  { name: "Phoenix", Icon: PhoenixIcon },
                ].map(({ name, Icon }) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pr-3 pl-1.5 font-medium text-white"
                  >
                    <Icon />
                    {name}
                  </span>
                ))}
              </div>
            </div>
            <nav className="flex gap-8 text-sm" aria-label="Footer">
              <Link href="/vaults" className="text-white/70 hover:text-white">
                Vaults
              </Link>
              <Link href="/manage" className="text-white/70 hover:text-white">
                Manage
              </Link>
              <Link href="#how-it-works" className="text-white/70 hover:text-white">
                How it works
              </Link>
            </nav>
          </div>
          <p className="mt-8 text-xs text-white/40">
            &copy; {new Date().getFullYear()} Hedgin. NAV updates are
            centralized; verify all figures on-chain.
          </p>
        </footer>
      </section>
    </main>
  );
}
