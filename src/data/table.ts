/**
 * The party in the homepage tracker.
 *
 * An illustration, not live data, and deliberately not wired to the character
 * builder: this runs before anyone has an account, so it is four made up people
 * in a plain object. Names are generic on purpose. Nothing here should read as
 * somebody's actual character.
 *
 * **Ability scores in, everything else out.** Skill and save modifiers, passive
 * perception and initiative are all derived rather than typed in, for the same
 * reason `engine.ts` derives them on a real sheet: two numbers that are meant to
 * agree will eventually stop agreeing if a person has to keep them in step by
 * hand. The only things stated outright are the ones that genuinely come from
 * somewhere else, like armour class.
 *
 * **Recovery is a field on the slot, never a class check.** Vess is a warlock
 * and her slots come back on a short rest; everyone else waits for a long one.
 * Nothing in the component asks what class anyone is, it reads `recovery` and
 * does as it is told, which is README rule 11 in miniature. If a reducer there
 * ever grows an `if (build === ...)` the demo has started lying about how the
 * real tracker works.
 */
export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITIES: { key: Ability; label: string }[] = [
  { key: "str", label: "Str" },
  { key: "dex", label: "Dex" },
  { key: "con", label: "Con" },
  { key: "int", label: "Int" },
  { key: "wis", label: "Wis" },
  { key: "cha", label: "Cha" },
];

/** The eighteen SRD skills, in the order a sheet lists them: by ability. */
export const SKILLS: { name: string; ability: Ability }[] = [
  { name: "Athletics", ability: "str" },
  { name: "Acrobatics", ability: "dex" },
  { name: "Sleight of Hand", ability: "dex" },
  { name: "Stealth", ability: "dex" },
  { name: "Arcana", ability: "int" },
  { name: "History", ability: "int" },
  { name: "Investigation", ability: "int" },
  { name: "Nature", ability: "int" },
  { name: "Religion", ability: "int" },
  { name: "Animal Handling", ability: "wis" },
  { name: "Insight", ability: "wis" },
  { name: "Medicine", ability: "wis" },
  { name: "Perception", ability: "wis" },
  { name: "Survival", ability: "wis" },
  { name: "Deception", ability: "cha" },
  { name: "Intimidation", ability: "cha" },
  { name: "Performance", ability: "cha" },
  { name: "Persuasion", ability: "cha" },
];

export type Slot = {
  level: number;
  total: number;
  recovery: "short" | "long";
};

export type Character = {
  id: string;
  name: string;
  build: string;
  hpMax: number;
  /** Where the sheet starts, so a reset has somewhere honest to go back to. */
  hp: number;
  /** Stated, not derived: it comes from armour, and this demo has no inventory. */
  ac: number;
  abilities: Record<Ability, number>;
  proficiency: number;
  /** Proficient skills, by name. Everything else is the bare ability modifier. */
  skills: string[];
  saves: Ability[];
  slots: Slot[];
  conditions: string[];
  exhaustion: number;
};

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

export const skillMod = (sheet: Character, name: string) => {
  const skill = SKILLS.find((candidate) => candidate.name === name);
  if (!skill) return 0;
  return (
    abilityMod(sheet.abilities[skill.ability])
    + (sheet.skills.includes(name) ? sheet.proficiency : 0)
  );
};

export const saveMod = (sheet: Character, ability: Ability) =>
  abilityMod(sheet.abilities[ability])
  + (sheet.saves.includes(ability) ? sheet.proficiency : 0);

/** The number a game master asks for without asking anybody to roll. */
export const passivePerception = (sheet: Character) => 10 + skillMod(sheet, "Perception");

export const initiative = (sheet: Character) => abilityMod(sheet.abilities.dex);

export const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

/**
 * The conditions worth having on a homepage. SRD 5.2.1 has more, and the real
 * tracker will carry all of them, but these are the ones a table actually says
 * out loud in a session.
 */
export const CONDITIONS = [
  "Blinded",
  "Charmed",
  "Frightened",
  "Grappled",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
] as const;

export const PARTY: Character[] = [
  {
    id: "ilvara",
    name: "Ilvara",
    build: "Cleric 4",
    hpMax: 31,
    hp: 22,
    ac: 18,
    abilities: { str: 12, dex: 10, con: 14, int: 12, wis: 18, cha: 12 },
    proficiency: 2,
    skills: ["Insight", "Medicine", "Religion"],
    saves: ["wis", "cha"],
    slots: [
      { level: 1, total: 4, recovery: "long" },
      { level: 2, total: 3, recovery: "long" },
    ],
    conditions: ["Frightened"],
    exhaustion: 0,
  },
  {
    id: "bram",
    name: "Bram",
    build: "Fighter 4",
    hpMax: 38,
    hp: 38,
    ac: 17,
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 12 },
    proficiency: 2,
    skills: ["Athletics", "Intimidation", "Survival"],
    saves: ["str", "con"],
    slots: [],
    conditions: [],
    exhaustion: 0,
  },
  {
    id: "sena",
    name: "Sena",
    build: "Wizard 4",
    hpMax: 26,
    hp: 5,
    ac: 12,
    abilities: { str: 8, dex: 16, con: 12, int: 18, wis: 12, cha: 10 },
    proficiency: 2,
    skills: ["Arcana", "History", "Perception"],
    saves: ["int", "wis"],
    slots: [
      { level: 1, total: 4, recovery: "long" },
      { level: 2, total: 3, recovery: "long" },
    ],
    conditions: ["Prone", "Poisoned"],
    exhaustion: 1,
  },
  {
    id: "vess",
    name: "Vess",
    build: "Warlock 4",
    hpMax: 28,
    hp: 24,
    ac: 15,
    abilities: { str: 10, dex: 12, con: 14, int: 12, wis: 10, cha: 18 },
    proficiency: 2,
    skills: ["Deception", "Arcana", "Persuasion"],
    saves: ["wis", "cha"],
    /* Two slots, both back after a short rest. This is the whole reason the
       warlock is at this table. */
    slots: [{ level: 2, total: 2, recovery: "short" }],
    conditions: [],
    exhaustion: 0,
  },
];
