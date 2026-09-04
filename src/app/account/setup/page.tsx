import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import Setup from "@/components/account/Setup";

export const metadata: Metadata = {
  title: "Set up your account",
  robots: { index: false, follow: false },
};

export default function SetupPage() {
  return (
    <AccountShell
      eyebrow="Almost there"
      title="Pick a name. The rest can change."
      lede={
        "Your username is how a game master will know you, and it is the one thing "
        + "here that is permanent. Everything else on this form can be edited from "
        + "your account whenever you like."
      }
    >
      <Setup />
    </AccountShell>
  );
}
