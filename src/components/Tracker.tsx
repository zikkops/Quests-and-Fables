"use client";

import { useMemo, useReducer, useState } from "react";
import {
  ABILITIES,
  CONDITIONS,
  PARTY,
  SKILLS,
  initiative,
  passivePerception,
  saveMod,
  signed,
  skillMod,
  type Character,
} from "@/data/table";
import styles from "./Tracker.module.css";

/**
 * The tracker, small enough to sit on a homepage and real enough to poke.
 *
 * It used to be a picture of a dashboard. A picture cannot show the one thing
 * worth showing, which is how little work it is: spend a slot, drop a
 * condition on somebody, call a long rest and watch four sheets refill at once.
 * So it is a working reducer over four made up characters, and every rule it
 * obeys is the rule the real tracker will obey.
 *
 * Three of those rules matter more than the rest.
 *
 * **Nothing asks what class anyone is.** A short rest gives back the slots
 * whose `recovery` says "short", which happens to be the warlock's, and no line
 * of this file knows the word warlock. README rule 11, in the smallest possible
 * space.
 *
 * **Exhaustion is a level, not a flag.** It is the condition every table
 * forgets, so it counts up on repeated presses and a long rest takes one off.
 *
 * **No dice.** Modifiers are shown so you can roll your own. The moment this
 * demo rolls something it is telling a lie about what the product is.
 */

type Live = {
  hp: number;
  /** The buffer. Damage eats it first and healing never puts it back. */
  temp: number;
  /** Spent slots per level, so a pip can be given back by clicking it again. */
  spent: Record<number, number>;
  conditions: string[];
  exhaustion: number;
};

type State = { party: Record<string, Live>; said: string };

type Action =
  | { type: "hp"; id: string; by: number }
  | { type: "temp"; id: string; by: number }
  | { type: "slot"; id: string; level: number; spend: boolean }
  | { type: "condition"; id: string; condition: string }
  | { type: "exhaustion"; id: string }
  | { type: "revive"; id: string }
  | { type: "rest"; long: boolean }
  | { type: "reset" };

/**
 * Where a table starts.
 *
 * Built from whatever characters it was handed rather than from a constant,
 * because this component now runs twice over: four made up adventurers on the
 * homepage, and a real party's nominated sheets on `/campaign/[id]`. Neither
 * copy knows which it is.
 */
const startFrom = (party: Character[]): State => ({
  party: Object.fromEntries(
    party.map((character) => [
      character.id,
      {
        hp: character.hp,
        temp: 0,
        spent: Object.fromEntries(character.slots.map((slot) => [slot.level, 0])),
        conditions: [...character.conditions],
        exhaustion: character.exhaustion,
      },
    ]),
  ),
  said:
    party.length === 1
      ? "One sheet, live. Everything here is yours to change."
      : `${party.length} sheets, live. Everything here is yours to change.`,
});

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/**
 * The reducer, closed over the characters it is reducing.
 *
 * A factory rather than a constant because the sheets are now an argument.
 * Everything inside is unchanged: the rules never depended on which four
 * people were at the table, which is why this refactor is a wrapper rather
 * than a rewrite.
 */
