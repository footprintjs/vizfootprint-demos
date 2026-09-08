/**
 * CASES PER HUNDRED THOUSAND PEOPLE — the column this demo could not compute.
 *
 * "Texas reported 900 cases" and "Wyoming reported 40" are the same sentence
 * about two very different places. Until `data/population/` was fetched there
 * was nothing to divide by, and no way to reach it if there had been: the
 * library's grammar has no `lookup` op on purpose, because a node carrying its
 * own `{ table, key, value }` could name a join nobody declared.
 *
 * So the rate is TWO ORDINARY ACTS across ONE DECLARED RELATION:
 *
 *   cells.jurisdiction → population.jurisdiction     (declared in the def)
 *   bringPopulation                                   → jurisdiction_population
 *   casesPer100k    cases / jurisdiction_population * 100000
 *
 * These pin the whole chain: the def declares the denominator and the join, the
 * two acts land as commits, a state's number is its own cases per hundred
 * thousand people, a place with no population gets NO rate rather than a made-up
 * one, a silence stays a silence, the second act is refused before the first has
 * run, and a replay of the log rebuilds both from bytes alone.
 */
import { describe, expect, it } from 'vitest';
import { buildDashboard } from 'vizfootprint/def';
import type { Cause } from 'vizfootprint/cause';
import { nndssDef } from '../src/nndss/def.js';
import { loadPopulation, loadSnapshot } from '../src/nndss/snapshot.js';
import { POPULATION_ON_CELLS, POPULATION_TABLE, RATE_COLUMN, populationRows, type PopulationRow } from '../src/nndss/population.js';
import type { NndssTables } from '../src/nndss/etl.js';

const cause: Cause = { requestedBy: 'user', computedBy: 'user', intent: 'ask for a rate' };

/** The real committed denominator — 52 places, fetched from the Census Bureau with its provenance beside it. */
const POPULATION = loadPopulation();
const PEOPLE = new Map(POPULATION.map((row) => [row.jurisdiction, row.population] as const));

/**
 * Cells small enough to count by hand, over jurisdictions the committed
 * population file really carries — plus the two kinds of row it does not: a
 * census division, and a cell the source could not report.
 */
const CELLS = [
  { jurisdiction: 'Texas', kind: 'state', disease: 'Measles', cases: 90, report_state: 'present', flag: null, ytd: 90, prev52_max: 9, t: '2026-01-03', week_index: 1 },
  { jurisdiction: 'Wyoming', kind: 'state', disease: 'Measles', cases: 40, report_state: 'present', flag: null, ytd: 40, prev52_max: 4, t: '2026-01-03', week_index: 1 },
  { jurisdiction: 'New England', kind: 'region', disease: 'Measles', cases: 130, report_state: 'present', flag: null, ytd: 130, prev52_max: 13, t: '2026-01-03', week_index: 1 },
  { jurisdiction: 'Texas', kind: 'state', disease: 'Mumps', cases: 0, report_state: 'unavailable', flag: 'U', ytd: null, prev52_max: null, t: '2026-01-03', week_index: 1 },
] as unknown as NndssTables['cells'];

const TABLES = {
  cells: CELLS,
  jurisdictions: [{ jurisdiction: 'Texas', kind: 'state', lat: 31, lon: -99 }] as unknown as NndssTables['jurisdictions'],
  series: [{ t: '2026-01-03', entity: 'Texas', metric: 'cases', value: 90, entity_kind: 'state', week_index: 1 }] as unknown as NndssTables['series'],
  grain: { bucket: 'week', reducer: 'sum' },
  population: POPULATION,
} as unknown as NndssTables;

type Session = ReturnType<ReturnType<typeof buildDashboard>['createSession']>;

const sessionOver = (tables: NndssTables = TABLES): Session => buildDashboard(nndssDef(tables)).createSession({ as: 'user' });

/** Both acts, in the order they must run. */
async function landTheRate(session: Session): Promise<void> {
  const brought = await session.declareAnalysis('bringPopulation', { cause });
  expect(brought.materialized).toEqual([POPULATION_ON_CELLS]);
  expect(brought.gap).toBeUndefined();
  const rate = await session.declareAnalysis('casesPer100k', { cause });
  expect(rate.materialized).toEqual([RATE_COLUMN]);
  expect(rate.gap).toBeUndefined();
}

/** The four cells at the cursor, as `{jurisdiction, cases, rate}`. */
async function ratesOf(session: Session, limit = 10): Promise<{ jurisdiction: unknown; cases: unknown; rate: unknown }[]> {
  const res = await session.viewQuery({ columns: ['jurisdiction', 'cases', RATE_COLUMN], limit });
  if (!res.ok) throw new Error(`the read was refused: ${res.rejected}`);
  return res.rows.map((row) => ({ jurisdiction: row['jurisdiction'], cases: row['cases'], rate: row[RATE_COLUMN] }));
}

