"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  bringSheet,
  listParties,
  listSheets,
  takeSheetBack,
  type TableSheet,
} from "@/lib/firebase/party";
import {
  addNote,
  listSessions,
  removeNote,
  syncNotes,
} from "@/lib/firebase/notebook";
import { useSession } from "@/lib/firebase/session";
import { useHydrated } from "@/lib/useHydrated";
import {
  loadCharacter,
  loadCustom,
  sheetFromBuild,
  sheetFromCustom,
} from "@/lib/character";
import { toTableCharacter } from "@/lib/tableSheet";
import type { Character } from "@/data/table";
import type { Party } from "@/lib/party";
import type { PlaySession, SessionNote } from "@/lib/notebook";
import Tracker from "../Tracker";
import Notebook, { type Draft } from "../notebook/Notebook";
import styles from "./Campaign.module.css";

/**
 * A real party's table: its sheets, and its notebook.
 *
 * Members only, and the rules are the enforcement — this component asks and
 * Firestore answers. Somebody who is not at this table gets nothing back from
 * either read, which is why the failure case here is "no table" rather than an
 * error message about permissions.
 *
 * The two halves come from different places on purpose. The tracker runs on
 * sheets players brought, which are snapshots: editing a character in the
 * builder does not change the sheet five other people are looking at
 * mid-session. The notebook runs on the live collection, because a line typed
 * by one player should appear on five other screens as it is typed.
 */
