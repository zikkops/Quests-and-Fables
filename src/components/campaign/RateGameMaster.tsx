"use client";

import { useEffect, useState } from "react";
import { alreadyRated, rateGameMaster } from "@/lib/firebase/rating";
import { AXES, ENOUGH, type AxisKey } from "@/lib/rating";
import styles from "./Rate.module.css";

/**
 * What this table says about the game master who ran it.
 *
 * Four questions, no star score, and no comment box. A single number invites a
 * scoreboard and collects nothing anybody can act on; written notes about a
 * named person on a public page is the part that turns a rating into a pile-on.
 * Anything that needs saying in words is a report, which already exists and
 * goes to a person rather than to the internet.
 *
 * The card says out loud that the answers are public before anybody answers,
 * and that a rating stands once given. Both are true and both change what
 * somebody is willing to press, so hiding either would be collecting the answer
 * under false pretences.
 */
export default function RateGameMaster({
  partyId,
  gmId,
  uid,
}: {
  partyId: string;
  gmId: string;
  uid: string;
}) {
  const [done, setDone] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<AxisKey, boolean | null>>({
    prepared: null,
    fair: null,
    safe: null,
    again: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    alreadyRated(gmId, uid)
      .then((yes) => {
        if (alive) setDone(yes);
      })
      /* Not knowing is not the same as not having rated. Showing the form to
         somebody who has already answered would only earn them a refusal. */
      .catch(() => {
        if (alive) setDone(true);
      });

    return () => {
      alive = false;
    };
  }, [gmId, uid]);

  const complete = AXES.every((axis) => answers[axis.key] !== null);

  const send = async () => {
    if (!complete) return;
    setError(null);
    setBusy(true);

    try {
      await rateGameMaster({
        gmId,
        uid,
        partyId,
        answers: {
          prepared: answers.prepared === true,
          fair: answers.fair === true,
          safe: answers.safe === true,
          again: answers.again === true,
        },
      });
      setDone(true);
      setOpen(false);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done === null) return null;

  if (done) {
    return (
      <section className={styles.block}>
        <h3 className={styles.title}>You have rated your game master</h3>
        <p className={styles.plain}>
          It counts towards what this game master shows publicly, and it stands.
          If something happened that needs saying in words, that is a report and
          it goes to a person rather than onto a page.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.block}>
      <div className={styles.head}>
        <h3 className={styles.title}>Rate your game master</h3>
        <span className={styles.count}>Once, and it stands</span>
      </div>

      <p className={styles.plain}>
        Four questions about the person who ran this table.{" "}
        <strong>The totals are public</strong>, shown on the tables they run, and
        nothing appears at all until {ENOUGH} people have answered. Which of you
        said what is never shown, though at a table of four you should assume
        they can guess. There is no comment box on purpose.
      </p>

      {open ? (
        <>
          <ul className={styles.questions}>
            {AXES.map((axis) => (
              <li key={axis.key} className={styles.question}>
                <span className={styles.ask}>{axis.ask}</span>
                <div className={styles.row}>
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      className={
                        answers[axis.key] === value ? styles.chosen : styles.choice
                      }
                      aria-pressed={answers[axis.key] === value}
                      onClick={() =>
                        setAnswers((now) => ({ ...now, [axis.key]: value }))
                      }
                    >
                      {value ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              onClick={send}
              disabled={!complete || busy}
            >
              {busy ? "One moment" : complete ? "Send it, and it stands" : "Answer all four"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Not now
            </button>
          </div>
        </>
      ) : (
        <button type="button" className={styles.secondary} onClick={() => setOpen(true)}>
          Answer the four questions
        </button>
      )}
    </section>
  );
}
