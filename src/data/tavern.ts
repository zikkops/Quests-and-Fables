/**
 * The tavern scene: who is in the room, where they stand, and what they say.
 *
 * **This file is the whole scene.** `Tavern.tsx` renders it and never names a
 * character, so recasting the room, rewriting the dialogue, moving somebody two
 * inches to the left or dropping a figure entirely is a data change. Same rule
 * as the character builder (README rule 4): the component is a renderer.
 *
 * The artwork is generated (Higgsfield `nano_banana_pro`), one prompt per
 * figure, all in one style, and keyed off a green background so each one is a
 * true cut-out. The room is a separate render with nobody in it.
 * `public/assets/tavern/README.md` has the prompts and the recipe. A figure
 * whose file goes missing falls back to a labelled dashed box, exactly like the
 * dragon eye, so replacing one is overwriting a file.
 *
 * Coordinates are percentages of the stage box, never pixels, so the scene
 * holds together at any width:
 *   x      centre of the figure, % across
 *   base   the floor the figure stands on, % down (100 = bottom of the stage)
 *   w      figure width, % of stage width
 *   aspect w / h of the artwork. It has to match the file or the figure
 *          stretches, and it is what the placeholder box reserves
 *   depth  1 nearest the viewer, higher is further back and dimmer
 *
 * A figure's height on screen is `w * stage ratio / aspect`, so `w` is doing
 * perspective as well as size: the barkeep is behind her counter and wants a
 * smaller `w` than the three at the table, or the room goes flat.
 *
 * **The three at the table sit at its far edge, not behind it.** That is what
 * `PROPS` is for: the table is painted back over the cast. An earlier version
 * had them further down the frame with the tabletop crossing their waists, and
 * it read as three people cut off at the middle rather than three people
 * sitting. Their `base` now lands just at the far edge of the tabletop, so each
 * of them is whole, boots included, and only the tankards standing on the table
 * overlap them. Move the table and all three have to move with it.
 *
 * The stage is 16:9 on desktop and 3:4 on a phone, which is a different room
 * shape, so each figure carries a second set of coordinates for narrow screens.
 * Both sets ship as custom properties and the stylesheet picks one. Props are
 * desktop only: on a phone the three sit on their own benches and stools, and
 * a table across the front would bury them.
 */
export type Placement = {
  x: number;
  base: number;
  w: number;
};

export type CastMember = {
  id: string;
  /** Fictional and generic on purpose. Nothing here is a real person's character. */
  name: string;
  role: string;
  /** Two lines of who they are. The cards under the scene, nothing more. */
  blurb: string;
  art: string;
  alt: string;
  aspect: number;
  depth: number;
  /** Cut-outs are drawn facing one way. Flip rather than commission a mirror. */
  flip?: boolean;
  wide: Placement;
  narrow: Placement;
};

/** Furniture drawn over the cast. Desktop only, and never speaks. */
export type Prop = {
  id: string;
  art: string;
  aspect: number;
  /**
   * Where it sits in the stack. Figures land on even numbers, 40 minus twice
   * their depth: 38 for the front row, 36 for the middle, 34 for the barkeep.
   * An odd number puts a prop between two of them, which is the only way the
   * counter can hide the barkeep and still be walked in front of.
   */
  z: number;
  wide: Placement;
};

export type Beat = {
  /** A cast id. The renderer anchors the line to that figure. */
  speaker: string;
  line: string;
};

