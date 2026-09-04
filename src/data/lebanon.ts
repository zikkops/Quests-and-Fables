/**
 * Where people can play.
 *
 * Grouped by governorate because that is how Lebanon is actually addressed, and
 * because the grouping does real work in matching: a GM in Batroun and a player
 * in Tyre are not a match however well their calendars line up.
 *
 * This is a list of places a table could plausibly meet, not a gazetteer. Adding
 * a town is a data change and nothing else, which is the point. Slugs are stable
 * and go in URLs and eventually in the database, so rename the `name` freely but
 * never the `slug`.
 */

export type Area = {
  slug: string;
  name: string;
  /**
   * Live at launch. We are opening on the coastal strip between Beirut and
   * Jbeil and nowhere else — a corridor small enough that the first game masters
   * can be met in person, one at a time.
   *
   * The rest of the country stays in this file on purpose. Opening a new area is
   * flipping this flag, not adding data, and the map shows the unlit places so
   * the ambition is visible without being claimed.
   */
  live?: boolean;
};

/** Where we are open, in words. Used in copy so it is only written once. */
export const LAUNCH_CORRIDOR = "Beirut to Jbeil";

export type Governorate = {
  slug: string;
  /** Governorate name, as it appears in the picker's optgroup. */
  name: string;
  areas: Area[];
};

export const LEBANON: Governorate[] = [
  {
    slug: "beirut",
    name: "Beirut",
    areas: [
      { slug: "achrafieh", name: "Achrafieh", live: true },
      { slug: "hamra-ras-beirut", name: "Hamra & Ras Beirut", live: true },
      { slug: "gemmayzeh-mar-mikhael", name: "Gemmayzeh & Mar Mikhael", live: true },
      { slug: "badaro", name: "Badaro", live: true },
      { slug: "verdun", name: "Verdun", live: true },
      { slug: "mazraa", name: "Mazraa", live: true },
      { slug: "downtown-beirut", name: "Downtown", live: true },
    ],
  },
  {
    slug: "mount-lebanon",
    name: "Mount Lebanon",
    areas: [
      { slug: "sin-el-fil", name: "Sin el Fil", live: true },
      { slug: "jal-el-dib", name: "Jal el Dib", live: true },
      { slug: "zalka", name: "Zalka", live: true },
      { slug: "antelias", name: "Antelias", live: true },
      { slug: "dbayeh", name: "Dbayeh", live: true },
      { slug: "jounieh", name: "Jounieh", live: true },
      { slug: "kaslik-zouk", name: "Kaslik & Zouk", live: true },
      { slug: "jbeil", name: "Jbeil (Byblos)", live: true },
      { slug: "hazmieh", name: "Hazmieh" },
      { slug: "baabda", name: "Baabda" },
      { slug: "beit-mery", name: "Beit Mery" },
      { slug: "broummana", name: "Broummana" },
      { slug: "bikfaya", name: "Bikfaya" },
      { slug: "aley", name: "Aley" },
      { slug: "bhamdoun", name: "Bhamdoun" },
      { slug: "chouf", name: "Chouf & Beiteddine" },
      { slug: "damour", name: "Damour" },
    ],
  },
  {
    slug: "north",
    name: "North Lebanon",
    areas: [
      { slug: "tripoli", name: "Tripoli" },
      { slug: "batroun", name: "Batroun" },
      { slug: "chekka", name: "Chekka" },
      { slug: "amioun-koura", name: "Amioun & Koura" },
      { slug: "zgharta", name: "Zgharta" },
      { slug: "bcharre", name: "Bcharré" },
      { slug: "minieh-danniyeh", name: "Minieh & Danniyeh" },
    ],
  },
  {
    slug: "akkar",
    name: "Akkar",
    areas: [
      { slug: "halba", name: "Halba" },
      { slug: "qoubaiyat", name: "Qoubaiyat" },
    ],
  },
  {
    slug: "beqaa",
    name: "Beqaa",
    areas: [
      { slug: "zahle", name: "Zahlé" },
      { slug: "chtaura", name: "Chtaura" },
      { slug: "jib-jenine", name: "Jib Jenine & West Beqaa" },
      { slug: "rashaya", name: "Rashaya" },
    ],
  },
  {
    slug: "baalbek-hermel",
    name: "Baalbek-Hermel",
    areas: [
      { slug: "baalbek", name: "Baalbek" },
      { slug: "hermel", name: "Hermel" },
    ],
  },
  {
    slug: "south",
    name: "South Lebanon",
    areas: [
      { slug: "saida", name: "Saida (Sidon)" },
      { slug: "sour", name: "Sour (Tyre)" },
      { slug: "jezzine", name: "Jezzine" },
    ],
  },
  {
    slug: "nabatieh",
    name: "Nabatieh",
    areas: [
      { slug: "nabatieh", name: "Nabatieh" },
      { slug: "marjeyoun", name: "Marjeyoun" },
      { slug: "bint-jbeil", name: "Bint Jbeil" },
      { slug: "hasbaya", name: "Hasbaya" },
    ],
  },
];

