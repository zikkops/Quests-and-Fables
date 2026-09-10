"use client";

import { useState } from "react";
import { markAttendance } from "@/lib/firebase/notebook";
import {
  ATTENDANCE,
  attendanceOf,
  markOf,
  type Attendance as Marks,
  type Attended,
  type WithAttendance,
} from "@/lib/attendance";
import styles from "./Campaign.module.css";

type Props = {
  partyId: string;
  session: WithAttendance;
  /** uid to username, for everybody at the table. */
  names: { uid: string; name: string }[];
  /** Only a game master may mark it. Everybody else is reading. */
  canMark: boolean;
  /** Every session, for the quiet record next to each name. */
  sessions: WithAttendance[];
  onChanged: () => void;
};

/**
 * The register for one night.
 *
 * The game master marks it, because they are the person in the room. Everybody
 * at the table can read it, because they were also in the room and it is not
 * news to them — what nobody gets is a figure on somebody's profile, or a
 * filter that quietly drops a person out of matching. See
 * `src/lib/attendance.ts` for why that line is drawn where it is.
 *
 * Marks save one at a time and immediately. A register with a save button is a
 * register that gets half filled in and abandoned when somebody's lift arrives.
 */
export default function Attendance({
  partyId,
  session,
  names,
  canMark,
  sessions,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mark = async (uid: string, how: Attended) => {
    setError(null);
    setBusy(uid);

    try {
      const next: Marks = { ...(session.attendance ?? {}) };

      /* Pressing the mark somebody already has takes it off again, so a
         mis-tap is one press to undo rather than a wrong answer left standing
         because there is no way back to "not filled in". */
      if (next[uid] === how) delete next[uid];
      else next[uid] = how;

      await markAttendance(partyId, session.id, next);
      onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const filled = names.filter((one) => markOf(session, one.uid) !== "unmarked").length;

  return (
    <section className={styles.register}>
      <div className={styles.registerHead}>
        <h3 className={styles.blockTitle}>Who was here</h3>
        <span className={styles.quiet}>
          {filled === 0
            ? "Not filled in"
            : `${filled} of ${names.length} marked`}
        </span>
      </div>

      {canMark ? (
        <p className={styles.quiet}>
          Told us in advance is not a no show, and the difference matters more
          than it looks: somebody having a hard month who keeps telling the
          table is doing the right thing.
        </p>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <ul className={styles.registerList}>
        {names.map((one) => {
          const now = markOf(session, one.uid);
          const record = attendanceOf(sessions, one.uid);

          return (
            <li key={one.uid} className={styles.registerRow}>
              <div className={styles.registerWho}>
                <span className={styles.registerName}>{one.name}</span>
                {record.of > 0 ? (
                  <span className={styles.registerRecord}>
                    {record.came} of {record.of} nights
                    {record.excused > 0 ? `, ${record.excused} told us` : ""}
                  </span>
                ) : null}
              </div>

              {canMark ? (
                <div className={styles.marks} role="group" aria-label={one.name}>
                  {ATTENDANCE.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      title={option.hint}
                      aria-pressed={now === option.key}
                      disabled={busy === one.uid}
                      className={
                        now === option.key
                          ? `${styles.mark} ${styles.markOn}`
                          : styles.mark
                      }
                      data-mark={option.key}
                      onClick={() => mark(one.uid, option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={styles.markRead} data-mark={now}>
                  {/* Words, not a dash: rule 15 covers every glyph a visitor reads. */}
                  {now === "unmarked"
                    ? "Not marked"
                    : ATTENDANCE.find((option) => option.key === now)?.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
