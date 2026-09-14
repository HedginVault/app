import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { ApiError } from "@/server/errors";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { fetchVaultAccount, readConfig } from "@/server/readers/vaults";
import { amountString, handleGet, pubkey } from "@/server/route";
import { getQuote } from "@/server/tx/jupiter";

/** Anything unparseable falls back to the UI default; the protocol cap is applied on top. */
const slippageParam = z.coerce.number().int().min(1).max(10_000).catch(50);

export const GET = handleGet(async (_p, search, req) => {
  if (req) rateLimit(clientIp(req));
  const vault = pubkey.safeParse(search.get("vault"));
  const input = pubkey.safeParse(search.get("inputMint"));
  const output = pubkey.safeParse(search.get("outputMint"));
  const amount = amountString.safeParse(search.get("amount"));
  if (!vault.success || !input.success || !output.success || !amount.success)
    throw new ApiError(400, "Validation", "vault, inputMint, outputMint and amount are required");

  const inputMint = new PublicKey(input.data);
  const outputMint = new PublicKey(output.data);
  if (inputMint.equals(outputMint))
    throw new ApiError(400, "Validation", "inputMint and outputMint must differ");

  // `jupiter_swap` only lets a vault trade its deposit mint against a strategy target, so a quote
  // that has nothing to do with this vault is never buildable — reject it here rather than spend a
  // Jupiter call on it.
  const { account } = await fetchVaultAccount(vault.data);
  if (!inputMint.equals(account.depositMint) && !outputMint.equals(account.depositMint))
    throw new ApiError(400, "Validation", "one side of the swap must be the vault deposit mint");

  const config = await readConfig();
  const slippage = Math.min(slippageParam.parse(search.get("slippageBps")), config.maxSlippageBps);
  const { view } = await getQuote(inputMint, outputMint, BigInt(amount.data), slippage);
  return { ...view, slippageBps: slippage };
});
