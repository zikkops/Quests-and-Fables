/**
 * What a player is, in the database.
 *
 * This file is the single description of the shape. `firestore.rules` enforces
 * it and the forms fill it in, and if the three ever disagree, this one is
 * right and the other two are bugs.
 *
 * Three rules of the house are baked in here rather than left to the UI:
 *
 * **The username is permanent.** It is claimed once, in a transaction against
 * `usernames/{lower}`, and the rules refuse to let it change afterwards. A
 * mutable username means either a broken uniqueness guarantee or a rename queue,
 * and neither is worth it for a product where people meet in person.
 *
 * **Phone and area are private.** They are on the profile, the profile is
 * readable by its owner alone, and matching will read them server side. README
 * rule 8: match on the point, render the area, and never hand one player
 * another's location. There is no "public profile" document yet on purpose,
 * because the moment there is, somebody has to decide what goes in it.
 *
 * **Five characters, and the count lives on the profile.** Firestore rules
 * cannot count a collection, so the count is a field and `getAfter()` checks it
 * moves in step with the write that changes it. See `firestore.rules`.
 */

/** Areas come from `src/data/lebanon.ts`. Stored as the slug, never the name. */
export type AreaSlug = string;

export const CHARACTER_LIMIT = 5;

/**
 * A week of evenings, as seven strings of four characters.
 *
 * Index 0 is Monday. Each character is one block of the evening, and the blocks
 * are the only times a table actually meets:
 *
 *   0  afternoon   14:00 to 17:00
 *   1  early       17:00 to 20:00
 *   2  prime       20:00 to 23:00
 *   3  late        23:00 onwards
 *
 * "1" is free, "0" is not. A fixed shape rather than a list of ranges, because
 * matching compares availability constantly and comparing seven short strings is
 * something a database can do without thinking. Anyone who needs 19:45 to 22:15
 * is describing a preference, not a constraint.
 */
export type Week = [string, string, string, string, string, string, string];

export const BLOCKS = [
  { key: "afternoon", label: "Afternoon", short: "Aft", hours: "14:00 to 17:00" },
  { key: "early", label: "Early evening", short: "Early", hours: "17:00 to 20:00" },
  { key: "prime", label: "Evening", short: "Eve", hours: "20:00 to 23:00" },
  { key: "late", label: "Late", short: "Late", hours: "23:00 onwards" },
] as const;

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const EMPTY_WEEK: Week = ["0000", "0000", "0000", "0000", "0000", "0000", "0000"];


/* ==========================================================================
   How somebody likes to play

   Preference data, not safety data, and the difference decides how it is used:
   these are **weights and never filters**. Venue and limits keep somebody out
   of a table; wanting more combat than the table does is a reason to be ranked
   below a better fit, never a reason not to be shown it. A mixed table is a
   normal table.

   Both are optional. Profiles written before these existed have neither, and a
   player who skips the question is not guessing: an absent answer contributes
   nothing to the score rather than being treated as a middling one.
   ========================================================================== */

export const STYLE_AXES = [
  {
    key: "combat",
    label: "Combat",
    hint: "Fights, tactics, and the dice that decide them.",
  },
  {
    key: "roleplay",
    label: "Roleplay",
    hint: "Talking in character, and the hour in the tavern.",
  },
  {
    key: "exploration",
    label: "Exploration",
    hint: "Maps, mysteries, and poking at things.",
  },
] as const;

export type StyleAxis = (typeof STYLE_AXES)[number]["key"];

/** Nought to four on each, independently. Not a budget to divide up. */
export type PlayStyle = Record<StyleAxis, number>;

export const STYLE_STEPS = ["Not for me", "A little", "Some", "A lot", "As much as possible"];

export const STYLE_MAX = STYLE_STEPS.length - 1;

export const EXPERIENCE = [
  { key: "never", label: "Never played", hint: "And that is a fine way to start." },
  { key: "some", label: "A few sessions" },
  { key: "regular", label: "I play regularly" },
  { key: "veteran", label: "Years of it" },
] as const;

export type ExperienceKey = (typeof EXPERIENCE)[number]["key"];

export const experienceRank = (key: ExperienceKey) =>
  EXPERIENCE.findIndex((one) => one.key === key);

/* --------------------------------------------------------------------------
   What the table is spoken in

   A hard filter, and the only one on this list that is: you cannot play at a
   table run in a language you do not speak, however well everything else fits.

   Lebanon is the reason the list looks like this. English is the default of the
   hobby and the language the SRD is in, but a table in Beirut is as likely to
   run in Arabic or French, and Armenian is a real community here. The vault
   notes that Arabic-language play is almost entirely unserved, which is an
   opportunity rather than an afterthought.

   ⚠️ Optional, and **an absent answer never blocks anybody**. A hard filter
   reading missing data as a clash would empty the site: every profile written
   before this existed has no languages, and if that meant "shares none" then
   nobody would match anybody. Silence means "not stated", which is not the same
   as "speaks nothing".
   -------------------------------------------------------------------------- */

