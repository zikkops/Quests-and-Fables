"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listParties, listProfiles } from "@/lib/firebase/party";
import { allBlocks, type Block } from "@/lib/firebase/block";
import { useSession } from "@/lib/firebase/session";
import type { Profile } from "@/lib/firebase/schema";
import { type Party } from "@/lib/party";
import Players from "./Players";
import Parties from "./Parties";
import Requests from "./Requests";
import Reports from "./Reports";
import styles from "./Admin.module.css";

/**
 * The room where parties get made.
 *
 * Everything here needs the `admin` custom claim, and the claim is checked in
 * two places for two different reasons. This component checks it to decide what
 * to render; `firestore.rules` checks it to decide what is allowed. Only the
 * second one matters. Somebody who forced this component to render without the
 * claim would be looking at a table of permission errors, not at anybody's
 * phone number.
 *
 * Both lists are read whole rather than paged. The console's real question is
 * "which four of these people have an evening in common", and that is a
 * question about all of them at once — paging would mean an admin clicking
 * through pages hoping. Revisit at a few thousand players.
 */
export default function AdminConsole() {
  const { user, admin, loading, configured } = useSession();

  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [parties, setParties] = useState<Party[] | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;

    let alive = true;

    /*
      Blocks come with the profiles, because seating is where they are actually
      enforced. This is the only place in the product that can see them in both
      directions, and a player who blocked somebody must not be handed to them
      by an admin who could not see it.
    */
    Promise.all([listProfiles(), listParties(), allBlocks()])
      .then(([people, groups, kept]) => {
        if (!alive) return;
        setProfiles(people);
        setParties(groups);
        setBlocks(kept);
      })
      .catch((problem: Error) => {
        if (!alive) return;
        setError(problem.message);
        setProfiles([]);
        setParties([]);
      });

    return () => {
      alive = false;
    };
  }, [admin, round]);

  const reload = () => setRound((n) => n + 1);

  /* Who is already spoken for. Handing somebody a second Thursday evening is
     the mistake this console exists to prevent, so it is never more than a
     glance away. */
  const spokenFor = useMemo(() => {
    const taken = new Map<string, string>();
    for (const party of parties ?? []) {
      if (party.status === "closed") continue;
      for (const uid of party.playerIds) taken.set(uid, party.name);
      if (party.gmId) taken.set(party.gmId, party.name);
    }
    return taken;
  }, [parties]);

  if (!configured) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>There is no database yet</h2>
        <p className={styles.body}>
          The console is built and waiting on a Firebase project. With no keys in
          the environment there is nobody to list and no party to make.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>One moment</h2>
        <p className={styles.body}>Checking who you are.</p>
      </section>
    );
  }

  if (!user || !admin) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Not for you</h2>
        <p className={styles.body}>
          This page is for whoever runs Quests &amp; Fables. If that is you, the
          account you are signed in with does not carry the admin claim yet.
        </p>
        <Link href="/" className={styles.secondary}>
          Back to the site
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className={styles.warning}>
        <p className={styles.warningTitle}>Everything below is private</p>
        <p className={styles.body}>
          Phone numbers and home areas are on this page and nowhere else in the
          product. Players are told that you can see them and that nobody else
          can. Numbers stay hidden until you ask for them, which is worth
          keeping true of any screen somebody might photograph.
        </p>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      <Players
        profiles={profiles}
        blocks={blocks}
        parties={parties ?? []}
        spokenFor={spokenFor}
        onChanged={reload}
      />

      <Reports />

      <Requests
        parties={parties ?? []}
        profiles={profiles ?? []}
        blocks={blocks}
        onChanged={reload}
      />

      <Parties
        parties={parties}
        profiles={profiles ?? []}
        onChanged={reload}
      />
    </>
  );
}
