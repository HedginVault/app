import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { loadPhoenixExchange, phoenixDepositIx } from "@/server/tx/phoenix";
import { phoenixAmountBody } from "@/server/tx/schemas";

export const POST = handlePost(phoenixAmountBody, async ({ payer, vault, amount }) => {
  const authority = new PublicKey(payer);
  const ctx = await loadVaultCtx(vault);
  assertAuthority(ctx, authority);
  const ex = await loadPhoenixExchange();
  return assemble(authority, [await phoenixDepositIx(getProgram(), ctx, authority, ex, new BN(amount))]);
});
