"use client";

import { BLOCKS, DAYS, type Week } from "@/lib/firebase/schema";
import styles from "./WeekGrid.module.css";

type Props = {
  week: Week;
  onChange: (next: Week) => void;
};

const toggle = (week: Week, day: number, block: number): Week => {
  const row = week[day].split("");
  row[block] = row[block] === "1" ? "0" : "1";
  const next = [...week] as Week;
  next[day] = row.join("");
  return next;
};

/**
 * Twenty-eight toggles: seven days by four blocks of the day.
 *
 * A grid rather than a list of time ranges, because the question is not "what
 * hours suit you" but "can you be at a table on Thursday evening", and the
 * second one has an answer people can give in ten seconds. The blocks are the
 * ones tables actually meet in; see `Week` in the schema for why the shape is
 * fixed.
 *
 * Each cell is a real button with `aria-pressed`, so a screen reader gets
 * "Thursday, evening, pressed" rather than a coloured square.
 */
export default function WeekGrid({ week, onChange }: Props) {
  const total = week.join("").split("1").length - 1;

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        <span aria-hidden className={styles.corner} />
        {BLOCKS.map((block) => (
          <span key={block.key} className={styles.head}>
            <span className={styles.headLabel}>{block.label}</span>
            <span className={styles.headShort} aria-hidden>
              {block.short}
            </span>
            <span className={styles.headHours}>{block.hours}</span>
          </span>
        ))}

        {DAYS.map((day, dayIndex) => (
          <div key={day} className={styles.rowGroup}>
            <span className={styles.day}>{day.slice(0, 3)}</span>

            {BLOCKS.map((block, blockIndex) => {
              const on = week[dayIndex][blockIndex] === "1";
              return (
                <button
                  key={block.key}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${day}, ${block.label}, ${block.hours}`}
                  className={on ? `${styles.cell} ${styles.on}` : styles.cell}
                  onClick={() => onChange(toggle(week, dayIndex, blockIndex))}
                >
                  <span aria-hidden>{on ? "Free" : "—"}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className={styles.count}>
        {total === 0
          ? "Nothing marked yet. A table cannot be matched to you without at least one."
          : `${total} block${total === 1 ? "" : "s"} marked free.`}
      </p>
    </div>
  );
}
