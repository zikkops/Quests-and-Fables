/**
 * Tests for firestore.rules, run against the emulator.
 *
 * The rules are the entire security boundary: no server, no Admin SDK, and a
 * client SDK talking straight to the database. They guard phone numbers, dates
 * of birth and home areas belonging to players who may be thirteen. Until this
 * file existed they had never been executed even once.
 *
 * Run with `npm run test:rules`, which starts the emulator around it.
 *
 * A note on what is being tested. Not "does the app work" — the app is not
 * involved. Each case is what somebody with the SDK and a text editor can do,
 * which is the only threat model rules exist for. The app being well behaved is
 * not evidence, and this file's own header says as much: a rule that lives in a
 * component is a suggestion.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

const PROJECT = "quests-and-fables-rules-test";
const WEEK = ["0000", "0000", "0000", "0000", "0000", "0000", "0000"];
const DAY = 86_400_000;
/** Comfortably over thirteen, so the age floor is never what fails a case. */
const DOB = Date.now() - 20 * 365 * DAY;

let passed = 0;
let failed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  PASS  " + name);
  } catch (problem) {
    failed++;
    failures.push({ name, problem });
    console.log("  FAIL  " + name);
  }
}

const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: {
    rules: readFileSync("firestore.rules", "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

/** A signed-in, email-verified player. */
const player = (uid, extra = {}) =>
  env.authenticatedContext(uid, { email_verified: true, ...extra }).firestore();
/** Signed in, never followed the link. Inside or outside the grace week. */
const unverified = (uid) =>
  env.authenticatedContext(uid, { email_verified: false }).firestore();
const admin = (uid) =>
  env.authenticatedContext(uid, { email_verified: true, admin: true }).firestore();
const stranger = () => env.unauthenticatedContext().firestore();

const profileFor = (uid, over = {}) => ({
  uid,
  username: uid,
  email: uid + "@example.com",
  phone: "+9611234567",
  dob: DOB,
  area: "achrafieh",
  playAreas: ["achrafieh"],
  week: WEEK,
  venues: { public: true, guest: false, host: false },
  limits: {},
  characterCount: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...over,
});

/** Seed straight past the rules, the way a fixture should. */
async function seedProfile(uid, over = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const database = ctx.firestore();
    await setDoc(doc(database, "usernames", uid), { uid });
    await setDoc(doc(database, "profiles", uid), profileFor(uid, over));
  });
}

await env.clearFirestore();

/* ========================================================================
   Registration, and the username lock
   ======================================================================== */
console.log("\nRegistration");

await check("a profile cannot be created without holding the username lock", async () => {
  const database = player("alice");
  await assertFails(setDoc(doc(database, "profiles", "alice"), profileFor("alice")));
});

await check("claiming the lock and the profile together works", async () => {
  const database = player("alice");
  const batch = writeBatch(database);
  batch.set(doc(database, "usernames", "alice"), { uid: "alice" });
  batch.set(doc(database, "profiles", "alice"), profileFor("alice"));
  await assertSucceeds(batch.commit());
});

await check("a lock cannot be claimed for somebody else", async () => {
  const database = player("mallory");
  await assertFails(setDoc(doc(database, "usernames", "victim"), { uid: "alice" }));
});

await check("a claimed username cannot be stolen or released", async () => {
  const database = player("mallory");
  await assertFails(updateDoc(doc(database, "usernames", "alice"), { uid: "mallory" }));
  await assertFails(deleteDoc(doc(database, "usernames", "alice")));
});

await check("under-thirteen is refused at the door", async () => {
  const database = player("kid");
  const batch = writeBatch(database);
  batch.set(doc(database, "usernames", "kid"), { uid: "kid" });
  batch.set(doc(database, "profiles", "kid"), profileFor("kid", { dob: Date.now() - 11 * 365 * DAY }));
  await assertFails(batch.commit());
});

