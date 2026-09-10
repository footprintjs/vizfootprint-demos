/**
 * THE SLICE — which rows and which columns of the NASA Exoplanet Archive are
 * committed, and the record that travels with them. The rule lives here, in one
 * place, so the generator, the provenance and this repo's prose can never
 * disagree.
 *
 * ── THE CUT IS THE QUERY ────────────────────────────────────────────────────
 * The grid demo downloads 149 MB of bulk CSV and cuts a window out of it. There
 * is nothing to cut here: TAP answers with exactly the rows and columns the
 * query asked for, so what `data/exo/fetch.mjs` wrote IS the committed slice,
 * and the query text — the whole cut, verbatim — is in `data/exo/FETCH.json`.
 * Nothing transforms the bytes afterwards. Every committed line is a line the
 * archive sent.
 *
 * ── THE ONE JUDGEMENT ───────────────────────────────────────────────────────
 * `ps` holds 40,144 rows and only 20,598 of them are published literature
 * solutions; the rest are project CANDIDATE rows — six Kepler KOI pipeline
 * lists, TESS project candidates, and papers' own candidate solutions. The
 * query keeps `soltype = 'Published Confirmed'` and drops them, for two
 * reasons: view 2 asks "how many publications measured this planet", which a
 * pipeline's repeated re-fit of the same star would inflate; and `pscomppars`,
 * the composite this demo compares against, is built over confirmed planets
 * only, so keeping candidates would leave the two tables describing different
 * sets of planets. `soltype` is KEPT as a column so the cut is checkable with
 * grep rather than with trust.
 *
 * ── WHY NOT A SUBSET OF PLANETS ─────────────────────────────────────────────
 * The grid cuts time because cutting authorities would have damaged the network
 * it exists to draw. The same logic applies here and points the same way: this
 * demo is about one planet's many published numbers disagreeing, so cutting
 * planets would be cutting the population the disagreement is measured over,
 * while cutting the CANDIDATE ROWS removes a different kind of row entirely and
 * leaves every confirmed planet, every publication and every silence standing.
 */
import { ABSENCE_FIELD, ABSENCE_RULE, ABSENCE_STATES, CARRIES } from './absence.js';
import { PSCOMPPARS_COLUMNS, PS_COLUMNS, type ExoCounts } from './etl.js';
import { NAMES_SOURCE } from './names.js';

/** The WHERE clause the fetch runs on `ps`, spelled here so a test can hold `data/exo/FETCH.json` to it. */
export const CONFIRMED_ONLY = "soltype = 'Published Confirmed'";

/** The rule, in one sentence — written into PROVENANCE.json so what the slice IS travels with the data. */
export const SLICE_RULE = `two TAP queries, verbatim in data/exo/FETCH.json: every column named there from ${'`pscomppars`'} (one row per confirmed planet, the archive's composite), and the same for ${'`ps`'} narrowed to ${CONFIRMED_ONLY} — every published literature solution for those planets, with the project-candidate rows dropped. TAP answered with these bytes; nothing was cut, sorted or rewritten afterwards, so every committed line is a line the archive sent`;

/** The ordering law, in one sentence. */
export const SLICE_ORDER =
  "the query's own ORDER BY (ps by pl_name, pl_pubdate, pl_refname; pscomppars by pl_name) — TAP promises no row order, so the order is asked for, which is what makes two fetches of unchanged data byte-identical AND what makes a minted measurement_id stable";

/** What the cut drops, and why — the honest other half of what it keeps. */
export const DROPPED: readonly { readonly table: string; readonly what: string; readonly why: string }[] = [
  {
    table: 'ps',
    what: '19,546 project-candidate rows (six Kepler KOI pipeline lists, TESS project candidates, and papers\' own candidate solutions)',
    why: 'they are not published literature solutions for a confirmed planet, and counting a pipeline\'s repeated re-fit of one star as "another publication measured it" would inflate the exact number view 2 shows. The composite table is confirmed-only, so keeping them would also leave the two tables describing different sets of planets.',
  },
  {
    table: 'ps',
    what: '334 of the 355 columns — every stellar parameter, every other orbital element, the positions, the magnitudes, and the release/update stamps',
    why: 'this demo asks one question — does the accepted number agree with the published ones — and it asks it of radius, mass and period. A column nothing on screen reads is 6 MB a reader downloads for nothing. The whole table is one query away (`data/exo/README.md` says how), and the fetch script\'s column list is where a second question would be added.',
  },
  {
    table: 'pscomppars',
    what: '382 of the 399 columns — including the `*err1`/`*err2` uncertainty pair on every parameter',
    why: 'the composite\'s uncertainties are kept out deliberately: this demo compares the composite\'s CHOICE against the publications, and the measurements table carries the published uncertainties (`pl_radeerr1`, `pl_radeerr2`) where the comparison is actually made. Keeping both would invite a reader to read an error bar off the composite as though it were a measurement of its own.',
  },
];

