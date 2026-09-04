import SRD from "@/data/srd-5.2.1-content.json";

/**
 * The ruleset: what can be chosen, in what order, and what the numbers work out
 * to. Ported from the prototype engine in the vault's `Resources/`.
 *
 * **The rule this file exists to protect:** nothing downstream may contain
 * `if (class === "wizard")`. Steps are rows, derived stats are rows, and adding a
 * class, a subclass or a whole other game system is a change here and nowhere
 * else. The moment a component branches on a class key, this design is gone.
 *
 * Deliberately out of scope for now (Mark, 2026-08-19): equipment, and choosing
 * individual spells. Spell *slots* are in, because the tracker needs them.
 */

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

/** Every content row carries these. `source` and `license` are a licence obligation. */
export type Row = {
  key: string;
  name: string;
  source?: string;
  license?: string;
  [field: string]: unknown;
};

export type ContentKey =
  | "species"
  | "lineages"
  | "classes"
  | "subclasses"
  | "backgrounds"
  | "skills"
  | "feats";

export const CONTENT: Record<ContentKey, Row[]> = {
  species: SRD.species as Row[],
  lineages: SRD.lineages as Row[],
  classes: SRD.classes as Row[],
  subclasses: SRD.subclasses as Row[],
  backgrounds: SRD.backgrounds as Row[],
  skills: SRD.skills as Row[],
  feats: SRD.feats as Row[],
};

export const ABILITIES = SRD.abilities as { key: AbilityKey; name: string; blurb: string }[];
export const SKILLS = SRD.skills as { key: string; name: string; ability: AbilityKey }[];
export const META = SRD._meta;

/* ==========================================================================
   Steps
   ========================================================================== */

export type StepType =
  | "single-select"
  | "multi-select"
  | "ability-bonus"
  | "ability-scores"
  | "text-group";

export type TextField = {
  key: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
};

export type Step = {
  id: string;
  title: string;
  type: StepType;
  required: boolean;
  help?: string;
  source?: ContentKey;
  /** Field to expression, e.g. { classKey: "$class.key" }. See `engine.ts`. */
  filter?: Record<string, string>;
  showWhen?: string;
  dynamicTitle?: string;
  /** A number, or an expression resolving to one. */
  count?: number | string;
  standardArray?: number[];
  pointBuy?: { budget: number; min: number; max: number; costs: Record<string, number> };
  fields?: TextField[];
};

