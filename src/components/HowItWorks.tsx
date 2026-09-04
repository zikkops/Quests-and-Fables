"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { END, START, STOPS } from "@/data/journey";
import styles from "./HowItWorks.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The journey: one line from having nobody to play with to sitting at a table,
 * with the optional parts turning off it.
 *
 * Two ideas hold the whole thing up.
 *
 * **The line is measured, not authored.** Nothing here knows where a stop will
 * land. The markup lays out as an ordinary grid, then the nodes are measured
 * and a curve is fitted through wherever they ended up, refitted on a
 * ResizeObserver. That is what survives a rewrap, a web font landing, a phone
 * folding it all into one column, or a stop being added to `journey.ts` by
 * somebody who never opens this file. A hand-drawn path would be wrong by the
 * first content edit.
 *
 * **The line is the clock.** Scroll draws it, and everything else waits its
 * turn: a stop appears when the drawn end reaches its node, and its turning
 * draws out to its branch card immediately after. Nothing is timed off the
 * viewport, because "on screen" and "the line got here" are not the same
 * moment and do not look the same.
 */

type Point = { x: number; y: number };
type Turning = { id: string; stop: string; d: string; length: number };

/** Length of one cubic, by walking it. Two dozen steps is plenty at this size. */
function cubicLength(p0: Point, c0: Point, c1: Point, p1: Point, steps = 24): number {
  const at = (t: number): Point => {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y,
    };
  };

  let total = 0;
  let previous = p0;
  for (let i = 1; i <= steps; i++) {
    const point = at(i / steps);
    total += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return total;
}

/**
 * A curve through the stops, bending in the direction of travel, and **how far
 * along it each stop sits** as a fraction of the whole. Those fractions are
 * what let a stop wait for the line instead of for the viewport.
 */
function spineThrough(points: Point[]): { d: string; at: number[] } {
  const parts: string[] = [];
  const lengths: number[] = [0];

  points.forEach((point, i) => {
    if (i === 0) {
      parts.push(`M ${point.x} ${point.y}`);
      return;
    }
    const previous = points[i - 1];
    const pull = (point.y - previous.y) * 0.5;
    const c0 = { x: previous.x, y: previous.y + pull };
    const c1 = { x: point.x, y: point.y - pull };

    parts.push(`C ${c0.x} ${c0.y}, ${c1.x} ${c1.y}, ${point.x} ${point.y}`);
    lengths.push(lengths[i - 1] + cubicLength(previous, c0, c1, point));
  });

  const total = lengths[lengths.length - 1] || 1;
  return { d: parts.join(" "), at: lengths.map((length) => length / total) };
}

/** A turning: off the spine sideways, into the edge of a branch card. */
function branchTo(from: Point, to: Point): { d: string; length: number } {
  const pull = (to.x - from.x) * 0.55;
  const c0 = { x: from.x + pull, y: from.y };
  const c1 = { x: to.x - pull, y: to.y };
  return {
    d: `M ${from.x} ${from.y} C ${c0.x} ${c0.y}, ${c1.x} ${c1.y}, ${to.x} ${to.y}`,
    length: cubicLength(from, c0, c1, to),
  };
}

/**
 * Which node a thing hangs off, in document order: the start marker is 0, the
 * stops follow, the end marker is last. A branch shares its stop's node, since
 * that is where its turning leaves from.
 */
function nodeIndexOf(id: string): number {
  if (id === "start") return 0;
  const key = id.split(":")[0];
  const stop = STOPS.findIndex((candidate) => candidate.key === key);
  return stop === -1 ? STOPS.length + 1 : stop + 1;
}

