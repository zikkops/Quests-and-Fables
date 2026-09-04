"use client";

import { idbClear, idbGet, idbPut } from "./idb";
import type { Book, SessionNote } from "./notebook";

/**
 * The notebook's local copy, and the rules for keeping it honest.
 *
 * The problem this exists for: search is built in the browser, so opening the
 * notebook means reading every note in the campaign. A year of weekly play is
 * around 1,500 documents, and six players opening it daily is nine thousand
 * reads a day against a fifty thousand a day free tier. Reads are billed per
 * document, so the fix is not fewer queries. It is fewer documents.
 *
 * So each session is fetched incrementally: "everything changed since the last
 * time I looked", which is nothing at all for a session that finished weeks
 * ago. An empty query still bills one read, so an idle campaign costs about two
 * reads per session instead of thirty.
 *
 * **Deletions are why the count is stored.** An incremental query returns what
 * changed, and a deleted document does not change, it stops existing. Nothing
 * in the response says so. Comparing the merged count against a server-side
 * count query catches it exactly, and the only repair needed is re-reading that
 * one session.
 *
 * The pure functions below are the whole of the interesting logic and are
 * tested as such. Everything touching IndexedDB is at the bottom and is allowed
 * to fail silently, because a cache that can break the page is not worth having.
 */

export type Watermark = {
  /** The highest `updatedAt` seen in this session, so far. */
  at: number;
  /** How many notes were there when we last agreed with the server. */
  count: number;
};

export type CachedBook = {
  version: 1;
  partyId: string;
  book: Book;
  marks: Record<string, Watermark>;
  notes: SessionNote[];
};

export const emptyBook = (partyId: string, book: Book): CachedBook => ({
  version: 1,
  partyId,
  book,
  marks: {},
  notes: [],
});

/* ==========================================================================
   The logic, kept pure so it can be tested without a browser or a database
   ========================================================================== */

/**
 * Fold what changed into what we had. An edited note replaces its old self; a
 * new one is added. Order is not preserved and does not need to be, since the
 * notebook sorts by `createdAt` when it renders.
 */
export function mergeNotes(cached: SessionNote[], changed: SessionNote[]): SessionNote[] {
  if (changed.length === 0) return cached;

  const byId = new Map(cached.map((note) => [note.id, note]));
  for (const note of changed) byId.set(note.id, note);
  return [...byId.values()];
}

/** The high water mark to ask from next time. Zero for an empty session. */
export const watermarkOf = (notes: SessionNote[]): number =>
  notes.reduce((high, note) => Math.max(high, note.updatedAt), 0);

/**
 * Whether the incremental answer can be trusted, which it cannot if the number
 * of notes disagrees with the server. That means a delete, and a delete cannot
 * be repaired incrementally: the session has to be read again in full.
 */
export const drifted = (merged: SessionNote[], serverCount: number) =>
  merged.length !== serverCount;

/**
 * What to ask the server for, per session, given what is already cached.
 *
 * Split out so the decision is inspectable: `full` sessions have never been
 * seen, `since` sessions only need what changed after that instant.
 */
export function plan(
  sessionIds: string[],
  marks: Record<string, Watermark>,
): { full: string[]; since: { sessionId: string; at: number }[] } {
  const full: string[] = [];
  const since: { sessionId: string; at: number }[] = [];

  for (const sessionId of sessionIds) {
    const mark = marks[sessionId];
    if (!mark) full.push(sessionId);
    else since.push({ sessionId, at: mark.at });
  }

  return { full, since };
}

/** Notes for sessions that no longer exist are not worth keeping around. */
export const forget = (notes: SessionNote[], sessionIds: string[]): SessionNote[] => {
  const live = new Set(sessionIds);
  return notes.filter((note) => live.has(note.sessionId));
};

/* ==========================================================================
   Where it is kept

   Keyed by the signed-in uid as well as the party. Two people sharing a
   browser must never be handed each other's cache, and a game master's own
   book is the reason that matters rather than a nicety.
   ========================================================================== */

const PREFIX = "notebook:";

const keyFor = (uid: string, partyId: string, book: Book) =>
  `${PREFIX}${uid}:${partyId}:${book}`;

export async function readCache(
  uid: string,
  partyId: string,
  book: Book,
): Promise<CachedBook> {
  const stored = await idbGet<CachedBook>(keyFor(uid, partyId, book));

  /* A cache written by an older shape is not worth migrating. Throw it away and
     pay for one full read. */
  if (!stored || stored.version !== 1 || stored.partyId !== partyId) {
    return emptyBook(partyId, book);
  }

  return stored;
}

export const writeCache = (uid: string, cached: CachedBook) =>
  idbPut(keyFor(uid, cached.partyId, cached.book), cached);

/** Called on sign out. Whoever is next at this browser is not the last person. */
export const clearCache = () => idbClear(PREFIX);
