import { ABILITIES, ABILITY_KEYS, META, SKILLS, type AbilityKey, type Recovery } from "./rules";
import {
  allSkills,
  fmt,
  mod,
  pb,
  resolve,
  saveLines,
  skillLines,
  spellSlots,
  stats,
  hitPoints,
  type CharacterDoc,
  type Ctx,
  type SkillLine,
  type SlotRow,
  type Stat,
} from "./engine";

/* ==========================================================================
   The resolved sheet

   **This is the contract.** A character built from the SRD and a character typed
   in by hand both resolve to this exact shape, and everything downstream reads
   only this. That is what lets the tracker, the game master's dashboard, rests
   and conditions work identically for both without ever asking which kind it is.

   If you find yourself adding `isCustom` to a condition anywhere below the
   sheet, something has gone wrong here instead.
   ========================================================================== */

export type ResourceRow = {
  key: string;
  label: string;
  max: number;
  recovery: Recovery;
};

export type AbilityLine = {
  key: AbilityKey;
  name: string;
  score: number;
  modifier: number;
};

export type SaveLine = {
  key: AbilityKey;
  name: string;
  proficient: boolean;
  modifier: number;
};

export type ResolvedSheet = {
  name: string;
  /** "Fighter 4", or whatever a custom sheet calls itself. */
  build: string;
  isCustom: boolean;
  level: number;
  maxHitPoints: number;
  armorClass: number;
  speed: string;
  hitDice: string;
  proficiencyBonus: number;
  passivePerception: number;
  stats: Stat[];
  abilities: AbilityLine[];
  saves: SaveLine[];
  skills: SkillLine[];
  slots: SlotRow[];
  resources: ResourceRow[];
};

const abilityName = (key: AbilityKey) => ABILITIES.find((a) => a.key === key)?.name ?? key;

/* ==========================================================================
   Built from the SRD
   ========================================================================== */

export const blankCharacter = (): CharacterDoc => ({
  schemaVersion: 1,
  rulesetId: META.rulesetId,
  rulesetVersion: META.version,
  level: 1,
  choices: {
    asi: { mode: "2-1" },
    abilities: { method: "standard-array", assignment: {} },
    skills: [],
    extraSkill: [],
    details: {},
  },
});

export function sheetFromBuild(doc: CharacterDoc): ResolvedSheet {
  const ctx: Ctx = resolve(doc);
  const className = typeof ctx.class?.name === "string" ? ctx.class.name : "";

  return {
    name: doc.choices.details.name?.trim() || "Unnamed",
    build: className ? `${className} ${doc.level}` : `Level ${doc.level}`,
    isCustom: false,
    level: doc.level,
    maxHitPoints: ctx.class ? hitPoints(ctx) : 0,
    armorClass: 10 + mod(ctx.scores.dex),
    speed: ctx.species ? `${ctx.species.speed} ft` : "",
    hitDice: ctx.class ? `${doc.level}d${ctx.class.hitDie}` : "",
    proficiencyBonus: pb(doc.level),
    passivePerception:
      10 + mod(ctx.scores.wis) + (allSkills(ctx).includes("perception") ? pb(doc.level) : 0),
    stats: stats(ctx),
    abilities: ABILITY_KEYS.map((key) => ({
      key,
      name: abilityName(key),
      score: ctx.scores[key],
      modifier: mod(ctx.scores[key]),
    })),
    saves: saveLines(ctx).map((s) => ({ ...s, name: abilityName(s.key) })),
    skills: skillLines(ctx),
    slots: spellSlots(ctx),
    /* Class resources (rage, ki, channel divinity) are not in the SRD dataset as
       tables, and inventing them unverified would be worse than leaving them out.
       Players add what they need by hand, exactly as on a custom sheet. */
    resources: [],
  };
}

/* ==========================================================================
   Typed in by hand

   Deliberately unvalidated beyond the obviously impossible. The whole point is
   that the rules here are not ours.
   ========================================================================== */

