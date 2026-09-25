import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

// M6 acceptance on the reference machine (Intel Iris Xe): scrolling the WHOLE
// page (every scene of the journey) holds >= 55 fps with no long task over
// 50 ms, and the tab stays under 400 MB. Mounting the stage (after the load
// event, before any scrolling) is reported and has no task over 100 ms.
const LONG_TASK_BUDGET_MS = 50;
const MOUNT_BUDGET_MS = 100;
const MEMORY_BUDGET_MB = 400;
const MIN_FPS = 55;
const STOPS = [
  "hero",
  "about",
  "skills",
  "experience",
  "projects",
  "contact",
] as const;

type Sample = { start: number; duration: number };

declare global {
  interface Window {
    __longTasks: Sample[];
    /** [rAF timestamp, journey time shown by the stage] */
    __frames: [number, number][];
  }
}

/** Private (unshared) memory of a process in MB, from /proc (Linux). */
function privateMb(pid: number): number {
  const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
  const kb = (field: string) =>
    Number(new RegExp(`^${field}:\\s+(\\d+) kB`, "m").exec(rollup)?.[1] ?? 0);
  return (kb("Private_Clean") + kb("Private_Dirty") + kb("SwapPss")) / 1024;
}

async function scrollPage(page: Page) {
  const length = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  await page.mouse.move(720, 450);
  // Wheel notches like a mouse (Lenis smooths them), top to bottom.
  const steps = Math.ceil(length / 100) + 10;
  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(1500);
}

function stats(intervals: number[]) {
  const sorted = [...intervals].sort((a, b) => a - b);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return {
    frames: intervals.length,
    fps: Number((1000 / mean).toFixed(1)),
    p95: Number((sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1)),
  };
}

for (const tier of ["auto", "1", "3"] as const) {
  test(`scrolling the whole journey (tier ${tier}) stays smooth and lean`, async ({
    page,
    browser,
  }, testInfo) => {
    await page.addInitScript(() => {
      window.__longTasks = [];
      window.__frames = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            start: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: "longtask", buffered: true });
      const frame = (now: number) => {
        const layer = document.querySelector<HTMLElement>(".stage-layer");
        window.__frames.push([now, Number(layer?.dataset.journey ?? 0)]);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.goto(tier === "auto" ? "/en" : `/en?tier=${tier}`);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-canvas", /live|poster/, {
      timeout: 30_000,
    });
    test.skip(
      (await html.getAttribute("data-canvas")) === "poster",
      "No hardware WebGL here: the classifier chose posters.",
    );
    await expect(html).toHaveAttribute("data-canvas", "live");
    await page.waitForTimeout(2000);

    const scrollStart = await page.evaluate(() => performance.now());
    await scrollPage(page);
    const { longTasks, frames, scrolled, end } = await page.evaluate(
      (start) => ({
        longTasks: window.__longTasks,
        frames: window.__frames.filter(([time]) => time >= start),
        scrolled: window.scrollY,
        end: Number(
          document.querySelector<HTMLElement>(".stage-layer")?.dataset.journey,
        ),
      }),
      scrollStart,
    );

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const heapMb =
      (metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0) /
      1024 /
      1024;
    const browserCdp = await browser.newBrowserCDPSession();
    const { processInfo } = await browserCdp.send("SystemInfo.getProcessInfo");
    // The busiest renderer is this tab's; the GPU process holds its textures.
    const renderer = processInfo
      .filter((info) => info.type === "renderer")
      .sort((a, b) => b.cpuTime - a.cpuTime)[0];
    const gpu = processInfo.find((info) => info.type === "GPU");
    const rendererMb = privateMb(renderer.id);
    const gpuMb = gpu ? privateMb(gpu.id) : 0;

    // Frame intervals grouped by the journey stop on screen.
    const byStop = STOPS.map(() => [] as number[]);
    for (let i = 1; i < frames.length; i += 1) {
      const stop = Math.min(STOPS.length - 1, Math.floor(frames[i][1]));
      byStop[stop].push(frames[i][0] - frames[i - 1][0]);
    }
    const perStop = Object.fromEntries(
      STOPS.map((stop, index) => [stop, stats(byStop[index])]),
    );
    const all = stats(byStop.flat());
    const during = longTasks.filter((task) => task.start >= scrollStart);
    const before = longTasks.filter((task) => task.start < scrollStart);
    const report = {
      tier: await html.getAttribute("data-tier"),
      scrolledPx: scrolled,
      journeyEnd: end,
      fps: all.fps,
      frameP95Ms: all.p95,
      perStop,
      longTasksWhileScrolling: during.map((task) => Math.round(task.duration)),
      longTasksBeforeScrolling: before.map((task) => Math.round(task.duration)),
      jsHeapMb: Number(heapMb.toFixed(1)),
      rendererPrivateMb: Number(rendererMb.toFixed(1)),
      gpuProcessPrivateMb: Number(gpuMb.toFixed(1)),
      tabMb: Number((rendererMb + gpuMb).toFixed(1)),
    };
    console.log(JSON.stringify(report));
    await testInfo.attach("perf.json", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });

    // The whole page was scrolled and the journey reached its end.
    expect(end).toBeGreaterThan(5.9);
    expect(
      Math.max(0, ...during.map((task) => task.duration)),
    ).toBeLessThanOrEqual(LONG_TASK_BUDGET_MS);
    // The stage mounts in short steps (Stage.tsx, warmup.ts). M5 mounted it
    // in one go: long tasks of up to 172 ms. Evaluating the chunk can still
    // take about 50 ms on a busy machine, hence the looser budget.
    expect(
      Math.max(0, ...before.map((task) => task.duration)),
    ).toBeLessThanOrEqual(MOUNT_BUDGET_MS);
    expect(report.tabMb).toBeLessThan(MEMORY_BUDGET_MB);
    // Tier 3 is meant for discrete GPUs; on this iGPU it is only reported.
    if (tier !== "3") {
      for (const stop of STOPS) {
        expect(perStop[stop].fps, stop).toBeGreaterThanOrEqual(MIN_FPS);
      }
    }
  });
}
