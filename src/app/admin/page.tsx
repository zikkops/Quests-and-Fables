import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import AdminConsole from "@/components/admin/AdminConsole";

export const metadata: Metadata = {
  title: "Console",
  /* Never in a search result, and never followed. */
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <AccountShell
      eyebrow="Console"
      title="Who is waiting, and who they can play with."
      lede={
        "Every player who has finished setting up, the hours they are free, and the "
        + "one question worth asking about any four of them: is there an evening they "
        + "all share. Form the party, hand it a game master, get everyone into a chat."
      }
    >
      <AdminConsole />
    </AccountShell>
  );
}
