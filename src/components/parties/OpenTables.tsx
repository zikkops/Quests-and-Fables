"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listParties, myRequests, type SeatRequest } from "@/lib/firebase/party";
import { useSession } from "@/lib/firebase/session";
import { findArea } from "@/data/lebanon";
import { describeSlot, PARTY_MAX, type Party } from "@/lib/party";
import { keepApart, openTo, publicView, seatsOpen, type Fit } from "@/lib/match";
import { myBlocks, type Block } from "@/lib/firebase/block";
import styles from "./Parties.module.css";

type Props = {
  /** The area picked on the homepage, if the visitor came that way. */
  area?: string;
};

const areaName = (slug: string) => findArea(slug)?.area.name ?? slug;

/**
 * The tables you could actually join.
 *
 * Three different pages depending on who is looking, and the differences are
 * not cosmetic:
 *
 * - **Signed out.** Open tables, where and when they meet, seats left. Never
 *   who is at one. A stranger has told us nothing, so nothing can be filtered
 *   on their behalf and nothing about anybody may be shown to them.
 * - **Signed in.** The same list, filtered by `openTo` and ranked by fit — and
 *   a table that clashes with your limits or the rooms you will sit in is not
 *   ranked last, it is absent. See `src/lib/match.ts`.
 * - **Already asked.** What you asked for and where it got to.
 *
 * What nobody sees, ever, is another player's name, number or week.
 */
export default function OpenTables({ area }: Props) {
  const { user, profile, loading, configured } = useSession();

  const [parties, setParties] = useState<Party[] | null>(null);
  const [asked, setAsked] = useState<SeatRequest[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!configured) return;

    let alive = true;

    listParties()
      .then((all) => {
        if (alive) setParties(all);
      })
      .catch((problem: Error) => {
        if (!alive) return;
        setError(problem.message);
        /* Leave the loading state as well, or the message is rendered under
           text that still says we are looking. */
        setParties([]);
      });

    return () => {
      alive = false;
    };
  }, [configured, round]);

  /*
    Only this player's own blocks, because those are the only ones they are
    allowed to read. That covers "do not show me a table with somebody I
    blocked". The other direction cannot be done here and is not meant to be:
    finding out you have been blocked is the thing a block must never do. The
    matcher has the whole picture and is what actually seats people.
  */
  useEffect(() => {
    if (!user) return;

    let alive = true;
    myBlocks(user.uid)
      .then((mine) => {
        if (alive) setBlocks(mine);
      })
      .catch(() => {
        /* Nothing blocked, or rules not deployed. Not worth a message. */
      });

    return () => {
      alive = false;
    };
  }, [user, round]);

  useEffect(() => {
    if (!user) return;

    let alive = true;
    myRequests(user.uid)
      .then((mine) => {
        if (alive) setAsked(mine);
      })
      .catch(() => {
        /* Nothing asked for yet, or rules not deployed. Not worth a message. */
      });

    return () => {
      alive = false;
    };
  }, [user, round]);

  const shown = useMemo(() => {
    if (!parties) return [];

    const byArea = (party: Party) => !area || party.area === area;

    if (profile) {
      return openTo(profile, parties, keepApart(profile.uid, blocks))
        .filter((one) => byArea(one.party))
        .map((one) => ({ party: one.party, fit: one.fit as Fit | null }));
    }

    return publicView(parties)
      .filter(byArea)
      .map((party) => ({ party, fit: null }));
  }, [parties, profile, area, blocks]);

  const askedFor = useMemo(
    () => new Map(asked.map((request) => [request.partyId, request])),
    [asked],
  );

  if (!configured) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>No tables yet, because there is no database yet</h2>
        <p className={styles.emptyBody}>
          This page and everything behind it are built and waiting on a Firebase
          project. The character builder never needed one and works today.
        </p>
        <Link href="/character-builder" className={styles.primary}>
          Build a character
        </Link>
      </div>
    );
  }

  if (loading || parties === null) {
    return <p className={styles.emptyBody}>Looking for tables.</p>;
  }

  /* Counted from what is shown, not from what exists. A player filtered away
     from a table must not be told how many seats it has: the number would be
     the one thing telling them there is a table they cannot see. */
  const total = seatsOpen(shown.map((one) => one.party));

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <p className={styles.count}>
          {shown.length === 0
            ? "No open tables"
            : `${shown.length} open table${shown.length === 1 ? "" : "s"}`}
          {area ? ` in ${areaName(area)}` : ""}
          {total > 0 ? ` · ${total} seat${total === 1 ? "" : "s"} free` : ""}
        </p>

        {profile ? (
          <p className={styles.filtered}>
            Ranked by how well each one fits your week. Tables that clash with
            your limits or the rooms you will sit in are not shown at all.
          </p>
        ) : (
          <p className={styles.filtered}>
            Sign in and this becomes a ranked list: the hours you share with each
            table, and only the ones you could actually sit at.
          </p>
        )}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {shown.length === 0 ? (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            {area ? `Nobody is playing in ${areaName(area)} yet.` : "No tables are open."}
          </h2>
          <p className={styles.emptyBody}>
            Parties are assembled by hand from people whose evenings actually
            overlap, which is slower than a listings board and is the reason they
            hold together. Set your availability and you are in the pool.
          </p>
          <Link href={user ? "/account" : "/sign-in"} className={styles.primary}>
            {user ? "Set your availability" : "Join the pool"}
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {shown.map(({ party, fit }) => (
            <Table
              key={party.id}
              party={party}
              fit={fit}
              request={askedFor.get(party.id) ?? null}
              signedIn={Boolean(profile)}
              onChanged={() => setRound((n) => n + 1)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ==========================================================================
   One table
   ========================================================================== */

function Table({
  party,
  fit,
  request,
  signedIn,
}: {
  party: Party;
  fit: Fit | null;
  request: SeatRequest | null;
  signedIn: boolean;
  onChanged: () => void;
}) {
  const seatsLeft = Math.max(0, PARTY_MAX - party.playerIds.length);

  return (
    <li className={styles.table}>
      <div className={styles.tableHead}>
        <h3 className={styles.tableName}>{party.name}</h3>
        <span className={styles.seats}>
          {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} free
        </span>
      </div>

      <p className={styles.facts}>
        {areaName(party.area)}
        {party.slot ? ` · ${describeSlot(party.slot)}` : " · hour not settled yet"}
        {party.gmId ? " · has a game master" : " · waiting on a game master"}
      </p>

      {fit ? (
        <p className={fit.worksWhenTheyPlay ? styles.good : styles.maybe}>
          {party.slot
            ? fit.worksWhenTheyPlay
              ? "You are free when they play."
              : "You are not free at their hour, which is the one thing that has to change."
            : `${fit.slots.length} hour${fit.slots.length === 1 ? "" : "s"} you and this table both have free.`}
          {fit.nearby ? " It is somewhere you already play." : ""}
        </p>
      ) : null}

      <div className={styles.tableActions}>
        <Link href={`/parties/${party.id}`} className={styles.secondary}>
          Look at this table
        </Link>

        {request ? (
          <span className={styles.asked} data-status={request.status}>
            {request.status === "waiting"
              ? "You have asked for a seat"
              : request.status === "offered"
                ? "A seat is being offered to you"
                : request.status === "joined"
                  ? "You are in"
                  : "Not this time"}
          </span>
        ) : !signedIn ? (
          <Link href="/sign-in" className={styles.secondary}>
            Sign in to ask for a seat
          </Link>
        ) : null}
      </div>
    </li>
  );
}
