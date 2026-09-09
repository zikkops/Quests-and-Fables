"use client";

import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db, unavailable } from "./client";
import { withTimeout } from "./reach";

/**
 * "Never put me with this person again."
 *
 * ```
 * blocks/{by}_{who}   { by, who, name, at }
 * ```
 *
 * **A block is invisible to the person it is about.** `firestore.rules` refuses
 * them the read, and nothing in the product ever says a table was withheld or
 * why. That is the whole design and everything else here follows from it: a
 * block somebody can discover is a block with a cost attached to making it, and
 * the people who most need one are exactly the people least able to pay that
 * cost.
 *
 * **It is about the future, not this evening.** Blocking does not remove
 * anybody from a party either of you is already at, and the copy says so rather
 * than letting somebody believe they have dealt with tonight. Tonight is a
 * report, or a word with the game master, who can remove somebody outright.
 *
 * **Only half of it can be enforced in a browser.** A player can be kept away
 * from tables holding people they blocked, because those blocks are theirs to
 * read. They cannot be kept away from a table holding somebody who blocked
 * *them*, because reading that would be finding out. So the other direction is
 * enforced where it can be, in the matcher, which runs with the admin claim and
 * sees every block. See `keepApart` in `src/lib/match.ts`.
 */

function database() {
  const instance = db();
  if (!instance) throw new Error(unavailable());
  return instance;
}

export type Block = {
  /** Who made it. */
  by: string;
  /** Who it is about. */
  who: string;
  /**
   * What they were known as at the time, because a uid is not something anybody
   * can recognise on their own account page later. Whatever they had handed the
   * table: a character name, or the name they signed notes with.
   */
  name: string;
  at: number;
};

const BLOCKS = "blocks";

/** One document per pair, so blocking twice is the same block. */
const idFor = (by: string, who: string) => `${by}_${who}`;

export async function blockSomebody(input: {
  by: string;
  who: string;
  name: string;
}): Promise<void> {
  if (input.by === input.who) throw new Error("You cannot block yourself.");

  await withTimeout(setDoc(doc(database(), BLOCKS, idFor(input.by, input.who)), {
    by: input.by,
    who: input.who,
    name: input.name.trim().slice(0, 60) || "Somebody at a table",
    at: Date.now(),
  }));
}

/** Lift one. A block is a decision about the future, not a verdict. */
export const unblock = (by: string, who: string) =>
  deleteDoc(doc(database(), BLOCKS, idFor(by, who)));

/** Everybody this person has blocked. Theirs alone to read. */
export async function myBlocks(uid: string): Promise<Block[]> {
  const snapshot = await withTimeout(getDocs(
    query(collection(database(), BLOCKS), where("by", "==", uid)),
  ));

  return snapshot.docs.map((entry) => entry.data() as Block);
}

/**
 * Every block there is. Admin only, and the rules enforce that.
 *
 * Read whole rather than paged, on the same argument the admin console already
 * makes about profiles: the question being asked is "who must not be put
 * together", which is a question about all of them at once.
 */
export async function allBlocks(): Promise<Block[]> {
  const snapshot = await withTimeout(getDocs(collection(database(), BLOCKS)));
  return snapshot.docs.map((entry) => entry.data() as Block);
}
