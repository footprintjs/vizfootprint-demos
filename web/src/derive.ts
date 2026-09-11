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
 * Five laws live here:
 *
 *   1. `emitIntent` — the words a commit is filed under name the field the
 *      GESTURE was on, read off the emission itself. A hard-coded "pick
 *      disease" survives a re-encode and files a false cause.
 *   2. `pickedFrom` / `arrivesFrom` — a clause reaches a view only through the
 *      LINK GRAPH. Reading `state.selections` directly is reading a clause the
 *      person may have switched off — the log then says the link is off while
 *      the view moves anyway.
 *   3. `judgedHere` — a clause naming a column these rows have not got filtered
 *      NOTHING at the library's read door, so it must drop nothing in a host's
 *      own fold either. A reported library gap, with its own WHY below.
 *   4. `categoryCounts` — one pass over the rows, whatever the number of bars.
 *      A pass per bar is O(categories × rows): 70 jurisdictions over 90,300
 *      cells is 6.3 million comparisons on every selection change.
 *   5. `columnVocabulary` — the categories a column offers, counted once and
 *      CAPPED, because a column with 900 distinct values is not a bar chart
 *      and pretending otherwise costs ~766 ms per keystroke of interaction.
 */
import { filtersHere } from 'vizfootprint-ui';
import type { RenderSelection } from 'vizfootprint-ui';

/**
 * A row of any demo table, as the wire carries it.
 *
 * `boolean` is in the list because a DERIVED column can be one: the exoplanet
 * demo's `disagrees` is `r_max > r_min`, and the op grammar yields a real
 * boolean (`vizfootprint/src/derive/ops.ts` · `gt`). A type that stopped at
 * strings and numbers would have forced every reader of such a column to cast.
 */
export type Row = Readonly<Record<string, string | number | boolean | null | undefined>>;

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
    return filtersHere(clause) && clause.value !== null; // `null` is the one spelling of cleared, whatever the kind
  });
}

/**
 * THE CLAUSES THESE ROWS CAN JUDGE — and a LIBRARY GAP, reported here rather
 * than paraphrased away.
 *
 * The library's READ door narrows a clause whose column the target's table has
 * not got: the window still lists it, carrying
 * `ReachingClause.narrowed = { column, reason }`, and the sheet prints the
 * reason (`vizfootprint` · `src/session/README.md`, "A sentence about a column
 * these rows do not have is not a claim about these rows"). The RENDER tier
 * does not. `selectionForView` compiles every clause an arriving edge carries
 * into a row predicate and `keepPredicate` folds them all, with no column list
 * to judge against — so the exoplanet histogram's `radii` interval reaching a
 * table of planets or of references drops EVERY row, while the sheet reading
 * the same clause correctly filters nothing. Two tiers, two answers, and the
 * blank chart is the wrong one.
 *
 * So a host that folds its own marks has to ask the read door's question for
 * itself, and this is that question and nothing else: the clause's column,
 * against the columns actually in hand. It states no reason and invents no
 * sentence — the reason belongs to the library, which already says it where a
 * reader meets the rows.
 *
 * It refuses ON EVIDENCE, NEVER ON IGNORANCE, exactly as the library's own
 * `tablesCanReach` does: with no row to read columns off, nothing is dropped.
 * The evidence is the FIRST row's own keys — the rows a chart folds come from
 * one table through one parse or one act, so they carry the same keys, and a
 * key present with a null value is still a column this table has (which is the
 * distinction `in` keeps and a value check would lose).
 *
 * DELETE THIS the moment the render tier narrows too (either
 * `selectionForView` taking the columns it is folding over, or the library
 * exporting `unjudgeableColumn` for a host to call).
 */
