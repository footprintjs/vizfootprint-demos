/**
 * ETL — EIA's hourly grid tables, shaped for vizfootprint. Layer 1 (data), the
 * adapter side: the committed slice in, plain rows out, nothing invented.
 *
 * Four tables, by the grain each question is asked at:
 *
 *   `authorities`  one row per balancing authority — the NODES. Its code, its
 *                  name, its region, whether it reports at all (`reporting`) or
 *                  is only ever named as somebody's neighbour (`external` — the
 *                  eight Canadian and Mexican interties), the window it
 *                  actually covers, and whether it has demand to report.
 *   `interchange`  one row per (from, to, hour) — the directed hourly flows,
 *                  the EDGES, every value carrying its state.
 *   `hourly`       one row per (authority, hour): demand, net generation and
 *                  total interchange, each as the number EIA published, the
 *                  number the authority filed, and the word for the difference.
 *   `links`        DERIVED, one row per directed pair: the static edge set a
 *                  node-link view needs, so no view has to fold 150,000 rows to
 *                  learn which authorities are connected. It is where the fact
 *                  "this link is declared and never carries a number" lives.
 *
 * Time. `t` is the ISO-8601 UTC hour ENDING the hour — EIA's own convention,
 * so a row stamped `2025-05-19T01:00Z` covers 00:00–01:00 UTC. `hour_index` is
 * whole hours from {@link HOUR_ZERO}, the numeric axis an analysis regresses
 * over. `t_local` is the authority's own wall clock with NO zone marker,
 * because that is exactly what it is: 6 p.m. in Florida and 6 p.m. in Oregon
 * are different instants and the same daily peak.
 *
 * Two passes, and the reason. `figureOf` cannot word an empty cell alone: an
 * authority that never files demand is `not-configured`, one that missed an
 * hour is `unavailable`, and only a walk over every row can tell them apart.
 * So the hourly file is read twice — once to learn what each authority ever
 * filed, once to word it — and `ABSENCE_RULE` says out loud that the split is
 * an inference, not EIA's own word.
 *
 * **This module runs in a browser.** Reading the committed slice off disk needs
 * node, so it lives beside this one in `snapshot.ts` — the same rule
 * `src/nndss/etl.ts` states and the same reason: a module that pulls a runtime
 * into every importer is a module every importer pays for.
 *
 * The same ETL reads the committed slice and the full six-month bulk file: the
 * slice is a pure row-and-column cut of EIA's own CSV, header text and cell
 * text unchanged, so there is one parse and never a second dialect.
 */
import { parseCSVTyped } from 'vizfootprint/data';
import { ABSENCE_STATES, figureOf, flowOf, numberOrNull, type Absence } from './absence.js';
import { AUTHORITY_NAMES, REGION_NAMES } from './names.js';

// ── time ──────────────────────────────────────────────────────────────────────

/** Hour 0 — the first instant of the six-month period the slice is cut from, so a slice and the whole file index alike. */
export const HOUR_ZERO = '2025-01-01T00:00Z';
/** The column an analysis regresses over when it wants time as a number. */
export const HOUR_INDEX_FIELD = 'hour_index';

const EIA_STAMP = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/;
const ISO_STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** Milliseconds for one of EIA's `MM/DD/YYYY h:mm:ss AM` stamps, or an ISO one — both, so the ETL reads the slice and the raw file. */
export function stampMs(stamp: unknown): number {
  const s = typeof stamp === 'string' ? stamp.trim() : '';
  const eia = EIA_STAMP.exec(s);
  if (eia !== null) {
    const hour12 = Number(eia[4]) % 12;
    const hour = eia[7] === 'PM' ? hour12 + 12 : hour12;
    return Date.UTC(Number(eia[3]), Number(eia[1]) - 1, Number(eia[2]), hour, Number(eia[5]), Number(eia[6]));
  }
  const iso = ISO_STAMP.exec(s);
  if (iso !== null) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4]), Number(iso[5]));
  throw new Error(`not an EIA or ISO timestamp: ${JSON.stringify(stamp)}`);
}

/** `2025-05-19T01:00Z` — the UTC hour ending, minute-precise and zone-marked. */
export const isoHour = (ms: number): string => `${new Date(ms).toISOString().slice(0, 16)}Z`;
/** `2025-05-19T01:00` — a WALL CLOCK, deliberately without a zone: it is the authority's own hour, not an instant. */
export const wallHour = (ms: number): string => new Date(ms).toISOString().slice(0, 16);
/** Whole hours from {@link HOUR_ZERO}. */
export const hourIndex = (ms: number): number => Math.round((ms - Date.parse(HOUR_ZERO)) / 3_600_000);

