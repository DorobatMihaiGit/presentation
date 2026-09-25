import { defineConfig } from "@playwright/test";

// `pnpm perf:local`: long tasks, frame times and memory while scrolling the
// live hero, on this machine's real GPU (spec §9). Needs `pnpm build` first.
// Not part of CI: GitHub runners have no GPU, and SwiftShader numbers would
// say nothing about Intel Iris Xe.
const PORT = 3300;

export default defineConfig({
  testDir: "./tests/perf",
  testMatch: /.*\.perf\.ts/,
  workers: 1,
  timeout: 180_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // Headless Chromium on SwiftShader by default; ANGLE on Vulkan reaches
      // the real GPU (Mesa Intel Iris Xe here) without opening a window.
      args: [
        "--use-angle=vulkan",
        "--enable-features=Vulkan",
        "--enable-gpu",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: {
    command: `next start --port ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
