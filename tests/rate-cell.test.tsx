/**
 * THE RATE CELL — the last hop: the cells at the cursor become bars, and the
 * caption says where the number came from and who has none.
 *
 * `tests/rate.test.ts` proves the two acts land and what they leave on the
 * cells. This proves the cell reads that and nothing else: a bar per place
 * that has a rate, none for a place that does not, a silence adding nothing;
 * a caption naming both acts, the relation and the eighteen; and, on rows the
 * acts never reached, a body that says so rather than a chart of nothing.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_DISEASE, RATE_VIEW, type NndssCellRow, type NndssDeskData } from '../web/src/cells.js';
import { POPULATION_ACTS, POPULATION_ON_CELLS, RATE_COLUMN } from '../src/nndss/population.js';
import { buildNndssSurfaceAsync } from '../src/nndss/surface.js';
import { nndssRows } from '../src/nndss/rows.js';
import { cellsOf, count, textOf } from './deskStub.js';

/** The desk data a surface with a population but no graph hands over. */
const NO_ROWS: NndssDeskData = { cells: [], series: [], diseases: [], weeks: [], absence: { field: 'report_state', states: [] }, grain: {}, geo: null, population: [{ jurisdiction: 'Texas', population: 31_290_831, vintage: 2024 }] };

/** A cell as the cursor serves it: CDC's columns, then the two the acts wrote. */
function cell(jurisdiction: string, kind: string, cases: number | null, people: number | null, t = '2026-01-03', disease = DEFAULT_DISEASE): NndssCellRow {
  const state = cases === null ? 'unavailable' : 'present';
  const rate = cases === null || people === null ? null : (cases / people) * 100000;
  return { jurisdiction, kind, disease, t, cases, report_state: state, [POPULATION_ON_CELLS]: people, [RATE_COLUMN]: rate };
}

/** Six cells a reader can count: two states over two weeks, a state with a silent week, a region and a roll-up with no denominator, and a place filed as a state with none either. */
const CELLS: readonly NndssCellRow[] = [
  cell('Texas', 'state', 90, 30_000_000),
  cell('Texas', 'state', 60, 30_000_000, '2026-01-10'),
  cell('Wyoming', 'state', 40, 500_000),
  cell('Wyoming', 'state', null, 500_000, '2026-01-10'), // a silence: adds nothing
  cell('New England', 'region', 130, null),
  cell('Total', 'total', 900, null),
  cell('Guam', 'state', 3, null),
];
const SIX: NndssDeskData = { ...NO_ROWS, cells: CELLS, diseases: [DEFAULT_DISEASE], weeks: ['2026-01-03', '2026-01-10'] };

const rateCell = (data: NndssDeskData) => cellsOf(data).find((c) => c.id === RATE_VIEW);

