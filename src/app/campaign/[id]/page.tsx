import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import Campaign from "@/components/campaign/Campaign";

export const metadata: Metadata = {
  title: "Your campaign",
  /* A party's table is nobody else's business, including a crawler's. */
  robots: { index: false, follow: false },
};

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AccountShell
      eyebrow="At the table"
      title="Your table, between sessions and during them."
      lede={
        "The sheets everybody brought, live for the whole table, and the notebook "
        + "the party keeps. Both are only visible to the people at this table, and "
        + "that is enforced by the database rather than by this page."
      }
    >
      <Campaign partyId={id} />
    </AccountShell>
  );
}
