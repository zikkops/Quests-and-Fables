"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { foundParty } from "@/lib/firebase/party";
import { useSession } from "@/lib/firebase/session";
import { standing } from "@/lib/firebase/schema";
import { LIVE_LEBANON } from "@/data/lebanon";
import { PARTY_MAX, PARTY_MIN } from "@/lib/party";
import styles from "./Parties.module.css";

/**
 * A group of friends starting their own table.
 *
 * The whole feature is a shortcut around matching, so it says so rather than
 * pretending to be the same thing. Four to six people who already chose each
 * other do not need to be scored against one another, and offering them the
 * pool is offering them a solution to a problem they have not got.
 *
 * What they still need is a game master, and that is the honest limit of this
 * page: it makes a table, names it, and puts it in front of whoever assigns
 * game masters. It does not conjure one, because game masters are recruited
 * and met in person and that is most of what makes any of this safe.
 */
export default function FoundParty() {
  const { user, profile, verified, loading, configured } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  /* Null means untouched, so somewhere they already said they would travel to
     can show through without an effect copying it into state. */
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const area = picked ?? profile?.playAreas[0] ?? profile?.area ?? "";

  if (!configured) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>Accounts are not switched on yet</h2>
        <p className={styles.emptyBody}>
          This page is built and waiting on a Firebase project.
        </p>
        <Link href="/character-builder" className={styles.primary}>
          Build a character instead
        </Link>
      </div>
    );
  }

  if (loading) return <p className={styles.emptyBody}>One moment.</p>;

  if (!user || !profile) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>You need an account to start a table.</h2>
        <p className={styles.emptyBody}>
          Only so there is somebody the table belongs to, and somewhere to send
          your friends&rsquo; requests to join it. Building a character still
          needs nothing.
        </p>
        <Link href="/sign-in" className={styles.primary}>
          Sign in or register
        </Link>
      </div>
    );
  }

  /* The seven day clock. The rules refuse the write anyway; saying so first is
     better than a permission error on the far side of a form. */
  const where = standing(verified, profile.createdAt);
  if (where.state === "held") {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>Confirm your email first.</h2>
        <p className={styles.emptyBody}>
          The account is held until the address is confirmed, and starting a
          table is one of the things that waits on it. Nothing is lost.
        </p>
        <Link href="/account" className={styles.primary}>
          Sort it out
        </Link>
      </div>
    );
  }

  const create = async () => {
    setError(null);
    setBusy(true);

    try {
      const id = await foundParty({
        founderId: profile.uid,
        founderName: profile.username,
        name: name.trim(),
        area,
      });

      router.push(`/parties/${id}`);
    } catch (problem) {
      setError((problem as Error).message);
      setBusy(false);
    }
  };

  const ready = name.trim().length > 0 && area !== "" && !busy;

  return (
    <form
      className={styles.foundCard}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void create();
      }}
    >
      <h2 className={styles.foundTitle}>Name it, and it exists</h2>

      <p className={styles.emptyBody}>
        You are the first person at this table. Once it exists you get a link:
        send that to your friends and they can ask to join, and you decide who
        gets in. Nobody else is ever matched into it and it never appears on{" "}
        <Link href="/parties" className={styles.inlineLink}>
          the list of open tables
        </Link>
        .
      </p>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>What the table is called</span>
        <input
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          placeholder="The Thursday Table"
          required
        />
        <span className={styles.fieldHint}>
          Anything. You can change it later, and your friends will see it.
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Where you will play</span>
        <select
          className={styles.select}
          value={area}
          onChange={(event) => setPicked(event.target.value)}
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
        <span className={styles.fieldHint}>
          An area, not an address. It is what a game master needs in order to say
          yes.
        </span>
      </label>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button type="submit" className={styles.primary} disabled={!ready}>
        {busy ? "Making it…" : "Start the table"}
      </button>

      <p className={styles.foundFine}>
        A table needs {PARTY_MIN} to {PARTY_MAX} players before it can be given a
        game master, and you are one of them. Get the others in, and it goes into
        the queue for one.
      </p>
    </form>
  );
}
