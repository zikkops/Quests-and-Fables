/**
 * What a table says about the game master who ran it.
 *
 * **This is public, and that was a decision rather than a default.** The
 * argument against is real and worth writing down where the next person will
 * find it: nobody browsing this site picks their own game master, the house
 * assigns them, so a public score buys a player nothing they can act on. What
 * it does buy is a number attached to a named person in a small city, built out
 * of a handful of evenings. Mark chose public with that stated. What follows is
 * the shape that makes it survivable.
 *
 * **Four questions, no star score.** A single number invites a scoreboard and
 * collects nothing you can act on. Four plain questions aggregate into
 * sentences a person can answer: nine of eleven would play with them again.
 *
 * **No public free text.** Written notes about a named person, readable by
 * anybody, is the part that turns a rating into a pile-on. There is no comment
 * field here at all. Anything that needs saying in words is a report, which
 * already exists and goes to a person rather than to the internet.
 *
 * **Nothing shows until `ENOUGH` ratings.** Below that the answer is "not
 * enough yet", not a percentage. Two disappointed players out of three is 33%
 * on a page and is also just a Tuesday that went badly.
 *
 * **One rating per player per game master, and it stands.** Enforced in
 * `firestore.rules` rather than here, because a rule in a component is a
 * suggestion. Ratings that can be edited are ratings that can be traded.
 */

export type Axis = {
  key: AxisKey;
  /** What the player is asked, in the second person. */
  ask: string;
  /**
   * How the answer reads back on a public page, after the count.
   * "3/4" plus "would play with them again". The count is rendered in its own
   * column, so this must not contain one.
   */
  says: string;
};

export type AxisKey = "prepared" | "fair" | "safe" | "again";

export const AXES: Axis[] = [
  {
    key: "prepared",
    ask: "Did they turn up ready to run it?",
    says: "turned up ready to run it",
  },
  {
    key: "fair",
    ask: "Did they run it fairly?",
    says: "said they ran it fairly",
  },
  {
    key: "safe",
    ask: "Did they hold the table to what it agreed?",
    says: "said they held the table to what it agreed",
  },
  {
    key: "again",
    ask: "Would you play with them again?",
    says: "would play with them again",
  },
];

/**
 * How many ratings before any of it is shown.
 *
 * Three, because two is one person's bad evening and a percentage. It is not a
 * statistical claim, it is a floor under how much one night can say about
 * somebody in public.
 */
export const ENOUGH = 3;

/** One player's answers. Private: it is stored under the person who gave it. */
export type Rating = {
  prepared: boolean;
  fair: boolean;
  safe: boolean;
  again: boolean;
  /** The table it came from, which is what makes it a rating and not an opinion. */
  partyId: string;
  at: number;
};

/**
 * The public tally. Each axis holds how many said yes, out of `count`.
 *
 * Counters rather than a list, because a list of who said what is a list of who
 * said what. At four players a table can work out an individual answer from a
 * changing average anyway, which is the honest limit of this and the reason
 * `ENOUGH` exists.
 */
export type Standing = {
  count: number;
  prepared: number;
  fair: number;
  safe: number;
  again: number;
  updatedAt: number;
};

export const NO_STANDING: Standing = {
  count: 0,
  prepared: 0,
  fair: 0,
  safe: 0,
  again: 0,
  updatedAt: 0,
};

export const enoughToShow = (standing: Standing): boolean => standing.count >= ENOUGH;

/** The tally after one more rating lands. The only shape a client may write. */
export const withRating = (standing: Standing, rating: Rating): Standing => ({
  count: standing.count + 1,
  prepared: standing.prepared + (rating.prepared ? 1 : 0),
  fair: standing.fair + (rating.fair ? 1 : 0),
  safe: standing.safe + (rating.safe ? 1 : 0),
  again: standing.again + (rating.again ? 1 : 0),
  updatedAt: Date.now(),
});
