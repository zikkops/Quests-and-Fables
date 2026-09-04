import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import OneTable from "@/components/parties/OneTable";

export const metadata: Metadata = {
  title: "A table",
  description:
    "Where a party meets, when, and what it has agreed it will not play through. "
    + "Ask for a seat.",
};

/**
 * `params` is a promise in this version of Next, so the page is async.
 *
 * Everything below the shell is client-side, because what a visitor may see of
 * a table depends on who they are and that is not knowable at build time.
 */
export default async function PartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AccountShell
      eyebrow="A table"
      title="Four to six people, one evening a week."
      lede={
        "Where they meet, when, and what they have agreed between them. Who is at "
        + "the table is not shown, and neither is anything belonging to one of them: "
        + "what you need in order to decide is what the evening will be like."
      }
    >
      <OneTable partyId={id} />
    </AccountShell>
  );
}