export const CAST: CastMember[] = [
  {
    id: "barkeep",
    name: "Maret",
    role: "Barkeep",
    blurb:
      "Bought the place with a soldier's pension and has not closed a night "
      + "since. She knows which parties came back and which did not, and she "
      + "keeps a list of who is still looking.",
    art: "/assets/tavern/barkeep.webp",
    alt: "The keeper of the house behind her counter, drying a cup, watching the room.",
    aspect: 0.387,
    depth: 3,
    wide: { x: 19, base: 78, w: 8.8 },
    narrow: { x: 16, base: 70, w: 16 },
  },
  {
    id: "server",
    name: "Nessa",
    role: "Serving maid",
    blurb:
      "Came up the coast road with a name and nothing else. She can carry six "
      + "cups without looking and read a table in one pass, and she is the "
      + "first person anyone new speaks to.",
    art: "/assets/tavern/server.webp",
    alt: "A serving maid crossing the floor with a tray of tankards on one raised hand.",
    aspect: 0.557,
    depth: 2,
    wide: { x: 28, base: 90, w: 13.2 },
    narrow: { x: 44, base: 76, w: 20 },
  },
  {
    id: "veteran",
    name: "Orla",
    role: "Adventurer, four seasons in",
    blurb:
      "Four seasons of paid work and a knee that tells her when it is going "
      + "to rain. She has buried people who went out with the wrong party, so "
      + "she takes her time about who sits down.",
    art: "/assets/tavern/veteran.webp",
    alt: "A scarred veteran in worn armour, leaning back off the bench with a tankard, mid sentence.",
    aspect: 1.017,
    depth: 1,
    wide: { x: 52, base: 81, w: 16 },
    narrow: { x: 34, base: 92, w: 36 },
  },
  {
    id: "newcomer",
    name: "Dain",
    role: "Adventurer, first game",
    blurb:
      "Walked three days on the strength of a story he heard once. A satchel, "
      + "a knife he has never drawn and no notion of what he is doing, which "
      + "is how every single one of them started.",
    art: "/assets/tavern/newcomer.webp",
    alt: "A young newcomer on a stool with a satchel, hands empty on his knees, listening.",
    aspect: 0.635,
    depth: 1,
    wide: { x: 40, base: 81, w: 11 },
    narrow: { x: 12, base: 96, w: 26 },
  },
  {
    id: "sellsword",
    name: "Kest",
    role: "Adventurer, hired blade",
    blurb:
      "Sells his sword by the job and has never asked what a job is about. He "
      + "came in alone, the way he always does, and he is not going to leave "
      + "that way.",
    art: "/assets/tavern/sellsword.webp",
    alt: "A sellsword astride a bench in studded leather, one hand on the pommel of a propped sword.",
    aspect: 0.946,
    depth: 1,
    wide: { x: 64, base: 81, w: 15 },
    narrow: { x: 72, base: 94, w: 34 },
  },
  {
    id: "stranger",
    name: "The hooded one",
    role: "A cause of his own",
    blurb:
      "Nobody sees him come in. A lantern, a list of names and a cause he "
      + "will not explain, and he is here to hire rather than to drink. He was "
      + "in the room before the news was.",
    art: "/assets/tavern/hooded-one.webp",
    alt: "A tall figure standing by the fire in a hooded cloak, an iron lantern held low, face lost in shadow.",
    aspect: 0.433,
    depth: 1,
    wide: { x: 90, base: 97, w: 11 },
    narrow: { x: 82, base: 88, w: 17 },
  },
];

/**
 * Furniture that is drawn back over the cast.
 *
 * The **table** stands near the viewer, and the three sit at the far side of
 * it. Its `base` is past the bottom of the stage on purpose: what shows is the
 * near half of a big table, which is what puts the party a table's width away
 * and lets them be whole. It and their three placements are one decision, not
 * four. Move it and they move.
 *
 * The **counter** is the same cut of the room render it stands in, put back on
 * top: identical pixels in the identical place, so its only visible edge is the
 * one along the countertop. It sits at z 35, which is above the barkeep and
 * below everyone else, so she is behind her bar and the serving maid still
 * walks in front of it.
 *
 * ⚠️ Both are measured against `room.webp` and the stage carries that image's
 * aspect ratio so the mapping is one to one. Cut the counter from the **graded**
 * `room.webp`, never from the raw render: the room is darkened on the way in and
 * a counter cut from the original sits on the page as a bright patch. Replace
 * the room and the counter has to be re-cut from the new one.
 */
export const PROPS: Prop[] = [
  {
    id: "bar",
    art: "/assets/tavern/bar.webp",
    aspect: 1.175,
    z: 35,
    wide: { x: 23.11, base: 100, w: 31.64 },
  },
  {
    id: "table",
    art: "/assets/tavern/table.webp",
    aspect: 1.827,
    z: 39,
    wide: { x: 61, base: 120, w: 52 },
  },
];

/**
 * The scene: an order at the bar that turns into a job.
 *
 * The serving maid asks what they want, and each of them answers with what they
 * came for rather than what they want to drink. Ale, bounties, glory, swords for
 * hire. Then the house puts a quest on the table, because that is the moment a
 * tavern scene exists for.
 *
 * Six beats and six speakers, one line each, which is also what makes hovering
 * work: point at anyone and you get their own answer, not somebody else's.
 *
 * Two things to hold on to when rewriting it. Every line is somebody speaking,
 * so nothing here narrates the room. And nobody rolls: real dice on a real
 * table, the same rule the tracker keeps.
 *
 * Keep it short. Every line is read out loud in a bubble the width of a hand,
 * and the whole loop wants to be under a minute.
 */
export const SCRIPT: Beat[] = [
  { speaker: "server", line: "Hello, dear travellers. What can I get you?" },
  { speaker: "veteran", line: "Ale. The big cup, and keep it coming." },
  { speaker: "sellsword", line: "Bounties. Whatever is posted, whatever pays." },
  { speaker: "newcomer", line: "Glory. I did not walk three days for soup." },
  { speaker: "stranger", line: "Mercenaries. I have a cause that is short of swords, and I am not particular." },
  { speaker: "barkeep", line: "Then you are all in luck. The mayor has been expecting brave adventurers, and his daughter is in grave danger." },
];
