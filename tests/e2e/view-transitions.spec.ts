import { expect, type Page, test } from "@playwright/test";

// Project pages open with a View Transition (React <ViewTransition>, types
// from next/link's transitionTypes). Each startViewTransition call is
// recorded with the view-transition animations it ran, or as skipped when
// the browser dropped it (a later transition started first).

type Run = {
  types: string[];
  ready: boolean;
  skipped: boolean;
  animations: { name: string; ms: number }[];
};

declare global {
  interface Window {
    __transitions: Run[];
  }
}

async function recordTransitions(page: Page) {
  await page.addInitScript(() => {
    window.__transitions = [];
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((update: never) => {
      const run: Run = {
        types: [...((update as { types?: string[] })?.types ?? [])],
        ready: false,
        skipped: false,
        animations: [],
      };
      window.__transitions.push(run);
      const transition = start(update);
      transition.ready.then(
        () => {
          run.animations = document
            .getAnimations()
            .filter((animation) =>
              (
                animation.effect as KeyframeEffect | null
              )?.pseudoElement?.startsWith("::view-transition"),
            )
            .map((animation) => ({
              name: `${(animation.effect as KeyframeEffect).pseudoElement} ${(animation as CSSAnimation).animationName}`,
              ms: Number(animation.effect?.getTiming().duration ?? 0),
            }));
          run.ready = true;
        },
        () => {
          run.skipped = true;
          run.ready = true;
        },
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
}

/**
 * The transition a navigation tagged `type`, once its animations have
 * started (or it was skipped). Other transitions may run around it (the
 * page hidden in an <Activity> renders in the background), so it is found
 * by its type.
 */
const transitionOf = (page: Page, type: string) =>
  page
    .waitForFunction(
      (type) =>
        window.__transitions.find(
          (run) => run.ready && run.types.includes(type),
        ) ?? null,
      type,
    )
    .then((handle) => handle.jsonValue() as Promise<Run>);

/**
 * Waits for hydration: before it, a click on a link is a full page load,
 * not a client navigation. Every page's header sets html[data-motion] once
 * it has hydrated (MotionToggle).
 */
async function hydrated(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-motion", /on|off/);
}

/**
 * Resolves once Next has prefetched `path`'s page segment (links prefetch
 * as they scroll into view). A click before it still navigates, but the
 * page arrives in a later commit, without the transition's types.
 */
function prefetched(page: Page, path: string) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      (
        response.request().headers()["next-router-segment-prefetch"] ?? ""
      ).endsWith("__PAGE__"),
  );
}

async function openLedgerLens(page: Page) {
  const ready = prefetched(page, "/en/projects/ledger-lens");
  await page.goto("/en");
  await hydrated(page);
  await page.locator("#projects").scrollIntoViewIfNeeded();
  await ready;
  await page
    .locator("#projects")
    .getByRole("link", { name: "Ledger Lens", exact: true })
    .click();
  await expect(page).toHaveURL("/en/projects/ledger-lens");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ledger Lens",
  );
}

test("a project opens with a forward slide and closes with a backward one", async ({
  page,
}) => {
  await recordTransitions(page);
  await openLedgerLens(page);

  const forward = await transitionOf(page, "nav-forward");
  expect(forward.types).toEqual(["nav-forward"]);
  expect(forward.skipped).toBe(false);
  expect(forward.animations).toContainEqual(
    expect.objectContaining({
      name: expect.stringMatching(/new\(.+\) vt-slide$/),
    }),
  );
  expect(Math.max(...forward.animations.map((a) => a.ms))).toBeGreaterThan(0);

  await page.getByRole("link", { name: "All work" }).click();
  await expect(page).toHaveURL("/en#projects");
  const back = await transitionOf(page, "nav-back");
  expect(back.types).toEqual(["nav-back"]);
  await expect(page.locator("#projects")).toBeInViewport();
});

test("the next project slides in from the right", async ({ page }) => {
  await recordTransitions(page);
  const ready = prefetched(page, "/en/projects/atelier-cms");
  await page.goto("/en/projects/tramline");
  await hydrated(page);
  const more = page.getByRole("navigation", { name: "More work" });
  await more.scrollIntoViewIfNeeded();
  await ready;

  await more.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL("/en/projects/atelier-cms");
  expect((await transitionOf(page, "nav-forward")).types).toEqual([
    "nav-forward",
  ]);
});

test("the whole card opens the project", async ({ page }) => {
  await page.goto("/en");
  await hydrated(page);
  const card = page.locator("#projects li").filter({ hasText: "Tramline" });

  // Anywhere on the card, e.g. its summary, which the title link covers.
  const summary = card.getByText("Installable web app");
  await summary.scrollIntoViewIfNeeded();
  const box = await summary.boundingBox();
  await page.mouse.click((box?.x ?? 0) + 8, (box?.y ?? 0) + 8);
  await expect(page).toHaveURL("/en/projects/tramline");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("pages swap without animating", async ({ page }) => {
    await recordTransitions(page);
    await openLedgerLens(page);

    // The page still changes inside a transition, but nothing moves.
    const { animations } = await transitionOf(page, "nav-forward");
    expect(animations.filter((animation) => animation.ms > 0)).toEqual([]);
  });
});

test("the Motion switch turns page transitions off too", async ({ page }) => {
  await recordTransitions(page);
  const ready = prefetched(page, "/en/projects/ledger-lens");
  await page.goto("/en");
  const motion = page
    .getByRole("banner")
    .getByRole("button", { name: "Motion" });
  // Hydrated once it shows the stored preference (on by default).
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await motion.click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");

  await page.locator("#projects").scrollIntoViewIfNeeded();
  await ready;
  await page
    .locator("#projects")
    .getByRole("link", { name: "Ledger Lens", exact: true })
    .click();
  await expect(page).toHaveURL("/en/projects/ledger-lens");
  const { animations } = await transitionOf(page, "nav-forward");
  expect(animations.filter((animation) => animation.ms > 0)).toEqual([]);
});

test("browsers without View Transitions still navigate", async ({ page }) => {
  await page.addInitScript(() => {
    // biome-ignore lint/suspicious/noExplicitAny: removing a browser API on purpose
    delete (Document.prototype as any).startViewTransition;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openLedgerLens(page);
  await page.getByRole("link", { name: "All work" }).click();
  await expect(page).toHaveURL("/en#projects");
  expect(errors).toEqual([]);
});
