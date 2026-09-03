/**
 * THE DASHBOARD'S DERIVATIONS — the pure half of `App.tsx`.
 *
 * Everything here is a plain function over plain data: no React, no DOM, no
 * fetch. That is the point. The cockpit's honesty rules (a link that is off
 * moves nothing; a bar's intent names the field it actually picked; a silence
 * is never a zero) are the kind of thing that has to be TESTED, and a rule
 * that lives inside a render function cannot be. `tests/derive.test.ts` reads
 * this file; `App.tsx` calls it and does the drawing.
 *
 * Four laws live here:
 *
 *   1. `emitIntent` — the words a commit is filed under name the field the
 *      GESTURE was on, read off the emission itself. A hard-coded "pick
 *      disease" survives a re-encode and files a false cause.
 *   2. `pickedFrom` / `arrivesFrom` — a clause reaches a view only through the
 *      LINK GRAPH. Reading `state.selections` directly is reading a clause the
 *      person may have switched off — the log then says the link is off while
 *      the view moves anyway.
 *   3. `categoryCounts` — one pass over the rows, whatever the number of bars.
 *      A pass per bar is O(categories × rows): 70 jurisdictions over 90,300
 *      cells is 6.3 million comparisons on every selection change.
 *   4. `columnVocabulary` — the categories a column offers, counted once and
 *      CAPPED, because a column with 900 distinct values is not a bar chart
 *      and pretending otherwise costs ~766 ms per keystroke of interaction.
 *
 * Plus one small resolver, `bookmarkCommitId`, for a note's link to a named bookmark.
 */
import type { BookmarkView, RenderSelection, SelectionClauseView } from 'vizfootprint-ui';

/** A row of either demo table, as the wire carries it. */
export type Row = Readonly<Record<string, string | number | null | undefined>>;

/** One bar: a category and how many rows carry it. */
export interface CategoryCount {
  readonly category: string;
  readonly count: number;
}

// ── 1 · the words an act is filed under ─────────────────────────────────────

/**
 * The minimum an intent needs to know about a gesture: the field it landed
 * on — or, for a compound cell emission, the PAIR of fields it landed on.
 */
export interface FieldEmission {
  readonly encoding: { readonly field?: string; readonly fields?: readonly [string, string] };
}

/**
 * The intent for a chart gesture: the verb, and the field the emission is
 * ACTUALLY on. Re-encode the disease bar to jurisdictions and a click files
 * "pick jurisdiction" — never the "pick disease" somebody typed at build time
 * for an act that picked Texas.
 *
 * An emission that names no field at all leaves the verb alone rather than
 * inventing a subject: the library then writes its own honest sentence.
 */
export function emitIntent(verb: string, emission: FieldEmission): string {
  const { field, fields } = emission.encoding;
  if (field !== undefined) return `${verb} ${field}`;
  if (fields !== undefined) return `${verb} ${fields[0]} and ${fields[1]}`;
  return verb;
}

// ── 2 · what actually reaches a view ────────────────────────────────────────

/**
 * Does this clause reach the consumer as a FILTER? The link graph already
 * decided whether it arrives at all (`selectionForView` drops a `none` edge
 * and an absent one); this is the same rule `keepPredicate` folds by, so a
 * value the host reads by hand narrows exactly what the predicate narrows —
 * no more, and never when the link is off.
 */
function filtersHere(clause: SelectionClauseView | undefined): clause is SelectionClauseView {
  return clause !== undefined && (clause.response === undefined || clause.response === 'filter');
}

/**
 * The value a source view's POINT clause carries into this consumer, or
 * `fallback`. The clause must be on `field`: re-encode the disease bar to
 * jurisdictions and its clause names a STATE — reading that as a disease
 * would put "California" everywhere.
 */
export function pickedFrom(selection: RenderSelection, sourceViewId: string, field: string, fallback: string): string {
  const clause = selection.clauses.get(sourceViewId);
  if (!filtersHere(clause) || clause.kind !== 'point' || clause.field !== field) return fallback;
  return typeof clause.value === 'string' ? clause.value : fallback;
}

/** True when ANY of these source views lands a live, filtering clause on this consumer. */
export function arrivesFrom(selection: RenderSelection, sourceViewIds: readonly string[]): boolean {
  return sourceViewIds.some((id) => {
    const clause = selection.clauses.get(id);
    return filtersHere(clause) && clause.value !== null && clause.value !== undefined;
  });
}

// ── 3 · the bars, in one pass ───────────────────────────────────────────────

/**
 * How many kept rows carry each value of `field` — ONE pass over the rows,
 * whatever the number of bars.
 *
 * With `categories` given (a DECLARED vocabulary), those are the bars and
 * their order, and a declared category nobody reported still gets its zero —
 * the declaration says the category exists. Without one, the bars are the
 * values the data actually carries, in first-seen order. A null is an absence,
 * not a category: it never gets a bar (that would read as a value the data
 * never reported).
 */
export function categoryCounts(
  rows: readonly Row[],
  field: string,
  keep: (row: Row) => boolean,
  categories?: readonly string[],
): readonly CategoryCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined) continue;
    if (!keep(row)) continue;
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (categories === undefined) return [...counts.entries()].map(([category, count]) => ({ category, count }));
  return categories.map((category) => ({ category, count: counts.get(category) ?? 0 }));
}

