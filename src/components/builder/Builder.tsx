"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ABILITIES, ABILITY_KEYS, type AbilityKey, type Row, type Step } from "@/lib/rules";
import {
  countFor,
  fmt,
  mod,
  optionsFor,
  resolve,
  stepComplete,
  titleFor,
  visibleSteps,
  type CharacterDoc,
  type Choices,
  type Ctx,
} from "@/lib/engine";
import { blankCharacter, loadCharacter, saveCharacter, sheetFromBuild } from "@/lib/character";
import { useHydrated } from "@/lib/useHydrated";
import Sheet from "./Sheet";
import styles from "./Builder.module.css";

/**
 * The builder is a renderer.
 *
 * It switches on a step's **type**, never on what was chosen. There is no
 * `if (class === "wizard")` here and there must never be one: adding a class, a
 * subclass or an entire second game system is a change to `rules.ts` and to
 * nothing in this file.
 *
 * If a new kind of choice is ever needed, it gets a new step *type* and a new
 * branch in `renderStep`. That is the only place this file is allowed to grow.
 */

/** Changing a choice invalidates the ones built on top of it. */
const DEPENDENTS: Record<string, string[]> = {
  species: ["lineage", "extraSkill", "extraOriginFeat"],
  class: ["subclass", "skills", "fightingStyle"],
  background: ["asi"],
};

export default function Builder() {
  const hydrated = useHydrated();
  const fallback = useMemo(() => blankCharacter(), []);
  const stored = useMemo(() => (hydrated ? loadCharacter() : null), [hydrated]);
  const [edited, setEdited] = useState<CharacterDoc | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  /* The draft in progress, the draft restored from this browser, or a fresh one,
     in that order. Derived rather than copied into state, so there is nothing to
     synchronise and nothing to get out of step. */
  const doc = edited ?? stored ?? fallback;
  const setDoc = (updater: (d: CharacterDoc) => CharacterDoc) => setEdited(updater(doc));

  /* Writing to an external system is exactly what an effect is for. */
  useEffect(() => {
    if (edited) saveCharacter(edited);
  }, [edited]);

  const ctx = useMemo<Ctx>(() => resolve(doc), [doc]);
  const steps = useMemo(() => visibleSteps(ctx), [ctx]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const sheet = useMemo(() => sheetFromBuild(doc), [doc]);

  const update = (patch: Partial<Choices>) =>
    setDoc((d) => ({ ...d, choices: { ...d.choices, ...patch } }));

  const setChoice = (id: string, value: unknown) =>
    setDoc((d) => {
      const choices = { ...d.choices, [id]: value } as Choices;
      for (const dependent of DEPENDENTS[id] ?? []) {
        if (dependent === "asi") choices.asi = { mode: "2-1" };
        else if (dependent === "skills" || dependent === "extraSkill") {
          (choices as unknown as Record<string, unknown>)[dependent] = [];
        } else {
          (choices as unknown as Record<string, unknown>)[dependent] = undefined;
        }
      }
      return { ...d, choices };
    });

  const done = steps.filter((s) => stepComplete(s, ctx)).length;

  /* The handoff is the entire reason the builder exists as a front door: someone
     searches for a character builder, and the next thing they see is that there
     are tables near them. It appears the moment the character is legal, not at
     the end of the step list, because most people stop building before then. */
  const ready = steps.every((s) => stepComplete(s, ctx));

  return (
    <div className={styles.builder}>
      <div className={styles.main}>
        <header className={styles.head}>
          <div className={styles.headTop}>
            <p className={styles.kicker}>Character builder</p>
            <label className={styles.level}>
              Level
              <select
                className={styles.levelSelect}
                value={doc.level}
                onChange={(e) => setDoc((d) => ({ ...d, level: Number(e.target.value) }))}
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <span style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <p className={styles.progressText}>
              {done} of {steps.length} done
            </p>
          </div>

          <nav className={styles.tabs} aria-label="Build steps">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndex(i)}
                className={
                  i === stepIndex
                    ? styles.tabOn
                    : stepComplete(s, ctx)
                      ? styles.tabDone
                      : styles.tab
                }
              >
                {titleFor(s, ctx)}
              </button>
            ))}
          </nav>
        </header>

        {step ? (
          <section className={styles.step}>
            <h2 className={styles.stepTitle}>{titleFor(step, ctx)}</h2>
            {step.help ? <p className={styles.stepHelp}>{step.help}</p> : null}
            {renderStep(step, ctx, doc, setChoice, update)}
          </section>
        ) : null}

        <div className={styles.nav}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
          >
            Back
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            disabled={stepIndex >= steps.length - 1}
          >
            Next
          </button>
          <button
            type="button"
            className={styles.reset}
            onClick={() => {
              setDoc(() => blankCharacter());
              setStepIndex(0);
            }}
          >
            Start over
          </button>
        </div>

        <p className={styles.saved}>
          Saved in this browser as you go. No account needed.{" "}
          <Link href="/character-builder/custom" className={styles.link}>
            Playing something homebrew?
          </Link>
        </p>
      </div>

      <aside className={styles.aside}>
        {ready ? (
          <div className={styles.handoff}>
            <p className={styles.handoffTitle}>
              {sheet.name === "Unnamed" ? "Your character" : sheet.name} is ready.
            </p>
            <p className={styles.handoffBody}>
              Now find a table. Parties of four to six are forming on the coast
              between Beirut and Jbeil, and we find each one a game master.
            </p>
            <Link href="/parties" className={styles.handoffCta}>
              Find a table near you
            </Link>
          </div>
        ) : null}
        <Sheet sheet={sheet} />
      </aside>
    </div>
  );
}

