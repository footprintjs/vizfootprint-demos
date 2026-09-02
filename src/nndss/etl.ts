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
 */
import { readFileSync } from 'node:fs';
import { parseCSVTyped } from '../../../vizfootprint/src/data/csv.js';
import type { SeriesPoint } from '../../../vizfootprint/src/def/series.js';
import type { SeriesGrain } from '../../../vizfootprint/src/def/types.js';
import { cellOf, type Absence } from './absence.js';

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
  /** Honest counts: cells by state, and the rows the CSV parser could not type. */
  readonly counts: Readonly<Record<Absence, number>>;
}

/** The Saturday ending MMWR week `week` of `year` (week 1 contains January 4th). */
/** The column an analysis regresses over when it wants time as a number. */
export const WEEK_INDEX_FIELD = 'week_index';
/** Week 0 — the Saturday ending MMWR week 1 of 2025, the first week in the slice. */
export const WEEK_ZERO = '2025-01-04';
/** Whole weeks from {@link WEEK_ZERO} to the Saturday `t`. */
export function weekIndex(t: string): number {
  return Math.round((Date.parse(t) - Date.parse(WEEK_ZERO)) / (7 * 86_400_000));
}

export function mmwrWeekEnd(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay(); // Sunday = 0
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
  const parsed = parseCSVTyped(csvText);
  const cells: CellRow[] = [];
  const jurisdictionsByName = new Map<string, JurisdictionRow>();
  const counts: Record<Absence, number> = { present: 0, 'not-configured': 0, unavailable: 0, withheld: 0, unknown: 0 };
  for (const r of parsed.rows) {
    const jurisdiction = String(r['states']);
    const kind = kindOf({ states: r['states'], location1: r['location1'], location2: r['location2'] });
    const year = Number(r['year']);
    const week = Number(r['week']);
    const current = cellOf(r['m1'], r['m1_flag']);
    const ytd = cellOf(r['m3'], r['m3_flag']);
    counts[current.state] += 1;
    const t = mmwrWeekEnd(year, week);
    cells.push({
      jurisdiction,
      kind,
      disease: String(r['label']),
      year,
      week,
      t,
      week_index: weekIndex(t),
      cases: current.value,
      report_state: current.state, // the declared absence column (ABSENCE_FIELD)
      flag: current.flag,
      ytd: ytd.value,
      ytd_state: ytd.state,
      prev52_max: num(r['m2']),
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
  };
}

/** The committed snapshot, parsed. */
export function loadSnapshot(path = new URL('../../data/nndss/snapshot.csv', import.meta.url)): NndssTables {
  return nndssTables(readFileSync(path, 'utf8'));
}
