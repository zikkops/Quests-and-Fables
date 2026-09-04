import type { ReactNode } from "react";
import Nav from "../Nav";
import Footer from "../Footer";
import styles from "./AccountShell.module.css";

type Props = {
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
};

/**
 * The frame around sign-in, setup and the account itself.
 *
 * Deliberately the same banded opening `StubPage` uses, minus the "not built
 * yet" badge — these three pages are the first inner pages that actually do
 * something, and the badge would be a lie. Everything below the band is left to
 * the page, because a form, a claim and a dashboard want different widths.
 */
export default function AccountShell({ eyebrow, title, lede, children }: Props) {
  return (
    <>
      <Nav />

      <main className={styles.page}>
        <header className={styles.band}>
          <div className={styles.bandInner}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lede}>{lede}</p>
          </div>
        </header>

        <div className={styles.body}>{children}</div>
      </main>

      <Footer />
    </>
  );
}
