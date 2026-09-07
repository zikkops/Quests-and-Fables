import {
  EMPTY_WEEK,
  EXPERIENCE,
  experienceRank,
  STYLE_MAX,
  type Limits,
  type PlayStyle,
  type Profile,
  type StyleAxis,
  type Venues,
  type Week,
} from "./firebase/schema";
import { overlap, PARTY_MAX, slotsIn, type Party, type Slot } from "./party";

/**
 * Whether a player and a party fit, and why not when they do not.
 *
 * This file is where `/safety` stops being a page of promises. Two of the
 * things it says are true only if something enforces them, and this is the
 * something:
 *
 * - **Venue type is a hard filter, not a preference.** Nobody is offered a home
 *   game they did not ask for. Not ranked lower. Not shown with a warning.
 *   Not offered.
 * - **A party that conflicts with your limits is never shown to you at all.**
 *   The alternative is asking the person with the least power in the room to
 *   raise it at the table, which is asking them to do the hardest thing there.
 *
 * Everything else — hours, area, seats — is a score. Those two are not, and
 * `blockers` is a separate field from `score` so no future ranking tweak can
 * ever weigh a hard limit against a good evening.
 *
 * **A party is matched against its aggregate, never against its members.**
 * Weeks, limits and venue comfort are private: a player browsing open tables
 * cannot read another player's profile and must not be able to. So the party
 * document carries a summary of its own members — the hours they all share, the
 * rooms they can all use, the strictest limit anyone has drawn — and matching
 * reads that. Nobody learns which of the four is the one who will not go to a
 * stranger's house.
 */

/** A room this table could actually sit in. */
export type Arrangement = "public" | "home";

/**
 * What a party looks like from outside it: enough to match on, and nothing
 * that belongs to any one member.
 */
export type PartyProfile = {
  /** The blocks every current member has free. */
  week: Week;
  /** Every room they can all use. Empty means this table cannot meet at all. */
  arrangements: Arrangement[];
  /** The strictest thing anyone has said about each topic. */
  limits: Limits;
  /**
   * The table's average taste, and how long its members have been playing.
   *
   * Averages rather than the strictest answer, which is the opposite of how
   * `limits` works, and deliberately: a limit is a floor somebody set and a
   * taste is a middle everybody lands on. Absent when nobody at the table has
   * answered, which is why both are optional.
   */
  style?: PlayStyle;
  experience?: number;
};

export const EMPTY_PROFILE: PartyProfile = {
  week: [...EMPTY_WEEK] as Week,
  arrangements: [],
  limits: {},
};

/* ==========================================================================
   Building the aggregate

   Run wherever membership changes, by something that legitimately holds every
   member's profile. Today that is the admin console. The result is written to
   the party document, and it is the only thing a browsing player ever sees of
   the people already at that table.
   ========================================================================== */

/**
 * Every arrangement that works for all of these people at once.
 *
 * The two are not symmetrical, and that asymmetry is the point:
 *
 * - **Public** needs everybody to accept a public venue. One person who will
 *   not, and the table cannot meet in a café.
 * - **A home game** needs *one* person willing to host and *everybody else*
 *   willing to be a guest. The host is not a guest in their own house, so they
 *   are exempt from needing `guest` — and a player who only ticked "my own
 *   home" has offered a room, not agreed to enter somebody else's.
 *
 * Treating `host` and `guest` as one flag would put that player in a stranger's
 * house on the strength of an offer they made about their own.
 */
export function arrangements(members: Profile[]): Arrangement[] {
  if (members.length === 0) return [];

  const found: Arrangement[] = [];

  if (members.every((member) => member.venues?.public)) found.push("public");

  const someoneHosts = members.some(
    (host) =>
      host.venues?.host
      && members.every((member) => member.uid === host.uid || member.venues?.guest),
  );

  if (someoneHosts) found.push("home");

  return found;
}

/**
 * The strictest answer anyone at the table gave, per topic.
 *
 * A line beats a veil beats nothing. If any one person has ruled a topic out,
 * the table has ruled it out — that is what makes a line a line, and it is why
 * merging cannot be a majority.
 */
