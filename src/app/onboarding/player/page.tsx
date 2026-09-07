import type { Metadata } from "next";
import StubPage from "@/components/StubPage";

export const metadata: Metadata = {
  title: "For players",
  description:
    "Four questions, under three minutes: when you can play, where you can play, "
    + "where you will sit, and what is off the table. Every one of them is "
    + "something a party can be matched on.",
};

/**
 * The page a cold visitor lands on before they have an account.
 *
 * It exists to say what will be asked *before* a sign-up form appears, because
 * "four questions, three minutes" read first is worth more than the same words
 * read afterwards. Everything it describes is built and lives behind the
 * account, so the button goes to /sign-in, which forwards anybody already
 * signed in straight to /account.
 *
 * ⚠️ It carried a "Not built yet · Phase 2" badge until 2026-09-07, long after
 * the flow shipped, and its primary button offered the character builder: it
 * described the five questions and then gave you no way to answer any of them.
 * Keep this page honest about what the account actually asks. It promised a
 * play-style question that the profile has never collected.
 */
export default function PlayerOnboardingPage() {
  return (
    <StubPage
      eyebrow="For players"
      title="Four questions. Under three minutes."
      lede={
        "No bio, and no “tell us about yourself” box. Just the handful of "
        + "things that actually decide whether a group lasts, and every one of them "
        + "is something a party can be matched on."
      }
      stepsHeading="What we ask"
      steps={[
        {
          title: "When can you play?",
          body:
            "A weekly grid, in blocks rather than hours, because nobody schedules a "
            + "four hour session to the minute. This is the single biggest predictor "
            + "of whether a table survives, and it works almost as a hard filter: no "
            + "overlapping evening means no match, however well you would all get on.",
        },
        {
          title: "Where can you play?",
          body:
            "The areas you can actually get to on a weeknight, which is not the same "
            + "as where you live. We hold both. Other players only ever see the "
            + "areas, never your address, and plenty of good tables die because "
            + "everybody assumed the other person could reach them.",
        },
        {
          title: "Where will you sit?",
          body:
            "A game master will come to you, or the table meets somewhere public. "
            + "Whichever you leave unticked you are never offered, and you never "
            + "have to explain why. A home game happens only when the whole table "
            + "has agreed to one.",
        },
        {
          title: "What is off the table?",
          body:
            "Lines and veils: what is never in the game, and what can happen off "
            + "screen. A hard filter, never a suggestion. A party that conflicts "
            + "with a line of yours does not reach you, and nobody is told which of "
            + "you set it.",
        },
      ]}
      note={{
        title: "Why this is short",
        body:
          "Players are the abundant side of this and game masters are the scarce "
          + "one, so this is deliberately shorter than their side. Every extra "
          + "screen here costs players and buys nothing. You can change all of it "
          + "later, from your account, whenever your Thursdays change.",
      }}
      actions={[
        { href: "/sign-in", label: "Answer them now", primary: true },
        { href: "/character-builder", label: "Build a character first" },
        { href: "/parties", label: "See how parties form" },
      ]}
    />
  );
}
