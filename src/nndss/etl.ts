/**
 * ETL — CDC's weekly table, shaped for vizfootprint. Layer 1 (data), the
 * adapter side: the committed snapshot in, plain rows out, nothing invented.
 *
 * Three tables, by the grain each question is asked at:
 *
 *   `cells`          one row per (jurisdiction, disease, week) — the table
 *                    CDC publishes, with every count carrying its STATE:
 *                    present (a number, or a dash = 0), not-configured (N),
 *                    unavailable (U), withheld (NP), unknown. This is the
 *                    session's default table: what the ledger counts are
 *                    CDC cells, never fanned-out joins.
 *   `jurisdictions`  one row per reporting area, with its kind (state /
 *                    region / total) and its coordinates when CDC gives them.
 *   `series`         long-form `{t, entity, metric, value}` — vizfootprint's
 *                    series contract — for PRESENT cells only. A silence is a
 *                    row that is missing here, never a value.
 *
 * MMWR weeks end on Saturday; week 1 is the week (Sun–Sat) that contains
 * January 4th. `t` is that Saturday, ISO, so the series contract's `t`→x
 * binding is a real date, not a week number that lies across years.
 *
 * **This module runs in a browser.** Reading the committed snapshot off disk
 * needs node, so it lives beside this one in `snapshot.ts` — the same rule the
 * library states in `src/source/index.ts` ("carriers that need a runtime are
 * their own modules beside this one, so the default entry never loads node").
 * The single-file story page runs this ETL in the browser over a CSV it
 * carries, and one `node:fs` import at the top would have made that impossible.
 */
import { parseCSVTyped } from 'vizfootprint/data';
import type { SeriesGrain, SeriesPoint } from 'vizfootprint/def';
import { cellOf, type Absence } from './absence.js';
import type { PopulationRow } from './population.js';

export type JurisdictionKind = 'state' | 'region' | 'total';

/** The rows CDC files under "reporting area" that are roll-ups, not places. */
const TOTALS = new Set(['Total', 'U.S. Residents', 'U.S. Territories', 'Non-U.S. Residents']);

export interface CellRow {
  readonly jurisdiction: string;
  readonly kind: JurisdictionKind;
  readonly disease: string;
  /** Whole weeks since the first MMWR week of 2025 — the numeric time axis an analysis may regress over. */
  readonly week_index: number;
  readonly year: number;
  readonly week: number;
  /** The MMWR week-ending Saturday, ISO date. */
  readonly t: string;
  /** Cases this week; null when the cell is a silence. */
  readonly cases: number | null;
  /** The cell's state — the declared absence column. */
  readonly report_state: Absence;
  /** CDC's flag exactly as printed, or null when a number was printed. */
  readonly flag: string | null;
  readonly ytd: number | null;
  readonly ytd_state: Absence;
  readonly prev52_max: number | null;
  /**
   * The previous-52-week maximum's own state. CDC flags `m2` from the SAME
   * vocabulary as `m1` and `m3`, and its blank cells today all carry `NC` —
   * "not calculated, too little data", the small-number suppression on the
   * historical baseline. Dropping the flag would make that suppression
   * indistinguishable from no history at all, on the one column a reader
   * compares this week's count against.
   */
  readonly prev52_max_state: Absence;
  readonly [k: string]: string | number | null;
}

export interface JurisdictionRow {
  readonly jurisdiction: string;
  readonly kind: JurisdictionKind;
  readonly lon: number | null;
  readonly lat: number | null;
  readonly [k: string]: string | number | null;
}

/** A series point that also names its area's kind (state, region, total). */
export interface NndssSeriesPoint extends SeriesPoint {
  readonly entity_kind: JurisdictionKind;
}

export interface NndssTables {
  readonly cells: readonly CellRow[];
  readonly jurisdictions: readonly JurisdictionRow[];
  readonly series: readonly NndssSeriesPoint[];
  readonly grain: SeriesGrain;
  readonly diseases: readonly string[];
  readonly weeks: readonly string[];
  /** Honest counts: the current-week cell (`m1`) by absence state — the five sum to the rows that became cells. */
  readonly counts: Readonly<Record<Absence, number>>;
  /**
   * Rows that never became a cell, because they named no place or no MMWR week
   * — see {@link nndssTablesFromRows}. Zero on the committed snapshot; a number
   * here is the file saying something this ETL will not shape.
   */
  readonly skipped: number;
  /**
   * The DENOMINATOR, when a caller hands one in — `data/population`, one row
   * per place, as of July 1 of its `vintage` (`./population.ts`).
   *
   * `cells` spans MMWR YEARS (2025 and 2026 in the committed snapshot) and this
   * table has no year in its key, so a rate over the two is cases per 100,000
   * residents OF THE VINTAGE YEAR — a denominator one to two years older than
   * the later case weeks. Any caption over `cases_per_100k` quotes the vintage
   * and the lag it implies; the two files are refetched together.
   *
   * Optional in the TYPE for the story page's reason: that page shapes its
   * tables from the one CSV it carries, and a def with no population declares
   * three tables and no rate rather than a fourth table with no rows. The node
   * and http doors (`./snapshot.ts`, `./http.ts`) load it by default, and the
   * def then declares the table, the relation and the two acts together.
   */
  readonly population?: readonly PopulationRow[];
}

/** The column an analysis regresses over when it wants time as a number. */
export const WEEK_INDEX_FIELD = 'week_index';
/** Week 0 — the Saturday ending MMWR week 1 of 2025, the first week in the slice. */
export const WEEK_ZERO = '2025-01-04';
/** Whole weeks from {@link WEEK_ZERO} to the Saturday `t`. */
export function weekIndex(t: string): number {
  return Math.round((Date.parse(t) - Date.parse(WEEK_ZERO)) / (7 * 86_400_000));
}

