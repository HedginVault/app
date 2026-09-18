import { z } from "zod";
import { handlePost } from "@/server/route";
import { sendSignedTransaction } from "@/server/tx/send";

export const POST = handlePost(z.object({ transaction: z.string().min(1) }), ({ transaction }) =>
  sendSignedTransaction(transaction),
);
