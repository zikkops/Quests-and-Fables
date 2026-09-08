"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, unavailable } from "./client";
import { withTimeout } from "./reach";
import {
  CHARACTER_LIMIT,
  DEFAULT_VENUES,
  EMPTY_WEEK,
  PATHS,
  normalisePhone,
  type AreaSlug,
  type Profile,
  type SavedCharacter,
} from "./schema";

/**
 * Every read and write a player makes about themselves.
 *
 * The rules in `firestore.rules` are the enforcement. This file is the only
 * place that knows how to satisfy them, which matters most for the two
 * operations that are not single writes:
 *
 * - **Claiming a username** is a transaction over two documents, because a name
 *   is only taken if nobody else took it in the moment between the check and
 *   the write.
 * - **Saving or deleting a character** is a batch with the profile's counter,
 *   because the rules refuse either half on its own.
 *
 * Call any of this without a configured Firebase and it throws a plain, honest
 * error rather than a stack trace from inside the SDK.
 */

function database() {
  const instance = db();
  if (!instance) throw new Error(unavailable());
  return instance;
}

/* ==========================================================================
   Usernames
   ========================================================================== */

export async function usernameTaken(username: string): Promise<boolean> {
  const snapshot = await withTimeout(getDoc(doc(database(), PATHS.usernames, username.toLowerCase())));
  return snapshot.exists();
}

/**
 * Claim a username and create the profile behind it, or fail because somebody
 * else got there first. Both documents or neither.
 */
export async function createProfile(input: {
  uid: string;
  username: string;
  email: string;
  phone: string;
  area: AreaSlug;
  /** Milliseconds. The thirteen year floor is enforced in the rules too. */
  dob: number;
}): Promise<void> {
  const instance = database();
  const lower = input.username.toLowerCase();

  await runTransaction(instance, async (tx) => {
    const lock = doc(instance, PATHS.usernames, lower);
    const mine = doc(instance, PATHS.profiles, input.uid);

    /* Every read before any write: a transaction requires it. */
    const existing = await tx.get(lock);
    const already = await tx.get(mine);

    /*
      Never write over a profile that is already there.

      Without this, `tx.set` on an existing profile is an update rather than a
      create, and the rules refuse it because `createdAt` may not move. What
      reached the player was four lines of rule internals naming line numbers in
      firestore.rules, from a screen they should not have been on in the first
      place.

      They get there when the session cannot read their profile and reports "no
      profile" instead: a timeout, being briefly offline, anything. Both this and
      the redirect that sends them are worth fixing, but this is the one that
      makes the whole class of it harmless.
    */
    if (already.exists()) {
      throw new Error(
        "You already have a profile. Nothing here needed setting up, "
        + "and your account is where you edit it.",
      );
    }

    if (existing.exists()) {
      throw new Error("That username has just been taken. Try another.");
    }

    tx.set(lock, { uid: input.uid });
    tx.set(doc(instance, PATHS.profiles, input.uid), {
      uid: input.uid,
      username: lower,
      email: input.email,
      phone: normalisePhone(input.phone),
      dob: input.dob,
      area: input.area,
      playAreas: [input.area],
      week: EMPTY_WEEK,
      /* Public only, and nothing marked. The safest answer is the one somebody
         who never opens the safety card ends up with. */
      venues: DEFAULT_VENUES,
      limits: {},
      characterCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snapshot = await withTimeout(getDoc(doc(database(), PATHS.profiles, uid)));
  return snapshot.exists() ? (snapshot.data() as Profile) : null;
}

/**
 * Everything a player may change about themselves, which is everything except
 * the username. The rules reject a username change anyway; leaving it out of
 * the type means the mistake is caught at the keyboard instead.
 */
export async function updateProfile(
  uid: string,
  patch: Partial<
    Pick<
      Profile,
      | "email" | "phone" | "area" | "playAreas" | "week" | "venues" | "limits"
      | "style" | "experience" | "languages"
    >
  >,
): Promise<void> {
  const clean = { ...patch, updatedAt: Date.now() };
  if (patch.phone !== undefined) clean.phone = normalisePhone(patch.phone);
  await updateDoc(doc(database(), PATHS.profiles, uid), clean);
}

/* ==========================================================================
   Characters, and the five
   ========================================================================== */

export async function listCharacters(uid: string): Promise<SavedCharacter[]> {
  const snapshot = await withTimeout(getDocs(
    query(collection(database(), PATHS.characters(uid)), orderBy("updatedAt", "desc")),
  ));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as SavedCharacter);
}

/**
 * Save a new character and move the counter in the same batch, because the
 * rules will not accept one without the other.
 *
 * Throws before writing if the profile is already full. The rules would refuse
 * it anyway; catching it here is what lets the message say "five is the limit"
 * rather than "permission denied".
 */
export async function createCharacter(
  uid: string,
  input: { name: string; kind: "srd" | "custom"; doc: unknown },
): Promise<string> {
  const instance = database();
  const profile = await getProfile(uid);
  if (!profile) throw new Error("Finish setting up your account first.");
  if (profile.characterCount >= CHARACTER_LIMIT) {
    throw new Error(
      `Five characters is the limit. Delete one to make room, or keep the sixth on this device.`,
    );
  }

  const entry = doc(collection(instance, PATHS.characters(uid)));
  const batch = writeBatch(instance);

  batch.set(entry, {
    ownerId: uid,
    name: input.name.slice(0, 60),
    kind: input.kind,
    doc: input.doc,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  batch.update(doc(instance, PATHS.profiles, uid), {
    characterCount: increment(1),
    updatedAt: Date.now(),
  });

  await batch.commit();
  return entry.id;
}

/** Editing does not touch the counter, so it is an ordinary write. */
export async function saveCharacter(
  uid: string,
  id: string,
  input: { name: string; doc: unknown },
): Promise<void> {
  await updateDoc(doc(database(), PATHS.characters(uid), id), {
    ownerId: uid,
    name: input.name.slice(0, 60),
    doc: input.doc,
    updatedAt: Date.now(),
  });
}

export async function deleteCharacter(uid: string, id: string): Promise<void> {
  const instance = database();
  const batch = writeBatch(instance);

  batch.delete(doc(instance, PATHS.characters(uid), id));
  batch.update(doc(instance, PATHS.profiles, uid), {
    characterCount: increment(-1),
    /* Names what this write removed, so the rules can check the document
       existed before and is gone after. Without it a decrement proves nothing
       and the five character limit is a suggestion. */
    removed: id,
    updatedAt: Date.now(),
  });

  await batch.commit();
}