/* ==========================================================================
   Step types. The only switch in the builder.
   ========================================================================== */

function renderStep(
  step: Step,
  ctx: Ctx,
  doc: CharacterDoc,
  setChoice: (id: string, value: unknown) => void,
  update: (patch: Partial<Choices>) => void,
) {
  switch (step.type) {
    case "single-select":
      return <SingleSelect step={step} ctx={ctx} doc={doc} setChoice={setChoice} />;
    case "multi-select":
      return <MultiSelect step={step} ctx={ctx} doc={doc} setChoice={setChoice} />;
    case "ability-bonus":
      return <AbilityBonus ctx={ctx} update={update} />;
    case "ability-scores":
      return <AbilityScores step={step} ctx={ctx} update={update} />;
    case "text-group":
      return <TextGroup step={step} doc={doc} update={update} />;
  }
}

const optionMeta = (row: Row) =>
  [typeof row.meta === "string" ? row.meta : "", typeof row.blurb === "string" ? row.blurb : ""]
    .filter(Boolean);

function SingleSelect({
  step, ctx, doc, setChoice,
}: { step: Step; ctx: Ctx; doc: CharacterDoc; setChoice: (id: string, v: unknown) => void }) {
  const options = optionsFor(step, ctx);
  const selected = (doc.choices as unknown as Record<string, unknown>)[step.id];

  if (options.length === 0) {
    return <p className={styles.empty}>Nothing to choose here yet. Pick a class first.</p>;
  }

  return (
    <div className={styles.options}>
      {options.map((row) => {
        const on = selected === row.key;
        const [meta, blurb] = optionMeta(row);
        return (
          <button
            key={row.key}
            type="button"
            className={on ? styles.optionOn : styles.option}
            onClick={() => setChoice(step.id, on ? undefined : row.key)}
            aria-pressed={on}
          >
            <span className={styles.optionName}>{row.name}</span>
            {meta ? <span className={styles.optionMeta}>{meta}</span> : null}
            {blurb ? <span className={styles.optionBlurb}>{blurb}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelect({
  step, ctx, doc, setChoice,
}: { step: Step; ctx: Ctx; doc: CharacterDoc; setChoice: (id: string, v: unknown) => void }) {
  const options = optionsFor(step, ctx);
  const limit = countFor(step, ctx);
  const selected = ((doc.choices as unknown as Record<string, unknown>)[step.id] as string[]) ?? [];

  if (options.length === 0) {
    return <p className={styles.empty}>Nothing to choose here yet. Pick a class first.</p>;
  }

  return (
    <>
      <p className={styles.limit}>
        Choose {limit}. {selected.length} chosen.
      </p>
      <div className={styles.options}>
        {options.map((row) => {
          const on = selected.includes(row.key);
          const full = selected.length >= limit && !on;
          return (
            <button
              key={row.key}
              type="button"
              disabled={full}
              className={on ? styles.optionOn : full ? styles.optionOff : styles.option}
              onClick={() =>
                setChoice(
                  step.id,
                  on ? selected.filter((k) => k !== row.key) : [...selected, row.key],
                )
              }
              aria-pressed={on}
            >
              <span className={styles.optionName}>{row.name}</span>
              {typeof row.ability === "string" ? (
                <span className={styles.optionMeta}>{String(row.ability).toUpperCase()}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function AbilityBonus({ ctx, update }: { ctx: Ctx; update: (p: Partial<Choices>) => void }) {
  const options = (Array.isArray(ctx.background?.abilityOptions)
    ? (ctx.background.abilityOptions as AbilityKey[])
    : []);
  const asi = ctx.choices.asi;

  if (options.length === 0) return <p className={styles.empty}>Choose a background first.</p>;

  const name = (k: AbilityKey) => ABILITIES.find((a) => a.key === k)?.name ?? k;

  return (
    <div className={styles.stack}>
      <div className={styles.modes}>
        <button
          type="button"
          className={asi.mode === "2-1" ? styles.modeOn : styles.mode}
          onClick={() => update({ asi: { ...asi, mode: "2-1" } })}
        >
          +2 and +1
        </button>
        <button
          type="button"
          className={asi.mode === "1-1-1" ? styles.modeOn : styles.mode}
          onClick={() => update({ asi: { mode: "1-1-1" } })}
        >
          +1 to all three
        </button>
      </div>

      {asi.mode === "2-1" ? (
        <div className={styles.pickers}>
          <label className={styles.picker}>
            +2 to
            <select
              value={asi.two ?? ""}
              onChange={(e) => update({ asi: { ...asi, two: e.target.value as AbilityKey } })}
            >
              <option value="">Choose</option>
              {options.map((k) => (
                <option key={k} value={k}>{name(k)}</option>
              ))}
            </select>
          </label>
          <label className={styles.picker}>
            +1 to
            <select
              value={asi.one ?? ""}
              onChange={(e) => update({ asi: { ...asi, one: e.target.value as AbilityKey } })}
            >
              <option value="">Choose</option>
              {options.filter((k) => k !== asi.two).map((k) => (
                <option key={k} value={k}>{name(k)}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className={styles.limit}>
          +1 to {options.map(name).join(", ")}.
        </p>
      )}
    </div>
  );
}

function AbilityScores({
  step, ctx, update,
}: { step: Step; ctx: Ctx; update: (p: Partial<Choices>) => void }) {
  const { method, assignment } = ctx.choices.abilities;
  const array = step.standardArray ?? [];
  const buy = step.pointBuy;

  const set = (key: AbilityKey, value: number | null) =>
    update({
      abilities: {
        method,
        assignment: { ...assignment, [key]: value ?? undefined },
      },
    });

  const spent = buy
    ? ABILITY_KEYS.reduce((total, k) => total + (buy.costs[String(assignment[k] ?? buy.min)] ?? 0), 0)
    : 0;

  return (
    <div className={styles.stack}>
      <div className={styles.modes}>
        <button
          type="button"
          className={method === "standard-array" ? styles.modeOn : styles.mode}
          onClick={() => update({ abilities: { method: "standard-array", assignment: {} } })}
        >
          Standard array
        </button>
        <button
          type="button"
          className={method === "point-buy" ? styles.modeOn : styles.mode}
          onClick={() => update({ abilities: { method: "point-buy", assignment: {} } })}
        >
          Point buy
        </button>
      </div>

      {method === "point-buy" && buy ? (
        <p className={styles.limit}>
          {buy.budget - spent} of {buy.budget} points left.
        </p>
      ) : (
        <p className={styles.limit}>Assign {array.join(", ")} however you like.</p>
      )}

      <div className={styles.scores}>
        {ABILITIES.map((ability) => {
          const key = ability.key;
          const current = assignment[key];
          const bonus = ctx.bonus[key] ?? 0;
          const total = (current ?? 10) + bonus;

          const choices = method === "point-buy" && buy
            ? Object.keys(buy.costs).map(Number)
            : array;

          const used = Object.values(assignment).filter((v) => v != null);

          return (
            <div key={key} className={styles.score}>
              <span className={styles.scoreName}>{ability.name}</span>
              <select
                className={styles.scoreSelect}
                value={current ?? ""}
                onChange={(e) => set(key, e.target.value === "" ? null : Number(e.target.value))}
              >
                <option value="">--</option>
                {choices.map((value) => {
                  const taken =
                    method === "standard-array"
                    && current !== value
                    && used.filter((u) => u === value).length
                       >= array.filter((a) => a === value).length;
                  const tooExpensive =
                    method === "point-buy"
                    && buy != null
                    && spent + (buy.costs[String(value)] - (buy.costs[String(current ?? buy.min)] ?? 0))
                       > buy.budget;
                  return (
                    <option key={value} value={value} disabled={taken || tooExpensive}>
                      {value}
                    </option>
                  );
                })}
              </select>
              <span className={styles.scoreTotal}>
                {current != null ? total : "--"}
                {bonus > 0 ? <em className={styles.scoreBonus}>+{bonus}</em> : null}
              </span>
              <span className={styles.scoreMod}>
                {current != null ? fmt(mod(total)) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextGroup({
  step, doc, update,
}: { step: Step; doc: CharacterDoc; update: (p: Partial<Choices>) => void }) {
  const details = doc.choices.details ?? {};
  const set = (key: string, value: string) =>
    update({ details: { ...details, [key]: value } });

  return (
    <div className={styles.fields}>
      {(step.fields ?? []).map((field) => (
        <label key={field.key} className={styles.field}>
          <span className={styles.fieldLabel}>{field.label}</span>
          {field.multiline ? (
            <textarea
              className={styles.textarea}
              rows={4}
              value={details[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => set(field.key, e.target.value)}
            />
          ) : (
            <input
              className={styles.input}
              type="text"
              value={details[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => set(field.key, e.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
}