export const LANGUAGES = [
  { key: "en", label: "English" },
  { key: "ar", label: "Arabic" },
  { key: "fr", label: "French" },
  { key: "hy", label: "Armenian" },
] as const;

export type LanguageKey = (typeof LANGUAGES)[number]["key"];

export const languageLabel = (key: string) =>
  LANGUAGES.find((one) => one.key === key)?.label ?? key;

/* ==========================================================================
   Where somebody will play, and what they will not play through

   Both are safety data before they are preference data, which is why they live
   on the profile next to the phone number rather than in a settings page
   somewhere. `/safety` promises two things about them: venue type is a hard
   filter and never a preference to be talked around, and a party that conflicts
   with your limits is never shown to you at all. Neither promise can be kept by
   a UI. They are kept in `src/lib/match.ts`, and they are the reason it exists.
   ========================================================================== */

export const VENUES = [
  {
    key: "public",
    label: "Somewhere public",
    hint: "A game shop, a café, a library, a campus room.",
  },
  {
    key: "guest",
    label: "Someone else's home",
    hint: "You are willing to be a guest at a table in somebody's house.",
  },
  {
    key: "host",
    label: "Your own home",
    hint: "You are willing to have the table at yours. Never assumed, never asked twice.",
  },
] as const;

export type VenueKey = (typeof VENUES)[number]["key"];

export type Venues = Record<VenueKey, boolean>;

/** Public only. The safest answer, and the one somebody who skips this gets. */
export const DEFAULT_VENUES: Venues = { public: true, guest: false, host: false };

/**
 * Lines and veils, in the language the hobby already uses.
 *
 * A **line** is a thing that does not happen at this table. A **veil** is a
 * thing that can happen off-screen: the scene cuts away and the story carries
 * on. Anything unmarked is fine.
 *
 * The list is deliberately short and deliberately blunt. A hundred checkboxes
 * gets skipped, and a skipped safety tool is worse than none because it looks
 * like it was answered.
 */
export const LIMIT_TOPICS = [
  { key: "graphic-violence", label: "Graphic violence and gore" },
  { key: "sexual-content", label: "Sexual content" },
  { key: "harm-to-children", label: "Harm to children" },
  { key: "animal-harm", label: "Harm to animals" },
  { key: "self-harm", label: "Self harm and suicide" },
  { key: "substance-abuse", label: "Addiction and substance abuse" },
  { key: "torture", label: "Torture and captivity" },
  { key: "bigotry", label: "Real-world bigotry as a plot" },
  { key: "spiders", label: "Spiders and insects" },
  { key: "body-horror", label: "Body horror" },
] as const;

export type LimitKey = (typeof LIMIT_TOPICS)[number]["key"];

/** Absent means fine. Only the ones somebody marked are stored. */
export type Limits = Partial<Record<LimitKey, "veil" | "line">>;

export const limitLabel = (key: LimitKey) =>
  LIMIT_TOPICS.find((topic) => topic.key === key)?.label ?? key;

/* ==========================================================================
   Verifying the address

   A password signup leaves the email unproven: anybody can type anybody's
   address. For a product that puts strangers in a room together, an unreachable
   or borrowed address is not a small problem, so the account is on a clock.

   Seven days of full use, then it is held: the account still exists, still
   signs in, still shows what it holds, and can do nothing else until the
   address is confirmed. Held rather than deleted, because somebody who lost the
   email in a spam folder should not lose their characters over it.

   `emailVerified` comes from Firebase Auth and is not a field anybody here can
   write. The clock is measured against the profile's own `createdAt`, and
   `firestore.rules` enforces the same arithmetic — the screens below only
   decide what to say about it.
   ========================================================================== */

export const GRACE_DAYS = 7;
export const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

export type Standing =
  | { state: "verified" }
  /** Unverified, still inside the seven days. `daysLeft` is 7 down to 1. */
  | { state: "grace"; daysLeft: number }
  /** Unverified past the deadline. Everything is read only until confirmed. */
  | { state: "held" };

export function standing(
  emailVerified: boolean,
  createdAt: number,
  now = Date.now(),
): Standing {
  if (emailVerified) return { state: "verified" };

  const left = createdAt + GRACE_MS - now;
  if (left <= 0) return { state: "held" };

  return { state: "grace", daysLeft: Math.max(1, Math.ceil(left / 86_400_000)) };
}

