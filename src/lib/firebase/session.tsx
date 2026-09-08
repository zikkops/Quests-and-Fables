"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth, firebaseReady, unavailable } from "./client";
import { clearCache } from "@/lib/notecache";
import { getProfile } from "./account";
import type { Profile } from "./schema";

/**
 * Who is signed in, and whether they have finished setting themselves up.
 *
 * Those are two different questions and the app needs both. Firebase answers
 * the first the moment the page loads; the second needs a read from Firestore,
 * and until it comes back the honest answer is "still looking" rather than
 * "no". Anything that redirects on `profile === null` without checking
 * `loading` first will bounce a signed-in player out of their own account on
 * every refresh.
 *
 * The email is remembered in localStorage between sending a link and following
 * it, which is Firebase's own recommendation: the link is only safe to use if
 * the person following it is the person who asked for it, and the email in
 * storage is the cheap version of that check. If it is missing, because they
 * opened the link on a different device, we ask for it again rather than fail.
 */

type Session = {
  user: User | null;
  profile: Profile | null;
  /**
   * The profile could not be read. Not the same as not having one, and the
   * difference matters: only the second is a reason to send somebody to set
   * their account up.
   */
  profileUnread: boolean;
  /**
   * Whether this account carries the `admin` custom claim.
   *
   * Read off the ID token, never off a database field, because a field is
   * something a client could be tricked into believing. This flag only decides
   * what the interface offers; `firestore.rules` decides what is allowed, and
   * an admin page rendered for somebody without the claim would show them a
   * table full of permission errors rather than anybody's phone number.
   */
  admin: boolean;

  /**
   * Whether the address on this account has been confirmed.
   *
   * Read from the Auth token, which is the only place it is trustworthy: it is
   * not a field anybody here can write. Combine it with the profile's
   * `createdAt` through `standing()` to find out whether an unconfirmed
   * account is still inside its seven days or is being held.
   */
  verified: boolean;
  /** True until both questions above have been answered at least once. */
  loading: boolean;
  configured: boolean;
  refresh: () => Promise<void>;
  leave: () => Promise<void>;
};

