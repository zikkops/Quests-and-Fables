"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  askForSeat,
  getChat,
  listParties,
  myRequests,
  withdrawRequest,
  type SeatRequest,
} from "@/lib/firebase/party";
import { useSession } from "@/lib/firebase/session";
import { findArea } from "@/data/lebanon";
import { describeSlot, PARTY_MAX, type Party } from "@/lib/party";
import { fitFor, fits, type Fit } from "@/lib/match";
import { limitLabel, type LimitKey } from "@/lib/firebase/schema";
import GmStanding from "./GmStanding";
import styles from "./Parties.module.css";
import one from "./OneTable.module.css";

const areaName = (slug: string) => findArea(slug)?.area.name ?? slug;

/**
 * One table, and the only thing you can do about it: ask.
 *
 * What is shown here about the people already at it is the aggregate and
 * nothing else — the hours they share, the rooms they can use, what the table
 * will not play through. Never a name, never a number, never whose limit it is.
 * A player deciding whether to spend a weeknight with strangers needs to know
 * what the evening will be like, not who is in it, and the second one is not
 * ours to hand over.
 *
 * The group chat link appears only once you are a member, because it lives in a
 * document only members can read. If the rules and this component ever
 * disagree, the rules are right.
 */
export default function OneTable({ partyId }: { partyId: string }) {
  const { user, profile, loading, configured } = useSession();

  const [party, setParty] = useState<Party | null | "missing">(null);
  const [request, setRequest] = useState<SeatRequest | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!configured) return;

    let alive = true;

    listParties()
      .then((all) => {
        if (!alive) return;
        setParty(all.find((entry) => entry.id === partyId) ?? "missing");
      })
      .catch((problem: Error) => {
        if (!alive) return;
        setError(problem.message);
        setParty("missing");
      });

    return () => {
      alive = false;
    };
  }, [configured, partyId, round]);

  useEffect(() => {
    if (!user) return;

    let alive = true;

    myRequests(user.uid)
      .then((mine) => {
        if (alive) setRequest(mine.find((entry) => entry.partyId === partyId) ?? null);
      })
      .catch(() => {
        /* Nothing asked for. Not an error. */
      });

    return () => {
      alive = false;
    };
  }, [user, partyId, round]);

  /* Members only, and the rules are what enforce that. This just asks. */
  const member = Boolean(
    profile && party && party !== "missing"
      && (party.playerIds.includes(profile.uid) || party.gmId === profile.uid),
  );

  useEffect(() => {
    if (!member) return;

    let alive = true;
    getChat(partyId)
      .then((chat) => {
        if (alive) setInvite(chat?.invite ?? null);
      })
      .catch(() => {
        /* No chat set up for this party yet. */
      });

    return () => {
      alive = false;
    };
  }, [member, partyId]);

  if (!configured) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>There is no database yet</h2>
        <p className={styles.emptyBody}>
          This page is built and waiting on a Firebase project.
        </p>
        <Link href="/parties" className={styles.primary}>
          Back to the tables
        </Link>
      </div>
    );
  }

  if (loading || party === null) return <p className={styles.emptyBody}>Looking it up.</p>;

  if (party === "missing") {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>No such table.</h2>
        <p className={styles.emptyBody}>
          It may have filled up, or finished. Either way there is nothing here.
        </p>
        <Link href="/parties" className={styles.primary}>
          See what is open
        </Link>
      </div>
    );
  }

  const seatsLeft = Math.max(0, PARTY_MAX - party.playerIds.length);
  const fit: Fit | null = profile ? fitFor(profile, party) : null;
  const table = party.profile;

  const ask = async () => {
    if (!user) return;
    setError(null);
    setBusy(true);

    try {
      await askForSeat(user.uid, party.id, note);
      setNote("");
      setRound((n) => n + 1);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!request) return;
    setError(null);
    setBusy(true);

    try {
      await withdrawRequest(request.id);
      setRequest(null);
      setRound((n) => n + 1);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const limits = Object.entries(table?.limits ?? {}) as [LimitKey, "veil" | "line"][];

  return (
    <div className={one.wrap}>
      <section className={one.card}>
        <div className={one.head}>
          <h2 className={one.name}>{party.name}</h2>
          <span className={one.seats}>
            {seatsLeft} of {PARTY_MAX} seats free
          </span>
        </div>

        <dl className={one.facts}>
          <div>
            <dt>Where</dt>
            <dd>{areaName(party.area)}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{party.slot ? describeSlot(party.slot) : "Not settled yet"}</dd>
          </div>
          <div>
            <dt>Game master</dt>
            <dd>{party.gmId ? "Assigned" : "Not yet"}</dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd>
              {table?.arrangements.length
                ? table.arrangements
                    .map((where) => (where === "public" ? "Somewhere public" : "Somebody's home"))
                    .join(" or ")
                : "Not agreed yet"}
            </dd>
          </div>
        </dl>

        <p className={one.privacy}>
          Who is at this table is not shown, and neither is anything belonging to
          one of them. What you can see is what the table has agreed between
          them, which is what the evening will actually be like.
        </p>
      </section>

      {party.gmId ? <GmStanding gmId={party.gmId} /> : null}

      {limits.length > 0 ? (
        <section className={one.card}>
          <h3 className={one.cardTitle}>What this table will not play through</h3>
          <p className={one.body}>
            A <strong>line</strong> does not happen here. A <strong>veil</strong>{" "}
            happens off-screen: the scene cuts away and the story carries on.
            Anything not listed is fine.
          </p>

          <ul className={one.limits}>
            {limits.map(([topic, level]) => (
              <li key={topic} className={one.limit} data-level={level}>
                <span className={one.limitLevel}>{level}</span>
                {limitLabel(topic)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {member ? (
        <section className={one.card}>
          <h3 className={one.cardTitle}>You are at this table</h3>
          {invite ? (
            <>
              <p className={one.body}>The party keeps its conversation here.</p>
              <a
                className={styles.primary}
                href={invite}
                target="_blank"
                rel="noreferrer"
              >
                Open the group chat
              </a>
            </>
          ) : (
            <p className={one.body}>
              No group chat has been set up for this party yet. It will appear
              here when it is.
            </p>
          )}

          <Link href={`/campaign/${party.id}`} className={styles.secondary}>
            The campaign
          </Link>
        </section>
      ) : (
        <Asking
          signedIn={Boolean(profile)}
          fit={fit}
          request={request}
          note={note}
          busy={busy}
          onNote={setNote}
          onAsk={ask}
          onWithdraw={withdraw}
        />
      )}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

/* ==========================================================================
   Asking for a seat
   ========================================================================== */

function Asking({
  signedIn,
  fit,
  request,
  note,
  busy,
  onNote,
  onAsk,
  onWithdraw,
}: {
  signedIn: boolean;
  fit: Fit | null;
  request: SeatRequest | null;
  note: string;
  busy: boolean;
  onNote: (value: string) => void;
  onAsk: () => void;
  onWithdraw: () => void;
}) {
  if (!signedIn) {
    return (
      <section className={one.card}>
        <h3 className={one.cardTitle}>Asking for a seat needs an account</h3>
        <p className={one.body}>
          Because a seat means being somewhere at a certain hour, and a table
          cannot hold one for somebody it cannot reach. Building a character
          never needs one.
        </p>
        <Link href="/sign-in" className={styles.primary}>
          Sign in
        </Link>
      </section>
    );
  }

  if (request) {
    return (
      <section className={one.card}>
        <h3 className={one.cardTitle}>
          {request.status === "waiting"
            ? "You have asked for a seat here"
            : request.status === "offered"
              ? "A seat is being offered to you"
              : request.status === "joined"
                ? "You are in"
                : "Not this time"}
        </h3>

        <p className={one.body}>
          {request.status === "waiting"
            ? "Somebody reads every one of these. A party is put together by hand, so this takes days rather than seconds."
            : request.status === "offered"
              ? "Check your phone. We will have been in touch about the details."
              : request.status === "declined"
                ? "This table went another way. It is not a judgement on you, and it does not affect anything else you ask for."
                : "Your seat is confirmed."}
        </p>

        {request.status === "waiting" ? (
          <button type="button" className={styles.secondary} onClick={onWithdraw} disabled={busy}>
            {busy ? "One moment" : "Withdraw"}
          </button>
        ) : null}
      </section>
    );
  }

  /* A table shown to a signed-in player has already passed every hard filter,
     so this is never the place a limit clash is explained. It cannot be: the
     table would not have been in the list. */
  const blocked = fit && !fits(fit);

  return (
    <section className={one.card}>
      <h3 className={one.cardTitle}>Ask for a seat</h3>

      {blocked ? (
        <p className={one.blocked}>{fit.blockers[0]?.detail}</p>
      ) : (
        <>
          <p className={one.body}>
            {fit?.worksWhenTheyPlay === false
              ? "You are not free at the hour this table plays, so say something about that below if it can change."
              : "Say anything the game master should know. What you have played, what you want out of it, or nothing at all."}
          </p>

          <textarea
            className={one.note}
            value={note}
            maxLength={500}
            rows={3}
            onChange={(event) => onNote(event.target.value)}
            placeholder="Optional"
            aria-label="Anything to say"
          />

          <button type="button" className={styles.primary} onClick={onAsk} disabled={busy}>
            {busy ? "Sending" : "Ask for a seat"}
          </button>
        </>
      )}
    </section>
  );
}
