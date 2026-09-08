import { BLOCKS, DAYS, EMPTY_WEEK, type Week } from "./firebase/schema";
import type { PartyProfile } from "./match";

/**
 * A party: four to six players, one game master, and the hours they can all
 * actually be in the same room.
 *
 * README rule 7 in code — under four it cannot be assigned a game master, at
 * six it is closed, and the game master is never counted as one of them. The
 * rules file enforces the same numbers, because a party of nine assembled by a
 * mistyped admin click is a worse problem than it sounds.
 *
 * The party *is* the campaign. One document, one lifecycle: it forms, it gets a
 * game master, it plays. Sessions and the notebook hang underneath it, which is
 * why `src/lib/firebase/notebook.ts` writes to `parties/{id}/sessions`.
 */

export const PARTY_MIN = 4;
export const PARTY_MAX = 6;

export type PartyStatus =
  /** Being assembled. Fewer than four, or four plus and no game master yet. */
  | "forming"
  /** Four to six players and a game master. Not yet played. */
  | "assigned"
  /** Has played at least once. */
  | "playing"
  /** Over, by agreement or attrition. */
  | "closed";

export type Party = {
  id: string;
  /** What the table calls itself. Named by whoever forms it, editable later. */
  name: string;
  status: PartyStatus;
  /** Where they meet. An area slug, never an address. */
  area: string;
  /** Player uids. The game master is deliberately not in here. */
  playerIds: string[];
  /** Set when a game master is assigned. Null while forming. */
  gmId: string | null;
  /**
   * The block they settled on, as a day index and a block index. Null until
   * somebody picks one out of the overlap.
   */
  slot: { day: number; block: number } | null;
  /**
   * What this table looks like from outside it: the hours its members share,
   * the rooms they can all use, and the strictest limit anybody has drawn.
   *
   * Denormalised on purpose, and it is a privacy measure rather than a
   * performance one. A player browsing open tables cannot read another
   * player's profile and must not be able to, so matching reads this summary
   * instead. Nobody learns which of the four is the one who will not go to a
   * stranger's house. Recomputed by whoever changes the membership, which
   * today means the admin console.
   *
   * Optional because a party written before this existed will not have it, and
   * an absent aggregate matches nobody rather than matching everybody.
   */
  profile?: PartyProfile;

  createdAt: number;
  updatedAt: number;
};

export const partyReady = (party: Pick<Party, "playerIds">) =>
  party.playerIds.length >= PARTY_MIN && party.playerIds.length <= PARTY_MAX;

export const partyFull = (party: Pick<Party, "playerIds">) =>
  party.playerIds.length >= PARTY_MAX;

/* ==========================================================================
   When can this lot actually play

   The whole reason the admin console is worth opening. Four players who each
   have plenty of free time and no hour in common are not a party, and the only
   way to know is to intersect their weeks.
   ========================================================================== */

/**
 * The blocks every one of these weeks has free.
 *
 * An empty list of weeks returns an empty week rather than a full one. "Nobody
 * has said they are busy" is not the same as "everybody is free", and treating
 * the first as the second would put a party on a Tuesday nobody agreed to.
 */
export function overlap(weeks: Week[]): Week {
  if (weeks.length === 0) return [...EMPTY_WEEK] as Week;

  return DAYS.map((_, day) =>
    BLOCKS.map((_block, block) =>
      weeks.every((week) => week[day]?.[block] === "1") ? "1" : "0",
    ).join(""),
  ) as Week;
}

/** How many blocks a week has free. The number the console sorts on. */
export const freeBlocks = (week: Week) => week.join("").split("1").length - 1;

export type Slot = { day: number; block: number };

/** Every block in a week that is free, in the order a table would read them. */
export function slotsIn(week: Week): Slot[] {
  const found: Slot[] = [];

  week.forEach((day, dayIndex) => {
    [...day].forEach((mark, blockIndex) => {
      if (mark === "1") found.push({ day: dayIndex, block: blockIndex });
    });
  });

  return found;
}

/** "Thursday evening, 20:00 to 23:00". Written once, used everywhere. */
export function describeSlot(slot: Slot): string {
  const day = DAYS[slot.day];
  const block = BLOCKS[slot.block];
  if (!day || !block) return "Unknown";
  return `${day} ${block.label.toLowerCase()}, ${block.hours}`;
}

/* ==========================================================================
   Getting six people into one chat
   ========================================================================== */

/**
 * Phone numbers, one per line, ready to paste into WhatsApp's new-group screen.
 *
 * This is the honest version of "one button that makes the group". It cannot be
 * done in one step by anybody, so the button does the half that can be
 * automated and leaves the half that cannot.
 */
