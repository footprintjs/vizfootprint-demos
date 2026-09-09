/**
 * THE DENOMINATOR — a second table, a declared relation, and the two acts that
 * turn counts into a rate.
 *
 * A count is not a rate. "Texas reported 900 cases" and "Wyoming reported 40"
 * are the same sentence about two very different places, and until this module
 * existed the demo had nothing to divide by. `data/population/` is the missing
 * half: the U.S. Census Bureau's Vintage 2024 state estimates, fetched with
 * their provenance beside them and committed unedited.
 *
 * ONE ESTIMATE PER PLACE, AS OF JULY 1, 2024 — and the cells are MMWR 2025 and
 * 2026 weeks, so every rate's denominator predates its numerator by one to two
 * years. Using the most recent published vintage is ordinary practice; not
 * saying which year it is, is not. The table's identity is the place, not the
 * place and the year, so a per-year denominator would be a different table.
 *
 * ## The law it follows: a relation is the permission AND the join
 *
 * Nothing here reaches across tables by hand. `cells.jurisdiction →
 * population.jurisdiction` is DECLARED, the population table declares its key,
 * and the bring-over act reads the tie off that declaration — so a reader can
 * see, in the def, exactly which two columns were matched. A record that could
 * name its own join could name one nobody declared.
 *
 * ## Two acts, not one node
 *
 * The library's grammar has no `lookup` op, deliberately (`vizfootprint`'s
 * `src/derive/README.md`, law 12). A derived column reaches a second table in
 * two ordinary commits:
 *
 *   1. `bringPopulation` — carries `population` across the relation and lands
 *      it on `cells` as `jurisdiction_population`, counting every row it could
 *      not follow.
 *   2. `casesPer100k` — `cases / jurisdiction_population * 100000`, a declared
 *      tree over the columns visible at the cursor, which include what act 1
 *      just left there.
 *
 * Both land through `analyze`, at the top of the log, with the whole
 * declaration on the commit — so a replay rebuilds the rate from bytes alone.
 *
 * ## What has no rate, and says so
 *
 * NNDSS files census divisions, roll-ups, the four territories other than
 * Puerto Rico, and one city beside the states. None of them has a row in the
 * estimates file, so none of them gets a denominator.
 *
 * NEW YORK is left out of the denominator here for the opposite reason: it HAS
 * a row, and that row counts the wrong people. CDC files New York City as its
 * own reporting area and the `New York` row EXCLUDES it — the committed
 * snapshot proves it without anyone's outside knowledge, because `Middle
 * Atlantic` equals New Jersey + New York + New York City + Pennsylvania — while
 * the Census estimate of that name counts the whole state, New York City's
 * residents included. A matching NAME is not matching COVERAGE: dividing
 * upstate-only cases by statewide people understates New York by roughly 40%,
 * on every disease and every week, with nothing on the trace to say so. So the
 * name is never offered to the join (see {@link SPLIT_BY_NNDSS}) and New York
 * reads as the same honest silence New York City already reads as.
 *
 * NINETEEN jurisdictions therefore have no denominator — and the bring-over
 * act's counters put how many rows the answer really covers on the trace rather
 * than in somebody's head. The silence is honest; an invented denominator, or
 * one over a different population, would not be.
 *
 * **This module runs in a browser**: reading the committed CSV off disk needs
 * node and lives in `./snapshot.ts`, the same rule `./etl.ts` keeps.
 */
import { broughtColumnName } from 'vizfootprint/analysis';
import { parseCSVTyped } from 'vizfootprint/data';
import type { AnalysisSlot, DataSourceDef, RelationDecl } from 'vizfootprint/agent';
import type { DerivedColumnDecl } from 'vizfootprint/def';

// ── the table ────────────────────────────────────────────────────────────────

