import { expect, type Page, test } from "@playwright/test";

// Where the stack sits on screen (data-box, written by the stage every
// frame) against the copy of the section it shares the screen with. Capture
// mode renders one exact journey frame, no springs, so SwiftShader needs only
// a few frames; scrolling afterwards puts the DOM where it is at that
// journey time on the live page (journeyTime's knots, measured the same way).
test.describe.configure({ timeout: 180_000 });

/** Room between the stack and any copy, and between it and the edges. */
const GAP = 32;
const MARGIN = 16;

type Rect = { left: number; top: number; right: number; bottom: number };

const STOPS = [
  { scene: "hero", p: 1, time: 1, copy: '[data-scene="hero"] :is(h1, p, a)' },
  { scene: "about", p: 0.6, time: 1.6, copy: "#about :is(h2, p, dt, dd, img)" },
  { scene: "skills", p: 0.5, time: 2.5, copy: null },
  {
    scene: "contact",
    p: 1,
    time: 6,
    copy: "#contact .section-body :is(h2, p, h3, a, form)",
  },
] as const;

const VIEWPORTS = [
  [1280, 720],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1500, 1000],
  [1920, 1080],
] as const;

async function stackOnScreen(page: Page): Promise<Rect> {
  const value = await page.locator(".stage-layer").getAttribute("data-box");
  const [x, y, width, height] = (value ?? "").split(" ").map(Number);
  expect(width, "data-box").toBeGreaterThan(0);
  return { left: x, top: y, right: x + width, bottom: y + height };
}

/** Scrolls to journey time `time` and returns the copy's boxes. */
async function copyAt(page: Page, time: number, selector: string) {
  return page.evaluate(
    ({ time, selector }) => {
      const vh = window.innerHeight;
      const top = (id: string) =>
        (document.getElementById(id)?.getBoundingClientRect().top ?? 0) +
        window.scrollY;
      const hero = document.querySelector<HTMLElement>(".hero");
      const knots = [0, Math.max(0, (hero?.offsetHeight ?? 0) - vh)];
      for (const id of ["skills", "experience", "projects", "contact"]) {
        knots.push(Math.max(knots[knots.length - 1], top(id) - vh / 2));
      }
      knots.push(
        Math.max(
          knots[knots.length - 1],
          document.documentElement.scrollHeight - vh,
        ),
      );
      const index = Math.min(knots.length - 2, Math.floor(time));
      window.scrollTo(
        0,
        knots[index] + (time - index) * (knots[index + 1] - knots[index]),
      );
      return [...document.querySelectorAll(selector)].flatMap((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const box = ["FORM", "IMG"].includes(element.tagName)
          ? element.getBoundingClientRect()
          : range.getBoundingClientRect();
        return box.width > 0 && box.bottom > 0 && box.top < vh
          ? [
              {
                what: `${element.tagName} ${(element.textContent ?? "").trim().slice(0, 24)}`,
                left: box.left,
                top: box.top,
                right: box.right,
                bottom: box.bottom,
              },
            ]
          : [];
      });
    },
    { time, selector },
  );
}

for (const [width, height] of VIEWPORTS) {
  test(`at ${width}x${height} the stack stays on screen and off the copy`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    for (const stop of STOPS) {
      await page.goto(`/en?capture=${stop.scene}&p=${stop.p}`);
      await expect(page.locator("html")).toHaveAttribute(
        "data-canvas",
        "captured",
        { timeout: 90_000 },
      );
      const stack = await stackOnScreen(page);
      const where = `${stop.scene} ${JSON.stringify(stack)}`;
      expect(stack.left, where).toBeGreaterThanOrEqual(MARGIN);
      expect(stack.top, where).toBeGreaterThanOrEqual(MARGIN);
      expect(stack.right, where).toBeLessThanOrEqual(width - MARGIN);
      expect(stack.bottom, where).toBeLessThanOrEqual(height - MARGIN);
      if (stop.copy) {
        const covered = (await copyAt(page, stop.time, stop.copy)).filter(
          (copy) =>
            copy.left < stack.right + GAP &&
            copy.right > stack.left - GAP &&
            copy.top < stack.bottom + GAP &&
            copy.bottom > stack.top - GAP,
        );
        expect(
          covered.map((copy) => copy.what),
          where,
        ).toEqual([]);
      }
    }
  });
}
