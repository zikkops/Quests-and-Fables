import type { Metadata } from "next";
import StubPage from "@/components/StubPage";

/**
 * The safety rules, and the page the homepage banner points at.
 *
 * ⚠️ House calls (2026-08-19) removed the public-venues-only rule, which had
 * been carrying most of the safety weight by itself. Three things replace it,
 * and none is optional: **the game master is known and verified in person**,
 * **venue type is a hard filter in matching** so nobody is offered a home game
 * they did not ask for, and **the whole table consents** before a home booking
 * is possible. Weaken any one and the other two stop holding.
 *
 * ⚠️ "We know every game master personally" is true at launch, because the first
 * game masters are Mark's own. **It stops being true the first time someone is
 * taken on who he has not played with.** That sentence has to come off this page
 * and off the homepage banner on the same day, and the structural checks above
 * have to be doing the work by then. A trust claim that quietly expires is worse
 * than never having made it. (This warning moved here from the homepage trust
 * section, which is now a banner; the claim is made in both places.)
 *
 * The "who runs this" copy names Quests & Fables and nothing else. That is a
 * decision (2026-08-19), not an omission: the shop behind it is a separate
 * business with its own brand, and this product is meant to stand on its own
 * rather than read as a side project of it. Do not add the shop's name without
 * asking Mark first.
 */
export const metadata: Metadata = {
  title: "Safety",
  description:
    "Sessions in public venues, verified game masters, hard limits enforced as a "
    + "filter, and your exact location never shown to anyone. The rules the product "
    + "enforces when strangers meet in person.",
};

export default function SafetyPage() {
  return (
    <StubPage
      eyebrow="Safety"
      tone="ember"
      phase="Phase 4"
      title="Strangers, in a room, sometimes your own."
      lede={
        "That is the honest description of what this product arranges, right down to "
        + "a game master who will come to your home if you ask for one. It is why "
        + "safety is built alongside matching rather than added afterwards. Nothing "
        + "here is a "
        + "promise about intentions. These are rules the product enforces."
      }
      steps={[
        {
          title: "House calls, or somewhere public: your choice",
          body:
            "A game master will come to you on demand, or the table can meet at a "
            + "game shop, café, library or campus. Nobody is ever placed in a home "
            + "game they did not ask for: the venues you are willing to play in are "
            + "a hard filter in matching, not a preference to be talked around.",
        },
        {
          title: "A home game needs the whole table's yes",
          body:
            "Not just the host's. Every player and the game master confirm the "
            + "venue before a session at a home can be booked, and any one of you "
            + "can say no without giving a reason. Say no and the table moves "
            + "somewhere public, and it does not cost you your seat.",
        },
        {
          title: "We know every game master personally",
          body:
            "Right now, every single one is someone we have played with and would "
            + "put our own name behind. Not a signup form, not a badge on a profile. "
            + "It is also why we are opening one stretch of coast at a time: we would "
            + "rather grow at the speed we can vouch for people than faster.",
        },
        {
          title: "And when we no longer know them all",
          body:
            "That will happen, and we would rather say now what changes than have "
            + "you find out later. A real name and a phone number on file, a "
            + "conversation face to face before a first party, and the line above "
            + "comes off this page the day it stops being true.",
        },
        {
          title: "Your address is yours until you share it",
          body:
            "Matching only ever uses your area, never your street. A full address "
            + "appears once a session is booked, only to the people at that table, "
            + "and never on a profile. You choose how far you are willing to travel, "
            + "and whether you are willing to host at all.",
        },
        {
          title: "Hard limits are a filter",
          body:
            "What you will not play through is not something to negotiate at the "
            + "table. Lines and veils are collected before you are matched, and a "
            + "party that conflicts with yours is never shown to you at all.",
        },
        {
          title: "Report, block, and remove",
          body:
            "Report or block anyone from their profile. A game master can remove "
            + "someone from their party immediately, without explaining themselves "
            + "first. Reports go to a real person.",
        },
        {
          title: "Session Zero, before you play",
          body:
            "A short checklist the party fills in together: tone, expectations, "
            + "hard limits, house rules, what happens when someone cannot make it. "
            + "The groups that do this survive; most skip it because nobody "
            + "remembers to.",
        },
      ]}
      note={{
        title: "Still being decided",
        body:
          "The minimum age for in-person games is not settled, and house calls make "
          + "it the sharpest question we have: adults only, or under-18s allowed with "
          + "a parent's consent on file and a parent at home. It will be answered "
          + "before anyone is matched, and it will be written here plainly.",
      }}
      actions={[
        { href: "/parties", label: "Find a party", primary: true },
        { href: "/join", label: "Run games with us" },
      ]}
    />
  );
}
