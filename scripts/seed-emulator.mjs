/**
 * Fills the emulators with accounts you can sign in as.
 *
 *     npm run seed:emulator      (with npm run dev:emulator already running)
 *
 * Without this the emulator database is empty and the only way in is to
 * register, which is fine for one account and tedious for six. More to the
 * point, **`/admin` is unreachable any other way**: it needs the `admin` custom
 * claim, which is not a field in the database and cannot be granted from a
 * browser. Registering through the UI a hundred times will never produce an
 * admin, and `/admin` is where parties are built and game masters assigned.
 *
 * Everything here goes in through the emulators' privileged endpoints, the way
 * the Admin SDK would in production: `Bearer owner` on the Auth emulator, and
 * unauthenticated writes on the Firestore emulator, which bypass the rules.
 * That is deliberate. Seeding should not be limited to what a player can do,
 * and it is also why this only ever talks to 127.0.0.1.
 *
 * Everybody's password is `password`.
 */

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "quests-and-fables";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const PASSWORD = "password";

const YEAR = 365 * 24 * 60 * 60 * 1000;
const dobFor = (age) => Date.now() - age * YEAR;

/* Blocks are afternoon, early, prime, late. "1" is free. */
const WEEKDAY_EVENINGS = ["0110", "0110", "0110", "0110", "0010", "1110", "1100"];
const THURSDAYS_ONLY = ["0000", "0000", "0000", "0110", "0000", "0000", "0000"];
const MOST_NIGHTS = ["0111", "0111", "0111", "0111", "0111", "1111", "1110"];

/* ---- tiny helpers over the emulator REST APIs --------------------------- */

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} -> ${response.status} `
      + JSON.stringify(body).slice(0, 300));
  }
  return body;
}

/** Firestore REST wants every value tagged with its type. */
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encode) } };
  }
  return { mapValue: { fields: fields(value) } };
}

const fields = (object) =>
  Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));

/* `Bearer owner` is what bypasses the rules on the Firestore emulator. Without
   it a write here is just an unauthenticated one and gets refused by the same
   rules everybody else gets, which is correct and not what a seeder wants. */
const put = (path, data) =>
  json(`${FS}/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields: fields(data) }),
  });

async function createUser(email) {
  const made = await json(`${AUTH}/accounts:signUp?key=any`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });

  /* Mark the address confirmed. Otherwise every seeded account is inside the
     seven day grace window and behaves like a half-finished signup, which is
     not what you want to be looking at while testing everything else. */
  await json(`${AUTH}/accounts:update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ localId: made.localId, emailVerified: true }),
  });

  return made.localId;
}

async function makeAdmin(uid) {
  await json(`${AUTH}/accounts:update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({
      localId: uid,
      customAttributes: JSON.stringify({ admin: true }),
    }),
  });
}

async function seedPlayer({ email, username, area, playAreas, week, venues, limits, age, gm, style, experience }) {
  const uid = await createUser(email);
  const now = Date.now();

  await put(`usernames/${username}`, { uid });
  await put(`profiles/${uid}`, {
    uid,
    username,
    email,
    phone: "+9613" + String(100000 + Math.floor(Math.random() * 899999)),
    dob: dobFor(age),
    area,
    playAreas,
    week,
    venues,
    limits,
    characterCount: 0,
    ...(style ? { style } : {}),
    ...(experience ? { experience } : {}),
    ...(gm ? { gm: true } : {}),
    createdAt: now,
    updatedAt: now,
  });

  return uid;
}

/* ---- the cast ----------------------------------------------------------- */

const PUBLIC_ONLY = { public: true, guest: false, host: false };
const WILL_VISIT = { public: true, guest: true, host: false };
const WILL_HOST = { public: true, guest: true, host: true };

const PLAYERS = [
  {
    email: "orla@local", username: "orla_ironbrand", age: 27,
    style: { combat: 3, roleplay: 3, exploration: 2 }, experience: "regular",
    area: "achrafieh", playAreas: ["achrafieh", "gemmayzeh-mar-mikhael", "badaro"],
    week: WEEKDAY_EVENINGS, venues: WILL_HOST, limits: { spiders: "veil" },
  },
  {
    email: "sami@local", username: "sami_h", age: 34,
    style: { combat: 1, roleplay: 4, exploration: 3 }, experience: "veteran",
    area: "hamra-ras-beirut", playAreas: ["hamra-ras-beirut", "achrafieh"],
    week: WEEKDAY_EVENINGS, venues: WILL_VISIT, limits: { "harm-to-children": "line" },
  },
  {
    email: "nadia@local", username: "nadia_k", age: 22,
    style: { combat: 4, roleplay: 1, exploration: 2 }, experience: "some",
    area: "badaro", playAreas: ["badaro", "achrafieh"],
    week: MOST_NIGHTS, venues: WILL_VISIT, limits: {},
  },
  {
    email: "ziad@local", username: "ziad_r", age: 19,
    style: { combat: 2, roleplay: 3, exploration: 3 }, experience: "never",
    area: "achrafieh", playAreas: ["achrafieh", "sin-el-fil"],
    week: WEEKDAY_EVENINGS, venues: PUBLIC_ONLY,
    limits: { "graphic-violence": "veil", torture: "line" },
  },
  {
    /* Deliberately awkward: one night a week, and will not travel far. Good for
       seeing what the overlap looks like when it is nearly empty. */
    email: "rita@local", username: "rita_s", age: 41,
    style: { combat: 0, roleplay: 4, exploration: 4 }, experience: "veteran",
    area: "jounieh", playAreas: ["jounieh"],
    week: THURSDAYS_ONLY, venues: PUBLIC_ONLY, limits: {},
  },
];

