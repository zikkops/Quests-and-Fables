# Quests & Fables, `web/`

A place where people who want to play D&D find a group, find a game master, and
build a character. Not a virtual tabletop, the part that happens *before* the
tabletop.

Notes and decisions live in the Obsidian vault at
`C:\Users\User\Documents\ai brain\01 - Projects\Quests and Fables`.
**Notes there, code here.** Read `Scope v1.md` first — it is what we are actually
building, and it supersedes `Architecture.md` wherever the two disagree. Then
`Quests and Fables.md`.

## What v1 is

Local, in-person D&D. A free character builder anyone can use without an account.
Accounts for players and GMs. Every player keeps a calendar of when they're free
and says where they live and where they're comfortable playing. Players form or
join a party of **4 to 6**. When a party is full enough and has a workable slot
and place, **the platform assigns it a GM**, and the group books a session.

Sessions are paid — **but the site never touches the money.** Players settle with
the GM directly, in cash or over Whish. The session record carries a price and a
settled flag; there is no payment processor in this codebase and there is not
meant to be one.

Once a party has a GM it has a **campaign**: a live shared sheet. Characters take
damage, heal, rest, spend spell slots and pick up conditions; the GM sees all
4–6 sheets on one dashboard and can apply damage or a condition to any of them;
the whole table shares a notebook, and the GM gets a private one. Modifiers are
shown, dice are never rolled — people roll real dice at a real table. **It is not
a VTT**: no maps, no tokens, no fog of war.

