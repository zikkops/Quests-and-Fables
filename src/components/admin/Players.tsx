"use client";

import { useMemo, useState } from "react";
import {
  createParty,
  setGameMaster,
  seatMember,
} from "@/lib/firebase/party";
import type { Block } from "@/lib/firebase/block";
import { aggregate, keepApart } from "@/lib/match";
import { findArea, LIVE_LEBANON } from "@/data/lebanon";
import type { Profile } from "@/lib/firebase/schema";
import {
  describeSlot,
  freeBlocks,
  overlap,
  PARTY_MAX,
  PARTY_MIN,
  slotsIn,
  type Party,
} from "@/lib/party";
import styles from "./Admin.module.css";

type Props = {
  profiles: Profile[] | null;
  /** Every block there is, so a party is never built across one. */
  blocks: Block[];
  parties: Party[];
  /** uid to party name, for anybody already at a table. */
  spokenFor: Map<string, string>;
  onChanged: () => void;
};

const areaName = (slug: string) => findArea(slug)?.area.name ?? slug;

/**
 * Everyone who has an account, and the one question worth asking about them.
 *
 * That question is not "who is in Achrafieh" — it is "which four of these
 * people have an evening in common", and the answer changes with every player
 * you tick. So the overlap is computed live from the selection and shown before
 * the party can be made. Four people with plenty of free time and no hour in
 * common are not a party, and this is the only screen that can say so.
 *
 * Phone numbers stay masked until asked for. Not ceremony: this is the one page
 * in the product that can show two hundred of them at once, and it is the kind
 * of screen people photograph to send to somebody else.
 */
