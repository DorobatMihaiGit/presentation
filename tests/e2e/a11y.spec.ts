import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { parseRgb, worstBackground } from "@/lib/contrast";

// M8 audit: axe (WCAG 2.2 AA) on every public page, at the sizes and motion
// settings visitors use; a keyboard-only journey; and the contrast of the
// copy over the poster and the live canvas (spec §3: >= 4.5:1).

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "phone", width: 390, height: 844 },
] as const;

const SECTIONS = [
  "hero",
  "about",
  "skills",
  "experience",
  "projects",
  "contact",
] as const;

async function axeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG)
    .analyze();
  return violations.map((v) => ({
    id: v.id,
    targets: v.nodes.map((node) => node.target.join(" ")),
  }));
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name}, motion ${reducedMotion}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion,
      });

      for (const locale of ["en", "ro"] as const) {
        test(`/${locale} has no axe violations in any section`, async ({
          page,
        }) => {
          await page.goto(`/${locale}`);
          expect(await axeViolations(page), "top").toEqual([]);
          for (const id of SECTIONS.slice(1)) {
            await page.locator(`#${id}`).scrollIntoViewIfNeeded();
            await page.waitForTimeout(300);
            expect(await axeViolations(page), id).toEqual([]);
          }
        });

        test(`/${locale}/projects/ledger-lens has no axe violations`, async ({
          page,
        }) => {
          await page.goto(`/${locale}/projects/ledger-lens`);
          expect(await axeViolations(page)).toEqual([]);
        });
      }

      test("the 404 page has no axe violations", async ({ page }) => {
        const response = await page.goto("/en/no-such-page");
        expect(response?.status()).toBe(404);
        expect(await axeViolations(page)).toEqual([]);
      });

      test("the sign-in page has no axe violations", async ({ page }) => {
        await page.goto("/admin/login");
        expect(await axeViolations(page)).toEqual([]);
      });
    });
  }
}

test("the poster fallback after a stage error has no axe violations", async ({
  page,
}) => {
  // Same trigger as stage-error.spec.ts: WebGL throws inside the stage.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith("webgl")) {
        throw new Error("e2e: WebGL is broken");
      }
      return (getContext as (...args: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof getContext;
  });
  await page.goto("/en?tier=1");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster", {
    timeout: 30_000,
  });
  expect(await axeViolations(page)).toEqual([]);
});

/** What has focus: a label and whether its focus ring shows. */
function focused(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) {
      return null;
    }
    // The ring may be drawn by a pseudo-element (project cards outline the
    // whole card from the link's ::after).
    const ring = [undefined, "::before", "::after"].some((pseudo) => {
      const style = getComputedStyle(element, pseudo);
      return (
        (style.outlineStyle !== "none" &&
          Number.parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== "none"
      );
    });
    const name = (
      element.getAttribute("aria-label") ??
      element.textContent ??
      ""
    ).trim();
    return { label: `${element.tagName} ${name.slice(0, 30)}`, ring };
  });
}

test("the whole home page works with the keyboard alone", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("data-motion", /on|off/);

  // No positive tabindex: the tab order is the DOM order, which is the
  // visual order of the single-column layout.
  expect(
    await page
      .locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')
      .count(),
  ).toBe(0);

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();

  const stops: string[] = [];
  const noRing: string[] = [];
  for (let i = 0; i < 200; i += 1) {
    await page.keyboard.press("Tab");
    const now = await focused(page);
    if (!now) {
      break; // Past the last control: focus left the page, so no trap.
    }
    stops.push(now.label);
    if (!now.ring) {
      noRing.push(now.label);
    }
  }
  expect(stops.length, "focus never left the page").toBeLessThan(200);
  expect(noRing).toEqual([]);
  // Every kind of control was reached, in page order.
  const order = [
    /^BUTTON .*Motion/i,
    /^A (English|EN)/i,
    /^A Ledger Lens/,
    /^BUTTON Send message/,
  ].map((pattern) => stops.findIndex((stop) => pattern.test(stop)));
  expect(
    order.every((index) => index >= 0),
    stops.join("\n"),
  ).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});

test("the motion toggle, a project and the language switch work from the keyboard", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("data-motion", /on|off/);

  const toggle = page.getByRole("button", { name: /Motion/ });
  const before = (await toggle.getAttribute("aria-pressed")) ?? "";
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).not.toHaveAttribute("aria-pressed", before);
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", before);

  await page
    .locator("#projects")
    .getByRole("link", { name: "Ledger Lens", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/en/projects/ledger-lens");

  await page.getByRole("link", { name: "All work" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/en#projects");
  // Back home, focus is not left on something hidden (the closed page).
  if (await focused(page)) {
    await expect(page.locator(":focus")).toBeVisible();
  }

  await page.getByRole("link", { name: "Română" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ro/);
});

const CONTRAST_STOPS = [
  { scene: '[data-scene="hero"]', copy: '[data-scene="hero"] p' },
  { scene: "#about", copy: "#about p, #about dd" },
  { scene: "#experience", copy: "#experience p, #experience li" },
  { scene: "#contact", copy: "#contact .section-body p" },
] as const;

for (const tier of [0, 2] as const) {
  test(`body text keeps 4.5:1 over the ${tier === 0 ? "poster" : "live canvas"}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/en?tier=${tier}`);
    if (tier > 0) {
      await expect(page.locator("html")).toHaveAttribute(
        "data-canvas",
        "live",
        { timeout: 60_000 },
      );
    }
    const failures: string[] = [];
    let measured = 0;
    for (const stop of CONTRAST_STOPS) {
      await page.locator(stop.scene).scrollIntoViewIfNeeded();
      await page.waitForTimeout(tier > 0 ? 3_000 : 500);
      const texts = await page.locator(stop.copy).evaluateAll((elements) =>
        elements.flatMap((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 4 &&
            box.height > 4 &&
            box.top >= 0 &&
            box.bottom <= innerHeight
            ? [
                {
                  what: (element.textContent ?? "").trim().slice(0, 30),
                  color: getComputedStyle(element).color,
                  box: {
                    x: Math.floor(box.left),
                    y: Math.floor(box.top),
                    width: Math.ceil(box.width),
                    height: Math.ceil(box.height),
                  },
                },
              ]
            : [];
        }),
      );
      // The text itself is hidden for the shot: only what is behind it counts.
      const hide = await page.addStyleTag({
        content: `${stop.copy} { color: transparent !important; }`,
      });
      for (const text of texts.slice(0, 6)) {
        const png = await page.screenshot({ clip: text.box });
        const { data, info } = await sharp(png)
          .raw()
          .toBuffer({ resolveWithObject: true });
        const { ratio } = worstBackground(
          new Uint8Array(data),
          info.channels,
          parseRgb(text.color),
        );
        measured += 1;
        if (ratio < 4.5) {
          failures.push(`${stop.scene} "${text.what}" ${ratio.toFixed(2)}:1`);
        }
      }
      await hide.evaluate((style) => (style as HTMLStyleElement).remove());
    }
    expect(measured).toBeGreaterThan(4);
    expect(failures).toEqual([]);
  });
}
