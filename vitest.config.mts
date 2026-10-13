import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Vitest starts a worker per file by default; on the 4-core Windows
    // laptop 44 workers each booting PGlite ran past the 10 s hook timeout.
    // CI runs on Ubuntu and keeps the default (as playwright.config.ts).
    maxWorkers: process.platform === "win32" ? 4 : undefined,
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/db/**/*.test.ts"],
  },
});
