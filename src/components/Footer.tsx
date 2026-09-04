import Link from "next/link";
import styles from "./Footer.module.css";

/**
 * The footer, which on this site has two jobs and they do not sit well
 * together: it is the last word on what the product is, and it is where a
 * licence obligation has to be discharged.
 *
 * So it is in two halves with a rule between them. Above it, the brand, what
 * this is in one line, and the links grouped by what somebody is actually
 * trying to do. Below it, the attribution and the disclaimer, quieter but not
 * hidden, because hiding them is the one thing that is not allowed.
 */
const COLUMNS = [
  {
    title: "Play",
    links: [
      { href: "/parties", label: "Find a party" },
      { href: "/character-builder", label: "Character builder" },
      { href: "/campaign", label: "Campaign tracker" },
      { href: "/account", label: "Set your availability" },
    ],
  },
  {
    title: "The house",
    links: [
      { href: "/safety", label: "Safety" },
      { href: "/join", label: "Run games with us" },
      { href: "/sign-in", label: "Sign in" },
      { href: "/licence", label: "Licence and credits" },
    ],
  },
] as const;

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <p className={styles.wordmark}>
              QUESTS<span className={styles.amp}>&amp;</span>FABLES
            </p>

            <p className={styles.blurb}>
              Find a party of four to six, get a game master, and play in person
              on the Lebanese coast. The character builder is free and never
              needs an account.
            </p>

            {/* The same line the hero opens with. It is the one fact that dates,
                so it appears twice on purpose: both have to change together. */}
            <p className={styles.status}>
              <span className={styles.pulse} aria-hidden="true" />
              Now gathering, Beirut to Jbeil
            </p>
          </div>

          <nav className={styles.columns} aria-label="Footer">
            {COLUMNS.map((column) => (
              <div key={column.title} className={styles.column}>
                <p className={styles.columnTitle}>{column.title}</p>
                {column.links.map((link) => (
                  <Link key={link.href} href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.legal}>
          {/*
            The short form of the SRD attribution, which the licence allows.

            CC BY 4.0 § 3(a)(2): "You may satisfy the conditions in Section
            3(a)(1) in any reasonable manner based on the medium, means, and
            context in which You Share the Licensed Material. For example, it
            may be reasonable to satisfy the conditions by providing a URI or
            hyperlink to a resource that includes the required information."

            `/licence` is that resource and carries the notice verbatim. So this
            line may be short, but it may not be absent, and **the link is the
            part doing the legal work**. If the link ever breaks or the page ever
            loses the verbatim notice, this footer stops discharging the
            obligation and the full text has to come back here.
          */}
          <p className={styles.credit}>
            Built on the System Reference Document 5.2.1 by Wizards of the Coast,
            used under CC BY 4.0. Not affiliated with, endorsed by, or sponsored
            by Wizards of the Coast.{" "}
            <Link href="/licence" className={styles.creditLink}>
              Licence and credits
            </Link>
          </p>

          <p className={styles.fine}>
            Sessions are settled between players and their game master. We never
            handle the money.
          </p>
        </div>
      </div>
    </footer>
  );
}