export type Profile = {
  /** Firebase Auth uid. Also the document id, so a profile cannot be orphaned. */
  uid: string;

  /** Claimed once, never changed. Lowercased copy lives in `usernames/`. */
  username: string;

  /** Kept in step with Auth, and the only field here that is not private. */
  email: string;

  /** Private. For a game master to reach you once a session is booked. */
  phone: string;

  /**
   * Date of birth, as milliseconds since the epoch.
   *
   * A number rather than a string so `firestore.rules` can do the arithmetic
   * itself: the thirteen year floor for holding an account at all is enforced
   * there, not merely in the form.
   *
   * ⚠️ The **in-person** age policy is a separate and still undecided question,
   * and nothing filters on this yet. See `/safety`. It is collected now because
   * asking every existing player for it later is a far worse job than asking
   * once at the door.
   */
  dob: number;

  /** Private. Where you are, which is not the same as where you will play. */
  area: AreaSlug;

  /** Public in the sense that a party can be matched on it. Areas, not points. */
  playAreas: AreaSlug[];

  /** When you can actually play. The whole reason this product exists. */
  week: Week;

  /**
   * Which kinds of room you will sit in. A hard filter in matching, never a
   * preference: nobody is offered a home game they did not ask for.
   */
  venues: Venues;

  /**
   * What you will not play through. A party whose game master has not agreed to
   * your lines is not shown to you, which is the only version of this that
   * works — asking somebody to raise it at the table is asking the person with
   * the least power in the room to do the hardest thing in it.
   */
  limits: Limits;

  /**
   * How they like to play, and how much they have played. Both optional: a
   * profile from before these existed has neither, and skipping the question is
   * a real answer rather than a middling one. Weights in matching, never
   * filters. See `src/lib/match.ts`.
   */
  style?: PlayStyle;
  experience?: ExperienceKey;

  /**
   * What they can play in. Unlike the two above this is a **hard filter**, and
   * unlike every other field on this profile an empty answer means "not stated"
   * rather than "none": see the warning by LANGUAGES.
   */
  languages?: LanguageKey[];

  /** Denormalised so the rules can enforce the limit. Never edit it by hand. */
  characterCount: number;

  /**
   * A recruited game master. Set by an admin and by nobody else, which the
   * rules enforce: game masters are met in person, and self-promotion is not a
   * route into other people's evenings. Absent on almost every profile.
   */
  gm?: boolean;

  createdAt: number;
  updatedAt: number;
};

/** A saved character. `doc` is a CharacterDoc or CustomCharacter from lib. */
export type SavedCharacter = {
  id: string;
  ownerId: string;
  name: string;
  /** "srd" for a built character, "custom" for a blank sheet filled in by hand. */
  kind: "srd" | "custom";
  /** The character itself, exactly as the builder already stores it locally. */
  doc: unknown;
  createdAt: number;
  updatedAt: number;
};

/** Collection paths, in one place so a typo cannot become two collections. */
export const PATHS = {
  profiles: "profiles",
  usernames: "usernames",
  characters: (uid: string) => `profiles/${uid}/characters`,
} as const;

/* ==========================================================================
   Validation, shared by the forms and worth keeping honest

   The rules file repeats these constraints, because a rule that trusts the
   client is not a rule. Change one and change the other.
   ========================================================================== */

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function usernameProblem(value: string): string | null {
  const name = value.trim();
  if (name.length < 3) return "Three characters or more.";
  if (name.length > 20) return "Twenty characters or fewer.";
  if (!USERNAME_PATTERN.test(name)) {
    return "Lowercase letters, numbers and underscores only.";
  }
  return null;
}

/**
 * Lebanese numbers, written the way people actually write them: +961 followed
 * by seven or eight digits, with spaces and dashes forgiven. Anything longer is
 * accepted as an international number rather than rejected, because a player
 * visiting from abroad is a real case and a wrong rejection is worse than a
 * wrong-looking number in a field only its owner and their game master see.
 */
export function phoneProblem(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.length < 7) return "That looks too short to be a number.";
  if (digits.length > 16) return "That looks too long to be a number.";
  return null;
}

export const normalisePhone = (value: string) => value.replace(/[^\d+]/g, "");

/** Thirteen, which is the floor for having an account, not for playing. */
export const MIN_AGE = 13;

export const yearsSince = (dob: number, now = Date.now()) => {
  const then = new Date(dob);
  const today = new Date(now);

  let years = today.getUTCFullYear() - then.getUTCFullYear();
  const monthsShort = today.getUTCMonth() - then.getUTCMonth();
  if (monthsShort < 0 || (monthsShort === 0 && today.getUTCDate() < then.getUTCDate())) {
    years -= 1;
  }

  return years;
};

/**
 * Whether a date of birth can be accepted, in words.
 *
 * Refuses the future and the absurd as well as the underage: a mistyped year is
 * far more common than a genuine edge case, and 1890 should be caught at the
 * keyboard rather than stored.
 */
export function dobProblem(value: string): string | null {
  if (!value) return "We need your date of birth.";

  const when = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(when)) return "That is not a date.";

  const age = yearsSince(when);
  if (age < 0) return "That date has not happened yet.";
  if (age > 120) return "Check the year.";
  if (age < MIN_AGE) return `You have to be ${MIN_AGE} or older to have an account here.`;

  return null;
}

/** "1998-04-12" to milliseconds, for storing. */
export const dobToMillis = (value: string) => Date.parse(`${value}T00:00:00Z`);

/** Milliseconds back to "1998-04-12", for filling the field in again. */
export const dobToInput = (value: number) =>
  new Date(value).toISOString().slice(0, 10);
