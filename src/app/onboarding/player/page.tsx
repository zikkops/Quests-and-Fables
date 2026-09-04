import type { Metadata } from "next";
import StubPage from "@/components/StubPage";

export const metadata: Metadata = {
  title: "For players",
  description:
    "Five questions, under three minutes: when you can play, where you can play, "
    + "how you like to play, what's off the table, and your character.",
};

export default function PlayerOnboardingPage() {
  return (
    <StubPage
      eyebrow="For players"
      phase="Phase 2"
      title="Five questions. Under three minutes."
      lede={
        "No bio, no “tell us about yourself” box. Just the handful of things that "
        + "actually predict whether a group lasts, and every one of them is something a "
        + "table can match you on."
      }
      stepsHeading="The flow"
      steps={[
        {
          title: "When can you play?",
          body:
            "A weekly grid in your own timezone. This is the single biggest predictor of "
            + "whether a table survives, and it works almost as a hard filter: no overlapping "
            + "slot means the match is worthless however well you'd get on.",
        },
        {
          title: "Where can you play?",
          body:
            "Online, in person, or both. If you'll travel, the places you're happy to get to "
            + "and how far is reasonable on a weeknight. Plenty of good tables die because "
            + "everyone assumed the other person could reach them.",
        },
        {
          title: "What kind of game?",
          body:
            "How much you want combat, roleplay and exploration. Someone who wants three "
            + "hours of tavern conversation and someone who wants a dungeon crawl can both "
            + "be happy, just not at the same table.",
        },
        {
          title: "What's off the table?",
          body:
            "Lines and veils: the things you don't want in a game, and the things you'll "
            + "allow if they happen off screen. A hard filter, never a suggestion. A table "
            + "that conflicts with your limits never reaches you.",
        },
        {
          title: "Build a character",
          body:
            "Optional, and the fastest way to get accepted. The builder is free and needs no "
            + "account, though joining a table does.",
        },
      ]}
      note={{
        title: "Why this is short",
        body:
          "Players are the abundant side of this marketplace and game masters are the scarce "
          + "one, so this flow is deliberately shorter than theirs. Every extra screen here "
          + "costs players and buys nothing.",
      }}
      actions={[
        { href: "/character-builder", label: "Build a character", primary: true },
        { href: "/parties", label: "Browse parties" },
      ]}
    />
  );
}
