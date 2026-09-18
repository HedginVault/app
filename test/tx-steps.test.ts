import { describe, expect, it, vi } from "vitest";
import { runSteps, StepsError, type StepProgress } from "@/lib/tx-steps";
import type { BuiltStep } from "@/lib/types";

const step = (id: string, next?: BuiltStep["next"]): BuiltStep => ({ transaction: id, simulation: { unitsConsumed: 0 }, next });

describe("runSteps", () => {
  it("executes a single transaction", async () => {
    const execute = vi.fn(async (s: BuiltStep) => `sig-${s.transaction}`);
    expect(await runSteps({ first: async () => step("a"), buildNext: vi.fn(), execute })).toEqual(["sig-a"]);
  });

  it("builds each next step only after the previous one executed", async () => {
    const order: string[] = [];
    const buildNext = vi.fn(async (n: { path: string }) => {
      order.push(`build:${n.path}`);
      return n.path === "b" ? step("b", { path: "c", body: {} }) : step("c");
    });
    const execute = vi.fn(async (s: BuiltStep) => {
      order.push(`exec:${s.transaction}`);
      return `sig-${s.transaction}`;
    });
    const sigs = await runSteps({ first: async () => step("a", { path: "b", body: { x: 1 } }), buildNext, execute });
    expect(sigs).toEqual(["sig-a", "sig-b", "sig-c"]);
    expect(order).toEqual(["exec:a", "build:b", "exec:b", "build:c", "exec:c"]);
    expect(buildNext.mock.calls[0][0]).toEqual({ path: "b", body: { x: 1 } });
  });

  it("runs a batch in order and follows next from its last transaction only", async () => {
    const buildNext = vi.fn(async () => step("z"));
    const execute = vi.fn(async (s: BuiltStep) => s.transaction);
    const sigs = await runSteps({
      first: async () => [step("a", { path: "ignored", body: {} }), step("b", { path: "z", body: {} })],
      buildNext,
      execute,
    });
    expect(sigs).toEqual(["a", "b", "z"]);
    expect(buildNext).toHaveBeenCalledTimes(1);
  });

  it("reports progress and hands back confirmed signatures on failure", async () => {
    const progress: StepProgress[] = [];
    const execute = vi.fn(async (s: BuiltStep, _i: number, report: (x: "signing") => void) => {
      report("signing");
      if (s.transaction === "b") throw new Error("rejected");
      return `sig-${s.transaction}`;
    });
    const run = runSteps({
      first: async () => step("a", { path: "b", body: {} }),
      buildNext: async () => step("b"),
      execute,
      onProgress: (p) => progress.push(p),
    });
    await expect(run).rejects.toBeInstanceOf(StepsError);
    await run.catch((e: StepsError) => {
      expect(e.signatures).toEqual(["sig-a"]);
      expect((e.cause as Error).message).toBe("rejected");
    });
    expect(progress).toEqual([
      { index: 0, state: "building" },
      { index: 0, state: "signing" },
      { index: 0, state: "done" },
      { index: 1, state: "building" },
      { index: 1, state: "signing" },
      { index: 1, state: "failed" },
    ]);
  });
});
