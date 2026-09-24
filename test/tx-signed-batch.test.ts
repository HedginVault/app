import type { BuiltStep } from "@/lib/types";
import { describe, expect, it, vi } from "vitest";
import { executeSignedBatch, runSteps, StepsError } from "@/lib/tx-steps";

const steps: BuiltStep[] = [
  { transaction: "setup", simulation: { unitsConsumed: 1 } },
  ...["range-a", "range-b"].map((transaction) => ({ transaction, simulation: { unitsConsumed: 1 }, sendConcurrently: true })),
  { transaction: "close", simulation: { unitsConsumed: 0, deferred: true } },
];

describe("one-approval zap batch", () => {
  it("signs once, confirms setup, submits ranges together, and closes after both confirm", async () => {
    const order: string[] = [];
    const signAllTransactions = vi.fn(async () => steps.map((step) => step.transaction));
    const execute = vi.fn();
    const buildNext = vi.fn();
    const result = await runSteps({
      first: async () => steps, execute, buildNext,
      executeBatch: async () => executeSignedBatch({
        signed: await signAllTransactions(), steps,
        submit: async (tx) => { order.push(`send:${tx}`); return tx; },
        confirm: async (tx) => { order.push(`confirm:${tx}`); },
        onConfirmed: vi.fn(), onFailed: vi.fn(),
      }),
    });
    expect(signAllTransactions).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(buildNext).not.toHaveBeenCalled();
    expect(result).toEqual(["setup", "range-a", "range-b", "close"]);
    expect(order).toEqual([
      "send:setup", "confirm:setup", "send:range-a", "send:range-b",
      "confirm:range-a", "confirm:range-b", "send:close", "confirm:close",
    ]);
  });

  it.each(["submission", "confirmation"])("never closes after a range %s fails and reports all confirmed signatures", async (failureAt) => {
    const submit = vi.fn(async (tx: string) => {
      if (failureAt === "submission" && tx === "range-b") throw new Error("send failed");
      return tx;
    });
    const confirm = vi.fn(async (tx: string) => {
      if (failureAt === "confirmation" && tx === "range-a") throw new Error("status unknown");
    });
    const error = await executeSignedBatch({
      signed: steps.map((step) => step.transaction), steps, submit, confirm,
      onConfirmed: vi.fn(), onFailed: vi.fn(),
    }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(StepsError);
    expect(error).toMatchObject({ signatures: ["setup", failureAt === "submission" ? "range-a" : "range-b"] });
    expect(submit.mock.calls.map(([tx]) => tx)).toEqual(["setup", "range-a", "range-b"]);
    expect(confirm.mock.calls.map(([tx]) => tx)).toEqual(failureAt === "submission" ? ["setup", "range-a"] : ["setup", "range-a", "range-b"]);
  });

  it("stops before any range if setup fails", async () => {
    const submit = vi.fn(async (tx: string) => tx);
    await expect(executeSignedBatch({
      signed: steps.map((step) => step.transaction), steps, submit,
      confirm: async () => { throw new Error("setup failed"); },
      onConfirmed: vi.fn(), onFailed: vi.fn(),
    })).rejects.toMatchObject({ signatures: [] });
    expect(submit.mock.calls.map(([tx]) => tx)).toEqual(["setup"]);
  });

  it("keeps existing dependent batches sequential", async () => {
    const order: string[] = [];
    await executeSignedBatch({
      signed: ["a", "b"], steps: [{}, {}],
      submit: async (tx) => { order.push(`send:${tx}`); return tx; },
      confirm: async (tx) => { order.push(`confirm:${tx}`); },
      onConfirmed: vi.fn(), onFailed: vi.fn(),
    });
    expect(order).toEqual(["send:a", "confirm:a", "send:b", "confirm:b"]);
  });
});
