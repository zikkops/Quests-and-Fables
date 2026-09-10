"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  bringSheet,
  listParties,
  listSheets,
  markPlaying,
  takeSheetBack,
  type TableSheet,
  listMembers,
} from "@/lib/firebase/party";
import {
  addNote,
  closeNight,
  listSessions,
  openNight,
  removeNote,
  syncNotes,
  watchSession,
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
import ReportDialog from "./ReportDialog";
import Attendance from "./Attendance";
import BlockDialog from "./BlockDialog";
import { byPlayed, type WithAttendance } from "@/lib/attendance";
import RateGameMaster from "./RateGameMaster";
import Roster from "./Roster";
import SessionZeroCard from "./SessionZeroCard";
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
  /** The note somebody is reporting, if any. */
  const [reporting, setReporting] = useState<SessionNote | null>(null);
  /** Who somebody is about to block, and what they know them as. */
  const [blocking, setBlocking] = useState<{ uid: string; name: string } | null>(null);
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  /** Everybody seated here, by name. The only place the table learns usernames. */
  const [members, setMembers] = useState<{ uid: string; name: string; role: string }[]>([]);
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

  /*
    Names for the register. A profile is readable by its owner alone, so the
    member document carries the one thing the rest of the table needs from it.
  */
  useEffect(() => {
    if (!role) return;

    let alive = true;
    listMembers(partyId)
      .then((found) => {
        if (alive) setMembers(found);
      })
      .catch(() => {
        if (alive) setMembers([]);
      });

    return () => {
      alive = false;
    };
  }, [role, partyId, round]);

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

  /*
    The open session, live.

    A notebook nobody else's writing reaches is not shared, it is a diary. Six
    people around one table typing into the same night have to see each other,
    and until now this loaded once and never heard another word: you found out
    what somebody wrote by reloading the page.

    **Only the open session gets a listener, and that is the whole design.**
    `syncNotes` exists because reads are billed per document and a full campaign
    is around 1,500 of them, so history is cached and asked only for what changed.
    Subscribing to every session would throw that away and hold a listener on
    six weeks of nights nobody is writing in. The night in progress is the only
    one that moves.

    Both books are watched for a game master. The rules refuse a player the
    second query rather than this condition doing it, but asking for something
    that will be refused is a permission error in the console and a listener
    that never fires, so the condition is here as well.
  */
  const openSession = useMemo(
    () => sessions.find((night) => night.open) ?? null,
    [sessions],
  );

  useEffect(() => {
    if (!role || !openSession) return;

    /* Replace this session's notes in that book, leave every other night's
       alone. The snapshot is the truth for the night it covers and says
       nothing about the rest. */
    const merge = (book: "party" | "gm") =>
      (live: SessionNote[]) => {
        const set = book === "gm" ? setGmNotes : setNotes;
        set((current) => [
          ...current.filter(
            (note) => !(note.sessionId === openSession.id && note.book === book),
          ),
          ...live,
        ]);
      };

    const stop = [watchSession(partyId, openSession.id, "party", merge("party"))];
    if (role === "gm") {
      stop.push(watchSession(partyId, openSession.id, "gm", merge("gm")));
    }

    return () => stop.forEach((unsubscribe) => unsubscribe());
  }, [role, partyId, openSession]);

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

  /*
    Start tonight, and say so on the party if this is the first one.

    The two are one action to a game master: they are sitting down to play. The
    order matters only in that the night is the thing they asked for, so a
    refused status write must not lose it.
  */
  const startNight = async () => {
    setError(null);

    try {
      await openNight(partyId, "");
      /* Already narrowed to a real party by the guards above. */
      if (party.status === "assigned") await markPlaying(partyId);
      reload();
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  const endNight = async (sessionId: string) => {
    setError(null);

    try {
      await closeNight(partyId, sessionId);
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

      {profile ? (
        <SessionZeroCard
          partyId={partyId}
          uid={profile.uid}
          playerIds={party.playerIds}
          role={role}
        />
      ) : null}

      {role === "gm" && profile ? (
        <Roster
          partyId={partyId}
          gmId={profile.uid}
          playerIds={party.playerIds}
          sheets={sheets}
          notes={notes}
          onChange={(remaining) => {
            /*
              The party document has already been written. Reflecting it here
              rather than re-reading keeps the page honest in the one second
              that matters, and the next load reads the real thing anyway.
            */
            setParty((now) =>
              now && now !== "missing" ? { ...now, playerIds: remaining } : now,
            );
            setSheets((now) => now.filter((sheet) => party.playerIds.includes(sheet.ownerId)
                                                     && remaining.includes(sheet.ownerId)));
          }}
        />
      ) : null}

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

      {role === "gm" ? (
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h3 className={styles.blockTitle}>Tonight</h3>
            <span className={styles.quiet}>
              {openSession
                ? `Session ${openSession.number} is open`
                : sessions.length === 0
                  ? "No sessions yet"
                  : "Nothing open"}
            </span>
          </div>

          {openSession ? (
            <>
              <p className={styles.quiet}>
                The table is writing into <strong>session {openSession.number}</strong>.
                Close it when you finish and the next one starts fresh.
              </p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => endNight(openSession.id)}
              >
                Close session {openSession.number}
              </button>
            </>
          ) : (
            <>
              <p className={styles.quiet}>
                {sessions.length === 0
                  ? "Open the first night and the notebook starts. It is also what marks this table as one that has played."
                  : "Open the next night when you sit down. The last one stays exactly as it was written."}
              </p>
              <button type="button" className={styles.primary} onClick={startNight}>
                {sessions.length === 0 ? "Start the first night" : "Start the next night"}
              </button>
            </>
          )}
        </section>
      ) : null}

      {sessions.length > 0 ? (
        <Attendance
          partyId={partyId}
          /* Tonight if a night is open, otherwise the last one played. */
          session={(openSession ?? [...sessions].sort(byPlayed)[0]) as WithAttendance}
          /* Players still at the table. Somebody removed keeps their history
             in the map, and is simply no longer somebody to mark. */
          names={members
            .filter((one) => one.role === "player" && party.playerIds.includes(one.uid))
            .map(({ uid, name }) => ({ uid, name }))}
          canMark={role === "gm"}
          sessions={sessions as WithAttendance[]}
          onChanged={reload}
        />
      ) : null}

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
            onReport={setReporting}
            onBlock={(note) => setBlocking({ uid: note.authorId, name: note.authorName })}
          />
        )}
      </section>

      {role === "player" && profile && party.gmId && party.status === "playing" ? (
        <RateGameMaster partyId={partyId} gmId={party.gmId} uid={profile.uid} />
      ) : null}

      {role === "player" && profile && party.gmId ? (
        <p className={styles.quiet}>
          You do not have to play with the same game master again.{" "}
          <button
            type="button"
            className={styles.plainButton}
            onClick={() =>
              setBlocking({ uid: party.gmId as string, name: "your game master" })
            }
          >
            Ask never to be seated with them again
          </button>
          . They are never told, and it does not change this table.
        </p>
      ) : null}

      {blocking && profile ? (
        <BlockDialog
          by={profile.uid}
          who={blocking.uid}
          name={blocking.name}
          onClose={() => setBlocking(null)}
          onBlocked={() => {}}
        />
      ) : null}

      {reporting && profile ? (
        <ReportDialog
          note={reporting}
          reporterId={profile.uid}
          reporterName={profile.username}
          partyId={partyId}
          onClose={() => setReporting(null)}
        />
      ) : null}
    </div>
  );
}
