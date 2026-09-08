"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, unavailable } from "./client";
import { withTimeout } from "./reach";
import { PATHS, type Profile } from "./schema";
import {
  PARTY_MAX,
  PARTY_MIN,
  type Party,
  type PartyChat,
  type PartyStatus,
  type Slot,
} from "@/lib/party";
import { aggregate, type PartyProfile } from "@/lib/match";

/**
 * Everything the admin console reads and writes.
 *
 * All of it needs the `admin` custom claim. That claim is not a field in this
 * database and cannot be granted from a browser: it is set with the Admin SDK
 * by a script run on somebody's own machine, so the service account key never
 * comes near this repository or a deployed bundle. See the README.
 *
 * **This is the widest read in the product.** `listProfiles` returns every
 * player's phone number and the area they live in, which is exactly what
 * `/account` promises is private. It is here because a party cannot be
 * assembled by somebody who cannot see who is waiting, and the promise on
 * `/account` names whoever runs the service for the same reason. If that ever
 * stops being true, this function is the thing to delete.
 *
 * What an admin explicitly cannot read is a party's notebook. Rule 9 has no
 * admin exception, and `firestore.rules` gives it none.
 */

function database() {
  const instance = db();
  if (!instance) throw new Error(unavailable());
  return instance;
}

export const PARTY_PATH = "parties";

/* ==========================================================================
   Reading
   ========================================================================== */

/**
 * Everyone who has finished setting up an account.
 *
 * Read whole rather than paged, on purpose. The console's job is to find the
 * four people whose weeks overlap, and that is a question about all of them at
 * once: paging would mean either a server that can answer it or an admin
 * clicking through pages hoping. At the scale this launches on, one read of the
 * lot is both cheaper and better. Revisit at a few thousand players, and the
 * answer then is an aggregate written on a schedule, not a page size.
 */
export async function listProfiles(): Promise<Profile[]> {
  const snapshot = await withTimeout(getDocs(
    query(collection(database(), PATHS.profiles), orderBy("createdAt", "desc")),
  ));

  return snapshot.docs.map((entry) => entry.data() as Profile);
}

export async function listParties(): Promise<Party[]> {
  const snapshot = await withTimeout(getDocs(
    query(collection(database(), PARTY_PATH), orderBy("createdAt", "desc")),
  ));

  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Party);
}

/* ==========================================================================
   Writing
   ========================================================================== */

export async function createParty(input: {
  name: string;
  area: string;
  playerIds: string[];
  /** The aggregate, computed by the caller, which holds the profiles. */
  profile: PartyProfile;
}): Promise<string> {
  if (input.playerIds.length > PARTY_MAX) {
    throw new Error(`A party is at most ${PARTY_MAX} players.`);
  }

  const now = Date.now();
  const entry = await addDoc(collection(database(), PARTY_PATH), {
    name: input.name.trim().slice(0, 60),
    area: input.area,
    playerIds: input.playerIds,
    gmId: null,
    status: "forming" satisfies PartyStatus,
    slot: null,
    profile: input.profile,
    createdAt: now,
    updatedAt: now,
  });

  return entry.id;
}

/**
 * Change a party. Every caller goes through here so `updatedAt` cannot be
 * forgotten, and so the two things the rules refuse are refused earlier and
 * with a sentence: a game master who is also a player, and a seventh seat.
 */
export async function updateParty(
  partyId: string,
  patch: Partial<
    Pick<Party, "name" | "area" | "playerIds" | "gmId" | "status" | "slot" | "profile">
  >,
): Promise<void> {
  if (patch.playerIds && patch.playerIds.length > PARTY_MAX) {
    throw new Error(`A party is at most ${PARTY_MAX} players.`);
  }

  if (patch.gmId && patch.playerIds?.includes(patch.gmId)) {
    throw new Error("A game master does not take one of the four to six seats.");
  }

  await updateDoc(doc(database(), PARTY_PATH, partyId), {
    ...patch,
    updatedAt: Date.now(),
  });
}