// ── the rows ──────────────────────────────────────────────────────────────────

/** Whether an authority files hourly rows of its own, or is only ever named as somebody's neighbour. */
export type AuthorityKind = 'reporting' | 'external';

/** One balancing authority — the graph's node, keyed by its EIA code. */
export interface AuthorityRow {
  /** EIA's code: the key every other table joins on. */
  readonly authority: string;
  /** The long name, or null when `names.ts` has no entry — never the code echoed back. */
  readonly name: string | null;
  /** `present` when the name was found, `unknown` when it was not. */
  readonly name_state: Absence;
  readonly region: string;
  readonly region_name: string | null;
  /** `reporting` files hourly rows; `external` never does — it is named only as the far end of a flow. */
  readonly kind: AuthorityKind;
  /** Hourly rows this authority filed inside the window. */
  readonly hours: number;
  /** The first hour it filed, ISO UTC — null for an external authority. An authority that arrives late says so HERE, in numbers. */
  readonly first_hour: string | null;
  /** The last hour it filed — one that leaves early says so here. */
  readonly last_hour: string | null;
  /** `present` when it filed demand in at least one hour, `not-configured` when it filed none at all (a generation-only authority), `unknown` when it files no rows. */
  readonly demand_state: Absence;
  /** Distinct authorities it is directly interconnected with, in either direction. */
  readonly neighbours: number;
  readonly [k: string]: string | number | null;
}

/** One directed hourly flow — the graph's edge, at its finest grain. */
export interface InterchangeRow {
  readonly from_authority: string;
  readonly to_authority: string;
  /** The UTC hour ending, ISO. */
  readonly t: string;
  readonly hour_index: number;
  /** Megawatts, EIA's sign convention: positive is a flow OUT of `from_authority`. Null when the hour is a silence. */
  readonly mw: number | null;
  /** `present` (a measured number, zero included) or `unavailable` (an empty cell). */
  readonly report_state: Absence;
  readonly [k: string]: string | number | null;
}

/** One authority in one hour: what it demanded, generated and traded. */
export interface HourlyRow {
  readonly authority: string;
  readonly region: string;
  /** The UTC hour ending, ISO. */
  readonly t: string;
  readonly hour_index: number;
  /** The authority's own wall clock for the same hour — no zone marker, because it is not an instant. */
  readonly t_local: string;
  /** 0–23 on that wall clock: the column a daily-shape question groups by. */
  readonly local_hour: number;
  /** EIA's published demand, MW. */
  readonly demand: number | null;
  readonly demand_state: Absence;
  /** What the authority itself filed — kept even when EIA replaced it, because the two disagreeing IS the story. */
  readonly demand_reported: number | null;
  readonly generation: number | null;
  readonly generation_state: Absence;
  readonly generation_reported: number | null;
  /** Net interchange: positive when the authority is a net exporter. */
  readonly interchange: number | null;
  readonly interchange_state: Absence;
  readonly interchange_reported: number | null;
  /** The authority's day-ahead forecast of its own demand. */
  readonly demand_forecast: number | null;
  /** EIA's own cross-check: the sum of this authority's valid directed flows in this hour. */
  readonly dibas_sum: number | null;
  /** `interchange − dibas_sum` when both were published: EIA's reconciliation residue, and it is often not zero. */
  readonly interchange_gap: number | null;
  readonly [k: string]: string | number | null;
}

/** DERIVED: one directed pair, folded from the hourly flows — the static edge set a node-link view draws. */
export interface LinkRow {
  readonly from_authority: string;
  readonly to_authority: string;
  /** `reporting` or `external` — whether the far end files rows of its own. An external target is a border crossing. */
  readonly to_kind: AuthorityKind;
  /** Hourly rows EIA wrote for this pair. */
  readonly hours: number;
  /** Of those, how many carried a number. */
  readonly hours_reported: number;
  readonly first_hour: string;
  readonly last_hour: string;
  /** Megawatt-hours summed over the published values — positive is a net flow out of `from_authority`. */
  readonly net_mwh: number;
  /** `present` when at least one hour carried a number; `unavailable` when the link is declared in every hour and never carries one. */
  readonly report_state: Absence;
  readonly [k: string]: string | number | null;
}