export default function Campaign({ partyId }: { partyId: string }) {
  const { user, profile, loading, configured } = useSession();
  const hydrated = useHydrated();

  const [party, setParty] = useState<Party | null | "missing">(null);
  const [sheets, setSheets] = useState<TableSheet[]>([]);
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [gmNotes, setGmNotes] = useState<SessionNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const reload = useCallback(() => setRound((n) => n + 1), []);

  useEffect(() => {
    if (!configured || !user) return;

    let alive = true;

    listParties()
      .then((all) => {
        if (alive) setParty(all.find((entry) => entry.id === partyId) ?? "missing");
      })
      .catch((problem: Error) => {
        if (!alive) return;
        setError(problem.message);
        setParty("missing");
      });

    return () => {
      alive = false;
    };
  }, [configured, user, partyId]);

  const role = useMemo(() => {
    if (!profile || !party || party === "missing") return null;
    if (party.gmId === profile.uid) return "gm" as const;
    if (party.playerIds.includes(profile.uid)) return "player" as const;
    return null;
  }, [profile, party]);

  useEffect(() => {
    if (!role || !user) return;

    let alive = true;

    (async () => {
      try {
        const [table, nights] = await Promise.all([
          listSheets(partyId),
          listSessions(partyId),
        ]);

        if (!alive) return;
        setSheets(table);
        setSessions(nights);

        const ids = nights.map((night) => night.id);
        const party = await syncNotes(user.uid, partyId, ids, "party");
        if (!alive) return;
        setNotes(party);

        /* The other book, and only for the person it belongs to. A player
           asking for it is refused by the rules, not by this condition. */
        if (role === "gm") {
          const mine = await syncNotes(user.uid, partyId, ids, "gm");
          if (alive) setGmNotes(mine);
        }
      } catch (problem) {
        if (alive) setError((problem as Error).message);
      }
    })();

    return () => {
      alive = false;
    };
  }, [role, user, partyId, round]);

  /* What this browser has, for the "bring one" button. */
  const mine = useMemo(() => {
    if (!hydrated) return null;

    const custom = loadCustom();
    if (custom?.name.trim()) return toTableCharacter("", sheetFromCustom(custom));

    const built = loadCharacter();
    if (built?.choices.details.name?.trim()) {
      return toTableCharacter("", sheetFromBuild(built));
    }

    return null;
  }, [hydrated]);

  const table = useMemo(
    () => sheets.map((sheet) => sheet.character as Character).filter(Boolean),
    [sheets],
  );

  const broughtOne = Boolean(profile && sheets.some((sheet) => sheet.ownerId === profile.uid));

  if (!configured) {
    return (
      <p className={styles.plain}>
        This page is built and waiting on a Firebase project. The tracker and the
        notebook on <Link href="/campaign">the demo</Link> work today.
      </p>
    );
  }

  if (loading || party === null) return <p className={styles.plain}>Looking it up.</p>;

  if (!user) {
    return (
      <div className={styles.gate}>
        <h2 className={styles.gateTitle}>This is somebody&rsquo;s table.</h2>
        <p className={styles.plain}>You have to be at it to see it.</p>
        <Link href="/sign-in" className={styles.primary}>
          Sign in
        </Link>
      </div>
    );
  }

  if (party === "missing" || !role) {
    return (
      <div className={styles.gate}>
        <h2 className={styles.gateTitle}>Not your table.</h2>
        <p className={styles.plain}>
          Either it does not exist or you are not at it, and from out here those
          look the same on purpose.
        </p>
        <Link href="/parties" className={styles.primary}>
          See what is open
        </Link>
      </div>
    );
  }

  const bring = async () => {
    if (!mine || !profile) return;
    setError(null);

    try {
      await bringSheet(partyId, profile.uid, { ...mine, id: profile.uid });
      reload();
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  const takeBack = async () => {
    if (!profile) return;
    setError(null);

    try {
      await takeSheetBack(partyId, profile.uid);
      reload();
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  const write = async (draft: Draft) => {
    if (!profile) return;
    setError(null);

    try {
      await addNote(partyId, draft.sessionId, {
        book: draft.book,
        authorId: profile.uid,
        authorName: profile.username,
        body: draft.body,
        kind: draft.kind,
      });
      reload();
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  const erase = async (noteId: string) => {
    const note = [...notes, ...gmNotes].find((entry) => entry.id === noteId);
    if (!note) return;

    try {
      await removeNote(partyId, note.sessionId, noteId);
      reload();
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.name}>{party.name}</h2>
        <span className={styles.role}>
          {role === "gm" ? "You run this table" : "You play at this table"}
        </span>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h3 className={styles.blockTitle}>The sheets</h3>
          <span className={styles.quiet}>
            {table.length} of {party.playerIds.length} brought
          </span>
        </div>

        {table.length === 0 ? (
          <p className={styles.plain}>
            Nobody has brought a character yet. Until somebody does there is
            nothing to track.
          </p>
        ) : (
          <Tracker party={table} />
        )}

        {role === "player" ? (
          <div className={styles.bring}>
            {broughtOne ? (
              <>
                <p className={styles.quiet}>
                  Your sheet is at this table. It is a copy, taken when you
                  brought it, so editing the character in the builder will not
                  change it here. Bring it again to update it.
                </p>
                <div className={styles.bringRow}>
                  <button type="button" className={styles.secondary} onClick={bring} disabled={!mine}>
                    Bring it again
                  </button>
                  <button type="button" className={styles.secondary} onClick={takeBack}>
                    Take it back
                  </button>
                </div>
              </>
            ) : mine ? (
              <>
                <p className={styles.quiet}>
                  <strong>{mine.name}</strong> is in the builder on this browser.
                </p>
                <button type="button" className={styles.primary} onClick={bring}>
                  Bring them to this table
                </button>
              </>
            ) : (
              <>
                <p className={styles.quiet}>
                  You have not built a character on this browser yet.
                </p>
                <Link href="/character-builder" className={styles.primary}>
                  Build one
                </Link>
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>The notebook</h3>

        {sessions.length === 0 ? (
          <p className={styles.plain}>
            No sessions yet. The notebook fills in from the first night you play.
          </p>
        ) : (
          <Notebook
            sessions={sessions}
            notes={role === "gm" ? [...notes, ...gmNotes] : notes}
            viewer={{ id: profile!.uid, name: profile!.username, role }}
            onAdd={write}
            onRemove={erase}
          />
        )}
      </section>
    </div>
  );
}
