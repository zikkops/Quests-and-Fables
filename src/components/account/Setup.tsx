"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LIVE_LEBANON } from "@/data/lebanon";
import { createProfile, usernameTaken } from "@/lib/firebase/account";
import { useSession } from "@/lib/firebase/session";
import {
  dobProblem,
  dobToMillis,
  phoneProblem,
  usernameProblem,
} from "@/lib/firebase/schema";
import styles from "./Account.module.css";

/**
 * The one form a player fills in that they cannot fill in again.
 *
 * Four fields, and only one of them is permanent. That asymmetry is the whole
 * design of this screen: the username is checked as you type, spelled back to
 * you, and warned about in plain words, while the other three are marked as
 * changeable so nobody agonises over a phone number.
 *
 * The uniqueness check here is a courtesy, not the guarantee. Two people can
 * pass it at the same moment and only one of them can win, which is why
 * `createProfile` claims the name in a transaction and this screen is ready to
 * be told no.
 */
/** An answer, and the name it was an answer about. */
type Check = { name: string; verdict: "taken" | "free" | "unknown" };

export default function Setup() {
  const { user, profile, loading, configured, refresh } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState("");
  /* Null means untouched, so the address they signed in with can show through
     without an effect copying it into state. */
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [area, setArea] = useState("");

  const [checked, setChecked] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = typedEmail ?? user?.email ?? "";

  /* Nowhere to be if you are not signed in, or already set up. */
  useEffect(() => {
    if (loading || !configured) return;
    if (!user) router.replace("/sign-in");
    else if (profile) router.replace("/account");
  }, [loading, configured, user, profile, router]);

  /*
    Ask whether the name is free, but only once they have stopped typing.

    The answer is stored with the name it was about, so a stale answer for a
    name they have since edited is simply not the answer to the question being
    asked. That is why nothing has to be cleared when the field changes, and
    why this effect only ever writes after an await.
  */
  const shape = username ? usernameProblem(username) : null;
  const verdict = checked?.name === username ? checked.verdict : null;

  useEffect(() => {
    if (!username || shape || !configured) return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      let answer: Check["verdict"];
      try {
        answer = (await usernameTaken(username)) ? "taken" : "free";
      } catch {
        /* Rules not deployed, or offline. The transaction is the real check. */
        answer = "unknown";
      }
      if (!cancelled) setChecked({ name: username, verdict: answer });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, shape, configured]);

  if (!configured || loading || !user) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          {configured ? "One moment" : "Accounts are not switched on yet"}
        </h2>
        <p className={styles.cardBody}>
          {configured
            ? "Looking up your account."
            : "This form is built and waiting on a Firebase project. Until its keys are in the environment there is no account to set up."}
        </p>
      </div>
    );
  }

  /* A verdict on a permanent choice deserves a colour, not just a sentence. */
  const hintTone =
    shape || verdict === "taken"
      ? `${styles.hint} ${styles.hintBad}`
      : verdict === "free"
        ? `${styles.hint} ${styles.hintGood}`
        : styles.hint;

  const phoneIssue = phone ? phoneProblem(phone) : null;
  const dobIssue = dob ? dobProblem(dob) : null;
  /* "unknown" is allowed through on purpose: the courtesy check could not reach
     the database, and the transaction behind Claim it is the one that decides. */
  const nameOk = !shape && username !== "" && verdict !== null && verdict !== "taken";
  const ready =
    nameOk
    && !phoneIssue
    && phone.trim() !== ""
    && !dobIssue
    && dob !== ""
    && area !== ""
    && !busy;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await createProfile({
        uid: user.uid,
        username: username.trim().toLowerCase(),
        email: email.trim(),
        phone,
        area,
        dob: dobToMillis(dob),
      });
      await refresh();
      router.replace("/account");
    } catch (problem) {
      setError((problem as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={submit}>
      <h2 className={styles.cardTitle}>Finish setting up</h2>
      <p className={styles.cardBody}>
        Your account exists but its details never got saved, which usually means
        something dropped halfway through registering. Nothing is lost. Fill this
        in and you are done. Everything except the username can be changed later.
      </p>

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
        <span className={hintTone}>
          {shape
            ? shape
            : !username
              ? "Lowercase letters, numbers and underscores. Three to twenty characters."
              : verdict === null
                ? "Checking…"
                : verdict === "taken"
                  ? "Taken. Try another."
                  : verdict === "free"
                    ? "Free. This is the name game masters will see, and it cannot be changed."
                    : "Cannot check right now. You can still claim it."}
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          type="email"
          className={styles.input}
          value={email}
          onChange={(event) => setTypedEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Date of birth · private</span>
        <input
          type="date"
          className={styles.input}
          value={dob}
          onChange={(event) => setDob(event.target.value)}
          required
        />
        <span className={dobIssue ? styles.hintBad : styles.hint}>
          {dobIssue ?? "Asked once, and never shown to anybody."}
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Phone · private</span>
        <input
          type="tel"
          className={styles.input}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          placeholder="+961 …"
          required
        />
        <span className={styles.hint}>
          {phoneIssue ??
            "Seen by us, so we can put a party together, and by your game master once you have a seat. Never by another player."}
        </span>
      </label>

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
          An area, never an address, and never shown to another player. Where
          you are willing to travel to play is a separate list you set next.
        </span>
      </label>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button type="submit" className={styles.primary} disabled={!ready}>
        {busy ? "Claiming…" : "Claim it"}
      </button>
    </form>
  );
}
