/**
 * THE EXOPLANET SURFACE — five acts, landed, and what they leave behind.
 *
 * This is the test that matters for the demo's claim. Nothing about a spread, a
 * disagreement or a delta is in the committed CSVs; all of it is the output of
 * acts this def declares and this surface dispatches. So these pin:
 *
 *   - that all five land, in order, as commits on the log;
 *   - that the aggregate mints a TABLE, one row per planet with a published
 *     radius — a count that is NOT the planet count, and the difference is the
 *     silence the histogram's caption has to name;
 *   - that the two derives write onto that minted table;
 *   - that the bring-over carries the composite's accepted radius across the
 *     declared relation, and the delta subtracts it — checked against ONE named
 *     planet whose numbers a person can look up;
 *   - that a bound answers NOTHING, because the delta's own declaration says so;
 *   - and that the built dashboard's data checks are clean.
 *
 * It runs over the REAL committed slice: 20,598 rows through five acts is what
 * the page does on entry, and a test over a fixture would not have caught the
 * one thing worth catching here.
 */
import { describe, expect, it } from 'vitest';
import { ACCEPTED_RADIUS_COLUMN, DELTA_COLUMN, DISAGREES_COLUMN, EXO_ACT_ORDER, RADII_PER_PLANET, SCATTER_ADDRESS, SHEET_VIEW, SPREAD_ADDRESS, SPREAD_COLUMN } from '../src/exo/def.js';
import { SPREAD_BUCKET } from '../src/exo/session.js';
import { buildExoSurfaceAsync } from '../src/exo/surface.js';
import { exoRows } from '../src/exo/rows.js';
import { loadExo } from '../src/exo/snapshot.js';

/** ONE planet a person can look up: three published radii in the slice, and a composite that matches none of them exactly. */
const PLANET = 'TRAPPIST-1 e';

const tables = loadExo();
const surface = await buildExoSurfaceAsync(tables);

describe('the five acts land as commits, and nothing refuses', () => {
  it('refuses nothing, and the data checks are clean', async () => {
    expect(surface.actRefusals).toEqual([]);
    expect(await surface.dashboard.lintData()).toEqual([]);
  });

  it('every act is on the log, in the order the def declares them', () => {
    // an analyze commit is recorded under `analysis:<id>` — the log's own spelling
    const analyses = surface.session.log.records.filter((c) => c.viewId.startsWith('analysis:'));
    expect(analyses.map((c) => c.viewId)).toEqual(EXO_ACT_ORDER.map((a) => `analysis:${a.id}`));
    expect(analyses.length).toBe(EXO_ACT_ORDER.length);
    // the cause's intent is the def's own sentence, so the ledger and the definition cannot drift
    expect(analyses.map((c) => c.cause?.intent)).toEqual(EXO_ACT_ORDER.map((a) => a.intent));
  });
});

describe('the aggregate mints a table the data does not have', () => {
  it('one row per planet WITH a published radius — fewer than the planets, and that gap is the silence', () => {
    const rows = surface.derived.rows;
    expect(surface.derived.refused).toBeNull();
    const withRadius = new Set(tables.measurements.filter((m) => m.radius_state === 'present').map((m) => m.pl_name));
    expect(rows.length).toBe(withRadius.size);
    // …and it is NOT the planet count: the planets with no published radius are in no bar at all
    expect(rows.length).toBeLessThan(tables.planets.length);
    expect(tables.planets.length - rows.length).toBeGreaterThan(0);
  });

  it('carries the four measures and the two derived columns on every row', () => {
    const row = surface.derived.rows.find((r) => r['pl_name'] === PLANET);
    expect(row).toBeDefined();
    expect(Object.keys(row ?? {}).sort()).toEqual(['disagrees', 'pl_name', 'r_max', 'r_min', 'radii', 'refs', 'spread'].sort());
  });

  it('the spread is the largest published radius minus the smallest, and `disagrees` is that width above zero', () => {
    const published = tables.measurements.filter((m) => m.pl_name === PLANET && m.radius_state === 'present').map((m) => Number(m.pl_rade));
    expect(published.length).toBeGreaterThan(1);
    const row = surface.derived.rows.find((r) => r['pl_name'] === PLANET);
    expect(row?.['radii']).toBe(published.length);
    expect(row?.['r_min']).toBe(Math.min(...published));
    expect(row?.['r_max']).toBe(Math.max(...published));
    expect(Number(row?.[SPREAD_COLUMN])).toBeCloseTo(Math.max(...published) - Math.min(...published), 10);
    expect(row?.[DISAGREES_COLUMN]).toBe(Math.max(...published) > Math.min(...published));
  });

  it('every planet in the minted table disagrees with itself, or has exactly one radius', () => {
    // a fact about the DATA, read off the act's own output: a planet with one published
    // radius cannot disagree, and one with several almost always does
    const single = surface.derived.rows.filter((r) => r['radii'] === 1);
    expect(single.every((r) => r[DISAGREES_COLUMN] === false && r[SPREAD_COLUMN] === 0)).toBe(true);
    const several = surface.derived.rows.filter((r) => Number(r['radii']) > 1);
    expect(several.length).toBeGreaterThan(1000);
  });
});

