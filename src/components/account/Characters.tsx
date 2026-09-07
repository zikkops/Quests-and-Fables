"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  loadCharacter,
  loadCustom,
  saveCharacter as keepBuildLocally,
  saveCustom as keepCustomLocally,
  sheetFromBuild,
  type CustomCharacter,
} from "@/lib/character";
import type { CharacterDoc } from "@/lib/engine";
import { useHydrated } from "@/lib/useHydrated";
import { createCharacter, deleteCharacter, listCharacters } from "@/lib/firebase/account";
import { CHARACTER_LIMIT, type SavedCharacter } from "@/lib/firebase/schema";
import styles from "./Account.module.css";
import roster from "./Characters.module.css";

type Props = {
  uid: string;
  count: number;
  /** Re-read the profile, because the count on it just moved. */
  onChanged: () => Promise<void>;
};

/** What the builder has left on this device, if anything. */
type Local =
  | { kind: "srd"; name: string; doc: CharacterDoc }
  | { kind: "custom"; name: string; doc: CustomCharacter };

/**
 * Every named draft on this device, not just one.
 *
 * This used to return the custom sheet if there was one and the built character
 * otherwise, which meant somebody who had used both builders could never save
 * the second: the card offered the custom one and there was no way to reach the
 * other except by clearing it. The two builders keep separate drafts, so this
 * reports separately too.
 */
function localDrafts(): Local[] {
  const drafts: Local[] = [];

  const built = loadCharacter();
  if (built && built.choices.details.name?.trim()) {
    drafts.push({ kind: "srd", name: sheetFromBuild(built).name, doc: built });
  }

  const custom = loadCustom();
  if (custom && custom.name.trim()) {
    drafts.push({ kind: "custom", name: custom.name.trim(), doc: custom });
  }

  return drafts;
}

const when = (stamp: number) =>
  new Date(stamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Five characters, and what to do about the sixth.
 *
 * The builder has never needed an account and still does not: it keeps whatever
 * you are working on in this browser. This card is the bridge. It offers to put
 * that draft on the account, and it can put a saved one back on the device so
 * the builder can open it. Nothing is synced silently in either direction,
 * because a player who edits the same character on a phone and a laptop should
 * be told which copy won rather than quietly losing a night of work.
 *
 * The limit is enforced three times over: the button disables, createCharacter
 * throws before writing, and the rules refuse the write. Only the last of those
 * is a guarantee. The other two exist so the message can be a sentence rather
 * than a permission error.
 */
export default function Characters({ uid, count, onChanged }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();

  const [saved, setSaved] = useState<SavedCharacter[] | null>(null);
  const [round, setRound] = useState(0);
  /* Which drafts have been put on the account this visit, by kind. */
  const [kept, setKept] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* localStorage does not exist on the server, so the draft is read only once
     the browser has taken over. See useHydrated for why this is not an effect. */
  const drafts = useMemo(
    () => (hydrated ? localDrafts().filter((d) => !kept.includes(d.kind)) : []),
    [hydrated, kept],
  );

  /* Fetching the list is the effect. Bumping `round` is how a write asks for
     it again, which keeps the fetch in one place rather than in every handler. */
  useEffect(() => {
    let alive = true;

    listCharacters(uid)
      .then((list) => {
        if (alive) setSaved(list);
      })
      .catch((problem: Error) => {
        if (!alive) return;
        setError(problem.message);
        setSaved([]);
      });

    return () => {
      alive = false;
    };
  }, [uid, round]);

  const full = count >= CHARACTER_LIMIT;

  const keep = async (draft: Local) => {
    setError(null);
    setBusy(true);

    try {
      await createCharacter(uid, { name: draft.name, kind: draft.kind, doc: draft.doc });
      setKept((done) => [...done, draft.kind]);
      setRound((n) => n + 1);
      await onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /*
    A custom sheet opens in the custom editor. It used to put the character on
    the device correctly and then send everybody to /character-builder, which
    reads the *other* draft: you asked for your homebrew Battle Master and got
    whichever SRD character was last in the builder, with no indication that
    anything had gone wrong.
  */
  const open = (entry: SavedCharacter) => {
    if (entry.kind === "custom") {
      keepCustomLocally(entry.doc as CustomCharacter);
      router.push("/character-builder/custom");
      return;
    }

    keepBuildLocally(entry.doc as CharacterDoc);
    router.push("/character-builder");
  };

  const remove = async (entry: SavedCharacter) => {
    setError(null);
    setBusy(true);

    try {
      await deleteCharacter(uid, entry.id);
      setRound((n) => n + 1);
      await onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${styles.card} ${styles.wide}`}>
      <div className={roster.head}>
        <h2 className={styles.cardTitle}>Your characters</h2>
        <span className={full ? `${roster.tally} ${roster.fullTally}` : roster.tally}>
          {count} of {CHARACTER_LIMIT}
        </span>
      </div>

      {saved === null ? (
        <p className={styles.cardBody}>Fetching them.</p>
      ) : saved.length === 0 ? (
        <p className={styles.cardBody}>
          None saved yet. Build one and it appears here, and the builder itself
          never asks you to sign in.
        </p>
      ) : (
        <ul className={roster.list}>
          {saved.map((entry) => (
            <li key={entry.id} className={roster.row}>
              <div className={roster.who}>
                <span className={roster.name}>{entry.name}</span>
                <span className={roster.meta}>
                  {entry.kind === "custom" ? "Typed in by hand" : "Built from the SRD"}
                  {" · saved "}
                  {when(entry.updatedAt)}
                </span>
              </div>

              <div className={roster.rowActions}>
                <button
                  type="button"
                  className={roster.small}
                  onClick={() => open(entry)}
                  disabled={busy}
                >
                  Open in the builder
                </button>
                <button
                  type="button"
                  className={`${roster.small} ${roster.remove}`}
                  onClick={() => remove(entry)}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      {drafts.map((draft) => (
        <div key={draft.kind} className={roster.draft}>
          <p className={roster.draftTitle}>
            On this device
            {draft.kind === "custom" ? ", typed in by hand" : ", built from the SRD"}
          </p>
          <p className={styles.cardBody}>
            <strong>{draft.name}</strong> is in the{" "}
            {draft.kind === "custom" ? "blank sheet" : "builder"} on this browser
            and is not on your account.
          </p>
          <button
            type="button"
            className={styles.primary}
            onClick={() => keep(draft)}
            disabled={busy || full}
          >
            {full ? "Five is the limit" : busy ? "Saving…" : "Save it to my account"}
          </button>
        </div>
      ))}

      <div className={roster.rowActions}>
        <Link href="/character-builder" className={styles.secondary}>
          {saved && saved.length > 0 ? "Build another" : "Build one"}
        </Link>
        <Link href="/character-builder/custom" className={styles.secondary}>
          Blank sheet
        </Link>
      </div>

      {full ? (
        <p className={styles.fine}>
          Five is the limit. Delete one to make room, and open it in the builder
          first if you want to keep a copy on this device, because a deletion
          here is final.
        </p>
      ) : null}
    </section>
  );
}