export function mergedLimits(members: Profile[]): Limits {
  const merged: Limits = {};

  for (const member of members) {
    for (const [topic, level] of Object.entries(member.limits ?? {})) {
      const key = topic as keyof Limits;
      if (merged[key] === "line") continue;
      if (level === "line" || merged[key] === undefined) merged[key] = level;
    }
  }

  return merged;
}

/** The table's average on each axis, or absent if nobody has said. */
export function averageStyle(members: Profile[]): PlayStyle | undefined {
  const said = members.filter((member) => member.style);
  if (said.length === 0) return undefined;

  const mean = (axis: StyleAxis) =>
    said.reduce((total, member) => total + (member.style?.[axis] ?? 0), 0) / said.length;

  return {
    combat: mean("combat"),
    roleplay: mean("roleplay"),
    exploration: mean("exploration"),
  };
}

/** The table's average experience as a rank, or absent if nobody has said. */
export function averageExperience(members: Profile[]): number | undefined {
  const said = members.filter((member) => member.experience);
  if (said.length === 0) return undefined;

  return (
    said.reduce((total, member) => total + experienceRank(member.experience!), 0)
    / said.length
  );
}

export const aggregate = (members: Profile[]): PartyProfile => ({
  week: overlap(members.map((member) => member.week)),
  arrangements: arrangements(members),
  limits: mergedLimits(members),
  style: averageStyle(members),
  experience: averageExperience(members),
});

/* ==========================================================================
   Matching one player against it
   ========================================================================== */

export type Blocker =
  | { kind: "venue"; detail: string }
  | { kind: "limits"; detail: string }
  | { kind: "full"; detail: string }
  | { kind: "closed"; detail: string }
  | { kind: "already"; detail: string };

export type Fit = {
  /** The hours this player shares with everybody already at the table. */
  slots: Slot[];
  /** True when the party's settled hour is one this player is free for. */
  worksWhenTheyPlay: boolean;
  /** True when the party plays somewhere this player is willing to travel. */
  nearby: boolean;
  seatsLeft: number;
  /**
   * Nothing here means the party may be shown. Anything here means it must not
   * be, whatever the score says.
   */
  blockers: Blocker[];
  /** Only meaningful when `blockers` is empty. Higher is a better table. */
  score: number;
};

export const fits = (fit: Fit) => fit.blockers.length === 0;

/** Whether a player can sit in any room this table can use. */
function venueClash(player: Venues, table: Arrangement[]): string | null {
  if (table.length === 0) {
    return "This table has not agreed on anywhere it can meet.";
  }

  /* A home game means somebody there is hosting, so the question asked of a
     newcomer is whether they will be a guest. Their own offer to host is not
     an answer to it. */
  const canJoin = table.some((where) =>
    where === "public" ? player.public : player.guest,
  );

  if (canJoin) return null;

  const theirs = table
    .map((where) => (where === "public" ? "somewhere public" : "at somebody's home"))
    .join(" or ");

  return `This table meets ${theirs}, which is not something you have said yes to.`;
}

/**
 * A limit clash, in the only direction that can exist.
 *
 * A line is always compatible with another line: two people refusing the same
 * thing agree. What cannot be reconciled is this player's **line** against a
 * topic the table has as a **veil**, because somebody there has said out loud
 * they expect it to happen off-screen.
 */
function limitClash(player: Limits, table: Limits): string | null {
  const clashes = (Object.entries(player) as [keyof Limits, "veil" | "line"][]).filter(
    ([topic, level]) => level === "line" && table[topic] === "veil",
  );

  if (clashes.length === 0) return null;

  return clashes.length === 1
    ? "This table expects a topic you have ruled out entirely."
    : `This table expects ${clashes.length} topics you have ruled out entirely.`;
}

/**
 * How close this player's taste is to the table's, from 0 to 1.
 *
 * Deliberately gentle. It is worth at most 20 points against 100 for the hours
 * and 40 for the area, because a table you can reach on a night you are free
 * beats a table that likes exactly what you like and meets on a Tuesday you
 * cannot do. Scope v1 puts them in that order and so does this.
 *
 * Returns the **midpoint** when either side has not said, not zero. Zero was
 * wrong and measurably so: it put a player who answered nothing below a player
 * whose taste actively clashed, so declining to answer cost more than being a
 * poor fit. An unknown is an unknown, and the middle is what that is worth.
 */