/** Cells by state, per figure — the honest counts, never a summary that hides a silence. */
export interface GridCounts {
  readonly demand: Readonly<Record<Absence, number>>;
  readonly generation: Readonly<Record<Absence, number>>;
  readonly interchange: Readonly<Record<Absence, number>>;
  /** The directed hourly flow cells. */
  readonly flows: Readonly<Record<Absence, number>>;
  /** Flow cells whose published value is exactly 0 — a MEASURED zero, which is why `present` and `unavailable` can never be merged. */
  readonly measuredZeroFlows: number;
  /** Links declared in every hour that never carried a number. */
  readonly linksNeverReported: number;
  /** Hourly rows whose published interchange disagrees with EIA's own sum of the flows. */
  readonly interchangeGaps: number;
  readonly hours: number;
  readonly authorities: number;
  readonly externalAuthorities: number;
  readonly links: number;
}

export interface GridTables {
  readonly authorities: readonly AuthorityRow[];
  readonly interchange: readonly InterchangeRow[];
  readonly hourly: readonly HourlyRow[];
  readonly links: readonly LinkRow[];
  /** Every distinct UTC hour in the window, ascending. */
  readonly hours: readonly string[];
  readonly counts: GridCounts;
}

// ── EIA's column names, in one place ──────────────────────────────────────────

/** The balance columns this ETL reads. EIA's exact header text: the slice keeps it, so one parse serves both files. */
export const BALANCE_COLUMNS = {
  authority: 'Balancing Authority',
  utc: 'UTC Time at End of Hour',
  local: 'Local Time at End of Hour',
  region: 'Region',
  forecast: 'Demand Forecast (MW)',
  demand: 'Demand (MW)',
  generation: 'Net Generation (MW)',
  interchange: 'Total Interchange (MW)',
  dibasSum: 'Sum(Valid DIBAs) (MW)',
  demandImputed: 'Demand (MW) (Imputed)',
  generationImputed: 'Net Generation (MW) (Imputed)',
  interchangeImputed: 'Total Interchange (MW) (Imputed)',
  demandAdjusted: 'Demand (MW) (Adjusted)',
  generationAdjusted: 'Net Generation (MW) (Adjusted)',
  interchangeAdjusted: 'Total Interchange (MW) (Adjusted)',
} as const;

/** The interchange columns this ETL reads. */
export const INTERCHANGE_COLUMNS = {
  authority: 'Balancing Authority',
  neighbour: 'Directly Interconnected Balancing Authority',
  utc: 'UTC Time at End of Hour',
  mw: 'Interchange (MW)',
  neighbourRegion: 'DIBA_Region',
} as const;

// ── the parse ─────────────────────────────────────────────────────────────────

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : String(v ?? ''));
const zeroed = (): Record<Absence, number> => Object.fromEntries(ABSENCE_STATES.map((s) => [s, 0])) as Record<Absence, number>;
/** A cell the authority actually filled — `parseCSVTyped` leaves a blank as null, a raw split as ''. */
const filledIn = (v: unknown): boolean => v !== null && v !== undefined && v !== '';

/**
 * Joins the parts of a compound key.
 * WHY: NUL is the one character a CSV cell cannot hold, so no authority code can spell a separator;
 * written as an escape so this file stays plain text.
 */
const KEY_SEPARATOR = '\u0000';

/** What one authority ever filed, learned in the first pass so the second can tell `not-configured` from `unavailable`. */
interface Filed {
  readonly region: string;
  demand: boolean;
  generation: boolean;
  interchange: boolean;
  hours: number;
  firstMs: number;
  lastMs: number;
}

/** Parse the committed slice (or the full bulk pair, or anything in EIA's shape) into the four tables. */
export function gridTables(balanceCsv: string, interchangeCsv: string): GridTables {
  return gridTablesFromRows(parseCSVTyped(balanceCsv).rows, parseCSVTyped(interchangeCsv).rows);
}

/** The same ETL over rows a source adapter already decoded (the data-source layer's `format: 'csv'`). */
export function gridTablesFromRows(balance: readonly Record<string, unknown>[], flows: readonly Record<string, unknown>[]): GridTables {
  const filed = firstPass(balance);
  const hourly = secondPass(balance, filed);
  const { interchange, links, neighbours, externalRegions } = foldFlows(flows);
  const authorities = authorityRows(filed, neighbours, externalRegions);
  const hours = [...new Set([...hourly.map((h) => h.t), ...interchange.map((i) => i.t)])].sort();
  return { authorities, interchange, hourly, links, hours, counts: countsOf(hourly, interchange, links, authorities, hours.length) };
}

