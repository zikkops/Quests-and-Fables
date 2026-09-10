import type { PlaySession } from "./notebook";

/**
 * Who actually turned up.
 *
 * The product exists because parties fall apart, and they fall apart by
 * attrition rather than by argument: one person misses a Thursday, then
 * another, and by session six there is no table. Attendance is the only thing
 * that sees that happening while it can still be fixed.
 *
 * **Three states, not two.** Somebody who told the table on Tuesday that they
 * could not make Thursday has done the right thing, and recording that as a
 * miss punishes exactly the behaviour worth encouraging. `excused` is not
 * politeness, it is the difference between a person who is drifting away and a
 * person who had a week.
 *
 * **Who sees what is a deliberate split.** The table sees each night, because
 * they were there and it is not news to them. Only an admin sees the pattern
 * across sessions, because they are the one who would move somebody to another
 * table or have a word. There is no reliability figure on a profile: that is a
 * scarlet letter, and it would teach people to go quiet rather than to say they
 * cannot make it.
 *
 * **It never feeds matching on its own.** A filter that silently drops somebody
 * out of the pool is a filter they can never learn about or argue with. That is
 * the argument for making a block invisible, pointed the other way — the person
 * it costs is the one who has no idea it happened. A human decides, with this
 * in front of them.
 */

export type Attended = "came" | "missed" | "excused";

export const ATTENDANCE = [
  { key: "came", label: "Came", hint: "Was at the table" },
  { key: "excused", label: "Told us", hint: "Said in advance they could not make it" },
  { key: "missed", label: "No show", hint: "Did not turn up and did not say" },
] as const;

/** Absent from the map means nobody marked it, which is not the same as absent. */
export type Attendance = Record<string, Attended>;

export type WithAttendance = PlaySession & { attendance?: Attendance };

export const markOf = (session: WithAttendance, uid: string): Attended | "unmarked" =>
  session.attendance?.[uid] ?? "unmarked";

export type Record_ = {
  came: number;
  excused: number;
  missed: number;
  /** Sessions where this player was marked at all. The denominator. */
  of: number;
};

/**
 * One player's record across whatever sessions are handed in.
 *
 * Unmarked sessions are left out of the denominator rather than counted as
 * anything. A game master who forgot to fill it in has not told us the player
 * was absent, and a number that treats forgetting as evidence is a number that
 * gets somebody moved off a table for their game master's paperwork.
 */
export function attendanceOf(sessions: WithAttendance[], uid: string): Record_ {
  const tally: Record_ = { came: 0, excused: 0, missed: 0, of: 0 };

  for (const session of sessions) {
    const mark = markOf(session, uid);
    if (mark === "unmarked") continue;

    tally[mark] += 1;
    tally.of += 1;
  }

  return tally;
}

/** Newest first, which is the order any question about "lately" wants. */
export const byPlayed = (a: WithAttendance, b: WithAttendance) => b.playedOn - a.playedOn;

/**
 * Whether somebody looks like they are drifting away.
 *
 * Deliberately blunt and deliberately narrow: **two or more no-shows in the
 * last four sessions they were marked for**. Excused absences never count, no
 * matter how many, because somebody with a hard month who keeps telling the
 * table is doing the thing we want.
 *
 * This is a prompt for a person, never a verdict and never an automatic
 * anything. It is the sentence "have a word with them", written as a boolean.
 */
export const SLIPPING_WINDOW = 4;
export const SLIPPING_MISSES = 2;

export function slipping(sessions: WithAttendance[], uid: string): boolean {
  const marked = [...sessions]
    .sort(byPlayed)
    .filter((session) => markOf(session, uid) !== "unmarked")
    .slice(0, SLIPPING_WINDOW);

  const missed = marked.filter((session) => markOf(session, uid) === "missed").length;
  return missed >= SLIPPING_MISSES;
}

/**
 * How the last night went, for a game master looking at their own table.
 *
 * Returns null when nothing was marked, so the interface can say "not filled
 * in" rather than "everybody missed it".
 */
export function lastNight(
  sessions: WithAttendance[],
  playerIds: string[],
): { came: number; excused: number; missed: number; unmarked: number } | null {
  const [latest] = [...sessions].sort(byPlayed);
  if (!latest || !latest.attendance) return null;

  const counts = { came: 0, excused: 0, missed: 0, unmarked: 0 };
  for (const uid of playerIds) {
    const mark = markOf(latest, uid);
    if (mark === "unmarked") counts.unmarked += 1;
    else counts[mark] += 1;
  }

  return counts;
}

/** Whether a map only names people who are actually at this table. */
export const marksOnlyMembers = (attendance: Attendance, playerIds: string[]) =>
  Object.keys(attendance).every((uid) => playerIds.includes(uid));
