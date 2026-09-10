/**
 * THE EXOPLANET CELLS — the desk's own arithmetic, over the real committed
 * slice and the table the acts really minted.
 *
 * `tests/exo-session.test.ts` proves the five acts land and what they leave
 * behind. This proves the last hop: that the cells turn those rows into marks,
 * that a planet outside the declared window is not drawn AND is counted, that
 * the histogram bins the MINTED rows rather than folding the measurements a
 * second time, and — the part this demo exists for — that the silences are in
 * front of the reader IN WORDS, where they happen.
 *
 * The cells are rendered to static markup — no browser, no DOM. What they need
 * is a `DeskProjection`, and the desk builds that internally, so the one below
 * is a deliberate stub, exactly as `tests/grid-cells.test.tsx` explains: every
 * reader answers the emptiest true thing and every act is a no-op, because a
 * cell that drew differently for a quiet desk would be the thing under test.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { radiiBins, useExoCells, useExoSilences, type ExoDeskData } from '../web/src/exoCells.js';
import type { Row } from '../web/src/derive.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/exo/absence.js';
import { MASS_RADIUS_WINDOW } from '../src/exo/def.js';
import { buildExoSurfaceAsync } from '../src/exo/surface.js';
import { loadExo } from '../src/exo/snapshot.js';

/** A desk with nothing selected, nothing said and nothing to say — the quietest true projection. */
const QUIET = {
  state: { selections: [], links: [], cleared: [] },
  view: { emit: () => undefined, reencode: () => undefined },
  bound: (_viewId: string, _channel: string, fallback: string) => fallback,
  selFor: () => ({ clauses: new Map(), resolve: 'intersect', selfClauseId: null }),
  fitsOf: () => undefined,
  shown: {},
  columns: [],
  label: (viewId: string) => viewId,
  words: () => null,
  proseOf: () => [],
  altShort: () => undefined,
  readOnly: false,
  say: () => undefined,
  openAside: () => undefined,
  editChart: () => undefined,
  seekBookmark: () => undefined,
  applyPicture: () => undefined,
  savePicture: () => undefined,
  describeCommit: () => undefined,
  // WHY the cast: the same reason `tests/grid-cells.test.tsx` gives — `DeskProjection`
  // is built by a hook the studio does not export, so a stub is the only way in from
  // outside, and naming every member is what keeps it an honest one.
} as unknown as DeskProjection;

const ABSENCE = { field: ABSENCE_FIELD, states: [...ABSENCE_STATES] };
const EMPTY: ExoDeskData = { measurements: [], planets: [], references: [], derived: [], absence: ABSENCE };

