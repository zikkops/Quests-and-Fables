import {
  ABILITY_KEYS,
  CONTENT,
  FULL_CASTER_SLOTS,
  HALF_CASTER_SLOTS,
  PACT_MAGIC,
  SKILLS,
  STEPS,
  type AbilityKey,
  type Recovery,
  type Row,
  type Step,
} from "./rules";

/* ==========================================================================
   Small helpers
   ========================================================================== */

export const mod = (score: number | undefined) => Math.floor(((score ?? 10) - 10) / 2);
export const fmt = (n: number) => (n >= 0 ? "+" : "") + n;
/** Proficiency bonus. The one piece of 5e maths that is genuinely universal. */
export const pb = (level: number) => Math.ceil(level / 4) + 1;

/* Typed reads off loosely-typed content rows. The JSON is data, not a class
   hierarchy, so accessors are how we stay honest about that. */
const str = (row: Row | undefined, field: string): string | undefined =>
  typeof row?.[field] === "string" ? (row[field] as string) : undefined;
const num = (row: Row | undefined, field: string): number | undefined =>
  typeof row?.[field] === "number" ? (row[field] as number) : undefined;
const bool = (row: Row | undefined, field: string): boolean => row?.[field] === true;
const list = (row: Row | undefined, field: string): string[] =>
  Array.isArray(row?.[field]) ? (row[field] as string[]) : [];

/* ==========================================================================
   The character document: choices, never computed results

   Everything on a sheet is recomputed from these on load, so fixing a ruleset
   bug repairs every character that already exists.
   ========================================================================== */

export type Choices = {
  species?: string;
  lineage?: string;
  class?: string;
  subclass?: string;
  background?: string;
  asi: { mode: "2-1" | "1-1-1"; two?: AbilityKey; one?: AbilityKey };
  abilities: { method: "standard-array" | "point-buy"; assignment: Partial<Record<AbilityKey, number>> };
  skills: string[];
  extraSkill: string[];
  fightingStyle?: string;
  extraOriginFeat?: string;
  generalFeat?: string;
  epicBoon?: string;
  details: Record<string, string>;
};

export type CharacterDoc = {
  schemaVersion: 1;
  rulesetId: string;
  rulesetVersion: string;
  level: number;
  choices: Choices;
};

export type Ctx = {
  level: number;
  choices: Choices;
  species?: Row;
  lineage?: Row;
  class?: Row;
  subclass?: Row;
  background?: Row;
  base: Record<AbilityKey, number>;
  bonus: Record<AbilityKey, number>;
  scores: Record<AbilityKey, number>;
};

const find = (source: keyof typeof CONTENT, key?: string) =>
  key ? CONTENT[source].find((r) => r.key === key) : undefined;

export function resolve(doc: CharacterDoc): Ctx {
  const species = find("species", doc.choices.species);
  const lineage = find("lineages", doc.choices.lineage);
  const klass = find("classes", doc.choices.class);
  const subclass = find("subclasses", doc.choices.subclass);
  const background = find("backgrounds", doc.choices.background);

  const bonus = {} as Record<AbilityKey, number>;
  for (const k of ABILITY_KEYS) bonus[k] = 0;

  const asi = doc.choices.asi;
  if (background) {
    const options = list(background, "abilityOptions") as AbilityKey[];
    if (asi.mode === "1-1-1") {
      for (const k of options) bonus[k] += 1;
    } else {
      if (asi.two) bonus[asi.two] += 2;
      if (asi.one) bonus[asi.one] += 1;
    }
  }

  const base = {} as Record<AbilityKey, number>;
  const scores = {} as Record<AbilityKey, number>;
  for (const k of ABILITY_KEYS) {
    base[k] = doc.choices.abilities.assignment[k] ?? 10;
    scores[k] = base[k] + bonus[k];
  }

  return { level: doc.level, choices: doc.choices, species, lineage, class: klass, subclass, background, base, bonus, scores };
}

/* ==========================================================================
   Expression evaluator

   Deliberately tiny. It reads `$path.to.value` out of the context and compares
   it, and that is all. It is not a scripting language and must not become one:
   the moment a ruleset can run arbitrary code, homebrew becomes a security
   problem instead of a data problem.
   ========================================================================== */