/** Every area, flattened. Useful for validating a slug off a URL. */
export const ALL_AREAS: Area[] = LEBANON.flatMap((g) => g.areas);

/**
 * Only the governorates with somewhere open, each carrying only its live areas.
 * This is what the picker offers — choosing somewhere we cannot serve yet is a
 * worse experience than not being offered it.
 */
export const LIVE_LEBANON: Governorate[] = LEBANON.map((g) => ({
  ...g,
  areas: g.areas.filter((a) => a.live),
})).filter((g) => g.areas.length > 0);

export const LIVE_AREA_COUNT = LIVE_LEBANON.reduce(
  (total, g) => total + g.areas.length,
  0,
);

/**
 * Resolve an area slug to its name and governorate. Returns null for anything
 * unrecognised, so a hand-edited URL degrades to "no area chosen" rather than
 * rendering whatever the query string said.
 */
export function findArea(
  slug: string | undefined,
): { area: Area; governorate: Governorate } | null {
  if (!slug) return null;
  for (const governorate of LEBANON) {
    const area = governorate.areas.find((a) => a.slug === slug);
    if (area) return { area, governorate };
  }
  return null;
}

/* ==========================================================================
   Map points

   ⚠️ Currently unused. The hand-drawn SVG map these fed was replaced on
   2026-08-19 by a generated render (`public/assets/lebanon-map.webp`).

   Kept rather than deleted for one reason: these are real, hand-checked
   coordinates, and this repo is still not in version control, so a deletion is
   permanent. Delete them once `web/` is on GitHub and it costs nothing to get
   them back.
   ========================================================================== */

export type MapPoint = {
  slug: string;
  name: string;
  /** Governorate slug, so selecting an area can light up its whole region. */
  gov: string;
  lat: number;
  lng: number;
  /** Drawn larger and brighter. The places most people actually name. */
  major?: boolean;
  /** In the launch corridor. Lit on the map; everywhere else is left dark. */
  live?: boolean;
};

/**
 * Towns plotted on the map in `LebanonMap.tsx`.
 *
 * A deliberately separate list from the picker above: seven Beirut
 * neighbourhoods are seven distinct choices in a dropdown, but at map scale
 * they are one dot. So the picker lists areas and the map lists places, and the
 * two are joined by `gov`.
 *
 * Coordinates are approximate town centres — close enough to read as a map,
 * and no more precise than a decorative illustration needs.
 */
export const MAP_POINTS: MapPoint[] = [
  { slug: "beirut", name: "Beirut", gov: "beirut", lat: 33.89, lng: 35.5, major: true, live: true },

  /* The corridor. Close enough together that the glow reads as one lit strip up
     the coast, which is exactly what it is. */
  { slug: "antelias", name: "Antelias", gov: "mount-lebanon", lat: 33.91, lng: 35.59, live: true },
  { slug: "dbayeh", name: "Dbayeh", gov: "mount-lebanon", lat: 33.95, lng: 35.6, live: true },
  { slug: "kaslik-zouk", name: "Kaslik & Zouk", gov: "mount-lebanon", lat: 33.97, lng: 35.61, live: true },
  { slug: "jounieh", name: "Jounieh", gov: "mount-lebanon", lat: 33.99, lng: 35.63, live: true },
  { slug: "jbeil", name: "Jbeil", gov: "mount-lebanon", lat: 34.12, lng: 35.65, major: true, live: true },
  { slug: "bikfaya", name: "Bikfaya", gov: "mount-lebanon", lat: 33.92, lng: 35.69 },
  { slug: "broummana", name: "Broummana", gov: "mount-lebanon", lat: 33.88, lng: 35.64 },
  { slug: "baabda", name: "Baabda", gov: "mount-lebanon", lat: 33.83, lng: 35.54 },
  { slug: "aley", name: "Aley", gov: "mount-lebanon", lat: 33.81, lng: 35.6 },
  { slug: "damour", name: "Damour", gov: "mount-lebanon", lat: 33.73, lng: 35.45 },

  { slug: "tripoli", name: "Tripoli", gov: "north", lat: 34.44, lng: 35.85, major: true },
  { slug: "zgharta", name: "Zgharta", gov: "north", lat: 34.4, lng: 35.9 },
  { slug: "chekka", name: "Chekka", gov: "north", lat: 34.33, lng: 35.73 },
  { slug: "amioun", name: "Amioun", gov: "north", lat: 34.3, lng: 35.81 },
  { slug: "batroun", name: "Batroun", gov: "north", lat: 34.25, lng: 35.66 },
  { slug: "bcharre", name: "Bcharré", gov: "north", lat: 34.25, lng: 36.01 },

  { slug: "halba", name: "Halba", gov: "akkar", lat: 34.54, lng: 36.08 },
  { slug: "qoubaiyat", name: "Qoubaiyat", gov: "akkar", lat: 34.57, lng: 36.28 },

  { slug: "zahle", name: "Zahlé", gov: "beqaa", lat: 33.85, lng: 35.9, major: true },
  { slug: "chtaura", name: "Chtaura", gov: "beqaa", lat: 33.82, lng: 35.86 },
  { slug: "jib-jenine", name: "Jib Jenine", gov: "beqaa", lat: 33.63, lng: 35.78 },
  { slug: "rashaya", name: "Rashaya", gov: "beqaa", lat: 33.5, lng: 35.84 },

  { slug: "baalbek", name: "Baalbek", gov: "baalbek-hermel", lat: 34.01, lng: 36.21, major: true },
  { slug: "hermel", name: "Hermel", gov: "baalbek-hermel", lat: 34.39, lng: 36.39 },

  { slug: "saida", name: "Saida", gov: "south", lat: 33.56, lng: 35.37, major: true },
  { slug: "jezzine", name: "Jezzine", gov: "south", lat: 33.55, lng: 35.58 },
  { slug: "sour", name: "Sour", gov: "south", lat: 33.27, lng: 35.2, major: true },

  { slug: "nabatieh", name: "Nabatieh", gov: "nabatieh", lat: 33.38, lng: 35.48, major: true },
  { slug: "hasbaya", name: "Hasbaya", gov: "nabatieh", lat: 33.4, lng: 35.69 },
  { slug: "marjeyoun", name: "Marjeyoun", gov: "nabatieh", lat: 33.36, lng: 35.59 },
  { slug: "bint-jbeil", name: "Bint Jbeil", gov: "nabatieh", lat: 33.12, lng: 35.43 },
];

