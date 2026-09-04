/**
 * The table's notebook: what a note is, before any question of where it is kept.
 *
 * Two books, and the difference between them is the whole design:
 *
 * - **The party record.** Every player writes in it, the game master reads it
 *   and cannot write a word. It is the party's account of what they think
 *   happened, which is not the same thing as what happened, and it stays theirs.
 * - **The game master's book.** Theirs alone. Players cannot read it at all,
 *   which is what lets a game master write down the thing the party has not
 *   worked out yet.
 *
 * Notes are separate authored entries rather than one document six people type
 * into. A shared document would need conflict resolution and could not answer
 * "who wrote this", and "who wrote this" is exactly what makes the rule above
 * enforceable. Nobody ever edits the same bytes, so concurrent writing is free.
 */

export type Book = "party" | "gm";

export const KINDS = [
  { key: "note", label: "Note", hint: "Anything that happened" },
  { key: "npc", label: "Person", hint: "Somebody met, named or suspected" },
  { key: "place", label: "Place", hint: "Somewhere you went or heard of" },
  { key: "loot", label: "Loot", hint: "What you took and who is carrying it" },
  { key: "question", label: "Question", hint: "The thread you have not pulled" },
] as const;

export type NoteKind = (typeof KINDS)[number]["key"];

export const kindLabel = (kind: NoteKind) =>
  KINDS.find((k) => k.key === kind)?.label ?? "Note";

export type SessionNote = {
  id: string;
  sessionId: string;
  book: Book;
  /** The author's uid. Ownership is enforced on this, never on the name. */
  authorId: string;
  /** Their username, copied in. It is the only field of theirs anyone may see. */
  authorName: string;
  body: string;
  kind: NoteKind;
  /** Lowercased, from #hash and @mention. Written by hand, never guessed. */
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

/** A night of play. The folder everything else hangs in. */
export type PlaySession = {
  id: string;
  campaignId: string;
  /** Session 7. Counted, not dated, because that is how tables refer to them. */
  number: number;
  /** Named by the players. A game master naming the party's session is odd. */
  title: string;
  playedOn: number;
  open: boolean;
};

export const NOTE_LIMIT = 2000;

/**
 * Tags, as typed. `#cedar-compact` and `@maret` both become tags; the marker is
 * kept off the stored value so a search for "maret" finds the mention and the
 * tag alike.
 *
 * Deliberately not proper-noun extraction. Six players spell an invented name
 * six ways, and a glossary that is confidently wrong is worse than none.
 */
export function tagsFrom(body: string): string[] {
  const found = body.match(/[#@][\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
  return [...new Set(found.map((tag) => tag.slice(1).toLowerCase()))];
}

/** Everything about a note that is worth matching on, joined for the index. */
export const searchableText = (note: SessionNote) =>
  `${note.body} ${note.authorName} ${note.tags.join(" ")}`;

/** Sessions newest first, which is the order a table wants them in. */
export const byRecency = (a: PlaySession, b: PlaySession) => b.number - a.number;

/** Notes oldest first inside a session, because a night is read forwards. */
export const byWritten = (a: SessionNote, b: SessionNote) => a.createdAt - b.createdAt;
