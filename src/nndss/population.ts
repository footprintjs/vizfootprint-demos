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
 * NNDSS files census divisions, roll-ups, four territories and one city beside
 * the states. None of them has a row in the estimates file, so none of them
 * gets a denominator — and the bring-over act's counters put how many rows the
 * answer really covers on the trace rather than in somebody's head. The
 * silence is honest; an invented denominator would not be.
 *
 * **This module runs in a browser**: reading the committed CSV off disk needs
 * node and lives in `./snapshot.ts`, the same rule `./etl.ts` keeps.
 */
import { parseCSVTyped } from 'vizfootprint/data';
import type { AnalysisSlot, DataSourceDef, RelationDecl } from 'vizfootprint/agent';
import type { DerivedColumn } from 'vizfootprint/def';

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

/** The committed CSV (or any in its shape) as rows. A row missing either number is dropped, never guessed at. */
export function populationRows(csvText: string): PopulationRow[] {
  const rows: PopulationRow[] = [];
  for (const row of parseCSVTyped(csvText).rows) {
    const jurisdiction = row['jurisdiction'];
    const population = row['population'];
    const vintage = row['vintage'];
    if (typeof jurisdiction !== 'string' || jurisdiction.length === 0) continue;
    if (typeof population !== 'number' || !Number.isFinite(population)) continue;
    rows.push({ jurisdiction, population, ...(typeof vintage === 'number' ? { vintage } : {}) });
  }
  return rows;
}

/** The table's name in the def — spelled once, because the relation and both acts quote it. */
export const POPULATION_TABLE = 'population';
/** The column `bringPopulation` lands on `cells`: the relation's own column, prefixed by the column that pointed across. */
export const POPULATION_ON_CELLS = 'jurisdiction_population';
/** The column `casesPer100k` writes. */
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
 * The tree `casesPer100k` lands: `cases / jurisdiction_population * 100000`.
 *
 * A row column — every row has its own answer — and no group, because the
 * denominator is already on the row by the time this runs. It is written down
 * as data, so the commit carries the whole computation and the why-sentence
 * comes from the library's own op table: *"(cases divided by
 * jurisdiction_population) times 100000"*.
 */
export const CASES_PER_100K: DerivedColumn = {
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
export const POPULATION_ANALYSES: Readonly<Record<string, AnalysisSlot>> = {
  bringPopulation: { builtin: 'bringOver', table: 'cells', from: POPULATION_TABLE, columns: ['population'] },
  casesPer100k: { builtin: 'derive', table: 'cells', name: RATE_COLUMN, column: CASES_PER_100K },
};
