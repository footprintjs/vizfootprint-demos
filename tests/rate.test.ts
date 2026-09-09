/**
 * THE RATE ON THE LIVE DESK — the denominator by default, the two acts at
 * boot, the cells at the cursor, and what the rows door serves.
 *
 * `tests/population.test.ts` pins the two acts by hand, over four cells a
 * person can count. This suite pins the DESK: that the committed snapshot
 * carries the population without being asked, that the async surface lands
 * both acts right after the graph's two, that the cells it serves carry the
 * rate with a silence wherever there was no count or no denominator, that a
 * fresh session rebuilds the same values from the log's bytes, and that the
 * sync surface — which lands nothing — says so instead of serving CDC's rows
 * as if they had a rate.
 *
 * The counts are the honest part: 51 places carry a denominator, 19
 * jurisdictions do not, and every one of the 19 is named by its kind.
 *
 * NEW YORK is one of the 19 although the estimates file DOES carry a row for
 * it: CDC's `New York` row excludes New York City, which it files separately,
 * while the Census row of that name counts NYC's residents — so the name is
 * dropped from the denominator rather than joined to a different population.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDashboard } from 'vizfootprint/def';
import type { Row } from 'vizfootprint/data';
import { nndssDef } from '../src/nndss/def.js';
import { loadGraph, loadPopulation, loadSnapshot } from '../src/nndss/snapshot.js';
import { nndssRows } from '../src/nndss/rows.js';
import { buildNndssSurface, buildNndssSurfaceAsync, landTheRate, type NndssSurface } from '../src/nndss/surface.js';
import { POPULATION_ACTS, POPULATION_ON_CELLS, POPULATION_TABLE, RATE_COLUMN, populationRows } from '../src/nndss/population.js';
import { readFileSync } from 'node:fs';
import type { NndssTables } from '../src/nndss/etl.js';

/** The jurisdictions with no denominator, by CDC's own kind — the 19 the caption must own up to. */
const UNRATED = {
  region: ['New England', 'Middle Atlantic', 'East North Central', 'West North Central', 'South Atlantic', 'East South Central', 'West South Central', 'Mountain', 'Pacific'],
  total: ['U.S. Residents', 'U.S. Territories', 'Non-U.S. Residents', 'Total'],
  // 'New York' is here by DECISION, not by absence: see the file header
  state: ['New York', 'New York City', 'American Samoa', 'Commonwealth of Northern Mariana Islands', 'Guam', 'U.S. Virgin Islands'],
} as const;

let surface: NndssSurface;
beforeAll(async () => {
  surface = await buildNndssSurfaceAsync();
}, 60_000);

/** Every jurisdiction in the rows, split by whether ANY of its cells carries a denominator. */
function placesOf(rows: readonly Row[]): { readonly rated: Set<string>; readonly unrated: Map<string, string> } {
  const rated = new Set<string>();
  const kinds = new Map<string, string>();
  for (const row of rows) {
    kinds.set(String(row['jurisdiction']), String(row['kind']));
    if (typeof row[POPULATION_ON_CELLS] === 'number') rated.add(String(row['jurisdiction']));
  }
  const unrated = new Map([...kinds].filter(([place]) => !rated.has(place)));
  return { rated, unrated };
}

