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

await check("play style, experience and languages can be saved", async () => {
  await assertSucceeds(
    updateDoc(doc(player("bob"), "profiles", "bob"), {
      style: { combat: 3, roleplay: 4, exploration: 1 },
      experience: "regular",
      languages: ["en", "ar"],
      updatedAt: Date.now(),
    }),
  );
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
    /* Short, and nobody running it: the shape that may not be given one. */
    await setDoc(doc(database, "parties", "p3"), {
      name: "Two of us", area: "achrafieh", status: "forming",
      playerIds: ["bob", "carol"], gmId: null,
    });
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
  /* p3 has two players and nobody running it. Assigning one is the thing rule
     7 refuses, and it is refused however the write is dressed up. */
  await assertFails(updateDoc(doc(admin("root"), "parties", "p3"), { gmId: "gm1" }));
  await assertFails(updateDoc(doc(admin("root"), "parties", "p3"), {
    playerIds: ["bob", "carol", "dan"], gmId: "gm1",
  }));
});

await check("a party that loses players keeps the game master it already has", async () => {
  /*
    The other half of rule 7, and the half that was wrong until removal was
    built. Four is the floor for *assigning* a game master, not for keeping
    one. Reading it as both meant a game master could not remove a fourth
    player, which is exactly the person most worth removing, and it meant a
    table that lost somebody quietly became invalid.
  */
  await assertSucceeds(updateDoc(doc(admin("root"), "parties", "p1"), {
    playerIds: ["bob", "carol", "dan"],
  }));
  await assertSucceeds(updateDoc(doc(admin("root"), "parties", "p1"), {
    playerIds: ["bob", "carol", "dan", "erin"],
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
    playerId: "bob", playerName: "bob", partyId: "p1", status: "waiting",
    note: "Free Thursdays.",
  }));
  await assertFails(setDoc(doc(player("bob"), "seatRequests", "r2"), {
    playerId: "carol", playerName: "carol", partyId: "p1", status: "waiting", note: "",
  }));
});

