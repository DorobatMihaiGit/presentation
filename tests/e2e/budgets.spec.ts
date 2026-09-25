import { gzipSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";

// Spec §3 performance budgets, measured like the M3 plan did (gzip -9 of each
// module script): public JS before 3D <= 160 KB gz, lazy 3D chunk <= 350 KB gz.
// Tier 3's effects (N8AO, depth of field) are a chunk of their own on top.
const INITIAL_BUDGET_KB = 160;
const LAZY_BUDGET_KB = 350;
const TIER3_BUDGET_KB = 100;

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

/** gzip sizes of the scripts a live stage at `tier` loads after the page. */
async function lazyScripts(page: Page, tier: number): Promise<number[]> {
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
  await page.goto(`/en?tier=${tier}`);
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
  return Promise.all(lazy);
}

const sum = (sizes: number[]) => sizes.reduce((total, size) => total + size, 0);

test(`the lazy 3D chunk stays within ${LAZY_BUDGET_KB} KB gz`, async ({
  page,
}) => {
  const sizes = await lazyScripts(page, 2);
  console.log(`lazy: ${sizes.length} chunk(s), ${sum(sizes).toFixed(1)} KB gz`);
  expect(sizes.length).toBeGreaterThan(0);
  expect(sum(sizes)).toBeLessThanOrEqual(LAZY_BUDGET_KB);
});

test(`tier 3 adds one chunk of at most ${TIER3_BUDGET_KB} KB gz`, async ({
  page,
  browser,
  baseURL,
}) => {
  // Two live stages on SwiftShader, one with N8AO and depth of field.
  test.setTimeout(120_000);
  const tier3 = await lazyScripts(page, 3);
  // A fresh context, so nothing comes from the first page's cache.
  const tier2 = await lazyScripts(await browser.newPage({ baseURL }), 2);
  const extra = sum(tier3) - sum(tier2);
  console.log(
    `tier 3: +${tier3.length - tier2.length} chunk, ${extra.toFixed(1)} KB gz`,
  );
  expect(tier3.length).toBe(tier2.length + 1);
  expect(extra).toBeLessThanOrEqual(TIER3_BUDGET_KB);
});
