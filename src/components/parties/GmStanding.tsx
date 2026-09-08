"use client";

import { useEffect, useState } from "react";
import { readStanding } from "@/lib/firebase/rating";
import { AXES, ENOUGH, enoughToShow, NO_STANDING, type Standing } from "@/lib/rating";
import styles from "./Standing.module.css";

/**
 * What previous tables said about the game master who runs this one.
 *
 * Public, which was decided knowingly, and shaped so that being public costs a
 * real person as little as it can.
 *
 * **Nothing at all below `ENOUGH` ratings.** Not a provisional number, not one
 * star out of five with an asterisk. Two disappointed players out of three is
 * thirty-three percent on a page and is also just a Tuesday that went badly,
 * and the person it names has to live in the same city as the people reading
 * it. The empty state says the tables have not been asked yet, which is true.
 *
 * **Counts, not an average.** "Nine of eleven would play with them again" is a
 * sentence somebody can weigh. A rounded 4.1 is a scoreboard, and it invites
 * comparing two people whose numbers came from different rooms.
 *
 * There is no name here and no photograph. The house assigns game masters, so
 * this is context on a table rather than a profile to shop through.
 */
export default function GmStanding({ gmId }: { gmId: string }) {
  const [standing, setStanding] = useState<Standing | null>(null);

  useEffect(() => {
    let alive = true;

    readStanding(gmId)
      .then((found) => {
        if (alive) setStanding(found);
      })
      .catch(() => {
        if (alive) setStanding(NO_STANDING);
      });

    return () => {
      alive = false;
    };
  }, [gmId]);

  if (!standing) return null;

  return (
    <section className={styles.card}>
      <h3 className={styles.title}>The game master, according to their tables</h3>

      {enoughToShow(standing) ? (
        <>
          <ul className={styles.lines}>
            {AXES.map((axis) => (
              <li key={axis.key} className={styles.line}>
                <span className={styles.number}>
                  {standing[axis.key]}/{standing.count}
                </span>
                <span className={styles.says}>{axis.says}</span>
              </li>
            ))}
          </ul>

          <p className={styles.fine}>
            Answered by players after they had played, one answer each, and it
            stands once given. Who said what is never shown.
          </p>
        </>
      ) : (
        <p className={styles.fine}>
          Not enough answers yet. Players rate a game master after they have
          played, and nothing is shown here until {ENOUGH} of them have, because
          one evening that went badly is not a verdict on somebody.
        </p>
      )}
    </section>
  );
}