function makeReducer(partySheets: Character[]) {
  const find = (id: string) =>
    partySheets.find((character) => character.id === id) as Character;
  const START = startFrom(partySheets);

  return function reducer(state: State, action: Action): State {
  const edit = (id: string, change: (live: Live, sheet: Character) => Live, said: string): State => ({
    party: { ...state.party, [id]: change(state.party[id], find(id)) },
    said,
  });

  switch (action.type) {
    case "hp": {
      const sheet = find(action.id);
      const live = state.party[action.id];

      /* Dead is dead. A potion is not the answer and neither is a long rest. */
      if (live.hp <= -sheet.hpMax) {
        return { ...state, said: `${sheet.name} is dead. That needs more than a potion.` };
      }

      /*
        Down to zero is unconscious, and the count keeps going into the negative
        because the number that matters next is how far past zero the damage
        went. At minus their own maximum they are gone, which is the massive
        damage rule and the reason the floor is -hpMax rather than 0.

        Healing starts again from zero, not from wherever the negative got to. A
        cure wounds on somebody at -6 does not spend six of itself climbing back
        to zero first.
      */
      /* Damage goes through the temporary hit points first and only what is
         left over reaches the real ones. Healing never touches them. */
      const soaked = action.by < 0 ? Math.min(live.temp, -action.by) : 0;
      const temp = live.temp - soaked;
      const through = action.by < 0 ? action.by + soaked : action.by;

      const hp =
        through < 0
          ? Math.max(live.hp + through, -sheet.hpMax)
          : Math.min(Math.max(live.hp, 0) + through, sheet.hpMax);

      const said =
        hp <= -sheet.hpMax
          ? `${sheet.name} is dead. Damage past their own maximum.`
          : hp <= 0 && live.hp > 0
            ? `${sheet.name} drops. Unconscious at ${hp}.`
            : hp > 0 && live.hp <= 0
              ? `${sheet.name} is up again on ${hp}.`
              : soaked > 0 && through === 0
                ? `${sheet.name}'s temporary hit points take all ${soaked} of it.`
                : soaked > 0
                  ? `${soaked} off the temporary, ${-through} off ${sheet.name}.`
                  : action.by < 0
                    ? `${sheet.name} takes ${-action.by}.`
                    : `${sheet.name} heals ${action.by}.`;

      return edit(action.id, () => ({ ...live, hp, temp }), said);
    }

    case "temp": {
      /*
        Temporary hit points do not stack: you keep the better offer. Taking
        eight when you are already sitting on ten does nothing at all, which
        surprises tables often enough to be worth saying out loud.
      */
      const sheet = find(action.id);
      const live = state.party[action.id];
      const kept = Math.max(live.temp, action.by);

      return edit(
        action.id,
        () => ({ ...live, temp: kept }),
        kept === live.temp && action.by > 0
          ? `${sheet.name} already has ${live.temp} temporary. They do not stack, so the ${action.by} is dropped.`
          : `${sheet.name} takes ${action.by} temporary hit points.`,
      );
    }

    case "revive": {
      /* Straight back on one hit point, which is where every raise dead in the
         book puts you. Not full, and not where they were. */
      const sheet = find(action.id);
      const live = state.party[action.id];
      return edit(
        action.id,
        () => ({ ...live, hp: 1 }),
        `${sheet.name} is back, on one hit point. Somebody owes a diamond.`,
      );
    }

    case "slot": {
      const sheet = find(action.id);
      const slot = sheet.slots.find((candidate) => candidate.level === action.level);
      if (!slot) return state;
      const live = state.party[action.id];
      const spent = clamp(live.spent[action.level] + (action.spend ? 1 : -1), slot.total);
      return edit(
        action.id,
        () => ({ ...live, spent: { ...live.spent, [action.level]: spent } }),
        action.spend
          ? `${sheet.name} casts with a level ${action.level} slot.`
          : `${sheet.name} takes a level ${action.level} slot back.`,
      );
    }

    case "condition": {
      const sheet = find(action.id);
      const live = state.party[action.id];
      const had = live.conditions.includes(action.condition);
      return edit(
        action.id,
        () => ({
          ...live,
          conditions: had
            ? live.conditions.filter((condition) => condition !== action.condition)
            : [...live.conditions, action.condition],
        }),
        had
          ? `${action.condition} lifted from ${sheet.name}.`
          : `${sheet.name} is ${action.condition.toLowerCase()}.`,
      );
    }

    case "exhaustion": {
      const sheet = find(action.id);
      const live = state.party[action.id];
      const exhaustion = clamp(live.exhaustion + 1, 6);
      return edit(
        action.id,
        () => ({ ...live, exhaustion }),
        `${sheet.name} is at exhaustion ${exhaustion}.`,
      );
    }

    case "rest": {
      /*
        The whole party at once, and the only thing that decides what comes back
        is the recovery on each slot. A short rest returns the short ones and
        takes nothing else off; a long rest returns everything, fills the hit
        points and lifts one level of exhaustion.
      */
      let anyDead = false;

      const party = Object.fromEntries(
        partySheets.map((sheet) => {
          const live = state.party[sheet.id];
          const dead = live.hp <= -sheet.hpMax;
          if (dead) anyDead = true;

          const spent = { ...live.spent };
          for (const slot of sheet.slots) {
            if (action.long || slot.recovery === "short") spent[slot.level] = 0;
          }

          /* A long rest fills everyone who is still alive. It does not raise the
             dead, and pretending otherwise would be the tracker telling a lie
             about the game it is tracking. */
          return [
            sheet.id,
            action.long && !dead
              ? {
                  hp: sheet.hpMax,
                  /* Temporary hit points last until they are used or you finish
                     a long rest, so this is where they go. */
                  temp: 0,
                  spent,
                  conditions: live.conditions,
                  exhaustion: clamp(live.exhaustion - 1, 6),
                }
              : { ...live, spent },
          ];
        }),
      );

      return {
        party,
        said: action.long
          ? `Long rest. Hit points full, every slot back, one level of exhaustion gone.${
              anyDead ? " The dead stay dead." : ""
            }`
          : "Short rest. Only the slots that come back on a short rest did.",
      };
    }

    case "reset":
      return START;

    default:
      return state;
  }
  };
}