await check("a request without a name is refused", async () => {
  await assertFails(setDoc(doc(player("bob"), "seatRequests", "r_noname"), {
    playerId: "bob", partyId: "p1", status: "waiting", note: "",
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

/* ========================================================================
   Reports
   ======================================================================== */
console.log("\nReports");

const aReport = (over = {}) => ({
  reporterId: "bob", reporterName: "bob",
  targetKind: "player", targetId: "carol", targetName: "carol",
  reason: "safety", detail: "Made the table uncomfortable.", status: "open",
  createdAt: Date.now(), ...over,
});

await check("a player can file a report", async () => {
  await assertSucceeds(setDoc(doc(player("bob"), "reports", "rep1"), aReport()));
});

await check("a report cannot be filed in somebody else's name", async () => {
  await assertFails(setDoc(doc(player("bob"), "reports", "rep2"), aReport({ reporterId: "carol" })));
});

await check("reporting yourself is refused", async () => {
  await assertFails(setDoc(doc(player("bob"), "reports", "rep3"), aReport({ targetId: "bob" })));
});

await check("a report cannot be filed already answered", async () => {
  await assertFails(setDoc(doc(player("bob"), "reports", "rep4"), aReport({ status: "dismissed" })));
});

await check("the subject cannot read a report about them", async () => {
  await assertFails(getDoc(doc(player("carol"), "reports", "rep1")));
});

await check("the reporter can read their own back", async () => {
  await assertSucceeds(getDoc(doc(player("bob"), "reports", "rep1")));
});

await check("an admin reads it, and answers it", async () => {
  await assertSucceeds(getDoc(doc(admin("root"), "reports", "rep1")));
  await assertSucceeds(updateDoc(doc(admin("root"), "reports", "rep1"), { status: "actioned" }));
});

await check("nobody edits or deletes a report, including whoever filed it", async () => {
  await assertFails(updateDoc(doc(player("bob"), "reports", "rep1"), { detail: "Actually never mind." }));
  await assertFails(deleteDoc(doc(player("bob"), "reports", "rep1")));
  await assertFails(deleteDoc(doc(admin("root"), "reports", "rep1")));
});

/* ========================================================================
   Session Zero: what the table agreed
   ======================================================================== */
console.log("");
console.log("Session Zero");

await check("a player writes what the table agreed, and signs for themselves", async () => {
  await assertSucceeds(setDoc(doc(player("bob"), "parties/p1/sessionZero", "agreement"), {
    answers: { tone: "Grim, but funny about it." },
    signed: { bob: Date.now() },
    changedAt: Date.now(),
    updatedAt: Date.now(),
  }));
});

await check("the game master reads the agreement and cannot touch it", async () => {
  await assertSucceeds(getDoc(doc(player("gm1"), "parties/p1/sessionZero", "agreement")));
  await assertFails(updateDoc(doc(player("gm1"), "parties/p1/sessionZero", "agreement"), {
    answers: { tone: "Whatever I feel like." },
    signed: { bob: Date.now() },
    changedAt: Date.now(),
    updatedAt: Date.now(),
  }));
});

await check("nobody signs the agreement for anybody else", async () => {
  await assertFails(updateDoc(doc(player("bob"), "parties/p1/sessionZero", "agreement"), {
    answers: { tone: "Grim, but funny about it." },
    signed: { bob: Date.now(), carol: Date.now() },
    changedAt: Date.now(),
    updatedAt: Date.now(),
  }));
});

await check("an outsider cannot read what a table agreed", async () => {
  await assertFails(getDoc(doc(player("nobody"), "parties/p1/sessionZero", "agreement")));
  await assertFails(getDoc(doc(stranger(), "parties/p1/sessionZero", "agreement")));
});

await check("one of six cannot throw the agreement away", async () => {
  await assertFails(deleteDoc(doc(player("bob"), "parties/p1/sessionZero", "agreement")));
  await assertFails(deleteDoc(doc(admin("root"), "parties/p1/sessionZero", "agreement")));
});

/* ========================================================================
   Removal: a game master taking somebody out of their party
   ======================================================================== */
console.log("");
console.log("Removal");

async function seedSecondParty() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const database = ctx.firestore();
    await setDoc(doc(database, "parties", "p2"), {
      name: "Sunday afternoons", area: "achrafieh", status: "assigned",
      playerIds: ["bob", "carol", "dan", "erin"], gmId: "gm2",
    });
    for (const uid of ["bob", "carol", "dan", "erin"]) {
      await setDoc(doc(database, "parties/p2/members", uid), { role: "player" });
    }
    await setDoc(doc(database, "parties/p2/members", "gm2"), { role: "gm" });
    await setDoc(doc(database, "parties/p2/sheets", "carol"), { ownerId: "carol", character: {} });
  });
}
await seedSecondParty();

await check("a player cannot remove anybody, including themselves", async () => {
  await assertFails(deleteDoc(doc(player("bob"), "parties/p2/members", "carol")));
  await assertFails(deleteDoc(doc(player("carol"), "parties/p2/members", "carol")));
});

await check("a game master of another table cannot reach into this one", async () => {
  await assertFails(deleteDoc(doc(player("gm1"), "parties/p2/members", "carol")));
  await assertFails(updateDoc(doc(player("gm1"), "parties", "p2"), {
    playerIds: ["bob", "dan", "erin"], updatedAt: Date.now(),
  }));
});

await check("a game master cannot remove another game master", async () => {
  await assertFails(deleteDoc(doc(player("gm2"), "parties/p2/members", "gm2")));
});

await check("a removal cannot rename the party or move it", async () => {
  await assertFails(updateDoc(doc(player("gm2"), "parties", "p2"), {
    playerIds: ["bob", "dan", "erin"], name: "Mine now", updatedAt: Date.now(),
  }));
  await assertFails(updateDoc(doc(player("gm2"), "parties", "p2"), {
    playerIds: ["bob", "dan", "erin"], area: "jbeil", updatedAt: Date.now(),
  }));
});

await check("a removal removes rather than replaces", async () => {
  /* Same size, different people: the table swapped for the game master's own
     accounts. hasOnly is what refuses this. */
  await assertFails(updateDoc(doc(player("gm2"), "parties", "p2"), {
    playerIds: ["mine1", "mine2", "mine3"], updatedAt: Date.now(),
  }));
  /* And it cannot add a seat either. */
  await assertFails(updateDoc(doc(player("gm2"), "parties", "p2"), {
    playerIds: ["bob", "carol", "dan", "erin", "frank"], updatedAt: Date.now(),
  }));
  /* Nor take two at once. */
  await assertFails(updateDoc(doc(player("gm2"), "parties", "p2"), {
    playerIds: ["bob", "dan"], updatedAt: Date.now(),
  }));
});

await check("a game master cannot hand the party to somebody else while removing", async () => {
  await assertFails(updateDoc(doc(player("gm2"), "parties", "p2"), {
    playerIds: ["bob", "dan", "erin"], gmId: "gm1", updatedAt: Date.now(),
  }));
});

await check("the game master removes a player, and their sheet goes with them", async () => {
  /* Membership first: it is what ends access to the notebook and the chat. */
  await assertSucceeds(deleteDoc(doc(player("gm2"), "parties/p2/members", "carol")));
  await assertSucceeds(deleteDoc(doc(player("gm2"), "parties/p2/sheets", "carol")));
  await assertSucceeds(setDoc(doc(player("gm2"), "parties/p2/removals", "carol"), {
    by: "gm2", at: Date.now(),
  }));
  await assertSucceeds(updateDoc(doc(player("gm2"), "parties", "p2"), {
    playerIds: ["bob", "dan", "erin"], status: "forming", updatedAt: Date.now(),
  }));
});

await check("a table of three keeps its game master, and cannot be given a new one", async () => {
  /* The party is three now. The game master stays, because losing a fourth
     player is not the same as being assigned one while short. */
  await assertFails(updateDoc(doc(admin("root"), "parties", "p2"), {
    playerIds: ["bob", "dan", "erin"], gmId: "gm3",
  }));
});

await check("a removed player is out of the notebook immediately", async () => {
  await assertFails(getDoc(doc(player("carol"), "parties/p2/members", "bob")));
});

await check("the rest of the table cannot read who was removed", async () => {
  await assertFails(getDoc(doc(player("bob"), "parties/p2/removals", "carol")));
  await assertSucceeds(getDoc(doc(player("gm2"), "parties/p2/removals", "carol")));
});

await check("a removal record cannot be edited or taken back", async () => {
  await assertFails(updateDoc(doc(player("gm2"), "parties/p2/removals", "carol"), { by: "somebody" }));
  await assertFails(deleteDoc(doc(player("gm2"), "parties/p2/removals", "carol")));
  await assertFails(deleteDoc(doc(admin("root"), "parties/p2/removals", "carol")));
});

await check("a game master cannot forge a removal in somebody else's name", async () => {
  await assertFails(setDoc(doc(player("gm2"), "parties/p2/removals", "dan"), {
    by: "gm1", at: Date.now(),
  }));
});

/* ========================================================================
   Starting the first night
   ======================================================================== */
console.log("");
console.log("Nights");

await check("the game master says the table has played, once", async () => {
  /* p1 is assigned with a game master. Moving it to playing is theirs. */
  await assertSucceeds(updateDoc(doc(player("gm1"), "parties", "p1"), {
    status: "playing", updatedAt: Date.now(),
  }));
});

await check("and cannot walk it back, or close it, or touch anything else", async () => {
  await assertFails(updateDoc(doc(player("gm1"), "parties", "p1"), { status: "forming" }));
  await assertFails(updateDoc(doc(player("gm1"), "parties", "p1"), { status: "closed" }));
  await assertFails(updateDoc(doc(player("gm1"), "parties", "p1"), {
    status: "playing", name: "Mine now",
  }));
});

await check("a player cannot say the table has played", async () => {
  await assertFails(updateDoc(doc(player("bob"), "parties", "p3"), { status: "playing" }));
});

await check("a game master cannot start play at somebody else's table", async () => {
  await assertFails(updateDoc(doc(player("gm1"), "parties", "p2"), { status: "playing" }));
});

await check("the game master opens and closes a night", async () => {
  await assertSucceeds(setDoc(doc(player("gm1"), "parties/p1/sessions", "s2"), {
    campaignId: "p1", number: 2, title: "The second night", playedOn: Date.now(), open: true,
  }));
  await assertSucceeds(updateDoc(doc(player("gm1"), "parties/p1/sessions", "s2"), { open: false }));
});

await check("a player cannot open a night", async () => {
  await assertFails(setDoc(doc(player("bob"), "parties/p1/sessions", "s3"), {
    campaignId: "p1", number: 3, title: "Mine", playedOn: Date.now(), open: true,
  }));
});

/* ========================================================================
   What a table says about the game master who ran it
   ======================================================================== */
console.log("");
console.log("The game master's standing");

async function seedPlayingParty() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const database = ctx.firestore();
    await setDoc(doc(database, "parties", "p4"), {
      name: "Played a few", area: "achrafieh", status: "playing",
      playerIds: ["bob", "carol", "dan", "erin"], gmId: "gmR",
    });
    for (const uid of ["bob", "carol", "dan", "erin"]) {
      await setDoc(doc(database, "parties/p4/members", uid), { role: "player" });
    }
    await setDoc(doc(database, "parties/p4/members", "gmR"), { role: "gm" });

    /* A table that has not played yet, for the "not until you have" case. */
    await setDoc(doc(database, "parties", "p5"), {
      name: "Not yet", area: "achrafieh", status: "assigned",
      playerIds: ["bob", "carol", "dan", "erin"], gmId: "gmS",
    });
    await setDoc(doc(database, "parties/p5/members", "bob"), { role: "player" });
    await setDoc(doc(database, "parties/p5/members", "gmS"), { role: "gm" });
  });
}
await seedPlayingParty();