describe('the bring-over and the delta put the two numbers side by side', () => {
  /** The whole table at the cursor — `viewId: null` is "no clause at all", the only honest way to read every row. */
  const wholeTable = async (): Promise<readonly Record<string, unknown>[]> => {
    const window = await surface.session.viewQuery({ table: 'measurements', viewId: null, limit: tables.measurements.length });
    expect(window.ok).toBe(true);
    return window.ok ? window.rows : [];
  };

  it('carries the accepted radius onto every measurement row, under the name the library produces', async () => {
    const rows = (await wholeTable()).filter((r) => r['pl_name'] === PLANET);
    expect(rows.length).toBeGreaterThan(2);
    const accepted = tables.planets.find((p) => p.pl_name === PLANET)?.pl_rade;
    expect(typeof accepted).toBe('number');
    expect(rows.every((r) => r[ACCEPTED_RADIUS_COLUMN] === accepted)).toBe(true);
  });

  it('the delta is this publication\'s radius minus the accepted one — and NOTHING where the radius is not a measurement', async () => {
    const rows = (await wholeTable()).filter((r) => r['pl_name'] === PLANET);
    const accepted = Number(tables.planets.find((p) => p.pl_name === PLANET)?.pl_rade);
    for (const row of rows) {
      if (row['radius_state'] === 'present') expect(Number(row[DELTA_COLUMN])).toBeCloseTo(Number(row['pl_rade']) - accepted, 10);
      else expect(row[DELTA_COLUMN]).toBeNull();
    }
    // at least one publication really does disagree with the accepted value
    expect(rows.some((r) => typeof r[DELTA_COLUMN] === 'number' && r[DELTA_COLUMN] !== 0)).toBe(true);
  });

  it('a BOUND keeps its number and still gets no delta — the declaration says so, not a law nobody can see', async () => {
    const bounded = tables.measurements.find((m) => m.radius_state === 'limit');
    expect(bounded?.pl_rade).toBeTypeOf('number');
    const row = (await wholeTable()).find((r) => r['measurement_id'] === bounded?.measurement_id);
    expect(row?.['pl_rade']).toBe(bounded?.pl_rade);
    expect(row?.[DELTA_COLUMN]).toBeNull();
  });
});

describe('the declared link is what fills the sheet', () => {
  it('a planet picked on the scatter is whose publications the sheet lists — and clearing it gives them all back', async () => {
    const cause = { requestedBy: 'user' as const, computedBy: 'user' as const, intent: `read every published value for ${PLANET}` };
    const picked = await surface.session.dispatch({ verb: 'select', viewId: SCATTER_ADDRESS, field: 'pl_name', value: PLANET, cause });
    expect(picked.ok).toBe(true);
    const sheet = await surface.session.viewQuery({ viewId: SHEET_VIEW, table: 'measurements', limit: 100 });
    expect(sheet.ok).toBe(true);
    const rows = sheet.ok ? sheet.rows : [];
    expect(rows.length).toBeGreaterThan(2);
    expect(new Set(rows.map((r) => r['pl_name']))).toEqual(new Set([PLANET]));
    // the sheet reads its window through the LINK GRAPH, and the link that delivered it is the declared one
    expect(sheet.ok && sheet.clauses.some((c) => c.from === SCATTER_ADDRESS && c.response === 'filter')).toBe(true);
    await surface.session.dispatch({ verb: 'select', viewId: SCATTER_ADDRESS, field: 'pl_name', value: null, cause: { ...cause, intent: 'clear the planet' } });
    const all = await surface.session.viewQuery({ viewId: SHEET_VIEW, table: 'measurements', limit: 5 });
    expect(all.ok && all.count).toBe(tables.measurements.length);
  });
});

describe('the histogram over a table an ACT mints — refused before it, landing after it', () => {
  it('the boot collects the library\'s own refusal, and it names the act as the repair', () => {
    // the sentence is the library's, kept verbatim: the view, the table, and the act to perform
    expect(surface.mintedTableRefusal).toBe(`view "${SPREAD_ADDRESS}" draws "${RADII_PER_PLANET}", which the act "radiiPerPlanet" mints — it has not landed on this path`);
    // it landed NOTHING: the log a reader walks holds the five acts and no sixth commit
    expect(surface.session.log.records.filter((r) => r.viewId === SPREAD_ADDRESS)).toEqual([]);
  });

  it('the same gesture LANDS once the act has, and its clause stays on the minted table', async () => {
    const gesture = { verb: 'filter' as const, viewId: SPREAD_ADDRESS, field: 'radii', range: [...SPREAD_BUCKET] as [number, number] };
    const landed = await surface.session.dispatch({ ...gesture, cause: { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'the planets with one published radius' } });
    expect(landed.ok).toBe(true);
    // …and it reaches no other view: every default crossfilter edge out of the histogram is declared off,
    // because a `radii` clause would filter a table that has no such column (the def says so in words)
    expect(surface.session.clausesFor(SHEET_VIEW)).toEqual([]);
    const sheet = await surface.session.viewQuery({ viewId: SHEET_VIEW, table: 'measurements', limit: 3 });
    expect(sheet.ok).toBe(true);
    await surface.session.dispatch({ ...gesture, range: null, cause: { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'clear the bucket' } });
  });
});

describe('the payload one page reads', () => {
  it('serves the three declared tables, the minted one, and the vocabulary with the gap named', () => {
    const payload = exoRows(surface);
    expect((payload['measurements'] as readonly unknown[]).length).toBe(20_598);
    expect((payload['planets'] as readonly unknown[]).length).toBe(6_360);
    expect((payload['references'] as readonly unknown[]).length).toBe(2_403);
    expect((payload['derived'] as readonly unknown[]).length).toBe(surface.derived.rows.length);
    expect(payload['derivedRefused']).toBeNull();
    expect(payload['actRefusals']).toEqual([]);
    expect(payload['absence']).toMatchObject({ field: 'radius_state', carries: ['limit'] });
    expect((payload['acts'] as readonly unknown[]).length).toBe(5);
    // the derived table's name is the one the def declared, so a cell can find it
    expect(RADII_PER_PLANET).toBe('radii_per_planet');
  });
});