function lookup(path: string, ctx: Ctx): unknown {
  if (!path.startsWith("$")) {
    const asNumber = Number(path);
    return Number.isNaN(asNumber) ? path : asNumber;
  }
  const segments = path.slice(1).split(".");
  let value: unknown = ctx;
  for (const segment of segments) {
    if (value == null) return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

export function evalExpr(expr: string, ctx: Ctx): unknown {
  const comparison = expr.match(/^(\S+)\s*(<=|>=|==|!=|<|>)\s*(\S+)$/);
  if (comparison) {
    const a = lookup(comparison[1], ctx);
    const b = lookup(comparison[3], ctx);
    switch (comparison[2]) {
      case "<=": return Number(a) <= Number(b);
      case ">=": return Number(a) >= Number(b);
      case "<": return Number(a) < Number(b);
      case ">": return Number(a) > Number(b);
      case "==": return a === b;
      case "!=": return a !== b;
    }
  }
  return lookup(expr, ctx);
}

/* ==========================================================================
   Steps
   ========================================================================== */

export const stepVisible = (step: Step, ctx: Ctx) =>
  !step.showWhen || Boolean(evalExpr(step.showWhen, ctx));

export const visibleSteps = (ctx: Ctx) => STEPS.filter((s) => stepVisible(s, ctx));

export const titleFor = (step: Step, ctx: Ctx) => {
  if (!step.dynamicTitle) return step.title;
  const dynamic = evalExpr(step.dynamicTitle, ctx);
  return typeof dynamic === "string" && dynamic ? dynamic : step.title;
};

export function optionsFor(step: Step, ctx: Ctx): Row[] {
  if (!step.source) return [];
  const rows = CONTENT[step.source] ?? [];
  if (!step.filter) return rows;

  return rows.filter((row) =>
    Object.entries(step.filter!).every(([field, rule]) => {
      const value = row[field];

      if (rule.startsWith("in:")) {
        const target = evalExpr(rule.slice(3), ctx);
        return Array.isArray(target) && target.includes(value as string);
      }
      if (rule.startsWith("contains:")) {
        const target = evalExpr(rule.slice(9), ctx);
        return Array.isArray(value) && value.includes(target as string);
      }
      if (/^(<=|>=|==|!=|<|>)/.test(rule)) {
        const [, op, operand] = rule.match(/^(<=|>=|==|!=|<|>)\s*(\S+)$/) ?? [];
        const target = Number(evalExpr(operand, ctx));
        const n = Number(value);
        switch (op) {
          case "<=": return n <= target;
          case ">=": return n >= target;
          case "<": return n < target;
          case ">": return n > target;
          case "==": return n === target;
          case "!=": return n !== target;
        }
      }
      if (rule.startsWith("$")) return value === evalExpr(rule, ctx);
      return value === rule;
    }),
  );
}

export const countFor = (step: Step, ctx: Ctx): number =>
  typeof step.count === "string" ? Number(evalExpr(step.count, ctx) ?? 0) : (step.count ?? 0);

export function stepComplete(step: Step, ctx: Ctx): boolean {
  if (!step.required) return true;
  const choices = ctx.choices as unknown as Record<string, unknown>;
  const value = choices[step.id];

  switch (step.type) {
    case "single-select":
      return Boolean(value);
    case "multi-select":
      return Array.isArray(value) && value.length === countFor(step, ctx);
    case "ability-bonus":
      return ctx.choices.asi.mode === "1-1-1"
        || Boolean(ctx.choices.asi.two && ctx.choices.asi.one);
    case "ability-scores":
      return ABILITY_KEYS.every((k) => ctx.choices.abilities.assignment[k] != null);
    default:
      return true;
  }
}

/* ==========================================================================
   The sheet
   ========================================================================== */

export type SkillLine = {
  key: string;
  name: string;
  ability: AbilityKey;
  proficient: boolean;
  modifier: number;
};

export type SlotRow = {
  label: string;
  spellLevel: number;
  max: number;
  recovery: Recovery;
};

export type Stat = { key: string; label: string; value: string };

/** Every skill the character is proficient in, from every source. */
export function allSkills(ctx: Ctx): string[] {
  return [
    ...list(ctx.background, "skills"),
    ...ctx.choices.skills,
    ...ctx.choices.extraSkill,
  ];
}

/** Every feat, from every source. Feats change derived numbers, so this matters. */
export function allFeats(ctx: Ctx): Row[] {
  const keys = [
    str(ctx.background, "originFeat"),
    ctx.choices.fightingStyle,
    ctx.choices.extraOriginFeat,
    ctx.choices.generalFeat,
    ctx.choices.epicBoon,
  ].filter(Boolean) as string[];
  return keys.map((k) => find("feats", k)).filter(Boolean) as Row[];
}

export const hasFeat = (ctx: Ctx, key: string) => allFeats(ctx).some((f) => f.key === key);

export function skillLines(ctx: Ctx): SkillLine[] {
  const proficient = new Set(allSkills(ctx));
  return SKILLS.map((skill) => ({
    key: skill.key,
    name: skill.name,
    ability: skill.ability,
    proficient: proficient.has(skill.key),
    modifier: mod(ctx.scores[skill.ability]) + (proficient.has(skill.key) ? pb(ctx.level) : 0),
  }));
}

export function saveLines(ctx: Ctx) {
  const proficient = new Set(list(ctx.class, "saves"));
  return ABILITY_KEYS.map((key) => ({
    key,
    proficient: proficient.has(key),
    modifier: mod(ctx.scores[key]) + (proficient.has(key) ? pb(ctx.level) : 0),
  }));
}

/**
 * Spell slots for the level. Which table to read is a property of the class row,
 * never a branch on its name, and the recovery rule rides along with the slots
 * so that rests never need to know what a warlock is.
 */
export function spellSlots(ctx: Ctx): SlotRow[] {
  const klass = ctx.class;
  if (!klass || !bool(klass, "isSpellcaster")) return [];
  const level = Math.min(Math.max(ctx.level, 1), 20);

  if (bool(klass, "pactMagic")) {
    const pact = PACT_MAGIC[level - 1];
    return [{
      label: `Pact magic, level ${pact.slotLevel}`,
      spellLevel: pact.slotLevel,
      max: pact.slots,
      recovery: "short-rest",
    }];
  }

  const table = bool(klass, "halfCaster") ? HALF_CASTER_SLOTS : FULL_CASTER_SLOTS;
  return table[level - 1]
    .map((max, i) => ({
      label: `Level ${i + 1}`,
      spellLevel: i + 1,
      max,
      recovery: "long-rest" as Recovery,
    }))
    .filter((row) => row.max > 0);
}

/**
 * The derived stats. A list of rows, so adding one is adding a row, and a stat
 * that cannot be worked out yet returns null and disappears rather than showing
 * a zero that looks like an answer.
 */
export function stats(ctx: Ctx): Stat[] {
  const rows: { key: string; label: string; value: string | null }[] = [
    { key: "ac", label: "AC", value: String(10 + mod(ctx.scores.dex)) },
    {
      key: "hp",
      label: "Hit points",
      value: ctx.class
        ? String(hitPoints(ctx))
        : null,
    },
    {
      key: "init",
      label: "Initiative",
      value: fmt(mod(ctx.scores.dex) + (hasFeat(ctx, "alert") ? pb(ctx.level) : 0)),
    },
    { key: "speed", label: "Speed", value: ctx.species ? `${num(ctx.species, "speed")} ft` : null },
    { key: "pb", label: "Proficiency", value: fmt(pb(ctx.level)) },
    { key: "hitDice", label: "Hit dice", value: ctx.class ? `${ctx.level}d${num(ctx.class, "hitDie")}` : null },
    {
      key: "pp",
      label: "Passive Perception",
      value: String(10 + mod(ctx.scores.wis) + (allSkills(ctx).includes("perception") ? pb(ctx.level) : 0)),
    },
    {
      key: "dc",
      label: "Spell save DC",
      value: spellAbility(ctx)
        ? String(8 + pb(ctx.level) + mod(ctx.scores[spellAbility(ctx)!]))
        : null,
    },
    {
      key: "atk",
      label: "Spell attack",
      value: spellAbility(ctx)
        ? fmt(pb(ctx.level) + mod(ctx.scores[spellAbility(ctx)!]))
        : null,
    },
  ];
  return rows.filter((r): r is Stat => r.value != null);
}

const spellAbility = (ctx: Ctx): AbilityKey | undefined =>
  bool(ctx.class, "isSpellcaster")
    ? (str(ctx.class, "spellcastingAbility") as AbilityKey | undefined)
    : undefined;

/** Max HP: full hit die at level 1, then the average rounded up per level. */
export function hitPoints(ctx: Ctx): number {
  const die = num(ctx.class, "hitDie") ?? 8;
  const conMod = mod(ctx.scores.con);
  const perLevel = Math.floor(die / 2) + 1;
  return die + conMod + (ctx.level - 1) * (perLevel + conMod);
}
