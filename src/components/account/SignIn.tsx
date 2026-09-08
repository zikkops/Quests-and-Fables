"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProfile, usernameTaken } from "@/lib/firebase/account";
import {
  createAccount,
  letterTrouble,
  resetPassword,
  saySorry,
  signIn,
  useSession,
} from "@/lib/firebase/session";
import { LIVE_LEBANON } from "@/data/lebanon";
import {
  dobProblem,
  dobToMillis,
  GRACE_DAYS,
  phoneProblem,
  usernameProblem,
} from "@/lib/firebase/schema";
import styles from "./Account.module.css";

type Mode = "in" | "new" | "forgot";

/** Firebase's own floor is six. Asking for more up front beats being told after. */
const MIN_PASSWORD = 8;

/**
 * Signing in, registering, and the forgotten password.
 *
 * Registration is deliberately **one form**. Email, password, username, date of
 * birth, phone and area are asked at once, and the account and its profile are
 * written back to back — because somebody holding an Auth user with no profile
 * is half registered, and every screen after this has to cope with them. That
 * state is still reachable if the second write fails, and `/account/setup`
 * exists to pick it up, but it should be a rare accident rather than the route
 * everybody takes.
 *
 * The username is checked *before* the account is made. Being told "that name
 * is taken" afterwards would leave somebody holding a password for an account
 * they cannot finish.
 */
