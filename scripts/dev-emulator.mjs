/**
 * The whole site, locally, against throwaway Firebase emulators.
 *
 *     npm run dev:emulator
 *
 * Register, fill in a profile, save a character, ask for a seat, build a party
 * from the admin console, open a campaign. Every account is disposable and the
 * database is empty again next time.
 *
 * Why this exists rather than just pointing `npm run dev` at production:
 * `firestore.rules` gives a claimed username no release path from the client,
 * and there is no Admin SDK for this project. One test signup against the real
 * database burns that username permanently. So the real flow could not be
 * exercised end to end at all until the emulators were wired up.
 *
 * Serves on the first free port from 3002 up, so it runs alongside a normal
 * `npm run dev` on 3000. The port it picked is printed when it starts.
 *
 * Needs a JDK on PATH for the Firestore emulator. Without one this exits with
 * Firebase's own "Could not spawn java" message, which is clear enough.
 *
 * Sets the flag here rather than in `.env.local` on purpose: a stray
 * NEXT_PUBLIC_FIREBASE_EMULATOR left in an env file would silently point a
 * normal `npm run dev` at an empty database, and the failure would look like
 * lost data rather than a misconfiguration.
 */
import { spawn } from "node:child_process";

/* Must match NEXT_PUBLIC_FIREBASE_PROJECT_ID, or the SDK and the emulator end
   up in different namespaces and every read comes back empty. */
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "quests-and-fables";

/*
  Its own port, so this and a normal `npm run dev` can run at the same time:
  3000 talking to the real project and this one to the emulators. Sharing a port
  would mean the tab already open silently changes which database it is on.

  The port is found rather than fixed. `next dev` hunts for a free port by
  itself, but under `emulators:exec` it is a child process whose failure takes
  the emulators down with it, and a hardcoded 3002 collides with whatever was
  left running an hour ago. Nothing is more tedious than a dev script that only
  works on a clean machine.
*/
async function freePort(from = 3002, tries = 20) {
  const { createServer } = await import("node:net");

  /*
    Bind the way `next dev` binds: no host, which is dual-stack on Node. Probing
    "0.0.0.0" instead reports a port free when something else holds only the
    IPv6 side of it, and the child then dies with EADDRINUSE on a port this
    script just promised was available. Found exactly that way, against a dev
    server belonging to an unrelated project.
  */
  const available = (port) =>
    new Promise((resolve) => {
      const probe = createServer()
        .once("error", () => resolve(false))
        .once("listening", () => probe.close(() => resolve(true)))
        .listen(port);
    });

  for (let port = from; port < from + tries; port++) {
    if (await available(port)) return String(port);
  }
  throw new Error(`No free port between ${from} and ${from + tries}.`);
}

const PORT = process.env.PORT || (await freePort());

/* One string rather than an argv array: with `shell: true` the array is joined
   and re-parsed, which splits the quoted inner command into three arguments and
   gets "Too many arguments" back from firebase-tools. */
const command =
  `npx --yes firebase-tools@15 emulators:exec`
  + ` --only auth,firestore --project ${PROJECT} "npx next dev -p ${PORT}"`;

console.log(`
  Emulator mode. App on http://localhost:${PORT}
  Throwaway accounts, an empty database, and nothing touching production.

  No Emulator UI: "ui" is not a valid --only target, so emulators:exec never
  starts it. For that, run the emulators on their own with
  npx firebase-tools emulators:start
`);

const child = spawn(command, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_FIREBASE_EMULATOR: "1" },
});

child.on("exit", (code) => process.exit(code ?? 0));
