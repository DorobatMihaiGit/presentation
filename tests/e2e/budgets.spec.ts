import { gzipSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";

// Spec §3 performance budgets, measured like the M3 plan did (gzip -9 of each
// module script): public JS before 3D <= 160 KB gz, lazy 3D chunk <= 350 KB gz.
const INITIAL_BUDGET_KB = 160;
const LAZY_BUDGET_KB = 350;

const gzKb = (body: Buffer) => gzipSync(body, { level: 9 }).length / 1024;

async function initialScripts(page: Page, path: string): Promise<string[]> {
  const html = await (await page.request.get(path)).text();
  return [...html.matchAll(/<script[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => !tag.includes("noModule"))
    .flatMap((tag) => /\ssrc="([^"]+)"/.exec(tag)?.[1] ?? []);
}

for (const path of ["/en", "/ro"]) {
  test(`${path} loads at most ${INITIAL_BUDGET_KB} KB gz of JS before 3D`, async ({
    page,
  }) => {
    let total = 0;
    for (const src of await initialScripts(page, path)) {
      total += gzKb(await (await page.request.get(src)).body());
    }
    console.log(`${path}: ${total.toFixed(1)} KB gz before 3D`);
    expect(total).toBeLessThanOrEqual(INITIAL_BUDGET_KB);
  });
}

test(`the lazy 3D chunk stays within ${LAZY_BUDGET_KB} KB gz`, async ({
  page,
}) => {
  const initial = new Set(await initialScripts(page, "/en"));
  const lazy: Promise<number>[] = [];
  page.on("response", (response) => {
    const { pathname } = new URL(response.url());
    if (
      response.request().resourceType() === "script" &&
      !initial.has(pathname)
    ) {
      lazy.push(response.body().then(gzKb));
    }
  });
  await page.goto("/en?tier=2");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });

  const sizes = await Promise.all(lazy);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  console.log(`lazy: ${sizes.length} chunk(s), ${total.toFixed(1)} KB gz`);
  expect(sizes.length).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(LAZY_BUDGET_KB);
});