/** What a reader loses by having the slice rather than the whole archive — stated, not implied. */
export const SLICE_LOSES =
  'no candidate planets and no candidate solutions, so nothing here can say how a candidate becomes confirmed; no stellar properties, so a planet cannot be read against its host; no uncertainties on the composite; and no atmospheric, imaging or microlensing tables at all. Nothing structural is lost for the question this demo asks: all 6,360 confirmed planets, all 20,598 published solutions for them, every reference either table points at, and every limit and every not-measured cell are inside the slice';

/** One table as the fetch recorded it — the shape of `data/exo/FETCH.json`. */
export interface FetchedTable {
  readonly table: string;
  readonly file: string;
  readonly doi: string;
  readonly doiName: string;
  /** The query, verbatim — the whole cut. */
  readonly query: string;
  readonly columns: readonly string[];
  readonly where?: string;
  readonly rows: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly retrievedAt: string;
}

/** The fetch's own record, read from the file it wrote — never retyped. */
export interface FetchedRecord {
  readonly source: string;
  readonly archive: string;
  readonly page: string;
  readonly service: string;
  readonly acknowledgementPage: string;
  readonly acknowledgement: string;
  readonly citationNote: string;
  readonly doiPage: string;
  readonly license: string;
  readonly tables: readonly FetchedTable[];
  readonly retrievedAt: string;
  readonly note: string;
}

/** The columns the ETL actually reads, per table — what a test holds the committed query to. */
export const ETL_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  ps: Object.values(PS_COLUMNS),
  pscomppars: Object.values(PSCOMPPARS_COLUMNS),
};

/**
 * The slice's provenance: the fetch's own record, the rule, and the counts the
 * ETL reports over the files it just read.
 *
 * Nothing here reads a clock. The only timestamps are the FETCH's, which are
 * facts about the download, so two runs of the generator over one download
 * write the same bytes.
 */
export function sliceProvenance(fetched: FetchedRecord, counts: ExoCounts, generator: string): Record<string, unknown> {
  return {
    source: fetched.source,
    archive: fetched.archive,
    page: fetched.page,
    service: fetched.service,
    license: {
      statement: fetched.license,
      acknowledgement: fetched.acknowledgement,
      acknowledgementPage: fetched.acknowledgementPage,
      citation: fetched.citationNote,
      identifiers: fetched.tables.map((t) => ({ table: t.table, name: t.doiName, doi: t.doi })),
      identifiersPage: fetched.doiPage,
    },
    derivedFrom: {
      retrievedAt: fetched.retrievedAt,
      tables: fetched.tables.map((t) => ({ table: t.table, file: t.file, query: t.query, rows: t.rows, bytes: t.bytes, sha256: t.sha256, retrievedAt: t.retrievedAt })),
    },
    slice: { rule: SLICE_RULE, order: SLICE_ORDER, columns: Object.fromEntries(fetched.tables.map((t) => [t.table, t.columns])), dropped: DROPPED, loses: SLICE_LOSES },
    rows: Object.fromEntries(fetched.tables.map((t) => [t.file, t.rows])),
    tables: { measurements: counts.measurements, planets: counts.planets, references: counts.references },
    counts,
    absence: { field: ABSENCE_FIELD, states: [...ABSENCE_STATES], carries: [...CARRIES], rule: ABSENCE_RULE },
    names: NAMES_SOURCE,
    generator,
    regenerate: 'npm run data:exo && npm run exo:generate',
    whole: 'The archive is not committed. `data/exo/fetch.mjs` names the two queries; widening its column lists (or dropping its WHERE clause) and re-running re-cuts the slice, and the same ETL reads whatever comes back — exoTables(psCsv, pscompparsCsv) reads the archive\'s shape directly.',
    note: 'Derived data: no wall-clock stamp of its own, so two runs over the same download write the same bytes. Regenerate after npm run data:exo; never edit by hand.',
  };
}