/**
 * The tracker itself: four sheets, every control on them live.
 *
 * Lifted out of the homepage section it was written in, because it earns its
 * place twice. On the homepage it is the argument, wrapped in a heading that
 * says what it is. On `/campaign` it is the page. Neither copy of it knows
 * where it is being rendered, which is the point of the split.
 */
export default function Tracker({ party = PARTY }: { party?: Character[] }) {
  const reducer = useMemo(() => makeReducer(party), [party]);
  const [state, dispatch] = useReducer(reducer, party, startFrom);
  const [picking, setPicking] = useState<string | null>(null);
  /* How much the next press is worth, per character. Input, not sheet state,
     so it never belongs in the reducer. */
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  return (
        <div className={styles.demo}>
          <div className={styles.bar}>
            <p className={styles.demoLabel}>A game master&rsquo;s view</p>

            <div className={styles.controls}>
              <button
                type="button"
                className={styles.rest}
                onClick={() => dispatch({ type: "rest", long: false })}
              >
                Short rest
              </button>
              <button
                type="button"
                className={styles.restLong}
                onClick={() => dispatch({ type: "rest", long: true })}
              >
                Long rest
              </button>
              <button
                type="button"
                className={styles.reset}
                onClick={() => dispatch({ type: "reset" })}
              >
                Reset
              </button>
            </div>
          </div>

          <p className={styles.said} aria-live="polite">
            {state.said}
          </p>

          <div className={styles.cards}>
            {party.map((sheet) => {
              const live = state.party[sheet.id];
              const pct = Math.max(0, Math.round((live.hp / sheet.hpMax) * 100));
              const low = pct <= 25;

              /*
                The bar carries the shield as well as the health.

                It is scaled to whichever is bigger, the hit point maximum or
                what they are actually standing behind, so a full sheet with
                temporary hit points on top reads as a full bar with a gold cap
                rather than a green bar that has mysteriously shrunk. With no
                temporary hit points the scale is the maximum and nothing about
                the bar changes.
              */
              const shielded = Math.max(0, live.hp) + live.temp;
              const scale = Math.max(sheet.hpMax, shielded);
              const hpWidth = (Math.max(0, live.hp) / scale) * 100;
              const tempWidth = (live.temp / scale) * 100;
              const dead = live.hp <= -sheet.hpMax;
              const down = live.hp <= 0 && !dead;
              const amount = amounts[sheet.id] ?? 5;

              return (
                <article
                  key={sheet.id}
                  data-character={sheet.id}
                  className={dead ? `${styles.card} ${styles.dead}` : styles.card}
                >
                  {dead ? (
                    <div className={styles.deadMark}>
                      <p className={styles.deadWord} aria-hidden="true">
                        Dead
                      </p>
                      <button
                        type="button"
                        className={styles.revive}
                        onClick={() => dispatch({ type: "revive", id: sheet.id })}
                        aria-label={`Revive ${sheet.name}`}
                      >
                        Revive
                      </button>
                    </div>
                  ) : null}
                  {/*
                    A fieldset, so death disables every control on the sheet in
                    one attribute and disables it properly. Greying the card out
                    is not the same as making it unusable: a keyboard would have
                    tabbed straight into the buttons behind the banner, and a
                    pointer would have reached them the moment the banner did not
                    cover them exactly.
                  */}
                  <fieldset className={styles.body} disabled={dead}>
                  <header className={styles.cardHead}>
                    <p className={styles.name}>{sheet.name}</p>
                    <p className={styles.build}>{sheet.build}</p>
                  </header>

                  <div className={styles.hpRow}>
                    <p className={styles.hpNumbers}>
                      <span className={low ? styles.hpLow : styles.hp}>{live.hp}</span>
                      <span className={styles.hpMax}>/ {sheet.hpMax}</span>
                      {live.temp > 0 ? (
                        <span
                          className={styles.temp}
                          title="Temporary hit points. Damage takes these first."
                        >
                          +{live.temp}
                        </span>
                      ) : null}
                    </p>
                    {/*
                      The amount is typed, because damage is never five. The
                      buttons either side of it apply it as damage or as healing,
                      which keeps the whole control to three small things in a
                      card this narrow.
                    */}
                    <div className={styles.hpButtons}>
                      <button
                        type="button"
                        className={styles.step}
                        onClick={() => dispatch({ type: "hp", id: sheet.id, by: -amount })}
                        aria-label={`Take ${amount} off ${sheet.name}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={amount}
                        className={styles.amount}
                        aria-label={`How much to take off or give back to ${sheet.name}`}
                        onChange={(event) =>
                          setAmounts({
                            ...amounts,
                            [sheet.id]: clamp(Number(event.target.value) || 0, 999),
                          })
                        }
                      />
                      <button
                        type="button"
                        className={styles.step}
                        onClick={() => dispatch({ type: "hp", id: sheet.id, by: amount })}
                        aria-label={`Give ${sheet.name} back ${amount}`}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className={styles.stepTemp}
                        onClick={() => dispatch({ type: "temp", id: sheet.id, by: amount })}
                        aria-label={`Give ${sheet.name} ${amount} temporary hit points`}
                      >
                        T
                      </button>
                    </div>
                  </div>

                  <div className={styles.track}>
                    <span
                      className={low ? styles.fillLow : styles.fill}
                      style={{ width: `${hpWidth}%` }}
                    />
                    {live.temp > 0 ? (
                      <span className={styles.fillTemp} style={{ width: `${tempWidth}%` }} />
                    ) : null}
                  </div>

                  <dl className={styles.stats}>
                    <div className={styles.stat}>
                      <dt>AC</dt>
                      <dd>{sheet.ac}</dd>
                    </div>
                    <div className={styles.stat}>
                      <dt>Init</dt>
                      <dd>{signed(initiative(sheet))}</dd>
                    </div>
                    <div className={styles.stat}>
                      <dt>Passive</dt>
                      <dd>{passivePerception(sheet)}</dd>
                    </div>
                  </dl>

                  {/*
                    All eighteen skills and all six saves, folded away, and the
                    proficient ones are marked rather than listed separately.
                    Showing three at the top as well was showing the same numbers
                    twice and making the card taller for it, and it implied the
                    other fifteen were unavailable. They are not: nobody is
                    proficient in Nature until the night the answer is in a tree.

                    <details> rather than state, because it is the one widget the
                    browser already knows how to open with a keyboard.
                  */}
                  <details className={styles.more}>
                    <summary className={styles.moreSummary}>All skills and saves</summary>

                    <div className={styles.moreBody}>
                      <p className={styles.moreHeading}>Saving throws</p>
                      {/*
                        Each save is a labelled box rather than a row, because a
                        row of "Str +1 Dex +0 Con +2" puts more space between a
                        label and its own number than between one pair and the
                        next, and the eye pairs them wrongly. This was reported
                        as two missing saves, which is exactly what it looked
                        like.
                      */}
                      <ul className={styles.saves}>
                        {ABILITIES.map((ability) => (
                          <li
                            key={ability.key}
                            className={
                              sheet.saves.includes(ability.key) ? styles.saveOn : styles.save
                            }
                          >
                            <span className={styles.saveLabel}>{ability.label}</span>
                            <span className={styles.saveMod}>
                              {signed(saveMod(sheet, ability.key))}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <p className={styles.moreHeading}>Skills</p>
                      <ul className={styles.allSkills}>
                        {SKILLS.map((skill) => {
                          const proficient = sheet.skills.includes(skill.name);
                          return (
                            <li
                              key={skill.name}
                              className={proficient ? styles.skillOn : styles.skill}
                            >
                              <span>
                                <span
                                  className={proficient ? styles.dotOn : styles.dot}
                                  aria-hidden="true"
                                />
                                {skill.name}
                              </span>
                              <span className={styles.mod}>
                                {signed(skillMod(sheet, skill.name))}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </details>

                  {sheet.slots.length > 0 ? (
                    <div className={styles.slots}>
                      {sheet.slots.map((slot) => {
                        const spent = live.spent[slot.level];
                        return (
                          <div key={slot.level} className={styles.slotRow}>
                            <span className={styles.slotLevel}>
                              {slot.level}
                              {slot.recovery === "short" ? (
                                <span className={styles.short} title="Comes back on a short rest">
                                  ↻
                                </span>
                              ) : null}
                            </span>
                            <span className={styles.pips}>
                              {Array.from({ length: slot.total }, (_, i) => {
                                const open = i < slot.total - spent;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    className={open ? styles.pip : styles.pipSpent}
                                    aria-label={
                                      open
                                        ? `Spend a level ${slot.level} slot for ${sheet.name}`
                                        : `Give ${sheet.name} back a level ${slot.level} slot`
                                    }
                                    onClick={() =>
                                      dispatch({
                                        type: "slot",
                                        id: sheet.id,
                                        level: slot.level,
                                        spend: open,
                                      })
                                    }
                                  />
                                );
                              })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={styles.noSlots}>No spell slots</p>
                  )}

                  <div className={styles.conditions}>
                    {/* Derived, not stored: it is true whenever the number says
                        it is, so it cannot fall out of step with the number. */}
                    {down ? <span className={styles.down}>Unconscious</span> : null}

                    {live.exhaustion > 0 ? (
                      <button
                        type="button"
                        className={styles.exhaustion}
                        onClick={() => dispatch({ type: "exhaustion", id: sheet.id })}
                        aria-label={`${sheet.name} is at exhaustion ${live.exhaustion}. Add a level.`}
                      >
                        Exhaustion {live.exhaustion}
                      </button>
                    ) : null}

                    {live.conditions.map((condition) => (
                      <button
                        key={condition}
                        type="button"
                        className={styles.condition}
                        onClick={() => dispatch({ type: "condition", id: sheet.id, condition })}
                        aria-label={`Lift ${condition} from ${sheet.name}`}
                      >
                        {condition}
                        <span aria-hidden="true"> ×</span>
                      </button>
                    ))}

                    <button
                      type="button"
                      className={styles.add}
                      aria-expanded={picking === sheet.id}
                      onClick={() => setPicking(picking === sheet.id ? null : sheet.id)}
                    >
                      + Condition
                    </button>
                  </div>

                  {picking === sheet.id ? (
                    <div className={styles.picker}>
                      {CONDITIONS.map((condition) => (
                        <button
                          key={condition}
                          type="button"
                          className={
                            live.conditions.includes(condition) ? styles.pickOn : styles.pick
                          }
                          onClick={() => dispatch({ type: "condition", id: sheet.id, condition })}
                        >
                          {condition}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={styles.pick}
                        onClick={() => dispatch({ type: "exhaustion", id: sheet.id })}
                      >
                        Exhaustion +1
                      </button>
                    </div>
                  ) : null}
                  </fieldset>
                </article>
              );
            })}
          </div>
        </div>
  );
}