/* ========================================================================
   The private half of a profile
   ======================================================================== */
console.log("\nProfile privacy");

await check("a stranger cannot read a profile", async () => {
  await seedProfile("bob");
  await assertFails(getDoc(doc(stranger(), "profiles", "bob")));
});

await check("another player cannot read a profile", async () => {
  await assertFails(getDoc(doc(player("carol"), "profiles", "bob")));
});

await check("the owner can read their own", async () => {
  await assertSucceeds(getDoc(doc(player("bob"), "profiles", "bob")));
});

await check("an admin can read a profile, because parties get assembled by hand", async () => {
  await assertSucceeds(getDoc(doc(admin("root"), "profiles", "bob")));
});

/* ========================================================================
   What a player may change about themselves
   ======================================================================== */
console.log("\nProfile writes");

await check("the owner can edit their own phone and areas", async () => {
  await assertSucceeds(
    updateDoc(doc(player("bob"), "profiles", "bob"), { phone: "+9617654321", updatedAt: Date.now() }),
  );
});

await check("username is permanent", async () => {
  await assertFails(updateDoc(doc(player("bob"), "profiles", "bob"), { username: "renamed" }));
});

await check("date of birth is not quietly editable", async () => {
  await assertFails(updateDoc(doc(player("bob"), "profiles", "bob"), { dob: Date.now() - 30 * 365 * DAY }));
});

await check("a player cannot promote themselves to game master", async () => {
  await assertFails(updateDoc(doc(player("bob"), "profiles", "bob"), { gm: true }));
});

await check("an admin can, because they are recruited in person", async () => {
  await assertSucceeds(updateDoc(doc(admin("root"), "profiles", "bob"), { gm: true }));
});

await check("FIX: createdAt cannot be wound forward to refresh the grace week", async () => {
  await assertFails(updateDoc(doc(unverified("bob"), "profiles", "bob"), { createdAt: Date.now() }));
});

await check("FIX: arbitrary fields are refused", async () => {
  await assertFails(updateDoc(doc(player("bob"), "profiles", "bob"), { isAdmin: true }));
  await assertFails(updateDoc(doc(player("bob"), "profiles", "bob"), { note: "x".repeat(50) }));
});

await check("a profile cannot be deleted from a browser", async () => {
  await assertFails(deleteDoc(doc(player("bob"), "profiles", "bob")));
});

/* ========================================================================
   The seven day clock
   ======================================================================== */
console.log("\nThe grace week");

await check("an unverified account inside its week can still write", async () => {
  await seedProfile("fresh", { createdAt: Date.now() - 2 * DAY });
  await assertSucceeds(updateDoc(doc(unverified("fresh"), "profiles", "fresh"), { phone: "+9611111111" }));
});

await check("an unverified account past its week is held", async () => {
  await seedProfile("stale", { createdAt: Date.now() - 9 * DAY });
  await assertFails(updateDoc(doc(unverified("stale"), "profiles", "stale"), { phone: "+9612222222" }));
});

await check("verifying the address lifts the hold", async () => {
  await assertSucceeds(updateDoc(doc(player("stale"), "profiles", "stale"), { phone: "+9613333333" }));
});

/* ========================================================================
   The five character limit
   ======================================================================== */
console.log("\nThe character limit");

await check("a character create must carry its counter increment", async () => {
  const database = player("bob");
  await assertFails(
    setDoc(doc(database, "profiles/bob/characters", "c1"), {
      ownerId: "bob", name: "Thora", kind: "srd",
    }),
  );
});

await check("create plus increment in one batch is allowed", async () => {
  const database = player("bob");
  const batch = writeBatch(database);
  batch.set(doc(database, "profiles/bob/characters", "c1"), { ownerId: "bob", name: "Thora", kind: "srd" });
  batch.update(doc(database, "profiles", "bob"), { characterCount: 1 });
  await assertSucceeds(batch.commit());
});

