import type { BuiltStep, NextStep } from "./types";

export type StepState = "building" | "signing" | "sending" | "confirming" | "done" | "failed";

export interface StepProgress {
  index: number;
  state: StepState;
}

/** A failed run, carrying the signatures that confirmed before the failure. */
export class StepsError extends Error {
  constructor(
    readonly cause: unknown,
    readonly signatures: string[],
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "StepsError";
  }
}

/**
 * Executes built transactions in order. A `next` on the last transaction of the current batch is
 * built only after that transaction executed, so its simulation sees the state the previous one left.
 */
export async function runSteps({
  first,
  buildNext,
  execute,
  onProgress,
}: {
  first: () => Promise<BuiltStep | BuiltStep[]>;
  buildNext: (next: NextStep) => Promise<BuiltStep>;
  execute: (step: BuiltStep, index: number, report: (state: StepState) => void) => Promise<string>;
  onProgress?: (p: StepProgress) => void;
}): Promise<string[]> {
  const signatures: string[] = [];
  let index = 0;
  const report = (state: StepState) => onProgress?.({ index, state });
  try {
    report("building");
    const built = await first();
    const queue = Array.isArray(built) ? [...built] : [built];
    while (queue.length > 0) {
      const current = queue.shift()!;
      signatures.push(await execute(current, index, report));
      report("done");
      index += 1;
      if (queue.length === 0 && current.next) {
        report("building");
        queue.push(await buildNext(current.next));
      }
    }
    return signatures;
  } catch (e) {
    report("failed");
    throw new StepsError(e, signatures);
  }
}
