import Link from "next/link";
import Tracker from "./Tracker";
import styles from "./AtTheTable.module.css";

/**
 * The homepage's argument for the tracker: a heading, the working thing, and
 * the one sentence that says what it is not.
 *
 * The tracker itself lives in `Tracker.tsx` and is rendered here and on
 * `/campaign`. This file is only the frame around it, which is why it is short
 * and has no state in it at all.
 */
export default function AtTheTable() {
  return (
    <section className={styles.section} id="at-the-table">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <p className={styles.kicker}>At the table</p>
          <h2 className={styles.title}>The whole party, on one screen.</h2>
          <p className={styles.sub}>
            Once your party has a game master, it has a campaign, and this is it.
            Spend a slot, drop a condition on somebody, call a long rest for the
            table. It is a real one below, with four made up people in it, so go
            ahead and break it.
          </p>
        </div>

        <Tracker />

        <div className={styles.footer}>
          <p className={styles.notVtt}>
            <strong>It is not a virtual tabletop.</strong> No maps, no tokens, no
            fog of war, and nothing here rolls anything. The sheet shows you the
            modifier and you roll your own dice, at your own table.
          </p>
          <Link href="/campaign" className={styles.link}>
            See how a campaign works →
          </Link>
        </div>
      </div>
    </section>
  );
}