/** Pass one: what did each authority ever file, and over what window. Nothing is worded yet. */
function firstPass(balance: readonly Record<string, unknown>[]): Map<string, Filed> {
  const filed = new Map<string, Filed>();
  for (const r of balance) {
    const authority = text(r[BALANCE_COLUMNS.authority]);
    const ms = stampMs(r[BALANCE_COLUMNS.utc]);
    let f = filed.get(authority);
    if (f === undefined) {
      f = { region: text(r[BALANCE_COLUMNS.region]), demand: false, generation: false, interchange: false, hours: 0, firstMs: ms, lastMs: ms };
      filed.set(authority, f);
    }
    f.hours += 1;
    if (ms < f.firstMs) f.firstMs = ms;
    if (ms > f.lastMs) f.lastMs = ms;
    // "ever filed" means the AUTHORITY filed it — an imputed value is EIA's, and counting it here
    // would turn every hole EIA patched into evidence that the authority reports the figure at all
    if (filledIn(r[BALANCE_COLUMNS.demand])) f.demand = true;
    if (filledIn(r[BALANCE_COLUMNS.generation])) f.generation = true;
    if (filledIn(r[BALANCE_COLUMNS.interchange])) f.interchange = true;
  }
  return filed;
}

/** EIA's three columns for one figure, as they arrive. */
function tripleOf(r: Record<string, unknown>, figure: 'demand' | 'generation' | 'interchange'): { reported: number | null; imputed: number | null; adjusted: number | null } {
  const imputed = { demand: BALANCE_COLUMNS.demandImputed, generation: BALANCE_COLUMNS.generationImputed, interchange: BALANCE_COLUMNS.interchangeImputed }[figure];
  const adjusted = { demand: BALANCE_COLUMNS.demandAdjusted, generation: BALANCE_COLUMNS.generationAdjusted, interchange: BALANCE_COLUMNS.interchangeAdjusted }[figure];
  return { reported: numberOrNull(r[BALANCE_COLUMNS[figure]]), imputed: numberOrNull(r[imputed]), adjusted: numberOrNull(r[adjusted]) };
}

/** Pass two: word every figure, now that the first pass knows what each authority ever files. */
function secondPass(balance: readonly Record<string, unknown>[], filed: ReadonlyMap<string, Filed>): HourlyRow[] {
  const rows: HourlyRow[] = [];
  for (const r of balance) {
    const authority = text(r[BALANCE_COLUMNS.authority]);
    const ever = filed.get(authority);
    const ms = stampMs(r[BALANCE_COLUMNS.utc]);
    const localMs = stampMs(r[BALANCE_COLUMNS.local]);
    const demand = figureOf(tripleOf(r, 'demand'), ever?.demand ?? false);
    const generation = figureOf(tripleOf(r, 'generation'), ever?.generation ?? false);
    const interchange = figureOf(tripleOf(r, 'interchange'), ever?.interchange ?? false);
    const dibasSum = numberOrNull(r[BALANCE_COLUMNS.dibasSum]);
    rows.push({
      authority,
      region: text(r[BALANCE_COLUMNS.region]),
      t: isoHour(ms),
      hour_index: hourIndex(ms),
      t_local: wallHour(localMs),
      local_hour: new Date(localMs).getUTCHours(),
      demand: demand.value,
      demand_state: demand.state, // the declared absence column (ABSENCE_FIELD)
      demand_reported: demand.reported,
      generation: generation.value,
      generation_state: generation.state,
      generation_reported: generation.reported,
      interchange: interchange.value,
      interchange_state: interchange.state,
      interchange_reported: interchange.reported,
      demand_forecast: numberOrNull(r[BALANCE_COLUMNS.forecast]),
      dibas_sum: dibasSum,
      interchange_gap: interchange.value !== null && dibasSum !== null ? interchange.value - dibasSum : null,
    });
  }
  return rows;
}

interface LinkFold {
  hours: number;
  reported: number;
  netMwh: number;
  firstMs: number;
  lastMs: number;
}

