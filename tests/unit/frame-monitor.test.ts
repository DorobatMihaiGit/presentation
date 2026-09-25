import { describe, expect, it } from "vitest";
import { createFrameMonitor } from "@/experience/director/frame-monitor";

/** Feeds `count` back-to-back rendered ticks `interval` ms apart. */
function run(
  monitor: ReturnType<typeof createFrameMonitor>,
  start: number,
  interval: number,
  count: number,
) {
  const verdicts = [];
  for (let i = 0; i < count; i += 1) {
    verdicts.push(monitor.tick(start + i * interval, true));
  }
  return verdicts.filter((verdict) => verdict !== null);
}

describe("createFrameMonitor", () => {
  it("stays quiet at 60 fps", () => {
    const monitor = createFrameMonitor({ samples: 10 });

    expect(run(monitor, 0, 16.7, 100)).toEqual([]);
  });

  it("declines after enough back-to-back frames below 40 fps", () => {
    const monitor = createFrameMonitor({ samples: 10 });

    expect(run(monitor, 0, 40, 11)).toEqual(["decline"]);
  });

  it("ignores idle gaps between on-demand frames", () => {
    const monitor = createFrameMonitor({ samples: 10 });
    const verdicts = [];
    // Two fast frames, then nothing to draw for a while, many times over.
    for (let burst = 0; burst < 20; burst += 1) {
      const start = burst * 1000;
      verdicts.push(monitor.tick(start, true));
      verdicts.push(monitor.tick(start + 16.7, true));
      verdicts.push(monitor.tick(start + 33.4, false));
    }

    expect(verdicts.filter((verdict) => verdict !== null)).toEqual([]);
  });
});