async function main() {
  try {
    await fetch(`${AUTH}/projects/${PROJECT}/accounts:query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: "{}",
    });
  } catch {
    console.error(
      "\n  The emulators are not answering on 9099 and 8080."
      + "\n  Start them first with: npm run dev:emulator\n",
    );
    process.exit(1);
  }

  /* Wipe first, so seeding twice is the same as seeding once. */
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE", headers: { Authorization: "Bearer owner" } });

  const admin = await createUser("admin@local");
  await makeAdmin(admin);
  await put(`usernames/the_house`, { uid: admin });
  await put(`profiles/${admin}`, {
    uid: admin, username: "the_house", email: "admin@local",
    phone: "+9613000000", dob: dobFor(40), area: "achrafieh",
    playAreas: ["achrafieh"], week: [...WEEKDAY_EVENINGS], venues: PUBLIC_ONLY,
    limits: {}, characterCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
  });

  const gm = await seedPlayer({
    email: "gm@local", username: "bassam_gm", age: 38,
    area: "achrafieh", playAreas: ["achrafieh", "badaro", "hamra-ras-beirut"],
    week: WEEKDAY_EVENINGS, venues: WILL_HOST, limits: {}, gm: true,
    style: { combat: 2, roleplay: 3, exploration: 3 }, experience: "veteran",
  });

  const players = [];
  for (const player of PLAYERS) players.push(await seedPlayer(player));

  /* A party with a night in progress, so /campaign/[id] and the notebook have
     something real to show. Four players plus the game master, which is the
     minimum a party can be given one at all. */
  const seated = players.slice(0, 4);
  const partyId = "thursday-nights";
  const now = Date.now();

  await put(`parties/${partyId}`, {
    name: "Thursday nights in Achrafieh",
    area: "achrafieh",
    playerIds: seated,
    gmId: gm,
    status: "playing",
    slot: null,
    /* The aggregate: what the table shares, never who said it. */
    profile: {
      week: [...WEEKDAY_EVENINGS],
      arrangements: ["public"],
      limits: { "harm-to-children": "line", torture: "line", spiders: "veil", "graphic-violence": "veil" },
    },
    createdAt: now,
    updatedAt: now,
  });

  for (const uid of seated) await put(`parties/${partyId}/members/${uid}`, { role: "player" });
  await put(`parties/${partyId}/members/${gm}`, { role: "gm" });
  await put(`parties/${partyId}/secrets/chat`, { url: "https://chat.whatsapp.com/seeded-example" });

  await put(`parties/${partyId}/sessions/night-one`, {
    campaignId: partyId, number: 1, title: "The road to Byblos",
    playedOn: now, open: false,
  });
  await put(`parties/${partyId}/sessions/night-two`, {
    campaignId: partyId, number: 2, title: "What the smith knew",
    playedOn: now, open: true,
  });

  const note = (id, sessionId, book, authorId, authorName, body, kind) =>
    put(`parties/${partyId}/sessions/${sessionId}/notes/${id}`, {
      sessionId, book, authorId, authorName, body, kind,
      tags: (body.match(/[#@][a-z0-9-]+/gi) || []).map((t) => t.slice(1).toLowerCase()),
      createdAt: now, updatedAt: now,
    });

  await note("n1", "night-one", "party", seated[0], "orla_ironbrand", "We met @maret, a smith in Jbeil who would not look at the coin.", "npc");
  await note("n2", "night-one", "party", seated[1], "sami_h", "The #cedar-compact is a name three people refused to explain.", "question");
  await note("n3", "night-two", "party", seated[2], "nadia_k", "Took a sealed letter from the caravan. Nadia is carrying it.", "loot");
  await note("g1", "night-one", "gm", gm, "bassam_gm", "@maret is lying about the coin. She minted it herself.", "npc");
  await note("g2", "night-two", "gm", gm, "bassam_gm", "If they open the letter early, the #cedar-compact finds them first.", "note");

  console.log(`
  Seeded. Everybody's password is "${PASSWORD}".

    admin@local    the_house       the admin console at /admin
    gm@local       bassam_gm       a recruited game master, /gm
    orla@local     orla_ironbrand  will host, free most weekday evenings
    sami@local     sami_h          will visit a home, no harm to children
    nadia@local    nadia_k         free most nights
    ziad@local     ziad_r          public rooms only, 19, two limits set
    rita@local     rita_s          Jounieh, Thursdays only, will not travel

  Four of the five overlap on weekday evenings around Achrafieh, so they can be
  made into a party from /admin. Rita is the one who will not fit, which is the
  more interesting case to look at.

  One party, "Thursday nights in Achrafieh": the four who overlap plus the game
  master, two sessions with the second still open, and notes in both books.
  Open /campaign/thursday-nights as any of them.
`);
}

main().catch((problem) => {
  console.error("\n  Seeding failed:", problem.message, "\n");
  process.exit(1);
});
