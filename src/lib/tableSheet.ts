import type { ResolvedSheet } from "./character";
import type { Ability, Character } from "@/data/table";

/**
 * A character, as the table sees it.
 *
 * The builder produces a `ResolvedSheet` and the tracker wants a `Character`.
 * They are the same person described for two different jobs: one is everything
 * about them, the other is only what changes during a session.
 *
 * **This is a snapshot, taken on purpose.** What a player brings to a table is
 * fixed at the moment they bring it, and editing a character in the builder
 * afterwards does not quietly change the sheet five other people are looking
 * at mid-session. Bringing it again is how you update it, and that is a
 * deliberate act rather than a sync.
 */
export function toTableCharacter(id: string, sheet: ResolvedSheet): Character {
  const abilities = Object.fromEntries(
    sheet.abilities.map((line) => [line.key, line.score]),
  ) as Record<Ability, number>;

  return {
    id,
    name: sheet.name,
    build: sheet.build,
    hpMax: sheet.maxHitPoints,
    hp: sheet.maxHitPoints,
    ac: sheet.armorClass,
    abilities,
    proficiency: sheet.proficiencyBonus,
    skills: sheet.skills.filter((skill) => skill.proficient).map((skill) => skill.name),
    saves: sheet.saves.filter((save) => save.proficient).map((save) => save.key),
    slots: sheet.slots.map((slot) => ({
      level: slot.spellLevel,
      total: slot.max,
      /*
         The ruleset has four recoveries (short-rest, long-rest, dawn, never)
         and the tracker has two. That is not a lossy mapping in practice: only
         spell slots reach here, and a spell slot in this ruleset comes back on
         a short rest or a long one. Dawn and never belong to class resources,
         which players add by hand and which never travel through this function.
      */
      recovery: slot.recovery === "short-rest" ? "short" : "long",
    })),
    /* A sheet arrives at the table healthy and unencumbered. Whatever happened
       last session belongs to the session log, not to the character. */
    conditions: [],
    exhaustion: 0,
  };
}