/** The tally and the rating together, which is the only legal shape. */
const rateWith = (database, gmId, uid, answers, tally, partyId = "p4") => {
  const batch = writeBatch(database);
  batch.set(doc(database, "gmRatings", gmId), { ...tally, updatedAt: Date.now() });
  batch.set(doc(database, `gmRatings/${gmId}/ratings`, uid), {
    prepared: true, fair: true, safe: true, again: true, partyId, at: Date.now(), ...answers,
  });
  return batch.commit();
};

await check("anybody can read a game master's standing", async () => {
  await assertSucceeds(getDoc(doc(stranger(), "gmRatings", "gmR")));
});

await check("a player who played rates the game master once", async () => {
  await assertSucceeds(rateWith(player("bob"), "gmR", "bob", {}, {
    count: 1, prepared: 1, fair: 1, safe: 1, again: 1,
  }));
});

await check("the tally cannot be moved without a rating behind it", async () => {
  await assertFails(setDoc(doc(player("carol"), "gmRatings", "gmR"), {
    count: 99, prepared: 99, fair: 99, safe: 99, again: 99, updatedAt: Date.now(),
  }));
});

await check("a rating cannot claim a yes it did not give", async () => {
  /* Says no to everything, tries to add one to every axis anyway. */
  await assertFails(rateWith(player("carol"), "gmR", "carol",
    { prepared: false, fair: false, safe: false, again: false },
    { count: 2, prepared: 2, fair: 2, safe: 2, again: 2 }));
});

