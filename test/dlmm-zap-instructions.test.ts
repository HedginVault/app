import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProgram } from "@/server/program";
import { loadVaultCtx } from "@/server/tx/context";
import { ApiError } from "@/server/errors";
import { dlmmZapOutIxs, dlmmZapOutSplitIxs, zapOutRangeAmounts } from "@/server/tx/dlmm";

function pk(n: number) { return new PublicKey(new Uint8Array(32).fill(n)); }
const ix = (n: number) => new TransactionInstruction({ programId: pk(n), keys: [], data: Buffer.alloc(0) });
const mocks = vi.hoisted(() => ({
  swap: vi.fn(), remove: vi.fn(), claim: vi.fn(), close: vi.fn(), pool: vi.fn(),
  transferFee: vi.fn(), strategy: vi.fn(),
}));
const instruction = (n: number) => ({
  accounts: () => ({ remainingAccounts: () => ({ instruction: async () => ix(n) }) }),
});
vi.mock("@/server/program", () => ({
  RPC_URL: "", TOKEN_PROGRAM_ID, PROGRAM_ID: pk(33), DLMM_PROGRAM_ID: pk(30), DLMM_EVENT_AUTHORITY: pk(31), MEMO_PROGRAM_ID: pk(32),
  getProgram: () => ({
    account: { positionV2: { fetch: async () => ({ lbPair: pk(7), lowerBinId: -700, upperBinId: 699 }) } },
    methods: {
      meteoraDlmmRemoveLiquidityRange: mocks.remove, meteoraDlmmClaimFeeRange: mocks.claim,
      meteoraDlmmRemoveLiquidity: mocks.remove, meteoraDlmmClaimFee: mocks.claim,
    },
  }),
  getConnection: () => ({ getAccountInfo: mocks.strategy, getEpochInfo: async () => ({ epoch: 123 }) }),
}));
vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: async () => ({ key: pk(1), depositMint: pk(2) }),
}));
vi.mock("@/server/dlmm-pool", () => ({
  StrategyType: { Spot: 0, Curve: 1, BidAsk: 2 },
  getPool: mocks.pool, getBinArrayAccountMetasCoverage: () => [], calculateTransferFeeExcludedAmount: mocks.transferFee,
}));
vi.mock("@/server/tx/jupiter", () => ({
  jupiterTokenLedgerSwapIx: mocks.swap, jupiterInitializeIx: async () => ix(10),
}));
vi.mock("@/server/tx/vault", () => ({ closeStrategyIx: mocks.close }));
const bin = (binId: number, x: string, y: string, feeX = "0", feeY = "0") => ({
  binId, positionXAmount: x, positionYAmount: y, positionFeeXAmount: feeX, positionFeeYAmount: feeY,
  price: "1", pricePerToken: "1", binXAmount: x, binYAmount: y, binLiquidity: "1", positionLiquidity: "1", positionRewardAmount: [],
});
const bins = [bin(-700, "999999", "999999"), bin(-10, "1000", "2000", "100", "200"), bin(0, "5", "7"), bin(16, "888888", "888888")];
const token = (n: number) => ({ publicKey: pk(n), owner: TOKEN_PROGRAM_ID, transferHookAccountMetas: [], mint: { address: pk(n) } });
function pool(depositIsX = false, data = bins) {
  return {
    pubkey: pk(7), tokenX: token(depositIsX ? 2 : 3), tokenY: token(depositIsX ? 3 : 2),
    lbPair: { reserveX: pk(4), reserveY: pk(6) },
    getPosition: async () => ({ positionData: {
      positionBinData: data, totalXAmountExcludeTransferFee: new BN(9999999), totalYAmountExcludeTransferFee: new BN(9999999),
      feeXExcludeTransferFee: new BN(999), feeYExcludeTransferFee: new BN(999),
    } }),
  };
}
const range = { lowerBinId: -10, upperBinId: 15 };
async function build(initialized = false) {
  return dlmmZapOutIxs(getProgram(), await loadVaultCtx(pk(1).toBase58()), pk(5), pk(8), pk(9), 50, range, initialized);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.pool.mockResolvedValue(pool());
  mocks.remove.mockImplementation(() => instruction(11));
  mocks.claim.mockImplementation(() => instruction(12));
  mocks.transferFee.mockImplementation((amount: BN) => ({ amount }));
  mocks.strategy.mockResolvedValue(null);
  mocks.swap.mockResolvedValue({ tokenLedgerInstruction: ix(13), ix: ix(14), lookupTables: [] });
});
describe("range zap instruction safety", () => {
  it("snapshots before remove/claim and swaps afterward, without closing early", async () => {
    const built = await build();
    expect(built.ixs.slice(2).map((instruction) => instruction.programId)).toEqual([pk(10), pk(13), pk(11), pk(12), pk(14)]);
    expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ bpsToRemove: 10000 }), -10, 15);
    expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), -10, 15);
    expect(mocks.swap.mock.calls[0][5].toString()).toBe("1095");
    expect(mocks.swap.mock.calls[0][3]).toEqual(pk(3));
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("omits initialization when an earlier batch transaction creates the strategy", async () => {
    const built = await build(true);
    expect(built.initializesStrategy).toBe(false);
    expect(mocks.strategy).not.toHaveBeenCalled();
    expect(built.ixs.slice(2).map((instruction) => instruction.programId)).toEqual([pk(13), pk(11), pk(12), pk(14)]);
  });
  it("quotes the Y side when the deposit mint is X", async () => {
    mocks.pool.mockResolvedValue(pool(true));
    await build();
    expect(mocks.swap.mock.calls[0][5].toString()).toBe("2187");
  });
  it("uses the current epoch to deduct source transfer fees before quoting", async () => {
    mocks.transferFee.mockImplementation((amount: BN) => ({ amount: amount.subn(1) }));
    await build();
    expect(mocks.transferFee.mock.calls.map((call) => [call[0].toString(), call[2]])).toEqual([["1005", 123], ["100", 123]]);
    expect(mocks.swap.mock.calls[0][5].toString()).toBe("1094");
  });
  it("does not create a swap for empty source bins, even if other bins have tokens", async () => {
    mocks.pool.mockResolvedValue(pool(false, [bin(-700, "999999", "999999"), bin(0, "0", "100")]));
    const built = await build();
    expect(built.ixs.slice(2).map((instruction) => instruction.programId)).toEqual([pk(11), pk(12)]);
    expect(mocks.swap).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("preserves existing Jupiter strategies", async () => {
    mocks.strategy.mockResolvedValue({});
    const built = await build();
    expect(built.ixs.slice(2).map((instruction) => instruction.programId)).toEqual([pk(13), pk(11), pk(12), pk(14)]);
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("rejects a pool without the deposit mint", async () => {
    mocks.pool.mockResolvedValue({ ...pool(), tokenY: token(4) });
    await expect(build()).rejects.toMatchObject({ code: "Validation" });
    expect(mocks.swap).not.toHaveBeenCalled();
  });
  it("keeps amounts above the safe integer limit exact and includes range endpoints", () => {
    const amounts = zapOutRangeAmounts([bin(-10, "9007199254740993", "0", "1"), bin(15, "2", "0", "3"), bin(16, "100", "0")], range, true);
    expect(amounts.positionAmount.toString()).toBe("9007199254740995");
    expect(amounts.pendingFee.toString()).toBe("4");
  });
});

describe("split zap out", () => {
  const split = async () =>
    dlmmZapOutSplitIxs(getProgram(), await loadVaultCtx(pk(1).toBase58()), pk(5), pk(8), pk(9), 50);
  const programs = (ixs: TransactionInstruction[]) => ixs.map((instruction) => instruction.programId);
  beforeEach(() => mocks.close.mockResolvedValue(ix(15)));

  it("keeps each swap in the transaction that funds it and closes last", async () => {
    const [remove, claim, close] = await split();
    expect(programs(remove.ixs.slice(2))).toEqual([pk(10), pk(13), pk(11), pk(14)]);
    expect(programs(claim.ixs)).toEqual([pk(13), pk(12), pk(14)]);
    expect(programs(close.ixs)).toEqual([pk(15)]);
    expect([remove.initializesStrategy, claim.initializesStrategy]).toEqual([true, false]);
    // Liquidity, then the 90% of fees the vault keeps.
    expect(mocks.swap.mock.calls.map((call) => call[5].toString())).toEqual(["9999999", "900"]);
  });

  it("claims without a swap when Jupiter has no route for the fee", async () => {
    mocks.swap
      .mockResolvedValueOnce({ tokenLedgerInstruction: ix(13), ix: ix(14), lookupTables: [] })
      .mockRejectedValueOnce(new ApiError(502, "JupiterQuoteFailed", "no route"));
    const [, claim] = await split();
    expect(programs(claim.ixs)).toEqual([pk(12)]);
  });

  it("surfaces other Jupiter failures", async () => {
    mocks.swap
      .mockResolvedValueOnce({ tokenLedgerInstruction: ix(13), ix: ix(14), lookupTables: [] })
      .mockRejectedValueOnce(new ApiError(502, "JupiterInvalidTokenLedger", "bad ledger"));
    await expect(split()).rejects.toMatchObject({ code: "JupiterInvalidTokenLedger" });
  });
});