/** One place and how many people live in it, as the Census Bureau estimated it. */
export interface PopulationRow {
  /** The Census Bureau's own `NAME`, unedited — which is what makes the join a join. */
  readonly jurisdiction: string;
  readonly population: number;
  /**
   * The estimates vintage the number is from — the year a reader must quote
   * with it. Absent when the file did not say, because a year nobody wrote
   * down is not a year to put in a caption.
   */
  readonly vintage?: number;
  readonly [k: string]: string | number | undefined;
}

/** The committed CSV (or any in its shape) as rows — the CSV door onto the same judge as {@link populationRowsFrom}. */
export function populationRows(csvText: string): PopulationRow[] {
  return populationRowsFrom(parseCSVTyped(csvText).rows);
}

/**
 * The names whose Census row covers a different set of people than the NNDSS
 * row of the same name — so the exact-name join must not match them.
 *
 * WHY New York: CDC files New York City as its own reporting area and the
 * `New York` row excludes it, while the Census `New York` estimate counts
 * NYC's residents too (the module header shows the arithmetic that proves it
 * from the committed snapshot). No row, no rate — the silence New York City
 * already gets, rather than a confident number that is 40% low.
 */
const SPLIT_BY_NNDSS: ReadonlySet<string> = new Set(['New York']);

/**
 * The same narrowing over rows a carrier already typed — the browser's door
 * (`./http.ts` fetches the CSV through the http carrier, which decodes it) and
 * the file door share this one judge, the way `etl.ts` keeps
 * `nndssTablesFromRows` beside `nndssTables`.
 *
 * WHAT IT DROPS, and why dropping beats guessing. A row with no jurisdiction
 * name, or with a population that is not a POSITIVE count of people, has no
 * place and no usable denominator: an invented one would be a number wrong by
 * accident, and a zero admitted here would be worse than absent — the join
 * would follow it and COUNT the row as covered while `cases / 0` came back
 * absent, so the trace would call a place answered and the screen would leave
 * it blank. A row whose name means a different place than NNDSS's row of that
 * name goes the same way ({@link SPLIT_BY_NNDSS}). A missing VINTAGE keeps the
 * row: it is a caption's word, not the join's.
 */
export function populationRowsFrom(typed: readonly Record<string, unknown>[]): PopulationRow[] {
  const rows: PopulationRow[] = [];
  for (const row of typed) {
    const jurisdiction = row['jurisdiction'];
    const population = row['population'];
    const vintage = row['vintage'];
    if (typeof jurisdiction !== 'string' || jurisdiction.length === 0) continue;
    if (SPLIT_BY_NNDSS.has(jurisdiction)) continue;
    if (typeof population !== 'number' || !Number.isFinite(population) || population <= 0) continue;
    rows.push({ jurisdiction, population, ...(typeof vintage === 'number' ? { vintage } : {}) });
  }
  return rows;
}

/** The table's name in the def — spelled once, because the relation and both acts quote it. */
export const POPULATION_TABLE = 'population';
/** The column the bring-over act carries across — named once, because the act's `columns` list and the landed name are both made of it. */
export const POPULATION_COLUMN = 'population';
/** The column `casesPer100k` writes: cases in ONE MMWR week, per 100,000 people. */
export const RATE_COLUMN = 'cases_per_100k';

/**
 * The population table, declared.
 *
 * `key` is what a relation may point at: an IDENTITY, one row per value. The
 * library refuses the bring-over outright if a regenerated file ever carried a
 * place twice, rather than taking whichever row came first.
 */
export function populationTable(rows: readonly PopulationRow[]): DataSourceDef {
  return {
    rows: rows.map((row) => ({ ...row })),
    key: 'jurisdiction',
    columns: {
      jurisdiction: { role: 'identifier', label: 'jurisdiction' },
      population: { role: 'measure', label: 'people (Census estimate)' },
      vintage: { role: 'dimension', label: 'estimates vintage' },
    },
  };
}

/** `cells.jurisdiction → population.jurisdiction` — the permission and the join, in one declaration. */
export const POPULATION_RELATION: RelationDecl = {
  from: { table: 'cells', column: 'jurisdiction' },
  to: { table: POPULATION_TABLE, column: 'jurisdiction' },
  label: 'how many people live there',
};

