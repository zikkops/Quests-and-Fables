"use client";

import { fmt } from "@/lib/engine";
import type { ResolvedSheet } from "@/lib/character";
import styles from "./Sheet.module.css";

/**
 * One sheet renderer for both kinds of character.
 *
 * It takes a ResolvedSheet and nothing else. It has no idea whether the numbers
 * came out of the SRD engine or were typed in by hand, and it must stay that
 * way: that is the whole reason a homebrew class can sit at the same table as a
 * built one without a second code path.
 */
export default function Sheet({ sheet }: { sheet: ResolvedSheet }) {
  const proficientSkills = sheet.skills.filter((s) => s.proficient);
  const otherSkills = sheet.skills.filter((s) => !s.proficient);

  return (
    <div className={styles.sheet}>
      <header className={styles.head}>
        <p className={styles.name}>{sheet.name}</p>
        <p className={styles.build}>
          {sheet.build}
          {sheet.isCustom ? <span className={styles.customTag}>Custom</span> : null}
        </p>
      </header>

      <div className={styles.stats}>
        {sheet.stats.map((stat) => (
          <div key={stat.key} className={styles.stat}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>Abilities</h3>
        <div className={styles.abilities}>
          {sheet.abilities.map((a) => (
            <div key={a.key} className={styles.ability}>
              <span className={styles.abilityName}>{a.name}</span>
              <span className={styles.abilityScore}>{a.score}</span>
              <span className={styles.abilityMod}>{fmt(a.modifier)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>Saving throws</h3>
        <ul className={styles.rows}>
          {sheet.saves.map((s) => (
            <li key={s.key} className={styles.row}>
              <span className={s.proficient ? styles.pipOn : styles.pipOff} aria-hidden="true" />
              <span className={styles.rowName}>{s.name}</span>
              <span className={styles.rowValue}>{fmt(s.modifier)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>
          Skills
          <span className={styles.count}>{proficientSkills.length} proficient</span>
        </h3>
        <ul className={styles.rows}>
          {[...proficientSkills, ...otherSkills].map((s) => (
            <li key={s.key} className={s.proficient ? styles.rowOn : styles.row}>
              <span className={s.proficient ? styles.pipOn : styles.pipOff} aria-hidden="true" />
              <span className={styles.rowName}>{s.name}</span>
              <span className={styles.rowAbility}>{s.ability.toUpperCase()}</span>
              <span className={styles.rowValue}>{fmt(s.modifier)}</span>
            </li>
          ))}
        </ul>
      </section>

      {sheet.slots.length > 0 ? (
        <section className={styles.block}>
          <h3 className={styles.blockTitle}>Spell slots</h3>
          <ul className={styles.rows}>
            {sheet.slots.map((slot) => (
              <li key={slot.label} className={styles.row}>
                <span className={styles.rowName}>{slot.label}</span>
                <span className={styles.slotPips} aria-hidden="true">
                  {Array.from({ length: slot.max }, (_, i) => (
                    <span key={i} className={styles.slotPip} />
                  ))}
                </span>
                <span className={styles.rowValue}>{slot.max}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            Back on a {sheet.slots[0].recovery === "short-rest" ? "short" : "long"} rest.
            You spend these at the table, not here.
          </p>
        </section>
      ) : null}

      {sheet.resources.length > 0 ? (
        <section className={styles.block}>
          <h3 className={styles.blockTitle}>Resources</h3>
          <ul className={styles.rows}>
            {sheet.resources.map((r) => (
              <li key={r.key} className={styles.row}>
                <span className={styles.rowName}>{r.label}</span>
                <span className={styles.rowAbility}>{RECOVERY_LABEL[r.recovery]}</span>
                <span className={styles.rowValue}>{r.max}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const RECOVERY_LABEL: Record<string, string> = {
  "short-rest": "short rest",
  "long-rest": "long rest",
  dawn: "dawn",
  never: "never",
};
