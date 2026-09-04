/* =========================================================================
   The dragon eye: timing and behaviour.

   Position lives in the EYE CALIBRATION block in globals.css. Behaviour lives
   here. The split is deliberate: you calibrate where the iris sits without
   touching how it moves, and you tune how it moves without re-calibrating.

   The whole goal is that the motion reads as involuntary rather than
   animated. Real eyes do not ease smoothly to a new target. They snap
   (a saccade, ~200ms, ballistic), hold, drift a little, then snap again.
   Anything slower than that reads as a cartoon.
   ========================================================================= */

export const EYE = {
  /** Saccade: the snap to a new target. Ballistic and fast. */
  saccade: { min: 0.14, max: 0.22 },

  /** How long the eye holds a look before considering the next one. */
  hold: { min: 1.1, max: 3.4 },

  /** A slow wander while holding, so a held look is never frozen. */
  drift: { duration: { min: 1.6, max: 2.8 }, amount: 0.18 },

  /**
   * Horizontal is weighted heavier than vertical, which is how eyes actually
   * scan a scene. The ranges themselves are CSS (--gaze-range-*); this is the
   * bias applied within them.
   */
  bias: { x: 1, y: 0.55 },

  /** Roughly a third of glances are masked by a blink, as in life. */
  blinkOnGlanceChance: 0.34,

  /** Plus idle blinks on their own schedule. */
  idleBlink: { min: 3.2, max: 7.5 },

  /** Lid close, hold shut, lid open. Closing is faster than opening. */
  blink: { close: 0.075, shut: 0.045, open: 0.13 },

  /** Occasional double blink, because single-only blinking looks metronomic. */
  doubleBlinkChance: 0.18,

  /** A deliberate look (hover on a role card) is slower and more intentional. */
  intentional: { duration: 0.42, hold: 0.9 },
} as const;

export type Gaze = { x: number; y: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * The next place to look, in normalized -1..1 space. Multiplied by
 * --gaze-range-x / --gaze-range-y at render time.
 *
 * Pulled from a disc rather than a square so the extreme corners, which look
 * like a malfunction rather than a glance, never come up. Biased away from
 * the previous target so consecutive glances actually go somewhere.
 */
export function nextGaze(previous?: Gaze): Gaze {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = rand(0, Math.PI * 2);
    const radius = Math.sqrt(Math.random()); // uniform over the disc
    const candidate: Gaze = {
      x: Math.cos(angle) * radius * EYE.bias.x,
      y: Math.sin(angle) * radius * EYE.bias.y,
    };
    if (!previous) return candidate;
    const moved = Math.hypot(candidate.x - previous.x, candidate.y - previous.y);
    if (moved > 0.45) return candidate;
  }
  return { x: 0, y: 0 };
}

export const nextSaccadeDuration = () => rand(EYE.saccade.min, EYE.saccade.max);
export const nextHoldDuration = () => rand(EYE.hold.min, EYE.hold.max);
export const nextDriftDuration = () =>
  rand(EYE.drift.duration.min, EYE.drift.duration.max);
export const nextIdleBlinkDelay = () => rand(EYE.idleBlink.min, EYE.idleBlink.max);

export const shouldBlinkOnGlance = () => Math.random() < EYE.blinkOnGlanceChance;
export const shouldDoubleBlink = () => Math.random() < EYE.doubleBlinkChance;

/** A small wander around the current target, clamped to the gaze disc. */
export function driftFrom(gaze: Gaze): Gaze {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return {
    x: clamp(gaze.x + rand(-EYE.drift.amount, EYE.drift.amount)),
    y: clamp(gaze.y + rand(-EYE.drift.amount, EYE.drift.amount) * EYE.bias.y),
  };
}

/**
 * Where to look so the eye appears to be looking at an element on screen.
 * Used when a role card is hovered. The eye notices the thing you are about
 * to click, which is the entire trick.
 */
export function gazeToward(target: DOMRect, eye: DOMRect): Gaze {
  const eyeCx = eye.left + eye.width / 2;
  const eyeCy = eye.top + eye.height / 2;
  const dx = target.left + target.width / 2 - eyeCx;
  const dy = target.top + target.height / 2 - eyeCy;
  // Normalize against a generous span so nearby elements do not peg the iris.
  const span = Math.max(eye.width, 1) * 2.2;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return { x: clamp(dx / span), y: clamp((dy / span) * 1.6) };
}
