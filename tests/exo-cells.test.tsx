/**
 * THE EXOPLANET CELLS — the desk's own arithmetic, over the real committed
 * slice and the table the acts really minted.
 *
 * `tests/exo-session.test.ts` proves the five acts land and what they leave
 * behind. This proves the last hop: that the cells turn those rows into marks,
 * that the LOGARITHMIC axes the def declares really reach the chart (through the
 * session's projection, which is the only path there is) and that what a
 * logarithm cannot place is counted rather than dropped, that the histogram bins
 * the MINTED rows rather than folding the measurements a second time, and — the
 * part this demo exists for — that the silences are in front of the reader IN
 * WORDS, where they happen.
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
import { selectionForView, type LinkGraphView, type SelectionView } from 'vizfootprint-ui';
import { radiiBins, useExoCells, useExoSilences, type ExoDeskData } from '../web/src/exoCells.js';
import type { Row } from '../web/src/derive.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/exo/absence.js';
import { exoDef, BY_YEAR_VIEW, SCATTER_VIEW, SPREAD_ADDRESS, SPREAD_VIEW } from '../src/exo/def.js';
import { exoTables } from '../src/exo/etl.js';
import { buildExoSurfaceAsync } from '../src/exo/surface.js';
import { loadExo } from '../src/exo/snapshot.js';
import { TINY_PS, TINY_PSCOMPPARS } from './exoFixture.js';

/**
 * THE VIEWS AS THE SESSION PROJECTS THEM — read off the DEF, so the stub
 * carries the frame the real projection carries and nothing the def never said.
 *
 * It matters that this is derived and not typed: the cells learn which curve an
 * axis is drawn on from `state.views[].frame`, which is the session echoing the
 * def back verbatim. A stub with a hand-written frame would be testing a
 * declaration this repository does not make.
 */
const PROJECTED_VIEWS = exoDef(exoTables(TINY_PS, TINY_PSCOMPPARS)).encodings!.map((e) => ({
  viewId: e.viewId,
  ...(e.frame !== undefined ? { frame: e.frame } : {}),
}));