export type CustomCharacter = {
  schemaVersion: 1;
  isCustom: true;
  name: string;
  build: string;
  level: number;
  maxHitPoints: number;
  armorClass: number;
  speed: string;
  hitDice: string;
  proficiencyBonus: number;
  abilities: Record<AbilityKey, number>;
  saveProficiencies: AbilityKey[];
  skillProficiencies: string[];
  slots: { spellLevel: number; max: number; recovery: Recovery }[];
  resources: ResourceRow[];
  notes: string;
};

export const blankCustom = (): CustomCharacter => ({
  schemaVersion: 1,
  isCustom: true,
  name: "",
  build: "",
  level: 1,
  maxHitPoints: 10,
  armorClass: 10,
  speed: "30 ft",
  hitDice: "1d8",
  proficiencyBonus: 2,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  saveProficiencies: [],
  skillProficiencies: [],
  slots: [],
  resources: [],
  notes: "",
});

export function sheetFromCustom(c: CustomCharacter): ResolvedSheet {
  const proficientSkills = new Set(c.skillProficiencies);
  const proficientSaves = new Set(c.saveProficiencies);
  const abilityMod = (key: AbilityKey) => mod(c.abilities[key]);

  const skills: SkillLine[] = SKILLS.map((skill) => ({
    key: skill.key,
    name: skill.name,
    ability: skill.ability,
    proficient: proficientSkills.has(skill.key),
    modifier:
      abilityMod(skill.ability) + (proficientSkills.has(skill.key) ? c.proficiencyBonus : 0),
  }));

  const passivePerception =
    10 + abilityMod("wis") + (proficientSkills.has("perception") ? c.proficiencyBonus : 0);

  const statRows: Stat[] = [
    { key: "ac", label: "AC", value: String(c.armorClass) },
    { key: "hp", label: "Hit points", value: String(c.maxHitPoints) },
    { key: "init", label: "Initiative", value: fmt(abilityMod("dex")) },
    { key: "speed", label: "Speed", value: c.speed || "—" },
    { key: "pb", label: "Proficiency", value: fmt(c.proficiencyBonus) },
    { key: "hitDice", label: "Hit dice", value: c.hitDice || "—" },
    { key: "pp", label: "Passive Perception", value: String(passivePerception) },
  ].filter((r) => r.value !== "—");

  return {
    name: c.name.trim() || "Unnamed",
    build: c.build.trim() || `Level ${c.level}`,
    isCustom: true,
    level: c.level,
    maxHitPoints: c.maxHitPoints,
    armorClass: c.armorClass,
    speed: c.speed,
    hitDice: c.hitDice,
    proficiencyBonus: c.proficiencyBonus,
    passivePerception,
    stats: statRows,
    abilities: ABILITY_KEYS.map((key) => ({
      key,
      name: abilityName(key),
      score: c.abilities[key],
      modifier: abilityMod(key),
    })),
    saves: ABILITY_KEYS.map((key) => ({
      key,
      name: abilityName(key),
      proficient: proficientSaves.has(key),
      modifier: abilityMod(key) + (proficientSaves.has(key) ? c.proficiencyBonus : 0),
    })),
    skills,
    slots: c.slots
      .filter((s) => s.max > 0)
      .map((s) => ({
        label: `Level ${s.spellLevel}`,
        spellLevel: s.spellLevel,
        max: s.max,
        recovery: s.recovery,
      })),
    resources: c.resources,
  };
}

/* ==========================================================================
   Storage

   localStorage until Supabase lands. Building a character has never needed an
   account and never will, so there has to be somewhere to keep one meanwhile.
   ========================================================================== */

const KEY_BUILD = "qf:character:v1";
const KEY_CUSTOM = "qf:custom:v1";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    /* Corrupt or unavailable storage must never take the page down with it. */
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing, or a full quota. Losing the draft beats crashing. */
  }
}

export const loadCharacter = () => read<CharacterDoc>(KEY_BUILD);
export const saveCharacter = (doc: CharacterDoc) => write(KEY_BUILD, doc);
export const loadCustom = () => read<CustomCharacter>(KEY_CUSTOM);
export const saveCustom = (c: CustomCharacter) => write(KEY_CUSTOM, c);
