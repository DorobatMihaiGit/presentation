import { expect, type Page, test } from "@playwright/test";

// The M6 scenes on a live stage. Headless Chromium renders WebGL with
// SwiftShader, which the tier classifier sends to posters, so these tests
// force tier 1, the cheapest live tier (a forced tier never steps down).
// Desktop Chrome's 1280x720 viewport is wide enough (80rem) for the pinned
// Skills layout. SwiftShader takes 0.25-0.5 s per frame (longer with many
// workers) and the springs need a few seconds of frames to settle.
test.describe.configure({ timeout: 120_000 });
const SETTLE = { timeout: 30_000 };

async function goLive(page: Page) {
  await page.goto("/en?tier=1");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
}

/** Scrolls so that the top of `selector` sits `offset` viewports above the top. */
async function scrollPast(page: Page, selector: string, offset: number) {
  await page.evaluate(
    ({ selector, offset }) => {
      const top = document.querySelector(selector)?.getBoundingClientRect().top;
      window.scrollTo(0, window.scrollY + (top ?? 0) + offset * innerHeight);
    },
    { selector, offset },
  );
}

test("Skills pins the exploded stack and puts each row next to its layer", async ({
  page,
}) => {
  await goLive(page);
  await scrollPast(page, "#skills", 1);
  const layer = page.locator(".stage-layer");
  await expect(layer).toHaveAttribute("data-journey", /^2\.[3-7]/, SETTLE);

  const skills = page.locator("#skills");
  await expect(skills.locator("h2")).toBeInViewport();
  await expect(skills.locator("ol").first()).toHaveCSS("--rows", "1", SETTLE);
  const rows = skills.locator("[data-layer]");
  await expect(rows).toHaveCount(5);
  const tops: number[] = [];
  for (const row of await rows.all()) {
    await expect(row).toBeInViewport();
    tops.push((await row.boundingBox())?.y ?? 0);
  }
  // Glass on top, base plate at the bottom: the rows follow the layers.
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
});

for (const [width, height] of [
  [1280, 720],
  [1366, 768],
] as const) {
  test.describe(`on a ${width}x${height} screen`, () => {
    test.use({ viewport: { width, height } });

    test("the Skills rows never cover the title, the intro or each other", async ({
      page,
    }) => {
      await goLive(page);
      const layer = page.locator(".stage-layer");
      // Skills pins for 300lvh; its stop starts half a screen before its top.
      for (const offset of [0.3, 0.8, 1.3, 1.8]) {
        await scrollPast(page, "#skills", offset);
        const time = 2 + (offset + 0.5) / 3;
        await expect
          .poll(
            async () => Number(await layer.getAttribute("data-journey")),
            SETTLE,
          )
          .toBeCloseTo(time, 1);

        const overlaps = await page.evaluate(() => {
          const text = [
            ...document.querySelectorAll("#skills .section-body > :is(h2, p)"),
          ].map((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return {
              name: element.tagName,
              box: range.getBoundingClientRect(),
            };
          });
          const rows = [
            ...document.querySelectorAll<HTMLElement>("#skills [data-layer]"),
          ].map((row) => ({
            name: row.dataset.layer ?? "",
            box: row.getBoundingClientRect(),
          }));
          const hit = (a: DOMRect, b: DOMRect) =>
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top;
          return rows.flatMap((row, index) =>
            [...text, ...rows.slice(index + 1)]
              .filter((other) => hit(row.box, other.box))
              .map((other) => `${row.name}/${other.name}`),
          );
        });
        expect(overlaps, `journey ${time.toFixed(2)}`).toEqual([]);
      }
    });
  });
}

test("hovering a Skills row lights its layer", async ({ page }) => {
  await goLive(page);
  await scrollPast(page, "#skills", 1);
  await expect(page.locator(".stage-layer")).toHaveAttribute(
    "data-journey",
    /^2\.[3-7]/,
    SETTLE,
  );

  const data = page.locator('#skills [data-layer="data"]');
  await data.hover();
  await expect(data).toHaveAttribute("data-lit", "", SETTLE);
  await expect(page.locator("#skills [data-lit]")).toHaveCount(1);
});

test("the Skills layer labels stay in the DOM for screen readers", async ({
  page,
}) => {
  await goLive(page);
  const label = page.locator('#skills [data-layer="interface"] > div > p');

  await expect(label).toHaveText("Layer 1 · Glass");
  await expect(label).toHaveCSS("clip-path", "inset(50%)");
});

/**
 * Scrolls `fraction` of the way through a journey stop: from the moment the
 * section's top crosses the middle of the viewport to when the next one's does.
 */
async function scrollThrough(
  page: Page,
  section: string,
  next: string,
  fraction: number,
) {
  await page.evaluate(
    ({ section, next, fraction }) => {
      const top = (id: string) =>
        (document.getElementById(id)?.getBoundingClientRect().top ?? 0) +
        window.scrollY -
        window.innerHeight / 2;
      const from = top(section);
      window.scrollTo(0, from + fraction * (top(next) - from));
    },
    { section, next, fraction },
  );
}

test("the light pulse lights the jobs one after another", async ({ page }) => {
  await goLive(page);
  const jobs = page.locator("#experience ol > li");
  expect(await jobs.count()).toBe(3);

  await scrollThrough(page, "experience", "projects", 0.25);
  await expect(jobs.first()).toHaveAttribute("data-lit", "", SETTLE);
  await scrollThrough(page, "experience", "projects", 0.8);
  await expect(jobs.last()).toHaveAttribute("data-lit", "", SETTLE);
  await expect(page.locator("#experience [data-lit]")).toHaveCount(1);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the Skills rows stay a list", async ({ page }) => {
    await goLive(page);
    await scrollPast(page, "#skills", 0);

    const rows = page.locator("#skills [data-layer]");
    await expect(rows.first()).toHaveCSS("position", "static");
    await expect(
      page.locator("#skills [data-layer] > div > p").first(),
    ).toHaveCSS("clip-path", "none");
  });
});
