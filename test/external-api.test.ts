import { createHash } from "node:crypto";
import bs58 from "bs58";
import { Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROGRAM_ID, CLUSTER } from "@/server/program";
import { resetRateLimits } from "@/server/ratelimit";
import { externalRoute } from "@/server/external/api";
import { authenticate } from "@/server/external/auth";
import { signTicket, verifyTicket } from "@/server/external/ticket";

const mocks = vi.hoisted(() => ({
  authority: "", send: vi.fn(), status: vi.fn(), builder: vi.fn(),
}));
vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: async () => ({ account: { authority: new PublicKey(mocks.authority) } }),
}));
vi.mock("@/server/tx/send", () => ({
  sendSignedTransaction: (transaction: string) => mocks.send(transaction),
  getTransactionStatus: (signature: string, blockhash: string) => mocks.status(signature, blockhash),
}));
vi.mock("@/app/api/tx/jupiter/swap/route", () => ({ POST: (request: Request) => mocks.builder(request) }));

const manager = Keypair.generate();
const other = Keypair.generate();
const vault = Keypair.generate().publicKey.toBase58();
const blockhash = new PublicKey(new Uint8Array(32).fill(7)).toBase58();
const apiSecret = "s".repeat(48);
const authorization = `Bearer hv1_partner_${apiSecret}`;
const originalKeys = process.env.MANAGER_API_KEYS;
const originalSecret = process.env.MANAGER_API_TICKET_SECRET;

function transaction(payer = manager, instructionData = 1, signed = false): string {
  const message = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash,
    instructions: [new TransactionInstruction({ programId: PROGRAM_ID, keys: [], data: Buffer.from([instructionData]) })],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  if (signed) tx.sign([payer]);
  return Buffer.from(tx.serialize()).toString("base64");
}

function ticketFor(base64: string): string {
  const tx = VersionedTransaction.deserialize(Buffer.from(base64, "base64"));
  return signTicket({ kind: "build", keyId: "partner", manager: manager.publicKey.toBase58(), vault,
    action: "jupiter/swap", cluster: CLUSTER, program: PROGRAM_ID.toBase58(),
    messageHash: createHash("sha256").update(tx.message.serialize()).digest("hex"), blockhash,
    expires: Date.now() + 60_000 });
}

