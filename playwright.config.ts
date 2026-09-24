import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Same server as the dev database (.env.local or the CI env), but a separate
// `cv_e2e` database that every run resets, so e2e never touches dev content.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI): DATABASE_URL comes from the environment.
}
const databaseUrl = new URL(
  process.env.DATABASE_URL ?? "postgres://cv:cv@localhost:5432/cv",
);
databaseUrl.pathname = "/cv_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node --import tsx scripts/e2e-db.ts && next build && next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // Canonical URLs, hreflang, sitemap and JSON-LD are baked at build time.
      SITE_URL: baseURL,
      DATABASE_URL: databaseUrl.toString(),
    },
  },
});
