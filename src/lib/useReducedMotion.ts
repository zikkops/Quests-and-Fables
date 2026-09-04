"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Subscribing to the media query, not mirroring it into state inside an effect.
 * React 19 rejects setState in an effect for good reason: it renders once with
 * the wrong answer and then again with the right one. useSyncExternalStore
 * reads the true value during render instead. The third argument is the server
 * snapshot, and false is correct there because the server cannot know.
 *
 * Rule 5 in the README ("all motion stays behind prefers-reduced-motion") means
 * more than one component needs this, so it lives here rather than in whichever
 * component happened to need it first.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
