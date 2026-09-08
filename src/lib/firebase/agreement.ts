"use client";

import { doc, getDoc, onSnapshot, runTransaction } from "firebase/firestore";
import { db, unavailable } from "./client";
import { withTimeout } from "./reach";
import { EMPTY_SESSION_ZERO, type SessionZero } from "@/lib/party";

/**
 * Session Zero: what a table agreed before it played.
 *
 * ```
 * parties/{partyId}/sessionZero/agreement
 * ```
 *
 * One document, not a collection. The whole point is that there is a single
 * answer to "what did we agree", and six documents to reconcile would be a way
 * of not having one. It is small, it is written rarely, and the contention a
 * single document suffers is not a concern at five prompts and six people.
 *
 * **Players write it and the game master does not.** That is rule 9 applied to
 * an agreement rather than to a record, and the reasoning survives the move: a
 * game master who can edit what the table agreed can widen it afterwards, and
 * this document is the only thing a player can point at when they say that is
 * not what we said. They are at the conversation. They do not hold the pen.
 * `firestore.rules` is where that is actually enforced; this file only has to
 * not fight it.
 */

function database() {
  const instance = db();
  if (!instance) throw new Error(unavailable());
  return instance;
}

const AGREEMENT = "agreement";

const path = (partyId: string) => `parties/${partyId}/sessionZero`;

/** Read it once. Absent means the table has not started, not an error. */
export async function readSessionZero(partyId: string): Promise<SessionZero> {
  const entry = await withTimeout(getDoc(doc(database(), path(partyId), AGREEMENT)));
  return entry.exists() ? (entry.data() as SessionZero) : EMPTY_SESSION_ZERO;
}

/**
 * Watch it.
 *
 * A checklist filled in together is the case where live matters most: six
 * people are in a room agreeing this out loud, and two of them are typing.
 * Without a listener the third person overwrites the second and nobody sees it
 * happen.
 */
export function watchSessionZero(
  partyId: string,
  onChange: (zero: SessionZero) => void,
): () => void {
  return onSnapshot(doc(database(), path(partyId), AGREEMENT), (entry) => {
    onChange(entry.exists() ? (entry.data() as SessionZero) : EMPTY_SESSION_ZERO);
  });
}

/**
 * Both writes read the document first, inside a transaction.
 *
 * Not caution for its own sake. The rules refuse a write that moves anybody's
 * signature but your own, and they compare against the document as it is at
 * that moment, not as this browser last saw it. Six people are filling this in
 * together in one room, so "as this browser last saw it" is exactly the thing
 * that goes stale: another player signs, this tab still holds the map from
 * before, and sending it back would silently drop them. The rules would catch
 * it and refuse the whole write, which is correct and also useless to the
 * person typing. Reading inside the transaction means there is nothing to
 * catch.
 */
async function edit(
  partyId: string,
  change: (now: SessionZero) => SessionZero | null,
): Promise<void> {
  const instance = database();
  const where = doc(instance, path(partyId), AGREEMENT);

  await withTimeout(runTransaction(instance, async (tx) => {
    const entry = await tx.get(where);
    const now = entry.exists() ? (entry.data() as SessionZero) : EMPTY_SESSION_ZERO;

    const next = change(now);
    if (!next) return;

    tx.set(where, next);
  }));
}

/**
 * Write an answer, and sign for the person who wrote it.
 *
 * Whoever changes what the agreement says has, by definition, agreed to what it
 * now says, so their own signature moves with the edit. Everybody else's stays
 * where it was and is then visibly older than `changedAt`, which is the honest
 * outcome: they agreed to the previous wording and have not seen this one.
 */
export function saveSessionZero(
  partyId: string,
  uid: string,
  key: string,
  answer: string,
): Promise<void> {
  const text = answer.trim().slice(0, 1200);

  return edit(partyId, (now) => {
    /* Nothing actually changed, so nothing should be invalidated. A blur that
       changed no words must not strip five signatures. */
    if ((now.answers[key] ?? "") === text) return null;

    const at = Date.now();
    return {
      answers: { ...now.answers, [key]: text },
      signed: { ...now.signed, [uid]: at },
      changedAt: at,
      updatedAt: at,
    };
  });
}

/** Say that this is what we agreed, without changing a word of it. */
export function signSessionZero(partyId: string, uid: string): Promise<void> {
  return edit(partyId, (now) => {
    const at = Date.now();
    return {
      answers: now.answers,
      signed: { ...now.signed, [uid]: at },
      /* Untouched. Signing is not an edit, and moving this would reset
         everybody else's signature every time one person agreed. */
      changedAt: now.changedAt || at,
      updatedAt: at,
    };
  });
}
