"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listParties } from "@/lib/firebase/party";
import { useSession } from "@/lib/firebase/session";
import { findArea } from "@/data/lebanon";
import { describeSlot, PARTY_MAX, type Party } from "@/lib/party";
import styles from "./Gm.module.css";

const areaName = (slug: string) => findArea(slug)?.area.name ?? slug;

/**
 * The tables a game master runs.
 *
 * Deliberately thin. A game master's real work happens at `/campaign/[id]`, and
 * this is the doorway to it: which table, when, how many players, and a way in.
 * Anything more here would be a second campaign page competing with the first.
 *
 * Somebody who is not a game master gets the honest version of what this page
 * is, which is not a thing you sign up for.
 */
export default function GmTables() {
  const { profile, loading, configured } = useSession();

  const [parties, setParties] = useState<Party[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || !profile) return;

    let alive = true;

    listParties()
      .then((all) => {
        if (alive) setParties(all);
      })
      .catch((problem: Error) => {
        if (!alive) return;
        setError(problem.message);
        setParties([]);
      });

    return () => {
      alive = false;
    };
  }, [configured, profile]);

  const mine = useMemo(
    () => (parties ?? []).filter((party) => party.gmId === profile?.uid),
    [parties, profile],
  );

  if (!configured) {
    return <p className={styles.plain}>Built and waiting on a Firebase project.</p>;
  }

  if (loading) return <p className={styles.plain}>One moment.</p>;

  if (!profile) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Sign in first</h2>
        <p className={styles.plain}>This page is the tables you run.</p>
        <Link href="/sign-in" className={styles.primary}>
          Sign in
        </Link>
      </div>
    );
  }

  if (!profile.gm) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Game masters are recruited, not signed up.</h2>
        <p className={styles.plain}>
          There is no form here, on purpose. We meet game masters in person before
          they are handed a party, and that is most of what makes it safe to put
          strangers in a room together. If you want to run games, write to us and
          we will take it from there.
        </p>
        <Link href="/join" className={styles.primary}>
          How that works
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {error ? <p className={styles.error}>{error}</p> : null}

      {parties === null ? (
        <p className={styles.plain}>Looking up your tables.</p>
      ) : mine.length === 0 ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>No tables yet.</h2>
          <p className={styles.plain}>
            You are marked as a game master and no party has been handed to you.
            They are put together by hand from people whose evenings actually
            overlap, so this fills in when one is ready rather than when you
            refresh.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {mine.map((party) => {
            const seats = Math.max(0, PARTY_MAX - party.playerIds.length);

            return (
              <li key={party.id} className={styles.table}>
                <div className={styles.tableHead}>
                  <h3 className={styles.tableName}>{party.name}</h3>
                  <span className={styles.status} data-status={party.status}>
                    {party.status}
                  </span>
                </div>

                <p className={styles.facts}>
                  {areaName(party.area)}
                  {" · "}
                  {party.playerIds.length} player{party.playerIds.length === 1 ? "" : "s"}
                  {seats > 0 ? `, ${seats} seat${seats === 1 ? "" : "s"} free` : ", full"}
                  {party.slot ? ` · ${describeSlot(party.slot)}` : " · hour not settled"}
                </p>

                <div className={styles.actions}>
                  <Link href={`/campaign/${party.id}`} className={styles.primary}>
                    Open the table
                  </Link>
                  <Link href={`/parties/${party.id}`} className={styles.secondary}>
                    What players see
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
