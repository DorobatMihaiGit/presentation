import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { JOURNEY_STOPS, journeyTime } from "../director/journey";
import type { StageStore } from "../director/store";

/**
 * The page's only requestAnimationFrame loop: GSAP's ticker drives Lenis,
 * Lenis scroll events drive ScrollTrigger, and `onTick` (the director) decides
 * whether R3F renders a frame. `smooth: false` (poster capture) skips Lenis.
 */
export function startLoop(
  onTick: (seconds: number) => void,
  { smooth }: { smooth: boolean },
): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = smooth ? new Lenis({ autoRaf: false }) : null;
  lenis?.on("scroll", ScrollTrigger.update);
  const tick = (seconds: number) => {
    lenis?.raf(seconds * 1000);
    onTick(seconds);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
  };
}

/**
 * Scroll offsets where each journey stop starts (see `journeyTime`): the
 * top of the page, the end of the hero's pin, then the moment each later
 * section's top crosses the middle of the viewport, and the last offset.
 */
export function measureKnots(): number[] {
  const viewport = window.innerHeight;
  const top = (element: Element | null) =>
    element ? element.getBoundingClientRect().top + window.scrollY : 0;
  const hero = document.querySelector<HTMLElement>(".hero");
  const knots = [0, Math.max(0, (hero?.offsetHeight ?? 0) - viewport)];
  for (const stop of JOURNEY_STOPS.slice(2)) {
    const start = top(document.getElementById(stop)) - viewport / 2;
    knots.push(Math.max(knots[knots.length - 1], start));
  }
  knots.push(
    Math.max(knots[knots.length - 1], ScrollTrigger.maxScroll(window)),
  );
  return knots;
}

/**
 * One ScrollTrigger over the whole page turns the scroll position into
 * journey time in the store. The hero is pinned with CSS `position: sticky`
 * and Skills too (see globals.css), so nothing here pins; knots are measured
 * again on every refresh (resize, fonts, images).
 */
export function trackJourney(store: StageStore): () => void {
  const { setJourney } = store.getState();
  let knots = measureKnots();
  const trigger = ScrollTrigger.create({
    start: 0,
    end: "max",
    onRefresh: (self) => {
      knots = measureKnots();
      setJourney(journeyTime(self.scroll(), knots));
    },
    onUpdate: (self) => setJourney(journeyTime(self.scroll(), knots)),
  });
  setJourney(journeyTime(trigger.scroll(), knots));
  // Sections change height after load (fonts, the pinned Skills layout):
  // measure again whenever the page's size changes.
  let pending = 0;
  const resized = new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => ScrollTrigger.refresh());
  });
  resized.observe(document.body);
  ScrollTrigger.refresh();
  return () => {
    cancelAnimationFrame(pending);
    resized.disconnect();
    trigger.kill();
  };
}