await check("a rating counts as one, never two", async () => {
  await assertFails(rateWith(player("carol"), "gmR", "carol", {}, {
    count: 3, prepared: 3, fair: 3, safe: 3, again: 3,
  }));
});

await check("a no is recorded as a no", async () => {
  await assertSucceeds(rateWith(player("carol"), "gmR", "carol",
    { again: false },
    { count: 2, prepared: 2, fair: 2, safe: 2, again: 1 }));
});

await check("nobody rates the same game master twice", async () => {
  await assertFails(rateWith(player("bob"), "gmR", "bob", {}, {
    count: 3, prepared: 3, fair: 3, safe: 3, again: 2,
  }));
});

await check("a rating stands: it cannot be edited or withdrawn", async () => {
  await assertFails(updateDoc(doc(player("bob"), "gmRatings/gmR/ratings", "bob"), { again: false }));
  await assertFails(deleteDoc(doc(player("bob"), "gmRatings/gmR/ratings", "bob")));
  await assertFails(deleteDoc(doc(admin("root"), "gmRatings", "gmR")));
});

await check("somebody who was never at the table cannot rate", async () => {
  await assertFails(rateWith(player("nobody"), "gmR", "nobody", {}, {
    count: 3, prepared: 3, fair: 3, safe: 3, again: 2,
  }));
});