/**
 * Mark somebody a game master, or stop them being one.
 *
 * Only an admin can do this and the rules enforce it. Game masters are
 * recruited and met in person; there is no self-serve route, by design.
 */
export async function setGameMaster(uid: string, isGm: boolean): Promise<void> {
  await updateDoc(doc(database(), PATHS.profiles, uid), {
    gm: isGm,
    updatedAt: Date.now(),
  });
}

/** The agreed block, chosen out of the party's overlap. */
export const setSlot = (partyId: string, slot: Slot | null) => updateParty(partyId, { slot });

/* ==========================================================================
   The group chat, which lives one document deeper
   ========================================================================== */

const chatDoc = (partyId: string) => doc(database(), PARTY_PATH, partyId, "secrets", "chat");

export async function getChat(partyId: string): Promise<PartyChat | null> {
  const snapshot = await withTimeout(getDoc(chatDoc(partyId)));
  return snapshot.exists() ? (snapshot.data() as PartyChat) : null;
}

/**
 * The pasted WhatsApp group link. Pasted, because WhatsApp cannot create a
 * group from a link or an API. See `src/lib/party.ts` for the long version.
 */
export const setInvite = (partyId: string, invite: string | null) =>
  setDoc(chatDoc(partyId), { invite, updatedAt: Date.now() });

/**
 * Recompute the aggregate a party is matched on. Call it whenever membership
 * changes, and whenever a member's own week, venues or limits might have.
 */
export const refreshProfile = (partyId: string, members: Parameters<typeof aggregate>[0]) =>
  updateParty(partyId, { profile: aggregate(members) });

/* ==========================================================================
   Seat requests

   A player asking for a seat at a table they can see. Top level rather than
   under the party, because "what have I asked for" is a query across parties
   and the alternative is a collection group query — which needs the
   database-wide wildcard rule this project refuses to have.
   ========================================================================== */

export const SEAT_REQUESTS = "seatRequests";

export type SeatRequest = {
  id: string;
  playerId: string;
  partyId: string;
  /** Anything the player wants the game master to know. Optional, capped. */
  note: string;
  status: "waiting" | "offered" | "declined" | "joined";
  createdAt: number;
  updatedAt: number;
};

export async function askForSeat(
  playerId: string,
  partyId: string,
  note: string,
): Promise<string> {
  const now = Date.now();
  const entry = await addDoc(collection(database(), SEAT_REQUESTS), {
    playerId,
    partyId,
    note: note.trim().slice(0, 500),
    status: "waiting" as const,
    createdAt: now,
    updatedAt: now,
  });

  return entry.id;
}

/** Everything one player has asked for. The only query they are allowed. */
export async function myRequests(playerId: string): Promise<SeatRequest[]> {
  const snapshot = await withTimeout(getDocs(
    query(collection(database(), SEAT_REQUESTS), where("playerId", "==", playerId)),
  ));

  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }) as SeatRequest)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Every request waiting on an answer. Admin only, and the rules agree. */
export async function waitingRequests(): Promise<SeatRequest[]> {
  const snapshot = await withTimeout(getDocs(
    query(collection(database(), SEAT_REQUESTS), where("status", "==", "waiting")),
  ));

  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }) as SeatRequest)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export const answerRequest = (requestId: string, status: SeatRequest["status"]) =>
  updateDoc(doc(database(), SEAT_REQUESTS, requestId), { status, updatedAt: Date.now() });

/** A player changing their mind. The rules let them delete their own and only their own. */
export const withdrawRequest = (requestId: string) =>
  deleteDoc(doc(database(), SEAT_REQUESTS, requestId));

/* ==========================================================================
   Sheets brought to the table

   A member's character as the rest of the table sees it. A separate copy from
   the one on their account on purpose: what is at the table is a snapshot,
   taken when they brought it, and editing a character in the builder does not
   silently change the sheet five other people are looking at mid-session.

   It also solves a permission problem honestly. Characters on a profile are
   readable by their owner alone, and a game master needs to see the sheets at
   their own table. Rather than widening that rule, a player hands over a copy.
   ========================================================================== */

