import Image from "next/image";
import { LAUNCH_CORRIDOR } from "@/data/lebanon";
import styles from "./LebanonMap.module.css";

/**
 * Lebanon at night, with the launch corridor pulsing.
 *
 * The base is a generated render (Higgsfield, `nano_banana_pro`) rather than the
 * hand-drawn SVG this replaced — it carries real terrain and a real coastline,
 * which the SVG never could. The render's own lights are baked in and static, so
 * the living part is these six overlaid towns.
 *
 * **The motion is CSS, not video, and that is deliberate.** A generated clip does
 * not loop: its first and last frames differ, so `loop` shows a visible jump
 * every few seconds. CSS is genuinely seamless, weighs nothing, and switches off
 * for reduced motion — which a background video cannot.
 *
 * Three towns, not the full fifteen areas: at 320px the corridor is about 45px
 * of coast, and six lights in that space merge into one smear. Beirut, Jounieh
 * and Jbeil are far enough apart to read as a chain.
 *
 * ⚠️ Positions are percentages of *this* render. They were measured — the
 * coastline was found by scanning the image for its gold stroke row by row, and
 * each light checked against it — not eyeballed. Replace the image and all three
 * have to be measured again.
 */
type Light = { name: string; x: number; y: number; major?: boolean };

const CORRIDOR: Light[] = [
  { name: "Beirut", x: 32.3, y: 50.8, major: true },
  { name: "Jounieh", x: 40.2, y: 45.0 },
  { name: "Jbeil", x: 41.8, y: 40.2, major: true },
];

export default function LebanonMap() {
  return (
    <figure className={styles.figure}>
      <div className={styles.frame}>
        <Image
          src="/assets/lebanon-map.webp"
          alt={
            "Lebanon seen from above at night. Scattered lights across the "
            + "country, brightest in a chain along the coast between Beirut and "
            + "Jbeil, where games are running now."
          }
          width={760}
          height={1018}
          className={styles.image}
          priority={false}
        />

        {/* Decorative: the alt text above already carries the meaning. */}
        <span className={styles.corridor} aria-hidden="true">
          {CORRIDOR.map((town, i) => (
            <span
              key={town.name}
              className={town.major ? styles.lightMajor : styles.light}
              style={{
                left: `${town.x}%`,
                top: `${town.y}%`,
                /* One light per third of the 4.5s cycle. Each finishes and goes
                   dark before the next begins, so the chain runs up the coast
                   Beirut → Jounieh → Jbeil and then starts again. */
                animationDelay: `${i * 1.5}s`,
              }}
            />
          ))}
        </span>
      </div>

      <figcaption className={styles.caption}>
        <span className={styles.dot} aria-hidden="true" />
        Open: {LAUNCH_CORRIDOR}. The rest of the country is next.
      </figcaption>
    </figure>
  );
}
