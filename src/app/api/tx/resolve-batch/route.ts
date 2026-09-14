import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { handlePost, pubkey } from "@/server/route";
import { buildResolveBatch } from "@/server/tx/requests";

export const POST = handlePost(z.object({ payer: pubkey, vault: pubkey }), ({ payer, vault }) =>
  buildResolveBatch(vault, new PublicKey(payer)),
);
