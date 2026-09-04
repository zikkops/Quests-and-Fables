"use client";

import { useEffect, useState } from "react";
import { getChat, setInvite, updateParty } from "@/lib/firebase/party";
import { findArea } from "@/data/lebanon";
import type { Profile } from "@/lib/firebase/schema";
import {
  chatLink,
  describeSlot,
  invitePattern,
  numbersForPaste,
  overlap,
  PARTY_MIN,
  slotsIn,
  type Party,
  type PartyStatus,
} from "@/lib/party";
import styles from "./Admin.module.css";

type Props = {
  parties: Party[] | null;
  profiles: Profile[];
  onChanged: () => void;
};

const STATUSES: PartyStatus[] = ["forming", "assigned", "playing", "closed"];

export default function Parties({ parties, profiles, onChanged }: Props) {
  if (parties === null) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Parties</h2>
        <p className={styles.body}>Reading the database.</p>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.cardTitle}>Parties</h2>
        <span className={styles.tally}>{parties.length}</span>
      </div>

      {parties.length === 0 ? (
        <p className={styles.body}>
          None yet. Pick four to six players above and form one.
        </p>
      ) : (
        <div className={styles.parties}>
          {parties.map((party) => (
            <One key={party.id} party={party} profiles={profiles} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * One party, and the four things you actually do to it: give it a game master,
 * settle on an hour, get everyone into a chat, and mark where it has got to.
 */
function One({
  party,
  profiles,
  onChanged,
}: {
  party: Party;
  profiles: Profile[];
  onChanged: () => void;
}) {
  const [invite, setInviteValue] = useState("");
  const [savedInvite, setSavedInvite] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* The link lives a document deeper than the party, because the party itself
     is readable by anybody browsing for a table and a link is a key. */
  useEffect(() => {
    let alive = true;

    getChat(party.id)
      .then((chat) => {
        if (!alive) return;
        setInviteValue(chat?.invite ?? "");
        setSavedInvite(chat?.invite ?? "");
      })
      .catch(() => {
        /* No chat document yet, which is the normal case for a new party. */
      });

    return () => {
      alive = false;
    };
  }, [party.id]);

  const members = profiles.filter((profile) => party.playerIds.includes(profile.uid));
  const master = profiles.find((profile) => profile.uid === party.gmId) ?? null;
  const masters = profiles.filter((profile) => profile.gm);

  const common = slotsIn(overlap(members.map((profile) => profile.week)));
  const areaLabel = findArea(party.area)?.area.name ?? party.area;

  const change = async (patch: Parameters<typeof updateParty>[1]) => {
    setError(null);
    setBusy(true);
    try {
      await updateParty(party.id, patch);
      onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /*
    The honest half of "one button that makes a WhatsApp group".

    WhatsApp cannot create a group from a link or an API: `wa.me` opens one
    chat, `chat.whatsapp.com` joins a group that already exists, and the
    Business API does not make consumer groups. So this copies the numbers in
    the format the new-group screen accepts, and the invite link below is how
    the group gets back to the players once it exists.
  */
  const copyNumbers = async () => {
    const numbers = numbersForPaste(members.map((profile) => profile.phone));

    try {
      await navigator.clipboard.writeText(numbers);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Could not reach the clipboard. The numbers are: ${numbers.replace(/\n/g, ", ")}`);
    }
  };

  const saveInvite = async () => {
    const trimmed = invite.trim();
    if (trimmed && !invitePattern.test(trimmed)) {
      setError("That is not a WhatsApp invite link. They look like https://chat.whatsapp.com/…");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await setInvite(party.id, trimmed || null);
      setSavedInvite(trimmed);
      onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={styles.party}>
      <div className={styles.partyHead}>
        <h3 className={styles.partyName}>{party.name}</h3>
        <span className={styles.status} data-status={party.status}>
          {party.status}
        </span>
        <span className={styles.quiet}>
          {areaLabel} · {party.playerIds.length} players
          {master ? ` · run by ${master.username}` : " · no game master"}
          {party.slot ? ` · ${describeSlot(party.slot)}` : ""}
        </span>
      </div>

      <p className={styles.picks}>
        {members.map((profile) => profile.username).join(", ") || "Nobody"}
      </p>

      <div className={styles.partyRow}>
        <label className={styles.field}>
          <span className={styles.label}>Game master</span>
          <select
            className={styles.select}
            value={party.gmId ?? ""}
            disabled={busy || party.playerIds.length < PARTY_MIN}
            onChange={(event) => change({ gmId: event.target.value || null })}
          >
            <option value="">Nobody yet</option>
            {masters.map((profile) => (
              <option key={profile.uid} value={profile.uid}>
                {profile.username}
              </option>
            ))}
          </select>
          <span className={styles.hint}>
            {party.playerIds.length < PARTY_MIN
              ? `Four players before a game master. This one has ${party.playerIds.length}.`
              : masters.length === 0
                ? "Nobody is marked a game master yet. Mark one in the table above."
                : "Recruited people only. They never take one of the four to six seats."}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>When they play</span>
          <select
            className={styles.select}
            value={party.slot ? `${party.slot.day}-${party.slot.block}` : ""}
            disabled={busy || common.length === 0}
            onChange={(event) => {
              const [day, block] = event.target.value.split("-").map(Number);
              change({ slot: event.target.value ? { day, block } : null });
            }}
          >
            <option value="">Not settled</option>
            {common.map((slot) => (
              <option key={`${slot.day}-${slot.block}`} value={`${slot.day}-${slot.block}`}>
                {describeSlot(slot)}
              </option>
            ))}
          </select>
          <span className={styles.hint}>
            {common.length === 0
              ? "No hour works for all of them. Somebody's week has to change, or the party does."
              : `${common.length} to choose from, and every one works for all ${members.length}.`}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Where it has got to</span>
          <select
            className={styles.select}
            value={party.status}
            disabled={busy}
            onChange={(event) => change({ status: event.target.value as PartyStatus })}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.chat}>
        <p className={styles.label}>The group chat</p>

        <div className={styles.chatRow}>
          <button type="button" className={styles.secondary} onClick={copyNumbers}>
            {copied ? "Copied" : `Copy ${members.length} numbers`}
          </button>

          <input
            className={styles.input}
            value={invite}
            onChange={(event) => setInviteValue(event.target.value)}
            placeholder="https://chat.whatsapp.com/…"
            aria-label="WhatsApp group invite link"
          />

          <button
            type="button"
            className={styles.secondary}
            onClick={saveInvite}
            disabled={busy || invite.trim() === savedInvite}
          >
            Save link
          </button>
        </div>

        <p className={styles.hint}>
          WhatsApp cannot make a group from a link, so this does the half that
          can be automated: copy the numbers, open WhatsApp, new group, paste.
          Then put the invite link here and every player gets it, including
          anyone added later.
        </p>

        {members.length > 0 ? (
          <p className={styles.chatLinks}>
            {members.map((profile) => (
              <a
                key={profile.uid}
                className={styles.chatLink}
                href={chatLink(profile.phone)}
                target="_blank"
                rel="noreferrer"
              >
                {profile.username}
              </a>
            ))}
          </p>
        ) : null}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </article>
  );
}
