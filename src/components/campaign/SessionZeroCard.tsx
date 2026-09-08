"use client";

import { useEffect, useState } from "react";
import {
  saveSessionZero,
  signSessionZero,
  watchSessionZero,
} from "@/lib/firebase/agreement";
import {
  agreedCount,
  hasAgreed,
  SESSION_ZERO,
  sessionZeroEmpty,
  EMPTY_SESSION_ZERO,
  type SessionZero,
} from "@/lib/party";
import styles from "./SessionZero.module.css";

/**
 * Session Zero: the conversation every table is told to have and most skip.
 *
 * Two things are load bearing here and neither is the form.
 *
 * **A game master reads it and cannot write it.** That is rule 9 applied to an
 * agreement rather than a record, and it is enforced in `firestore.rules`, not
 * by hiding the textareas. What this component owes them is the honest reason
 * why, in a sentence, rather than a disabled field with no explanation.
 *
 * **A signature is dated, not ticked.** Six people agree, one of them rewrites
 * the limits a fortnight later, and a tick would leave five agreements standing
 * under a sentence nobody else has read. So a signature carries the moment it
 * was given and goes stale the moment the words move. Saying "four of five
 * agreed to this wording" is worth something. Saying "four of five agreed to
 * something, once" is not.
 */
export default function SessionZeroCard({
  partyId,
  uid,
  playerIds,
  role,
}: {
  partyId: string;
  uid: string;
  playerIds: string[];
  role: "player" | "gm";
}) {
  const [zero, setZero] = useState<SessionZero>(EMPTY_SESSION_ZERO);
  const [open, setOpen] = useState(false);
  /* The prompt being edited, and the text in the box. Null means nothing is. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    Live, because the whole point is six people filling this in together in one
    room. Two of them are typing, and without a listener the third overwrites
    the second and nobody sees it happen.
  */
  useEffect(() => watchSessionZero(partyId, setZero), [partyId]);

  const empty = sessionZeroEmpty(zero);
  const agreed = agreedCount(zero, playerIds);
  const mine = hasAgreed(zero, uid);
  const canWrite = role === "player";

  const save = async (key: string) => {
    setError(null);
    setBusy(true);

    try {
      await saveSessionZero(partyId, uid, key, draft);
      setEditing(null);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    setError(null);
    setBusy(true);

    try {
      await signSessionZero(partyId, uid);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.block}>
      <div className={styles.head}>
        <h3 className={styles.title}>Session Zero</h3>
        <span className={styles.count}>
          {empty
            ? "Not started"
            : `${agreed} of ${playerIds.length} agreed to this wording`}
        </span>
      </div>

      {empty ? (
        <p className={styles.plain}>
          The short conversation before the first night: what kind of game this
          is, what everybody came for, what does not happen here, and what you
          do when one of you cannot make a Tuesday. The tables that have it
          survive. Most skip it because nobody remembers to.
        </p>
      ) : null}

      {!open && !empty ? (
        <ul className={styles.summary}>
          {SESSION_ZERO.map((prompt) => {
            const answer = (zero.answers[prompt.key] ?? "").trim();
            return (
              <li key={prompt.key} className={styles.line}>
                <span className={styles.lineTitle}>{prompt.title}</span>
                <span className={answer ? styles.lineBody : styles.lineEmpty}>
                  {answer || "Not agreed yet"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {open ? (
        <ol className={styles.prompts}>
          {SESSION_ZERO.map((prompt) => {
            const answer = (zero.answers[prompt.key] ?? "").trim();
            const editingThis = editing === prompt.key;

            return (
              <li key={prompt.key} className={styles.prompt}>
                <h4 className={styles.promptTitle}>{prompt.title}</h4>
                <p className={styles.ask}>{prompt.ask}</p>
                <p className={styles.hint}>{prompt.hint}</p>

                {editingThis ? (
                  <>
                    <textarea
                      className={styles.box}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={3}
                      maxLength={1200}
                      autoFocus
                      aria-label={prompt.ask}
                    />
                    <div className={styles.row}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => save(prompt.key)}
                        disabled={busy}
                      >
                        {busy ? "One moment" : "Save what you agreed"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => setEditing(null)}
                        disabled={busy}
                      >
                        Leave it
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={answer ? styles.answer : styles.unanswered}>
                      {answer || "Nothing written down yet."}
                    </p>
                    {canWrite ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => {
                          setEditing(prompt.key);
                          setDraft(answer);
                        }}
                      >
                        {answer ? "Change it" : "Write it down"}
                      </button>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.row}>
        <button type="button" className={styles.secondary} onClick={() => setOpen((now) => !now)}>
          {open ? "Close it" : empty ? "Start it" : "Open it"}
        </button>

        {canWrite && !empty ? (
          <button
            type="button"
            className={mine ? styles.secondary : styles.primary}
            onClick={sign}
            disabled={busy || mine}
          >
            {mine ? "You have agreed to this" : "This is what we agreed"}
          </button>
        ) : null}
      </div>

      {canWrite && !empty && !mine && zero.changedAt > 0 ? (
        <p className={styles.stale}>
          This changed after you last agreed to it. Read it again before you say
          so.
        </p>
      ) : null}

      {role === "gm" ? (
        <p className={styles.gmNote}>
          You can read this and you cannot edit it, on purpose. It is the one
          thing a player can point at when they say that is not what we agreed,
          and it stops being that the moment the person running the game can
          reword it. Say your piece in the room and let them write it down.
        </p>
      ) : null}
    </section>
  );
}
