"use client";

import { useState } from "react";
import { removePlayer, type TableSheet } from "@/lib/firebase/party";
import type { SessionNote } from "@/lib/notebook";
import styles from "./Roster.module.css";

/**
 * Who is at this table, and the game master's one hard control over it.
 *
 * **Names are the awkward part, and the awkwardness is correct.** A game master
 * cannot read player profiles: rule 8 keeps phone numbers and home areas out of
 * everybody's reach but an admin's, and a username sits behind the same wall.
 * So this page knows people by what they have actually handed to the table, in
 * order of how sure it is: the character they brought, then the name they sign
 * notes with, then nothing at all. That last case is real, and it says so
 * rather than inventing something.
 *
 * The button is two steps. Not a modal, not a typed confirmation: removal is
 * meant to be quick, and `/safety` promises it happens immediately and without
 * anybody explaining themselves first. What it must not be is a single
 * mis-tapped button on a phone, and one deliberate second press is the smallest
 * thing that prevents that.
 */
export default function Roster({
  partyId,
  gmId,
  playerIds,
  sheets,
  notes,
  onChange,
}: {
  partyId: string;
  gmId: string;
  playerIds: string[];
  sheets: TableSheet[];
  notes: SessionNote[];
  onChange: (remaining: string[]) => void;
}) {
  /** The uid whose removal has been asked for but not yet confirmed. */
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** The most identifying thing this table actually holds about somebody. */
  const knownAs = (uid: string): { name: string; how: string } => {
    const sheet = sheets.find((entry) => entry.ownerId === uid);
    const character = (sheet?.character as { name?: string } | undefined)?.name;
    if (character) return { name: character, how: "the character they brought" };

    const note = notes.find((entry) => entry.authorId === uid && entry.authorName);
    if (note?.authorName) return { name: note.authorName, how: "the name they write under" };

    return { name: "A player who has brought nothing yet", how: "" };
  };

  const remove = async (uid: string) => {
    setError(null);
    setBusy(uid);

    try {
      const remaining = await removePlayer({ partyId, uid, by: gmId, playerIds });
      onChange(remaining);
      setAsking(null);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.block}>
      <div className={styles.head}>
        <h3 className={styles.title}>Who is at this table</h3>
        <span className={styles.count}>
          {playerIds.length} player{playerIds.length === 1 ? "" : "s"}
        </span>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <ul className={styles.list}>
        {playerIds.map((uid) => {
          const who = knownAs(uid);
          const confirming = asking === uid;

          return (
            <li key={uid} className={styles.person}>
              <div className={styles.who}>
                <span className={styles.name}>{who.name}</span>
                {who.how ? <span className={styles.how}>{who.how}</span> : null}
              </div>

              {confirming ? (
                <div className={styles.confirm}>
                  <p className={styles.warning}>
                    They lose the notebook, the sheets and the group chat
                    straight away, and their character leaves the table with
                    them. It is written down that you did it. You do not have to
                    give a reason.
                  </p>
                  <div className={styles.row}>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => remove(uid)}
                      disabled={busy === uid}
                    >
                      {busy === uid ? "One moment" : "Yes, remove them"}
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setAsking(null)}
                      disabled={busy === uid}
                    >
                      Keep them
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setAsking(uid)}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className={styles.plain}>
        Removing somebody happens the moment you press it. Nobody is asked to
        approve it and you are not asked why first. If a table drops below four
        it goes back to forming and we look for somebody else, and you keep it
        in the meantime.
      </p>
    </section>
  );
}
