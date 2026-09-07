"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LIVE_LEBANON } from "@/data/lebanon";
import { updateProfile } from "@/lib/firebase/account";
import { useSession } from "@/lib/firebase/session";
import {
  DEFAULT_VENUES,
  EXPERIENCE,
  STYLE_AXES,
  STYLE_MAX,
  STYLE_STEPS,
  type ExperienceKey,
  type PlayStyle,
  type StyleAxis,
  LIMIT_TOPICS,
  phoneProblem,
  VENUES,
  type AreaSlug,
  type LimitKey,
  type Limits,
  type Venues,
  type Week,
} from "@/lib/firebase/schema";
import Characters from "./Characters";
import Verify, { useStanding } from "./Verify";
import WeekGrid from "./WeekGrid";
import styles from "./Account.module.css";
import home from "./AccountHome.module.css";

/**
 * Everything a player can change about themselves, which is everything except
 * their name.
 *
 * Three cards, three saves. They could have been one form with one button, and
 * that would have been worse: the details are typed, the play areas are picked
 * and the week is tapped, and mixing them means every small change costs a
 * round trip through all three. Each card knows whether it is dirty and says so
 * on its own button.
 */
export default function AccountHome() {
  const { user, profile, loading, configured, refresh, leave } = useSession();
  const router = useRouter();
  const where = useStanding();

  useEffect(() => {
    if (loading || !configured) return;
    if (!user) router.replace("/sign-in");
    else if (!profile) router.replace("/account/setup");
  }, [loading, configured, user, profile, router]);

  if (!configured) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Accounts are not switched on yet</h2>
        <p className={styles.cardBody}>
          Every screen here is built and waiting on a Firebase project. Until its
          keys are in the environment there is no account to show, and the parts
          of the site that never needed one carry on as they are.
        </p>
      </section>
    );
  }

  if (loading || !user || !profile) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>One moment</h2>
        <p className={styles.cardBody}>Looking up your account.</p>
      </section>
    );
  }

  /*
    Past seven days with an unconfirmed address, this is the whole page. Not a
    banner over a working account: there is nothing worth doing here until the
    address is proven, and the rules would refuse every write anyway. Showing
    the forms and letting each save fail one at a time would be worse.
  */
  if (where?.state === "held") {
    return (
      <>
        <section className={`${styles.card} ${styles.wide}`}>
          <div className={home.identity}>
            <div>
              <p className={styles.label}>Signed in as</p>
              <p className={home.username}>{profile.username}</p>
            </div>
            <button type="button" className={styles.secondary} onClick={() => leave()}>
              Sign out
            </button>
          </div>
        </section>

        <Verify where={where} />
      </>
    );
  }

  return (
    <>
      {where ? <Verify where={where} /> : null}

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={home.identity}>
          <div>
            <p className={styles.label}>Signed in as</p>
            <p className={home.username}>{profile.username}</p>
          </div>
          <button type="button" className={styles.secondary} onClick={() => leave()}>
            Sign out
          </button>
        </div>
        <p className={styles.fine}>
          Your username is the only thing here another player will ever see. The
          people running Quests &amp; Fables can see your number and the area you
          live in, because a party cannot be put together by somebody who cannot
          see who is waiting. Nobody else can, and your game master gets your
          number only once you have a seat.
        </p>
      </section>

      {/*
        The way to the game master's own page.

        Nothing anywhere linked to /gm. A recruited game master signed in,
        landed here, and had no route to the one surface built for them short
        of typing the URL: it was orphaned in the route map. Game masters are
        the scarce side this whole product courts, which makes it the worst
        page to leave unreachable.

        Only shown to somebody an admin has marked. `gm` is set with the admin
        console and refused to everybody else by the rules, so this is a link,
        not a claim.
      */}
      {profile.gm ? (
        <section className={`${styles.card} ${styles.wide}`}>
          <h2 className={styles.cardTitle}>You run tables</h2>
          <p className={styles.cardBody}>
            The parties you have been given, the nights they are playing, and
            the notebook for each one.
          </p>
          <Link href="/gm" className={styles.primary}>
            Your tables
          </Link>
        </section>
      ) : null}

      <Details
        uid={user.uid}
        email={profile.email}
        phone={profile.phone}
        area={profile.area}
        onSaved={refresh}
      />

      <PlayAreas uid={user.uid} chosen={profile.playAreas} onSaved={refresh} />

      <Availability uid={user.uid} week={profile.week} onSaved={refresh} />

      <HowYouPlay
        uid={user.uid}
        style={profile.style}
        experience={profile.experience}
        onSaved={refresh}
      />

      <Safety
        uid={user.uid}
        venues={profile.venues}
        limits={profile.limits}
        onSaved={refresh}
      />

      <Characters uid={user.uid} count={profile.characterCount} onChanged={refresh} />
    </>
  );
}

