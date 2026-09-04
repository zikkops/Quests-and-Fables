/**
 * Grant or revoke the `admin` custom claim.
 *
 *   node scripts/grant-admin.mjs you@example.com --key "C:/path/to/key.json"
 *   node scripts/grant-admin.mjs you@example.com --revoke --key "C:/path/to/key.json"
 *
 * This is the only way an admin exists. The claim is not a field in Firestore
 * and cannot be set from a browser, which is the point: the console reads every
 * player's phone number, and the thing standing between that and the public is
 * a token claim only a service account can write.
 *
 * **The service account key never goes in this repository.** Download it from
 * the Firebase console (Project settings, Service accounts, Generate new
 * private key), keep it outside the project, and point at it:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/somewhere/private/key.json \
 *     node scripts/grant-admin.mjs you@example.com
 *
 * The person you grant it to has to sign out and back in, or the token in
 * their browser is the one from before they were an admin. Claims are baked
 * into the ID token at sign-in and refreshed roughly hourly.
 */

import fs from "node:fs";

const [email, ...flags] = process.argv.slice(2);
const revoke = flags.includes("--revoke");

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/grant-admin.mjs <email> [--key <file>] [--revoke]");
  process.exit(1);
}

/*
  Credentials, in the order they are least annoying to supply.

  `--key` comes first because on Windows an environment variable is a poor
  interface: it is spelled one way in bash and another in PowerShell, and
  getting it wrong looks exactly like having no key at all.
*/
const keyAt = flags.indexOf("--key");
if (keyAt !== -1 && flags[keyAt + 1]) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = flags[keyAt + 1];
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "No credentials. Either of these works:\n\n"
      + '  node scripts/grant-admin.mjs <email> --key "C:/path/to/key.json"\n'
      + "  GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/grant-admin.mjs <email>\n\n"
      + "The key comes from the Firebase console: Project settings, Service\n"
      + "accounts, Generate new private key. Keep that file OUTSIDE this repo.\n\n"
      + "With gcloud installed, 'gcloud auth application-default login' also\n"
      + "works and leaves no key file lying about at all.",
  );
  process.exit(1);
}

if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  console.error(`No such file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  process.exit(1);
}

let admin;
try {
  admin = await import("firebase-admin");
} catch {
  console.error("firebase-admin is not installed. Run: npm i -D firebase-admin");
  process.exit(1);
}

const app = admin.default.initializeApp({
  credential: admin.default.credential.applicationDefault(),
});

try {
  const auth = admin.default.auth(app);
  const user = await auth.getUserByEmail(email);

  /* Merge rather than replace. Blowing away another claim somebody added later
     would be a quiet, confusing failure. */
  const claims = { ...(user.customClaims ?? {}) };
  if (revoke) delete claims.admin;
  else claims.admin = true;

  await auth.setCustomUserClaims(user.uid, claims);

  console.log(
    `${revoke ? "Revoked" : "Granted"} admin for ${email} (${user.uid}).\n`
      + "They must sign out and back in before it takes effect.",
  );
} catch (problem) {
  console.error(problem.message ?? problem);
  process.exit(1);
} finally {
  await app.delete();
}