describe('the denominator is declared, not looked up', () => {
  it('the def carries the table, its key, the relation and the two acts — and none of them without the data', () => {
    const withPopulation = nndssDef(TABLES);
    expect(Object.keys(withPopulation.data)).toContain(POPULATION_TABLE);
    expect(withPopulation.data[POPULATION_TABLE]?.key).toBe('jurisdiction');
    expect(withPopulation.relations).toContainEqual({
      from: { table: 'cells', column: 'jurisdiction' },
      to: { table: POPULATION_TABLE, column: 'jurisdiction' },
      label: 'how many people live there',
    });
    expect(Object.keys(withPopulation.analyses ?? {})).toEqual(expect.arrayContaining(['bringPopulation', 'casesPer100k']));

    // hand in no population and the def declares no table, no relation and no
    // act — never a table with no rows, and never an act over a table nobody declared
    const without = nndssDef({ ...TABLES, population: undefined } as NndssTables);
    expect(Object.keys(without.data)).not.toContain(POPULATION_TABLE);
    expect(without.relations).toBeUndefined();
    expect(Object.keys(without.analyses ?? {})).not.toContain('casesPer100k');
  });

  it('the committed file is one row per place, which is what lets a relation point at it', () => {
    expect(POPULATION.length).toBeGreaterThan(50);
    expect(new Set(POPULATION.map((row) => row.jurisdiction)).size).toBe(POPULATION.length);
    for (const row of POPULATION) expect(row.population, row.jurisdiction).toBeGreaterThan(0);
    // and the names are the Census Bureau's own, unedited — which is what makes the join a join
    expect(PEOPLE.get('Texas')).toBeGreaterThan(20_000_000);
    expect(PEOPLE.has('New England')).toBe(false);
  });

  it('reads a row only when it carries both numbers, and never guesses at one it does not', () => {
    expect(populationRows('jurisdiction,population,vintage\n"Texas",100,2024\n')).toEqual([{ jurisdiction: 'Texas', population: 100, vintage: 2024 }]);
    expect(populationRows('jurisdiction,population,vintage\n"",100,2024\n"Ohio",,2024\n"Utah",many,2024\n')).toEqual([]);
    // a file with no vintage column is readable, and the year is simply NOT
    // CLAIMED — a year nobody wrote down does not become a zero
    expect(populationRows('jurisdiction,population\n"Texas",100\n')).toEqual([{ jurisdiction: 'Texas', population: 100 }]);
  });
});

describe('the rate lands as two acts, and says what it could not answer', () => {
  it('a state’s number is its own cases per hundred thousand people', async () => {
    const session = sessionOver();
    await landTheRate(session);
    const rows = await ratesOf(session);

    const texas = rows.find((row) => row.jurisdiction === 'Texas')!;
    expect(texas.rate).toBe((90 / PEOPLE.get('Texas')!) * 100000);
    const wyoming = rows.find((row) => row.jurisdiction === 'Wyoming')!;
    expect(wyoming.rate).toBe((40 / PEOPLE.get('Wyoming')!) * 100000);

    // THE POINT OF THE COLUMN: Texas reported more than twice Wyoming's cases
    // and has the lower rate, which the counts alone say the other way round
    expect(texas.cases as number).toBeGreaterThan(wyoming.cases as number);
    expect(texas.rate as number).toBeLessThan(wyoming.rate as number);
  });

  it('a place with no population gets NO rate — the silence is the honest answer', async () => {
    const session = sessionOver();
    await landTheRate(session);
    const rows = await ratesOf(session);
    // a census division: NNDSS files it, the estimates file does not carry it
    expect(rows.find((row) => row.jurisdiction === 'New England')!.rate).toBe(null);
  });

  it('a cell the source could not report has no rate either — a reported nothing is not a zero', async () => {
    const session = sessionOver();
    await landTheRate(session);
    const rows = await ratesOf(session);
    // Texas/Mumps carries `cases = 0` under `report_state: unavailable`; the
    // absence law makes it absent, so the rate is absent and not 0 per 100k
    const silent = rows.filter((row) => row.jurisdiction === 'Texas');
    expect(silent.map((row) => row.rate)).toEqual([(90 / PEOPLE.get('Texas')!) * 100000, null]);
  });

  it('refuses the rate before the denominator is there, naming the column it could not read', async () => {
    const session = sessionOver();
    const early = await session.declareAnalysis('casesPer100k', { cause });
    // nothing landed at all — not an empty list of columns, but no act
    expect(early.materialized).toBeUndefined();
    expect(early.gap?.code).toBe('derive-invalid');
    expect(early.gap?.detail).toContain(`this column reads "${POPULATION_ON_CELLS}", which table "cells" does not have`);
    expect(session.commits('anywhere')).toHaveLength(0);
  });

  it('a replay of the log rebuilds both acts from bytes alone', async () => {
    const source = sessionOver();
    await landTheRate(source);
    const before = await ratesOf(source);

    const fresh = sessionOver();
    const replayed = await fresh.replay(JSON.stringify(source.log.records));
    expect(replayed).toMatchObject({ ok: true, landed: 2, reran: 2, filed: 0 });
    expect(await ratesOf(fresh)).toEqual(before);
  });
});

describe('over the shipped snapshot, not a fixture', () => {
  it('both acts land over CDC’s own rows, and every rate in the window is that place’s own', async () => {
    const tables: NndssTables = { ...loadSnapshot(), population: POPULATION };
    const session = sessionOver(tables);
    await landTheRate(session);

    const window = await session.viewQuery({ columns: ['jurisdiction', 'cases', RATE_COLUMN], limit: 400 });
    expect(window.ok).toBe(true);
    if (!window.ok) return;
    expect(window.rows).toHaveLength(400);

    let rated = 0;
    let silent = 0;
    for (const row of window.rows) {
      const people = PEOPLE.get(String(row['jurisdiction']));
      const cases = row['cases'];
      const rate = row[RATE_COLUMN];
      if (people === undefined || typeof cases !== 'number') {
        // no denominator, or no count: absent, never a number nobody can account for
        expect(rate, String(row['jurisdiction'])).toBe(null);
        silent += 1;
        continue;
      }
      expect(rate, String(row['jurisdiction'])).toBe((cases / people) * 100000);
      rated += 1;
    }
    // the window really carries both kinds — a test that saw only one would be
    // pinning half the claim
    expect(rated).toBeGreaterThan(0);
    expect(silent).toBeGreaterThan(0);
  });
});
