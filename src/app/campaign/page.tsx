import type { Metadata } from "next";
import StubPage from "@/components/StubPage";
import Tracker from "@/components/Tracker";
import NotebookDemo from "@/components/notebook/NotebookDemo";

/**
 * The campaign tracker, with the working thing at the top of it.
 *
 * The tracker below is real: it is the same component the homepage runs, four
 * made up characters and every rule the live one will keep. What is not built
 * is everything that makes it *shared* — accounts, a party to belong to, and an
 * event log that six people can write to at once. So the page shows what it can
 * and is plain about the rest, which is the whole point of a stub here.
 *
 * ⚠️ Keep the badge until the shared version exists. Somebody who plays with
 * this for a minute will assume they are looking at a finished product unless
 * the page says otherwise, and the page saying otherwise costs nothing.
 */
export const metadata: Metadata = {
  title: "Campaign tracker",
  description:
    "Hit points, conditions, spell slots and rests on one shared sheet the whole "
    + "table can see. The game master applies damage or a condition to anyone at "
    + "the table. Modifiers are shown and dice are never rolled.",
};

export default function CampaignPage() {
  return (
    <StubPage
      eyebrow="At the table"
      phase="Phase 3"
      title="The campaign is the part that keeps you playing."
      lede={
        "Once your party has a game master it has a campaign: a live sheet the whole "
        + "table is looking at. The one below works. Take a character apart, spend their "
        + "slots, drop a condition on somebody and call a rest for everyone. What is not "
        + "built yet is the part that makes it shared."
      }
      stepsHeading="What the live one adds"
      steps={[
        {
          title: "Six people writing at once",
          body:
            "The demo above is yours alone. The real one is a party of four to six plus a "
            + "game master, all editing the same sheets in the same evening, which is a "
            + "different problem and the reason this waits for a database rather than a "
            + "clever component.",
        },
        {
          title: "Every change has an author",
          body:
            "Damage, healing, conditions, rests and spent resources are events with a name "
            + "and a time on them, never an overwritten number. Current state is a fold "
            + "over that log, which is why undo can be free and why a wrong number is one "
            + "tap to fix instead of an argument.",
        },
        {
          title: "The game master's dashboard",
          body:
            "All four to six sheets on one screen, exactly as above, with damage and "
            + "conditions applicable to anyone at the table. No asking six people to read "
            + "their hit points out, and no player waiting to be told what they already "
            + "know.",
        },
        {
          title: "The notebook, shared",
          body:
            "The one below works and is yours alone. The real one is the same notebook "
            + "with five other people writing into it as the night happens, kept between "
            + "sessions, and searchable across every session you have ever played.",
        },
        {
          title: "It picks up where you left off",
          body:
            "Hit points, slots and conditions are still where they were at the end of last "
            + "session, because nobody remembers by Thursday. The session before is on the "
            + "sheet rather than in somebody's memory.",
        },
        {
          title: "Any character, from either builder",
          body:
            "An SRD character and a hand typed custom one resolve to the same sheet, so "
            + "the tracker cannot tell them apart and never asks what class anybody is. "
            + "Bring homebrew and it behaves exactly like everything else here.",
        },
      ]}
      note={{
        title: "It is still not a virtual tabletop",
        body:
          "No maps, no tokens, no fog of war, and nothing on this page rolls anything. "
          + "The sheet shows you the modifier and you roll your own dice, at your own "
          + "table, with your own hands. That is the part worth protecting.",
      }}
      actions={[
        { href: "/parties", label: "Find a party", primary: true },
        { href: "/character-builder", label: "Build a character" },
        { href: "/join", label: "Run games with us" },
      ]}
    >
      <>
        <Tracker />
        <NotebookDemo />
      </>
    </StubPage>
  );
}
