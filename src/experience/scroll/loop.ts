import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import type { SceneId } from "@/components/ui/Section";
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
 * One ScrollTrigger per `[data-scene]` section, writing its progress into the
 * store. The hero is pinned with CSS `position: sticky`, so its progress runs
 * from "top top" to "bottom bottom"; the stage fades out as the hero leaves.
 */
export function trackSections(store: StageStore): () => void {
  const triggers: ScrollTrigger[] = [];
  const { setProgress, setOpacity, setActive } = store.getState();

  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-scene]",
  )) {
    const scene = element.dataset.scene as SceneId;
    const pinned = scene === "hero";
    const trigger = ScrollTrigger.create({
      trigger: element,
      start: pinned ? "top top" : "top bottom",
      end: pinned ? "bottom bottom" : "bottom top",
      onUpdate: (self) => setProgress(scene, self.progress),
    });
    setProgress(scene, trigger.progress);
    triggers.push(
      trigger,
      ScrollTrigger.create({
        trigger: element,
        start: "top center",
        end: "bottom center",
        onToggle: (self) => {
          if (self.isActive) setActive(scene);
        },
      }),
    );
    if (pinned) {
      const exit = ScrollTrigger.create({
        trigger: element,
        start: "bottom bottom",
        end: "bottom 35%",
        onUpdate: (self) => setOpacity(1 - self.progress),
      });
      setOpacity(1 - exit.progress);
      triggers.push(exit);
    }
  }
  ScrollTrigger.refresh();
  return () => {
    for (const trigger of triggers) trigger.kill();
  };
}
