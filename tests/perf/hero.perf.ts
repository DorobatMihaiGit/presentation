import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

// Spec §7 M5 acceptance on the reference machine: no long task > 50 ms while
// scrolling the hero, tab memory < 400 MB.
const LONG_TASK_BUDGET_MS = 50;
const MEMORY_BUDGET_MB = 400;

type Sample = { start: number; duration: number };

declare global {
  interface Window {
    __longTasks: Sample[];
    __frames: number[];
  }
}

/** Private (unshared) memory of a process in MB, from /proc (Linux). */
function privateMb(pid: number): number {
  const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
  const kb = (field: string) =>
    Number(new RegExp(`^${field}:\\s+(\\d+) kB`, "m").exec(rollup)?.[1] ?? 0);
  return (kb("Private_Clean") + kb("Private_Dirty") + kb("SwapPss")) / 1024;
}

async function scrollHero(page: Page) {
  const length = await page.evaluate(() => {
    const hero = document.querySelector(".hero");
    return (hero?.getBoundingClientRect().height ?? 0) - window.innerHeight;
  });
  await page.mouse.move(720, 450);
  // Wheel notches like a mouse (Lenis smooths them), through the whole pin
  // and a screen past it, so the stage fade-out is measured too.
  const steps = Math.ceil((length + 900) / 100);
  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(1500);
}

for (const tier of ["auto", "1"] as const) {
  test(`scrolling the hero (tier ${tier}) stays smooth and lean`, async ({
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
        window.__frames.push(now);
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
    await page.waitForTimeout(1000);

    const scrollStart = await page.evaluate(() => performance.now());
    await scrollHero(page);
    const { longTasks, frames, scrolled } = await page.evaluate((start) => {
      const frames = window.__frames.filter((time) => time >= start);
      return {
        longTasks: window.__longTasks,
        frames: frames.slice(1).map((time, i) => time - frames[i]),
        scrolled: window.scrollY,
      };
    }, scrollStart);

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

    const sorted = [...frames].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const during = longTasks.filter((task) => task.start >= scrollStart);
    const before = longTasks.filter((task) => task.start < scrollStart);
    const report = {
      tier: await html.getAttribute("data-tier"),
      scrolledPx: scrolled,
      frames: frames.length,
      frameP95Ms: Number(p95.toFixed(1)),
      fps: Number(
        (1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)).toFixed(1),
      ),
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

    expect(scrolled).toBeGreaterThan(900);
    expect(
      Math.max(0, ...during.map((task) => task.duration)),
    ).toBeLessThanOrEqual(LONG_TASK_BUDGET_MS);
    expect(report.tabMb).toBeLessThan(MEMORY_BUDGET_MB);
  });
}
