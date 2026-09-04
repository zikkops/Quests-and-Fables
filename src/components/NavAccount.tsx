"use client";

import Link from "next/link";
import { useSession } from "@/lib/firebase/session";
import styles from "./Nav.module.css";

/**
 * The one part of the nav that has to know who is looking.
 *
 * Kept apart so `Nav` stays a server component: this is a single link, and
 * making the whole bar client-side to change one word would be a poor trade.
 *
 * Until the session has answered it says "Sign in", which is also what the
 * server rendered, so the first paint matches and nothing shifts. A signed-in
 * player sees their own name, which doubles as proof of who they are signed in
 * as without a menu to open.
 */
export default function NavAccount() {
  const { user, profile, loading } = useSession();

  if (loading || !user) {
    return (
      <Link href="/sign-in" className={styles.signIn}>
        Sign in
      </Link>
    );
  }

  return (
    <Link href={profile ? "/account" : "/account/setup"} className={styles.signIn}>
      {profile ? profile.username : "Finish setting up"}
    </Link>
  );
}
