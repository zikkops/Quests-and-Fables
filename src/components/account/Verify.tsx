"use client";

import { useState } from "react";
import { recheckVerified, saySorry, sendVerification, useSession } from "@/lib/firebase/session";
import { GRACE_DAYS, standing, type Standing } from "@/lib/firebase/schema";
import styles from "./Account.module.css";

/**
 * The state of an unconfirmed address, and the two things to do about it.
 *
 * Two shapes from one component. Inside the seven days it is a strip above the
 * account: a countdown and a way to send the letter again. After the seven days
 * it is the account — everything else is replaced, because there is nothing
 * else worth doing until the address is proven.
 *
 * Held rather than deleted, and the copy says so in as many words. Somebody
 * whose welcome email went to spam should not believe they have lost their
 * characters, and telling them plainly costs nothing.
 *
 * The rules enforce the same clock. If this component and `firestore.rules`
 * ever disagree, the rules are right and this is a bug.
 */
export function useStanding(): Standing | null {
  const { profile, verified } = useSession();
  if (!profile) return null;
  return standing(verified, profile.createdAt);
}

export default function Verify({ where }: { where: Standing }) {
  const { user, refresh } = useSession();

  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (where.state === "verified") return null;

  const again = async () => {
    setError(null);
    setBusy(true);

    try {
      await sendVerification();
      setSent(true);
    } catch (problem) {
      setError(saySorry(problem));
    } finally {
      setBusy(false);
    }
  };

  /* Somebody who followed the link in another tab is verified everywhere except
     here, because the claim was baked into this tab's token at sign-in. */
  const check = async () => {
    setError(null);
    setBusy(true);

    try {
      const now = await recheckVerified();
      if (!now) setError("Still not confirmed. Follow the link in the email first.");
      await refresh();
    } catch (problem) {
      setError(saySorry(problem));
    } finally {
      setBusy(false);
    }
  };

  const held = where.state === "held";

  return (
    <section className={held ? `${styles.card} ${styles.heldCard}` : styles.notice}>
      <p className={held ? styles.heldTitle : styles.noticeTitle}>
        {held
          ? "This account is on hold"
          : `Confirm your email · ${where.daysLeft} day${where.daysLeft === 1 ? "" : "s"} left`}
      </p>

      <p className={styles.cardBody}>
        {held ? (
          <>
            The link we emailed to <strong>{user?.email}</strong> was never
            followed, so the account is held. Nothing has been deleted and
            nothing will be: your characters, your week and your areas are all
            still here. Confirm the address and it all comes straight back.
          </>
        ) : (
          <>
            We sent a link to <strong>{user?.email}</strong>. Follow it within{" "}
            {GRACE_DAYS} days of registering or the account is held until you do.
            Everything works normally until then.
          </>
        )}
      </p>

      {sent ? (
        <p className={styles.ok}>Sent. Check the spam folder if it is not there in a minute.</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.noticeActions}>
        <button type="button" className={styles.primary} onClick={again} disabled={busy}>
          {busy ? "One moment" : sent ? "Send it again" : "Send the email again"}
        </button>
        <button type="button" className={styles.secondary} onClick={check} disabled={busy}>
          I have confirmed it
        </button>
      </div>

      {held ? (
        <p className={styles.fine}>
          Still nothing arriving? The address may have been mistyped when you
          registered. Write to us and we will move the account to the right one.
        </p>
      ) : null}
    </section>
  );
}
