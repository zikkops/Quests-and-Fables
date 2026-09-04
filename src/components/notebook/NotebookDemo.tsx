"use client";

import { useState } from "react";
import { DEMO_NOTES, DEMO_SESSIONS } from "@/data/notebook";
import { tagsFrom, type SessionNote } from "@/lib/notebook";
import Notebook, { type Draft, type Viewer } from "./Notebook";
import styles from "./NotebookDemo.module.css";

/**
 * The notebook, working, on made up data — the same trick `/campaign` already
 * plays with the tracker.
 *
 * It carries one control the real thing will not have: a switch between sitting
 * at the table as a player and sitting behind the screen as its game master.
 * The whole point of the feature is that those two people see different books,
 * and that is invisible unless you can stand in both places. Everything else
 * here is real — the search, the index, the glossary, adding and deleting.
 *
 * Nothing is saved. Reload and the three sessions are back as they were, which
 * is the honest behaviour for a demo: a notebook that quietly kept what you
 * typed would be claiming to be a product.
 */

const PLAYER: Viewer = { id: "orla", name: "orla", role: "player" };
const MASTER: Viewer = { id: "maret", name: "maret", role: "gm" };

let counter = 0;

export default function NotebookDemo() {
  const [asMaster, setAsMaster] = useState(false);
  const [notes, setNotes] = useState<SessionNote[]>(DEMO_NOTES);

  const viewer = asMaster ? MASTER : PLAYER;

  const add = (draft: Draft) => {
    counter += 1;
    /* The demo has no clock worth trusting and no server. A note written now
       sorts after everything already there, which is all `createdAt` is for. */
    const written = Date.now();

    setNotes((current) => [
      ...current,
      {
        id: `local-${counter}`,
        sessionId: draft.sessionId,
        book: draft.book,
        authorId: viewer.id,
        authorName: viewer.name,
        body: draft.body,
        kind: draft.kind,
        tags: tagsFrom(draft.body),
        createdAt: written,
        updatedAt: written,
      },
    ]);
  };

  const remove = (id: string) => setNotes((current) => current.filter((n) => n.id !== id));

  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <h2 className={styles.title}>One notebook for the table</h2>
        <p className={styles.lede}>
          Recaps, people met, places heard of, what the party is carrying and
          the threads nobody has pulled yet. Written by the players, session by
          session, and searchable across all of them. This one works. Write in
          it, search it, and sit in the other chair to see what changes.
        </p>
      </div>

      <div className={styles.seat}>
        <span className={styles.seatLabel}>You are sitting</span>

        <div className={styles.switch} role="group" aria-label="Where you are sitting">
          <button
            type="button"
            aria-pressed={!asMaster}
            className={!asMaster ? `${styles.side} ${styles.sideOn}` : styles.side}
            onClick={() => setAsMaster(false)}
          >
            At the table, as Orla
          </button>
          <button
            type="button"
            aria-pressed={asMaster}
            className={asMaster ? `${styles.side} ${styles.sideOn}` : styles.side}
            onClick={() => setAsMaster(true)}
          >
            Behind the screen
          </button>
        </div>

        <p className={styles.seatNote}>
          {asMaster
            ? "You can read every word the party has written and add none of it. Your own book is next to theirs, and they cannot open it."
            : "You write in the party's record. So do the other players. The game master reads it and cannot touch it, and has a book of their own you will never see."}
        </p>
      </div>

      <Notebook
        sessions={DEMO_SESSIONS}
        notes={notes}
        viewer={viewer}
        onAdd={add}
        onRemove={remove}
      />
    </div>
  );
}
