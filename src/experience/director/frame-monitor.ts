/**
 * Runtime downgrade signal for on-demand rendering. drei's PerformanceMonitor
 * divides rendered frames by wall time, so the idle gaps between scroll-driven
 * frames read as a low frame rate. This monitor only measures the interval
 * between two back-to-back rendered ticks, which is what scrolling feels like.
 */
export type FrameMonitorOptions = {
  /** Mean interval above this is too slow (default 25 ms = 40 fps). */
  budgetMs?: number;
  /** Back-to-back intervals per verdict. */
  samples?: number;
};

export function createFrameMonitor({
  budgetMs = 25,
  samples = 45,
}: FrameMonitorOptions = {}) {
  let previous: number | null = null;
  let intervals: number[] = [];

  return {
    /**
     * Call once per ticker tick. Returns "decline" when the last `samples`
     * back-to-back rendered frames were too slow on average.
     */
    tick(now: number, rendered: boolean): "decline" | null {
      if (!rendered) {
        previous = null;
        return null;
      }
      if (previous !== null) {
        intervals.push(now - previous);
      }
      previous = now;
      if (intervals.length < samples) {
        return null;
      }
      const mean = intervals.reduce((sum, value) => sum + value, 0) / samples;
      intervals = [];
      return mean > budgetMs ? "decline" : null;
    },
  };
}
