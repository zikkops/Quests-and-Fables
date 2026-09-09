import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import FoundParty from "@/components/parties/FoundParty";

export const metadata: Metadata = {
  title: "Start a table",
  description:
    "Already have a group? Start your own table, invite them by link, and skip "
    + "the matching. You still get a game master.",
};

export default function NewPartyPage() {
  return (
    <AccountShell
      eyebrow="Start a table"
      title="You already found each other."
      lede={
        "Matching is for people who have nobody to play with. If you have four "
        + "friends and a free evening, you do not need it: start the table, send "
        + "them the link, and the only thing left to find is a game master."
      }
    >
      <FoundParty />
    </AccountShell>
  );
}
