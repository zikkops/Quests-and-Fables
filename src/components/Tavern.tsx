"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CAST, PROPS, SCRIPT, type CastMember, type Placement } from "@/data/tavern";
import styles from "./Tavern.module.css";

/**
 * The fable half of the brand, said out loud: a room full of strangers who
 * leave as a party.
 *
 * The scene is three layers: the painted room, the cast standing in it, and the
 * furniture painted back over them, which is how three of them can sit *at* the
 * table rather than behind it. All of it, cast and coordinates and dialogue,
 * lives in `src/data/tavern.ts`. Nothing in this file names a character, so
 * recasting the room is a data edit. A figure whose artwork is missing renders
 * as a labelled dashed box instead.
 *
 * Three things it has to keep doing:
 *
 * 1. **The dialogue exists as text.** The stage is aria-hidden and the bubbles
 *    in it are decoration, so the whole scene is also written out in an
 *    offscreen list further down. Take that list away and the section is a
 *    picture with nothing in it for anyone who cannot see it.
 * 2. **Nothing moves on its own.** The scene rests on the serving maid asking
 *    what they want, and only a pointer changes it. There is no timer, so
 *    README rule 5 costs nothing here: there is no motion to reduce.
 * 3. **One line each.** Hovering shows the line belonging to whoever is under
 *    the pointer, so the cast and the script stay one to one.
 */

/** Optional. The room is drawn in CSS underneath and works without it. */
const ROOM = "/assets/tavern/room.webp";

/** Stage width over height. The scene is a different room shape on a phone. */
/* The stage carries the room render's own ratio, so a prop measured in that
   image lands exactly where it was cut from. */
const WIDE_RATIO = 1376 / 768;
const NARROW_RATIO = 3 / 4;

type Placed = {
  aspect: number;
  depth?: number;
  z?: number;
  flip?: boolean;
  wide: Placement;
  /** Props have one placement, because they are desktop only. */
  narrow?: Placement;
};

function placementVars(item: Placed): CSSProperties {
  const narrow = item.narrow ?? item.wide;
  return {
    "--x": String(item.wide.x),
    "--base": String(item.wide.base),
    "--w": String(item.wide.w),
    "--nx": String(narrow.x),
    "--nbase": String(narrow.base),
    "--nw": String(narrow.w),
    "--aspect": String(item.aspect),
    "--wide-ratio": String(WIDE_RATIO),
    "--narrow-ratio": String(NARROW_RATIO),
    "--depth": String(item.depth ?? 1),
    "--z": String(item.z ?? 25),
    "--flip": item.flip ? "-1" : "1",
  } as CSSProperties;
}

/**
 * An image that removes itself if the file is not there, rather than leaving
 * the browser's broken-image icon in the middle of the room.
 *
 * onError alone would not be enough: the server sends real markup, so the
 * browser can fail the fetch long before React hydrates and attaches the
 * handler. The effect catches that case, the same way DragonEye does.
 */
function Art({ src, alt, className }: { src: string; alt: string; className: string }) {
  const img = useRef<HTMLImageElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setMissing(true);
  }, []);

  if (missing) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      ref={img}
      className={className}
      src={src}
      alt={alt}
      onError={() => setMissing(true)}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

