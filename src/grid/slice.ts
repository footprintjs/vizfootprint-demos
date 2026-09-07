/**
 * THE SLICE — which rows and which columns of EIA's bulk files are committed,
 * and the record that travels with them. The rule lives here, in one place, so
 * the generator, the provenance and this repo's prose can never disagree.
 *
 * A PURE CUT. The slice keeps EIA's header text and EIA's cell text exactly:
 * fewer rows, fewer columns, not one byte of any retained cell changed. Any
 * line of `data/grid/*.csv` can be found verbatim in the bulk file it came
 * from. That is why `src/grid/etl.ts` has one parse rather than two dialects,
 * and why "is the slice honest?" is a question a reader can answer with grep
 * instead of trust.
 *
 * WHY A WINDOW AND NOT A SUBSET OF AUTHORITIES. Both were on the table. Cutting
 * authorities would have made the committed network a network this data does not
 * describe — every dropped authority turns its neighbours' flows into edges that
 * lead nowhere, and the sparse, directed shape that made this dataset worth
 * choosing is exactly what would be damaged. Cutting time damages nothing
 * structural: all 70 authorities, all 303 directed links and every silence
 * survive; what is lost is seasonal shape, and that loss is easy to state.
 *
 * WHY THIS WINDOW. Three whole weeks, Monday to Sunday, straddling 2025-06-01 —
 * the day Harquahala files its last hour and Sikeston files its first. Those two
 * are the deepest silence this data has (an authority that is not in the file at
 * all, as against one whose cell is empty), and a slice that removed them would
 * be a slice that removed the point. Thirteen days sit before the changeover and
 * eight after, so both are visible as a change and not just as an edge.
 */
import { ABSENCE_RULE, ABSENCE_FIELD, ABSENCE_STATES } from './absence.js';
import { BALANCE_COLUMNS, INTERCHANGE_COLUMNS, type GridCounts } from './etl.js';
import { NAMES_SOURCE } from './names.js';

/** The committed window, inclusive at both ends: UTC hour-ENDING stamps, EIA's own convention. */
export const SLICE_WINDOW = {
  /** First hour kept — Monday 2025-05-19, 00:00 UTC. */
  from: '2025-05-19T00:00Z',
  /** Last hour kept — Sunday 2025-06-08, 23:00 UTC. */
  to: '2025-06-08T23:00Z',
  /** Hourly stamps between them, inclusive. */
  hours: 504,
} as const;

/** The rule, in one sentence — written into PROVENANCE.json so what the slice IS travels with the data. */
export const SLICE_RULE = `every row of both EIA bulk files whose UTC hour-ending stamp falls in [${SLICE_WINDOW.from}, ${SLICE_WINDOW.to}] inclusive, keeping the named columns and dropping the rest; EIA's header text and cell text are copied unchanged, so every committed line appears verbatim in the bulk file it came from; no authority, no link and no silence is filtered out`;

/** The ordering law, in one sentence. */
export const SLICE_ORDER = "EIA's own row order, preserved — the cut never sorts, so the same bulk file always cuts to the same bytes";

/** Columns kept from `EIA930_BALANCE_*.csv`, in EIA's original order and with EIA's exact header text. */
export const BALANCE_SLICE_COLUMNS: readonly string[] = [
  BALANCE_COLUMNS.authority,
  BALANCE_COLUMNS.local,
  BALANCE_COLUMNS.utc,
  BALANCE_COLUMNS.forecast,
  BALANCE_COLUMNS.demand,
  BALANCE_COLUMNS.generation,
  BALANCE_COLUMNS.interchange,
  BALANCE_COLUMNS.dibasSum,
  BALANCE_COLUMNS.demandImputed,
  BALANCE_COLUMNS.generationImputed,
  BALANCE_COLUMNS.interchangeImputed,
  BALANCE_COLUMNS.demandAdjusted,
  BALANCE_COLUMNS.generationAdjusted,
  BALANCE_COLUMNS.interchangeAdjusted,
  BALANCE_COLUMNS.region,
];

/** Columns kept from `EIA930_INTERCHANGE_*.csv`, in EIA's original order and with EIA's exact header text. */
export const INTERCHANGE_SLICE_COLUMNS: readonly string[] = [
  INTERCHANGE_COLUMNS.authority,
  INTERCHANGE_COLUMNS.neighbour,
  INTERCHANGE_COLUMNS.mw,
  INTERCHANGE_COLUMNS.utc,
  INTERCHANGE_COLUMNS.neighbourRegion,
];

