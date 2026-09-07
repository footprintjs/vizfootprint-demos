/**
 * THE GRID CELLS — the desk's own arithmetic, over the real committed slice.
 *
 * `tests/grid-network.test.ts` proves the two acts land and what they leave on
 * the two tables. This proves the last hop: that the cells turn those rows into
 * marks, that a row with no position is not drawn at the origin, that the
 * caption COUNTS what is on screen rather than asserting it, and — the part
 * this demo exists for — that the silences are in front of the reader IN WORDS,
 * where they happen.
 *
 * The cells are rendered to static markup — no browser, no DOM. What they need
 * is a `DeskProjection`, and the desk builds that internally, so the one below
 * is a deliberate stub: every reader answers the emptiest true thing and every
 * act is a no-op, because a cell that drew differently for a quiet desk would
 * be the thing under test.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { useGridCells, useGridSilences, type ContrastGraph, type GridAuthorityRow, type GridDeskData, type GridLinkRow } from '../web/src/gridCells.js';
import { buildGridSurface, graphRowsAt, layOutGrid } from '../src/grid/surface.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/grid/absence.js';
import { loadGrid } from '../src/grid/snapshot.js';

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
  // WHY the cast: `DeskProjection` is the desk's own contract, built by a hook the
  // studio does not export. A stub is the only way in from outside, and naming
  // every member above is what keeps it an honest one.
} as unknown as DeskProjection;

/** The CDC demo's graph as the server counts it — 15 diseases, every pair joined. */
const CDC_CONTRAST: ContrastGraph = { label: 'the CDC disease co-occurrence graph', nodes: 15, edges: 105, interaction: true };

const EMPTY: GridDeskData = { authorities: [], links: [], hourly: [], hours: [], absence: { field: ABSENCE_FIELD, states: [...ABSENCE_STATES] } };

