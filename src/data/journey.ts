/**
 * The journey: what happens to you, in order, from having nobody to play with
 * to sitting at a table.
 *
 * **The spine is what everyone does. Branches are what is there if you want
 * it.** That split is the whole point of the shape. A four-box row of numbered
 * steps says every feature is a stage you must pass through, which is a lie:
 * the character builder needs no account and no party, bringing your own five
 * friends skips the matching entirely, and the notebook only matters once you
 * are playing. Those hang off the line at the moment they become relevant, and
 * the line goes past them either way.
 *
 * `Tavern.tsx` gets its cast from data for the same reason this does: rewriting
 * the journey, adding a stop or hanging a new feature off one is an edit here
 * and nothing else. The component measures whatever it is given and draws a
 * line through it.
 */
export type Branch = {
  /** Short label above the title. Says why this is off to one side. */
  kicker: string;
  title: string;
  body: string;
  href: string;
  label: string;
};

export type Stop = {
  key: string;
  num: string;
  title: string;
  body: string;
  href: string;
  label: string;
  branches?: Branch[];
};

export const START = "You, with nobody to play with";
export const END = "Thursday, after dark, around a real table";

export const STOPS: Stop[] = [
  {
    key: "when",
    num: "One",
    title: "Say when you are free",
    body:
      "Not prose. Mark the hours you can actually play, the areas you can get to, "
      + "and what is off the table. Hard limits are a filter, never a suggestion.",
    href: "/onboarding/player",
    label: "Set your availability",
    branches: [
      {
        kicker: "No account needed",
        title: "Build a character first",
        body:
          "The full 5e SRD builder, free, with every option explained in plain "
          + "language. Or a blank sheet you fill in yourself for homebrew. You do "
          + "not need a party, or an account, or us.",
        href: "/character-builder",
        label: "Open the builder",
      },
    ],
  },
  {
    key: "party",
    num: "Two",
    title: "A party forms around you",
    body:
      "Four to six players, never more, put together from people whose evenings "
      + "and areas genuinely overlap. Under four it cannot be given a game master. "
      + "At six it closes.",
    href: "/parties",
    label: "See how parties form",
    branches: [
      {
        kicker: "Or skip this stop",
        title: "Bring your own group",
        body:
          "Already have five friends? Sign up together and skip the matching "
          + "entirely. You still get a game master, which is usually the part you "
          + "were missing.",
        href: "/parties",
        label: "Bring a group",
      },
    ],
  },
  {
    key: "gm",
    num: "Three",
    title: "The house finds your game master",
    body:
      "You do not write an advert and hope. When your party is full enough, it is "
      + "offered to a game master whose calendar and area already fit it. We have "
      + "met every one of them.",
    href: "/safety",
    label: "How we vet them",
    branches: [
      {
        kicker: "Coming the other way",
        title: "Are you a game master?",
        body:
          "This is the only door on that side. We do not take sign-ups: we "
          + "recruit, we meet everyone, and we hand you a party that already fits "
          + "your calendar.",
        href: "/join",
        label: "Join our team",
      },
    ],
  },
  {
    key: "book",
    num: "Four",
    title: "The night gets booked",
    body:
      "Your party proposes and confirms a session together instead of losing three "
      + "days to a group chat. The venue rides along with the booking and the "
      + "reminders go out on their own.",
    href: "/parties",
    label: "See a party's first night",
  },
  {
    key: "play",
    num: "Five",
    title: "You play, and the table stays live",
    body:
      "Damage, healing, rests, spell slots and conditions on one shared sheet that "
      + "everybody is looking at. Modifiers are shown. Dice stay on the table, "
      + "where they belong.",
    href: "/campaign",
    label: "See the live table",
    branches: [
      {
        kicker: "While you play",
        title: "Your game master sees every sheet",
        body:
          "All four to six of them on one dashboard: hit points, conditions, spell "
          + "slots, passive scores. Damage or a condition can be applied to anyone "
          + "at the table without asking them to read a number out.",
        href: "/campaign",
        label: "See the dashboard",
      },
      {
        kicker: "Between sessions",
        title: "One notebook for the table",
        body:
          "Recaps, NPCs, quest leads and who is carrying the loot, in a notebook "
          + "the whole party shares. The game master keeps a private one too, for "
          + "the things you are not supposed to know yet.",
        href: "/campaign",
        label: "See the notebook",
      },
    ],
  },
];
