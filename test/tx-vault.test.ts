import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getManagerPda, getVaultPda } from "@/server/pda";
import { DLMM_EVENT_AUTHORITY, DLMM_PROGRAM_ID, getProgram } from "@/server/program";
import type { VaultCtx } from "@/server/tx/context";
import {
  claimManagerFeeIx,
  closeStrategyIx,
  encodeName,
  toStatusArg,
  vaultCloseIx,
  vaultInitializeIx,
  vaultUpdateIx,
} from "@/server/tx/vault";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const ctx = {
  key: pk(1),
  account: {} as VaultCtx["account"],
  depositMint: pk(2),
  tokenProgram: TOKEN_PROGRAM,
  shareMint: pk(3),
} satisfies VaultCtx;
const keys = (ix: { keys: { pubkey: PublicKey }[] }) => ix.keys.map((k) => k.pubkey.toBase58());

describe("encodeName / toStatusArg", () => {
  it("pads to 32 bytes and truncates", () => {
    expect(encodeName("abc")).toHaveLength(32);
    expect(encodeName("abc").slice(0, 4)).toEqual([97, 98, 99, 0]);
    expect(encodeName("x".repeat(40))).toHaveLength(32);
  });
  it("maps status strings to anchor enums", () => {
    expect(toStatusArg("reduceOnly")).toEqual({ reduceOnly: {} });
    expect(toStatusArg(undefined)).toBeNull();
  });
});

describe("vault builders", () => {
  const program = getProgram();
  it("initialize uses the manager PDA and the vault PDA for the next id", async () => {
    const ix = await vaultInitializeIx(
      program,
      pk(5),
      {
        name: "Test",
        performanceFeeBps: 1000,
        managementFeeBps: 200,
        depositCap: new BN(10),
        minDeposit: new BN(1),
        minWithdrawalShares: new BN(1),
      },
      pk(2),
      TOKEN_PROGRAM,
      new BN(3),
    );
    expect(keys(ix)).toEqual(
      expect.arrayContaining([getManagerPda(pk(5)).toBase58(), getVaultPda(new BN(3)).toBase58()]),
    );
  });
  it("update sends null for untouched fields", async () => {
    const ix = await vaultUpdateIx(program, ctx, pk(5), { depositCap: new BN(99) });
    expect(ix.data.length).toBeGreaterThan(8);
    expect(keys(ix)).toEqual([pk(5).toBase58(), pk(1).toBase58()]);
  });
  it("claim fee references the share mint", async () => {
    const ix = await claimManagerFeeIx(program, ctx, pk(5));
    expect(keys(ix)).toContain(pk(3).toBase58());
  });
  it("close references the vault, deposit mint and share mint", async () => {
    const ix = await vaultCloseIx(program, ctx, pk(5));
    expect(keys(ix)).toEqual(
      expect.arrayContaining([pk(1).toBase58(), pk(2).toBase58(), pk(3).toBase58()]),
    );
  });
});

describe("closeStrategyIx", () => {
  const program = getProgram();
  type Strategy = Awaited<ReturnType<typeof program.account.strategy.fetchNullable>>;
  const stub = (account: unknown) =>
    vi.spyOn(program.account.strategy, "fetchNullable").mockResolvedValue(account as Strategy);

  afterEach(() => vi.restoreAllMocks());

  it("passes the DLMM position, program and event authority as remaining accounts", async () => {
    stub({ vault: ctx.key, strategyType: { meteoraDlmm: { position: pk(7) } } });
    const ix = await closeStrategyIx(program, ctx, pk(5), pk(6));
    // The 4 named accounts (authority, config, vault, strategy) plus system_program precede them.
    expect(ix.keys.slice(-3)).toEqual([
      { pubkey: pk(7), isWritable: true, isSigner: false },
      { pubkey: DLMM_PROGRAM_ID, isWritable: false, isSigner: false },
      { pubkey: DLMM_EVENT_AUTHORITY, isWritable: false, isSigner: false },
    ]);
  });

  it("rejects a strategy belonging to another vault with 400", async () => {
    stub({ vault: pk(9), strategyType: { meteoraDlmm: { position: pk(7) } } });
    await expect(closeStrategyIx(program, ctx, pk(5), pk(6))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a missing strategy account with 404", async () => {
    stub(null);
    await expect(closeStrategyIx(program, ctx, pk(5), pk(6))).rejects.toMatchObject({ status: 404 });
  });
});
