"use client";

import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db, unavailable } from "./client";
import { withTimeout } from "./reach";
import { NO_STANDING, withRating, type Rating, type Standing } from "@/lib/rating";

/**
 * The game master's standing, and the ratings under it.
 *
 * ```
 * gmRatings/{gmId}                     public tally: count and a yes count per axis
 * gmRatings/{gmId}/ratings/{raterId}   private: what one player actually said
 * ```
 *
 * **The tally is public and written by a browser, which is a contradiction the
 * rules resolve rather than this file.** There is no server here, so a counter
 * anybody can write is a counter anybody can lie to. `firestore.rules` refuses
 * a tally that moves without a rating document landing in the same write, reads
 * that document with `getAfter`, and checks the arithmetic against it. This
 * module's job is to write the pair correctly, not to be trusted.
 *
 * Which is also why both go in one transaction. Two players rating the same
 * evening at once would otherwise both compute the same next number, and the
 * second write would be refused by the rules for arithmetic that was true when
 * it was read and false when it arrived. A transaction re-reads and retries,
 * so the second one lands as the second one.
 */

function database() {
  const instance = db();
  if (!instance) throw new Error(unavailable());
  return instance;
}

const standingAt = (gmId: string) => `gmRatings/${gmId}`;

/** Public. Absent means nobody has rated them, which is not an error. */
export async function readStanding(gmId: string): Promise<Standing> {
  const entry = await withTimeout(getDoc(doc(database(), "gmRatings", gmId)));
  return entry.exists() ? (entry.data() as Standing) : NO_STANDING;
}

/**
 * Whether this person has already rated this game master.
 *
 * Readable by its owner and an admin and nobody else, so this answers only for
 * the person asking. A game master cannot use it to find out who has rated
 * them, because the rules refuse them the read.
 */
export async function alreadyRated(gmId: string, uid: string): Promise<boolean> {
  const entry = await withTimeout(getDoc(doc(database(), `${standingAt(gmId)}/ratings`, uid)));
  return entry.exists();
}

/**
 * Rate a game master, once.
 *
 * The rating and the tally move together or not at all. If somebody has already
 * rated, this refuses before the write rather than letting the rules produce a
 * permission error, because "you have already rated them" is a sentence and
 * `PERMISSION_DENIED` is not.
 */
export async function rateGameMaster(input: {
  gmId: string;
  uid: string;
  partyId: string;
  answers: Pick<Rating, "prepared" | "fair" | "safe" | "again">;
}): Promise<Standing> {
  const instance = database();
  const tally = doc(instance, "gmRatings", input.gmId);
  const mine = doc(instance, `${standingAt(input.gmId)}/ratings`, input.uid);

  return withTimeout(runTransaction(instance, async (tx) => {
    /* Every read before any write: a transaction requires it. */
    const already = await tx.get(mine);
    const current = await tx.get(tally);

    if (already.exists()) {
      throw new Error("You have already rated this game master, and a rating stands.");
    }

    const rating: Rating = {
      ...input.answers,
      partyId: input.partyId,
      at: Date.now(),
    };

    const next = withRating(
      current.exists() ? (current.data() as Standing) : NO_STANDING,
      rating,
    );

    tx.set(tally, next);
    tx.set(mine, rating);

    return next;
  }));
}
