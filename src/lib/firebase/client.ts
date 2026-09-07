"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase, initialised lazily and only if it has been configured.
 *
 * **The site has to keep working with no credentials at all.** Today there is no
 * Firebase project: the keys arrive later. So nothing here runs at import time,
 * every accessor can return null, and every caller has to deal with that. The
 * alternative is a homepage that white screens because a config object was
 * empty, which would be a poor trade for saving a few `if` statements.
 *
 * These values are public by design. A Firebase web config is not a secret, it
 * is an address: the security boundary is `firestore.rules` and the Auth
 * provider settings, not the fact that nobody knows the project id. Anything
 * that must stay secret belongs in a server-side environment variable and never
 * in a `NEXT_PUBLIC_` one.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True once the six values are in the environment. Drives every "not yet" UI. */
export const firebaseReady = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;

/**
 * Set if Firebase refused the config it was given, and never cleared.
 *
 * Present-but-wrong keys are the likeliest way this breaks: a project id
 * mistyped into the environment gets `firebaseReady` past its check and then
 * throws `auth/invalid-api-key` from inside the SDK. That throw used to land
 * during render and take the whole page with it. Now it is caught, remembered,
 * and reported in a sentence — the same treatment as no keys at all, because
 * from a player's side those two situations are the same situation.
 */
let refused: string | null = null;

function firebaseApp(): FirebaseApp | null {
  if (!firebaseReady || refused || typeof window === "undefined") return null;

  if (!app) {
    try {
      app = getApps()[0] ?? initializeApp(config as Required<typeof config>);
    } catch (problem) {
      refused = (problem as Error).message;
      return null;
    }
  }

  return app;
}

/**
 * Point the SDK at the local emulators instead of the real project.
 *
 * Set `NEXT_PUBLIC_FIREBASE_EMULATOR=1` and run `npm run dev:emulator`. Accounts
 * are throwaway, the database starts empty every time, and nothing you do
 * touches production.
 *
 * That matters more here than in most projects. `firestore.rules` gives a
 * claimed username no release path from the client, so a single test signup
 * against the real project burns that name permanently and there is no Admin
 * SDK to undo it. Testing the real flow was effectively impossible until this
 * existed.
 *
 * The flag is deliberately explicit rather than inferred from `NODE_ENV` or the
 * hostname. `npm run dev` against real data is a thing people legitimately do,
 * and quietly redirecting it would be its own kind of trap.
 */
const useEmulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";

/* connectAuthEmulator and connectFirestoreEmulator both throw if the instance
   has already been used, so each is wired exactly once. */
let authWired = false;
let dbWired = false;

export function auth(): Auth | null {
  const instance = firebaseApp();
  if (!instance) return null;

  try {
    const service = getAuth(instance);
    if (useEmulator && !authWired) {
      authWired = true;
      connectAuthEmulator(service, "http://127.0.0.1:9099", { disableWarnings: true });
    }
    return service;
  } catch (problem) {
    refused = (problem as Error).message;
    return null;
  }
}

export function db(): Firestore | null {
  const instance = firebaseApp();
  if (!instance) return null;

  try {
    const service = getFirestore(instance);
    if (useEmulator && !dbWired) {
      dbWired = true;
      connectFirestoreEmulator(service, "127.0.0.1", 8080);
    }
    return service;
  } catch (problem) {
    refused = (problem as Error).message;
    return null;
  }
}

/** True when this browser is talking to the emulators, for the banner to say so. */
export const onEmulator = () => useEmulator;

/**
 * Why a call could not be made, in a sentence a player could read. Null when
 * there is no reason to think anything is wrong.
 */
export function unavailable(): string {
  if (refused) return `Firebase rejected this site's configuration: ${refused}`;
  return "Firebase is not configured yet.";
}

/**
 * What is missing, in words, for the setup page to show. Never rendered to a
 * player: this is for whoever is wiring the project up.
 */
export function missingConfig(): string[] {
  return Object.entries({
    NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_FIREBASE_APP_ID: config.appId,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);
}
