import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import AccountHome from "@/components/account/AccountHome";

export const metadata: Metadata = {
  title: "Your account",
  description:
    "Your details, the areas you can play in, the hours you are free, and the "
    + "characters you have saved.",
  /* Nothing here belongs in a search result. */
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <AccountShell
      eyebrow="Your account"
      title="Everything a table needs to know about you."
      lede={
        "Your username, where you can play and when you are free. Your phone number "
        + "and the area you live in are never shown to another player. We can see them, "
        + "because somebody has to put the parties together."
      }
    >
      <AccountHome />
    </AccountShell>
  );
}