/** What the cut drops, and why — the honest other half of what it keeps. */
export const DROPPED_COLUMNS: readonly { readonly file: string; readonly columns: string; readonly why: string }[] = [
  {
    file: 'balance',
    columns: '48 generation-mix columns — every "Net Generation (MW) from <fuel>" and its (Imputed) and (Adjusted) twins',
    why: 'they are 18%–100% empty, and an empty one does not distinguish "this authority has no wind at all" from "this authority did not report its wind this hour". EIA publishes no capacity list in these files that would separate the two, so keeping them would force this demo to guess at exactly the distinction it exists to refuse. The fetcher keeps the whole file; a fuel-mix demo regenerates it.',
  },
  {
    file: 'interchange',
    columns: '"Data Date", "Hour Number", "Local Time at End of Hour", "Region"',
    why: 'all four are repeated on every one of the ~300 flow rows an hour carries, and all four are already known: the first three from the UTC stamp plus the authority\'s own local clock in the balance file, the fourth from the balance file\'s Region column, which covers all 62 reporting authorities. "DIBA_Region" is kept precisely because it is NOT derivable — it is the only place the eight Canadian and Mexican interties are ever described.',
  },
];

/** What a reader loses by having the slice rather than the whole six months — stated, not implied. */
export const SLICE_LOSS =
  'three weeks instead of six months: no winter peak, no summer peak, no seasonal shape, and no answer to "is this hour unusual for the year?" — the window is late-spring shoulder season throughout. Also gone: the March 9 daylight-saving hour, the other 1,916 empty interchange cells and every imputation outside the window, and the generation mix. Nothing structural is lost — all 70 authorities, all 303 directed links, both authorities that arrive or leave, and every class of silence are inside the window.';

/** Whether one hour-ending instant is inside the committed window. */
export function inWindow(ms: number): boolean {
  return ms >= Date.parse(SLICE_WINDOW.from) && ms <= Date.parse(SLICE_WINDOW.to);
}

/** What the fetcher vouched for about one downloaded bulk file. */
export interface RawFile {
  readonly table: string;
  readonly file: string;
  readonly url: string;
  readonly bytes: number;
  readonly lastModified: string | null;
  readonly sha256: string;
  /** When THIS file was downloaded — a run that finds it already whole keeps the stamp of the run that fetched it. */
  readonly retrievedAt: string;
}

/** The fetcher's record, read back from `data/grid/raw/PROVENANCE.json` — facts about the download, never retyped. */
export interface RawProvenance {
  readonly source: string;
  readonly agency: string;
  readonly page: string;
  readonly period: string;
  readonly license: string;
  readonly acknowledgement: string;
  readonly trademark: string;
  readonly reuseTerms: string;
  readonly files: readonly RawFile[];
  readonly retrievedAt: string;
}

/** Rows written and rows read, per file — the cut's own honest counters. */
export interface SliceCounts {
  readonly balance: { readonly read: number; readonly kept: number };
  readonly interchange: { readonly read: number; readonly kept: number };
}

/**
 * The slice's provenance, as an object.
 *
 * Nothing here reads a clock: `retrievedAt` and the two SHA-256 digests are the
 * FETCHER's facts about its download, copied from `raw/PROVENANCE.json`, and a
 * digest is what binds this slice to the exact bytes it was cut from — a row
 * count names a fetch, a hash names a content. So two runs of the generator over
 * one download write byte-identical files.
 */
export function sliceProvenance(raw: RawProvenance, sliced: SliceCounts, tables: GridCounts, generator: string): unknown {
  return {
    source: raw.source,
    agency: raw.agency,
    page: raw.page,
    period: raw.period,
    license: {
      statement: raw.license,
      acknowledgement: raw.acknowledgement,
      trademark: raw.trademark,
      terms: raw.reuseTerms,
    },
    derivedFrom: {
      retrievedAt: raw.retrievedAt,
      files: raw.files.map((f) => ({ table: f.table, url: f.url, bytes: f.bytes, lastModified: f.lastModified, sha256: f.sha256, retrievedAt: f.retrievedAt })),
    },
    slice: {
      window: { from: SLICE_WINDOW.from, to: SLICE_WINDOW.to, hours: SLICE_WINDOW.hours },
      rule: SLICE_RULE,
      order: SLICE_ORDER,
      columns: { balance: BALANCE_SLICE_COLUMNS, interchange: INTERCHANGE_SLICE_COLUMNS },
      dropped: DROPPED_COLUMNS,
      loses: SLICE_LOSS,
    },
    rows: {
      'balance.csv': { read: sliced.balance.read, kept: sliced.balance.kept },
      'interchange.csv': { read: sliced.interchange.read, kept: sliced.interchange.kept },
    },
    counts: tables,
    absence: { states: ABSENCE_STATES, field: ABSENCE_FIELD, rule: ABSENCE_RULE },
    names: NAMES_SOURCE,
    generator,
    // the repo's own scripts, now that they exist — `npm run data:grid` is
    // `node data/grid/fetch.mjs` and `npm run grid:generate` is this generator
    regenerate: 'npm run data:grid && npm run grid:generate',
    whole: 'The full six months are not committed (149 MB). `npm run data:grid` downloads both bulk files into data/grid/raw/ (git-ignored); point the same ETL at them — gridTables(balanceCsv, interchangeCsv) reads EIA\'s shape directly — for the large-scale demo.',
    // WHY: the byte-stability promise — a stamp of when the generator ran would make two runs over one download differ for no reason a reader can use
    note: 'Derived data: no wall-clock stamp, so two runs over the same download write the same bytes. Regenerate after npm run data:grid; never edit by hand.',
  };
}
