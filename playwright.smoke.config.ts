import { defineConfig, devices } from "@playwright/test";

// `pnpm smoke`: a read-only check of a deployed site (M9), run after every
// production or preview deploy: SMOKE_URL=https://… pnpm smoke. It starts no
// server, never signs in and never sends mail.
const baseURL = process.env.SMOKE_URL?.replace(/\/$/, "");
if (!baseURL) {
  throw new Error(
    "Set SMOKE_URL to the deployment to check, e.g. https://example.com",
  );
}

export default defineConfig({
  testDir: "./tests/smoke",
  testMatch: /.*\.smoke\.ts/,
  fullyParallel: true,
  retries: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL, ...devices["Desktop Chrome"] },
});
