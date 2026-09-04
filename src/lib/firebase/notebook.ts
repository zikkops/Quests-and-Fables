"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, unavailable } from "./client";
import { withTimeout } from "./reach";
import {
  NOTE_LIMIT,
  tagsFrom,
  type Book,
  type NoteKind,
  type PlaySession,
  type SessionNote,
} from "@/lib/notebook";
import {
  drifted,
  forget,
  mergeNotes,
  plan,
  readCache,
  watermarkOf,
  writeCache,
  type CachedBook,
  type Watermark,
} from "@/lib/notecache";

/**
 * Where the notebook lives, once there is a party to hang it on.
 *
 * ```
 * parties/{partyId}/
 *   members/{uid}              role: "player" | "gm"
 *   sessions/{sessionId}       number, title, playedOn, open
 *     notes/{noteId}           book, authorId, authorName, body, kind, tags
 * ```
 *
 * **One document per note, not one per session.** A session document that six
 * people append to is one document taking six people's writes, and Firestore
 * sustains about one write a second on a single document. Separate notes never
 * contend, arrive live one at a time, and carry their own author — which is
 * what makes "the game master may not write here" enforceable at all.
 *
 * The cost of that choice is search: there is no full-text index, and paying a
 * document read per keystroke would be absurd. So the party is read once and
 * indexed in the browser (`src/lib/search.ts`).
 *
 * "Read once" is doing real work in that sentence. Reads are billed per
 * document, so a full campaign load is 1,500 of them every time somebody opens
 * the notebook, and six players doing that daily would eat a free tier by
 * themselves. `syncNotes` is the answer: everything is cached locally and each
 * session is asked only for what changed since the last look, which for a
 * session played six weeks ago is nothing. See `src/lib/notecache.ts`.
 *
 * ⚠️ Nothing calls this yet. Parties, partys and membership are Phase 3, and
 * a notebook cannot exist before the party whose notebook it is. It is written
 * now because the rules and the shape had to be decided together, and because
 * the demo on `/party` runs the same component against the same types.
 */

export const NOTEBOOK_PATHS = {
  members: (partyId: string) => `parties/${partyId}/members`,
  sessions: (partyId: string) => `parties/${partyId}/sessions`,
  notes: (partyId: string, sessionId: string) =>
    `parties/${partyId}/sessions/${sessionId}/notes`,
} as const;

function database() {
  const instance = db();
  if (!instance) throw new Error(unavailable());
  return instance;
}

/* ==========================================================================
   Reading
   ========================================================================== */

export async function listSessions(partyId: string): Promise<PlaySession[]> {
  const snapshot = await withTimeout(getDocs(
    query(collection(database(), NOTEBOOK_PATHS.sessions(partyId)), orderBy("number", "desc")),
  ));

  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as PlaySession);
}

/**
 * Every note in one book, across every session, read fresh.
 *
 * ⚠️ Prefer `syncNotes`. This reads every document every time, which is the
 * thing the cache exists to stop. It stays because there are honest uses for
 * it — an export, a repair, a test — and because `syncNotes` falls back to
 * exactly this shape for a session it has never seen.
 *
 * A game master calls it twice; a player only ever gets one answer, because the
 * rules refuse them the other.
 */
export async function listNotes(
  partyId: string,
  sessionIds: string[],
  book: Book,
): Promise<SessionNote[]> {
  const instance = database();

  const perSession = await Promise.all(
    sessionIds.map(async (sessionId) => {
      const snapshot = await withTimeout(getDocs(
        query(
          collection(instance, NOTEBOOK_PATHS.notes(partyId, sessionId)),
          where("book", "==", book),
          orderBy("createdAt", "asc"),
        ),
      ));

      return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as SessionNote);
    }),
  );

  return perSession.flat();
}

/**
 * The whole book, read as cheaply as it can honestly be read.
 *
 * Per session, two questions rather than "give me everything":
 *
 * 1. **What changed since I last looked?** Nothing, for any session that is
 *    finished, and an empty query costs one read instead of thirty.
 * 2. **How many are there?** Because a deleted note does not appear in the
 *    answer to the first question. It stops existing, and nothing in the
 *    response mentions it. If the count disagrees with what we hold, that
 *    session is re-read in full, which is the only repair a delete allows.
 *
 * An idle campaign of fifty sessions costs about a hundred reads instead of
 * fifteen hundred. A party nobody has touched since this browser last looked
 * costs the same hundred, and returns without a single note crossing the wire.
 *
 * The cache is keyed by uid as well as party: two people sharing a browser
 * must never be handed each other's copy, and the game master's own book is
 * why that matters rather than being a nicety.
 */
