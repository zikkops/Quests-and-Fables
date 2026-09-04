import Link from "next/link";
import LebanonMap from "./LebanonMap";
import { LAUNCH_CORRIDOR } from "@/data/lebanon";
import styles from "./AreaPanel.module.css";

type Props = {
  /** The area the visitor picked on the homepage, if they picked one. */
  area?: { name: string; governorate: string; live: boolean };
};

/**
 * The map, and what it means for the person looking at it.
 *
 * `/parties` used to answer the homepage picker with a sentence. A sentence is
 * a weak answer to "where can I play": the map already exists, it already shows
 * which stretch of coast is lit, and putting it next to the answer turns "not
 * yet" into "not yet, and here is exactly how far away that is".
 *
 * The map itself is not per area. Its three lights are hand measured against
 * that particular render, so it shows the corridor rather than the pin, and the
 * panel beside it carries the specifics. Adding a light for all forty six areas
 * means measuring forty six positions, which is a real job and not this one.
 */
export default function AreaPanel({ area }: Props) {
  return (
    <div className={styles.panel}>
      <LebanonMap />

      <div className={styles.side}>
        {area ? (
          <>
            <p className={styles.label}>You picked</p>
            <p className={styles.area}>{area.name}</p>
            <p className={styles.governorate}>{area.governorate}</p>

            <p className={area.live ? styles.live : styles.waiting}>
              {area.live
                ? `Open now. ${LAUNCH_CORRIDOR} is where the first parties are forming.`
                : `Not open yet. We are on the coast between ${LAUNCH_CORRIDOR}, and the rest of the country follows one stretch at a time.`}
            </p>

            <p className={styles.body}>
              {area.live
                ? "There is no party there yet, because there is no pool to draw one from until people put their evenings in. Yours would be among the first, which is genuinely the fastest way to get a table."
                : "Put your evenings in anyway. The order we open in is decided by where people are actually waiting, so this is the one thing that moves your area up the list."}
            </p>
          </>
        ) : (
          <>
            <p className={styles.label}>Where we are open</p>
            <p className={styles.area}>{LAUNCH_CORRIDOR}</p>
            <p className={styles.governorate}>Beirut, Mount Lebanon and Keserwan</p>

            <p className={styles.body}>
              A corridor small enough that we can meet every game master in
              person, one at a time. The rest of the country is in the picker
              already and unlit on the map, so you can see the ambition without
              us claiming it.
            </p>
          </>
        )}

        <Link href="/onboarding/player" className={styles.action}>
          Put your evenings in →
        </Link>
      </div>
    </div>
  );
}
