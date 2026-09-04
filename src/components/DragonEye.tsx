"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import styles from "./DragonEye.module.css";

const POSTER = "/assets/dragon-eye.jpg";
const LOOP = "/assets/dragon-eye-loop.mp4";

/*
  The dragon blinks and glances by playing a video, not by animating the still.

  The clip came out of Kling 3.0 from the photograph as its start frame. Kling
  drifted the framing slightly despite being told to lock the camera off, so its
  last frame does not match its first and a plain loop would visibly jump. The
  file shipped here is therefore a palindrome: the clip forwards, then the same
  clip backwards. The join is the same frame twice, so the loop cannot show a
  seam, and reversed blinks and glances still read as blinks and glances.

  It is 674KB for ten seconds, down from a 4.9MB source, because the mask and
  the screen blend hide a great deal of compression. The original is kept out of
  public/ at .assets-src/ so it is never shipped.

  Under prefers-reduced-motion the video is not rendered at all and the still
  photograph is used instead. That is also the poster frame, so the first paint
  is identical either way and nothing pops when the video arrives.
*/

export default function DragonEye() {
  const media = useRef<HTMLImageElement>(null);
  const [missing, setMissing] = useState(false);
  const reduced = usePrefersReducedMotion();

  /*
    onError alone is not enough for the still. The server sends real markup, so
    the browser starts fetching and can fail long before React hydrates and
    attaches that handler, leaving the browser's own broken-image icon.
  */
  useEffect(() => {
    const el = media.current;
    if (el?.complete && el.naturalWidth === 0) setMissing(true);
  }, []);

  if (missing) {
    return (
      <div className={styles.frame}>
        <div className={styles.placeholder}>
          <p className={styles.placeholderTitle}>Dragon eye missing</p>
          <p className={styles.placeholderBody}>
            Save the photo to <code>web/public/assets/dragon-eye.jpg</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.frame}>
      <div className={styles.stage}>
        {reduced ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={media}
            className={styles.photo}
            src={POSTER}
            alt="The eye of a dragon. Amber iris, vertical slit pupil, dark scales."
            onError={() => setMissing(true)}
            draggable={false}
          />
        ) : (
          <video
            className={styles.photo}
            poster={POSTER}
            src={LOOP}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="The eye of a dragon, blinking and looking around. Amber iris, vertical slit pupil, dark scales."
          />
        )}

        <span className={styles.vignette} aria-hidden="true" />
      </div>
    </div>
  );
}