function toneFit(player: Profile, table: PartyProfile): number {
  if (!player.style || !table.style) return 0.5;

  const gap = (["combat", "roleplay", "exploration"] as StyleAxis[]).reduce(
    (total, axis) => total + Math.abs(player.style![axis] - table.style![axis]),
    0,
  );

  /* Three axes, at most STYLE_MAX apart on each. */
  return 1 - gap / (3 * STYLE_MAX);
}

/**
 * Proximity, never equality.
 *
 * A mix of experience at one table is healthy and a first-timer sat with four
 * veterans is not, which is a statement about distance rather than about
 * matching like with like.
 *
 * Midpoint when unknown, for the same reason as above.
 */
function experienceFit(player: Profile, table: PartyProfile): number {
  if (!player.experience || table.experience === undefined) return 0.5;

  const gap = Math.abs(experienceRank(player.experience) - table.experience);
  return 1 - gap / (EXPERIENCE.length - 1);
}

export function fitFor(player: Profile, party: Party): Fit {
  const blockers: Blocker[] = [];
  const table = party.profile ?? EMPTY_PROFILE;

  const seatsLeft = Math.max(0, PARTY_MAX - party.playerIds.length);
  const already = party.playerIds.includes(player.uid) || party.gmId === player.uid;

  const slots = party.playerIds.length === 0
    ? slotsIn(player.week)
    : slotsIn(overlap([player.week, table.week]));

  const worksWhenTheyPlay =
    party.slot === null
      ? slots.length > 0
      : player.week[party.slot.day]?.[party.slot.block] === "1";

  const nearby = Boolean(party.area) && player.playAreas.includes(party.area);

  if (already) blockers.push({ kind: "already", detail: "You are already at this table." });
  if (party.status === "closed") blockers.push({ kind: "closed", detail: "This party is over." });
  if (seatsLeft === 0) blockers.push({ kind: "full", detail: "Six is the most a table takes." });

  /* The two hard ones. Venue is checked first only because it is the one a
     player can do something about. */
  const venue = venueClash(player.venues, table.arrangements);
  if (venue) blockers.push({ kind: "venue", detail: venue });

  const limits = limitClash(player.limits, table.limits);
  if (limits) blockers.push({ kind: "limits", detail: limits });

  /*
    The score, in the order these things actually matter.

    Hours dominate everything: a table you cannot attend is not a table, however
    close it is. Area is next, because an hour's travel on a weeknight is how a
    party quietly dies. Seats filled is a tiebreak that nudges towards
    completing a nearly-full party rather than spreading players thin.
  */
  const score =
    (worksWhenTheyPlay ? 100 : 0)
    + slots.length * 10
    + (nearby ? 40 : 0)
    + toneFit(player, table) * 20
    + experienceFit(player, table) * 10
    + (PARTY_MAX - seatsLeft) * 2;

  return { slots, worksWhenTheyPlay, nearby, seatsLeft, blockers, score };
}

/**
 * Every party this player may be shown, best first.
 *
 * "May be shown" is doing the work. A party with a blocker is not ranked last.
 * It is not in the list, and there is no flag to turn that off.
 */
export const openTo = (player: Profile, parties: Party[]) =>
  parties
    .map((party) => ({ party, fit: fitFor(player, party) }))
    .filter((one) => fits(one.fit))
    .sort((a, b) => b.fit.score - a.fit.score);

/**
 * The same question with nobody signed in.
 *
 * Nothing is known about the visitor, so nothing can be filtered on their
 * behalf — which is exactly why this returns only what is safe to show a
 * stranger: where a table meets, when, and how many seats are left. Never who
 * is at it.
 */
export const publicView = (parties: Party[]) =>
  parties
    .filter((party) => party.status !== "closed" && party.playerIds.length < PARTY_MAX)
    .sort((a, b) => b.createdAt - a.createdAt);

/** Free seats across everything open. The honest headline number. */
export const seatsOpen = (parties: Party[]) =>
  publicView(parties).reduce(
    (total, party) => total + Math.max(0, PARTY_MAX - party.playerIds.length),
    0,
  );
