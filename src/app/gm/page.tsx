import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import GmTables from "@/components/gm/GmTables";

export const metadata: Metadata = {
  title: "Your tables",
  robots: { index: false, follow: false },
};

export default function GmPage() {
  return (
    <AccountShell
      eyebrow="Game master"
      title="The tables you run."
      lede={
        "A party is handed to you once it has four to six players whose evenings "
        + "actually overlap. Everything you do with it happens at the table itself, "
        + "and this is the way in."
      }
    >
      <GmTables />
    </AccountShell>
  );
}
