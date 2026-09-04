import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import SignIn from "@/components/account/SignIn";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in, or register in one form. Building a character never needs an "
    + "account. Joining a table does, because a table needs to know when and where "
    + "you can play.",
};

export default function SignInPage() {
  return (
    <AccountShell
      eyebrow="Sign in"
      title="An account is for joining, not for looking."
      lede={
        "Browse every open table and build as many characters as you like without "
        + "one. You need an account to join a table, because joining means putting "
        + "your weekly availability and the places you can play on file, and that "
        + "has to belong to someone."
      }
    >
      <SignIn />
    </AccountShell>
  );
}