describe('the denominator joins the definition by default', () => {
  it('loadSnapshot() carries the population beside the cells, and the def declares the table, its key, the relation and both acts', () => {
    const tables = loadSnapshot();
    expect(tables.population).toHaveLength(51);
    const def = nndssDef(tables, loadGraph());
    expect(Object.keys(def.data)).toEqual(['cells', 'jurisdictions', 'series', 'nodes', 'edges', POPULATION_TABLE]);
    expect(def.data[POPULATION_TABLE]?.key).toBe('jurisdiction');
    expect(def.relations).toHaveLength(3);
    expect(def.relations?.[2]).toMatchObject({ from: { table: 'cells', column: 'jurisdiction' }, to: { table: POPULATION_TABLE, column: 'jurisdiction' } });
    expect(Object.keys(def.analyses ?? {})).toEqual(expect.arrayContaining([...POPULATION_ACTS]));
    // the rate view, its grain and its encoding are there — and only there
    expect(Object.keys(def.actors)).toContain('rate');
    expect(def.grains?.find((g) => g.viewId === 'rate')?.keys).toEqual(['jurisdiction']);
    expect(def.encodings?.find((e) => e.viewId === 'rate')).toMatchObject({ chartKind: 'bar', initial: { category: 'jurisdiction' } });
  });

  it('the def over the same tables WITHOUT the population declares none of it — no table, no relation, no act, no view, and no walk link into a view that is not there', () => {
    const def = nndssDef({ ...loadSnapshot(), population: undefined } as NndssTables, loadGraph());
    expect(Object.keys(def.data)).not.toContain(POPULATION_TABLE);
    expect(def.relations).toHaveLength(2);
    expect(Object.keys(def.analyses ?? {})).not.toContain('casesPer100k');
    expect(Object.keys(def.actors)).not.toContain('rate');
    expect(def.links?.some((link) => link.target === 'rate')).toBe(false);
    // and the door takes it: a def with a link into an undeclared view is what it refuses
    expect(() => buildDashboard(def)).not.toThrow();
  });

  it('the jurisdiction names match exactly where they match at all — 51 of 70, and the 19 that do not are the ones with no usable denominator', () => {
    const people = new Set(loadPopulation().map((row) => row.jurisdiction));
    const places = loadSnapshot().jurisdictions;
    expect(places).toHaveLength(70);
    const matched = places.filter((place) => people.has(place.jurisdiction));
    expect(matched).toHaveLength(51);
    // every population row names a jurisdiction CDC files — no row of the denominator is orphaned by a spelling
    expect([...people].filter((name) => !places.some((place) => place.jurisdiction === name))).toEqual([]);
    for (const [kind, names] of Object.entries(UNRATED)) for (const name of names) expect(places.find((place) => place.jurisdiction === name)?.kind, name).toBe(kind);
  });

  it('New York is refused the join although the estimates file carries a row for it — a matching name over a different population', () => {
    // CDC files New York City separately, so its `New York` row is the state
    // MINUS the city: the division roll-up only closes when the city is added
    const cells = loadSnapshot().cells;
    const total = (place: string): number => cells.filter((c) => c.jurisdiction === place && c.disease === 'Gonorrhea' && c.cases !== null).reduce((sum, c) => sum + (c.cases ?? 0), 0);
    expect(total('New Jersey') + total('New York') + total('New York City') + total('Pennsylvania')).toBe(total('Middle Atlantic'));
    // the committed file DOES name New York — the drop is this repo's decision, not the Census Bureau's omission
    expect(populationRows(readFileSync('data/population/population.csv', 'utf8').replace('"New York",', '"New York (whole state)",')).some((row) => row.jurisdiction === 'New York (whole state)')).toBe(true);
    expect(loadPopulation().some((row) => row.jurisdiction === 'New York')).toBe(false);
  });
});

