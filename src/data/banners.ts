/**
 * The two banners that sit between the homepage sections.
 *
 * Both of these used to be full sections at the bottom of the page, which is
 * the worst place for either of them: a free character builder and a safety
 * stance are things somebody needs to run into on the way past, not things they
 * scroll to the end to find. As banners they interrupt, which is the job, and
 * each one sits next to the section it argues with. Safety goes under the map,
 * where the reader has just been told they will meet strangers somewhere real.
 * The builder goes under the journey, where it has just been mentioned as the
 * thing you can do before you have a party.
 *
 * **Everything cut from those sections lives on the page each banner links to.**
 * Check that before trimming a line here. `/safety` carries all four promises
 * that the trust section used to list, in more detail, plus what happens when we
 * can no longer say we know every game master personally.
 */
export type Banner = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  href: string;
  label: string;
  /** Gold for what you can go and do, ember for what we owe you. */
  tone: "gold" | "ember";
};

export const SAFETY: Banner = {
  id: "trust",
  kicker: "Safe by design",
  title: "You are meeting people in a real room.",
  body:
    "Quests & Fables is run by people who already run D&D nights at a game shop "
    + "in Lebanon. We have met every game master personally, where you are "
    + "willing to play is a hard filter rather than a preference, and a game in "
    + "somebody's home happens only when the whole table has agreed to one.",
  href: "/safety",
  label: "Read the safety rules",
  tone: "ember",
};

export const CHARACTER: Banner = {
  id: "characters",
  kicker: "Any character",
  title: "Build one free, with us or without us.",
  body:
    "The full 5e SRD builder, no account and no paywall, with every option "
    + "explained in plain language. Or a blank sheet you fill in yourself, for "
    + "homebrew and for the books on your own shelf. Either one sits at the "
    + "table exactly the same way.",
  href: "/character-builder",
  label: "Open the builder",
  tone: "gold",
};
