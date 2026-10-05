import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // The database tests boot an in-memory Postgres (PGlite), which can be slow when many test files run at once.
  test: { include: ["src/**/*.test.{ts,tsx}"], hookTimeout: 60_000, testTimeout: 30_000 },
});
