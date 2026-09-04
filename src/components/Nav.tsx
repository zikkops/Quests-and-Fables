import Link from "next/link";
import NavAccount from "./NavAccount";
import styles from "./Nav.module.css";

export default function Nav() {
  return (
    <nav className={styles.nav} aria-label="Primary">
      <Link href="/" className={styles.wordmark}>
        QUESTS<span className={styles.amp}>&amp;</span>FABLES
      </Link>

      <div className={styles.links}>
        <a href="#how-it-works" className={styles.link}>
          How it works
        </a>
        <Link href="/character-builder" className={styles.link}>
          Character builder
        </Link>
        <Link href="/parties" className={styles.link}>
          Find a party
        </Link>
        <NavAccount />
      </div>
    </nav>
  );
}
