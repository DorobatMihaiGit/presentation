/**
 * Whether the site may animate: the visitor's "Motion" toggle wins, then
 * prefers-reduced-motion and Save-Data (both mean "posters only", tier 0).
 * Loaded before the 3D chunk, so it stays tiny and dependency-free.
 */
export type MotionChoice = "on" | "off";

export const MOTION_STORAGE_KEY = "cv-motion";

export function resolveMotion(input: {
  choice: MotionChoice | null;
  reducedMotion: boolean;
  saveData: boolean;
}): boolean {
  if (input.choice !== null) {
    return input.choice === "on";
  }
  return !input.reducedMotion && !input.saveData;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const listeners = new Set<() => void>();
/** undefined = storage not read yet. */
let choice: MotionChoice | null | undefined;

function currentChoice(): MotionChoice | null {
  if (choice === undefined) {
    try {
      const stored = localStorage.getItem(MOTION_STORAGE_KEY);
      choice = stored === "on" || stored === "off" ? stored : null;
    } catch {
      choice = null;
    }
  }
  return choice;
}

/** useSyncExternalStore snapshot: a boolean, so it is stable between calls. */
export function motionEnabled(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return resolveMotion({
    choice: currentChoice(),
    reducedMotion: matchMedia(REDUCED_MOTION).matches,
    saveData: connection?.saveData === true,
  });
}

export function setMotionChoice(next: MotionChoice): void {
  choice = next;
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, next);
  } catch {
    // Storage blocked (private mode): the choice lasts until the next load.
  }
  for (const listener of listeners) {
    listener();
  }
}

/** useSyncExternalStore subscription: the toggle and the OS setting. */
export function subscribeMotion(listener: () => void): () => void {
  const query = matchMedia(REDUCED_MOTION);
  listeners.add(listener);
  query.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener("change", listener);
  };
}