await check("a game master cannot rate themselves", async () => {
  await assertFails(rateWith(player("gmR"), "gmR", "gmR", {}, {
    count: 3, prepared: 3, fair: 3, safe: 3, again: 2,
  }));
});

await check("nobody rates a table that has not played yet", async () => {
  await assertFails(rateWith(player("bob"), "gmS", "bob", {}, {
    count: 1, prepared: 1, fair: 1, safe: 1, again: 1,
  }, "p5"));
});

await check("a rating cannot be pointed at a party you were not in", async () => {
  await assertFails(rateWith(player("nobody"), "gmR", "nobody", {}, {
    count: 3, prepared: 3, fair: 3, safe: 3, again: 2,
  }, "p1"));
});

await check("who said what is not public, and not the game master's to read", async () => {
  await assertFails(getDoc(doc(stranger(), "gmRatings/gmR/ratings", "bob")));
  await assertFails(getDoc(doc(player("gmR"), "gmRatings/gmR/ratings", "bob")));
  await assertFails(getDoc(doc(player("carol"), "gmRatings/gmR/ratings", "bob")));
  await assertSucceeds(getDoc(doc(player("bob"), "gmRatings/gmR/ratings", "bob")));
  await assertSucceeds(getDoc(doc(admin("root"), "gmRatings/gmR/ratings", "bob")));
});

/* ========================================================================
   Blocks
   ======================================================================== */
console.log("");
console.log("Blocks");

await check("a player blocks somebody", async () => {
  await assertSucceeds(setDoc(doc(player("bob"), "blocks", "bob_carol"), {
    by: "bob", who: "carol", name: "Carol", at: Date.now(),
  }));
});

await check("a block cannot be made in somebody else's name", async () => {
  await assertFails(setDoc(doc(player("dan"), "blocks", "bob_erin"), {
    by: "bob", who: "erin", name: "Erin", at: Date.now(),
  }));
});

await check("nobody blocks themselves", async () => {
  await assertFails(setDoc(doc(player("bob"), "blocks", "bob_bob"), {
    by: "bob", who: "bob", name: "Bob", at: Date.now(),
  }));
});

await check("the person blocked can never find out", async () => {
  await assertFails(getDoc(doc(player("carol"), "blocks", "bob_carol")));
  await assertFails(getDoc(doc(stranger(), "blocks", "bob_carol")));
  await assertSucceeds(getDoc(doc(player("bob"), "blocks", "bob_carol")));
  /* The matcher has to see every one of them, or it cannot keep people apart. */
  await assertSucceeds(getDoc(doc(admin("root"), "blocks", "bob_carol")));
});

await check("a block is not edited into a different one", async () => {
  await assertFails(updateDoc(doc(player("bob"), "blocks", "bob_carol"), { who: "dan" }));
});

await check("only the person who made it can lift it", async () => {
  await assertFails(deleteDoc(doc(player("carol"), "blocks", "bob_carol")));
  await assertFails(deleteDoc(doc(player("dan"), "blocks", "bob_carol")));
  await assertSucceeds(deleteDoc(doc(player("bob"), "blocks", "bob_carol")));
});

await check("the final deny still denies", async () => {
  await assertFails(getDoc(doc(player("bob"), "anythingElse", "x")));
  await assertFails(setDoc(doc(admin("root"), "anythingElse", "x"), { a: 1 }));
});

/* ======================================================================== *
   A group of friends founding their own table
 * ======================================================================== */

console.log("\nParties founded by players");

const founded = (over = {}) => ({
  name: "The Long Coast",
  area: "achrafieh",
  playerIds: ["bob"],
  founderId: "bob",
  gmId: null,
  open: false,
  status: "forming",
  slot: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...over,
});