const SessionContext = createContext<Session>({
  user: null,
  profile: null,
  profileUnread: false,
  admin: false,
  verified: false,
  loading: true,
  configured: false,
  refresh: async () => {},
  leave: async () => {},
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  /** True when the profile could not be read, as opposed to not existing. */
  const [profileUnread, setProfileUnread] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [verified, setVerified] = useState(false);
  /* Start at "still looking" only if there is somewhere to look. With no
     Firebase configured the answer is already known, and initialising it here
     rather than correcting it inside the effect keeps the effect a subscription
     rather than a setState. */
  const [loading, setLoading] = useState(firebaseReady);

  useEffect(() => {
    const instance = auth();
    if (!instance) return;

    return onAuthStateChanged(instance, async (next) => {
      setUser(next);
      if (next) {
        setVerified(next.emailVerified);

        try {
          const token = await next.getIdTokenResult();
          setAdmin(token.claims.admin === true);
        } catch {
          setAdmin(false);
        }

        try {
          setProfile(await getProfile(next.uid));
          setProfileUnread(false);
        } catch {
          /*
            Offline, a timeout, rules not deployed. Still null so nothing
            crashes, but flagged, because "we could not read it" and "there
            isn't one" are different facts and only one of them means somebody
            should be sent to set their account up.

            Conflating the two is how a player with a perfectly good profile
            ended up on /account/setup filling the form in again.
          */
          setProfile(null);
          setProfileUnread(true);
        }
      } else {
        setProfile(null);
        setAdmin(false);
        setVerified(false);
      }
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    if (!user) return;

    /* Ask about the address as well as the profile. Somebody who followed the
       link in another tab is verified everywhere except in this one. */
    setVerified(await recheckVerified());
    setProfile(await getProfile(user.uid));
  };

  const leave = async () => {
    /* Anything cached in this browser belongs to whoever was signed in, and the
       next person here is not them. The game master's private book is the
       reason this is a real step and not tidiness. */
    await clearCache();

    const instance = auth();
    if (instance) await signOut(instance);
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        profile,
      profileUnread,
        admin,
        verified,
        loading,
        configured: firebaseReady,
        refresh,
        leave,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/* ==========================================================================
   Getting in

   Email and password, and the address is proven afterwards rather than before.
   That order is the whole reason `standing` exists: for seven days a new
   account works on trust, and after that it is held until the link in the
   welcome email is followed. See `schema.ts`.
   ========================================================================== */

/**
 * Firebase's error codes, said out loud.
 *
 * The raw ones reach the user as "Firebase: Error (auth/invalid-credential)",
 * which tells somebody who mistyped their password nothing at all. Anything not
 * listed falls through to its own message rather than a shrug, so a new code
 * from a future SDK is still readable.
 */
export function saySorry(problem: unknown): string {
  const code = (problem as { code?: string })?.code ?? "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      /* Deliberately one message for all three: telling a stranger which half
         they got right is telling them whether an address has an account. */
      return "That email and password do not match an account.";

    case "auth/email-already-in-use":
      return "There is already an account on that email. Sign in instead, or reset the password.";

    case "auth/weak-password":
      return "That password is too short. Six characters at the very least.";

    case "auth/invalid-email":
      return "That does not look like an email address.";

    case "auth/too-many-requests":
      return "Too many tries. Wait a few minutes and go again.";

    case "auth/network-request-failed":
      return "Could not reach the server. Check your connection.";

    case "auth/operation-not-allowed":
      /* Almost always the one thing nobody remembers to switch on. */
      return "Email and password sign-in is not enabled on this Firebase project yet.";

    case "permission-denied":
    case "firestore/permission-denied":
      /*
        Firestore's own message for this is four lines of rule internals quoting
        line numbers out of firestore.rules. It is exactly what you want in a
        terminal and exactly what nobody should ever be shown, so it stops here.
      */
      return "That is not something this account is allowed to do.";

    case "unavailable":
    case "firestore/unavailable":
      return "Could not reach the database. Check your connection and try again.";

    default: {
      const message = (problem as Error)?.message ?? "";
      /* Belt and braces: a rules refusal that arrives without its code still
         must not put line numbers on screen. */
      if (message.includes("PERMISSION_DENIED") || message.includes("firestore.rules")) {
        return "That is not something this account is allowed to do.";
      }
      return message || "Something went wrong.";
    }
  }
}

function instance() {
  const account = auth();
  if (!account) throw new Error(unavailable());
  return account;
}

/**
 * Make the account, and post the letter.
 *
 * Returns the user so the caller can write the profile immediately: an auth
 * user with no profile is a half-registered person, and the less time anybody
 * spends in that state the better. If the profile write does fail, they are not
 * stranded — `/account/setup` picks exactly that case up.
 */
export async function createAccount(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(instance(), email, password);
  await sendVerification();
  return credential.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(instance(), email, password);
  return credential.user;
}

/** Where the verification link lands them once they follow it. */
const backTo = () => `${window.location.origin}/account`;

export async function sendVerification(): Promise<void> {
  const person = instance().currentUser;
  if (!person) throw new Error("Nobody is signed in.");
  await sendEmailVerification(person, { url: backTo() });
}

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(instance(), email, { url: `${window.location.origin}/sign-in` });

/**
 * Ask Firebase again whether the address has been confirmed.
 *
 * `emailVerified` is baked into the token at sign-in, so somebody who follows
 * the link in another tab is still unverified as far as this tab knows. The
 * account screens call this rather than telling them to sign out and back in.
 */
export async function recheckVerified(): Promise<boolean> {
  const person = instance().currentUser;
  if (!person) return false;

  await person.reload();
  /* Force a fresh token so `request.auth.token.email_verified` in the rules
     agrees with what this browser now believes. */
  await person.getIdToken(true);

  return person.emailVerified;
}
