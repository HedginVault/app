import "server-only";
import type { Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  AccountMeta,
  AddressLookupTableAccount,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import type { HedgeVault } from "@/idl/hedge_vault";
import type { QuoteView } from "@/lib/types";
import { ApiError } from "../errors";
import { getConfigPda, getStrategyPda } from "../pda";
import { JUPITER_HOST, jupiterHeaders } from "../prices";
import { getConnection } from "../program";
import { getTokenProgram } from "../tokens";
import type { VaultCtx } from "./context";

type P = Program<HedgeVault>;

const BASE_URL = `${JUPITER_HOST}/swap/v1`;

const ROUTE = [229, 23, 203, 151, 122, 227, 173, 42];
const ROUTE_WITH_TOKEN_LEDGER = [150, 86, 71, 116, 167, 93, 14, 104];
const EXACT_OUT_ROUTE = [208, 51, 239, 151, 123, 43, 237, 92];
const SHARED_ACCOUNTS_ROUTE = [193, 32, 155, 51, 65, 214, 156, 129];
const SHARED_ACCOUNTS_EXACT_OUT_ROUTE = [176, 209, 105, 168, 154, 125, 69, 62];
const SHARED_ACCOUNTS_ROUTE_WITH_TOKEN_LEDGER = [230, 121, 143, 80, 119, 159, 106, 170];
const SET_TOKEN_LEDGER = [228, 85, 185, 112, 78, 79, 77, 2];
const JUPITER_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

const headers = jupiterHeaders;

interface QuoteResponse {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: { swapInfo: { label: string } }[];
}

export async function getQuote(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: bigint,
  slippageBps: number,
): Promise<{ raw: QuoteResponse; view: QuoteView }> {
  const res = await fetch(
    `${BASE_URL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&swapMode=ExactIn&onlyDirectRoutes=true`,
    { headers: headers() },
  );
  if (!res.ok) throw new ApiError(502, "JupiterQuoteFailed", `Jupiter quote failed: ${await res.text()}`);
  const raw = (await res.json()) as QuoteResponse;
  const view: QuoteView = {
    inAmount: raw.inAmount,
    outAmount: raw.outAmount,
    priceImpactPct: raw.priceImpactPct,
    routeLabels: raw.routePlan.map((r) => r.swapInfo.label),
  };
  return { raw, view };
}

interface JupiterInstruction {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
}

function deserializeInstruction(ix: JupiterInstruction) {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((k) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
}

async function getLookupTables(keys: string[]) {
  if (keys.length === 0) return [];
  const infos = await getConnection().getMultipleAccountsInfo(keys.map((k) => new PublicKey(k)));
  return infos.flatMap((info, i) =>
    info
      ? [
          new AddressLookupTableAccount({
            key: new PublicKey(keys[i]),
            state: AddressLookupTableAccount.deserialize(info.data),
          }),
        ]
      : [],
  );
}

/** Reorders Jupiter's account list into what the program's `JupiterSwap::swap` expects as remaining accounts. */
export function extractRemainingAccounts(swapInstruction: TransactionInstruction): AccountMeta[] {
  const discriminator = Array.from(swapInstruction.data.subarray(0, 8));
  const keys = swapInstruction.keys;
  const is = (d: number[]) => d.every((v, i) => v === discriminator[i]);
  if (is(ROUTE)) return keys.slice(9);
  if (is(ROUTE_WITH_TOKEN_LEDGER)) return [keys[7], ...keys.slice(10)];
  if (is(EXACT_OUT_ROUTE)) return keys.slice(11);
  if (is(SHARED_ACCOUNTS_ROUTE) || is(SHARED_ACCOUNTS_EXACT_OUT_ROUTE))
    return [keys[1], keys[4], keys[5], ...keys.slice(13)];
  throw new ApiError(502, "JupiterUnknownRoute", `Unknown Jupiter instruction discriminator: ${discriminator}`);
}

export async function getJupiterSwap(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: bigint,
  slippageBps: number,
  vault: PublicKey,
  useTokenLedger = false,
) {
  const { raw } = await getQuote(inputMint, outputMint, amount, slippageBps);
  const [inputTokenProgram, outputTokenProgram] = await Promise.all([
    getTokenProgram(inputMint),
    getTokenProgram(outputMint),
  ]);
  const sourceTokenAccount = getAssociatedTokenAddressSync(inputMint, vault, true, inputTokenProgram);
  const res = await fetch(`${BASE_URL}/swap-instructions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      quoteResponse: raw,
      userPublicKey: vault.toBase58(),
      destinationTokenAccount: getAssociatedTokenAddressSync(
        outputMint,
        vault,
        true,
        outputTokenProgram,
      ).toBase58(),
      // The vault PDA, not the manager wallet, signs the Jupiter CPI. Shared-account routes can
      // forward a separate `real_user` to newer AMMs and lose that PDA signer privilege.
      useSharedAccounts: false,
      wrapAndUnwrapSol: false,
      dynamicSlippage: false,
      useTokenLedger,
    }),
  });
  if (!res.ok) throw new ApiError(502, "JupiterSwapFailed", `Jupiter swap-instructions failed: ${await res.text()}`);
  const { swapInstruction, tokenLedgerInstruction, setupInstructions = [], cleanupInstruction, addressLookupTableAddresses } = (await res.json()) as {
    swapInstruction: JupiterInstruction;
    tokenLedgerInstruction?: JupiterInstruction | null;
    setupInstructions?: JupiterInstruction[];
    cleanupInstruction?: JupiterInstruction | null;
    addressLookupTableAddresses: string[];
  };
  const instruction = deserializeInstruction(swapInstruction);
  const discriminator = Array.from(instruction.data.subarray(0, 8));
  const shared = [SHARED_ACCOUNTS_ROUTE, SHARED_ACCOUNTS_EXACT_OUT_ROUTE, SHARED_ACCOUNTS_ROUTE_WITH_TOKEN_LEDGER].some((candidate) =>
    candidate.every((value, index) => value === discriminator[index]),
  );
  if (shared || setupInstructions.length > 0 || cleanupInstruction) {
    throw new ApiError(
      502,
      "JupiterUnsupportedCpiRoute",
      "Jupiter returned a route that requires user-level accounts instead of a direct vault CPI",
    );
  }
  const ledgerInstruction = tokenLedgerInstruction ? deserializeInstruction(tokenLedgerInstruction) : null;
  if (useTokenLedger) {
    const isLedgerRoute = ROUTE_WITH_TOKEN_LEDGER.every((value, index) => value === discriminator[index]);
    const isSetLedger = SET_TOKEN_LEDGER.every((value, index) => value === ledgerInstruction?.data[index]);
    if (
      !isLedgerRoute ||
      !ledgerInstruction ||
      !ledgerInstruction.programId.equals(JUPITER_PROGRAM_ID) ||
      !isSetLedger ||
      ledgerInstruction.keys.length !== 2 ||
      ledgerInstruction.keys.some((account) => account.isSigner) ||
      !ledgerInstruction.keys[1].pubkey.equals(sourceTokenAccount) ||
      !instruction.keys[7].pubkey.equals(ledgerInstruction.keys[0].pubkey)
    ) {
      throw new ApiError(502, "JupiterInvalidTokenLedger", "Jupiter returned an invalid token-ledger route");
    }
  } else if (ledgerInstruction) {
    throw new ApiError(502, "JupiterUnexpectedTokenLedger", "Jupiter returned an unexpected token-ledger instruction");
  }
  return {
    swapData: instruction.data,
    remainingAccounts: extractRemainingAccounts(instruction),
    lookupTables: await getLookupTables(addressLookupTableAddresses),
    tokenLedgerInstruction: ledgerInstruction,
  };
}

export const jupiterInitializeIx = (program: P, ctx: VaultCtx, authority: PublicKey, targetMint: PublicKey) =>
  program.methods
    .jupiterInitializeStrategy()
    .accounts({ authority, config: getConfigPda(), vault: ctx.key, destinationMint: targetMint })
    .instruction();

export async function jupiterSwapIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  sourceMint: PublicKey,
  destinationMint: PublicKey,
  amount: BN,
  slippageBps: number,
) {
  const targetMint = sourceMint.equals(ctx.depositMint) ? destinationMint : sourceMint;
  const { swapData, remainingAccounts, lookupTables } = await getJupiterSwap(
    sourceMint,
    destinationMint,
    BigInt(amount.toString()),
    slippageBps,
    ctx.key,
  );
  const ix = await program.methods
    .jupiterSwap(swapData, amount, slippageBps)
    .accounts({
      authority,
      config: getConfigPda(),
      vault: ctx.key,
      strategy: getStrategyPda(ctx.key, targetMint),
      sourceMint,
      destinationMint,
      sourceTokenProgram: await getTokenProgram(sourceMint),
      destinationTokenProgram: await getTokenProgram(destinationMint),
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
  return { ix, lookupTables };
}

/**
 * Captures the vault source balance before earlier transaction instructions add tokens. Jupiter's
 * ledger route then swaps only that in-transaction increase, preserving every idle source token.
 */
export async function jupiterTokenLedgerSwapIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  sourceMint: PublicKey,
  destinationMint: PublicKey,
  quotedInputAmount: BN,
  slippageBps: number,
) {
  const targetMint = sourceMint.equals(ctx.depositMint) ? destinationMint : sourceMint;
  const { swapData, remainingAccounts, lookupTables, tokenLedgerInstruction } = await getJupiterSwap(
    sourceMint,
    destinationMint,
    BigInt(quotedInputAmount.toString()),
    slippageBps,
    ctx.key,
    true,
  );
  if (!tokenLedgerInstruction)
    throw new ApiError(502, "JupiterInvalidTokenLedger", "Jupiter did not return a token-ledger instruction");
  const ix = await program.methods
    .jupiterSwap(swapData, quotedInputAmount, slippageBps)
    .accounts({
      authority,
      config: getConfigPda(),
      vault: ctx.key,
      strategy: getStrategyPda(ctx.key, targetMint),
      sourceMint,
      destinationMint,
      sourceTokenProgram: await getTokenProgram(sourceMint),
      destinationTokenProgram: await getTokenProgram(destinationMint),
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
  return { ix, tokenLedgerInstruction, lookupTables };
}