/** One cut-out, or the dashed box that says which one is missing. */
function Figure({
  member,
  speaking,
  lit,
  onPoint,
}: {
  member: CastMember;
  speaking: boolean;
  /** Pointed at right now: gold contour, and the scene says their line. */
  lit: boolean;
  onPoint: (id: string | null) => void;
}) {
  const img = useRef<HTMLImageElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setMissing(true);
  }, []);

  return (
    <div
      className={[styles.figure, speaking && styles.speaking, lit && styles.lit]
        .filter(Boolean)
        .join(" ")}
      style={placementVars(member)}
      data-figure={member.id}
      onMouseEnter={() => onPoint(member.id)}
      onMouseLeave={() => onPoint(null)}
    >
      {missing ? (
        <span className={styles.figurePlaceholder}>
          <span className={styles.placeholderRole}>{member.role}</span>
          <span className={styles.placeholderName}>{member.name}</span>
          <code className={styles.placeholderPath}>
            {member.art.replace("/assets/tavern/", "")}
          </code>
        </span>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          ref={img}
          className={styles.figureArt}
          src={member.art}
          alt={member.alt}
          onError={() => setMissing(true)}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
    </div>
  );
}

export default function Tavern() {
  const [hovered, setHovered] = useState<string | null>(null);

  /*
    Nothing cycles. The scene rests on its first line, the serving maid asking
    what they want, and that is what a visitor who never moves the mouse reads.
    Point at anyone else and the room answers with their line instead; take the
    pointer away and it settles back on her.

    There is no timer here on purpose. A rotating scene decides for the reader
    how long a line is worth and takes it away mid sentence, and it moves on the
    edge of vision while somebody is reading the section next to it.
  */
  const hoveredBeat = hovered
    ? SCRIPT.findIndex((beat) => beat.speaker === hovered)
    : -1;

  const shown = hoveredBeat >= 0 ? hoveredBeat : 0;
  const speaker = SCRIPT[shown].speaker;

  return (
    <section className={styles.section} id="tavern">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <p className={styles.kicker}>The fable</p>
          <h2 className={styles.title}>Every game starts in the same room.</h2>
          <p className={styles.sub}>
            Every session opens the same way: a door, a fire, and people who have
            not met yet. The site is the part before that. It finds you four to
            six players and a game master, and puts a night in the diary. Point at
            anyone in the room to hear what they came for.
          </p>
        </div>

        {/*
          Decoration, start to finish. It is aria-hidden, and the list below it
          says the same words in the same order for anyone who is not looking at
          it, so nothing is only in the picture.
        */}
        <div className={styles.stage} aria-hidden="true">
          <div className={styles.room}>
            <Art src={ROOM} alt="" className={styles.roomArt} />
          </div>

          {CAST.map((member) => (
            <Figure
              key={member.id}
              member={member}
              speaking={member.id === speaker}
              lit={member.id === hovered}
              onPoint={setHovered}
            />
          ))}

          {/* Painted over the cast: the table the three of them are sitting at. */}
          {PROPS.map((prop) => (
            <div key={prop.id} className={styles.prop} style={placementVars(prop)}>
              <Art src={prop.art} alt="" className={styles.propArt} />
            </div>
          ))}

          {/*
            The light goes on last, over the room, the cast and the furniture
            alike. It used to sit inside the room, under everything else, and
            that put the counter in different light from the room it was cut
            out of: the floor wash darkened the boards around it and left the
            counter itself bright, which is a seam no amount of colour matching
            in the file can fix. Anything that lights the scene has to light all
            of it.
          */}
          <span className={styles.hearth} />
          <span className={styles.lamp} />
          <span className={styles.floor} />

          {SCRIPT.map((beat, index) => {
            const member = CAST.find((c) => c.id === beat.speaker);
            if (!member) return null;
              /*
                Two elements, and it has to stay that way. The anchor owns the
                position, including the translate that lifts a bubble clear of
                the head it belongs to; the inner one is what GSAP animates. Put
                both on one element and the tween's own transform replaces the
                translate, and every bubble drops by its own height and sits over
                the speaker's face.
              */
              return (
                <span
                  key={index}
                  className={styles.bubbleAnchor}
                  style={placementVars(member)}
                >
                  <p
                    data-beat={index}
                    className={`${styles.bubble} ${index === shown ? styles.bubbleShown : ""}`}
                  >
                    <span className={styles.bubbleName}>{member.name}</span>
                    {beat.line}
                  </p>
                </span>
              );
            })}
        </div>

        {/*
          The scene in plain text, for anyone who cannot see it.

          The stage is aria-hidden and the bubbles inside it are decoration, so
          without this the dialogue would not exist for a screen reader at all.
          It is not a printed transcript any more, it is the alternative to a
          picture, which is why it is hidden visually and not with `hidden`.
        */}
        <ol className={styles.offscreen}>
          {SCRIPT.map((beat, index) => {
            const member = CAST.find((c) => c.id === beat.speaker);
            return (
              <li key={index}>
                {member?.name}: {beat.line}
              </li>
            );
          })}
        </ol>

        <div className={styles.roster}>
          {CAST.map((member) => (
            <article key={member.id} className={styles.card}>
              <p className={styles.cardRole}>{member.role}</p>
              <h3 className={styles.cardName}>{member.name}</h3>
              <p className={styles.cardBlurb}>{member.blurb}</p>
            </article>
          ))}
        </div>

        <div className={styles.actions}>
          <Link href="/parties" className={styles.primary}>
            Find a party
          </Link>
          <Link href="/character-builder" className={styles.secondary}>
            Build a character
          </Link>
        </div>
      </div>
    </section>
  );
}
