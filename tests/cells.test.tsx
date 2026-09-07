/**
 * THE NETWORK CELL — the desk's own arithmetic, over the real committed graph.
 *
 * `tests/network.test.ts` proves the two acts land and what they leave on the
 * two tables. This proves the last hop: that the cell turns those rows into
 * marks, that a row with no position is not drawn at the origin, and that the
 * caption counts what is on screen rather than asserting it.
 *
 * The cell is rendered to static markup — no browser, no DOM, no library. What
 * it needs is a `DeskProjection`, and the desk builds that internally, so the
 * one below is a deliberate stub: every reader answers the emptiest true thing
 * (no clauses, no words, no verdicts) and every act is a no-op, because a cell
 * that drew differently for a quiet desk would be the thing under test.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { graphReadingFor } from 'vizfootprint/def';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { DEFAULT_DISEASE, NETWORK_NODES, useNndssCells, type NndssDeskData, type NndssEdgeRow, type NndssNodeRow } from '../web/src/cells.js';
import { buildNndssSurface, graphRowsAt, layOutGraph } from '../src/nndss/surface.js';
import { loadGraph } from '../src/nndss/snapshot.js';

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

/** The desk data a surface with no graph hands over — the story page's shape. */
const NO_GRAPH: NndssDeskData = { cells: [], series: [], diseases: [], weeks: [], absence: { field: 'report_state', states: [] }, grain: {}, geo: null };

/** A desk where ONE source view has landed a point clause on `disease` — the shape a click lands. */
function picking(sourceViewId: string, value: string): DeskProjection {
  const clauses = new Map([[sourceViewId, { field: 'disease', kind: 'point', value, predicate: (row: Record<string, unknown>) => row['disease'] === value }]]);
  return { ...QUIET, selFor: () => ({ clauses, resolve: 'intersect', selfClauseId: null }) } as unknown as DeskProjection;
}

