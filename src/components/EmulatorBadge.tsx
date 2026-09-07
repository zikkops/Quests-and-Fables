"use client";

import { onEmulator } from "@/lib/firebase/client";
import styles from "./EmulatorBadge.module.css";

/**
 * Says, permanently and unmissably, that this browser is talking to throwaway
 * local emulators rather than the real database.
 *
 * Without it the two are indistinguishable: the same site, the same sign-up
 * form, the same account page. The failure mode is somebody carefully setting
 * up their availability, closing the terminal, and finding it gone; or worse,
 * doing something destructive believing it is safe when it is not. A label is
 * cheap insurance against both directions of that mistake.
 *
 * Renders nothing at all in normal use, so it costs a boolean in production.
 */
export default function EmulatorBadge() {
  if (!onEmulator()) return null;

  return (
    <div className={styles.badge} role="status">
      <span className={styles.dot} aria-hidden="true" />
      Local emulator. Nothing here is real, and it is gone when you stop the
      server.
    </div>
  );
}
