"use client";

import { useEffect } from "react";
import { setMotionChoice } from "./motion-preference";
import { useMotion } from "./use-motion";

export type MotionToggleLabels = { label: string; on: string; off: string };

/**
 * Visible "Motion" switch. Off = posters only (tier 0): no smooth scrolling,
 * no pinned hero, no 3D, no animated page transitions. The choice is kept
 * in localStorage and mirrored to html[data-motion] on every page.
 */
export function MotionToggle({ labels }: { labels: MotionToggleLabels }) {
  const motion = useMotion();
  // Before hydration the state is unknown: render "off" (no motion yet).
  const on = motion === true;

  useEffect(() => {
    if (motion !== null) {
      document.documentElement.dataset.motion = motion ? "on" : "off";
    }
  }, [motion]);

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setMotionChoice(on ? "off" : "on")}
      className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-sm text-ink-muted ring-1 ring-line transition-colors hover:text-ink"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${on ? "bg-signal" : "bg-line-strong"}`}
      />
      <span className="max-sm:sr-only">{labels.label}</span>
      <span aria-hidden="true" className="font-mono text-label uppercase">
        {on ? labels.on : labels.off}
      </span>
    </button>
  );
}
