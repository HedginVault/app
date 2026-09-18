// Copies a sibling program repository's Anchor build output into this app so it builds without
// `target/` (e.g. on Vercel). Set HEDGE_VAULT_PROGRAM_REPO when the repositories are not siblings.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const programRepo = process.env.HEDGE_VAULT_PROGRAM_REPO
  ? resolve(appRoot, process.env.HEDGE_VAULT_PROGRAM_REPO)
  : resolve(appRoot, "..", "programs");
const target = join(programRepo, "target");
const out = join(appRoot, "src", "idl");

const files = [
  ["idl/hedge_vault.json", "hedge_vault.json"],
  ["types/hedge_vault.ts", "hedge_vault.ts"],
];

mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  const src = join(target, from);
  if (!existsSync(src)) {
    console.error(`missing ${src}; build the program repo first or set HEDGE_VAULT_PROGRAM_REPO`);
    process.exit(1);
  }
  copyFileSync(src, join(out, to));
  console.log(`synced ${from} -> src/idl/${to}`);
}