export type TableSheet = {
  ownerId: string;
  /** A `Character` from `src/data/table.ts`, ready for the tracker. */
  character: unknown;
  updatedAt: number;
};

const sheetsIn = (partyId: string) => collection(database(), PARTY_PATH, partyId, "sheets");

export async function listSheets(partyId: string): Promise<TableSheet[]> {
  const snapshot = await withTimeout(getDocs(sheetsIn(partyId)));
  return snapshot.docs.map((entry) => entry.data() as TableSheet);
}

/** Bring a character to this table, or replace the one already there. */
export const bringSheet = (partyId: string, uid: string, character: unknown) =>
  setDoc(doc(database(), PARTY_PATH, partyId, "sheets", uid), {
    ownerId: uid,
    character,
    updatedAt: Date.now(),
  });

export const takeSheetBack = (partyId: string, uid: string) =>
  deleteDoc(doc(database(), PARTY_PATH, partyId, "sheets", uid));

/* ==========================================================================
   Removal

   A game master taking somebody out of their own party. `/safety` promises
   this happens immediately and without them explaining themselves first, so it
   is a thing they do rather than a request to whoever runs the service.
   ========================================================================== */

/**
 * Take a player out of a party.
 *
 * **The order is the safety property, and it is deliberate.** These are four
 * separate writes rather than one transaction, because a transaction that
 * fails leaves the person at the table while everybody waits, and the whole
 * promise is that it happens now. So the write that actually ends their access
 * goes first and every later step is tidying:
 *
 * 1. `members/{uid}` is deleted. That document is what `memberRole()` reads,
 *    so from here they cannot open the notebook, the sheets or the group chat
 *    link, whatever happens next.
 * 2. Their sheet leaves with them, so a character they never agreed to share
 *    any longer is not left sitting on five other screens.
 * 3. The removal is recorded. It is the only trace, since the membership that
 *    proved they were ever here has just gone.
 * 4. The party document catches up.
 *
 * If it stops halfway the person is out, which is the failure worth having. A
 * stale `playerIds` is a cosmetic wrong number on a page; a member document
 * left behind would be somebody reading a notebook they were removed from.
 *
 * The aggregate is deliberately not recomputed. It is derived from the members'
 * profiles and a game master cannot read those, by design. Leaving it alone is
 * safe in the direction that matters: it is an intersection of everybody's
 * hours and the strictest limit anybody drew, so a party that has lost somebody
 * can only really be freer than its aggregate claims. It says less than the
 * truth rather than more, until an admin next touches the party.
 */
export async function removePlayer(input: {
  partyId: string;
  /** The player leaving. */
  uid: string;
  /** The game master doing it, for the record. */
  by: string;
  /** Everybody currently on the party document. */
  playerIds: string[];
}): Promise<string[]> {
  const remaining = input.playerIds.filter((id) => id !== input.uid);
  if (remaining.length === input.playerIds.length) {
    throw new Error("That player is not at this table.");
  }

  const instance = database();

  /* 1. Access, first and on its own. */
  await withTimeout(deleteDoc(doc(instance, PARTY_PATH, input.partyId, "members", input.uid)));

  /* 2. Their character. Absent is fine: not everybody brings one. */
  await deleteDoc(doc(instance, PARTY_PATH, input.partyId, "sheets", input.uid)).catch(() => {});

  /* 3. The record. Written once and never editable, see firestore.rules. */
  await setDoc(doc(instance, PARTY_PATH, input.partyId, "removals", input.uid), {
    by: input.by,
    at: Date.now(),
  }).catch(() => {});

  /* 4. The public document. A table that drops below four is forming again and
        says so, which is what puts it back in front of players looking for a
        seat. It keeps its game master: rule 7's floor is for assigning one. */
  await withTimeout(updateDoc(doc(instance, PARTY_PATH, input.partyId), {
    playerIds: remaining,
    status: (remaining.length < PARTY_MIN ? "forming" : "assigned") satisfies PartyStatus,
    updatedAt: Date.now(),
  }));

  return remaining;
}