/**
 * The same one pass, summing a numeric column instead of counting rows. A row
 * whose measure is absent is SKIPPED, never counted as zero — and a category
 * with no present row gets no entry at all, so the caller can leave the bar
 * out (a missing bar is a silence; a zero bar would be a lie).
 */
export function categorySums(
  rows: readonly Row[],
  field: string,
  measure: string,
  keep: (row: Row) => boolean,
): ReadonlyMap<string, number> {
  const sums = new Map<string, number>();
  for (const row of rows) {
    const value = row[measure];
    if (typeof value !== 'number') continue;
    const category = row[field];
    if (category === null || category === undefined) continue;
    if (!keep(row)) continue;
    const key = String(category);
    sums.set(key, (sums.get(key) ?? 0) + value);
  }
  return sums;
}

// ── 4 · a column's vocabulary, counted once and capped ──────────────────────

/** How many bars a categorical axis will draw before the demo says "enough". */
export const CATEGORY_CAP = 60;

export interface Vocabulary {
  /** The categories to draw — at most `cap` of them, in first-seen order. */
  readonly values: readonly string[];
  /** How many distinct values the column actually carries. */
  readonly total: number;
  /** True when `values` is shorter than `total` — say so on screen. */
  readonly capped: boolean;
}

/**
 * The distinct values of a column, in first-seen order, capped at `cap`.
 *
 * The cap is a drawing limit, not a claim about the data: `total` always
 * counts every distinct value, so the caller can say "the first 60 of 900" out
 * loud. A null is an absence, not a category.
 */
export function columnVocabulary(rows: readonly Row[], field: string, cap: number = CATEGORY_CAP): Vocabulary {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined) continue;
    const key = String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    if (values.length < cap) values.push(key);
  }
  return { values, total: seen.size, capped: seen.size > values.length };
}

/**
 * The sentence a capped axis owes the reader, or null when the cap did not
 * bite (a note that is always there stops being read).
 *
 * `drawn` is how many bars actually reached the screen. It is not always the
 * number the cap allowed: a category with nothing reported gets NO bar (a
 * missing bar is a silence, a zero would be a lie), so the axis can take the
 * first 60 values and draw 50. Saying "the first 60" over 50 bars is the kind
 * of small lie this whole layer exists to avoid — so when the two differ, both
 * numbers are said.
 */
export function capNote(vocabulary: Vocabulary, field: string, drawn?: number): string | null {
  if (!vocabulary.capped) return null;
  const offered = vocabulary.values.length;
  const shown = drawn ?? offered;
  if (shown >= offered) return `showing the first ${String(offered)} of ${String(vocabulary.total)} ${field} values`;
  return `showing ${String(shown)} of ${String(vocabulary.total)} ${field} values — the axis takes the first ${String(offered)}, and ${String(offered - shown)} of those have no cell to draw`;
}

// ── an analyst reply's links, on their way into a note ──────────────────────

/**
 * One link inside an analyst reply: a COMMIT by id, or a named BEAT by tag id
 * (a bookmark lands no commit of its own, so it is cited by its tag).
 * Exactly one of the two is set — the same pair the library's own
 * `ProseRefView` carries and the analyst panel puts on the wire.
 */
export interface ReplyRef {
  readonly span: readonly [number, number];
  readonly commit?: string;
  readonly bookmark?: string;
  readonly label?: string;
}

/** A note ref: the same shape, with the keys it does not use ABSENT (the wire refuses undefined). */
export type NoteRef = { readonly span: readonly [number, number] } & Partial<Pick<ReplyRef, 'commit' | 'bookmark' | 'label'>>;

/**
 * The refs a note keeps when a reply becomes one. A ref that names NEITHER a
 * commit nor a bookmark anchors nothing and is dropped; everything else travels,
 * bookmarks included — a payload typed `commit: string` (which this demo had) made
 * the panel filter every bookmark citation out before the note was written, and
 * the reply's link to "@[the spike week]" disappeared without a word.
 */
export function noteRefs(refs: readonly ReplyRef[] | undefined): readonly NoteRef[] {
  return (refs ?? []).flatMap((r) =>
    r.commit === undefined && r.bookmark === undefined
      ? []
      : [
          {
            span: r.span,
            ...(r.commit !== undefined ? { commit: r.commit } : {}),
            ...(r.bookmark !== undefined ? { bookmark: r.bookmark } : {}),
            ...(r.label !== undefined ? { label: r.label } : {}),
          },
        ],
  );
}

// ── a note's link to a named bookmark ───────────────────────────────────────────

/**
 * The commit a note's bookmark anchor points at.
 *
 * A note's `@[bookmark]` ref carries the tag's ID (`t1`), not its name — renaming
 * a tag must leave every note working. Older notes (and any wire that predates
 * tag ids) carry the NAME, so both are accepted: id first, then label. Returns
 * null when nothing matches, which is a click that should do nothing rather
 * than seek somewhere arbitrary.
 */
export function bookmarkCommitId(bookmarks: readonly BookmarkView[], bookmarkRef: string): string | null {
  const bookmark = bookmarks.find((c) => c.id === bookmarkRef) ?? bookmarks.find((c) => c.label === bookmarkRef);
  return bookmark?.commitId ?? null;
}