export const STEPS: Step[] = [
  {
    id: "species",
    title: "Species",
    type: "single-select",
    source: "species",
    required: true,
    help:
      "Where your character comes from. Species give you traits, but not ability "
      + "bonuses. Those come from your background.",
  },
  {
    id: "lineage",
    title: "Lineage",
    type: "single-select",
    source: "lineages",
    required: true,
    help: "Your species' specific heritage.",
    filter: { speciesKey: "$species.key" },
    showWhen: "$species.hasLineage",
    dynamicTitle: "$species.lineageLabel",
  },
  {
    id: "class",
    title: "Class",
    type: "single-select",
    source: "classes",
    required: true,
    help: "The big one. Your class decides what you actually do in play.",
  },
  {
    id: "subclass",
    title: "Subclass",
    type: "single-select",
    source: "subclasses",
    required: true,
    help: "Your specialisation. Every class picks one at level 3.",
    filter: { classKey: "$class.key" },
    showWhen: "$class.subclassLevel <= $level",
  },
  {
    id: "background",
    title: "Background",
    type: "single-select",
    source: "backgrounds",
    required: true,
    help:
      "What you did before adventuring. This is where your ability bonuses and "
      + "your first feat come from.",
  },
  {
    id: "asi",
    title: "Background ability bonuses",
    type: "ability-bonus",
    required: true,
    help:
      "Your background gives +2 and +1 to two of its three abilities, or +1 to "
      + "all three.",
    showWhen: "$background.key",
  },
  {
    id: "abilities",
    title: "Ability scores",
    type: "ability-scores",
    required: true,
    help: "Six numbers describing what your character is naturally good at.",
    standardArray: [15, 14, 13, 12, 10, 8],
    pointBuy: {
      budget: 27,
      min: 8,
      max: 15,
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
    },
  },
  {
    id: "skills",
    title: "Skill proficiencies",
    type: "multi-select",
    source: "skills",
    required: true,
    help:
      "Chosen from your class list. Your background gives you two more "
      + "automatically.",
    filter: { key: "in:$class.skillChoices" },
    count: "$class.skillCount",
  },
  {
    id: "extraSkill",
    title: "Bonus skill",
    type: "multi-select",
    source: "skills",
    required: true,
    help: "Humans get one extra skill proficiency, of any kind.",
    count: 1,
    showWhen: "$species.grantsExtraSkill",
  },
  {
    id: "fightingStyle",
    title: "Fighting style",
    type: "single-select",
    source: "feats",
    required: true,
    help: "Fighters, paladins and rangers pick a combat specialisation.",
    filter: { category: "fighting-style" },
    showWhen: "$class.fightingStyle",
  },
  {
    id: "extraOriginFeat",
    title: "Bonus origin feat",
    type: "single-select",
    source: "feats",
    required: true,
    help: "Humans get a second origin feat on top of the one from their background.",
    filter: { category: "origin" },
    showWhen: "$species.grantsExtraOriginFeat",
  },
  {
    id: "generalFeat",
    title: "General feat",
    type: "single-select",
    source: "feats",
    required: true,
    help:
      "From level 4 you take a general feat instead of, or as well as, an "
      + "ability score increase.",
    filter: { category: "general", minLevel: "<= $level" },
    showWhen: "$level >= 4",
  },
  {
    id: "epicBoon",
    title: "Epic boon",
    type: "single-select",
    source: "feats",
    required: true,
    help: "At level 19 you gain a boon of near-divine power.",
    filter: { category: "epic-boon" },
    showWhen: "$level >= 19",
  },
  {
    id: "details",
    title: "Who are they?",
    type: "text-group",
    required: false,
    help: "The part that makes it your character. Nothing here is required.",
    fields: [
      { key: "name", label: "Name", placeholder: "Thora Ironhelm" },
      { key: "pronouns", label: "Pronouns", placeholder: "they/them" },
      {
        key: "personality",
        label: "Personality",
        multiline: true,
        placeholder: "Blunt, loyal, allergic to ceremony.",
      },
      {
        key: "backstory",
        label: "Backstory",
        multiline: true,
        placeholder: "Left the mountain hold after...",
      },
    ],
  },
];

/* ==========================================================================
   Spell slots

   Tables, not prose: these are the SRD progressions, and a table of numbers is
   fact-shaped. Recovery lives on the row rather than in code, which is what
   lets warlock pact magic come back on a short rest without a single line
   anywhere asking whether someone is a warlock.
   ========================================================================== */

export type Recovery = "short-rest" | "long-rest" | "dawn" | "never";

/** Index 0 is level 1. Each entry is slots for spell levels 1 to 9. */
export const FULL_CASTER_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export const HALF_CASTER_SLOTS: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
];

/** Pact magic: a number of slots, all at one level, back on a short rest. */
export const PACT_MAGIC: { slots: number; slotLevel: number }[] = [
  { slots: 1, slotLevel: 1 },
  { slots: 2, slotLevel: 1 },
  { slots: 2, slotLevel: 2 },
  { slots: 2, slotLevel: 2 },
  { slots: 2, slotLevel: 3 },
  { slots: 2, slotLevel: 3 },
  { slots: 2, slotLevel: 4 },
  { slots: 2, slotLevel: 4 },
  { slots: 2, slotLevel: 5 },
  { slots: 2, slotLevel: 5 },
  { slots: 3, slotLevel: 5 },
  { slots: 3, slotLevel: 5 },
  { slots: 3, slotLevel: 5 },
  { slots: 3, slotLevel: 5 },
  { slots: 3, slotLevel: 5 },
  { slots: 3, slotLevel: 5 },
  { slots: 4, slotLevel: 5 },
  { slots: 4, slotLevel: 5 },
  { slots: 4, slotLevel: 5 },
  { slots: 4, slotLevel: 5 },
];
