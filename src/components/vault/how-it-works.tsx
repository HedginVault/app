const steps = [
  { n: 1, title: "Request", body: "Deposit tokens or withdrawal shares move into the vault's escrow and wait for the next epoch." },
  { n: 2, title: "NAV update", body: "Once per 24h epoch the manager posts total assets. The program derives NAV per share and settles fees." },
  { n: 3, title: "Claim", body: "After a NAV newer than your request, claim to mint shares or receive tokens at that NAV. Anyone can trigger it." },
];

export const HowItWorks = () => (
  <ol className="grid gap-6 sm:grid-cols-3">
    {steps.map((s) => (
      <li key={s.n} className="flex gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-emerald-400">{s.n}</span>
        <div>
          <div className="text-sm font-medium">{s.title}</div>
          <p className="mt-0.5 text-[13px] text-muted">{s.body}</p>
        </div>
      </li>
    ))}
  </ol>
);