export const numbersForPaste = (phones: string[]) =>
  [...new Set(phones.map((phone) => phone.trim()).filter(Boolean))].join("\n");

/** A direct chat with one player. This part WhatsApp does support. */
export const chatLink = (phone: string) =>
  `https://wa.me/${phone.replace(/[^\d]/g, "")}`;

/**
 * The group chat, kept apart from the party it belongs to.
 *
 * `parties/{id}/secrets/chat`. The party document is readable by any signed-in
 * player so open tables can be browsed; an invite link is a key, and anybody
 * holding one can walk into the chat. Rules cannot hide a single field of a
 * document, so the field lives in a document of its own that only members can
 * read.
 *
 * The link is pasted rather than generated because **WhatsApp cannot create a
 * group from a link or an API.** `wa.me/<number>` opens one chat,
 * `chat.whatsapp.com/<code>` joins a group that already exists, and the
 * Business Cloud API does not make consumer groups. The group is made by hand
 * once; this is what hands it to every player afterwards, including anyone
 * added later.
 */
export type PartyChat = { invite: string | null; updatedAt: number };

/** Whether a pasted string is plausibly a WhatsApp group invite. */
export const invitePattern = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{6,}$/;

/* ==========================================================================
   Session Zero

   The conversation every table is told to have and most skip, written down so
   it survives the evening it happened on.

   The prompts are data, so the checklist is a content change rather than a
   component change, and every answer is the table's own words rather than a
   dropdown. A tick box would collect nothing worth reading back in month four.
   ========================================================================== */

export type Prompt = {
  key: string;
  title: string;
  /** The question, asked plainly enough to answer out loud. */
  ask: string;
  /** Why it is worth agreeing now rather than discovering later. */
  hint: string;
};

export const SESSION_ZERO: Prompt[] = [
  {
    key: "tone",
    title: "Tone",
    ask: "What kind of evening is this?",
    hint:
      "Grim, funny, heroic, frightening. Everybody turns up assuming their own "
      + "answer, and nobody finds out they disagreed until somebody cracks a "
      + "joke in the wrong scene.",
  },
  {
    key: "expectations",
    title: "What everybody came for",
    ask: "How much fighting, how much talking, how much working it out?",
    hint:
      "Two people wanting different games is the most common reason a table "
      + "quietly stops meeting. It is also the easiest to say out loud.",
  },
  {
    key: "limits",
    title: "Hard limits",
    ask: "What does not happen at this table?",
    hint:
      "Your own lines and veils are already on your account and stay private. "
      + "This is the table's version, agreed together and in its own words.",
  },
  {
    key: "houseRules",
    title: "House rules",
    ask: "What are you doing differently from the book?",
    hint:
      "Critical hits, death saves, how long a rest takes. Write down the ones "
      + "you argued about, because you will argue about them again.",
  },
  {
    key: "absence",
    title: "When somebody cannot make it",
    ask: "Do you play on without them, or move the night?",
    hint:
      "Agree this now, while nobody has cancelled and nobody is annoyed. It is "
      + "the single rule that decides whether a campaign reaches session ten.",
  },
];

export type SessionZero = {
  /** Prompt key to what the table agreed. */
  answers: Record<string, string>;
  /** Uid to when that person last said this is what we agreed. */
  signed: Record<string, number>;
  /** When an answer last changed. Signatures older than this are stale. */
  changedAt: number;
  updatedAt: number;
};

export const EMPTY_SESSION_ZERO: SessionZero = {
  answers: {},
  signed: {},
  changedAt: 0,
  updatedAt: 0,
};

/**
 * Whether somebody has agreed to what the document currently says.
 *
 * Signing is dated rather than a boolean on purpose. Six people agree, one of
 * them edits the limits a fortnight later, and a boolean would leave five
 * signatures standing under a sentence nobody else has read. Comparing against
 * `changedAt` makes that visible instead of quietly wrong.
 */
export const hasAgreed = (zero: SessionZero, uid: string): boolean =>
  zero.changedAt > 0 && (zero.signed[uid] ?? 0) >= zero.changedAt;

/** How many of the table have agreed to what it says now. */
export const agreedCount = (zero: SessionZero, playerIds: string[]): number =>
  playerIds.filter((uid) => hasAgreed(zero, uid)).length;

/** Nothing filled in at all, which is the state worth prompting about. */
export const sessionZeroEmpty = (zero: SessionZero): boolean =>
  SESSION_ZERO.every((prompt) => !(zero.answers[prompt.key] ?? "").trim());