export default function SignIn() {
  const { user, profile, profileUnread, loading, configured, refresh } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("in");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [madeIt, setMadeIt] = useState(false);

  /*
    True from the moment the account is made until the profile is written.

    A ref rather than state, because the whole point is not to re-render: this
    guards an effect that would otherwise fire in the gap between those two
    writes, and re-rendering to raise the flag is the same race one tick later.
  */
  const registering = useRef(false);

  /* Already in. Somebody half registered goes to finish it. */
  useEffect(() => {
    /*
      Registering is not "half registered", even though it looks identical for
      a moment. `createAccount` makes the auth user, which wakes the session,
      which reads a profile that `createProfile` has not written yet. This
      effect then saw a signed-in person with no profile and sent them to
      /account/setup, mid-registration, and nothing afterwards told the session
      to look again. They arrived at "Finish setting up" with a finished profile
      already in the database, and filling it in was refused because they
      already had one. A completed registration, presented as an unfinished one
      that could not be finished.
    */
    if (registering.current) return;
    if (loading || !user || madeIt) return;
    /* Only "there is no profile" sends somebody to set one up. "We could not
       read it" sends them to their account, which says so and offers a retry:
       a timeout is not a reason to ask a player to register twice. */
    if (!profile && profileUnread) {
      router.replace("/account");
      return;
    }
    router.replace(profile ? "/account" : "/account/setup");
  }, [loading, user, profile, profileUnread, madeIt, router]);

  if (!configured) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Accounts are not switched on yet</h2>
        <p className={styles.cardBody}>
          Registration is built and waiting on a Firebase project. Everything
          that never needed an account carries on working: the character builder
          has never asked for one and never will.
        </p>
        <Link href="/character-builder" className={styles.primary}>
          Build a character instead
        </Link>
      </div>
    );
  }

  /* ---- what is wrong with the form, if anything -------------------------- */

  const nameIssue = username ? usernameProblem(username) : null;
  const dobIssue = dob ? dobProblem(dob) : null;
  const phoneIssue = phone ? phoneProblem(phone) : null;
  const shortPassword = password.length > 0 && password.length < MIN_PASSWORD;

  const canRegister =
    !busy
    && email.trim() !== ""
    && password.length >= MIN_PASSWORD
    && username !== ""
    && !nameIssue
    && dob !== ""
    && !dobIssue
    && phone.trim() !== ""
    && !phoneIssue
    && area !== "";

  /* ---- the three things this page does ----------------------------------- */

  const register = async () => {
    setError(null);
    setBusy(true);
    registering.current = true;

    try {
      /* Before the account exists, so a taken name never strands anybody. */
      if (await usernameTaken(username)) {
        setError("That username is taken. Try another.");
        return;
      }

      const person = await createAccount(email.trim(), password);

      await createProfile({
        uid: person.uid,
        username: username.trim().toLowerCase(),
        email: email.trim(),
        phone,
        area,
        dob: dobToMillis(dob),
      });

      /*
        The session read "no profile" a moment ago because there was none yet.
        Tell it to look again, so the account screens see the profile that now
        exists rather than sending this person off to create a second one.
      */
      await refresh();
      setMadeIt(true);
    } catch (problem) {
      setError(saySorry(problem));
    } finally {
      /* Lowered either way. On success `madeIt` holds the screen; on failure
         the effect should take over, because an account with no profile really
         is half registered. */
      registering.current = false;
      setBusy(false);
    }
  };

  const enter = async () => {
    setError(null);
    setBusy(true);

    try {
      await signIn(email.trim(), password);
      /* The effect above takes over once the session updates. */
    } catch (problem) {
      setError(saySorry(problem));
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setBusy(true);

    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (problem) {
      setError(saySorry(problem));
    } finally {
      setBusy(false);
    }
  };

  /* ---- what just happened ------------------------------------------------ */

  if (madeIt) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          {letterTrouble() ? "You are in. The email did not go out." : "You are in. Now prove the address."}
        </h2>
        {letterTrouble() ? (
          <>
            <p className={styles.cardBody}>
              Your account is made and nothing about it is at risk. We could not
              send the confirmation link to <strong>{email}</strong> just now.
              You have <strong>{GRACE_DAYS} days</strong> from today before the
              account is held, and you can send the email again from your
              account at any point.
            </p>
            <p className={styles.fine}>
              If it keeps failing, the address may be mistyped. Write to us and
              we will move the account to the right one.
            </p>
          </>
        ) : (
          <>
            <p className={styles.cardBody}>
              An email is on its way to <strong>{email}</strong> with a link in
              it. You have <strong>{GRACE_DAYS} days</strong> to follow it.
              After that the account is held: it keeps everything you have put
              in it and does nothing else until the address is confirmed.
            </p>
            <p className={styles.fine}>
              Nothing there? Check the spam folder before anything else. You can
              send it again from your account.
            </p>
          </>
        )}
        <Link href="/account" className={styles.primary}>
          Go to my account
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Check your email</h2>
        <p className={styles.cardBody}>
          If there is an account on <strong>{email}</strong>, a link to set a new
          password is on its way. If nothing arrives, that address may not have
          an account here.
        </p>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setSent(false);
            setMode("in");
          }}
        >
          Back to signing in
        </button>
      </div>
    );
  }

  /* ---- the form ---------------------------------------------------------- */

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "new") void register();
    else if (mode === "in") void enter();
    else void forgot();
  };

  return (
    <form className={`${styles.card} ${styles.wide}`} onSubmit={submit}>
      <div className={styles.modes} role="group" aria-label="Sign in or register">
        {(["in", "new"] as const).map((which) => (
          <button
            key={which}
            type="button"
            aria-pressed={mode === which || (which === "in" && mode === "forgot")}
            className={
              mode === which || (which === "in" && mode === "forgot")
                ? `${styles.mode} ${styles.modeOn}`
                : styles.mode
            }
            onClick={() => {
              setMode(which);
              setError(null);
            }}
          >
            {which === "in" ? "I have an account" : "Create an account"}
          </button>
        ))}
      </div>

      <h2 className={styles.cardTitle}>
        {mode === "new"
          ? "Everything at once, and then you are done"
          : mode === "forgot"
            ? "Set a new password"
            : "Welcome back"}
      </h2>

      {mode === "new" ? (
        <p className={styles.cardBody}>
          One form. We email you a link afterwards to confirm the address, and
          you have {GRACE_DAYS} days to follow it.
        </p>
      ) : mode === "forgot" ? (
        <p className={styles.cardBody}>
          Put in the address on the account and we will send a link to set a new
          password.
        </p>
      ) : null}

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            className={styles.input}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        {mode !== "forgot" ? (
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              type="password"
              required
              autoComplete={mode === "new" ? "new-password" : "current-password"}
              className={styles.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "new" ? (
              <span className={shortPassword ? styles.hintBad : styles.hint}>
                {MIN_PASSWORD} characters or more.
              </span>
            ) : null}
          </label>
        ) : null}
      </div>

      {mode === "new" ? (
        <>
          <label className={styles.field}>
            <span className={styles.label}>Username · permanent</span>
            <input
              className={styles.input}
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              autoComplete="off"
              spellCheck={false}
              placeholder="orla_ironbrand"
              required
            />
            <span className={nameIssue ? styles.hintBad : styles.hint}>
              {nameIssue
                ?? "Lowercase letters, numbers and underscores. The only thing other players see, and it cannot be changed."}
            </span>
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Date of birth · private</span>
              <input
                type="date"
                required
                className={styles.input}
                value={dob}
                onChange={(event) => setDob(event.target.value)}
              />
              <span className={dobIssue ? styles.hintBad : styles.hint}>
                {dobIssue ?? "Asked once, and never shown to anybody."}
              </span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Phone · private</span>
              <input
                type="tel"
                required
                autoComplete="tel"
                className={styles.input}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+961 …"
              />
              <span className={phoneIssue ? styles.hintBad : styles.hint}>
                {phoneIssue ?? "For your game master, once you have a seat."}
              </span>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Where you are · private</span>
            <select
              className={styles.select}
              value={area}
              onChange={(event) => setArea(event.target.value)}
              required
            >
              <option value="">Choose an area</option>
              {LIVE_LEBANON.map((governorate) => (
                <optgroup key={governorate.slug} label={governorate.name}>
                  {governorate.areas.map((one) => (
                    <option key={one.slug} value={one.slug}>
                      {one.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className={styles.hint}>
              An area, never an address, and never shown to another player.
            </span>
          </label>
        </>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <button
        type="submit"
        className={styles.primary}
        disabled={mode === "new" ? !canRegister : busy}
      >
        {busy
          ? "One moment"
          : mode === "new"
            ? "Create my account"
            : mode === "forgot"
              ? "Send me a link"
              : "Sign in"}
      </button>

      {mode === "in" ? (
        <button
          type="button"
          className={styles.quietLink}
          onClick={() => {
            setMode("forgot");
            setError(null);
          }}
        >
          I have forgotten my password
        </button>
      ) : mode === "forgot" ? (
        <button
          type="button"
          className={styles.quietLink}
          onClick={() => {
            setMode("in");
            setError(null);
          }}
        >
          Back to signing in
        </button>
      ) : null}

      <p className={styles.fine}>
        Building a character never needs an account. One is for joining a party,
        because a party has to know when and where you can play.
      </p>
    </form>
  );
}