export async function syncNotes(
  uid: string,
  partyId: string,
  sessionIds: string[],
  book: Book,
): Promise<SessionNote[]> {
  const instance = database();
  const cached = await readCache(uid, partyId, book);
  const { full, since } = plan(sessionIds, cached.marks);

  const notesOf = (sessionId: string) =>
    cached.notes.filter((note) => note.sessionId === sessionId);

  const readAll = async (sessionId: string) => {
    const snapshot = await withTimeout(getDocs(
      query(
        collection(instance, NOTEBOOK_PATHS.notes(partyId, sessionId)),
        where("book", "==", book),
        orderBy("createdAt", "asc"),
      ),
    ));

    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as SessionNote);
  };

  const settled = await Promise.all([
    ...full.map(async (sessionId) => {
      const notes = await readAll(sessionId);
      return { sessionId, notes };
    }),

    ...since.map(async ({ sessionId, at }) => {
      const notes = collection(instance, NOTEBOOK_PATHS.notes(partyId, sessionId));

      /* Both questions at once. The count is the cheaper of the two and the
         only one that can see a deletion. */
      const [changed, total] = await Promise.all([
        getDocs(
          query(notes, where("book", "==", book), where("updatedAt", ">", at), orderBy("updatedAt")),
        ),
        getCountFromServer(query(notes, where("book", "==", book))),
      ]);

      const merged = mergeNotes(
        notesOf(sessionId),
        changed.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as SessionNote),
      );

      if (drifted(merged, total.data().count)) {
        return { sessionId, notes: await readAll(sessionId) };
      }

      return { sessionId, notes: merged };
    }),
  ]);

  const marks: Record<string, Watermark> = {};
  for (const { sessionId, notes } of settled) {
    marks[sessionId] = { at: watermarkOf(notes), count: notes.length };
  }

  const next: CachedBook = {
    version: 1,
    partyId,
    book,
    marks,
    notes: forget(settled.flatMap((one) => one.notes), sessionIds),
  };

  await writeCache(uid, next);
  return next.notes;
}

/**
 * The night in progress, live. This is the part that makes it shared: a line
 * typed by one player appears on five other screens without anybody reloading.
 *
 * Returns the unsubscribe, so a component can hand it straight back from an
 * effect.
 */
export function watchSession(
  partyId: string,
  sessionId: string,
  book: Book,
  onNotes: (notes: SessionNote[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(database(), NOTEBOOK_PATHS.notes(partyId, sessionId)),
      where("book", "==", book),
      orderBy("createdAt", "asc"),
    ),
    (snapshot) => {
      onNotes(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as SessionNote));
    },
  );
}

/* ==========================================================================
   Writing
   ========================================================================== */

export async function addNote(
  partyId: string,
  sessionId: string,
  input: {
    book: Book;
    authorId: string;
    /** The author's username. The only field of theirs anyone else may see. */
    authorName: string;
    body: string;
    kind: NoteKind;
  },
): Promise<string> {
  const body = input.body.trim().slice(0, NOTE_LIMIT);
  if (!body) throw new Error("An empty note is not a note.");

  const written = Date.now();
  const entry = await addDoc(
    collection(database(), NOTEBOOK_PATHS.notes(partyId, sessionId)),
    {
      sessionId,
      book: input.book,
      authorId: input.authorId,
      authorName: input.authorName,
      body,
      kind: input.kind,
      tags: tagsFrom(body),
      createdAt: written,
      updatedAt: written,
    },
  );

  return entry.id;
}

/** Your own note, and the rules will not let it be anybody else's. */
export async function editNote(
  partyId: string,
  sessionId: string,
  noteId: string,
  body: string,
): Promise<void> {
  const text = body.trim().slice(0, NOTE_LIMIT);
  if (!text) throw new Error("An empty note is not a note.");

  await updateDoc(doc(database(), NOTEBOOK_PATHS.notes(partyId, sessionId), noteId), {
    body: text,
    tags: tagsFrom(text),
    updatedAt: Date.now(),
  });
}

export async function removeNote(
  partyId: string,
  sessionId: string,
  noteId: string,
): Promise<void> {
  await deleteDoc(doc(database(), NOTEBOOK_PATHS.notes(partyId, sessionId), noteId));
}