/** The cells, built the way the desk builds them: once, from a component body. */
function cellsOf(data: GridDeskData, desk: DeskProjection = QUIET): ReturnType<typeof useGridCells> {
  let built: ReturnType<typeof useGridCells> = [];
  function Probe(): null {
    built = useGridCells(desk, data);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

/** A caption as a reader sees it: the tags gone and the entities back to characters (a quoted rule id renders as `&quot;`). */
const textOf = (node: React.ReactNode): string =>
  renderToStaticMarkup(<>{node}</>)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
const count = (html: string, tag: string): number => (html.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;

/**
 * The real slice, laid out by the real acts — the rows the cockpit's own door
 * serves. Read ONCE for the whole file: parsing 8.7 MB of CSV and laying 70
 * authorities out per test is a minute of CPU that proves nothing the first
 * read did not, and it starves the rest of the suite's workers.
 */
let once: Promise<GridDeskData> | null = null;
const realData = (): Promise<GridDeskData> => (once ??= buildRealData());

async function buildRealData(): Promise<GridDeskData> {
  const tables = loadGrid();
  const { session } = buildGridSurface(tables);
  expect(await layOutGrid(session)).toEqual([]);
  const rows = await graphRowsAt(session, tables);
  return {
    authorities: rows.authorities as readonly GridAuthorityRow[],
    links: rows.links as readonly GridLinkRow[],
    hourly: tables.hourly,
    hours: tables.hours,
    absence: { field: ABSENCE_FIELD, states: [...ABSENCE_STATES] },
    netRefused: rows.refused,
    contrast: CDC_CONTRAST,
  };
}

describe('the three cells over the committed three weeks', () => {
  it('draws one circle per authority and one line per directed link, links UNDER nodes', async () => {
    const cells = cellsOf(await realData());
    expect(cells.map((c) => c.id)).toEqual(['net', 'demand', 'authorities']);
    const html = renderToStaticMarkup(<>{cells.find((c) => c.id === 'net')!.render({ width: 800, height: 520 })}</>);
    expect(count(html, 'circle')).toBe(70);
    expect(count(html, 'line')).toBe(303);
    // paint order is DOM order: the links group is written before the nodes group
    expect(html.indexOf('vzf-net-links')).toBeLessThan(html.indexOf('vzf-net-nodes'));
  }, 120_000);

  it('draws the hourly line over every hour of the window, one point per hour', async () => {
    const cells = cellsOf(await realData());
    const caption = textOf(cells.find((c) => c.id === 'demand')!.caption);
    expect(caption).toContain('demand per UTC hour');
    expect(caption).toContain('across 504 of 504 hours');
    // 62 of the 70 file rows at all; the other eight are named as neighbours and file nothing
    expect(caption).toContain('summed over 62 authorities');
  }, 120_000);

  it('the bar reads the PER-AUTHORITY table — one bar per region, 70 rows folded', async () => {
    const cells = cellsOf(await realData());
    expect(textOf(cells.find((c) => c.id === 'authorities')!.caption)).toContain('the per-authority table, 70 rows');
  }, 120_000);
});

describe('the caption counts what is on screen, and QUOTES the library\'s reading rule for BOTH demos', () => {
  it('says node-link here and matrix over the CDC graph, in the rule\'s own words', async () => {
    const caption = textOf(cellsOf(await realData()).find((c) => c.id === 'net')!.caption);
    expect(caption).toContain('70 balancing authorities · 303 directed links over 157 pairs');
    // this graph: the node-link, with the study named
    expect(caption).toContain('prefers the NODE-LINK for this graph (rule "default")');
    expect(caption).toContain('Ghoniem, Fekete and Castagliola 2004');
    // the other demo: the matrix, from the SAME rule, because the graph differs
    expect(caption).toContain('over the CDC disease co-occurrence graph — 15 nodes, 105 pairs, complete — the same rule prefers the MATRIX (rule "dense")');
    expect(caption).toContain('the lines cross more than they connect');
  }, 120_000);

  it('and neither verdict is written in this repo — drop the contrast and only this graph\'s ruling is said', async () => {
    const { contrast: _dropped, ...alone } = await realData();
    const caption = textOf(cellsOf(alone).find((c) => c.id === 'net')!.caption);
    expect(caption).toContain('prefers the NODE-LINK');
    expect(caption).not.toContain('the same rule prefers');
  }, 120_000);
});

describe('the silences are in front of the reader, in words, where they happen', () => {
  it('names the links that are declared in every hour and never carry a number', async () => {
    const caption = textOf(cellsOf(await realData()).find((c) => c.id === 'net')!.caption);
    expect(caption).toContain('2 links are declared in every hour EIA wrote for them and never carried a number (MISO→SIKE, 186 hours; SPA→SIKE, 186 hours)');
    expect(caption).toContain('drawn, because a declared link nobody reported is a fact about the grid and not an absent one');
  }, 120_000);

  it('names the pair whose two directions disagree about when it ended', async () => {
    const caption = textOf(cellsOf(await realData()).find((c) => c.id === 'net')!.caption);
    expect(caption).toContain('1 pair disagrees with itself about when it ended');
    expect(caption).toContain('HGMA→SRP ends 2025-06-01T07:00Z, but SRP→HGMA ends 2025-06-03T07:00Z');
  }, 120_000);

  it('names the hours the authority filed one number and EIA published another, with both figures', async () => {
    const caption = textOf(cellsOf(await realData()).find((c) => c.id === 'demand')!.caption);
    expect(caption).toContain('3 hours on this line are not what the authority filed');
    expect(caption).toContain('the widest is LGEE at 2025-06-07T00:00Z, which filed 10,247 MW where EIA published 4,776 MW');
    expect(caption).toContain('Both numbers are kept in the table, because the two disagreeing is the story');
  }, 120_000);

  it('counts the hours EIA\'s own two interchange figures disagree — over the hours that HAVE both', async () => {
    const caption = textOf(cellsOf(await realData()).find((c) => c.id === 'demand')!.caption);
    // 30,600, not the 30,638 hours with a PUBLISHED interchange: a hole in either
    // figure is not a disagreement, and the wider denominator would flatter the rate
    expect(caption).toContain('in 3090 of the 30600 hours that carry BOTH of EIA\'s interchange figures (10%) the two disagree');
    expect(caption).toContain('by up to 7,472 MW');
    expect(caption).toContain('the residue is kept as a column and never netted away');
  }, 120_000);

  it('and the eight authorities that file nothing, ever, are counted on the network', async () => {
    const caption = textOf(cellsOf(await realData()).find((c) => c.id === 'net')!.caption);
    expect(caption).toContain('8 of the circles are Canadian or Mexican operators that are named as neighbours and file nothing, ever');
  }, 120_000);

  it('the silences panel groups every word but `present`, with the authorities that carry it', async () => {
    const data = await realData();
    let groups: ReturnType<typeof useGridSilences> = [];
    function Probe(): null {
      groups = useGridSilences(data);
      return null;
    }
    renderToStaticMarkup(<Probe />);
    expect(groups.map((g) => g.state)).toEqual(['estimated', 'replaced', 'not-configured', 'unavailable', 'unknown']);
    expect(groups.find((g) => g.state === 'not-configured')!.total).toBe(4034);
    expect(groups.find((g) => g.state === 'replaced')!.total).toBe(3);
    // `unknown` is never invented: the word stays in the vocabulary and the count stays zero
    expect(groups.find((g) => g.state === 'unknown')!.total).toBe(0);
  }, 120_000);
});

describe('an empty desk draws nothing, and says why rather than guessing', () => {
  it('renders the three cells over no rows at all, and the network says no position landed', () => {
    const cells = cellsOf(EMPTY);
    expect(cells.map((c) => c.id)).toEqual(['net', 'demand', 'authorities']);
    const html = renderToStaticMarkup(<>{cells.find((c) => c.id === 'net')!.render({ width: 400, height: 300 })}</>);
    expect(html).toContain('the layout act has not landed on this session');
    expect(count(html, 'circle')).toBe(0);
  });

  it('a row with no position is NOT drawn at the origin', () => {
    const data: GridDeskData = {
      ...EMPTY,
      authorities: [
        { authority: 'AAA', x: 1, y: 2 },
        { authority: 'BBB' }, // the layout never placed this one
      ] as unknown as readonly GridAuthorityRow[],
      links: [{ from_authority: 'AAA', to_authority: 'BBB', from_authority_x: 1, from_authority_y: 2 }] as unknown as readonly GridLinkRow[],
    };
    const html = renderToStaticMarkup(<>{cellsOf(data).find((c) => c.id === 'net')!.render({ width: 400, height: 300 })}</>);
    expect(count(html, 'circle')).toBe(1);
    // an edge missing ANY of its four ends is not half-drawn
    expect(count(html, 'line')).toBe(0);
    expect(textOf(cellsOf(data).find((c) => c.id === 'net')!.caption)).toContain('2 rows carry no position and are not drawn');
  });
});
