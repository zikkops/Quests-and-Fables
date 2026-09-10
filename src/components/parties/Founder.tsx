"use client";

import { useEffect, useState } from "react";
import { acceptFriend, requestsFor, answerRequest, type SeatRequest } from "@/lib/firebase/party";
import { PARTY_MAX, PARTY_MIN, type Party } from "@/lib/party";
import styles from "./Parties.module.css";

type Props = {
  party: Party;
  onChanged: () => void;
};

/**
 * What the person who started a table sees on it.
 *
 * Two jobs: hand out the link, and answer the people who followed it. The link
 * is an invitation and not an authorisation — anybody holding it may ask, and
 * only the founder may say yes. `firestore.rules` enforces exactly that, and it
 * proves somebody asked before it will let them be added, because a founder who
 * could add any uid could seat a stranger without their consent.
 *
 * There is deliberately no "invite by username" field. It would mean collecting
 * usernames from people who have not registered yet, which is a worse errand
 * than pasting a link into the group chat they are already in.
 */
export default function Founder({ party, onChanged }: Props) {
  const [waiting, setWaiting] = useState<SeatRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;

    requestsFor(party.id)
      .then((all) => {
        if (alive) setWaiting(all);
      })
      .catch((problem: Error) => {
        if (!alive) return;
        setError(problem.message);
        setWaiting([]);
      });

    return () => {
      alive = false;
    };
  }, [party.id, round]);

  const link =
    typeof window === "undefined" ? "" : `${window.location.origin}/parties/${party.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Could not reach the clipboard. The link is ${link}`);
    }
  };

  const take = async (request: SeatRequest) => {
    setError(null);
    setBusy(request.id);

    try {
      await acceptFriend(party, request.playerId, request.playerName ?? request.playerId);
      setRound((n) => n + 1);
      onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const turnDown = async (request: SeatRequest) => {
    setError(null);
    setBusy(request.id);

    try {
      await answerRequest(request.id, "declined");
      setRound((n) => n + 1);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const seats = Math.max(0, PARTY_MAX - party.playerIds.length);
  const short = Math.max(0, PARTY_MIN - party.playerIds.length);

  return (
    <section className={styles.founderCard}>
      <h3 className={styles.founderTitle}>This is your table</h3>

      <p className={styles.emptyBody}>
        {short > 0 ? (
          <>
            {party.playerIds.length} of {PARTY_MIN}. You need{" "}
            <strong>{short} more</strong> before it can be given a game master.
          </>
        ) : seats > 0 ? (
          <>
            {party.playerIds.length} at the table, {seats} seat
            {seats === 1 ? "" : "s"} spare. It is big enough for a game master
            whenever you are ready.
          </>
        ) : (
          <>Full at {PARTY_MAX}. Nobody else can be added.</>
        )}
      </p>

      <div className={styles.linkRow}>
        <code className={styles.link}>{link}</code>
        <button type="button" className={styles.secondary} onClick={copy}>
          {copied ? "Copied" : "Copy the link"}
        </button>
      </div>

      <p className={styles.fieldHint}>
        Send that to your friends. Anybody with it can ask to join and nobody
        gets in without you saying so. It is not listed anywhere and strangers
        are never matched into it.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.asks}>
        <p className={styles.asksTitle}>
          {waiting === null
            ? "Checking who has asked"
            : waiting.length === 0
              ? "Nobody waiting"
              : `${waiting.length} asking to join`}
        </p>

        {waiting && waiting.length > 0 ? (
          <ul className={styles.askList}>
            {waiting.map((request) => (
              <li key={request.id} className={styles.ask}>
                <div>
                  <span className={styles.askWho}>
                    {request.playerName || "Somebody"}
                  </span>
                  {request.note ? (
                    <p className={styles.askNote}>{request.note}</p>
                  ) : (
                    <p className={styles.fieldHint}>No note.</p>
                  )}
                </div>

                <div className={styles.askActions}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy === request.id || seats === 0}
                    onClick={() => take(request)}
                  >
                    {busy === request.id ? "One moment" : seats === 0 ? "Table is full" : "Let them in"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy === request.id}
                    onClick={() => turnDown(request)}
                  >
                    No
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className={styles.foundFine}>
        You cannot pick your own game master. Once you have {PARTY_MIN} players
        this table joins the queue for one, and whoever you get will have been
        met in person first.
      </p>
    </section>
  );
}