export default function Players({ profiles, parties, blocks, spokenFor, onChanged }: Props) {
  const [term, setTerm] = useState("");
  const [area, setArea] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase();

    return (profiles ?? []).filter((profile) => {
      if (area && profile.area !== area && !profile.playAreas.includes(area)) return false;
      if (freeOnly && spokenFor.has(profile.uid)) return false;
      if (!needle) return true;

      return [profile.username, profile.email, profile.phone, areaName(profile.area)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [profiles, term, area, freeOnly, spokenFor]);

  const chosen = useMemo(
    () => (profiles ?? []).filter((profile) => picked.includes(profile.uid)),
    [profiles, picked],
  );

  /* The live answer. Recomputed on every tick, which is the point of it. */
  const common = useMemo(() => overlap(chosen.map((profile) => profile.week)), [chosen]);
  const commonSlots = slotsIn(common);

  const flip = (uid: string) =>
    setPicked((current) =>
      current.includes(uid) ? current.filter((one) => one !== uid) : [...current, uid],
    );

  const reveal = (uid: string) =>
    setRevealed((current) => new Set(current).add(uid));

  const masked = (phone: string) => `••• ${phone.slice(-3)}`;

  const form = async () => {
    setError(null);
    setBusy(true);

    /*
      Nobody is put in a room with somebody they blocked, or with somebody who
      blocked them. Checked here rather than trusted to the person clicking,
      because this is the screen that actually assembles a table and the pair
      it would seat cannot see each other's blocks to object.
    */
    for (const one of chosen) {
      const apart = keepApart(one.uid, blocks);
      const other = chosen.find((candidate) => apart.has(candidate.uid));
      if (other) {
        setError(
          `${one.username} and ${other.username} must not be seated together. `
          + "Take one of them out of this party.",
        );
        setBusy(false);
        return;
      }
    }

    try {
      /* Where they play, decided by where most of them already are rather than
         by an admin guessing. */
      const tally = new Map<string, number>();
      for (const profile of chosen) {
        for (const slug of profile.playAreas) {
          tally.set(slug, (tally.get(slug) ?? 0) + 1);
        }
      }

      const [best] = [...tally.entries()].sort((a, b) => b[1] - a[1]);

      const partyId = await createParty({
        name: name.trim() || `Party ${parties.length + 1}`,
        area: best?.[0] ?? chosen[0]?.area ?? "",
        playerIds: picked,
        /* What a browsing player will be matched against. Computed here
           because this is the only screen that holds every member's profile,
           and it must never be recomputed anywhere a player can read. */
        profile: aggregate(chosen),
      });

      /* The key to the table, not just a name on its roster. Without this the
         party exists and its own campaign page refuses everybody at it. */
      await Promise.all(
        chosen.map((one) =>
          seatMember(partyId, { uid: one.uid, role: "player", name: one.username }),
        ),
      );

      setPicked([]);
      setName("");
      onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleGm = async (profile: Profile) => {
    setError(null);
    try {
      await setGameMaster(profile.uid, !profile.gm);
      onChanged();
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  if (profiles === null) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Players</h2>
        <p className={styles.body}>Reading the database.</p>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.cardTitle}>Players</h2>
        <span className={styles.tally}>
          {shown.length} of {profiles.length}
        </span>
      </div>

      <div className={styles.filters}>
        <input
          type="search"
          className={styles.input}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Username, email, number, area"
          aria-label="Search players"
        />

        <select
          className={styles.select}
          value={area}
          onChange={(event) => setArea(event.target.value)}
          aria-label="Filter by area"
        >
          <option value="">Anywhere</option>
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

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={() => setFreeOnly((on) => !on)}
          />
          Not in a party
        </label>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={() => setShowNumbers((on) => !on)}
          />
          Show numbers
        </label>
      </div>

      {profiles.length === 0 ? (
        <p className={styles.body}>
          Nobody has finished setting up an account yet. This fills in on its own.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.tick}>
                  <span className={styles.hidden}>Pick</span>
                </th>
                <th scope="col">Username</th>
                <th scope="col">Phone</th>
                <th scope="col">Lives in</th>
                <th scope="col">Plays in</th>
                <th scope="col">Free</th>
                <th scope="col">Characters</th>
                <th scope="col">At a table</th>
                <th scope="col">Game master</th>
              </tr>
            </thead>

            <tbody>
              {shown.map((profile) => {
                const at = spokenFor.get(profile.uid);
                const open = showNumbers || revealed.has(profile.uid);

                return (
                  <tr
                    key={profile.uid}
                    className={picked.includes(profile.uid) ? styles.picked : undefined}
                  >
                    <td className={styles.tick}>
                      <input
                        type="checkbox"
                        checked={picked.includes(profile.uid)}
                        onChange={() => flip(profile.uid)}
                        aria-label={`Put ${profile.username} in a party`}
                      />
                    </td>

                    <td className={styles.name}>{profile.username}</td>

                    <td>
                      {open ? (
                        <a href={`tel:${profile.phone}`} className={styles.phone}>
                          {profile.phone}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className={styles.masked}
                          onClick={() => reveal(profile.uid)}
                        >
                          {masked(profile.phone)}
                        </button>
                      )}
                    </td>

                    <td>{areaName(profile.area)}</td>
                    <td className={styles.areas}>
                      {profile.playAreas.map(areaName).join(", ") || "—"}
                    </td>
                    <td>{freeBlocks(profile.week)}</td>
                    <td>{profile.characterCount}</td>
                    <td className={styles.quiet}>{at ?? ""}</td>

                    <td>
                      <button
                        type="button"
                        className={profile.gm ? `${styles.gm} ${styles.gmOn}` : styles.gm}
                        onClick={() => toggleGm(profile)}
                        aria-pressed={Boolean(profile.gm)}
                      >
                        {profile.gm ? "Game master" : "Make one"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      {picked.length > 0 ? (
        <div className={styles.tray}>
          <div className={styles.trayHead}>
            <p className={styles.trayTitle}>
              {picked.length} picked
              {picked.length < PARTY_MIN ? ` · ${PARTY_MIN - picked.length} short of a party` : ""}
              {picked.length > PARTY_MAX ? ` · ${picked.length - PARTY_MAX} too many` : ""}
            </p>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setPicked([])}
            >
              Clear
            </button>
          </div>

          <p className={styles.picks}>
            {chosen.map((profile) => profile.username).join(", ")}
          </p>

          {/* The reason this console exists. */}
          {commonSlots.length === 0 ? (
            <p className={styles.noOverlap}>
              No hours in common. These people cannot be a party, however well
              they match on anything else.
            </p>
          ) : (
            <p className={styles.overlap}>
              {commonSlots.length} in common:{" "}
              {commonSlots.map(describeSlot).join(" · ")}
            </p>
          )}

          <div className={styles.trayForm}>
            <input
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name this party"
              aria-label="Party name"
            />
            <button
              type="button"
              className={styles.primary}
              disabled={busy || picked.length < PARTY_MIN || picked.length > PARTY_MAX}
              onClick={form}
            >
              {busy ? "Making it…" : "Form the party"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
