import Image from "next/image";
import { JupiterIcon, MeteoraIcon, PhoenixIcon } from "@/components/manage/powered-by";

const venues = [
  { name: "Jupiter", Icon: JupiterIcon },
  { name: "Meteora", Icon: MeteoraIcon },
  { name: "Phoenix", Icon: PhoenixIcon },
];

function Connector({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="flex items-center justify-center gap-3 self-center py-2 text-xs font-medium text-sky-300/80 lg:flex-col lg:gap-2 lg:py-0">
      <span>{top}</span>
      <svg viewBox="0 0 96 16" className="hidden h-4 w-24 lg:block" fill="none" aria-hidden="true">
        <path d="M2 8h92M86 2l8 6-8 6M10 2 2 8l8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 16 48" className="h-10 w-4 lg:hidden" fill="none" aria-hidden="true">
        <path d="M8 2v44M2 40l6 6 6-6M2 8l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{bottom}</span>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" strokeLinecap="round" />
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
      <circle cx="16.5" cy="13.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M4 19V5M4 19h16M8 15l3.5-4 3 2.5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** You ⇄ Vault ⇄ Manager, the whole product in one picture. */
export function HowItWorksFlow() {
  return (
    <div className="grid gap-2 lg:grid-cols-[1fr_auto_1.15fr_auto_1fr] lg:gap-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
        <span className="grid size-12 place-items-center rounded-xl bg-white/[0.06] text-white/80">
          <WalletIcon />
        </span>
        <h3 className="mt-5 font-serif text-2xl">You</h3>
        <p className="mt-2 text-white/60">
          Deposit USDC into a vault and get vault tokens in return. They&apos;re your share of the vault.
        </p>
      </div>

      <Connector top="deposit" bottom="withdraw" />

      <div className="relative rounded-2xl border border-sky-400/40 bg-[linear-gradient(180deg,rgba(56,189,248,0.12),rgba(56,189,248,0.03))] p-7">
        <Image src="/icon.png" alt="" width={48} height={48} className="size-12" />
        <h3 className="mt-5 font-serif text-2xl">The vault</h3>
        <p className="mt-2 text-white/70">
          A smart contract on Solana holds the deposits. The manager can trade with them, but can&apos;t send them anywhere else.
        </p>
      </div>

      <Connector top="trades" bottom="on-chain" />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
        <span className="grid size-12 place-items-center rounded-xl bg-white/[0.06] text-white/80">
          <ChartIcon />
        </span>
        <h3 className="mt-5 font-serif text-2xl">The manager</h3>
        <p className="mt-2 text-white/60">A vetted manager provides liquidity, swaps and hedges with the vault&apos;s funds.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {venues.map(({ name, Icon }) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pr-3 pl-2 text-xs font-medium"
            >
              <Icon />
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
