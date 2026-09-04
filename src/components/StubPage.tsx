import type { ReactNode } from "react";
import Link from "next/link";
import Nav from "./Nav";
import Footer from "./Footer";
import styles from "./StubPage.module.css";

export type StubStep = { title: string; body: string };
export type StubAction = { href: string; label: string; primary?: boolean };

type Props = {
  eyebrow: string;
  /** e.g. "Phase 2". Honest about when this actually gets built. */
  phase?: string;
  title: string;
  lede: string;
  stepsHeading?: string;
  steps?: StubStep[];
  note?: { title: string; body: string };
  actions?: StubAction[];
  /**
   * Gold is the default and means "here is how this works". Ember is for the
   * pages that are about people rather than features: safety, and the game
   * master invitation. It is the same pair the homepage banners use.
   */
  tone?: "gold" | "ember";
  /**
   * Anything the page wants to show rather than describe, dropped in above the
   * steps. `/campaign` puts the working tracker here. A page with something
   * real to demonstrate should lead with it and explain underneath.
   */
  children?: ReactNode;
};

/**
 * The shell every inner page is built on.
 *
 * A stub here means the route renders and honestly explains what it will do, so
 * nav links never 404 and the plan stays legible to anyone who opens the site.
 * That honesty is the point, and it is why the "not built yet" badge is loud
 * rather than tucked away.
 *
 * The shape is deliberately the homepage's shape, one level down: a banded
 * opening with a coloured edge, cards in a grid rather than a column, a dashed
 * aside for the thing that is beside the argument, and the same two buttons.
 * Somebody arriving here from the homepage should not feel they have walked
 * into a different website, which is exactly how it felt when this was a
 * single column of bordered boxes.
 */
export default function StubPage({
  eyebrow,
  phase,
  title,
  lede,
  stepsHeading = "What this will do",
  steps = [],
  note,
  actions = [],
  tone = "gold",
  children,
}: Props) {
  return (
    <>
      <Nav />

      <main className={tone === "ember" ? `${styles.page} ${styles.ember}` : styles.page}>
        {/* Full bleed, so the page opens on something rather than starting
            straight into text at the top of a column. */}
        <header className={styles.band}>
          <div className={styles.bandInner}>
            <div className={styles.eyebrowRow}>
              <p className={styles.eyebrow}>{eyebrow}</p>
              {phase ? (
                <span className={styles.badge}>Not built yet · {phase}</span>
              ) : null}
            </div>

            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lede}>{lede}</p>
          </div>
        </header>

        <div className={styles.body}>
          {children ? <div className={styles.show}>{children}</div> : null}

          {steps.length > 0 ? (
            <section className={styles.stepsBlock}>
              <h2 className={styles.stepsHeading}>{stepsHeading}</h2>

              <div className={styles.steps}>
                {steps.map((step) => (
                  <article key={step.title} className={styles.step}>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepBody}>{step.body}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {note || actions.length > 0 ? (
            <div className={styles.close}>
              {note ? (
                <aside className={styles.note}>
                  <p className={styles.noteTitle}>{note.title}</p>
                  <p className={styles.noteBody}>{note.body}</p>
                </aside>
              ) : null}

              {actions.length > 0 ? (
                <div className={styles.actions}>
                  {actions.map((action) => {
                    const className = action.primary ? styles.primary : styles.secondary;

                    /* mailto: and tel: are not routes. Link would try to treat
                       them as one, and there is nothing to prefetch. */
                    return action.href.includes(":") ? (
                      <a key={action.href} href={action.href} className={className}>
                        {action.label}
                      </a>
                    ) : (
                      <Link key={action.href} href={action.href} className={className}>
                        {action.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </>
  );
}
