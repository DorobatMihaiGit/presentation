import { expect, type Page, test } from "@playwright/test";

// Phones: no sideways scrolling, controls big enough for a thumb (44 px,
// Apple's minimum; WCAG 2.5.8 asks for 24), and the hero's copy clear of
// the finished stack.
const PHONES = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
] as const;

const TARGET = 44;

async function tooSmall(page: Page, selectors: string[]) {
  return page.evaluate(
    ({ selectors, target }) =>
      selectors.flatMap((selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)]
          .filter((element) => element.checkVisibility())
          .map((element) => {
            const box = element.getBoundingClientRect();
            return {
              control: `${selector} "${element.textContent?.trim().slice(0, 20)}"`,
              width: Math.round(box.width),
              height: Math.round(box.height),
            };
          })
          .filter((box) => box.width < target || box.height < target),
      ),
    { selectors, target: TARGET },
  );
}

for (const phone of PHONES) {
  test.describe(`on a ${phone.name} phone`, () => {
    test.use({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
    });

    test("no page scrolls sideways", async ({ page }) => {
      for (const path of [
        "/en",
        "/ro",
        "/en/projects/ledger-lens",
        "/ro/projects/tramline",
      ]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });

    test("every control is big enough for a thumb", async ({ page }) => {
      await page.goto("/en");
      expect(
        await tooSmall(page, [
          "header a",
          "header button",
          '[data-scene="hero"] a',
          // A card opens its project anywhere on it (stretched title link).
          "#projects article",
          "#projects article a[aria-label]",
          "#contact .section-body > div a",
          "footer a",
        ]),
      ).toEqual([]);

      await page.goto("/en/projects/tramline");
      expect(
        await tooSmall(page, ["header a", "header button", "article a"]),
      ).toEqual([]);
    });

    test("the hero's copy sits above the finished stack", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/en?capture=hero&p=1");
      await expect(page.locator("html")).toHaveAttribute(
        "data-canvas",
        "captured",
        { timeout: 90_000 },
      );
      const [x, y, width] = (
        (await page.locator(".stage-layer").getAttribute("data-box")) ?? ""
      )
        .split(" ")
        .map(Number);
      const copyBottom = await page.evaluate(() =>
        Math.max(
          ...[
            ...document.querySelectorAll('[data-scene="hero"] :is(h1, p, a)'),
          ].map((element) => element.getBoundingClientRect().bottom),
        ),
      );

      expect(y).toBeGreaterThanOrEqual(copyBottom + 24);
      expect(x).toBeGreaterThanOrEqual(16);
      expect(x + width).toBeLessThanOrEqual(phone.width - 16);
    });
  });
}
