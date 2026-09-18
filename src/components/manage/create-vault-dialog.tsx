"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
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

export function CreateVaultDialog({ owner, open, onClose }: { owner: string; open: boolean; onClose: () => void }) {
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
    (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Create a vault"
      className="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-vault" disabled={!valid} loading={pending}>
            Create vault
          </Button>
        </div>
      }
    >
      <form
        id="create-vault"
        className="space-y-4"
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
        <p className="text-[13px] text-muted">This wallet becomes the vault&apos;s authority.</p>
        <Field label="Name" error={form.name === "" ? null : errors.name} hint={`${nameBytes}/32 bytes`}>
          <Input value={form.name} onChange={set("name")} placeholder="USDC Market Neutral" autoFocus />
        </Field>
        <Field label="Deposit token">
          <Segmented
            className="flex w-full *:flex-1"
            options={MINTS.map((m) => ({ id: m.mint, label: m.label }))}
            value={form.mint}
            onChange={(mint) => setForm((prev) => ({ ...prev, mint }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Performance fee (%)" error={errors.perf} hint="On gains above the high-water mark">
            <Input inputMode="decimal" value={form.perf} onChange={set("perf")} />
          </Field>
          <Field label="Management fee (%/yr)" error={errors.mgmt}>
            <Input inputMode="decimal" value={form.mgmt} onChange={set("mgmt")} />
          </Field>
        </div>

        {/* ponytail: limits have sane defaults, so they stay folded unless one is invalid */}
        <details
          open={!!(errors.cap || errors.minDeposit || errors.minWithdraw)}
          className="group rounded-xl border border-border px-4 py-3"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
            Limits
            <span className="text-[13px] font-normal text-muted group-open:hidden">
              Cap {form.cap} · min {form.minDeposit}
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <Field label="Deposit cap" error={errors.cap}>
              <Input inputMode="decimal" value={form.cap} onChange={set("cap")} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Minimum deposit" error={errors.minDeposit}>
                <Input inputMode="decimal" value={form.minDeposit} onChange={set("minDeposit")} />
              </Field>
              <Field label="Min. withdrawal (shares)" error={errors.minWithdraw} hint="Full balance always allowed">
                <Input inputMode="decimal" value={form.minWithdraw} onChange={set("minWithdraw")} />
              </Field>
            </div>
          </div>
        </details>
      </form>
    </Dialog>
  );
}