function request(path: string, method = "GET", data?: unknown, key = authorization): Request {
  return new Request(`http://localhost/api/external/v1/${path}`, { method, headers: {
    authorization: key, "content-type": "application/json", "x-forwarded-for": "192.0.2.1",
  }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
}

beforeEach(() => {
  resetRateLimits();
  mocks.authority = manager.publicKey.toBase58();
  mocks.send.mockReset();
  mocks.status.mockReset();
  mocks.builder.mockReset();
  process.env.MANAGER_API_TICKET_SECRET = "ticket-secret-of-at-least-thirty-two-bytes";
  process.env.MANAGER_API_KEYS = JSON.stringify([{ id: "partner", digest: createHash("sha256").update(apiSecret).digest("hex"),
    manager: manager.publicKey.toBase58(), vaults: [vault], actions: ["read", "send", "jupiter/swap"] }]);
});
afterEach(() => {
  if (originalKeys === undefined) delete process.env.MANAGER_API_KEYS;
  else process.env.MANAGER_API_KEYS = originalKeys;
  if (originalSecret === undefined) delete process.env.MANAGER_API_TICKET_SECRET;
  else process.env.MANAGER_API_TICKET_SECRET = originalSecret;
});

describe("manager key and tickets", () => {
  it("rejects missing, wrong and revoked keys", () => {
    expect(() => authenticate(request("vaults", "GET", undefined, ""))).toThrow();
    expect(() => authenticate(request("vaults", "GET", undefined, `Bearer hv1_partner_${"a".repeat(48)}`))).toThrow();
    process.env.MANAGER_API_KEYS = JSON.stringify([{ id: "partner", digest: createHash("sha256").update(apiSecret).digest("hex"),
      manager: manager.publicKey.toBase58(), actions: ["read"], revoked: true }]);
    expect(() => authenticate(request("vaults"))).toThrow();
  });
  it("rejects changed or expired tickets", () => {
    const issued = ticketFor(transaction());
    expect(verifyTicket(issued, "build").vault).toBe(vault);
    expect(() => verifyTicket(`${issued.slice(0, -1)}a`, "build")).toThrow();
    const expired = signTicket({ ...verifyTicket(issued, "build"), expires: Date.now() - 1 });
    expect(() => verifyTicket(expired, "build")).toThrow();
  });
});

describe("external transaction flow", () => {
  it("builds through the existing route and issues an exact-message ticket", async () => {
    const unsigned = transaction();
    mocks.builder.mockImplementation(async (req: Request) => {
      expect(await req.json()).toEqual({ vault, amount: "10", payer: manager.publicKey.toBase58() });
      return Response.json({ transaction: unsigned, simulation: { unitsConsumed: 100 } });
    });
    const response = await externalRoute(request("transactions/jupiter/swap", "POST", { vault, amount: "10" }),
      ["transactions", "jupiter", "swap"], "POST");
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.result.transaction).toBe(unsigned);
    expect(verifyTicket(payload.result.ticket, "build").messageHash).toBe(
      createHash("sha256").update(VersionedTransaction.deserialize(Buffer.from(unsigned, "base64")).message.serialize()).digest("hex"));
  });
  it("scopes builds to the key's vault and current on-chain authority", async () => {
    const foreignVault = other.publicKey.toBase58();
    const outside = await externalRoute(request("transactions/jupiter/swap", "POST", { vault: foreignVault }),
      ["transactions", "jupiter", "swap"], "POST");
    expect(outside.status).toBe(403);
    mocks.authority = other.publicKey.toBase58();
    const changed = await externalRoute(request("transactions/jupiter/swap", "POST", { vault }),
      ["transactions", "jupiter", "swap"], "POST");
    expect(changed.status).toBe(403);
    expect(mocks.builder).not.toHaveBeenCalled();
  });
  it("rejects oversized bodies before invoking a builder", async () => {
    const response = await externalRoute(request("transactions/jupiter/swap", "POST", { vault, filler: "a".repeat(17_000) }),
      ["transactions", "jupiter", "swap"], "POST");
    expect(response.status).toBe(413);
    expect(mocks.builder).not.toHaveBeenCalled();
  });
  it("tickets every member of a builder batch", async () => {
    mocks.builder.mockResolvedValue(Response.json([
      { transaction: transaction(manager, 1), simulation: { unitsConsumed: 1 } },
      { transaction: transaction(manager, 2), simulation: { deferred: true, unitsConsumed: 0 }, sendConcurrently: true },
    ]));
    const response = await externalRoute(request("transactions/jupiter/swap", "POST", { vault }),
      ["transactions", "jupiter", "swap"], "POST");
    const payload = await response.json();
    expect(payload.result).toHaveLength(2);
    expect(verifyTicket(payload.result[0].ticket, "build").messageHash).not.toBe(
      verifyTicket(payload.result[1].ticket, "build").messageHash);
    expect(payload.result[1].sendConcurrently).toBe(true);
  });
  it("relays only a locally signed, exact build and returns a bound receipt", async () => {
    const signed = transaction(manager, 1, true);
    const signature = bs58.encode(VersionedTransaction.deserialize(Buffer.from(signed, "base64")).signatures[0]);
    mocks.send.mockResolvedValue({ signature });
    const response = await externalRoute(request("transactions/send", "POST", { transaction: signed, ticket: ticketFor(signed) }),
      ["transactions", "send"], "POST");
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.signature).toBe(signature);
    expect(verifyTicket(payload.receipt, "receipt").signature).toBe(signature);
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("rejects changed instructions, wrong signer, missing signature, and revoked authority before RPC", async () => {
    const issued = ticketFor(transaction());
    for (const signed of [transaction(manager, 2, true), transaction(other, 1, true), transaction()]) {
      const response = await externalRoute(request("transactions/send", "POST", { transaction: signed, ticket: issued }),
        ["transactions", "send"], "POST");
      expect(response.status).toBe(403);
    }
    mocks.authority = other.publicKey.toBase58();
    const response = await externalRoute(request("transactions/send", "POST", { transaction: transaction(manager, 1, true), ticket: issued }),
      ["transactions", "send"], "POST");
    expect(response.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects a ticket issued for another cluster or revoked API key", async () => {
    const signed = transaction(manager, 1, true);
    const wrongCluster = signTicket({ ...verifyTicket(ticketFor(signed), "build"), cluster: "devnet" });
    const wrong = await externalRoute(request("transactions/send", "POST", { transaction: signed, ticket: wrongCluster }),
      ["transactions", "send"], "POST");
    expect(wrong.status).toBe(403);
    process.env.MANAGER_API_KEYS = JSON.stringify([{ id: "partner", digest: createHash("sha256").update(apiSecret).digest("hex"),
      manager: manager.publicKey.toBase58(), vaults: [vault], actions: ["send", "jupiter/swap"], revoked: true }]);
    const revoked = await externalRoute(request("transactions/send", "POST", { transaction: signed, ticket: ticketFor(signed) }),
      ["transactions", "send"], "POST");
    expect(revoked.status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("returns an unknown outcome with a status receipt on RPC timeout", async () => {
    const signed = transaction(manager, 1, true);
    mocks.send.mockRejectedValue(new TypeError("fetch failed"));
    const response = await externalRoute(request("transactions/send", "POST", { transaction: signed, ticket: ticketFor(signed) }),
      ["transactions", "send"], "POST");
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("unknown");
    mocks.status.mockResolvedValue({ status: "confirmed" });
    const status = await externalRoute(request(`transactions/status?receipt=${payload.receipt}`), ["transactions", "status"], "GET");
    expect(await status.json()).toEqual({ status: "confirmed" });
  });
});