describe('the rate cell over rows a person can count', () => {
  it('sits beside the map, and only where the population is declared', () => {
    expect(cellsOf(SIX).map((c) => c.id)).toEqual(['coverage', 'diseases', 'kinds', 'map', RATE_VIEW, 'weeks', 'trend', 'table']);
    expect(cellsOf({ ...SIX, population: undefined }).map((c) => c.id)).not.toContain(RATE_VIEW);
  });

  it('draws one bar per place with a rate, summed over the kept weeks — and none for a place with no denominator', () => {
    const html = renderToStaticMarkup(<>{rateCell(SIX)!.render({ width: 640, height: 320 })}</>);
    // Texas and Wyoming; not New England, Total or Guam
    expect(count(html, 'rect')).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Texas');
    expect(html).toContain('Wyoming');
    for (const missing of ['New England', 'Total', 'Guam']) expect(html).not.toContain(missing);
  });

  it('ranks by the rate, not the count: Texas reported more cases and stands lower', () => {
    const html = renderToStaticMarkup(<>{rateCell(SIX)!.render({ width: 640, height: 320 })}</>);
    // Wyoming: 40 / 500,000 × 100,000 = 8 · Texas: 150 / 30,000,000 × 100,000 = 0.5 — the silent Wyoming week added nothing
    expect(html.indexOf('Wyoming')).toBeLessThan(html.indexOf('Texas'));
  });

  it('says in words where the number came from, and who has none', () => {
    const caption = textOf(rateCell(SIX)!.caption);
    const [bring, derive] = POPULATION_ACTS;
    expect(caption).toContain(`${DEFAULT_DISEASE} — cases per 100,000 people per reporting jurisdiction, summed over kept weeks, so it is a CUMULATIVE rate over that window and never an annual one`);
    expect(caption).toContain(`${bring} carried the Census Bureau's Vintage 2024 estimates for 1 places across the declared relation cells.jurisdiction → population.jurisdiction onto every cell as ${POPULATION_ON_CELLS}`);
    expect(caption).toContain(`${derive} landed ${RATE_COLUMN} = cases / ${POPULATION_ON_CELLS} × 100,000`);
    expect(caption).toContain('2 places have a rate');
    expect(caption).toContain('3 jurisdictions have no row in the population table and therefore no rate: 1 census-division regions, 1 national roll-ups, 1 places CDC files individually (Guam)');
    expect(caption).toContain('a silence, never a zero');
  });

  it('on rows the acts never reached, the body says so in the surface’s own sentence and draws nothing', () => {
    const bare: NndssCellRow[] = CELLS.map(({ [POPULATION_ON_CELLS]: _people, [RATE_COLUMN]: _rate, ...rest }) => rest);
    const cellOf = rateCell({ ...SIX, cells: bare, rateRefused: 'the rate acts have not landed on this session — built synchronously' })!;
    const html = renderToStaticMarkup(<>{cellOf.render({ width: 640, height: 320 })}</>);
    expect(html).toContain('the rate acts have not landed on this session');
    expect(count(html, 'rect')).toBe(0);
    expect(textOf(cellOf.caption)).toContain('no rate has landed on this session');
    expect(textOf(cellOf.caption)).not.toContain('places have a rate');
  });
});

describe('the rate cell over the live desk', () => {
  it('counts 51 places with a rate and names the 19 without, off the rows the door serves', async () => {
    const surface = await buildNndssSurfaceAsync();
    const rows = nndssRows(surface) as unknown as { cells: readonly NndssCellRow[]; series: []; diseases: readonly string[]; weeks: readonly string[]; absence: NndssDeskData['absence']; grain: NndssDeskData['grain']; population: NndssDeskData['population']; rateRefused: string | null };
    const data: NndssDeskData = { cells: rows.cells, series: [], diseases: rows.diseases, weeks: rows.weeks, absence: rows.absence, grain: rows.grain, geo: null, population: rows.population, rateRefused: rows.rateRefused };
    const caption = textOf(rateCell(data)!.caption);
    expect(caption).toContain("the Census Bureau's Vintage 2024 estimates for 51 places");
    expect(caption).toContain('51 places have a rate');
    // New York is on this list although the estimates file names it: CDC's row excludes New York City, the Census row counts it
    expect(caption).toContain('19 jurisdictions have no row in the population table and therefore no rate: 9 census-division regions, 4 national roll-ups, 6 places CDC files individually (New York, New York City, American Samoa, Commonwealth of Northern Mariana Islands, Guam, U.S. Virgin Islands)');
    const html = renderToStaticMarkup(<>{rateCell(data)!.render({ width: 900, height: 360 })}</>);
    // a bar per state that reported the default disease in some kept week — never more than the 52 with a denominator
    expect(count(html, 'rect')).toBeGreaterThan(0);
    for (const missing of ['New England', 'U.S. Residents', 'Guam']) expect(html).not.toContain(missing);
    // and no bar for New York, whose cases and whose Census row count different people
    expect(html).not.toContain('>New York<');
  }, 60_000);
});
