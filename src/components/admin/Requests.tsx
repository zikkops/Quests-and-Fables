"use client";

import { useEffect, useState } from "react";
import {
  answerRequest,
  seatMember,
  updateParty,
  waitingRequests,
  type SeatRequest,
} from "@/lib/firebase/party";
import type { Block } from "@/lib/firebase/block";
import { aggregate, keepApart } from "@/lib/match";
import type { Profile } from "@/lib/firebase/schema";
import { PARTY_MAX, type Party } from "@/lib/party";
import styles from "./Admin.module.css";

type Props = {
  parties: Party[];
  profiles: Profile[];
  /** Every block there is. Only this console can see them both ways. */
  blocks: Block[];
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
export default function Requests({ parties, profiles, blocks, onChanged }: Props) {
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

    /*
      A block, in either direction, and this is the only screen that can see
      both. The error names nobody: an admin does not need to know which way
      round it went to know not to seat them, and saying would hand one player
      the fact that the other blocked them.
    */
    const apart = keepApart(player.uid, blocks);
    const seated = [...party.playerIds, ...(party.gmId ? [party.gmId] : [])];
    if (seated.some((uid) => apart.has(uid))) {
      setError(
        `${player.username} and somebody already at ${party.name} must not be `
        + "seated together. Decline this one and find them another table.",
      );
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
      /* Seated, not only listed: this is what opens the notebook to them. */
      await seatMember(party.id, { uid: player.uid, role: "player", name: player.username });
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