describe('the two acts land at boot, on the trace', () => {
  it('right after the graph’s two, with nothing refused', () => {
    expect(surface.layoutRefusals).toEqual([]);
    expect(surface.rateRefusals).toEqual([]);
    const records = surface.session.commits('anywhere') as readonly { readonly viewId?: string }[];
    expect(records.map((r) => r.viewId)).toEqual(['analysis:graphLayout', 'analysis:graphEndpoints', 'analysis:bringPopulation', 'analysis:casesPer100k']);
  });

  it('the cells at the cursor are every cell, carrying both columns — 51 places with a rate, 19 without, each of the 19 named by its kind', () => {
    const { rows, refused } = surface.cellsAtCursor;
    expect(refused).toBeNull();
    expect(rows).toHaveLength(surface.tables.cells.length);
    expect(Object.keys(rows[0]!)).toEqual([...Object.keys(surface.tables.cells[0]!), POPULATION_ON_CELLS, RATE_COLUMN]);
    const { rated, unrated } = placesOf(rows);
    expect(rated.size).toBe(51);
    expect(unrated.size).toBe(19);
    for (const [kind, names] of Object.entries(UNRATED)) expect([...unrated].filter(([, k]) => k === kind).map(([place]) => place).sort()).toEqual([...names].sort());
  });

  it('a silence stays a silence: no count, or no denominator, is a null rate — never a zero — and every number is that place’s own', () => {
    const people = new Map(loadPopulation().map((row) => [row.jurisdiction, row.population] as const));
    let rated = 0;
    let silentCount = 0;
    let silentPlace = 0;
    for (const row of surface.cellsAtCursor.rows) {
      const rate = row[RATE_COLUMN];
      const cases = row['cases'];
      const denominator = people.get(String(row['jurisdiction']));
      if (denominator === undefined) {
        expect(rate).toBeNull();
        silentPlace += 1;
      } else if (typeof cases !== 'number' || row['report_state'] !== 'present') {
        expect(rate).toBeNull();
        silentCount += 1;
      } else {
        expect(rate).toBe((cases / denominator) * 100000);
        rated += 1;
      }
    }
    expect(rated + silentCount + silentPlace).toBe(surface.tables.cells.length);
    // the table really carries all three kinds of row — a suite that saw one would pin a third of the claim
    expect(rated).toBeGreaterThan(0);
    expect(silentCount).toBeGreaterThan(0);
    expect(silentPlace).toBeGreaterThan(0);
  });

  it('a fresh session replays the four commits from bytes alone and lands identical values', async () => {
    const fresh = buildNndssSurface();
    const replayed = await fresh.session.replay(JSON.stringify(surface.session.log.records));
    expect(replayed).toMatchObject({ ok: true, landed: 4, reran: 4, filed: 0 });
    const columns = ['jurisdiction', 'disease', 't', POPULATION_ON_CELLS, RATE_COLUMN];
    const before = surface.cellsAtCursor.rows.map((row) => columns.map((c) => row[c]));
    const after = await fresh.session.viewQuery({ table: 'cells', limit: before.length });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.rows.map((row) => columns.map((c) => row[c]))).toEqual(before);
  }, 60_000);
});

describe('what the rows door serves', () => {
  it('the cells at the cursor, the population table, and no refusal', () => {
    const rows = nndssRows(surface);
    expect(rows['rateRefused']).toBeNull();
    expect(rows['population']).toHaveLength(51);
    expect((rows['cells'] as readonly Row[])[0]).toHaveProperty(RATE_COLUMN);
  });

  it('the sync surface lands no act, and SAYS so — CDC’s rows, the sentence beside them, the population still declared', () => {
    const sync = buildNndssSurface();
    const rows = nndssRows(sync);
    expect(rows['rateRefused']).toContain('the rate acts have not landed on this session');
    expect((rows['cells'] as readonly Row[])[0]).not.toHaveProperty(RATE_COLUMN);
    expect(rows['population']).toHaveLength(51);
    expect(sync.session.commits('anywhere')).toHaveLength(0);
  });

  it('a surface with no population refuses both acts in words before any dispatch, and serves no table', async () => {
    const bare = await buildNndssSurfaceAsync({ ...loadSnapshot(), population: undefined } as NndssTables);
    expect(bare.rateRefusals).toEqual(['this surface declares no population table, so there is no denominator to bring over and no rate to derive']);
    expect(bare.cellsAtCursor.refused).toBe(bare.rateRefusals[0]);
    expect(nndssRows(bare)).not.toHaveProperty('population');
    // the graph's two commits and nothing else
    expect(bare.session.commits('anywhere')).toHaveLength(2);
    // and asking again is the same answer, not a session sentence about an analysis nobody declared
    expect(await landTheRate(bare.session, bare.tables)).toEqual(bare.rateRefusals);
  }, 60_000);
});
