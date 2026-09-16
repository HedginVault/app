"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { parseTokenAmount } from "@/lib/format";
import type { BuiltTransaction } from "@/lib/types";

/** Client-side mirror of the server's known-token list; the vault's deposit mint is fixed at creation. */
const MINTS = [
  { label: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { label: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  { label: "SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
];

/** Percent string -> integer bps, or null when it is not a percentage in [0, 100]. */
const pct = (s: string) => {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
};

export function CreateVaultForm({ owner }: { owner: string }) {
  const router = useRouter();
  const { send, pending } = useSendTransaction();
  const [form, setForm] = useState({
    name: "",
    mint: MINTS[0].mint,
    perf: "10",
    mgmt: "2",
    cap: "1000000",
    minDeposit: "10",
    minWithdraw: "1",
  });
  const set =
    (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));
  const decimals = MINTS.find((m) => m.mint === form.mint)?.decimals ?? 6;

  const nameBytes = new TextEncoder().encode(form.name).length;
  const perf = pct(form.perf);
  const mgmt = pct(form.mgmt);
  const cap = parseTokenAmount(form.cap, decimals);
  const minDeposit = parseTokenAmount(form.minDeposit, decimals);
  const minWithdraw = parseTokenAmount(form.minWithdraw, decimals);
  const errors = {
    name: form.name === "" ? "Required" : nameBytes > 32 ? `${nameBytes}/32 bytes` : null,
    perf: perf === null ? "0–100%" : null,
    mgmt: mgmt === null ? "0–100%" : null,
    cap: cap === null || cap === 0n ? "Enter a cap" : null,
    minDeposit: minDeposit === null || minDeposit === 0n ? "Must be greater than 0" : null,
    minWithdraw: minWithdraw === null || minWithdraw === 0n ? "Must be greater than 0" : null,
  };
  const valid = Object.values(errors).every((e) => e === null);

  return (
    <Card>
      <CardHeader
        title="Create a vault"
        description="Your wallet is a whitelisted manager. The vault authority will be this wallet."
      />
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            // Captured from the build response so navigation uses the real vault PDA.
            let created = "";
            void send({
              label: "Create vault",
              build: () =>
                api
                  .build<BuiltTransaction & { vault: string }>("vault/initialize", {
                    payer: owner,
                    name: form.name,
                    depositMint: form.mint,
                    performanceFeeBps: perf,
                    managementFeeBps: mgmt,
                    depositCap: cap!.toString(),
                    minDeposit: minDeposit!.toString(),
                    minWithdrawalShares: minWithdraw!.toString(),
                  })
                  .then((b) => {
                    created = b.vault;
                    return b;
                  }),
              onSuccess: () => router.push(`/manage/${created}`),
            });
          }}
        >
          <Field label="Name" error={errors.name} hint={`${nameBytes}/32 bytes`}>
            <Input value={form.name} onChange={set("name")} placeholder="USDC Market Neutral" />
          </Field>
          <Field label="Deposit token">
            <select
              className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              value={form.mint}
              onChange={set("mint")}
            >
              {MINTS.map((m) => (
                <option key={m.mint} value={m.mint}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Performance fee (%)"
            error={errors.perf}
            hint="Charged on NAV above the high-water mark"
          >
            <Input inputMode="decimal" value={form.perf} onChange={set("perf")} />
          </Field>
          <Field label="Management fee (% / year)" error={errors.mgmt}>
            <Input inputMode="decimal" value={form.mgmt} onChange={set("mgmt")} />
          </Field>
          <Field label="Deposit cap" error={errors.cap}>
            <Input inputMode="decimal" value={form.cap} onChange={set("cap")} />
          </Field>
          <Field label="Minimum deposit" error={errors.minDeposit} hint="Must be above zero">
            <Input inputMode="decimal" value={form.minDeposit} onChange={set("minDeposit")} />
          </Field>
          <Field
            label="Minimum withdrawal (shares)"
            error={errors.minWithdraw}
            hint="Must be above zero; a full-balance withdrawal is always allowed"
          >
            <Input inputMode="decimal" value={form.minWithdraw} onChange={set("minWithdraw")} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={!valid} loading={pending}>
              Create vault
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
