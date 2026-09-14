// Copies the Anchor build output into the app so it builds without `target/`
// (e.g. on Vercel). Run after every `anchor build`: `yarn sync-idl`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(appRoot, "..", "target");
const out = join(appRoot, "src", "idl");

const files = [
  ["idl/hedge_vault.json", "hedge_vault.json"],
  ["types/hedge_vault.ts", "hedge_vault.ts"],
];

mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  const src = join(target, from);
  if (!existsSync(src)) {
    console.error(`missing ${src}, run \`anchor build\` first`);
    process.exit(1);
  }
  copyFileSync(src, join(out, to));
  console.log(`synced ${from} -> src/idl/${to}`);
}