export function judgedHere(selection: RenderSelection, rows: readonly Row[]): RenderSelection {
  const sample = rows[0];
  if (sample === undefined) return selection;
  const judgeable = (field: string): boolean => field in sample;
  const clauses = new Map([...selection.clauses].filter(([, c]) => (c.fields === undefined ? judgeable(c.field) : c.fields.every(judgeable))));
  return clauses.size === selection.clauses.size ? selection : { ...selection, clauses };
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

// ── 5 · what an answer NAMED and could not honour ───────────────────────────

/**
 * One commit a `why` answer's target named that the answer could not honour —
 * the library's `CrossTierSlice.dropped` row, as it rides the wire.
 */
export interface DroppedRefView {
  readonly id: string;
  /** `off-branch`: the log holds it, on another branch. `unverified`: the answer could not find it at all. */
  readonly reason: string;
}

/** Which ids in a disclosure carry this reason. */
function idsFor(dropped: readonly DroppedRefView[], reason: string): string[] {
  return dropped.filter((d) => d.reason === reason).map((d) => d.id);
}

/**
 * The one quiet line under a `why` act: **what the answer named and could not
 * honour**, in plain words.
 *
 * Dropping those commits is the library's law and stays — an off-branch basis
 * is not provenance, and a ghost id is not evidence. Being SILENT about them
 * was the defect: the answer disclosed them on the wire (`dropped`) and nothing
 * on screen said so, which is the saved-selection scar one layer along — a door
 * the library served and no interface called.
 *
 * The two reasons are **different facts and are said differently**, because a
 * reader who confuses them goes looking in the wrong place: *on another branch*
 * means the log really holds that commit and these words stand at a moment that
 * never saw it; *this log does not hold it* means the answer could not find it
 * at all.
 *
 * A reason NEITHER of those covers gets a third clause that says the commit was
 * named, says the reason is one these words cannot read, and STOPS. It must not
 * be readable as a claim about where the commit is — guessing at the reason is
 * the failure this whole disclosure exists to prevent, and a malformed row is
 * exactly where that guess would be cheapest to make.
 *
 * The line never offers to fix anything and never links the commit it names —
 * the library refuses that citation deliberately, and a link would be the
 * interface handing back what the answer just declined to vouch for.
 *
 * ```ts
 * whyDroppedNote([{ id: 'c12', reason: 'off-branch' }, { id: 'ghost', reason: 'unverified' }]);
 * // 'named and not honoured — c12 is on another branch; this log does not hold ghost'
 * ```
 *
 * @returns the sentence, or `undefined` when the answer had nothing to disclose
 *   (which costs a reader nothing to be told).
 */
export function whyDroppedNote(dropped: readonly DroppedRefView[] | undefined): string | undefined {
  if (dropped === undefined || dropped.length === 0) return undefined;
  const offBranch = idsFor(dropped, 'off-branch');
  const unverified = idsFor(dropped, 'unverified');
  const unsaid = dropped.filter((d) => d.reason !== 'off-branch' && d.reason !== 'unverified').map((d) => d.id);
  const said: string[] = [];
  if (offBranch.length > 0) said.push(`${offBranch.join(', ')} ${offBranch.length === 1 ? 'is' : 'are'} on another branch`);
  if (unverified.length > 0) said.push(`this log does not hold ${unverified.join(', ')}`);
  if (unsaid.length > 0) said.push(`${unsaid.join(', ')}, for a reason these words cannot read`);
  return `named and not honoured — ${said.join('; ')}`;
}

/** A `why` answer's disclosure, read off an untrusted tool result — absent, or not a list of rows, is nothing to say. */
export function droppedOf(result: unknown): readonly DroppedRefView[] | undefined {
  const rows = (result as { dropped?: unknown } | null | undefined)?.dropped;
  if (!Array.isArray(rows)) return undefined;
  const kept = rows.flatMap((r) => {
    const row = r as { id?: unknown; reason?: unknown } | null;
    return row !== null && typeof row === 'object' && typeof row.id === 'string' && typeof row.reason === 'string'
      ? [{ id: row.id, reason: row.reason }]
      : [];
  });
  return kept.length > 0 ? kept : undefined;
}

// ── 6 · what a STORY cited and could not show ───────────────────────────────
//
// It used to live here. `storyDroppedNote` now ships beside the `dropped` rows
// it reads (`vizfootprint-ui/story`), because the stage needed the same
// sentence and a second surface copying it is how one rule becomes two
// spellings. Law 3 of `ui/src/adapter/README.md`: the helper a consumer wrote
// IS the door, in the wrong repository.
