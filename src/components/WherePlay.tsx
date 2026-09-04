import Link from "next/link";
import { LAUNCH_CORRIDOR, LIVE_AREA_COUNT, VENUE_TYPES } from "@/data/lebanon";
import LebanonMap from "./LebanonMap";
import styles from "./WherePlay.module.css";

/**
 * Answers "is this for me?" — an in-person product has to name the place, and
 * name it honestly: one stretch of coast, not the whole country.
 *
 * There is deliberately no area picker here. Asking a stranger to choose their
 * neighbourhood before they know what the product is puts a form in front of a
 * pitch, and the choice has to be made again during onboarding anyway. The map
 * says where we are; the copy says why; the link is the only thing to press.
 *
 * Now a server component — nothing here needs state any more.
 */
export default function WherePlay() {
  return (
    <section className={styles.section} id="where">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.kicker}>Where you play</p>
          <h2 className={styles.title}>
            Starting on the coast, {LAUNCH_CORRIDOR}.
          </h2>
          <p className={styles.sub}>
            Games here happen face to face, at a table someone can actually get
            to. So we are opening one stretch of coast at a time rather than
            claiming the whole country. {LIVE_AREA_COUNT} areas from Beirut up
            through Antelias, Jounieh and Kaslik to Jbeil, close enough that we
            meet every game master in person first.
          </p>

          <ul className={styles.venues}>
            {VENUE_TYPES.map((venue) => (
              <li key={venue.slug} className={styles.venue}>
                {venue.name}
              </li>
            ))}
          </ul>
          <p className={styles.venueNote}>
            Your game master comes to you, or you meet somewhere public,
            whichever the table agrees on. A home game only happens when
            everyone at the table has said yes to one.
          </p>

          <div className={styles.actions}>
            <Link href="/parties" className={styles.cta}>
              See how parties form
            </Link>
            <p className={styles.away}>
              Somewhere else in Lebanon, or outside it? The{" "}
              <Link href="/character-builder" className={styles.awayLink}>
                character builder works anywhere
              </Link>{" "}
              and always will. The rest of the coast is next.
            </p>
          </div>
        </div>

        <div className={styles.map}>
          <LebanonMap />
        </div>
      </div>
    </section>
  );
}
