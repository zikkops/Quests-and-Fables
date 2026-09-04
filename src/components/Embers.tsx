"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./Embers.module.css";

const COUNT = 26;

export default function Embers() {
  const layer = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.utils.toArray<HTMLElement>(`.${styles.spark}`).forEach((spark, index) => {
        /*
          Every spark runs its own recursive loop rather than one shared
          repeating timeline. A repeating timeline replays identical motion, and
          two dozen embers moving in lockstep reads as a screensaver. Fresh
          random values on each rise is what makes it look like air.
        */
        const rise = () => {
          const size = gsap.utils.random(2, 7);
          const drift = gsap.utils.random(-70, 70);
          const duration = gsap.utils.random(7, 17);

          gsap.set(spark, {
            width: size,
            height: size,
            x: 0,
            left: gsap.utils.random(0, 100) + "%",
            top: "100%",
            y: gsap.utils.random(0, 120),
            opacity: 0,
            scale: 1,
          });

          const tl = gsap.timeline({ onComplete: rise });

          // The rise itself is linear. Embers do not ease; they are carried.
          tl.to(spark, {
            y: `-=${gsap.utils.random(340, 720)}`,
            x: drift,
            duration,
            ease: "none",
          }, 0);

          // Fade in, hold, burn out before the top.
          tl.to(spark, { opacity: gsap.utils.random(0.45, 1), duration: 1.6 }, 0)
            .to(spark, { opacity: 0, duration: duration * 0.34 }, duration * 0.66);

          // Flicker, so they pulse like something burning rather than a dot
          // with an opacity ramp.
          tl.to(spark, {
            scale: gsap.utils.random(0.62, 1.35),
            duration: gsap.utils.random(0.5, 1.3),
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          }, 0);

          tl.delay(index === 0 ? 0 : gsap.utils.random(0, 9));
          return tl;
        };

        rise();
      });
    },
    { scope: layer },
  );

  return (
    <div className={styles.layer} ref={layer} aria-hidden="true">
      {Array.from({ length: COUNT }, (_, index) => (
        <span key={index} className={styles.spark} />
      ))}
    </div>
  );
}