/** The cells, built the way the desk builds them: once, from a component body. */
function cellsOf(data: NndssDeskData, desk: DeskProjection = QUIET): ReturnType<typeof useNndssCells> {
  let built: ReturnType<typeof useNndssCells> = [];
  function Probe(): null {
    built = useNndssCells(desk, data);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

const textOf = (node: React.ReactNode): string => renderToStaticMarkup(<>{node}</>).replace(/<[^>]+>/g, '');
const count = (html: string, tag: string): number => (html.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;

/** The real graph, laid out by the real acts — the rows the cockpit's own door serves. */
async function realGraphData(): Promise<NndssDeskData> {
  const graph = loadGraph();
  const { session } = buildNndssSurface(undefined, graph);
  expect(await layOutGraph(session)).toEqual([]);
  const rows = await graphRowsAt(session, graph);
  return { ...NO_GRAPH, nodes: rows.nodes as readonly NndssNodeRow[], edges: rows.edges as readonly NndssEdgeRow[], netRefused: rows.refused };
}

describe('the network cell over the committed CDC graph', () => {
  it('draws one circle per disease and one line per tie, links UNDER nodes', async () => {
    const cells = cellsOf(await realGraphData());
    expect(cells.map((c) => c.id)).toEqual(['coverage', 'diseases', 'kinds', 'map', 'weeks', 'trend', 'net', 'table']);
    const html = renderToStaticMarkup(<>{cells.find((c) => c.id === 'net')!.render({ width: 640, height: 420 })}</>);
    expect(count(html, 'circle')).toBe(15);
    expect(count(html, 'line')).toBe(105);
    // paint order is DOM order: the links group is written before the nodes group
    expect(html.indexOf('vzf-net-links')).toBeLessThan(html.indexOf('vzf-net-nodes'));
  }, 60_000);

  it('hands the chart the WALK door, so an alt-click has somewhere to go: the frame says so out loud', async () => {
    const html = renderToStaticMarkup(<>{cellsOf(await realGraphData()).find((c) => c.id === 'net')!.render({ width: 640, height: 420 })}</>);
    // `<desc>` carries the gesture only when the walk door was passed — the chart
    // never advertises an act it has nowhere to send (VizNetwork, the `walk` prop)
    expect(html).toContain('alt-click (or alt+Enter) a node to select it and everything it links to');
  }, 60_000);

  it('counts the density on screen and QUOTES the library\'s reading rule, rather than asserting either', async () => {
    const caption = textOf(cellsOf(await realGraphData()).find((c) => c.id === 'net')!.caption);
    expect(caption).toContain('15 diseases · 105 of 105 possible ties');
    expect(caption).toContain('EVERY pair co-occurs');
    // the RULE fires here (15 nodes, every pair tied = density 1), and the caption says so in the
    // rule's own words — including the study, so a reader can go and check it
    expect(caption).toContain('prefer the MATRIX (source × target, shaded by jurisdiction-weeks)');
    expect(caption).toContain('Ghoniem, Fekete and Castagliola (2004)');
    expect(caption).toContain(graphReadingFor({ nodes: 15, edges: 105, interaction: true }).reason);
    expect(caption).toContain('positions from a seeded stress layout landed as a commit');
    expect(caption).toContain('alt-click to select it and everything it reports with');
  }, 60_000);
});

describe('what the cell does when the positions are not there', () => {
  it('draws NO network cell at all on a surface that carries no graph', () => {
    expect(cellsOf(NO_GRAPH).map((c) => c.id)).toEqual(['coverage', 'diseases', 'kinds', 'map', 'weeks', 'trend', 'table']);
  });

  it('says the session refused, in the session sentence, rather than drawing an empty frame', () => {
    const cells = cellsOf({ ...NO_GRAPH, nodes: [], edges: [], netRefused: 'no table "nodes" is declared — the tables are cells, jurisdictions, series' });
    const html = renderToStaticMarkup(<>{cells.find((c) => c.id === 'net')!.render({ width: 400, height: 300 })}</>);
    expect(html).toContain('no table &quot;nodes&quot; is declared');
    expect(count(html, 'circle')).toBe(0);
  });

  it('leaves out a disease the layout act never placed, and an edge missing any one end', () => {
    const nodes: readonly NndssNodeRow[] = [
      { disease: 'Measles', x: 0, y: 0 },
      { disease: 'Mumps', x: 1, y: 1 },
      { disease: 'Rubella', x: null, y: null }, // no position: the act did not place it, so nothing here does either
    ];
    const edges: readonly NndssEdgeRow[] = [
      { source: 'Measles', target: 'Mumps', source_x: 0, source_y: 0, target_x: 1, target_y: 1 },
      { source: 'Measles', target: 'Rubella', source_x: 0, source_y: 0, target_x: null, target_y: null },
    ];
    const cells = cellsOf({ ...NO_GRAPH, nodes, edges, netRefused: null });
    const net = cells.find((c) => c.id === 'net')!;
    const html = renderToStaticMarkup(<>{net.render({ width: 400, height: 300 })}</>);
    expect(count(html, 'circle')).toBe(2);
    expect(count(html, 'line')).toBe(1);
    // and the caption counts the DRAWN marks: two nodes make one possible tie, and it is there
    const caption = textOf(net.caption);
    expect(caption).toContain('2 diseases · 1 of 1 possible ties');
    // …and SAYS what it left out, because the counts above are of the drawn marks
    expect(caption).toContain('1 diseases and 1 ties carry no position and are not drawn');
    // a complete graph of two circles and one line is not a hairball, and telling
    // that reader to read a matrix instead would be nonsense
    expect(caption).not.toContain('hairball');
  });

  it('a caption that would promise a commit the body says did not land, says the truth instead', () => {
    const cells = cellsOf({ ...NO_GRAPH, nodes: [{ disease: 'Measles', x: null, y: null }], edges: [], netRefused: null });
    const net = cells.find((c) => c.id === 'net')!;
    const caption = textOf(net.caption);
    expect(caption).toBe('1 diseases carried, none placed — no position has landed on this session, so there is nothing to hover');
    expect(caption).not.toContain('landed as a commit');
    // and the body says the same thing, from the same condition
    expect(renderToStaticMarkup(<>{net.render({ width: 400, height: 300 })}</>)).toContain('the layout act has not landed');
  });

  it('never rounds the density to an absolute — an incomplete graph is never 100%, and a graph with ties is never 0%', () => {
    // 209 of 210 possible ties rounds to 100, which would withhold the matrix
    // reading exactly where a reader most needs it
    const nodes: readonly NndssNodeRow[] = Array.from({ length: 21 }, (_, i) => ({ disease: `d${String(i)}`, x: i, y: i % 5 }));
    const near = ties(nodes, 209);
    expect(textOf(cellsOf({ ...NO_GRAPH, nodes, edges: near, netRefused: null }).find((c) => c.id === 'net')!.caption)).toContain('over 99% of the possible ties');
    const few = ties(nodes, 1);
    expect(textOf(cellsOf({ ...NO_GRAPH, nodes, edges: few, netRefused: null }).find((c) => c.id === 'net')!.caption)).toContain('under 1% of the possible ties');
  });
});

/** `n` distinct ties over these nodes, every end placed — enough to count a density by. */
function ties(nodes: readonly NndssNodeRow[], n: number): readonly NndssEdgeRow[] {
  const out: NndssEdgeRow[] = [];
  for (let i = 0; i < nodes.length && out.length < n; i += 1) {
    for (let j = i + 1; j < nodes.length && out.length < n; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      out.push({ source: String(a.disease), target: String(b.disease), source_x: a.x as number, source_y: a.y as number, target_x: b.x as number, target_y: b.y as number });
    }
  }
  return out;
}

// ── the network as a SOURCE: a circle picks a disease like the bar does ─────

describe('a disease picked on the network reaches the folds that are keyed on one', () => {
  const DATA: NndssDeskData = {
    ...NO_GRAPH,
    cells: [
      { jurisdiction: 'Texas', kind: 'state', disease: 'Measles', t: '2026-01-04', cases: 3 },
      { jurisdiction: 'Ohio', kind: 'state', disease: 'Mumps', t: '2026-01-04', cases: 1 },
    ] as unknown as NndssDeskData['cells'],
    nodes: [
      { disease: 'Measles', x: 0, y: 0 },
      { disease: 'Mumps', x: 1, y: 1 },
    ],
    edges: [],
    netRefused: null,
  };

  it('names the picked disease in the map caption — not the default the bar left standing', () => {
    // the network's clause lands under its LAYER's address, so a page reading
    // only the bar would narrow every fold to Measles while the captions stayed
    // pinned to the default, and the two would intersect to nothing
    const onNet = textOf(cellsOf(DATA, picking(NETWORK_NODES, 'Measles')).find((c) => c.id === 'map')!.caption);
    expect(onNet.startsWith('Measles —')).toBe(true);
    // the BAR still wins when it has a pick of its own
    const onBar = textOf(cellsOf(DATA, picking('diseases', 'Mumps')).find((c) => c.id === 'map')!.caption);
    expect(onBar.startsWith('Mumps —')).toBe(true);
    // and with neither, the default stands
    expect(textOf(cellsOf(DATA).find((c) => c.id === 'map')!.caption).startsWith(`${DEFAULT_DISEASE} —`)).toBe(true);
  });

  it('registers the cell under the frame and its CLAUSE under the nodes layer', () => {
    const net = cellsOf(DATA).find((c) => c.id === 'net')!;
    expect([net.id, net.clauseId]).toEqual(['net', NETWORK_NODES]);
  });
});
