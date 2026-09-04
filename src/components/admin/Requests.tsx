"use client";

import { useEffect, useState } from "react";
import {
  answerRequest,
  updateParty,
  waitingRequests,
  type SeatRequest,
} from "@/lib/firebase/party";
import { aggregate } from "@/lib/match";
import type { Profile } from "@/lib/firebase/schema";
import { PARTY_MAX, type Party } from "@/lib/party";
import styles from "./Admin.module.css";

type Props = {
  parties: Party[];
  profiles: Profile[];
  onChanged: () => void;
};

/**
 * People who have asked for a seat, and the two things you can do about it.
 *
 * Taking somebody on is three writes that have to agree: the request becomes
 * `joined`, the party gains a player, and the party's aggregate is recomputed
 * so it keeps matching honestly. That last one is the easy one to forget, and
 * forgetting it means a table advertising hours its newest member cannot make.
 */
export default function Requests({ parties, profiles, onChanged }: Props) {
  const [waiting, setWaiting] = useState<SeatRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;

    waitingRequests()
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
  }, [round]);

  const reload = () => setRound((n) => n + 1);

  const take = async (request: SeatRequest) => {
    const party = parties.find((one) => one.id === request.partyId);
    const player = profiles.find((one) => one.uid === request.playerId);

    if (!party || !player) {
      setError("That party or that player is gone.");
      return;
    }

    if (party.playerIds.length >= PARTY_MAX) {
      setError(`${party.name} is full. Decline this one or make room first.`);
      return;
    }

    setError(null);
    setBusy(request.id);

    try {
      const playerIds = [...party.playerIds, player.uid];
      const members = profiles.filter((one) => playerIds.includes(one.uid));

      /* The party and the summary it is matched on move together, or the table
         starts advertising an evening its newest player cannot make. */
      await updateParty(party.id, { playerIds, profile: aggregate(members) });
      await answerRequest(request.id, "joined");

      reload();
      onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const decline = async (request: SeatRequest) => {
    setError(null);
    setBusy(request.id);

    try {
      await answerRequest(request.id, "declined");
      reload();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (waiting === null) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Asked for a seat</h2>
        <p className={styles.body}>Reading the database.</p>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.cardTitle}>Asked for a seat</h2>
        <span className={styles.tally}>{waiting.length} waiting</span>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {waiting.length === 0 ? (
        <p className={styles.body}>
          Nobody is waiting. Requests arrive from a table&rsquo;s own page, and
          every one of them is somebody who has already passed that table&rsquo;s
          hard filters.
        </p>
      ) : (
        <ul className={styles.requests}>
          {waiting.map((request) => {
            const party = parties.find((one) => one.id === request.partyId);
            const player = profiles.find((one) => one.uid === request.playerId);

            return (
              <li key={request.id} className={styles.request}>
                <div className={styles.requestHead}>
                  <span className={styles.name}>{player?.username ?? "Somebody"}</span>
                  <span className={styles.quiet}>
                    asked for a seat at {party?.name ?? "a party that is gone"}
                  </span>
                </div>

                {request.note ? (
                  <p className={styles.note}>{request.note}</p>
                ) : (
                  <p className={styles.quiet}>No note.</p>
                )}

                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy === request.id || !party || !player}
                    onClick={() => take(request)}
                  >
                    {busy === request.id ? "One moment" : "Give them the seat"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy === request.id}
                    onClick={() => decline(request)}
                  >
                    Not this table
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