/**
 * A simplified outline of the country, as (lat, lng) pairs running clockwise
 * from the northern end of the coast.
 *
 * ⚠️ Stylised, not surveyed. It is smoothed down to a few dozen points so it
 * reads at 300px wide, and it is decoration rather than a statement about where
 * any border runs. If this ever needs to be authoritative, replace it with real
 * GeoJSON rather than nudging these numbers.
 */
export const LEBANON_OUTLINE: [number, number][] = [
  [34.63, 35.98],
  [34.53, 35.9],
  [34.44, 35.78],
  [34.35, 35.7],
  [34.29, 35.66],
  [34.2, 35.64],
  [34.12, 35.63],
  [34.0, 35.62],
  [33.96, 35.58],
  [33.9, 35.51],
  [33.9, 35.44],
  [33.83, 35.47],
  [33.72, 35.43],
  [33.56, 35.36],
  [33.45, 35.29],
  [33.34, 35.23],
  [33.27, 35.19],
  [33.11, 35.11],
  [33.09, 35.25],
  [33.1, 35.36],
  [33.2, 35.48],
  [33.24, 35.57],
  [33.29, 35.63],
  [33.4, 35.78],
  [33.5, 35.88],
  [33.66, 36.0],
  [33.82, 36.08],
  [33.92, 36.2],
  [34.02, 36.31],
  [34.16, 36.4],
  [34.3, 36.52],
  [34.42, 36.62],
  [34.55, 36.48],
  [34.63, 36.32],
  [34.69, 36.2],
  [34.66, 36.08],
];

/* Projection bounds. Longitude is squashed by cos(latitude) so the country
   keeps its real proportions instead of looking fat. */
const MIN_LNG = 35.05;
const MAX_LNG = 36.7;
const MIN_LAT = 33.02;
const MAX_LAT = 34.72;
const LNG_SCALE = 100 * Math.cos((33.87 * Math.PI) / 180);
const LAT_SCALE = 100;

export const MAP_WIDTH = Number(((MAX_LNG - MIN_LNG) * LNG_SCALE).toFixed(2));
export const MAP_HEIGHT = Number(((MAX_LAT - MIN_LAT) * LAT_SCALE).toFixed(2));

/** Equirectangular projection into the SVG viewBox above. */
export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: Number(((lng - MIN_LNG) * LNG_SCALE).toFixed(2)),
    y: Number(((MAX_LAT - lat) * LAT_SCALE).toFixed(2)),
  };
}

/**
 * Where a session may be held.
 *
 * House calls were added 2026-08-19, replacing a public-venues-only rule. The
 * game master travels to the party — so the person walking into a stranger's
 * space is the verified one, not the customer, which is the right way round.
 *
 * Every player's accepted venue types are a **hard filter** in matching. Someone
 * who will not host and will not travel to a home is never shown a home game,
 * and never has to explain why.
 */
export const VENUE_TYPES = [
  { slug: "house-call", name: "Your place, on demand" },
  { slug: "game-shop", name: "Game shop" },
  { slug: "cafe", name: "Café" },
  { slug: "library", name: "Library or community space" },
  { slug: "campus", name: "Campus" },
] as const;
