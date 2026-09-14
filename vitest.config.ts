import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // `server-only` throws outside a React server bundle; tests import server modules directly.
    alias: { "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