export default function HowItWorks() {
  const scope = useRef<HTMLElement>(null);
  const journey = useRef<HTMLDivElement>(null);
  const [spine, setSpine] = useState("");
  const [nodeAt, setNodeAt] = useState<number[]>([]);
  const [turnings, setTurnings] = useState<Turning[]>([]);
  const [armed, setArmed] = useState(false);

  /*
    How many nodes the line has reached, and nothing more.

    A count rather than a set of ids, and a count rather than the raw scroll
    progress, for two reasons. It reverses: scroll back up and the number comes
    down, so cards leave and turnings retract exactly as the line does, which is
    what an earlier version got wrong by only ever growing. And it re-renders
    only when a threshold is actually crossed, five or six times over the whole
    section, instead of on every scroll tick.
  */
  const [arrived, setArrived] = useState(0);

  const measure = useCallback(() => {
    const root = journey.current;
    if (!root) return;

    const frame = root.getBoundingClientRect();
    const centre = (el: Element): Point => {
      const r = el.getBoundingClientRect();
      return { x: r.left - frame.left + r.width / 2, y: r.top - frame.top + r.height / 2 };
    };

    const nodes = [...root.querySelectorAll("[data-node]")].map(centre);
    if (nodes.length > 1) {
      const { d, at } = spineThrough(nodes);
      setSpine(d);
      setNodeAt(at);
    }

    /*
      A turning leaves its own stop's node and arrives at the edge of the card
      that faces it, so the line never crosses the card it is pointing at.
    */
    const lines: Turning[] = [];
    for (const card of root.querySelectorAll<HTMLElement>("[data-branch]")) {
      const stop = card.closest<HTMLElement>("[data-stop]");
      const node = stop?.querySelector("[data-node]");
      if (!node || !stop?.dataset.stop) continue;

      const from = centre(node);
      const box = card.getBoundingClientRect();
      const facingLeft = box.left - frame.left > from.x;
      const { d, length } = branchTo(from, {
        x: (facingLeft ? box.left : box.right) - frame.left,
        y: box.top - frame.top + Math.min(38, box.height / 2),
      });

      lines.push({ id: card.dataset.reveal ?? "", stop: stop.dataset.stop, d, length });
    }
    setTurnings(lines);
  }, []);

  /*
    Layout effect, not an effect: the line has to be right in the same paint as
    the cards, or it whips across the section on first load.
  */
  useLayoutEffect(() => {
    measure();
    const root = journey.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const watcher = new ResizeObserver(measure);
    watcher.observe(root);
    for (const stop of root.querySelectorAll("[data-stop]")) watcher.observe(stop);
    return () => watcher.disconnect();
  }, [measure]);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const path = scope.current?.querySelector<SVGPathElement>(`.${styles.spine}`);
      if (!path || !spine || nodeAt.length === 0) return;

      /*
        Nothing is hidden until this line runs, which is the safety rule for the
        whole section: no JS, no ScrollTrigger or reduced motion, and the stops
        are simply text that is already there.
      */
      setArmed(true);

      const length = path.getTotalLength();

      /*
        Dash offset by hand rather than DrawSVG, which is Club GreenSock and this
        project has the free package. One dash the length of the path, slid from
        fully offset to nothing.

        `onUpdate` is where the section actually happens: progress is how much of
        the line is drawn, and a stop whose node sits at or behind that point has
        been reached. The small lead means a card starts fading the moment the
        line commits to it rather than after it has already gone past.
      */
      const LEAD = 0.03;

      gsap.fromTo(
        path,
        { strokeDasharray: length, strokeDashoffset: length },
        {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: `.${styles.journey}`,
            start: "top 72%",
            end: "bottom 82%",
            scrub: 0.6,
            onUpdate: (self) => {
              const reached = nodeAt.filter(
                (fraction) => fraction <= self.progress + LEAD,
              ).length;
              setArrived((current) => (current === reached ? current : reached));
            },
          },
        },
      );
    },
    { scope, dependencies: [spine, nodeAt] },
  );

  /*
    The net. If the line never runs its course, anything sitting on screen is
    shown anyway: a missed callback costs an animation, never the words.
  */
  /* Read by the sweep below, which is set up once and must not be torn down and
     rebuilt every time the line reaches another stop. */
  const arrivedNow = useRef(0);
  useEffect(() => {
    arrivedNow.current = arrived;
  }, [arrived]);

  useEffect(() => {
    if (!armed) return;
    const sweep = window.setTimeout(() => {
      const root = journey.current;
      if (!root) return;

      /*
        The test is "the line has not moved at all", not "something is hidden".
        Hidden things below the drawn end are the whole point of the section, so
        a reader who refreshes halfway down it must not trip this. Only a line
        that has reached nothing while the section sits on screen means the
        clock is not running.
      */
      if (arrivedNow.current > 0) return;

      const onScreen = [...root.querySelectorAll<HTMLElement>("[data-reveal]")].some(
        (el) => {
          const box = el.getBoundingClientRect();
          return box.top < window.innerHeight && box.bottom > 0;
        },
      );

      /* Disarm rather than reveal. If the line is not driving this there is no
         honest way to know what should come next, so the mechanism steps aside
         and the section goes back to being plain text. */
      if (onScreen) setArmed(false);
    }, 2500);
    return () => window.clearTimeout(sweep);
  }, [armed]);

  /*
    Reached, not remembered. Everything is a function of where the line is now,
    so scrolling back up takes cards and turnings with it.
  */
  const reached = (id: string) => !armed || nodeIndexOf(id) < arrived;
  const shown = (id: string, base: string) => (reached(id) ? `${base} ${styles.shown}` : base);

  return (
    <section className={styles.section} id="how-it-works" ref={scope}>
      <div className={styles.inner}>
        <div className={styles.heading}>
          <p className={styles.kicker}>How it works</p>
          <h2 className={styles.title}>
            Four adventurers, one storyteller, and a free Tuesday.
          </h2>
          <p className={styles.sub}>
            That is the whole bottleneck. Not rules, not dice, not software. Just
            enough people willing to be somewhere on the same evening. The line
            below is what happens to you. What turns off it is there when you
            want it and skippable when you do not.
          </p>
        </div>

        <div
          className={armed ? `${styles.journey} ${styles.armed}` : styles.journey}
          ref={journey}
        >
          {/* Decoration. The order and the words are in the list underneath. */}
          <svg className={styles.rail} aria-hidden="true">
            <defs>
              {/*
                A dotted line cannot draw itself with stroke-dashoffset: the dash
                pattern is already doing that job, and sliding it just marches
                the dots along. So each turning is masked by a fat solid stroke
                of its own shape, and that is what slides. The dots stay dots and
                are uncovered from the spine outwards.
              */}
              {turnings.map((turning) => (
                <mask
                  key={turning.id}
                  id={`turning-${turning.id.replace(/\W+/g, "-")}`}
                  maskUnits="userSpaceOnUse"
                  x="-200"
                  y="-200"
                  width="6000"
                  height="20000"
                >
                  {/*
                    Only hold the mask closed when something is going to open
                    it. Unarmed means reduced motion or no JS, and a mask left
                    at full offset there would delete the dotted turnings from
                    the page entirely rather than merely not animating them.
                  */}
                  <path
                    className={styles.turningMask}
                    d={turning.d}
                    style={
                      armed
                        ? {
                            strokeDasharray: turning.length,
                            strokeDashoffset: reached(turning.stop) ? 0 : turning.length,
                          }
                        : undefined
                    }
                  />
                </mask>
              ))}
            </defs>

            {turnings.map((turning) => (
              <path
                key={turning.id}
                className={styles.turning}
                d={turning.d}
                mask={`url(#turning-${turning.id.replace(/\W+/g, "-")})`}
              />
            ))}

            <path className={styles.spine} d={spine} />
          </svg>

          <p className={styles.marker}>
            <span className={`${styles.node} ${styles.nodeStart}`} data-node="spine" />
            <span className={shown("start", styles.markerText)} data-reveal="start">
              {START}
            </span>
          </p>

          <ol className={styles.stops}>
            {STOPS.map((stop, index) => (
              <li
                key={stop.key}
                data-stop={stop.key}
                className={`${styles.stop} ${index % 2 ? styles.flip : ""}`}
              >
                <div className={styles.dotCell}>
                  <span
                    className={shown(stop.key, styles.node)}
                    data-node="spine"
                  />
                </div>

                <article className={shown(stop.key, styles.card)} data-reveal={stop.key}>
                  <p className={styles.num}>{stop.num}</p>
                  <h3 className={styles.stopTitle}>{stop.title}</h3>
                  <p className={styles.stopBody}>{stop.body}</p>
                  <Link href={stop.href} className={styles.stopLink}>
                    {stop.label} →
                  </Link>
                </article>

                <div className={styles.branchCell}>
                  {stop.branches?.map((branch) => (
                    <aside
                      key={branch.title}
                      data-branch=""
                      data-reveal={`${stop.key}:${branch.title}`}
                      className={shown(`${stop.key}:${branch.title}`, styles.branch)}
                    >
                      <p className={styles.branchKicker}>{branch.kicker}</p>
                      <h4 className={styles.branchTitle}>{branch.title}</h4>
                      <p className={styles.branchBody}>{branch.body}</p>
                      <Link href={branch.href} className={styles.branchLink}>
                        {branch.label} →
                      </Link>
                    </aside>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <p className={`${styles.marker} ${styles.markerLast}`}>
            <span className={`${styles.node} ${styles.nodeEnd}`} data-node="spine" />
            <span className={shown("end", styles.markerText)} data-reveal="end">
              {END}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
