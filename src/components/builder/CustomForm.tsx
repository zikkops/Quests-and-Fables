"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ABILITIES, SKILLS, type AbilityKey, type Recovery } from "@/lib/rules";
import {
  blankCustom,
  loadCustom,
  saveCustom,
  sheetFromCustom,
  type CustomCharacter,
} from "@/lib/character";
import { useHydrated } from "@/lib/useHydrated";
import Sheet from "./Sheet";
import shell from "./Builder.module.css";
import styles from "./Custom.module.css";

/**
 * The blank sheet.
 *
 * ⚠️ **It ships blank and it stays blank.** No dropdown of non-SRD subclasses, no
 * autocomplete seeded with content, no import from anywhere. A form the player
 * types into is their content; a form that hands them the content makes us the
 * distributor, and that difference is the entire legal position. See
 * Legal & Compliance, "Custom character sheets".
 *
 * Validation is deliberately thin. The rules here are not ours, so the form
 * warns about the impossible and blocks nothing.
 */

const RECOVERIES: { value: Recovery; label: string }[] = [
  { value: "long-rest", label: "Long rest" },
  { value: "short-rest", label: "Short rest" },
  { value: "dawn", label: "Dawn" },
  { value: "never", label: "Never" },
];

export default function CustomForm() {
  const hydrated = useHydrated();
  const fallback = useMemo(() => blankCustom(), []);
  const stored = useMemo(() => (hydrated ? loadCustom() : null), [hydrated]);
  const [edited, setEdited] = useState<CustomCharacter | null>(null);

  const c = edited ?? stored ?? fallback;
  const setC = (updater: (prev: CustomCharacter) => CustomCharacter) => setEdited(updater(c));

  useEffect(() => {
    if (edited) saveCustom(edited);
  }, [edited]);

  const sheet = useMemo(() => sheetFromCustom(c), [c]);
  const set = <K extends keyof CustomCharacter>(key: K, value: CustomCharacter[K]) =>
    setC((prev) => ({ ...prev, [key]: value }));

  const toggle = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  const setSlot = (spellLevel: number, max: number, recovery: Recovery) =>
    setC((prev) => {
      const others = prev.slots.filter((s) => s.spellLevel !== spellLevel);
      const next = max > 0 ? [...others, { spellLevel, max, recovery }] : others;
      return { ...prev, slots: next.sort((a, b) => a.spellLevel - b.spellLevel) };
    });

  const slotFor = (spellLevel: number) =>
    c.slots.find((s) => s.spellLevel === spellLevel);

  return (
    <div className={shell.builder}>
      <div className={shell.main}>
        <header className={shell.head}>
          <div className={shell.headTop}>
            <p className={shell.kicker}>Custom character</p>
            <label className={shell.level}>
              Level
              <input
                type="number"
                min={1}
                max={30}
                className={styles.numTight}
                value={c.level}
                onChange={(e) => set("level", Number(e.target.value) || 1)}
              />
            </label>
          </div>
          <p className={shell.stepHelp}>
            Everything here is yours to set. Nothing is calculated for you and
            nothing is locked, which is the trade for being able to play
            absolutely anything. It sits at the table exactly like a character
            built from the SRD.
          </p>
        </header>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Who they are</h2>
          <div className={styles.grid}>
            <Field label="Name">
              <input
                className={styles.input}
                value={c.name}
                placeholder="Thora Ironhelm"
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Class and level, as you write it">
              <input
                className={styles.input}
                value={c.build}
                placeholder="Battle Master Fighter 5"
                onChange={(e) => set("build", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>The numbers</h2>
          <div className={styles.grid}>
            <Field label="Max hit points">
              <input type="number" className={styles.input} value={c.maxHitPoints}
                onChange={(e) => set("maxHitPoints", Number(e.target.value) || 0)} />
            </Field>
            <Field label="Armour class">
              <input type="number" className={styles.input} value={c.armorClass}
                onChange={(e) => set("armorClass", Number(e.target.value) || 0)} />
            </Field>
            <Field label="Speed">
              <input className={styles.input} value={c.speed} placeholder="30 ft"
                onChange={(e) => set("speed", e.target.value)} />
            </Field>
            <Field label="Hit dice">
              <input className={styles.input} value={c.hitDice} placeholder="5d10"
                onChange={(e) => set("hitDice", e.target.value)} />
            </Field>
            <Field label="Proficiency bonus">
              <input type="number" className={styles.input} value={c.proficiencyBonus}
                onChange={(e) => set("proficiencyBonus", Number(e.target.value) || 0)} />
            </Field>
          </div>
          {c.maxHitPoints < 1 ? (
            <p className={styles.warn}>
              Max hit points is below 1. Left as it is, in case you meant it.
            </p>
          ) : null}
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Ability scores</h2>
          <div className={styles.abilities}>
            {ABILITIES.map((a) => (
              <label key={a.key} className={styles.abilityField}>
                <span className={styles.abilityLabel}>{a.name}</span>
                <input
                  type="number"
                  className={styles.abilityInput}
                  value={c.abilities[a.key]}
                  onChange={(e) =>
                    set("abilities", { ...c.abilities, [a.key]: Number(e.target.value) || 0 })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Saving throw proficiencies</h2>
          <div className={styles.chips}>
            {ABILITIES.map((a) => {
              const on = c.saveProficiencies.includes(a.key);
              return (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={on}
                  className={on ? styles.chipOn : styles.chip}
                  onClick={() =>
                    set("saveProficiencies", toggle(c.saveProficiencies, a.key) as AbilityKey[])
                  }
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>
            Skill proficiencies
            <span className={styles.groupCount}>{c.skillProficiencies.length} chosen</span>
          </h2>
          <div className={styles.chips}>
            {SKILLS.map((s) => {
              const on = c.skillProficiencies.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  className={on ? styles.chipOn : styles.chip}
                  onClick={() => set("skillProficiencies", toggle(c.skillProficiencies, s.key))}
                >
                  {s.name}
                  <span className={styles.chipAbility}>{s.ability.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Spell slots</h2>
          <p className={styles.hint}>
            Leave a level at zero if you do not have it. Recovery is per level,
            so pact magic coming back on a short rest is just how you set it.
          </p>
          <div className={styles.slots}>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((spellLevel) => {
              const slot = slotFor(spellLevel);
              return (
                <div key={spellLevel} className={styles.slotRow}>
                  <span className={styles.slotLabel}>Level {spellLevel}</span>
                  <input
                    type="number"
                    min={0}
                    className={styles.slotInput}
                    value={slot?.max ?? 0}
                    onChange={(e) =>
                      setSlot(spellLevel, Number(e.target.value) || 0, slot?.recovery ?? "long-rest")
                    }
                  />
                  <select
                    className={styles.slotSelect}
                    value={slot?.recovery ?? "long-rest"}
                    disabled={!slot}
                    onChange={(e) =>
                      setSlot(spellLevel, slot?.max ?? 0, e.target.value as Recovery)
                    }
                  >
                    {RECOVERIES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Other resources</h2>
          <p className={styles.hint}>
            Rage uses, ki points, sorcery points, channel divinity, item charges,
            anything you tick off and get back later.
          </p>

          {c.resources.map((r, i) => (
            <div key={r.key} className={styles.resourceRow}>
              <input
                className={styles.input}
                value={r.label}
                placeholder="Rage uses"
                onChange={(e) => {
                  const next = [...c.resources];
                  next[i] = { ...r, label: e.target.value };
                  set("resources", next);
                }}
              />
              <input
                type="number"
                min={0}
                className={styles.slotInput}
                value={r.max}
                onChange={(e) => {
                  const next = [...c.resources];
                  next[i] = { ...r, max: Number(e.target.value) || 0 };
                  set("resources", next);
                }}
              />
              <select
                className={styles.slotSelect}
                value={r.recovery}
                onChange={(e) => {
                  const next = [...c.resources];
                  next[i] = { ...r, recovery: e.target.value as Recovery };
                  set("resources", next);
                }}
              >
                {RECOVERIES.map((rec) => (
                  <option key={rec.value} value={rec.value}>{rec.label}</option>
                ))}
              </select>
              <button
                type="button"
                className={styles.remove}
                onClick={() => set("resources", c.resources.filter((x) => x.key !== r.key))}
                aria-label={`Remove ${r.label || "resource"}`}
              >
                Remove
              </button>
            </div>
          ))}

          <button
            type="button"
            className={shell.secondary}
            onClick={() =>
              set("resources", [
                ...c.resources,
                {
                  /* Index-based so it is stable without needing a clock or a
                     random source, both of which make the page unpredictable. */
                  key: `r${c.resources.length}-${c.resources.reduce((n, x) => n + x.label.length, 0)}`,
                  label: "",
                  max: 1,
                  recovery: "long-rest" as Recovery,
                },
              ])
            }
          >
            Add a resource
          </button>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Notes</h2>
          <textarea
            className={styles.textarea}
            rows={4}
            value={c.notes}
            placeholder="Features, traits, anything you want on the sheet."
            onChange={(e) => set("notes", e.target.value)}
          />
        </section>

        <div className={shell.nav}>
          <Link href="/character-builder" className={shell.secondary}>
            Use the SRD builder instead
          </Link>
          <button
            type="button"
            className={shell.reset}
            onClick={() => setC(() => blankCustom())}
          >
            Clear the sheet
          </button>
        </div>

        <p className={shell.saved}>
          Saved in this browser as you go. No account needed, and a custom sheet
          stays private to your character.
        </p>
      </div>

      <aside className={shell.aside}>
        <Sheet sheet={sheet} />
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
