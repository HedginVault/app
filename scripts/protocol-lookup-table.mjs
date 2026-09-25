// Creates or tops up the protocol address lookup table that transaction builders merge with Jupiter's
// tables (see src/server/tx/lookup-table.ts). Safe to re-run: it only appends addresses the table lacks.
//
//   node --env-file=.env.local scripts/protocol-lookup-table.mjs --keypair ~/.config/solana/idm.json [--table <address>] [--dry-run]
//
// Without --table it creates a new table owned by the keypair. Put the printed address in
// PROTOCOL_LOOKUP_TABLE (k8s/configmap.yaml, .env.local). Re-run with --table after adding a vault or
// a deposit mint.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const { values: args } = parseArgs({
  options: {
    keypair: { type: "string" },
    table: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
if (!args.keypair) throw new Error("--keypair <path> is required");

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const idl = JSON.parse(readFileSync(join(appRoot, "src", "idl", "hedge_vault.json"), "utf8"));
const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || idl.address);
const connection = new Connection(process.env.RPC_URL || clusterApiUrl(process.env.NEXT_PUBLIC_CLUSTER ?? "mainnet-beta"), "confirmed");
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(args.keypair.replace(/^~(?=\/)/, homedir()), "utf8"))),
);
const wallet = { publicKey: payer.publicKey, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs };
const program = new Program({ ...idl, address: programId.toBase58() }, new AnchorProvider(connection, wallet, {}));

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const DLMM_PROGRAM_ID = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
const DLMM_EVENT_AUTHORITY = new PublicKey("D1ZN9Wj1fRSUQfCjhvnu1hqDMT7hzjzBBpi12nVniYD6");
const JUPITER_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const JUPITER_EVENT_AUTHORITY = new PublicKey("D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf");
/** Mints most DLMM pairs quote against, besides each vault's deposit mint. */
const COMMON_MINTS = [
  "So11111111111111111111111111111111111111112", // wSOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
].map((key) => new PublicKey(key));
const TABLE_CAPACITY = 256;
const EXTEND_CHUNK = 20;

const pda = (...seeds) => PublicKey.findProgramAddressSync(seeds, programId)[0];
const config = pda(Buffer.from("config"));
const { treasuryAuthority } = await program.account.config.fetch(config);
const vaults = await program.account.vault.all();

const mints = [...new Map([...COMMON_MINTS, ...vaults.map((v) => v.account.depositMint)].map((m) => [m.toBase58(), m])).values()];
const mintInfos = await connection.getMultipleAccountsInfo(mints);
const tokenProgram = new Map(
  mints.map((mint, i) => [mint.toBase58(), mintInfos[i]?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID]),
);
const ata = (owner, mint) => getAssociatedTokenAddressSync(mint, owner, true, tokenProgram.get(mint.toBase58()));

// Ordered from most to least shared, so a table cut short by capacity keeps the widely used entries.
const wanted = [
  SystemProgram.programId, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, MEMO_PROGRAM_ID,
  DLMM_PROGRAM_ID, DLMM_EVENT_AUTHORITY, JUPITER_PROGRAM_ID, JUPITER_EVENT_AUTHORITY,
  config, treasuryAuthority,
  ...mints.flatMap((mint) => [mint, ata(treasuryAuthority, mint)]),
  ...vaults.flatMap(({ publicKey: vault, account }) => [
    vault,
    ...mints.map((mint) => ata(vault, mint)),
    // Jupiter strategies are keyed by the non-deposit mint.
    ...mints.filter((mint) => !mint.equals(account.depositMint)).map((mint) => pda(Buffer.from("strategy"), vault.toBuffer(), mint.toBuffer())),
  ]),
];

let table = args.table ? new PublicKey(args.table) : null;
let existing = [];
if (table) {
  const { value } = await connection.getAddressLookupTable(table);
  if (!value) throw new Error(`lookup table ${table.toBase58()} not found`);
  if (!value.state.authority?.equals(payer.publicKey)) throw new Error("the keypair is not this table's authority");
  existing = value.state.addresses;
}
const known = new Set(existing.map((key) => key.toBase58()));
const missing = [...new Map(wanted.map((key) => [key.toBase58(), key])).values()].filter((key) => !known.has(key.toBase58()));
const room = TABLE_CAPACITY - existing.length;
if (missing.length > room) console.warn(`table has room for ${room} of ${missing.length} addresses; the rest are skipped`);
const adding = missing.slice(0, room);

console.log(`authority ${payer.publicKey.toBase58()}`);
console.log(`vaults ${vaults.length}, mints ${mints.length}, table ${table?.toBase58() ?? "(new)"} has ${existing.length}, adding ${adding.length}`);
const rent = await connection.getMinimumBalanceForRentExemption(56 + 32 * (existing.length + adding.length));
console.log(`rent for the full table ${(rent / 1e9).toFixed(6)} SOL, balance ${((await connection.getBalance(payer.publicKey)) / 1e9).toFixed(6)} SOL`);
if (args["dry-run"]) {
  for (const key of adding) console.log(`  + ${key.toBase58()}`);
  process.exit(0);
}
if (adding.length === 0) {
  console.log("nothing to add");
  process.exit(0);
}

const send = async (instructions) => {
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }), ...instructions);
  return sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
};
const extend = (addresses) =>
  AddressLookupTableProgram.extendLookupTable({ lookupTable: table, authority: payer.publicKey, payer: payer.publicKey, addresses });

let pending = adding;
if (!table) {
  const [create, created] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: await connection.getSlot("finalized"),
  });
  table = created;
  console.log(`created ${table.toBase58()}: ${await send([create, extend(pending.slice(0, EXTEND_CHUNK))])}`);
  pending = pending.slice(EXTEND_CHUNK);
}
while (pending.length > 0) {
  console.log(`extended: ${await send([extend(pending.slice(0, EXTEND_CHUNK))])}`);
  pending = pending.slice(EXTEND_CHUNK);
}
console.log(`\nPROTOCOL_LOOKUP_TABLE=${table.toBase58()}`);
