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

type ReportAt = (index: number, state: StepState) => void;

/**
 * Executes built transactions in order. A `next` on the last transaction of the current batch is
 * built only after that transaction executed, so its simulation sees the state the previous one left.
 */
export async function runSteps({
  first,
  buildNext,
  execute,
  executeBatch,
  onProgress,
}: {
  first: () => Promise<BuiltStep | BuiltStep[]>;
  buildNext: (next: NextStep) => Promise<BuiltStep>;
  execute: (step: BuiltStep, index: number, report: (state: StepState) => void) => Promise<string>;
  executeBatch?: (steps: BuiltStep[], startIndex: number, report: ReportAt) => Promise<string[]>;
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
      if (executeBatch && queue.length > 1) {
        const batch = queue.splice(0);
        const batchSignatures = await executeBatch(batch, index, (batchIndex, state) =>
          onProgress?.({ index: batchIndex, state }),
        );
        if (batchSignatures.length !== batch.length)
          throw new Error("Wallet returned an incomplete signed transaction batch");
        signatures.push(...batchSignatures);
        for (let offset = 0; offset < batch.length; offset++) onProgress?.({ index: index + offset, state: "done" });
        index += batch.length;
        const last = batch.at(-1)!;
        if (last.next) {
          report("building");
          queue.push(await buildNext(last.next));
        }
        continue;
      }
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
    if (e instanceof StepsError) throw new StepsError(e.cause, [...signatures, ...e.signatures]);
    report("failed");
    throw new StepsError(e, signatures);
  }
}

/**
 * Executes one wallet-approved batch. Consecutive independent transactions share a confirmation
 * barrier; setup and close transactions each wait for all preceding work to confirm.
 */
export async function executeSignedBatch<T>({
  signed,
  steps,
  submit,
  confirm,
  onConfirmed,
  onFailed,
}: {
  signed: T[];
  steps: Pick<BuiltStep, "sendConcurrently">[];
  submit: (transaction: T, index: number) => Promise<string>;
  confirm: (transaction: T, signature: string, index: number) => Promise<void>;
  onConfirmed: (signature: string) => void;
  onFailed: (index: number) => void;
}): Promise<string[]> {
  if (signed.length !== steps.length) throw new Error("Wallet returned an incomplete signed transaction batch");
  const confirmed: string[] = [];
  let cursor = 0;
  while (cursor < signed.length) {
    let end = cursor + 1;
    if (steps[cursor].sendConcurrently)
      while (end < signed.length && steps[end].sendConcurrently) end++;
    const submitted: Array<{ signature: string; index: number }> = [];
    let failure: unknown;
    let failed = false;
    for (let index = cursor; index < end; index++) {
      try {
        submitted.push({ signature: await submit(signed[index], index), index });
      } catch (error) {
        failure = error;
        failed = true;
        onFailed(index);
        break;
      }
    }
    // Even if a later submission fails, resolve every submitted transaction before reporting
    // partial completion. Never submit the next dependent group after an ambiguous outcome.
    const results = await Promise.allSettled(submitted.map(({ signature, index }) => confirm(signed[index], signature, index)));
    results.forEach((result, offset) => {
      const { signature, index } = submitted[offset];
      if (result.status === "fulfilled") {
        confirmed.push(signature);
        onConfirmed(signature);
      } else {
        if (!failed) failure = result.reason;
        failed = true;
        onFailed(index);
      }
    });
    if (failed) throw new StepsError(failure, confirmed);
    cursor = end;
  }
  return confirmed;
}
