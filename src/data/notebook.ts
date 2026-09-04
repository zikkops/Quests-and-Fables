import type { PlaySession, SessionNote } from "@/lib/notebook";

/**
 * Three nights of a made up campaign, for the demo on `/campaign`.
 *
 * It picks up exactly where the tavern on the homepage leaves off: Maret says
 * the mayor's daughter is in grave danger, and this is what the party wrote
 * down over the three sessions after that. Same cast, same names, so somebody
 * who scrolled past the tavern recognises who is talking.
 *
 * The game master's notes are here too, and they are the reason the demo has a
 * viewer switch: the point of the feature is that these two books have
 * different readers, and that is only visible if you can stand in both places.
 */

const DAY = 86_400_000;
/* Fixed, not `Date.now()`. A demo that says "yesterday" every day it is opened
   is a demo that quietly rewrites itself between screenshots. */
const FIRST = Date.UTC(2026, 6, 3, 20, 0);

export const DEMO_SESSIONS: PlaySession[] = [
  {
    id: "s1",
    campaignId: "demo",
    number: 1,
    title: "The mayor's daughter",
    playedOn: FIRST,
    open: false,
  },
  {
    id: "s2",
    campaignId: "demo",
    number: 2,
    title: "The road to Jbeil",
    playedOn: FIRST + 7 * DAY,
    open: false,
  },
  {
    id: "s3",
    campaignId: "demo",
    number: 3,
    title: "The Cedar Compact",
    playedOn: FIRST + 14 * DAY,
    open: true,
  },
];

let tick = 0;
const at = (session: string) => {
  const base = DEMO_SESSIONS.find((s) => s.id === session)?.playedOn ?? FIRST;
  tick += 1;
  return base + tick * 180_000;
};

const party = (
  id: string,
  sessionId: string,
  authorName: string,
  kind: SessionNote["kind"],
  body: string,
  tags: string[] = [],
): SessionNote => {
  const written = at(sessionId);
  return {
    id,
    sessionId,
    book: "party",
    authorId: authorName.toLowerCase(),
    authorName,
    body,
    kind,
    tags,
    createdAt: written,
    updatedAt: written,
  };
};

const gm = (
  id: string,
  sessionId: string,
  kind: SessionNote["kind"],
  body: string,
  tags: string[] = [],
): SessionNote => {
  const written = at(sessionId);
  return {
    id,
    sessionId,
    book: "gm",
    authorId: "maret",
    authorName: "maret",
    body,
    kind,
    tags,
    createdAt: written,
    updatedAt: written,
  };
};

export const DEMO_NOTES: SessionNote[] = [
  /* ---- session one ------------------------------------------------------ */
  party(
    "n1",
    "s1",
    "orla",
    "npc",
    "Maret the barkeep. Keeps the tavern by the crossroads and hears everything "
      + "before anyone else does. Says the mayor has been expecting adventurers, "
      + "which is a strange thing for a barkeep to know. @maret",
    ["maret"],
  ),
  party(
    "n2",
    "s1",
    "dain",
    "note",
    "The mayor's daughter went missing four nights ago. Nobody saw her leave and "
      + "the gate watch swears the gate stayed shut.",
  ),
  party(
    "n3",
    "s1",
    "kest",
    "npc",
    "The hooded one at the back table never gave a name. Wants swords for a cause "
      + "and is not particular about whose. I do not trust him and I said so.",
  ),
  party(
    "n4",
    "s1",
    "orla",
    "question",
    "If the gate stayed shut, she did not leave through it. So either she is still "
      + "inside the walls, or there is another way out that the watch does not know "
      + "about.",
  ),
  party(
    "n5",
    "s1",
    "dain",
    "loot",
    "Mayor paid twenty gold up front. Orla is carrying it. Also one signet ring, "
      + "his daughter's, which Kest is carrying.",
  ),

  /* ---- session two ------------------------------------------------------ */
  party(
    "n6",
    "s2",
    "kest",
    "place",
    "Rode to Jbeil at dawn, two days on the coast road. The old harbour quarter is "
      + "half empty and the half that is not empty does not want to talk. #jbeil",
    ["jbeil"],
  ),
  party(
    "n7",
    "s2",
    "orla",
    "note",
    "A dockhand recognised the signet ring and went white. Would not say why. Would "
      + "not take money either, which frightened me more than the ring did.",
  ),
  party(
    "n8",
    "s2",
    "dain",
    "npc",
    "Nessa from the tavern has a cousin in Jbeil who works the cedar yards. She "
      + "wrote us a letter of introduction before we left. @nessa",
    ["nessa"],
  ),
  party(
    "n9",
    "s2",
    "kest",
    "place",
    "The cedar yards run the whole north side of the harbour. Everything in Jbeil "
      + "that is worth money is cedar, and everything that is cedar goes through one "
      + "house. #jbeil",
    ["jbeil"],
  ),
  party(
    "n10",
    "s2",
    "orla",
    "question",
    "Who is the one house? Nobody will name it out loud, they just call it the "
      + "compact and change the subject.",
  ),

  /* ---- session three ---------------------------------------------------- */
  party(
    "n11",
    "s3",
    "dain",
    "note",
    "It is called the Cedar Compact. Eleven families, one price for cedar, and no "
      + "cedar leaves this coast without them. #cedar-compact",
    ["cedar-compact"],
  ),
  party(
    "n12",
    "s3",
    "kest",
    "npc",
    "The hooded one is in Jbeil. Of course he is. He called the Cedar Compact by "
      + "name before we did, which means he knew, which means he has been steering "
      + "us since the tavern. #cedar-compact",
    ["cedar-compact"],
  ),
  party(
    "n13",
    "s3",
    "orla",
    "loot",
    "One cedar coin, taken off a compact runner. Not currency. It is a token that "
      + "gets you through their gate. Dain is carrying it.",
  ),
  party(
    "n14",
    "s3",
    "dain",
    "question",
    "Why would a compact of timber families take a mayor's daughter? Unless she was "
      + "not taken, and she walked in on her own.",
  ),
  party(
    "n15",
    "s3",
    "orla",
    "note",
    "We are going through the gate tomorrow with the cedar coin and Nessa's letter. "
      + "If neither works, Kest says we go over the wall, which is not a plan, it is "
      + "a sentence.",
  ),

  /* ---- the other book --------------------------------------------------- */
  gm(
    "g1",
    "s1",
    "npc",
    "The hooded one is her brother. He is steering the party towards the compact "
      + "because he cannot walk into Jbeil himself, and he will not say so until "
      + "they have already gone in.",
  ),
  gm(
    "g2",
    "s1",
    "note",
    "The gate really did stay shut. She left through the cistern tunnel, which the "
      + "watch does not know about because the compact paid to have it left off the "
      + "survey. Kest can find it with a hard investigation check.",
  ),
  gm(
    "g3",
    "s2",
    "npc",
    "The dockhand's brother took compact money last winter and has not been seen "
      + "since. That is the fear, not the ring. If they buy him a drink he tells "
      + "them everything.",
  ),
  gm(
    "g4",
    "s3",
    "place",
    "Behind the gate: the counting house, then the yards, then the cistern. She is "
      + "in the counting house and she is not a prisoner. Let that land slowly.",
  ),
  gm(
    "g5",
    "s3",
    "question",
    "If they go over the wall instead, the runner they robbed is on that stretch. "
      + "Do not punish the plan, just make the runner recognise Dain.",
  ),
];
