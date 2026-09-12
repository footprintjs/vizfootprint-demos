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
import { buildDashboard, graphReadingFor, layerAddress } from 'vizfootprint/def';
import { createSessionView, selectionForView, sessionSource } from 'vizfootprint-ui';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { DEFAULT_DISEASE, NETWORK_NODES, type NndssDeskData, type NndssEdgeRow, type NndssNodeRow } from '../web/src/cells.js';
import { NETWORK_EDGES_LAYER, NETWORK_VIEW, nndssDef } from '../src/nndss/def.js';
import type { NndssTables } from '../src/nndss/etl.js';
import type { NndssGraph } from '../src/nndss/graph.js';
import { buildNndssSurface, graphRowsAt, layOutGraph } from '../src/nndss/surface.js';
import { loadGraph } from '../src/nndss/snapshot.js';
import { QUIET, cellsOf, count, textOf } from './deskStub.js';

/** The desk data a surface with no graph hands over — the story page's shape. */
const NO_GRAPH: NndssDeskData = { cells: [], series: [], diseases: [], weeks: [], absence: { field: 'report_state', states: [] }, grain: {}, geo: null };

/** A desk where ONE source view has landed a point clause on `disease` — the shape a click lands. */
function picking(sourceViewId: string, value: string): DeskProjection {
  const clauses = new Map([[sourceViewId, { field: 'disease', kind: 'point', value, predicate: (row: Record<string, unknown>) => row['disease'] === value }]]);
  return { ...QUIET, selFor: () => ({ clauses, resolve: 'intersect', selfClauseId: null }) } as unknown as DeskProjection;
}

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

  it('a walk that TRAVELLED lights the ego net the walk recorded: the seed is the focus, the nodes outside dim, alt-click-to-clear is on the seed — through the desk\'s own wire (packet AM)', async () => {
    // a graph small enough to count by hand (the `tests/network.test.ts` fixture): Measles—Mumps, Mumps—Rubella
    const TINY: NndssGraph = {
      nodes: [
        { disease: 'Measles', cases_total: 3, jurisdictions_reporting: 1, weeks_reporting: 1 },
        { disease: 'Mumps', cases_total: 1, jurisdictions_reporting: 1, weeks_reporting: 1 },
        { disease: 'Rubella', cases_total: 2, jurisdictions_reporting: 1, weeks_reporting: 1 },
      ],
      edges: [
        { source: 'Measles', target: 'Mumps', weight: 2, jurisdictions: 1 },
        { source: 'Mumps', target: 'Rubella', weight: 1, jurisdictions: 1 },
      ],
    };
    const TABLES = {
      cells: [{ jurisdiction: 'Texas', kind: 'state', disease: 'Measles', cases: 3, report_state: 'present', flag: null, ytd: 30, prev52_max: 9, t: '2026-01-04', week_index: 1 }] as unknown as NndssTables['cells'],
      jurisdictions: [{ jurisdiction: 'Texas', kind: 'state', lat: 31, lon: -99 }] as unknown as NndssTables['jurisdictions'],
      series: [{ t: '2026-01-04', entity: 'Texas', metric: 'cases', value: 3, entity_kind: 'state', week_index: 1 }] as unknown as NndssTables['series'],
      grain: { bucket: 'week', reducer: 'sum' },
    } as unknown as NndssTables;
    const session = buildDashboard(nndssDef(TABLES, TINY)).createSession({ as: 'user' });
    expect(await layOutGraph(session)).toEqual([]);
    const rows = await graphRowsAt(session, TINY);
    const data: NndssDeskData = { ...NO_GRAPH, nodes: rows.nodes as readonly NndssNodeRow[], edges: rows.edges as readonly NndssEdgeRow[], netRefused: rows.refused };

    // THE WALK, landed on the real session at the edges' address: alt-click Measles. COUNTED BY HAND: Measles's
    // one tie is Measles→Mumps, so one hop of ego from it is the seed and Mumps — TWO ids — and Rubella is outside.
    const EDGES = layerAddress(NETWORK_VIEW, NETWORK_EDGES_LAYER);
    const cause = { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'alt-click Measles' };
    const res = await session.dispatch({ verb: 'select', viewId: EDGES, field: 'source', seed: 'Measles', cause });
    expect(res.ok && (res.commit!.value as { readonly ids: readonly string[] }).ids).toEqual(['Measles', 'Mumps']);

    // THE WIRE the desk reads (`web/src/App.tsx` hands the studio desk a session view), and the desk's own fold:
    // `selFor(NETWORK_NODES)` = the library's `selectionForView` over the served selections and link graph — which
    // now picks the consumer's TRAVELLED clause (`disease IN ids`, by identity, `via.from` the walk itself).
    const view = createSessionView(sessionSource(session), { as: 'user' });
    await view.refresh();
    const state = view.getState();
    expect(state.selections.map((s) => s.viewId)).toEqual([EDGES]);
    expect(state.selections[0]?.travelled?.[NETWORK_NODES]?.clause).toEqual({ kind: 'match', field: 'disease', values: ['Measles', 'Mumps'] });
    const deskOver = (selections: typeof state.selections): DeskProjection =>
      ({ ...QUIET, state: { selections, links: state.links, cleared: state.cleared }, selFor: (self: string | null) => selectionForView(selections, self, 'intersect', state.links, state.cleared) }) as unknown as DeskProjection;
    const netHtml = (desk: DeskProjection): string => renderToStaticMarkup(<>{cellsOf(data, desk).find((c) => c.id === 'net')!.render({ width: 640, height: 420 })}</>);
    /** Each circle as drawn: its node, its classes, and the words its `<title>` says. */
    const circlesOf = (html: string): readonly { readonly node: string; readonly classes: string; readonly title: string }[] =>
      [...html.matchAll(/<circle([^>]*)>\s*<title>([^<]*)<\/title>/g)].map((m) => ({
        node: /data-node="([^"]+)"/.exec(m[1] ?? '')?.[1] ?? '',
        classes: /class="([^"]*)"/.exec(m[1] ?? '')?.[1] ?? '',
        title: (m[2] ?? '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
      }));
    const html = netHtml(deskOver(state.selections));
    const circles = circlesOf(html);

    // THREE circles drawn, ONE dim — Rubella, the node outside the recorded set (dim, never hide)
    expect(circles.map((c) => c.node).sort()).toEqual(['Measles', 'Mumps', 'Rubella']);
    expect(circles.filter((c) => c.classes.includes('vzf-dim')).map((c) => c.node)).toEqual(['Rubella']);
    expect(circles.filter((c) => c.classes.includes('vzf-dim'))).toHaveLength(TINY.nodes.length - 2);
    // the seed is the focus: its title offers the CLEAR; the other lit node offers a walk of its own
    expect(circles.find((c) => c.node === 'Measles')?.title).toContain('alt-click to clear its neighbourhood');
    expect(circles.find((c) => c.node === 'Mumps')?.title).toContain('alt-click for its neighbourhood');
    // and of the two ties, the one touching Rubella dims with it
    expect(count(html, 'line')).toBe(2);
    expect((html.match(/<line[^>]*vzf-dim/g) ?? []).length).toBe(1);

    // THE SAME PICTURE AS BEFORE THE CLAUSE TRAVELLED: strip the wire's key and the render tier reads the walk as
    // it always did — every circle's classes byte-identical (the library's own pin, `VizNetwork.test.tsx`, here on the desk's wire)
    const stripped = state.selections.map(({ travelled: _travelled, ...s }) => s);
    expect(circlesOf(netHtml(deskOver(stripped))).map((c) => [c.node, c.classes])).toEqual(circles.map((c) => [c.node, c.classes]));
  });
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
