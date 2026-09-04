"use client";

/* =========================================================================
   Dev-only iris calibration ruler.

   The eye is a photograph, so the iris window has to be positioned by hand
   for whichever photo Mark drops in, because there is no way to compute it. This
   draws the clip ellipse, its centre lines and the gaze travel box on top of
   the frame, nudges them with the arrow keys, and prints a CSS block to paste
   straight into the EYE CALIBRATION section of globals.css.

   Mounted only when NODE_ENV !== "production" (see Hero.tsx), so it never
   reaches a production bundle. Press C to toggle.
   ========================================================================= */

import { useCallback, useEffect, useState } from "react";
import styles from "./EyeCalibrator.module.css";

const MODES = [
  { key: "centre", vars: ["--iris-cx", "--iris-cy"], step: 0.25 },
  { key: "radius", vars: ["--iris-rx", "--iris-ry"], step: 0.25 },
  { key: "range", vars: ["--gaze-range-x", "--gaze-range-y"], step: 0.25 },
  { key: "photo", vars: ["--eye-img-x", "--eye-img-y"], step: 0.5 },
] as const;

const TRACKED = [
  "--eye-img-scale",
  "--eye-img-x",
  "--eye-img-y",
  "--iris-cx",
  "--iris-cy",
  "--iris-rx",
  "--iris-ry",
  "--gaze-range-x",
  "--gaze-range-y",
  "--lid-top",
  "--lid-bottom",
  "--lid-meet",
] as const;

const readVars = () => {
  const computed = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    TRACKED.map((name) => [name, computed.getPropertyValue(name).trim()]),
  ) as Record<(typeof TRACKED)[number], string>;
};

export default function EyeCalibrator() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(0);
  const [values, setValues] = useState<Record<string, string> | null>(null);

  const sync = useCallback(() => setValues(readVars()), []);

  const nudge = useCallback(
    (axis: 0 | 1, direction: -1 | 1, coarse: boolean) => {
      const { vars, step } = MODES[mode];
      const name = vars[axis];
      const current = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(name),
      );
      if (Number.isNaN(current)) return;
      const next = current + direction * step * (coarse ? 4 : 1);
      document.documentElement.style.setProperty(name, `${next.toFixed(2)}%`);
      sync();
    },
    [mode, sync],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === "c" || event.key === "C") {
        setOpen((wasOpen) => {
          if (!wasOpen) sync();
          return !wasOpen;
        });
        return;
      }
      if (!open) return;

      if (event.key >= "1" && event.key <= String(MODES.length)) {
        setMode(Number(event.key) - 1);
        return;
      }
      const coarse = event.shiftKey;
      switch (event.key) {
        case "ArrowLeft":
          nudge(0, -1, coarse);
          break;
        case "ArrowRight":
          nudge(0, 1, coarse);
          break;
        case "ArrowUp":
          nudge(1, -1, coarse);
          break;
        case "ArrowDown":
          nudge(1, 1, coarse);
          break;
        default:
          return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, nudge, sync]);

  if (!open) return null;

  const block = values
    ? TRACKED.map((name) => `  ${name}: ${values[name]};`).join("\n")
    : "";

  return (
    <div className={styles.ruler}>
      <span className={styles.range} />
      <span className={styles.ellipse} />
      <span className={styles.crossV} />
      <span className={styles.crossH} />

      <div className={styles.panel}>
        <div className={styles.row}>
          {MODES.map((m, index) => (
            <button
              key={m.key}
              type="button"
              className={`${styles.mode} ${index === mode ? styles.modeOn : ""}`}
              onClick={() => setMode(index)}
            >
              {index + 1} {m.key}
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          arrows nudge · shift = ×4 · 1 to 4 switch · C closes
        </p>
        <pre className={styles.values}>{block}</pre>
        <button
          type="button"
          className={styles.copy}
          onClick={() => navigator.clipboard?.writeText(block)}
        >
          copy for globals.css
        </button>
      </div>
    </div>
  );
}