/* ==========================================================================
   The three editable slices
   ========================================================================== */

/**
 * How you like to play, and how much you have played.
 *
 * The only section here that is **preference and not safety**, which is why it
 * is the only one that can be left alone: venue and limits keep you out of a
 * table, taste only decides the order tables are shown in. Saying nothing is a
 * real answer, and `match.ts` treats an unanswered question as neutral rather
 * than middling, so skipping it does not quietly push somebody down every list.
 *
 * Three independent sliders rather than a budget to divide between them.
 * Somebody who wants a lot of everything is describing a real table.
 */
function HowYouPlay({
  uid,
  style: initialStyle,
  experience: initialExperience,
  onSaved,
}: {
  uid: string;
  style?: PlayStyle;
  experience?: ExperienceKey;
  onSaved: () => Promise<void>;
}) {
  const [style, setStyle] = useState<PlayStyle | undefined>(initialStyle);
  const [experience, setExperience] = useState<ExperienceKey | undefined>(initialExperience);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    JSON.stringify(style ?? null) !== JSON.stringify(initialStyle ?? null)
    || experience !== initialExperience;

  const set = (axis: StyleAxis, value: number) =>
    setStyle((current) => ({
      combat: current?.combat ?? 2,
      roleplay: current?.roleplay ?? 2,
      exploration: current?.exploration ?? 2,
      [axis]: value,
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await updateProfile(uid, { style, experience });
      setSaved(true);
      await onSaved();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${styles.card} ${styles.wide}`} onSubmit={submit}>
      <h2 className={styles.cardTitle}>How you like to play</h2>
      <p className={styles.cardBody}>
        This one is a preference, not a rule. It nudges the order tables are
        shown in and nothing else: it will never keep you out of a table, and
        leaving it alone costs you nothing.
      </p>

      <div className={home.styleAxes}>
        {STYLE_AXES.map((axis) => {
          const value = style?.[axis.key] ?? 2;
          return (
            <label key={axis.key} className={home.styleAxis}>
              <span className={styles.label}>{axis.label}</span>
              <span className={styles.fine}>{axis.hint}</span>
              <input
                type="range"
                min={0}
                max={STYLE_MAX}
                step={1}
                value={value}
                className={home.slider}
                onChange={(event) => set(axis.key, Number(event.target.value))}
              />
              <span className={home.styleValue}>
                {style ? STYLE_STEPS[value] : "Not said"}
              </span>
            </label>
          );
        })}
      </div>

      <p className={styles.label}>How much have you played?</p>
      <div className={home.chips}>
        {EXPERIENCE.map((one) => (
          <button
            key={one.key}
            type="button"
            aria-pressed={experience === one.key}
            className={experience === one.key ? home.chipOn : home.chip}
            onClick={() => setExperience(experience === one.key ? undefined : one.key)}
          >
            {one.label}
          </button>
        ))}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      <Save dirty={dirty} busy={busy} saved={saved} />
    </form>
  );
}

/** A save button that knows whether there is anything to save. */
function Save({ dirty, busy, saved }: { dirty: boolean; busy: boolean; saved: boolean }) {
  return (
    <button type="submit" className={styles.primary} disabled={!dirty || busy}>
      {busy ? "Saving…" : saved && !dirty ? "Saved" : "Save changes"}
    </button>
  );
}

function Details({
  uid,
  email: initialEmail,
  phone: initialPhone,
  area: initialArea,
  onSaved,
}: {
  uid: string;
  email: string;
  phone: string;
  area: AreaSlug;
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [area, setArea] = useState(initialArea);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issue = phone ? phoneProblem(phone) : "A number, please.";
  const dirty = email !== initialEmail || phone !== initialPhone || area !== initialArea;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (issue) {
      setError(issue);
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await updateProfile(uid, { email, phone, area });
      await onSaved();
      setSaved(true);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${styles.card} ${styles.wide}`} onSubmit={submit}>
      <h2 className={styles.cardTitle}>Your details</h2>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            type="email"
            className={styles.input}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <span className={styles.hint}>
            Where we reach you. Sign-in links still go to the address you first
            signed in with.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Phone · private</span>
          <input
            type="tel"
            className={styles.input}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            required
          />
          <span className={styles.hint}>
            {phone && issue
              ? issue
              : "Seen by us, and by your game master once you have a seat. Never by another player."}
          </span>
        </label>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Where you are · private</span>
        <select
          className={styles.select}
          value={area}
          onChange={(event) => setArea(event.target.value)}
        >
          {LIVE_LEBANON.map((governorate) => (
            <optgroup key={governorate.slug} label={governorate.name}>
              {governorate.areas.map((one) => (
                <option key={one.slug} value={one.slug}>
                  {one.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {error ? <p className={styles.error}>{error}</p> : null}

      <Save dirty={dirty} busy={busy} saved={saved} />
    </form>
  );
}

function PlayAreas({
  uid,
  chosen,
  onSaved,
}: {
  uid: string;
  chosen: AreaSlug[];
  onSaved: () => Promise<void>;
}) {
  const [picked, setPicked] = useState<AreaSlug[]>(chosen);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    picked.length !== chosen.length || picked.some((slug) => !chosen.includes(slug));

  const flip = (slug: AreaSlug) =>
    setPicked((current) =>
      current.includes(slug) ? current.filter((one) => one !== slug) : [...current, slug],
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (picked.length === 0) {
      setError("Pick at least one, or there is nowhere to match you to.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await updateProfile(uid, { playAreas: picked });
      await onSaved();
      setSaved(true);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${styles.card} ${styles.wide}`} onSubmit={submit}>
      <h2 className={styles.cardTitle}>Where you can play</h2>
      <p className={styles.cardBody}>
        Not where you live, but where you are willing to turn up on a weeknight.
        Pick as many as are honest: every one of them is somewhere a table could
        be waiting.
      </p>

      <div className={home.areas}>
        {LIVE_LEBANON.map((governorate) => (
          <fieldset key={governorate.slug} className={home.group}>
            <legend className={home.legend}>{governorate.name}</legend>
            <div className={home.chips}>
              {governorate.areas.map((one) => {
                const on = picked.includes(one.slug);
                return (
                  <label
                    key={one.slug}
                    className={on ? `${home.chip} ${home.chipOn}` : home.chip}
                  >
                    <input
                      type="checkbox"
                      className={home.tick}
                      checked={on}
                      onChange={() => flip(one.slug)}
                    />
                    {one.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <Save dirty={dirty} busy={busy} saved={saved} />
    </form>
  );
}

function Availability({
  uid,
  week: initialWeek,
  onSaved,
}: {
  uid: string;
  week: Week;
  onSaved: () => Promise<void>;
}) {
  const [week, setWeek] = useState<Week>(initialWeek);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = week.join("") !== initialWeek.join("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await updateProfile(uid, { week });
      await onSaved();
      setSaved(true);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${styles.card} ${styles.wide}`} onSubmit={submit}>
      <h2 className={styles.cardTitle}>When you can play</h2>
      <p className={styles.cardBody}>
        The one thing a table cannot be built without. Mark the blocks you could
        actually be at a table, not the ones you are technically free in.
      </p>

      <WeekGrid week={week} onChange={setWeek} />

      {error ? <p className={styles.error}>{error}</p> : null}

      <Save dirty={dirty} busy={busy} saved={saved} />
    </form>
  );
}

/**
 * The two things that are safety data before they are preferences.
 *
 * `/safety` promises venue type is a hard filter and that a table conflicting
 * with your limits is never shown to you. Both promises are kept in
 * `src/lib/match.ts`, and this is where the data they read comes from. A player
 * who never opens this card is public venues only with nothing marked, which is
 * the safest answer rather than the emptiest one.
 */
function Safety({
  uid,
  venues: initialVenues,
  limits: initialLimits,
  onSaved,
}: {
  uid: string;
  venues: Venues;
  limits: Limits;
  onSaved: () => Promise<void>;
}) {
  const [venues, setVenues] = useState<Venues>(initialVenues ?? DEFAULT_VENUES);
  const [limits, setLimits] = useState<Limits>(initialLimits ?? {});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    JSON.stringify(venues) !== JSON.stringify(initialVenues ?? DEFAULT_VENUES)
    || JSON.stringify(limits) !== JSON.stringify(initialLimits ?? {});

  const nowhere = !venues.public && !venues.guest && !venues.host;

  const setLimit = (topic: LimitKey, level: "veil" | "line" | null) =>
    setLimits((current) => {
      const next = { ...current };
      if (level === null) delete next[topic];
      else next[topic] = level;
      return next;
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (nowhere) {
      setError("Say yes to at least one kind of room, or no table can be offered to you.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await updateProfile(uid, { venues, limits });
      await onSaved();
      setSaved(true);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${styles.card} ${styles.wide}`} onSubmit={submit}>
      <h2 className={styles.cardTitle}>Where you will sit, and what you will not play</h2>
      <p className={styles.cardBody}>
        Both of these are filters, not preferences. A table that meets somewhere
        you have not agreed to is never offered to you, and neither is one that
        expects something you have ruled out. You will not have to raise it at
        the table, because you will never be at that table.
      </p>

      <fieldset className={home.group}>
        <legend className={home.legend}>Rooms you will play in</legend>

        <div className={home.venues}>
          {VENUES.map((venue) => (
            <label
              key={venue.key}
              className={venues[venue.key] ? `${home.venue} ${home.venueOn}` : home.venue}
            >
              <input
                type="checkbox"
                className={home.tick}
                checked={venues[venue.key]}
                onChange={() =>
                  setVenues((current) => ({ ...current, [venue.key]: !current[venue.key] }))
                }
              />
              <span className={home.venueLabel}>{venue.label}</span>
              <span className={home.venueHint}>{venue.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={home.group}>
        <legend className={home.legend}>Lines and veils</legend>
        <p className={styles.hint}>
          A <strong>line</strong> does not happen at your table. A{" "}
          <strong>veil</strong> happens off-screen: the scene cuts away and the
          story carries on. Anything you leave alone is fine.
        </p>

        <ul className={home.limits}>
          {LIMIT_TOPICS.map((topic) => {
            const level = limits[topic.key] ?? null;

            return (
              <li key={topic.key} className={home.limitRow}>
                <span className={home.limitName}>{topic.label}</span>

                <span className={home.levels} role="group" aria-label={topic.label}>
                  {([null, "veil", "line"] as const).map((option) => (
                    <button
                      key={option ?? "fine"}
                      type="button"
                      aria-pressed={level === option}
                      className={
                        level === option ? `${home.level} ${home.levelOn}` : home.level
                      }
                      data-level={option ?? "fine"}
                      onClick={() => setLimit(topic.key, option)}
                    >
                      {option === null ? "Fine" : option === "veil" ? "Veil" : "Line"}
                    </button>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {error ? <p className={styles.error}>{error}</p> : null}

      <Save dirty={dirty} busy={busy} saved={saved} />
    </form>
  );
}
