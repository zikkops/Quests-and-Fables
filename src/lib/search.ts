/**
 * The notebook's search, as plain functions over plain data.
 *
 * Firestore has no full-text search, and paying per document read on every
 * keystroke would be the worst of both worlds. So the whole campaign is loaded
 * once and indexed in the browser: a year of weekly play is roughly 1,500 notes
 * at three hundred bytes, which is under half a megabyte and builds an index in
 * a couple of milliseconds. It also means search keeps working with no network,
 * which matters more here than it would elsewhere.
 *
 * Nothing in this file knows about React or Firestore, which is the point: the
 * index is the interesting part and it should be readable on its own.
 */

export type Indexed = {
  id: string;
  /** Everything worth matching on, already joined: body, author, tags. */
  text: string;
};

export type Hit = {
  id: string;
  /** Higher is better. Exact whole-word matches beat prefixes. */
  score: number;
};

/**
 * Fold a string down to something two people spelling the same name differently
 * will still agree on: lowercase, accents stripped, punctuation gone.
 *
 * The accent folding is not decoration. Half the places in this country are
 * written three ways in English, and a party will happily record "Jbeil" one
 * week and "Jbeïl" the next.
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * The same folding, guaranteed not to change the length of the string.
 *
 * `fold` normalises to NFD, which turns one accented character into two, and
 * highlighting maps positions in the folded copy straight back onto the
 * original. One is for matching, this one is for pointing at things.
 */
function alignedFold(value: string): string {
  let out = "";

  for (const ch of value) {
    let mapped = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (mapped.length !== ch.length) mapped = ch.toLowerCase();
    if (mapped.length !== ch.length) mapped = ch;
    out += mapped;
  }

  return out;
}

/** Words, as the index counts them. Two characters or more, apostrophes kept. */
export function terms(value: string): string[] {
  return fold(value)
    .split(/[^a-z0-9']+/)
    .filter((word) => word.length > 1);
}

export type Index = {
  /** term -> the notes containing it */
  exact: Map<string, Set<string>>;
  /** Every distinct term, for prefix matching and the glossary. */
  vocabulary: string[];
};

export function buildIndex(entries: Indexed[]): Index {
  const exact = new Map<string, Set<string>>();

  for (const entry of entries) {
    for (const term of terms(entry.text)) {
      let bucket = exact.get(term);
      if (!bucket) {
        bucket = new Set();
        exact.set(term, bucket);
      }
      bucket.add(entry.id);
    }
  }

  return { exact, vocabulary: [...exact.keys()].sort() };
}

/**
 * Search, with prefix matching so "ced" finds "cedar" while you are still
 * typing. A note matching every word in the query beats one matching some of
 * them, which is why the score is accumulated per query word rather than per
 * match: five mentions of one word should not outrank both words appearing.
 */
export function search(index: Index, query: string): Hit[] {
  const words = terms(query);
  if (words.length === 0) return [];

  const scores = new Map<string, number>();
  const add = (id: string, points: number) =>
    scores.set(id, (scores.get(id) ?? 0) + points);

  for (const word of words) {
    const seen = new Set<string>();

    for (const id of index.exact.get(word) ?? []) {
      add(id, 4);
      seen.add(id);
    }

    /* Prefixes are worth less than the whole word, and a note that already
       matched exactly does not get paid twice for the same query word. */
    for (const term of index.vocabulary) {
      if (term.length <= word.length || !term.startsWith(word)) continue;
      for (const id of index.exact.get(term) ?? []) {
        if (!seen.has(id)) {
          add(id, 1);
          seen.add(id);
        }
      }
    }
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * The terms this campaign keeps coming back to.
 *
 * Deliberately not proper-noun extraction: six players spell an invented name
 * six ways, and a glossary that is wrong is worse than no glossary. This is the
 * boring, honest version — words that recur across several notes, minus the
 * ones every piece of English contains.
 *
 * `exclude` is for the terms that recur because of how the index is built
 * rather than because of what the table wrote. Author names are the whole of
 * it: every note has one, so they outrank every real term and tell you nothing.
 */
const COMMON = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "was", "were",
  "had", "has", "have", "not", "but", "you", "your", "our", "his", "her",
  "she", "they", "them", "him", "who", "what", "when", "where", "why", "how",
  "all", "one", "two", "out", "off", "back", "down", "over", "then", "than",
  "there", "here", "said", "says", "asked", "told", "took", "went", "got",
  "are", "any", "can", "did", "does", "just", "like", "made", "make", "more",
  "much", "now", "only", "same", "still", "some", "very", "will", "would",
  "which", "that", "into", "onto", "about", "after", "before", "because",
  "been", "being", "does", "done", "each", "every", "from", "them", "then",
  "these", "those", "through", "under", "until", "what", "with", "without",
]);

export function glossary(index: Index, atLeast = 3, exclude?: Set<string>): string[] {
  return index.vocabulary
    .filter((term) => !COMMON.has(term) && !exclude?.has(term) && term.length > 3)
    .filter((term) => (index.exact.get(term)?.size ?? 0) >= atLeast)
    .sort((a, b) => (index.exact.get(b)?.size ?? 0) - (index.exact.get(a)?.size ?? 0));
}

/**
 * Split a line into matched and unmatched pieces, so a result can show why it
 * is a result. Returns runs rather than HTML: the component decides what a
 * highlight looks like, and nothing here has to be trusted with markup.
 */
export function highlight(body: string, query: string): { text: string; hit: boolean }[] {
  const words = terms(query);
  if (words.length === 0) return [{ text: body, hit: false }];

  const folded = alignedFold(body);
  const marks: boolean[] = new Array(body.length).fill(false);

  for (const word of words) {
    let at = folded.indexOf(word);
    while (at !== -1) {
      /* Only from a word boundary, so "ale" does not light up "tale". */
      const before = at === 0 ? " " : folded[at - 1];
      if (/[^a-z0-9']/.test(before)) {
        let end = at + word.length;
        while (end < folded.length && /[a-z0-9']/.test(folded[end])) end += 1;
        for (let i = at; i < end; i += 1) marks[i] = true;
      }
      at = folded.indexOf(word, at + 1);
    }
  }

  const runs: { text: string; hit: boolean }[] = [];
  let start = 0;

  for (let i = 1; i <= body.length; i += 1) {
    if (i === body.length || marks[i] !== marks[start]) {
      runs.push({ text: body.slice(start, i), hit: marks[start] });
      start = i;
    }
  }

  return runs;
}