/**
 * The Saturday ending MMWR week `week` of `year`.
 *
 * MMWR's law, and the only reason this arithmetic is not obvious: week 1 is the
 * week CONTAINING JANUARY 4th. So the Saturday that ends week 1 is the first
 * Saturday on or after Jan 4 (`6 - dow` days from it, counting from Sunday),
 * and week `n` ends `(n - 1)` whole weeks later.
 */
export function mmwrWeekEnd(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay();
  const week1End = new Date(jan4.getTime() + (6 - dow) * 86_400_000);
  const end = new Date(week1End.getTime() + (week - 1) * 7 * 86_400_000);
  return end.toISOString().slice(0, 10);
}

/** Which kind of reporting area a row is — from CDC's own columns, never from the name's spelling. */
export function kindOf(row: { readonly states: unknown; readonly location1: unknown; readonly location2: unknown }): JurisdictionKind {
  const name = String(row.states);
  if (TOTALS.has(name)) return 'total';
  // CDC files a place under `location1` and a census division under `location2`.
  // The coordinate columns are NOT the classifier: South Atlantic carries one
  // (a point in South Dakota) while Middle Atlantic does not.
  if (filled(row.location2) && !filled(row.location1)) return 'region';
  return 'state';
}

const filled = (v: unknown): boolean => v !== null && v !== undefined && v !== '';

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Parse the committed snapshot (or any CSV in its shape) into the three tables. */
export function nndssTables(csvText: string): NndssTables {
  return nndssTablesFromRows(parseCSVTyped(csvText).rows);
}

/** The same ETL over rows a source adapter already decoded (the data-source layer's `format: 'csv'`). */
export function nndssTablesFromRows(rows: readonly Record<string, unknown>[]): NndssTables {
  const cells: CellRow[] = [];
  const jurisdictionsByName = new Map<string, JurisdictionRow>();
  const counts: Record<Absence, number> = { present: 0, 'not-configured': 0, unavailable: 0, withheld: 0, unknown: 0 };
  // `mmwrWeekEnd` and `weekIndex` are pure in (year, week) and the snapshot has
  // 86 distinct weeks over 90,300 rows — computed per row they allocate three
  // Dates and reparse two ISO strings ninety thousand times, on the main thread
  // of the page the story build runs this ETL in.
  const weekCache = new Map<number, { readonly t: string; readonly index: number }>();
  const weekOf = (year: number, week: number): { readonly t: string; readonly index: number } => {
    const key = year * 100 + week;
    const hit = weekCache.get(key);
    if (hit !== undefined) return hit;
    const t = mmwrWeekEnd(year, week);
    const made = { t, index: weekIndex(t) };
    weekCache.set(key, made);
    return made;
  };
  let skipped = 0;
  for (const r of rows) {
    // WHY the identity columns are judged before anything is shaped, the law
    // `populationRowsFrom` keeps: a row missing either number is dropped, never
    // guessed at. `String(null)` is the place "null" and `Number(null)` is the
    // year 0, which `mmwrWeekEnd` turns into a real-looking 1899 date that
    // sorts FIRST — the left edge of every time axis, invented by this file.
    const jurisdiction = typeof r['states'] === 'string' ? r['states'] : '';
    const disease = typeof r['label'] === 'string' ? r['label'] : '';
    const year = Number(r['year']);
    const week = Number(r['week']);
    if (jurisdiction === '' || disease === '' || !Number.isInteger(year) || !Number.isInteger(week)) {
      skipped += 1;
      continue;
    }
    const kind = kindOf({ states: r['states'], location1: r['location1'], location2: r['location2'] });
    const current = cellOf(r['m1'], r['m1_flag']);
    const ytd = cellOf(r['m3'], r['m3_flag']);
    const prev = cellOf(r['m2'], r['m2_flag']);
    counts[current.state] += 1;
    const { t, index } = weekOf(year, week);
    cells.push({
      jurisdiction,
      kind,
      disease,
      year,
      week,
      t,
      week_index: index,
      cases: current.value,
      report_state: current.state, // the declared absence column (ABSENCE_FIELD)
      flag: current.flag,
      ytd: ytd.value,
      ytd_state: ytd.state,
      prev52_max: prev.value,
      prev52_max_state: prev.state,
    });
    if (!jurisdictionsByName.has(jurisdiction)) {
      jurisdictionsByName.set(jurisdiction, { jurisdiction, kind, lon: num(r['lon']), lat: num(r['lat']) });
    }
  }
  // every PRESENT cell becomes a series point — states, regions and roll-ups alike,
  // each carrying its kind so a trend can show one kind at a time (a region's
  // count is CDC's own row, not a sum the host made). A silence is a missing row.
  const series: NndssSeriesPoint[] = cells
    .filter((c) => c.cases !== null)
    .map((c) => ({ t: c.t, entity: c.jurisdiction, entity_kind: c.kind, metric: c.disease, value: c.cases as number }));
  const diseases = [...new Set(cells.map((c) => c.disease))].sort();
  const weeks = [...new Set(cells.map((c) => c.t))].sort();
  return {
    cells,
    jurisdictions: [...jurisdictionsByName.values()],
    series,
    grain: { bucket: 'MMWR week', reducer: 'reported count', note: 'provisional; CDC revises weekly counts' },
    diseases,
    weeks,
    counts,
    skipped,
  };
}