/**
 * The column `bringPopulation` lands on `cells`.
 *
 * The NAME is the library's grammar, not this file's data: `broughtColumnName`
 * (`vizfootprint/analysis`) joins the RELATION'S OWN column — `jurisdiction`,
 * the column that points across — to the column carried over — `population` —
 * with an underscore, and every reader of these names goes through there.
 *
 * WHY it is written out here rather than called: this must be a LITERAL type.
 * `broughtColumnName` returns `string`, and a `string` here widens every row
 * type that destructures this key away (`NndssCellRow` in `web/src/cells.tsx`)
 * to its index signature. The check below is what keeps the literal honest.
 */
export const POPULATION_ON_CELLS = 'jurisdiction_population';

/**
 * The literal above, judged against the grammar that owns it — once, at load.
 *
 * WHY a throw and not a comment: the two ways this can drift (the relation's
 * column, or the library's separator) are both silent. A demo that will not
 * start beats one whose rate column is a name nothing lands.
 */
const BROUGHT = broughtColumnName(POPULATION_RELATION.from.column, POPULATION_COLUMN);
if (BROUGHT !== POPULATION_ON_CELLS) throw new Error(`the bring-over lands "${BROUGHT}", not "${POPULATION_ON_CELLS}" — the relation's column or the library's spelling moved`);

/**
 * The tree `casesPer100k` lands: `cases / jurisdiction_population * 100000`.
 *
 * A row column — every row has its own answer — and no group, because the
 * denominator is already on the row by the time this runs. It is written down
 * as data, so the commit carries the whole computation and the why-sentence
 * comes from the library's own op table: *"(cases divided by
 * jurisdiction_population) times 100000"*.
 *
 * THE PERIOD, because a rate without one is not a rate: `cases` is ONE MMWR
 * week's count (CDC's `m1`), so this column is a WEEKLY rate, over a
 * denominator of the {@link PopulationRow.vintage} year. The desk's bar SUMS it
 * over the weeks the filter keeps, which makes that bar a cumulative rate over
 * that window and never an annual incidence — so every sentence about it names
 * the window and the vintage, or it is quoting a number nobody can check.
 *
 * AND THE NUMERATOR: a rate over a handful of cases is noise. Under about 20
 * events in the window it is unreliable (the CDC/NCHS convention), because the
 * order at the top of a rate chart is then driven by the denominator rather
 * than by the disease — one case in a small state outranks several in a large
 * one. Read a bar with its case count beside it; never rank on one alone.
 */
export const CASES_PER_100K: DerivedColumnDecl = {
  ops: 1,
  kind: 'row',
  expr: {
    op: 'mul',
    args: [{ op: 'div', args: [{ col: 'cases' }, { col: POPULATION_ON_CELLS }] }, { lit: 100000 }],
  },
};

/**
 * The two acts, in the order they must run: bring the denominator over, then
 * divide by it.
 *
 * ```ts
 * await session.declareAnalysis('bringPopulation', { cause });
 * await session.declareAnalysis('casesPer100k', { cause });
 * ```
 *
 * The second is judged against the columns visible AT THE CURSOR, so declaring
 * it before the first is refused in a sentence naming the column it could not
 * read — not left to produce a column of silences.
 */
export const POPULATION_ANALYSES: Readonly<Record<(typeof POPULATION_ACTS)[number], AnalysisSlot>> = {
  bringPopulation: { builtin: 'bringOver', table: 'cells', from: POPULATION_TABLE, columns: [POPULATION_COLUMN] },
  casesPer100k: { builtin: 'derive', table: 'cells', name: RATE_COLUMN, column: CASES_PER_100K },
};

/**
 * The two act ids IN THE ORDER THEY MUST LAND — the surface dispatches them
 * off this list and the desk's caption names them off it, so the words on
 * screen and the commits on the log cannot spell the acts differently.
 */
export const POPULATION_ACTS = ['bringPopulation', 'casesPer100k'] as const;
