import { PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

// Only pk(5) is the vault authority; routes must refuse anyone else before any Phoenix or RPC call.
vi.mock("@/server/tx/context", async () => {
  const { PublicKey } = await import("@solana/web3.js");
  const { ApiError } = await import("@/server/errors");
  return {
    loadVaultCtx: vi.fn(async () => ({ key: new PublicKey(new Uint8Array(32).fill(1)) })),
    assertAuthority: vi.fn((_ctx: unknown, payer: PublicKey) => {
      if (!payer.equals(new PublicKey(new Uint8Array(32).fill(5)))) throw new ApiError(403, "Forbidden", "not the authority");
    }),
  };
});

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n)).toBase58();
const order = { symbol: "SOL", side: "long", size: "1", reduceOnly: false, order: { type: "market", slippageBps: 50 } };

async function post(path: string, body: Record<string, unknown>) {
  const { POST } = await import(`@/app/api/tx/phoenix/${path}/route`);
  return (POST as (req: Request) => Promise<Response>)(
    new Request(`http://x/api/tx/phoenix/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `phoenix-${Math.random()}` },
      body: JSON.stringify({ payer: pk(5), vault: pk(1), ...body }),
    }),
  );
}

describe("Phoenix tx routes", () => {
  it.each(["initialize", "onboard", "sweep"])("%s refuses a payer that is not the vault authority", async (path) => {
    expect((await post(path, { payer: pk(9) })).status).toBe(403);
  });

  it("order refuses a payer that is not the vault authority", async () => {
    expect((await post("order", { ...order, payer: pk(9) })).status).toBe(403);
  });

  it.each([
    ["a malformed size", { size: "1e3" }],
    ["a negative size", { size: "-1" }],
    ["an unknown side", { side: "buy" }],
    ["zero slippage", { order: { type: "market", slippageBps: 0 } }],
    ["a limit order without a price", { order: { type: "limit", postOnly: true } }],
    ["a missing reduce-only flag", { reduceOnly: undefined }],
  ])("order rejects %s with 400", async (_, change) => {
    expect((await post("order", { ...order, ...change })).status).toBe(400);
  });

  it("deposit rejects a zero or non-numeric amount with 400", async () => {
    expect((await post("deposit", { amount: "abc" })).status).toBe(400);
  });

  it("cancel rejects more ids than fit in one transaction", async () => {
    const orders = Array.from({ length: 21 }, (_, i) => ({ priceInTicks: "1", orderSequenceNumber: String(i) }));
    expect((await post("cancel", { symbol: "SOL", orders })).status).toBe(400);
  });

  it("onboard submit refuses a payer that is not the vault authority", async () => {
    expect((await post("onboard/submit", { payer: pk(9), transaction: "AAAA" })).status).toBe(403);
  });
});