/** A desk with nothing selected, nothing said and nothing to say — the quietest true projection. */
const QUIET = {
  state: { selections: [], links: [], cleared: [], views: PROJECTED_VIEWS },
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

/**
 * A DESK WITH A BUCKET LIVE ON THE HISTOGRAM — the gesture whose clause the
 * crossfilter default now carries to every other view, because this def deleted
 * the ten `response: 'none'` edges that used to stop it.
 *
 * `selFor` is built with the LIBRARY's own `selectionForView` over a real
 * crossfilter `filter` edge into whichever consumer asks, so this stub cannot
 * disagree with what the session hands the desk about what arrives where.
 */
const BUCKET: SelectionView = { viewId: SPREAD_ADDRESS, kind: 'interval', field: 'radii', value: [1, 2], commitId: 'bucket' };
const crossfilterInto = (target: string): LinkGraphView => ({
  default: 'crossfilter',
  views: [],
  edges: [{ id: `${SPREAD_ADDRESS}->${target}`, source: SPREAD_ADDRESS, target, kind: 'interval', response: 'filter', origin: 'default' }],
});
const WITH_BUCKET = {
  ...QUIET,
  state: { ...QUIET.state, selections: [BUCKET] },
  selFor: (self: string | null) => selectionForView([BUCKET], self, 'intersect', crossfilterInto(self ?? ''), []),
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
  it('draws one dot per planet the archive accepts a PAIR for — no window, nothing dropped for being too big', async () => {
    const data = await realData();
    const cells = cellsOf(data);
    expect(cells.map((c) => c.id)).toEqual(['mass_radius', 'spread', 'by_year']);
    const html = renderToStaticMarkup(<>{cells[0]!.render({ width: 800, height: 520 })}</>);
    const pairs = data.planets.filter((p) => typeof p['pl_bmasse'] === 'number' && typeof p['pl_rade'] === 'number');
    // every planet with a pair whose two numbers a LOGARITHM can place is a circle; the rest are counted, never hidden
    const placeable = pairs.filter((p) => Number(p['pl_bmasse']) > 0 && Number(p['pl_rade']) > 0).length;
    expect(count(html, 'circle')).toBe(placeable);
    // the giants are IN the picture now — the old hand-typed window cut them off at 1,000 Earth masses
    expect(pairs.some((p) => Number(p['pl_bmasse']) > 1000)).toBe(true);
    const caption = textOf(cells[0]!.caption);
    expect(caption).toContain('BOTH AXES ARE LOGARITHMIC');
    expect(caption).not.toContain('window');
  }, 120_000);

  it('draws the DECLARED curve, and gets it from the session\'s projection of the def — not from a constant in the cell', async () => {
    const data = await realData();
    const html = renderToStaticMarkup(<>{cellsOf(data)[0]!.render({ width: 800, height: 520 })}</>);
    // decade ticks: a logarithmic x axis over 0.02 … 4,915 Earth masses is labelled at the powers of ten
    for (const decade of ['0.1', '10', '1000']) expect(html).toContain(`>${decade}<`);
    // …and with the frame gone from the projection the same cell draws the linear axis it always drew,
    // which is what proves the declaration is doing the work and nothing here is hard-coded
    const linear = { ...QUIET, state: { ...QUIET.state, views: [{ viewId: SCATTER_VIEW }, { viewId: SPREAD_VIEW }] } } as unknown as DeskProjection;
    const drawn = renderToStaticMarkup(<>{cellsOf(data, linear)[0]!.render({ width: 800, height: 520 })}</>);
    expect(drawn).not.toBe(html);
    expect(textOf(cellsOf(data, linear)[0]!.caption)).not.toContain('a logarithm has no place for');
  }, 120_000);

  it('counts the dots a LOGARITHM cannot place, in the caption and in the picture — exclude and count, never silently drop', async () => {
    const data = await realData();
    const cells = cellsOf(data);
    const pairs = data.planets.filter((p) => typeof p['pl_bmasse'] === 'number' && typeof p['pl_rade'] === 'number');
    const unplottable = pairs.filter((p) => !(Number(p['pl_bmasse']) > 0) || !(Number(p['pl_rade']) > 0)).length;
    const caption = textOf(cells[0]!.caption);
    const html = renderToStaticMarkup(<>{cells[0]!.render({ width: 800, height: 520 })}</>);
    if (unplottable === 0) {
      // this slice has no such planet, so the chart claims none — and the caption says the
      // absence out loud rather than falling silent, because a reader of a log axis needs to
      // know whether anything was left out as much as they would need a count
      expect(html).not.toContain('vzf-excluded-note');
      expect(caption).not.toContain('are NOT drawn');
      expect(caption).toContain('every one of them is placeable on that curve');
    } else {
      expect(caption).toContain(`${unplottable.toLocaleString('en-US')} of those planets are NOT drawn`);
      expect(html).toContain('vzf-excluded-note');
      expect(html).toContain(`${unplottable} value`); // the library's own words, inside the picture
    }
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
      (p) => typeof p['pl_bmasse'] === 'number' && typeof p['pl_rade'] === 'number' && (p['radius_state'] === 'limit' || p['mass_state'] === 'limit'),
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

  it('gives the histogram a real voice: the bars select under the LAYER address, and the caption says what a click does and where it stops', async () => {
    const data = await realData();
    const spread = cellsOf(data).find((c) => c.id === 'spread')!;
    // the clause lives at the layer's address, because that is the layer whose (minted) table the bars draw
    expect(spread.clauseId).toBe(SPREAD_ADDRESS);
    const caption = textOf(spread.caption);
    expect(caption).toContain('click a bar to select those planets');
    // …and both honest limits: the refusal before the act, and what a bucket's clause can and
    // cannot carry. The caption says ONLY what the demo knows — that a bucket is a set of planets
    // and the rest of the dashboard is about planets, so the selection reaching them is expected.
    // Why that reach filters nothing is the LIBRARY's sentence, printed under the sheet's rows
    // (`ReachingClause.narrowed`), and this caption must never restate it.
    expect(caption).toContain('refuses the same click in a sentence that names the act which mints it');
    expect(caption).toContain('a bucket is a set of PLANETS');
    expect(caption).toContain('this selection reaching them is expected, not broken');
    expect(caption).toContain('the sheet prints the library\u2019s own sentence for that under its rows');
    // the reason itself is NOWHERE in the demo's words — that is the whole point of the packet
    expect(caption).not.toContain('is not a claim about these rows');
    expect(caption).not.toContain('has no column');
  }, 120_000);

  it("a bucket's clause changes no other chart — the render tier made to agree with the read door", async () => {
    const data = await realData();
    const barsOf = (desk: DeskProjection): number =>
      count(renderToStaticMarkup(<>{cellsOf(data, desk).find((c) => c.id === BY_YEAR_VIEW)!.render({ width: 800, height: 400 })}</>), 'rect');
    // The bucket names `radii`, a column only the minted table has. The library's READ door
    // narrows such a clause and filters nothing; `web/src/derive.ts` · `judgedHere` makes the
    // host's own fold answer the same, because `selectionForView` compiles every arriving clause
    // into a predicate with no columns to judge against — without it every bar here would vanish.
    expect(barsOf(QUIET)).toBeGreaterThan(0);
    expect(barsOf(WITH_BUCKET)).toBe(barsOf(QUIET));
    // and the histogram itself still draws every bucket: its own clause is self-excluded, so the
    // bars a reader sees are the whole minted table whichever bar is outlined
    const barsOfSpread = (desk: DeskProjection): number =>
      count(renderToStaticMarkup(<>{cellsOf(data, desk).find((c) => c.id === SPREAD_VIEW)!.render({ width: 800, height: 400 })}</>), 'rect');
    expect(barsOfSpread(WITH_BUCKET)).toBe(barsOfSpread(QUIET));
    expect(barsOfSpread(QUIET)).toBeGreaterThanOrEqual(radiiBins(data.derived, () => true).length);
  }, 120_000);

  it('a click on a bar really dispatches — an INTERVAL, at the layer address, under an intent that names the field the gesture was on', async () => {
    const data = await realData();
    const emitted: { viewId: string; emission: unknown; intent: string }[] = [];
    const spy = { ...QUIET, view: { ...QUIET.view, emit: (viewId: string, emission: unknown, intent: string) => void emitted.push({ viewId, emission, intent }) } } as unknown as DeskProjection;
    const chart = cellsOf(data, spy).find((c) => c.id === 'spread')!.render({ width: 800, height: 400 });
    // the chart element's own props, unrendered: this is the wiring, and the markup cannot show it
    const props = (chart as React.ReactElement<{ readonly viewId: string; readonly onEmit?: (e: unknown) => void }>).props;
    expect(props.viewId).toBe(SPREAD_ADDRESS);
    props.onEmit!({ rawValue: [1, 2], encoding: { kind: 'interval', field: 'radii' } });
    expect(emitted).toEqual([{ viewId: SPREAD_ADDRESS, emission: { rawValue: [1, 2], encoding: { kind: 'interval', field: 'radii' } }, intent: 'filter radii' }]);
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
