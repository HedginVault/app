import "server-only";
import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import idl from "@/idl/hedge_vault.json";
import type { HedgeVault } from "@/idl/hedge_vault";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "mainnet-beta") as Cluster;
/** The only RPC endpoint (reads, simulation, send). Exported only so `errors.ts` can redact it out of messages — never returned to a client. */
export const RPC_URL = process.env.RPC_URL || clusterApiUrl(CLUSTER);

export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || idl.address);

// The server never signs. This wallet only satisfies AnchorProvider's constructor.
const readonlyWallet: Wallet = {
  publicKey: Keypair.generate().publicKey,
  payer: undefined as never,
  signTransaction: () => Promise.reject(new Error("server wallet cannot sign")),
  signAllTransactions: () => Promise.reject(new Error("server wallet cannot sign")),
};

let connection: Connection | undefined;
let program: Program<HedgeVault> | undefined;

/** One lazily-built Connection per process, confirmed commitment, web3.js retry-on-429 enabled. */
export function getConnection(): Connection {
  connection ??= new Connection(RPC_URL, { commitment: "confirmed", disableRetryOnRateLimit: false });
  return connection;
}

export function getProgram(): Program<HedgeVault> {
  if (!program) {
    const provider = new AnchorProvider(getConnection(), readonlyWallet, { commitment: "confirmed" });
    program = new Program<HedgeVault>({ ...(idl as HedgeVault), address: PROGRAM_ID.toBase58() }, provider);
  }
  return program;
}

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const DLMM_PROGRAM_ID = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
export const DLMM_EVENT_AUTHORITY = new PublicKey("D1ZN9Wj1fRSUQfCjhvnu1hqDMT7hzjzBBpi12nVniYD6");
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