await check("nobody else can read your characters", async () => {
  await assertFails(getDoc(doc(player("carol"), "profiles/bob/characters", "c1")));
});

await check("a bare decrement, proving nothing, is refused", async () => {
  await assertFails(
    updateDoc(doc(player("bob"), "profiles", "bob"), { characterCount: 0 }),
  );
});

await check("naming a character that never existed is refused", async () => {
  await assertFails(
    updateDoc(doc(player("bob"), "profiles", "bob"), { characterCount: 0, removed: "never-existed" }),
  );
});

await check("naming one and not deleting it is refused", async () => {
  await assertFails(
    updateDoc(doc(player("bob"), "profiles", "bob"), { characterCount: 0, removed: "c1" }),
  );
});

await check("delete plus decrement naming it is allowed", async () => {
  const database = player("bob");
  const batch = writeBatch(database);
  batch.delete(doc(database, "profiles/bob/characters", "c1"));
  batch.update(doc(database, "profiles", "bob"), { characterCount: 0, removed: "c1" });
  await assertSucceeds(batch.commit());
});

/* ========================================================================
   Parties, and the two notebooks
   ======================================================================== */
console.log("\nParties and the notebook");

async function seedParty() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const database = ctx.firestore();
    await setDoc(doc(database, "parties", "p1"), {
      name: "Thursday nights", area: "achrafieh", status: "assigned",
      playerIds: ["bob", "carol", "dan", "erin"], gmId: "gm1",
    });
    for (const uid of ["bob", "carol", "dan", "erin"]) {
      await setDoc(doc(database, "parties/p1/members", uid), { role: "player" });
    }
    await setDoc(doc(database, "parties/p1/members", "gm1"), { role: "gm" });
    await setDoc(doc(database, "parties/p1/secrets", "chat"), { url: "https://chat.example/x" });
    await setDoc(doc(database, "parties/p1/sessions", "s1"), { number: 1, title: "One", open: true });
    await setDoc(doc(database, "parties/p1/sessions/s1/notes", "n-party"), {
      authorId: "bob", body: "We met a smith.", kind: "note", book: "party",
    });
    await setDoc(doc(database, "parties/p1/sessions/s1/notes", "n-gm"), {
      authorId: "gm1", body: "The smith is lying.", kind: "note", book: "gm",
    });
  });
}
await seedParty();

await check("anybody can browse a party without an account", async () => {
  await assertSucceeds(getDoc(doc(stranger(), "parties", "p1")));
});

await check("a player cannot create or edit a party", async () => {
  await assertFails(setDoc(doc(player("bob"), "parties", "p2"), {
    name: "Mine", area: "achrafieh", status: "forming", playerIds: ["bob"],
  }));
  await assertFails(updateDoc(doc(player("bob"), "parties", "p1"), { playerIds: ["bob"] }));
});

await check("a party cannot be given a game master until it has four players", async () => {
  await assertFails(updateDoc(doc(admin("root"), "parties", "p1"), {
    playerIds: ["bob", "carol"], gmId: "gm1",
  }));
});

await check("the game master is never one of the players", async () => {
  await assertFails(updateDoc(doc(admin("root"), "parties", "p1"), {
    playerIds: ["bob", "carol", "dan", "gm1"], gmId: "gm1",
  }));
});

await check("the group chat link is members only, not on the public document", async () => {
  await assertFails(getDoc(doc(stranger(), "parties/p1/secrets", "chat")));
  await assertSucceeds(getDoc(doc(player("bob"), "parties/p1/secrets", "chat")));
});

await check("a player reads the party's book", async () => {
  await assertSucceeds(getDoc(doc(player("bob"), "parties/p1/sessions/s1/notes", "n-party")));
});

await check("a player cannot read the game master's book", async () => {
  await assertFails(getDoc(doc(player("bob"), "parties/p1/sessions/s1/notes", "n-gm")));
});

