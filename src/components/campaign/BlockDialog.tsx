"use client";

import { useState } from "react";
import { blockSomebody } from "@/lib/firebase/block";
import styles from "./ReportDialog.module.css";

/**
 * Never be put at a table with this person again.
 *
 * The copy does the work here, because "block" means something different on
 * every site somebody has used before and the version here is unusually narrow.
 * Three things have to be said plainly, and all three are said:
 *
 * **It is about the future, not tonight.** It does not remove anybody from a
 * party either of you is already at. Somebody reaching for this after a bad
 * evening will otherwise believe they have dealt with tonight and find out
 * next Tuesday that they have not.
 *
 * **They are never told.** That is the point of it, and saying so is what
 * makes it usable by the people who most need it.
 *
 * **It can be lifted.** A block is a decision about future evenings rather than
 * a verdict, and somebody weighing one up should know it is not permanent.
 */
export default function BlockDialog({
  by,
  who,
  name,
  onClose,
  onBlocked,
}: {
  by: string;
  who: string;
  /** What they are known as here: a character, or the name they write under. */
  name: string;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const block = async () => {
    setError(null);
    setBusy(true);

    try {
      await blockSomebody({ by, who, name });
      setDone(true);
      onBlocked();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.panel} onClick={(event) => event.stopPropagation()}>
        {done ? (
          <>
            <h2 className={styles.title}>Done. You will not be seated together.</h2>
            <p className={styles.body}>
              <strong>{name}</strong> will never be put in a party with you
              again, and they are not told. You can lift it from your account
              whenever you like.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Never be seated with {name} again?</h2>

            <p className={styles.body}>
              We will not put the two of you in a party together, now or later.
              They are <strong>never told</strong>, and nothing anywhere says
              why a table was not offered to somebody.
            </p>

            <p className={styles.body}>
              <strong>This does not change tonight.</strong> It does not take
              them out of a party you are both already at. If something happened
              that needs dealing with now, report it, or say so to your game
              master, who can remove somebody from the table outright.
            </p>

            <p className={styles.body}>
              You can lift this from your account at any point.
            </p>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={block}
                disabled={busy}
              >
                {busy ? "One moment" : "Block them"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
                disabled={busy}
              >
                Never mind
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