/** The cells, built the way the desk builds them: once, from a component body. */
function cellsOf(data: ExoDeskData, desk: DeskProjection = QUIET): ReturnType<typeof useExoCells> {
  let built: ReturnType<typeof useExoCells> = [];
  function Probe(): null {
    built = useExoCells(desk, data);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

/** A caption as a reader sees it: the tags gone and the entities back to characters. */
const textOf = (node: React.ReactNode): string =>
  renderToStaticMarkup(<>{node}</>)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
const count = (html: string, tag: string): number => (html.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;

/**
 * The real slice through the real acts — the rows the page's own door serves.
 * Read ONCE for the whole file: parsing 9.8 MB of CSV and landing five acts per
 * test is CPU that proves nothing the first read did not, and it starves the
 * rest of the suite's workers.
 */
let once: Promise<ExoDeskData> | null = null;
const realData = (): Promise<ExoDeskData> => (once ??= buildRealData());

async function buildRealData(): Promise<ExoDeskData> {
  const tables = loadExo();
  const surface = await buildExoSurfaceAsync(tables);
  expect(surface.actRefusals).toEqual([]);
  return {
    measurements: tables.measurements,
    planets: tables.planets,
    references: tables.references,
    derived: surface.derived.rows as readonly Row[],
    derivedRefused: surface.derived.refused,
    absence: ABSENCE,
  };
}

describe('the three cells over the committed slice', () => {
  it('draws one dot per placeable planet inside the DECLARED window, and counts what it left out', async () => {
    const data = await realData();
    const cells = cellsOf(data);
    expect(cells.map((c) => c.id)).toEqual(['mass_radius', 'spread', 'by_year']);
    const html = renderToStaticMarkup(<>{cells[0]!.render({ width: 800, height: 520 })}</>);
    const inside = data.planets.filter(
      (p) =>
        typeof p['pl_bmasse'] === 'number' &&
        typeof p['pl_rade'] === 'number' &&
        Number(p['pl_bmasse']) <= MASS_RADIUS_WINDOW.mass.to &&
        Number(p['pl_rade']) <= MASS_RADIUS_WINDOW.radius.to,
    ).length;
    expect(count(html, 'circle')).toBe(inside);
    // …and the ones outside it are in the caption, not hidden
    const caption = textOf(cells[0]!.caption);
    expect(caption).toContain('are heavier or larger than that window and are NOT drawn');
    expect(caption).toContain('no log scale');
  }, 120_000);

  it('says how much of the composite came from NO paper — the fact the demo exists for', async () => {
    const data = await realData();
    const caption = textOf(cellsOf(data).find((c) => c.id === 'mass_radius')!.caption);
    const calculatedRadius = data.planets.filter((p) => p['radius_ref_kind'] === 'archive').length;
    const modelled = data.planets.filter((p) => p['mass_kind'] === 'M-R relationship').length;
    expect(caption).toContain('the accepted numbers are an ASSEMBLY, not a publication');
    expect(caption).toContain(`${calculatedRadius.toLocaleString('en-US')} of the radii`);
    expect(caption).toContain(`${modelled.toLocaleString('en-US')} of the accepted masses are computed from the radius`);
  }, 120_000);

  it('counts the drawn dots that are a BOUND rather than a measurement — a scatter that drew one as though it were the other would claim a measurement nobody made', async () => {
    const data = await realData();
    const cells = cellsOf(data);
    const html = renderToStaticMarkup(<>{cells[0]!.render({ width: 800, height: 520 })}</>);
    const bounded = data.planets.filter(
      (p) =>
        typeof p['pl_bmasse'] === 'number' &&
        typeof p['pl_rade'] === 'number' &&
        Number(p['pl_bmasse']) <= MASS_RADIUS_WINDOW.mass.to &&
        Number(p['pl_rade']) <= MASS_RADIUS_WINDOW.radius.to &&
        (p['radius_state'] === 'limit' || p['mass_state'] === 'limit'),
    ).length;
    expect(bounded).toBeGreaterThan(0);
    expect(count(html, 'circle')).toBeGreaterThan(bounded); // the bounds are among, not the whole of, the dots drawn
    const caption = textOf(cells[0]!.caption);
    expect(caption).toContain(`${bounded.toLocaleString('en-US')} of these dots are plotted from a BOUND rather than a measurement`);
  }, 120_000);

  it('bins the MINTED rows, one bin per whole number of published radii', async () => {
    const data = await realData();
    const bins = radiiBins(data.derived, () => true);
    // one bin per distinct count, ascending, and every planet of the minted table in exactly one
    expect(bins.map((b) => b.x0)).toEqual([...bins].map((b) => b.x0).sort((a, b) => Number(a) - Number(b)));
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(data.derived.length);
    expect(bins.every((b) => Number(b.x1) === Number(b.x0) + 1)).toBe(true);
    const html = renderToStaticMarkup(<>{cellsOf(data).find((c) => c.id === 'spread')!.render({ width: 800, height: 400 })}</>);
    expect(count(html, 'rect')).toBeGreaterThanOrEqual(bins.length);
  }, 120_000);

  it('counts the planets the histogram CANNOT show, rather than letting them read as the leftmost bar', async () => {
    const data = await realData();
    const caption = textOf(cellsOf(data).find((c) => c.id === 'spread')!.caption);
    const missing = data.planets.length - data.derived.length;
    expect(missing).toBeGreaterThan(0);
    expect(caption).toContain(`the other ${missing.toLocaleString('en-US')} planets are in NO bar`);
    expect(caption).toContain('a bound is not one');
    // and it says where the table came from, because the table is not in the data
    expect(caption).toContain('an aggregate act cut it at run time');
  }, 120_000);

  it('reads the DERIVED disagreement column — never a fold of its own', async () => {
    const data = await realData();
    const caption = textOf(cellsOf(data).find((c) => c.id === 'spread')!.caption);
    const disagreeing = data.derived.filter((r) => r['disagrees'] === true).length;
    expect(disagreeing).toBeGreaterThan(0);
    expect(caption).toContain(`${disagreeing.toLocaleString('en-US')} of the`);
    expect(caption).toContain('disagree with themselves');
  }, 120_000);

  it('the year bars carry the references, and the undated ones are said out loud', async () => {
    const data = await realData();
    const caption = textOf(cellsOf(data).find((c) => c.id === 'by_year')!.caption);
    const undated = data.references.filter((r) => r['pub_year'] === null || r['pub_year'] === undefined).length;
    expect(caption).toContain(`${data.references.length.toLocaleString('en-US')} references`);
    if (undated > 0) expect(caption).toContain(`${undated.toLocaleString('en-US')} carry no year`);
  }, 120_000);
});

describe('a desk with nothing in it says so, and draws nothing', () => {
  it('draws no dot and no bin, and the histogram prints the session\'s own sentence', () => {
    const cells = cellsOf({ ...EMPTY, derivedRefused: 'no act has landed on this session' });
    expect(count(renderToStaticMarkup(<>{cells[0]!.render({ width: 400, height: 300 })}</>), 'circle')).toBe(0);
    expect(textOf(cells.find((c) => c.id === 'spread')!.caption)).toContain('no act has landed on this session');
    expect(radiiBins([], () => true)).toEqual([]);
  });

  it('the silences panel names one group per word but `present`, over every row and not the selection', async () => {
    const data = await realData();
    let groups: ReturnType<typeof useExoSilences> = [];
    function Probe(): null {
      groups = useExoSilences(data);
      return null;
    }
    renderToStaticMarkup(<Probe />);
    expect(groups.map((g) => g.state)).toEqual(['limit', 'not-measured', 'unknown']);
    // the counts are of the WHOLE table: a silence is a fact about the data, not about what is on screen
    expect(groups.find((g) => g.state === 'limit')?.total).toBe(data.measurements.filter((m) => m['radius_state'] === 'limit').length);
    expect(groups.find((g) => g.state === 'unknown')?.total).toBe(0);
  }, 120_000);
});