await check("the game master reads both", async () => {
  await assertSucceeds(getDoc(doc(player("gm1"), "parties/p1/sessions/s1/notes", "n-party")));
  await assertSucceeds(getDoc(doc(player("gm1"), "parties/p1/sessions/s1/notes", "n-gm")));
});

await check("the game master cannot write into the party's record", async () => {
  await assertFails(setDoc(doc(player("gm1"), "parties/p1/sessions/s1/notes", "n2"), {
    authorId: "gm1", body: "What really happened.", kind: "note", book: "party",
  }));
});

await check("a player cannot write into the game master's book", async () => {
  await assertFails(setDoc(doc(player("bob"), "parties/p1/sessions/s1/notes", "n3"), {
    authorId: "bob", body: "Peeking.", kind: "note", book: "gm",
  }));
});

await check("a note cannot be moved between books after the fact", async () => {
  await assertFails(updateDoc(doc(player("gm1"), "parties/p1/sessions/s1/notes", "n-gm"), {
    book: "party", body: "The smith is lying.",
  }));
});

await check("you cannot edit or delete somebody else's note", async () => {
  await assertFails(updateDoc(doc(player("carol"), "parties/p1/sessions/s1/notes", "n-party"), { body: "Not mine." }));
  await assertFails(deleteDoc(doc(player("carol"), "parties/p1/sessions/s1/notes", "n-party")));
});

await check("an outsider reads nothing under a party", async () => {
  await assertFails(getDoc(doc(player("nobody"), "parties/p1/sessions/s1/notes", "n-party")));
  await assertFails(getDoc(doc(player("nobody"), "parties/p1/members", "bob")));
});

await check("an admin cannot read the table's notebook", async () => {
  await assertFails(getDoc(doc(admin("root"), "parties/p1/sessions/s1/notes", "n-party")));
});

await check("you can only bring your own sheet to a table", async () => {
  await assertSucceeds(setDoc(doc(player("bob"), "parties/p1/sheets", "bob"), { ownerId: "bob", name: "Thora" }));
  await assertFails(setDoc(doc(player("bob"), "parties/p1/sheets", "carol"), { ownerId: "carol", name: "Nope" }));
});

/* ========================================================================
   Seat requests, and the final deny
   ======================================================================== */
console.log("\nSeat requests, and everything else");

await check("a player asks for a seat, and only for themselves", async () => {
  await assertSucceeds(setDoc(doc(player("bob"), "seatRequests", "r1"), {
    playerId: "bob", partyId: "p1", status: "waiting", note: "Free Thursdays.",
  }));
  await assertFails(setDoc(doc(player("bob"), "seatRequests", "r2"), {
    playerId: "carol", partyId: "p1", status: "waiting", note: "",
  }));
});

await check("a request cannot be self-approved", async () => {
  await assertFails(updateDoc(doc(player("bob"), "seatRequests", "r1"), { status: "accepted" }));
  await assertSucceeds(updateDoc(doc(admin("root"), "seatRequests", "r1"), { status: "accepted" }));
});

await check("nobody reads another player's requests", async () => {
  await assertFails(getDoc(doc(player("carol"), "seatRequests", "r1")));
  await assertSucceeds(getDoc(doc(player("bob"), "seatRequests", "r1")));
});

await check("the final deny still denies", async () => {
  await assertFails(getDoc(doc(player("bob"), "anythingElse", "x")));
  await assertFails(setDoc(doc(admin("root"), "anythingElse", "x"), { a: 1 }));
});

/* ======================================================================== */

await env.cleanup();

console.log("\n" + "-".repeat(60));
console.log(passed + " passed, " + failed + " failed");
if (failed) {
  console.log("");
  for (const f of failures) {
    console.log("FAILED: " + f.name);
    console.log("  " + String(f.problem).split("\n")[0]);
  }
}
console.log("-".repeat(60));

assert.equal(failed, 0, failed + " rules test(s) failed");
