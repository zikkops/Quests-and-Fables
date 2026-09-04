import type { Metadata } from "next";
import StubPage from "@/components/StubPage";

/**
 * Game masters do not sign up here. They are hired.
 *
 * This route replaced `/onboarding/gm`, which was a self-serve stub: post a
 * table, collect applicants, pick the ones you like. That was never how v1
 * works. `Scope v1.md` has the platform *assigning* a game master to a party
 * once it is full enough, which only holds if we know every game master, and
 * README rule "we know every game master personally" is a safety promise as
 * much as a staffing one. A public sign-up form would quietly break both.
 *
 * So the whole game master path is one invitation and one inbox.
 *
 * ⚠️ `gm@questsandfables.com` does not exist yet. The domain is still on the
 * blocked-on-Mark list in the README, and until it is bought and the mailbox
 * is made, this page is asking people to write into the void. Buy the domain
 * or change the address before this ships.
 */
export const metadata: Metadata = {
  title: "Run games with us",
  description:
    "We do not take game master sign-ups. We recruit game masters, meet every one "
    + "of them, and hand them a party that already fits their schedule. Sessions "
    + "are paid, and you settle with your table directly.",
};

export default function JoinPage() {
  return (
    <StubPage
      eyebrow="Are you a game master?"
      tone="ember"
      /* No phase badge. Every other stub says "not built yet" because a form is
         coming; this page is not waiting on anything, it is the whole thing. */
      title="We do not take sign-ups. We recruit."
      lede={
        "There is no form here and no queue to join. We meet every game master who runs "
        + "for us, because a party is handed to you rather than advertised at, and because "
        + "the people at that table are meeting a stranger in a real room."
      }
      stepsHeading="How it goes"
      steps={[
        {
          title: "Write to us",
          body:
            "One email. What you run, how long you have been running it, the nights you "
            + "are free, and the parts of the coast you can reach. Nothing formal and no "
            + "cover letter.",
        },
        {
          title: "We meet, and you run one",
          body:
            "A conversation first, then a single session with a real party. We sit in on "
            + "it. That session is paid the same as any other.",
        },
        {
          title: "You get handed a party",
          body:
            "No advert, no applicants to sift. When a party of four to six is full and its "
            + "calendar and its area overlap yours, it is offered to you. You take it or "
            + "you pass, and passing costs you nothing.",
        },
        {
          title: "You are paid by the table",
          body:
            "Players settle with you directly, in cash or over Whish. We never touch the "
            + "money, so there is nothing to take a cut of and nothing to chase.",
        },
      ]}
      note={{
        title: "Why it works this way",
        body:
          "Game masters are the scarce side of this hobby, roughly one for every six "
          + "players, so they are worth doing properly rather than at volume. Everything "
          + "we promise players rests on it: that a party gets a game master at all, and "
          + "that the person who turns up has been met by someone.",
      }}
      actions={[
        { href: "mailto:gm@questsandfables.com", label: "Email us", primary: true },
        { href: "/parties", label: "See how parties form" },
        { href: "/safety", label: "How we keep tables safe" },
      ]}
    />
  );
}