await check("a player founds a private table", async () => {
  await seedProfile("bob");
  await assertSucceeds(setDoc(doc(player("bob"), "parties", "p_new"), founded()));
});

await check("a founded party cannot start open", async () => {
  await assertFails(
    setDoc(doc(player("bob"), "parties", "p_open"), founded({ open: true })),
  );
});

await check("a founder cannot hand themselves a game master", async () => {
  await assertFails(
    setDoc(doc(player("bob"), "parties", "p_gm"), founded({ gmId: "maret" })),
  );
});

await check("a founder cannot start with anybody but themselves", async () => {
  await assertFails(
    setDoc(doc(player("bob"), "parties", "p_crowd"), founded({ playerIds: ["bob", "carol"] })),
  );
  await assertFails(
    setDoc(doc(player("bob"), "parties", "p_other"), founded({ playerIds: ["carol"], founderId: "carol" })),
  );
});

await check("a founded party cannot claim a hold on the pool", async () => {
  await assertFails(
    setDoc(doc(player("bob"), "parties", "p_playing"), founded({ status: "playing" })),
  );
});

await check("an unverified account past its week cannot found one", async () => {
  await seedProfile("stalefounder", { createdAt: Date.now() - 9 * DAY });
  await assertFails(
    setDoc(doc(unverified("stalefounder"), "parties", "p_stale"),
      founded({ playerIds: ["stalefounder"], founderId: "stalefounder" })),
  );
});

/* ---- taking a friend on ------------------------------------------------ */

await check("a request must carry the asker's own username", async () => {
  await seedProfile("carol");
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "usernames", "carol"), { uid: "carol" });
    await setDoc(doc(ctx.firestore(), "usernames", "dan"), { uid: "dan" });
  });

  await assertSucceeds(
    setDoc(doc(player("carol"), "seatRequests", "carol_p_open2"), {
      playerId: "carol",
      playerName: "carol",
      partyId: "p_open2",
      note: "",
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );

  /* Somebody else's name, so a founder reading it would see the wrong person. */
  await assertFails(
    setDoc(doc(player("carol"), "seatRequests", "carol_p_open3"), {
      playerId: "carol",
      playerName: "dan",
      partyId: "p_open3",
      note: "",
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
});

await check("a founder takes on somebody who asked", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "seatRequests", "carol_p_new"), {
      playerId: "carol",
      playerName: "carol",
      partyId: "p_new",
      note: "",
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  await assertSucceeds(
    updateDoc(doc(player("bob"), "parties", "p_new"), {
      playerIds: ["bob", "carol"],
      updatedAt: Date.now(),
    }),
  );
});

await check("a founder cannot add somebody who never asked", async () => {
  await assertFails(
    updateDoc(doc(player("bob"), "parties", "p_new"), {
      playerIds: ["bob", "carol", "dan"],
      updatedAt: Date.now(),
    }),
  );
});

await check("nobody but the founder adds to a founded party", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "seatRequests", "erin_p_new"), {
      playerId: "erin",
      playerName: "erin",
      partyId: "p_new",
      note: "",
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  await assertFails(
    updateDoc(doc(player("erin"), "parties", "p_new"), {
      playerIds: ["bob", "carol", "erin"],
      updatedAt: Date.now(),
    }),
  );
});

await check("a founder cannot rename the party while adding", async () => {
  await assertFails(
    updateDoc(doc(player("bob"), "parties", "p_new"), {
      playerIds: ["bob", "carol", "erin"],
      name: "Something Else",
      updatedAt: Date.now(),
    }),
  );
});

await check("a founder cannot open their party into the pool", async () => {
  await assertFails(
    updateDoc(doc(player("bob"), "parties", "p_new"), { open: true, updatedAt: Date.now() }),
  );
});

await check("a founder cannot appoint a game master", async () => {
  await assertFails(
    updateDoc(doc(player("bob"), "parties", "p_new"), { gmId: "maret", updatedAt: Date.now() }),
  );
});

await check("a founder cannot drop somebody on the way in", async () => {
  await assertFails(
    updateDoc(doc(player("bob"), "parties", "p_new"), {
      playerIds: ["bob", "erin"],
      updatedAt: Date.now(),
    }),
  );
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