/** One walk over the flows: the edge rows, the per-pair fold, who neighbours whom, and the region of every far end. */
function foldFlows(flows: readonly Record<string, unknown>[]): {
  readonly interchange: InterchangeRow[];
  readonly links: LinkRow[];
  readonly neighbours: ReadonlyMap<string, Set<string>>;
  readonly externalRegions: ReadonlyMap<string, string>;
} {
  const interchange: InterchangeRow[] = [];
  const folds = new Map<string, LinkFold>();
  const neighbours = new Map<string, Set<string>>();
  const externalRegions = new Map<string, string>();
  const meet = (a: string, b: string): void => {
    let s = neighbours.get(a);
    if (s === undefined) {
      s = new Set();
      neighbours.set(a, s);
    }
    s.add(b);
  };
  for (const r of flows) {
    const from = text(r[INTERCHANGE_COLUMNS.authority]);
    const to = text(r[INTERCHANGE_COLUMNS.neighbour]);
    const ms = stampMs(r[INTERCHANGE_COLUMNS.utc]);
    const flow = flowOf(r[INTERCHANGE_COLUMNS.mw]);
    interchange.push({ from_authority: from, to_authority: to, t: isoHour(ms), hour_index: hourIndex(ms), mw: flow.value, report_state: flow.state });
    meet(from, to);
    meet(to, from);
    externalRegions.set(to, text(r[INTERCHANGE_COLUMNS.neighbourRegion]));
    const key = from + KEY_SEPARATOR + to;
    let f = folds.get(key);
    if (f === undefined) {
      f = { hours: 0, reported: 0, netMwh: 0, firstMs: ms, lastMs: ms };
      folds.set(key, f);
    }
    f.hours += 1;
    if (ms < f.firstMs) f.firstMs = ms;
    if (ms > f.lastMs) f.lastMs = ms;
    if (flow.value !== null) {
      f.reported += 1;
      f.netMwh += flow.value;
    }
  }
  // an authority that files a flow of its own is `reporting`; one that only ever appears as a far end is `external`
  const sources = new Set(interchange.map((i) => i.from_authority));
  const links: LinkRow[] = [...folds]
    .map(([key, f]) => {
      const [from = '', to = ''] = key.split(KEY_SEPARATOR);
      return {
        from_authority: from,
        to_authority: to,
        to_kind: (sources.has(to) ? 'reporting' : 'external') as AuthorityKind,
        hours: f.hours,
        hours_reported: f.reported,
        first_hour: isoHour(f.firstMs),
        last_hour: isoHour(f.lastMs),
        net_mwh: f.netMwh,
        report_state: (f.reported > 0 ? 'present' : 'unavailable') as Absence,
      };
    })
    // WHY: sorting by name, not by the map's insertion order, is what makes the derived table's order a fact about the data rather than about the rows' arrival
    .sort((a, b) => a.from_authority.localeCompare(b.from_authority) || a.to_authority.localeCompare(b.to_authority));
  return { interchange, links, neighbours, externalRegions };
}

/** The node table: every authority that files rows, plus every one that is only ever named as a neighbour. */
function authorityRows(filed: ReadonlyMap<string, Filed>, neighbours: ReadonlyMap<string, Set<string>>, externalRegions: ReadonlyMap<string, string>): AuthorityRow[] {
  const codes = [...new Set([...filed.keys(), ...neighbours.keys()])].sort();
  return codes.map((authority) => {
    const f = filed.get(authority);
    const region = f?.region ?? externalRegions.get(authority) ?? '';
    const name = AUTHORITY_NAMES[authority] ?? null;
    return {
      authority,
      name,
      name_state: (name === null ? 'unknown' : 'present') as Absence,
      region,
      region_name: REGION_NAMES[region] ?? null,
      kind: (f === undefined ? 'external' : 'reporting') as AuthorityKind,
      hours: f?.hours ?? 0,
      first_hour: f === undefined ? null : isoHour(f.firstMs),
      last_hour: f === undefined ? null : isoHour(f.lastMs),
      demand_state: (f === undefined ? 'unknown' : f.demand ? 'present' : 'not-configured') as Absence,
      neighbours: neighbours.get(authority)?.size ?? 0,
    };
  });
}

function countsOf(hourly: readonly HourlyRow[], interchange: readonly InterchangeRow[], links: readonly LinkRow[], authorities: readonly AuthorityRow[], hours: number): GridCounts {
  const demand = zeroed();
  const generation = zeroed();
  const totalInterchange = zeroed();
  const flowStates = zeroed();
  let interchangeGaps = 0;
  for (const h of hourly) {
    demand[h.demand_state] += 1;
    generation[h.generation_state] += 1;
    totalInterchange[h.interchange_state] += 1;
    if (h.interchange_gap !== null && h.interchange_gap !== 0) interchangeGaps += 1;
  }
  let measuredZeroFlows = 0;
  for (const i of interchange) {
    flowStates[i.report_state] += 1;
    if (i.mw === 0) measuredZeroFlows += 1;
  }
  return {
    demand,
    generation,
    interchange: totalInterchange,
    flows: flowStates,
    measuredZeroFlows,
    linksNeverReported: links.filter((l) => l.report_state !== 'present').length,
    interchangeGaps,
    hours,
    authorities: authorities.length,
    externalAuthorities: authorities.filter((a) => a.kind === 'external').length,
    links: links.length,
  };
}
