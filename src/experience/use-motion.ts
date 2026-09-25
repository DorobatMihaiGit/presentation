import { useEffect, useState } from "react";
import { motionEnabled, subscribeMotion } from "./motion-preference";

/**
 * The motion preference, or null before hydration has finished: the server
 * cannot know it, and effects must not act on a guess.
 */
export function useMotion(): boolean | null {
  const [motion, setMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setMotion(motionEnabled());
    update();
    return subscribeMotion(update);
  }, []);

  return motion;
}
