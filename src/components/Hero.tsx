"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import DragonEye from "./DragonEye";
import Embers from "./Embers";
import styles from "./Hero.module.css";

/**
 * There is one way in, and it is as a player. No email capture, no feature grid.
 *
 * The hero used to fork: player or game master, two cards of equal weight, both
 * leading to a sign-up. Game masters are not signed up any more, they are
 * recruited and met in person, so a card offering them a form advertised
 * something that does not exist. What is left is the one card that is true, and
 * beside it an invitation to write to us.
 */
const ROLES = [
  {
    key: "player",
    label: "I'm a Player",
    body:
      "Say when you're free and where you can get to. We build the party of four "
      + "to six and find it a game master.",
    href: "/onboarding/player",
  },
] as const;

export default function Hero() {
  const router = useRouter();
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      // Entrance only. The eye itself no longer moves.
      gsap.from(`.${styles.copy} > *`, {
        y: 18,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
        stagger: 0.09,
      });
      gsap.from(`.${styles.eye}`, {
        opacity: 0,
        duration: 1.4,
        ease: "power2.out",
      });

    },
    { scope },
  );

  const trackCursor = (event: React.PointerEvent<HTMLButtonElement>) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    card.style.setProperty("--my", `${event.clientY - rect.top}px`);
  };

  return (
    <section className={styles.hero} ref={scope}>
      {/*
        Outside .inner on purpose. The eye is anchored to the right edge of the
        viewport, not to the content column, so it fills whatever space is going
        spare and runs off the side of the page.
      */}
      <div className={styles.eye}>
        <DragonEye />
      </div>

      <Embers />

      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            <span className={styles.pulse} aria-hidden="true" />
            Now gathering, Beirut to Jbeil
          </p>

          <h1 className={styles.title}>
            Every campaign starts
            <span className={styles.titleEmber}>with a table.</span>
          </h1>

          <p className={styles.lede}>
            Not another virtual tabletop. This is the part that happens{" "}
            <strong>before</strong> it: the players, a night that survives real
            life, and a real table you can get to.
          </p>

          <div className={styles.fork}>
            {ROLES.map((role) => (
              <button
                key={role.key}
                type="button"
                className={styles.card}
                onPointerMove={trackCursor}
                onClick={() => router.push(role.href)}
              >
                <span className={styles.cardLabel}>{role.label}</span>
                <span className={styles.cardBody}>{role.body}</span>
                <span className={styles.cardArrow} aria-hidden="true">
                  Start
                </span>
              </button>
            ))}

            {/*
              Not a second way in. Game masters are hired, so this is an
              invitation rather than a sign-up, and it is styled as one: no
              button, no arrow, a link out to the page that explains it.
            */}
            <aside className={styles.recruit}>
              <p className={styles.recruitTitle}>Are you a game master?</p>
              <p className={styles.recruitBody}>
                We do not take sign-ups. We recruit, we meet everyone, and we hand
                you a party that already fits your calendar.
              </p>
              <Link href="/join" className={styles.recruitLink}>
                Join our team
              </Link>
            </aside>
          </div>

          <p className={styles.promise}>
            The character builder is free and needs no account.{" "}
            <strong>Joining a party does</strong>, because a group has to know
            when you can play. Sessions are paid, and you settle that with your
            game master. We never touch the money.
          </p>
        </div>
      </div>

      <p className={styles.cue} aria-hidden="true">
        <span className={styles.cueLine} />
        How it works
      </p>
    </section>
  );
}