Characters come from the SRD builder **or** from a blank custom sheet where a
player types in HP, AC, speed, skills and slots by hand — for homebrew, or for a
book they own. Both resolve to the same sheet shape, so nothing downstream knows
the difference.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # must stay clean
npx tsc --noEmit # must stay clean
npm run lint     # must stay clean
```

No environment variables are needed to run the site. Accounts want six, and say
so rather than breaking without them — copy `.env.example` to `.env.local` when
there is a Firebase project to point at. See [Accounts](#accounts).

### Against throwaway data

```bash
npm run dev:emulator   # the site, on local auth + Firestore emulators
npm run test:rules     # 46 cases against firestore.rules
```

`npm run dev` talks to the **real** project. `dev:emulator` talks to local
emulators: disposable accounts, an empty database every time, and a badge on
every page saying so.

**Use it for anything involving registration.** `firestore.rules` gives a
claimed username no release path from the client and there is no Admin SDK for
this project, so a test signup against the real database burns that username
permanently. There is no way to undo it from here.

It picks the first free port from 3002 up and prints it, and builds into
`.next-emulator`, so it runs happily beside a normal `npm run dev` on 3000.

There is **no Emulator UI** with it: `ui` is not a valid `--only` target, so
`emulators:exec` never starts it. Run `npx firebase-tools emulators:start`
separately if you want to browse the data at <http://localhost:4000>.

Both commands need **Java** for the Firestore emulator. There is a Temurin 21
JRE at `C:\Users\User\.jre-temurin-21`, already on the user PATH with
`JAVA_HOME` set. Without a JDK both fail with Firebase's own "Could not spawn
java", which is clear enough.

Two things that will catch you out:

- **They both want port 8080, so they cannot run at the same time.** Stop
  `dev:emulator` before running the rules tests, or the tests die with "Could
  not start Firestore Emulator, port taken."
- **Emulators can outlive the command that started them.** Killing
  `dev:emulator` on Windows sometimes leaves the Java emulator and the
  `firebase-tools` parent behind, holding 8080 and 9099. `netstat -ano | grep
  8080` finds the pid.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19.2, TypeScript |
| Styling | CSS Modules + design tokens in `src/app/globals.css` |
| Animation | GSAP 3 + `@gsap/react` (`useGSAP` cleans up on unmount, so animations don't leak across routes) |
| Database / auth | Firebase: Auth (email and password) + Firestore. **Live, with `firestore.rules` deployed and tested** — see [Accounts](#accounts) |
| Payments | **None, by design.** Settled off-platform, player to GM |

Three places where this deviates from the vault notes, deliberately:

- **Next 16, not 15.** The notes say Next.js 15; 16 is the current stable line
  and 15.5 is now only a backport branch. Turbopack is the default bundler in
  16, and `eslint.config.mjs` imports `eslint-config-next` directly, the
  `FlatCompat` shim that `create-next-app` used to emit does not work against
  v16.
- **CSS Modules, not Tailwind.** `Architecture.md` lists Tailwind + shadcn; the
  project note supersedes it, because the design is hand-tuned and Tailwind
  risked visual drift. All colour is a custom property, which is also what makes
  sheet themes possible later.
- **In-person, assigned GMs, no payments.** `Architecture.md` and
  `Monetization.md` describe a global, online-only, subscription product where
  GMs post tables and players apply. `Scope v1.md` (2026-08-19) replaces all of
  that. Build to `Scope v1.md`.

## Routes

| Route | State |
|---|---|
| `/` | Built |
| `/character-builder` | **Built.** SRD builder, engine ported from the vault prototype |
| `/character-builder/custom` | **Built.** The blank sheet |
| `/parties` | **Built.** Open tables, ranked by fit for whoever is signed in, filtered by the hard rules in `src/lib/match.ts`. Still **dynamic**: it reads `?area=` from the homepage picker and answers it with the map |
| `/parties/[id]` | **Built.** One table: where, when, and what it will not play through. Ask for a seat, or withdraw |
| `/campaign/[id]` | **Built.** A real party's table: the sheets everybody brought and the live notebook. Members only, enforced in the rules |
| `/gm` | **Built.** The tables a game master runs. Anyone else gets told game masters are recruited, not signed up |
| `/campaign` | The demo, hosting two **working** things on made up data: the tracker and the notebook. The real one is `/campaign/[id]` |
| `/safety` | Stub |
| `/sign-in` | **Built.** Sign in, register, and reset a password. Registration is one form: email, password, username, date of birth, phone, area |
| `/account` | **Built.** Details, play areas, the week, and the five characters |
| `/account/setup` | **Built.** The recovery path for an account whose profile write failed halfway. Not the normal route in |
| `/admin` | **Built.** The console: every player, the live overlap of any four of them, party forming, game master assignment, the WhatsApp handoff. Admin claim only, unlinked, noindex |
| `/onboarding/player` | Stub — kept for the explanation. The availability editor it described now lives on `/account` |
| `/join` | Stub — the game master invitation. **There is no game master sign-up.** They are recruited, met in person, and handed a party, so this page is one email address and an explanation. It replaced `/onboarding/gm`, which described a self-serve flow (post a table, sift applicants) that `Scope v1.md` does not have |

A stub renders and honestly explains what the page will do, so nav links never
404 and the plan stays legible.

## The inner pages

All of them are one shell, `StubPage.tsx`, so a change to the shell is a change
to every inner page. The account screens are the exception: they use
`AccountShell.tsx`, which is the same banded opening without the "not built yet"
badge, because they are built. It is deliberately the homepage's language one level down:
an opening band with a coloured edge and a hairline under it, numbered cards in
two columns rather than one long list, a dashed aside for the thing that sits
beside the argument, and the same two buttons. Somebody arriving from the
homepage should not feel they have walked into a different website.

- **The "not built yet" badge stays loud.** A stub that does not say it is a stub
  is a lie about the state of the product. Only `/join` and `/licence` omit it,
  because neither is waiting on anything: an email address and a licence notice
  are the whole of what they are.
- **`tone` swaps gold for ember**, and it is the only thing distinguishing one
  inner page from another. Ember is for the pages about people rather than
  features, which today means `/safety` and `/join`. It is the same pair the
  homepage banners use.
- **Actions take `mailto:` as well as routes.** Anything with a colon in it
  renders as a plain anchor, because `Link` would treat it as a route and there
  is nothing for the router to prefetch.
- **`children` is the slot for something real.** A page with a working thing to
  show leads with it and explains underneath: `/campaign` puts the tracker
  there, `/parties` puts the map and the answer to the area you picked. Showing
  beats describing, and both of those already existed as components.

The two pages carrying the most weight now show rather than describe.
`/campaign` runs the real tracker **and the real notebook**, then says plainly
what the shared versions add, because somebody who plays with them for a minute
will otherwise assume they are finished. `/parties` answers the homepage picker with the map: a sentence is
a weak reply to "where can I play", and the map turns "not yet" into "not yet,
and here is how far away that is". Areas inside the corridor get a green line,
areas outside get an ember one and different advice.

`/tables` was renamed to `/parties` and the old route is gone. Every route is a
static prerender except `/parties`, which awaits `searchParams` — a promise in
this version of Next — and is therefore server-rendered on demand.

Not built yet: `/parties/new` (a group of friends signing up together and
skipping the matching), and the safety machinery — reporting, blocking and
removal are described on `/safety` and none of them exist.

## Accounts

Firebase, and it is built: `/sign-in`, `/account/setup` and `/account` are real
screens against a real schema. What is missing is a Firebase project. Drop the
six `NEXT_PUBLIC_FIREBASE_*` values from `.env.example` into `.env.local`,
deploy `firestore.rules`, and it works.

**Nothing breaks without them.** `firebaseReady` is false, `auth()` and `db()`
return null, and every account screen says accounts are not switched on yet.
This is not politeness: the homepage and the character builder must not white
screen because a config object was empty. Present-but-wrong keys are handled the
same way — Firebase throws `auth/invalid-api-key` from inside `getAuth`, and
that throw used to land during render and take the page with it. It is now
caught in `client.ts`, remembered, and reported in a sentence.

| File | What it is |
|---|---|
| `src/lib/firebase/schema.ts` | The single description of what a player is. If the rules and the forms disagree with it, they are the bugs |
| `firestore.rules` | The enforcement. Nothing else is |
| `src/lib/firebase/client.ts` | Lazy init, null accessors, never throws |
| `src/lib/firebase/account.ts` | Every read and write a player makes about themselves |
| `src/lib/firebase/session.tsx` | Who is signed in, and whether they have finished setting up |

**Email and password, in one form.** Registration asks for everything at once —
email, password, username, date of birth, phone, area — and writes the Auth user
and the profile back to back. An earlier version used a passwordless email link,
which was fewer moving parts and worse: it forced an app switch in the middle of
signing up, split registration across two pages, and dead-ended anybody whose
mail was slow or filtered.

The username is checked **before** the account is created. Being told "that name
is taken" afterwards would leave somebody holding a password for an account they
could not finish. If the profile write fails anyway, `/account/setup` picks that
person up rather than stranding them.

There is no Discord button and there was never going to be one: Firebase Auth
has no Discord provider, and adding it means running the OAuth exchange against
a custom token — a server, a secret and a callback route for a login a mailbox
already does.

**The address is proven afterwards, on a seven day clock.** A password signup
cannot prove an email, so a new account runs on trust for a week and is then
*held*: it still signs in and still shows everything it holds, and writes
nothing until the link is followed. Held, never deleted — somebody whose welcome
mail went to spam should not lose their characters over it, and the copy says so
in as many words.

That clock is in `firestore.rules` as `inGoodStanding()`, not only on screen.
`email_verified` is a claim on the Auth token and nothing in the database can
write it. The screens decide what to *say*; the rules decide what is *allowed*,
and if the two ever disagree the rules are right.

**Date of birth is collected once and filters nothing yet.** Thirteen is the
floor for holding an account and the rules do that arithmetic themselves. The
**in-person** age policy is a separate and still open question — see `/safety`,
which still says so. It is asked at the door because asking every existing
player for it later is a far worse job.

**The username is permanent.** Claimed once in a transaction against
`usernames/{lower}`, and the rules refuse to change it afterwards. The check as
you type is a courtesy and can be wrong: two people can pass it in the same
moment, so the transaction is what decides, and the form is written to be told
no. If the check cannot reach the database at all the field says so and still
lets you claim — the transaction is the real gate either way.

The lock and the profile are one act: the rules will not accept a profile create
unless the matching `usernames/{lower}` document is written in the same
transaction and points back at the same uid. Without that the profile create
never consults the locks at all, and a second player could hold a name somebody
else had claimed while both documents looked correct on their own.

**Phone and area are private, and there is no public profile document.** The
profile is readable by its owner alone. Matching will read it server side.
Rule 8 in full: match on the point, render the area. There is no second document
holding "the public bits" on purpose, because the moment there is, somebody has
to decide what goes in it.

**The week is seven strings of four characters**, one per day, one character per
block of the day, "1" for free. Not a list of time ranges: the question is not
"what hours suit you" but "can you be at a table on Thursday evening", and
comparing seven short strings is something a database can do without thinking.
Anyone who needs 19:45 to 22:15 is describing a preference, not a constraint.

**Five characters, counted on the profile.** Firestore rules cannot count a
collection, so `characterCount` is a field and the rules use `getAfter()` to
insist it moves in step with the write that changes it — a create must increment
it by exactly one and land under the limit, a delete must decrement it. That is
why `createCharacter` and `deleteCharacter` are batches: half of either is
refused. The limit is then enforced three times over — the button disables, the
client throws before writing, the rules refuse — and only the last one is a
guarantee. The other two exist so the message can be a sentence rather than
"permission denied".

**setState in an effect is a lint error here**, and every account screen is
written around it. The username verdict is stored with the name it was about and
compared during render, so a stale answer is simply not an answer to the
question being asked. The signed-in email shows through a `null` state rather
than being copied into one. Anything that only exists in the browser —
localStorage drafts, whether this page load is somebody following their link —
is read through `useHydrated`. `Nav` stays a server component; only
`NavAccount` knows who is looking.

## Parties, and the console that makes them

**A party is the campaign.** One document, one lifecycle: `parties/{partyId}`,
with `members` and `sessions` hanging under it. It forms, it gets a game
master, it plays. There is no separate campaign entity, because there was never
a moment where the two would differ and two documents to keep in step is a bug
waiting for a bad night.

README rule 7 is in `src/lib/party.ts` and again in `firestore.rules`: four to
six players, the game master is not one of them, and no game master is attached
to a party that is short of four. The console is a form, and a form is a
suggestion; the rules are what refuse.

**`/admin` is the room where parties get made.** Not linked from anywhere, and
`robots: noindex, nofollow`.

- **Everyone who has an account**, filterable, with the numbers masked until
  asked for. That last part is not ceremony: this is the one screen in the
  product that can show two hundred phone numbers at once, and it is the kind of
  screen people photograph to send to somebody.
- **The overlap, live.** Tick four players and the console intersects their
  weeks and tells you the hours all four share, before the party exists. Four
  people with plenty of free time and no evening in common are not a party, and
  this is the only screen that can say so. It says so in red, and still lets you
  form it, because somebody may be about to change their week.
- **Assigning a game master** from the people marked as one. Marking somebody is
  admin-only and the rules enforce it: game masters are recruited and met in
  person, and self-promotion is not a route into other people's evenings.
- **The group chat**, on which see below.

**Admin is a custom claim, not a database field.** `node scripts/grant-admin.mjs
you@example.com` sets it with the Admin SDK, and it needs a service account key
that lives outside this repository and never in it. The claim is checked twice:
the console checks it to decide what to render, `firestore.rules` checks it to
decide what is allowed, and only the second one matters. Somebody who forced the
console to render without the claim would see a table of permission errors.

An admin reads profiles and parties. **An admin cannot read a party's notebook**,
and rule 9 has no exception for one. They can see that a party exists and who is
in it. What was said on a Thursday night is not theirs.

### The WhatsApp button, honestly

**WhatsApp cannot create a group from a link or an API.** `wa.me/<number>` opens
a single chat, `chat.whatsapp.com/<code>` joins a group that already exists, and
the Business Cloud API does not make consumer groups. There is no automation
that turns six numbers into a group, and anybody who tells you otherwise is
describing something else.

So the console does the half that can be automated and is plain about the half
that cannot:

1. **Copy the numbers**, formatted for WhatsApp's new-group screen. You paste,
   name the group, done.
2. **Paste the invite link back**, stored on the party, so the site can hand it
   to every player — including anyone added later, who would otherwise have to
   be chased.

There is also a direct `wa.me` link per player, which is the one thing WhatsApp
does support, for when you only need to reach one of them.

### One promise this changed

`/account` used to tell players their number was "seen by nobody but you until a
game master books you a seat". The console makes that false. The copy now names
us: your number is visible to whoever runs Quests & Fables, because a party
cannot be assembled by somebody who cannot see who is waiting, and never to
another player. Fixing the sentence was the only honest option — the alternative
was a true-sounding promise and a table full of phone numbers.

## Matching, and the two things that are not scored

`src/lib/match.ts` is where `/safety` stops being a page of promises. Two of
the things that page says are only true if something enforces them:

- **Venue type is a hard filter.** Nobody is offered a home game they did not
  ask for. Not ranked lower, not shown with a warning. Not offered.
- **A table that conflicts with your limits is never shown to you at all.** The
  alternative is asking the person with the least power in the room to raise it
  at the table, which is asking them to do the hardest thing there.

Everything else — hours, area, seats left — is a score. Those two are not, and
`Fit.blockers` is a separate field from `Fit.score` so that no future ranking
tweak can weigh a hard limit against a good evening.

**Host and guest are not the same flag**, and that asymmetry is load-bearing. A
public venue needs everybody to accept one. A home game needs *one* person
willing to host and *everybody else* willing to be a guest — the host is not a
guest in their own house. Collapsing the two would put a player who only ever
ticked "my own home" into a stranger's house on the strength of an offer they
made about their own front room. The first version of this file got it wrong in
exactly that direction and the tests caught it.

**A party is matched against an aggregate, never against its members.** Weeks,
limits and venue comfort are private, and a player browsing open tables must not
be able to read another player's profile. So the party document carries
`profile`: the hours its members share, the rooms they can all use, and the
strictest limit any one of them has drawn. Nobody learns *which* of the four is
the one who will not go to a stranger's house.

That aggregate is denormalised, which means it can go stale. It is recomputed by
whoever changes the membership, which today means the admin console — both when
a party is formed and when a seat request is accepted. **Forgetting it means a
table advertising an evening its newest member cannot make**, so both paths in
`src/components/admin` write `playerIds` and `profile` together.

Two more places the privacy line is drawn:

- **The seat count on `/parties` is computed from the tables shown**, not from
  every table that exists. Counting them all would be the one number telling a
  filtered-out player that there is a table they cannot see.
- **A signed-out visitor** gets where a table meets, when, and how many seats
  are left. Never who is at it. Nothing is known about them, so nothing can be
  filtered on their behalf.

## Sheets, and why a game master cannot read your account

A player's characters live on their profile and are readable by them alone.
A game master needs to see the sheets at their own table. Rather than widening
that rule, **a player hands over a copy**: `parties/{id}/sheets/{uid}`, written
by its owner, readable by everybody at that table.

It is a snapshot on purpose. Editing a character in the builder does not quietly
change the sheet five other people are looking at mid-session — bringing it
again is how you update it, and that is a deliberate act rather than a sync.

`Tracker` takes its characters as a prop now, so the same component runs on four
made up adventurers at `/campaign` and on a real party's nominated sheets at
`/campaign/[id]`. Neither copy knows which it is.

## The notebook

Two books under one session, and the difference between them is the feature:

| Book | Written by | Read by |
|---|---|---|
| The party's record | Every player | Every player, and the game master |
| The game master's own | The game master | The game master |

The party's record is theirs. A game master who could edit it could quietly
correct what the table believes happened, and what the table believes happened
is the only thing the record is for. Their own book is the other half of that
bargain: somewhere to write down the thing the party has not worked out yet.
Enforced in `firestore.rules` on every note, not in the UI.

**Notes are separate authored entries, not one document six people type into.**
A shared document needs a CRDT, cursors and conflict resolution, and it cannot
answer "who wrote this" — which is exactly what the rule above is enforced on.
Separate notes never contend, arrive one at a time over `onSnapshot`, and give
a player the right to edit their own line and nobody else's. Deleting somebody
else's note is a moderation action, not a game master power.

**A session is the folder.** `parties/{id}/sessions/{sid}/notes/{nid}`, and
the session carries the number, the title the players gave it, and whether it is
still open. Notes go in the session being played; closed sessions are read.

**Search is built in the browser, and that is a deliberate cost trade.**
Firestore has no full-text index, and paying a document read per keystroke would
be absurd. So the campaign is read once and indexed locally: a year of weekly
play is roughly 1,500 notes at three hundred bytes, which is under half a
megabyte. It also keeps working with no network.

**"Read once" is the expensive part, and `src/lib/notecache.ts` is the answer.**
Reads are billed per document, not per query, so a full campaign load is 1,500
of them *every time somebody opens the notebook* — six players doing that daily
would eat a free tier on one campaign. Notes are therefore cached in IndexedDB
and each session is asked only two questions:

1. **What changed since I last looked?** Nothing, for any session that finished
   weeks ago, and an empty query bills one read rather than thirty.
2. **How many are there?** Because a deleted note does not appear in the answer
   to the first question. It stops existing, and nothing in the response says
   so. A server-side count that disagrees with what we hold means a delete, and
   the only repair a delete allows is re-reading that one session.

An idle campaign of fifty sessions costs about a hundred reads instead of
fifteen hundred, and returns without a note crossing the wire. The cache is
keyed by uid as well as campaign, and **signing out clears it** — two people
sharing a browser must never be handed each other's copy, and the game master's
own book is why that is a real step rather than tidiness.

The fan-out of one query per session stays, deliberately. Collapsing it into a
collection group query would need a `match /{path=**}/notes` rule, which is
exactly the database-wide wildcard `firestore.rules` opens by refusing to have,
and it would buy latency rather than reads. If reads ever bite again after the
cache, the next lever is compacting each closed session's notes into a field on
its session document: fifty reads for a cold load instead of fifteen hundred,
at the price of a copy that drifts when somebody edits an old note.

Both queries need composite indexes, and they are in `firestore.indexes.json`
rather than clicked into the console, so a query and the index it needs live in
the same repository.

`src/lib/search.ts` is the whole of it and knows nothing about React or
Firestore. Worth knowing about it:

- **Accents fold.** Half the places in this country are written three ways in
  English, and a party will record *Jbeil* one week and *Jbeïl* the next.
- **Prefixes match, and score less than whole words**, so `ced` finds *cedar*
  while you are still typing.
- **Highlighting is returned as runs, not markup.** The component decides what a
  hit looks like, and nothing in the search path is trusted with HTML. It folds
  through a length-preserving variant, because NFD turns one accented character
  into two and every offset after it would be wrong.
- **The glossary is not proper-noun extraction.** Six players spell an invented
  name six ways, and a glossary that is confidently wrong is worse than none. It
  is terms recurring across several notes, minus English's own furniture and
  minus author names — every note has an author, so they would top the list for
  ever.

`/campaign` runs it on three made up sessions that pick up where the homepage
tavern leaves off, with one control the real thing will never have: a switch
between sitting at the table and sitting behind the screen. The two books have
different readers, and that is invisible unless you can stand in both places.

⚠️ `src/lib/firebase/notebook.ts` is written and **nothing calls it yet.** The
parties it hangs off now exist in the schema and the console, but no player-facing
screen reads a real one. It exists now
because the shape and the rules had to be decided together, and the demo runs
the same component against the same types.

## Game masters are hired, not signed up

There is no game master registration anywhere on the site. `/join` explains the
arrangement and gives one email address, and the hero carries the invitation next
to the player call to action rather than as a second card of equal weight.

This is not only a copy decision. `Scope v1.md` has the platform **assigning** a
game master to a party once it is full enough, and the safety page promises we
know every game master personally. A public sign-up form quietly breaks both, and
the old `/onboarding/gm` stub described the opposite product: post a table,
collect applicants, pick who you like. Sign-in is untouched, since that is a
login and not a registration.

## Homepage

Sections in order, each ending in a link to the feature it describes, so the page
doubles as the map of what exists: hero and player call to action → **where you
play** (Lebanon area picker) → *safety banner* → **the tavern** (the fable) →
**the journey** → *character builder banner* → **at the table** (the tracker,
playable). Areas live in `src/data/lebanon.ts` — 8 governorates, 46 areas. Adding
a town is a data change.

**The two banners are interruptions, not sections.** Safety and the character
builder used to be full sections at the bottom of the page, which is the worst
place for either of them: a free builder and a safety stance want to be run into
on the way past, not scrolled to the end to find. Each is now a strip
(`Banner.tsx`, copy in `src/data/banners.ts`) sitting next to the thing it
argues with. Safety goes under the map, where the reader has just been told they
will be meeting strangers somewhere real; the builder goes under the journey,
where it was just described as the thing you can do before you have a party.

Nothing was lost with the sections, but check before trimming a banner: `/safety`
carries all four promises the trust section listed, in more detail, plus what
happens when we can no longer say we know every game master personally. The
warning that used to sit in `Trust.tsx` about that claim expiring now lives in
the doc comment of `src/app/safety/page.tsx`, next to the claim itself. "We never
touch the money" is still said on the homepage, in the hero.

## The journey

`src/components/HowItWorks.tsx`, with the stops and the branches in
`src/data/journey.ts`. It replaced a row of four numbered boxes.

**The spine is what everyone does. Branches are what is there if you want it.**
That split is the reason for the shape. A row of numbered steps says every
feature is a stage you must pass through, and that is not true: the character
builder needs no account and no party, bringing your own five friends skips the
matching entirely, and the notebook only matters once you are playing. Those
hang off the line where they become relevant, dashed and dimmer, and the line
goes past them either way.

- **The line is measured, not authored.** The markup lays out as an ordinary
  grid; then the nodes are measured and a curve is fitted through wherever they
  landed, on a `ResizeObserver` so it survives a rewrap, a web font landing or
  a phone folding the whole thing into one column. A hand-drawn SVG path would
  be wrong by the first content edit.
- **Two cubics, no more.** Between stops the control points are pulled
  vertically, so a change of side bends into an S rather than a corner. Out to a
  branch they are pulled horizontally, so it leaves the spine like a turning off
  a road.
- **Stops alternate sides and the node hugs its own card**, which is what gives
  the line something to weave between.
- **The line draws on scroll**: one dash the length of the path, slid to nothing
  on a scrub, since DrawSVG is Club GreenSock and this project has the free
  package.
- **The line is the clock.** A stop appears when the drawn end of the line
  reaches its node, not when it enters the viewport, and those are different
  moments that look different. `spineThrough` returns each node's distance along
  the curve as a fraction, the scrub's `onUpdate` compares that against how much
  of the line is drawn, and the stop, its turning and its branch cards land in
  that order.
- **It cannot fail closed.** Two rules, both learned by breaking it. *Nothing is
  hidden until something is watching*: the hidden state lives behind an `armed`
  class added only once the ScrollTrigger exists, so with no JS or under reduced
  motion the section is simply text. *Nothing stays hidden*: a sweep reveals
  anything left sitting in the viewport after two and a half seconds, so a missed
  callback costs an animation rather than the words. The first attempt used
  `gsap.from` inside the measuring effect, which re-hid every card on every refit
  and rendered the section blank.
- **A dotted line cannot draw itself with `stroke-dashoffset`**, because the dash
  pattern is already using it and sliding the offset only marches the dots along.
  Each turning is therefore masked by a fat solid stroke of its own shape, and
  that is what slides: the dots stay dots and are uncovered from the spine
  outwards. Its length comes from walking the cubic rather than measuring the
  DOM, so the mask is right in the first frame.
- **It runs both ways.** What is revealed is a function of where the line is
  now, not a memory of where it has been: scroll back up and cards leave and
  turnings retract exactly as the line retracts. The state is one number, how
  many nodes the line has reached, which also means the section re-renders five
  or six times over its whole height rather than on every scroll tick.
- **Revealed-ness is React state**, not a class poked into the DOM. Every refit
  of the line re-renders this section, and a hand-added class only survives that
  by accident.

**If none of it animates, check the machine before the code.** Under
`prefers-reduced-motion: reduce` this section is deliberately inert: the line is
drawn from the start, nothing is ever hidden, and every card is simply there.
That is README rule 5 working, and it looks identical to the animation being
broken. On Windows the switch is Settings, Accessibility, Visual effects,
Animation effects; in a console, `matchMedia("(prefers-reduced-motion: reduce)").matches`
answers it in one line. This cost an afternoon once.

## The tracker on the homepage

`src/components/Tracker.tsx`, with the party in `src/data/table.ts`, framed on
the homepage by `AtTheTable.tsx` and rendered again on `/campaign`. Neither
copy knows where it is being rendered, which is the point of the split. It used
to be a picture of a dashboard. A picture cannot show the only thing worth
showing, which is how little work it is, so it is now a working reducer over
four made up characters: spend a slot, damage somebody, drop a condition on
them, call a rest for the whole table.

It is a demo, but **every rule it obeys is a rule the real tracker has to
obey**, which is why it is worth having in the repo at all.

- **Nothing asks what class anyone is.** A short rest gives back the slots whose
  `recovery` says `"short"`, which happen to be the warlock's, and no line of the
  component knows the word warlock. README rule 11 in the smallest possible
  space. Verified by driving it: short rest restored Vess's two slots and left
  the cleric's five spent.
- **Ability scores in, everything else out.** Skill and save modifiers, passive
  perception and initiative are derived, never typed in, for the same reason
  `engine.ts` derives them: two numbers meant to agree will stop agreeing the
  first time somebody edits one. All eighteen skills and all six saves are there,
  folded behind one line per card, with the proficient ones marked rather than
  listed separately.
- **Temporary hit points are a buffer, not a bonus.** Damage eats them first,
  healing never puts them back, they do not stack (you keep the better offer, and
  the tracker says so out loud when a smaller one is dropped), and a long rest
  ends them. They sit beside the real hit points rather than being added into
  them, because they are a different thing, and they ride on the end of the bar
  as a striped gold shield. The bar scales to whichever is larger, the hit point
  maximum or health plus shield, so a full sheet with temporary hit points on it
  reads as a full bar with a cap on the end rather than a green bar that has
  mysteriously shrunk.
- **Zero is unconscious, minus your own maximum is dead.** Damage is a typed
  amount, hit points run negative, and the floor is `-hpMax`, which is the
  massive damage rule. Healing starts again from zero rather than climbing out of
  the negative first. Unconscious is derived from the number rather than stored
  next to it, so the two cannot disagree.
- **A long rest does not raise the dead**, and a dead sheet is inert: the card
  greys out, the word sits across it, and the whole body is a `<fieldset>` with
  `disabled` on it, so nothing behind the banner can be clicked or tabbed into.
  One control remains, and it is Revive, which puts them on one hit point.
  Greying a card out is not the same as making it unusable, and only one of those
  is true here.
- **Exhaustion is a level, not a flag**, because it is the condition every table
  forgets. It counts up, and a long rest takes one off.
- **Nothing rolls.** Modifiers are shown so you can roll your own dice. The
  moment this demo rolls something it starts lying about what the product is.
- **The live region is not decoration.** Every action writes a line of plain
  English under the controls, so a screen reader hears "long rest, hit points
  full, every slot back" rather than four cards silently changing.

Reset puts it back, so the state never has to survive anything.

One layout note worth keeping: saving throws are labelled boxes rather than
rows. As rows, "Str +1 Dex +0 Con +2" puts more space between a label and its own
number than between one pair and the next, and the eye pairs them wrongly. It was
reported as two missing saves, which is exactly what it looked like.

## The tavern

`src/components/Tavern.tsx`, and the room itself in `src/data/tavern.ts`. Six
figures — a barkeep, a serving maid, three adventurers and a hooded stranger —
play the oldest opening in the hobby. The serving maid asks what she can get
them; they answer ale, bounties, glory and swords for hire; and the barkeep puts
a job on the table, because the mayor's daughter is in grave danger. It is the
same promise the journey makes in five stops, shown as the thing
itself rather than described.

The component never names a character. Cast, positions, artwork paths and
dialogue are all data, so recasting the room or rewriting the scene is an edit to
`tavern.ts` alone.

- **Three layers: room, cast, then furniture back over the top.** `table.webp` is
  painted over every figure, so the three adventurers can be placed with their
  waists behind it and read as sitting *at* the table rather than behind it.
  Move the table and those three placements move with it.
- **The bar counter is a cut of the room render, put back on top.** Identical
  pixels in the identical place, so the only edge that shows is the countertop,
  and the barkeep stands behind her bar. It sits between two figures in the
  stack, above her and below the serving maid who walks past it, which is what
  the `z` on a prop is for. The stage therefore carries the room image's aspect
  ratio rather than a round 16:9, so a prop cut from it lands where it was cut.
- **The room underneath is still CSS**, a hearth glow on the right and candle
  light over the middle table, so the section survives the artwork going missing
  and the fire keeps moving over a still image.
- **Figures are placed in percentages of the stage**, twice: `wide` for the wide
  room on desktop and `narrow` for the 3:4 room on a phone. Both ship as custom
  properties and the stylesheet picks one. Furniture is desktop only: the phone
  crops the room, so a counter cut from it would no longer line up, and a table
  across a portrait frame buries the people it seats.
- **Nothing cycles.** The scene rests on its first line, the serving maid asking
  what she can get them, and that is what somebody who never moves the mouse
  reads. Point at anyone else and the room answers with their line; take the
  pointer away and it settles back on her. There is no timer, which is why this
  section has no GSAP in it at all and why README rule 5 costs nothing here:
  there is no motion to reduce.
- **Hovering gives a figure an old gold contour.** Three stacked `drop-shadow`s
  rather than an outline or a border, because a drop-shadow traces the cut-out's
  alpha and an outline would trace its rectangle, hood and lantern and sword
  included.
- **The dialogue exists as text.** The stage carries `aria-hidden` and the
  bubbles in it are decoration, so the whole scene is written out again in an
  offscreen list, in order. It is clipped rather than `display: none`, because
  `display: none` is not read out either.
- **The cards under the scene are backstory, not a legend.** Two lines on who
  each of them is. What the site does is said once, above the room, and by the
  two links under it.

Artwork is generated (Higgsfield `nano_banana_pro`), one prompt per figure and
one for the room, all sharing a style contract so six separate generations still
agree about where the light comes from. Each one was generated on chroma green
and cut out with ffmpeg rather than asked for on a transparent background, which
turns the cut-out into a mechanical step instead of a hope.

**The cut is a flood fill from the backdrop inwards, not a colour key.** A
colour key deletes every green pixel in the frame, and the first pass of it ate
the newcomer's olive trousers from the knee down. The fill seeds only on
violently green pixels and spreads only through near-green ones, so a green-ish
costume is never a seed and is never reached from one.

A figure whose file goes missing falls back to a dashed box carrying its name,
its role and the filename it wants, exactly like the dragon eye, so replacing one
is overwriting a file. `public/assets/tavern/README.md` carries the prompts, the
cut-out recipe and the ffmpeg trick for composing an arrangement without a
browser.

## The dragon eye

`src/components/DragonEye.tsx`. The photo is drawn twice. The bottom copy never
moves; the top copy is clipped to an ellipse over the iris and slides *inside
that fixed window*, so the iris and slit pupil glance around while the eyelid,
scales and horns stay locked to the frame. Blinking is two dark lids sliding in
to meet at the centre line, a photograph has no closed-eye frame to cut to.

Tuning is split on purpose:

- **Position**, the `EYE CALIBRATION` block in `src/app/globals.css`
- **Timing and behaviour**, `src/lib/eye.ts`

In dev, press `C` for a calibration ruler with arrow-key nudging (`1` to `4` switch
what you're nudging, `shift` for coarse steps, and it prints a CSS block to
paste back into `globals.css`). It is a dev-only chunk that production never
loads.

The photo is now in the repo — `dragon-eye.jpg` as the poster and
`dragon-eye-loop.mp4` as the loop. If either goes missing the hero falls back to
a hatched placeholder that says so.

## The character builder

Ported from `Resources/character-builder.html` in the vault, not rewritten as
React forms. Three files carry the whole thing:

| File | What |
|---|---|
| `src/lib/rules.ts` | The ruleset. Steps, filters, spell slot tables. **Data only.** |
| `src/lib/engine.ts` | Resolve, evaluate, derive. Pure functions, no React. |
| `src/lib/character.ts` | The document, storage, and the resolved sheet |

`Builder.tsx` switches on a step's **type** and never on what was chosen. Adding
a class, a subclass, or a second game system is an edit to `rules.ts` alone. The
moment any component branches on a class key, this is over.

The proof that it works: warlock spell slots come back on a **short** rest and
everyone else's on a long one, and no file anywhere asks whether a character is
a warlock. Recovery is a field on the slot row, read by the rest handler.

**Both build modes resolve to one `ResolvedSheet`.** An SRD character and a
hand-typed custom one produce the identical shape, so `Sheet.tsx`, and later the
tracker and the game master's dashboard, cannot tell them apart. If you ever need
`isCustom` in a condition below the sheet, the bug is in `character.ts`.

Not built yet, deliberately: equipment, and choosing individual spells. Spell
*slots* are in because the tracker needs them. Class resources such as rage and
ki are not in the SRD dataset as tables, so rather than invent them unverified,
players add what they need by hand exactly as on a custom sheet.

Drafts save to `localStorage`. Building a character has never needed an account
and never will, so there has to be somewhere to keep one. That stayed true after
accounts landed: `/account` offers to copy the draft in this browser onto the
account, and to copy a saved one back so the builder can open it, and neither
direction happens on its own. See [Accounts](#accounts).

## Homepage images

| Asset | Size | Notes |
|---|---|---|
| `dragon-eye.jpg` + `dragon-eye-loop.mp4` | 59KB / 658KB | The hero |
| `lebanon-map.webp` | 39KB | Lebanon at night, generated (Higgsfield `nano_banana_pro`), downscaled to 760px and converted to webp |
| `tavern/*.webp` | 456KB total | The room, six figure cut-outs, and the table and bar counter drawn back over them. Generated (Higgsfield `nano_banana_pro`), keyed off chroma green, downscaled to roughly twice their on-screen size. Prompts and recipe in `public/assets/tavern/README.md` |

The map's **glow is CSS over a still, not video, on purpose.** A generated clip
does not loop — first and last frames differ, so `loop` jumps every few seconds.
A CSS pulse is seamless, weighs 39KB instead of megabytes, and switches off under
`prefers-reduced-motion`, which a background video cannot. The bloom's position
is tuned to this particular render; replace the image and the percentages in
`LebanonMap.module.css` move with it.

## Rules that are not preferences

1. **The SRD attribution is a licence obligation.** CC-BY-4.0 is the only reason
   this project is viable, and credit is the single thing asked in return.
   `/licence` carries the notice verbatim, along with the Wizards of the Coast
   disclaimer and the money position. **That page does not make the footer credit
   optional.** CC BY 4.0 asks for the notice "in any reasonable manner based on
   the medium, means, and context" and explicitly allows satisfying it with a
   link to a resource that carries the information. The footer therefore carries
   a one line credit and a link to `/licence`, and **that link is the part doing
   the legal work**: if it breaks, or if the page ever loses the verbatim notice,
   the footer stops discharging the obligation and the full text has to come
   back. A footer with neither is not defensible. Anywhere SRD content is shown
   prominently, above all the character builder, needs the credit or a link to it
   as well.

   `/licence` also states that the material was modified, which CC BY 4.0
   § 3(a)(1)(B) requires and which is true: the SRD is reorganised into
   structured data, and the sentence describing each option is ours rather than
   the document's. Keeping our own wording is worth doing for its own sake. The
   less of the document the site reproduces, the less of the site rests on the
   licence at all.
2. **SRD 5.2.1 only.** No 2024 PHB content, ever. Every content row carries
   `source` and `license` so a takedown is answerable in one query. Never seed
   content from wikis, D&D Beyond, or scraped datasets.
3. **"GM" and "table", never "DM" or "Dungeon Master".** Trademark hygiene, and
   it's what the hobby says anyway.
4. **The character builder is a renderer, not a form.** No component may ever
   contain `if (class === "wizard")`. Adding a class, a homebrew subclass, or a
   whole other game system is a data change. Port the prototype engine; do not
   rewrite it as React forms.
5. **All motion stays behind `prefers-reduced-motion`.** A hero built entirely
   from motion is exactly the case where ignoring that setting hurts.
6. **Every collection is denied by default, and its rule is written with it.**
   `firestore.rules` ends in a `match /{document=**}` that allows nothing, so a
   collection nobody wrote a rule for is unreadable rather than public. A rule
   that trusts the client is not a rule: the five-character limit, the permanent
   username and the owner-only reads are all enforced there, and the code in
   `src/lib/firebase/` exists to satisfy them, not to replace them.
7. **A party is 4 to 6 players, and the GM is not one of them.** Enforce it in
   the schema, not just the UI: `firestore.rules` refuses a seventh seat, and
   refuses a game master on a party short of four or already in its player list. Under 4 it cannot be assigned a GM; at 6 it is
   closed.
8. **Never expose a user's precise location to another user.** The admin
   console is the one place a phone number and a home area are readable by
   somebody other than their owner, it is behind a custom claim, and `/account`
   says so in words. There is no second exception. A party is matched on an
   aggregate rather than on its members for the same reason: a table can say
   what hours it shares and what it will not play through without saying which
   of the four said so. Match on the
   point, render the area. This is a safety rule, not a privacy nicety — these
   people meet in person.
9. **The party's record is written by players and never by the game master.**
   Not a UI preference — it is a rule on every note in `firestore.rules`. A game
   master who can edit the record can rewrite what the table believes happened,
   and that record is the only thing standing between six people and six
   different memories of session four. Their own book is private in the other
   direction, and no view, query or export may merge the two.
10. **No payment processing, ever, in this codebase.** A session carries a price
   and a settled flag. Money moves between two humans, off-platform. Adding a
   processor turns this into money transmission and is a legal question, not a
   feature.
11. **Live campaign state is an append-only event log.** Never `UPDATE
    characters SET current_hp`. Damage, healing, conditions, rests and spent
    resources are events with an author; current state is a fold over them, and
    `character_state` is a rebuildable cache. Six people write at once at a real
    table, and undo has to be free.
12. **Rest and recovery rules are ruleset data, not code.** Warlock slots return
    on a *short* rest and everyone else's on a long one. Every resource carries
    its own recovery rule, and the rest handler reads it. `if (class ===
    "warlock")` is the same bug as rule 4.
13. **The custom character form ships blank.** No dropdown of non-SRD
    subclasses, no seeded autocomplete, no import. A blank form the user types
    into is their content; a form that hands them the content makes us the
    distributor. Custom sheets stay private to the character in v1 — sharing
    them needs DMCA safe harbour registered first.
14. **The tracker never asks what class a character is.** SRD-built and custom
    characters resolve to the same sheet shape, and everything downstream reads
    that shape only.
15. **No em dashes in copy. Ever.** Not `—`, not `–`. They read as
    machine-written, and this audience is unusually good at spotting that. Use a
    full stop when the thought is finished, a comma when it isn't, a colon before
    a list, and brackets for a genuine aside. If a sentence only works with a
    dash, it wants to be two sentences. This covers every word a visitor reads:
    body copy, headings, alt text, `metadata` titles and descriptions, button
    labels, stub-page steps. Code comments are exempt, since nobody browsing the
    site reads them.

## Copy style

Beyond rule 14: no exclamation marks, no "revolutionary" or "seamless", no
"simply" or "just" in front of something that isn't simple. British spelling
(`colour`, `armour`, `centre`). "Game master" written out in copy, never "GM" on
a first mention and never "DM" at all. Prices and party sizes in words when they
open a sentence, digits when they are data.

Say the concrete thing. *"Four to six players"* beats *"the perfect group size"*,
and *"we never touch the money"* beats *"secure and trusted payments"*.

## Next

**Phase 1 is done.** The character builder is built, the engine is ported, and it
never needs an account — it can launch standalone the day there is a domain.

**Phase 0 is nearly done.** The Firebase project exists, its six keys are in
`.env.local`, and the Firestore database has been created. What remains is
deploying the rules and indexes, switching on email and password sign-in, and
granting the first admin claim. Then Sentry and a host.

**Phase 2 is written.** Availability, locations, venue comfort and limits live
on `/account`; parties have a schema, an admin console and a matcher; and a
player can browse open tables, ask for a seat, be given one, bring a character
to it and write in its notebook. None of it has ever run against a real
database, because there is not one yet. **Treat every line of it as untested
against Firestore until the day the keys land**, and expect the first hour after
that to be about rules and indexes rather than about features.

**What is genuinely not built**: `/parties/new` for a group of friends who want
to skip the matching, and the safety machinery. `/safety` describes reporting,
blocking and removal, and none of the three exists. That is the largest gap in
the product and it is a promise-shaped one. See `Scope v1.md`.

Blocked on Mark: **deploy the rules** (`firebase login` then `firebase deploy
--only firestore:rules,firestore:indexes`, or paste `firestore.rules.min` into
the console), **switch on the Email/Password sign-in method** in Auth, grant
yourself the admin claim
(`node scripts/grant-admin.mjs you@example.com`, which needs a service account
key kept outside this repo), **make `gm@questsandfables.com` exist**, since `/join` is the
only route a game master has and it asks them to write to a mailbox nobody owns
yet, buy `questsandfables.com` (+ `.gg`, `.app`), drop in
`dragon-eye.jpg` and calibrate, **approve the tavern scene, its cast and its
seven lines** (regenerating any one figure is one prompt, see
`public/assets/tavern/README.md`), **decide the in-person age policy** (18+, or
under-18 at partner venues with parental consent — it blocks the parties schema),
and **get this folder onto GitHub**, the previous copy of this codebase was lost
because it only ever existed on one disk.
