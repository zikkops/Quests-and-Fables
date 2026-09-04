"use client";

import { useMemo, useState } from "react";
import {
  KINDS,
  NOTE_LIMIT,
  byRecency,
  byWritten,
  kindLabel,
  searchableText,
  tagsFrom,
  type Book,
  type NoteKind,
  type PlaySession,
  type SessionNote,
} from "@/lib/notebook";
import { buildIndex, glossary, highlight, search } from "@/lib/search";
import styles from "./Notebook.module.css";

export type Viewer = {
  id: string;
  name: string;
  role: "player" | "gm";
};

export type Draft = {
  sessionId: string;
  book: Book;
  kind: NoteKind;
  body: string;
};

type Props = {
  sessions: PlaySession[];
  notes: SessionNote[];
  viewer: Viewer;
  /** Absent means read only, which is what the party's record is to a GM. */
  onAdd?: (draft: Draft) => void;
  onRemove?: (id: string) => void;
};

const when = (stamp: number) =>
  new Date(stamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * The table's notebook: sessions down the side, the night's entries in the
 * middle, and a search that answers "when did we meet this person".
 *
 * Storage-agnostic on purpose. It is handed notes and hands back drafts, so the
 * same component runs on the demo's local state today and on a Firestore
 * listener the moment parties exist. Everything it derives — the index, the
 * glossary, the hit counts — comes from the notes it was given.
 *
 * Who may write is decided here from the viewer's role and nowhere else in the
 * UI: a game master gets no composer on the party's record, and no amount of
 * clicking produces one. `firestore.rules` is what actually stops them. This is
 * only the part that stops it being confusing.
 */
export default function Notebook({ sessions, notes, viewer, onAdd, onRemove }: Props) {
  const ordered = useMemo(() => [...sessions].sort(byRecency), [sessions]);
  const openSession = ordered.find((s) => s.open) ?? ordered[0];

  const [book, setBook] = useState<Book>("party");
  const [sessionId, setSessionId] = useState(openSession?.id ?? "");
  const [query, setQuery] = useState("");

  /* A player has one book. Asking for the other is not a state worth keeping,
     so it is corrected on the way out rather than stored. */
  const shown: Book = viewer.role === "gm" ? book : "party";
  const searching = query.trim().length > 0;

  const inBook = useMemo(() => notes.filter((note) => note.book === shown), [notes, shown]);

  const index = useMemo(
    () => buildIndex(inBook.map((note) => ({ id: note.id, text: searchableText(note) }))),
    [inBook],
  );

  const hits = useMemo(() => (searching ? search(index, query) : []), [index, query, searching]);
  const hitIds = useMemo(() => new Set(hits.map((hit) => hit.id)), [hits]);

  /* The other book's hit count, so a game master searching the party's record
     can see there is more of it next door rather than having to guess. */
  const otherHits = useMemo(() => {
    if (viewer.role !== "gm" || !searching) return 0;

    const other = notes.filter((note) => note.book !== shown);
    const otherIndex = buildIndex(
      other.map((note) => ({ id: note.id, text: searchableText(note) })),
    );

    return search(otherIndex, query).length;
  }, [notes, shown, query, searching, viewer.role]);

  /* Authors are indexed so you can search by who wrote something, but they are
     not terminology: every note has one, so they would top the list forever. */
  const authors = useMemo(
    () => new Set(inBook.map((note) => note.authorName.toLowerCase())),
    [inBook],
  );

  const terms = useMemo(() => glossary(index, 3, authors).slice(0, 8), [index, authors]);

  const results = useMemo(() => {
    const rank = new Map(hits.map((hit, at) => [hit.id, at]));
    return inBook
      .filter((note) => hitIds.has(note.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }, [inBook, hitIds, hits]);

  const current = inBook.filter((note) => note.sessionId === sessionId).sort(byWritten);
  const session = ordered.find((s) => s.id === sessionId);

  const countIn = (id: string) =>
    inBook.filter((note) => note.sessionId === id && (!searching || hitIds.has(note.id))).length;

  const mayWrite = shown === "gm" ? viewer.role === "gm" : viewer.role === "player";

  const openAt = (id: string) => {
    setQuery("");
    setSessionId(id);
  };

  return (
    <section className={styles.shell} aria-label="The table's notebook">
      <header className={styles.bar}>
        <div className={styles.searchWrap}>
          <label className={styles.searchLabel} htmlFor="notebook-search">
            Search this campaign
          </label>
          <input
            id="notebook-search"
            type="search"
            className={styles.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A name, a place, a word you half remember"
            autoComplete="off"
          />
        </div>

        {viewer.role === "gm" ? (
          <div className={styles.books} role="group" aria-label="Which book">
            {(["party", "gm"] as const).map((which) => (
              <button
                key={which}
                type="button"
                aria-pressed={shown === which}
                className={shown === which ? `${styles.book} ${styles.bookOn}` : styles.book}
                onClick={() => setBook(which)}
              >
                {which === "party" ? "The party's record" : "Your own notes"}
                {searching && which !== shown && otherHits > 0 ? (
                  <span className={styles.bookCount}>{otherHits}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.only}>The game master reads this and cannot write in it.</p>
        )}
      </header>

      {terms.length > 0 && !searching ? (
        <div className={styles.terms}>
          <span className={styles.termsLabel}>Keeps coming up</span>
          {terms.map((term) => (
            <button
              key={term}
              type="button"
              className={styles.term}
              onClick={() => setQuery(term)}
            >
              {term}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.body}>
        <nav className={styles.rail} aria-label="Sessions">
          {ordered.map((one) => {
            const count = countIn(one.id);
            const chosen = !searching && one.id === sessionId;

            return (
              <button
                key={one.id}
                type="button"
                aria-current={chosen ? "true" : undefined}
                className={chosen ? `${styles.session} ${styles.sessionOn}` : styles.session}
                onClick={() => openAt(one.id)}
              >
                <span className={styles.sessionNumber}>
                  Session {one.number}
                  {one.open ? <span className={styles.live}>open</span> : null}
                </span>
                <span className={styles.sessionTitle}>{one.title}</span>
                <span className={styles.sessionMeta}>
                  {when(one.playedOn)}
                  {" · "}
                  {searching
                    ? `${count} match${count === 1 ? "" : "es"}`
                    : `${count} note${count === 1 ? "" : "s"}`}
                </span>
              </button>
            );
          })}
        </nav>

        <div className={styles.main}>
          {searching ? (
            <Results results={results} sessions={ordered} query={query} onOpen={openAt} />
          ) : (
            <>
              <div className={styles.sessionHead}>
                <h3 className={styles.sessionHeading}>
                  {session ? `Session ${session.number} · ${session.title}` : "No sessions yet"}
                </h3>
                {session?.open ? (
                  <span className={styles.openTag}>Still being written in</span>
                ) : null}
              </div>

              {current.length === 0 ? (
                <p className={styles.empty}>Nothing written down for this one yet.</p>
              ) : (
                <ol className={styles.notes}>
                  {current.map((note) => (
                    <Entry
                      key={note.id}
                      note={note}
                      query=""
                      mine={note.authorId === viewer.id}
                      onRemove={onRemove}
                    />
                  ))}
                </ol>
              )}

              {session ? (
                <Composer
                  session={session}
                  book={shown}
                  mayWrite={mayWrite && Boolean(onAdd)}
                  role={viewer.role}
                  onAdd={onAdd}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   One entry
   ========================================================================== */

function Entry({
  note,
  query,
  mine,
  onRemove,
}: {
  note: SessionNote;
  query: string;
  mine: boolean;
  onRemove?: (id: string) => void;
}) {
  const runs = query ? highlight(note.body, query) : [{ text: note.body, hit: false }];

  return (
    <li className={styles.note}>
      <div className={styles.noteHead}>
        <span className={styles.kind} data-kind={note.kind}>
          {kindLabel(note.kind)}
        </span>
        <span className={styles.author}>{note.authorName}</span>
        {mine && onRemove ? (
          <button
            type="button"
            className={styles.remove}
            onClick={() => onRemove(note.id)}
            aria-label="Delete this note of yours"
          >
            Delete
          </button>
        ) : null}
      </div>

      <p className={styles.text}>
        {runs.map((run, at) =>
          run.hit ? (
            <mark key={at} className={styles.mark}>
              {run.text}
            </mark>
          ) : (
            <span key={at}>{run.text}</span>
          ),
        )}
      </p>
    </li>
  );
}

/* ==========================================================================
   Searching
   ========================================================================== */

function Results({
  results,
  sessions,
  query,
  onOpen,
}: {
  results: SessionNote[];
  sessions: PlaySession[];
  query: string;
  onOpen: (sessionId: string) => void;
}) {
  /* Grouped by session, because "when did we meet this person" is the question
     behind almost every search anyone runs here. */
  const grouped = sessions
    .map((session) => ({
      session,
      found: results.filter((note) => note.sessionId === session.id),
    }))
    .filter((group) => group.found.length > 0);

  if (results.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing for <strong>{query}</strong> in this book. Try less of the word: the
        search matches from the front, so <em>ced</em> finds <em>cedar</em>.
      </p>
    );
  }

  return (
    <div className={styles.results}>
      <p className={styles.resultCount}>
        {results.length} {results.length === 1 ? "note" : "notes"} across{" "}
        {grouped.length} {grouped.length === 1 ? "session" : "sessions"}
      </p>

      {grouped.map(({ session, found }) => (
        <section key={session.id} className={styles.group}>
          <button type="button" className={styles.groupHead} onClick={() => onOpen(session.id)}>
            Session {session.number} · {session.title}
            <span className={styles.groupCount}>{found.length}</span>
          </button>

          <ol className={styles.notes}>
            {found.map((note) => (
              <Entry key={note.id} note={note} query={query} mine={false} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ==========================================================================
   Writing something down
   ========================================================================== */

function Composer({
  session,
  book,
  mayWrite,
  role,
  onAdd,
}: {
  session: PlaySession;
  book: Book;
  mayWrite: boolean;
  role: Viewer["role"];
  onAdd?: (draft: Draft) => void;
}) {
  const [kind, setKind] = useState<NoteKind>("note");
  const [body, setBody] = useState("");

  if (!mayWrite) {
    return (
      <p className={styles.locked}>
        {role === "gm"
          ? "This is the party's record. You can read every word of it and write none of them. What they think happened is theirs to write down."
          : "Only the players at this table write in here."}
      </p>
    );
  }

  if (!session.open) {
    return (
      <p className={styles.locked}>
        Session {session.number} is closed. Notes go in the session you are playing.
      </p>
    );
  }

  const tags = tagsFrom(body);
  const left = NOTE_LIMIT - body.length;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || !onAdd) return;

    onAdd({ sessionId: session.id, book, kind, body: text.slice(0, NOTE_LIMIT) });
    setBody("");
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <div className={styles.kinds} role="group" aria-label="What kind of note">
        {KINDS.map((one) => (
          <button
            key={one.key}
            type="button"
            aria-pressed={kind === one.key}
            title={one.hint}
            className={kind === one.key ? `${styles.kindPick} ${styles.kindOn}` : styles.kindPick}
            onClick={() => setKind(one.key)}
          >
            {one.label}
          </button>
        ))}
      </div>

      <textarea
        className={styles.input}
        value={body}
        maxLength={NOTE_LIMIT}
        rows={3}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What just happened. Use @ for a person and # for a thread you want to find again."
        aria-label="Your note"
      />

      <div className={styles.composerFoot}>
        <span className={styles.tagLine}>
          {tags.length > 0 ? (
            <>
              Tagged{" "}
              {tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </>
          ) : book === "gm" ? (
            "Yours alone. Nobody at this table can open this book."
          ) : (
            "Everything written here is visible to the whole table."
          )}
          {left < 200 ? <span className={styles.left}>{left} left</span> : null}
        </span>

        <button type="submit" className={styles.add} disabled={body.trim().length === 0}>
          Add to session {session.number}
        </button>
      </div>
    </form>
  );
}
