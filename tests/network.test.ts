/**
 * THE NETWORK — where the positions on screen came from.
 *
 * The demo's node-link draws two tables on one frame, and the only interesting
 * claim it makes is about PROVENANCE: nothing on that frame was computed by the
 * page. A seeded stress layout landed `x` and `y` on the nodes table as an
 * `analyze` commit; a bring-over carried those two columns across the DECLARED
 * relations onto the edges table as `source_x` … `target_y` as a second one.
 *
 * So these pin the chain end to end: the two acts land, the columns arrive, the
 * join is real (an edge's ends ARE its endpoints' positions), the seed makes it
 * reproducible, a replay of the log rebuilds every coordinate, and a session
 * with no graph refuses both acts in a sentence instead of throwing.
 */
import { describe, expect, it } from 'vitest';
import { buildDashboard } from 'vizfootprint/def';
import { layerAddress } from 'vizfootprint/def';
import type { CommitRecord } from 'vizfootprint/log';
import { nndssDef, GRAPH_ANALYSES, GRAPH_LAYOUT_SEED, GRAPH_RELATIONS, NETWORK_VIEW, NETWORK_NODES_LAYER, NETWORK_EDGES_LAYER } from '../src/nndss/def.js';
import { buildNndssSurface, buildNndssSurfaceAsync, graphRowsAt, layOutGraph } from '../src/nndss/surface.js';
import { loadGraph } from '../src/nndss/snapshot.js';
import type { NndssTables } from '../src/nndss/etl.js';
import type { NndssGraph } from '../src/nndss/graph.js';

// ── a graph small enough to count by hand ───────────────────────────────────

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
  cells: [
    { jurisdiction: 'Texas', kind: 'state', disease: 'Measles', cases: 3, report_state: 'present', flag: null, ytd: 30, prev52_max: 9, t: '2026-01-04', week_index: 1 },
    { jurisdiction: 'Ohio', kind: 'state', disease: 'Mumps', cases: 1, report_state: 'present', flag: null, ytd: 4, prev52_max: 2, t: '2026-01-04', week_index: 1 },
  ] as unknown as NndssTables['cells'],
  jurisdictions: [{ jurisdiction: 'Texas', kind: 'state', lat: 31, lon: -99 }] as unknown as NndssTables['jurisdictions'],
  series: [{ t: '2026-01-04', entity: 'Texas', metric: 'cases', value: 3, entity_kind: 'state', week_index: 1 }] as unknown as NndssTables['series'],
  grain: { bucket: 'week', reducer: 'sum' },
} as unknown as NndssTables;

/** A session over the tiny graph, with the two acts landed — the shape the async surface builds. */
async function tinySession(): Promise<ReturnType<ReturnType<typeof buildDashboard>['createSession']>> {
  const session = buildDashboard(nndssDef(TABLES, TINY)).createSession({ as: 'user' });
  expect(await layOutGraph(session)).toEqual([]); // no refusals: both acts landed
  return session;
}

const numberAt = (row: Readonly<Record<string, unknown>>, column: string): number => {
  const v = row[column];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`"${column}" is ${JSON.stringify(v)}, not a finite number`);
  return v;
};

// ── the def declares the frame ──────────────────────────────────────────────

describe('the def: one view, two layers, one table each', () => {
  it('declares the network only when the graph is there — a layer over a table nobody declared is not a view', () => {
    const withGraph = nndssDef(TABLES, TINY);
    const net = (withGraph.encodings ?? []).find((e) => e.viewId === NETWORK_VIEW);
    expect(net?.chartKind).toBe('network');
    expect((net?.layers ?? []).map((l) => [l.layerId, l.table, l.channels])).toEqual([
      ['edges', 'edges', ['source', 'target', 'sourceX', 'sourceY', 'targetX', 'targetY']],
      ['nodes', 'nodes', ['x', 'y', 'key']],
    ]);
    // the edges layer draws UNDER the nodes layer: declaration order is paint order
    expect((net?.layers ?? [])[0]?.layerId).toBe('edges');
    // the nodes layer binds the two columns the layout act writes, and the node's identity as the key
    expect((net?.layers ?? [])[1]?.initial).toEqual({ x: 'x', y: 'y', key: 'disease' });
    // the edges layer binds the four columns the bring-over act writes
    expect((net?.layers ?? [])[0]?.initial).toMatchObject({ sourceX: 'source_x', sourceY: 'source_y', targetX: 'target_x', targetY: 'target_y' });

    const withoutGraph = nndssDef(TABLES);
    expect((withoutGraph.encodings ?? []).some((e) => e.viewId === NETWORK_VIEW)).toBe(false);
    expect(withoutGraph.actors[NETWORK_VIEW]).toBeUndefined();
    expect(Object.keys(withoutGraph.analyses ?? {})).not.toContain('graphLayout');
  });

  it('declares the two acts as DATA — the record says which algorithm, which seed and which columns', () => {
    expect(GRAPH_ANALYSES['graphLayout']).toEqual({ builtin: 'layout', algo: 'stress', table: 'nodes', edges: 'edges', key: 'disease', from: 'source', to: 'target', seed: GRAPH_LAYOUT_SEED, iterations: 60 });
    expect(GRAPH_ANALYSES['graphEndpoints']).toEqual({ builtin: 'bringOver', table: 'edges', from: 'nodes', columns: ['x', 'y'] });
  });
});

// ── the acts land, and what they left behind ────────────────────────────────

describe('the positions come from two commits', () => {
  it('lands one analyze commit per act, in order, with the seed in the words', async () => {
    const session = await tinySession();
    const records = session.commits('anywhere');
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.viewId)).toEqual(['analysis:graphLayout', 'analysis:graphEndpoints']);
    // WHY the seed is in the intent: a reader who asks where a circle came from gets the act AND the number that made it repeatable
    expect(records[0]!.cause.intent).toBe('lay the disease graph out — seeded stress, seed 7');
    expect(records[1]!.cause.intent).toBe("bring each edge's two endpoint positions over from the nodes");
  });

  it('puts x and y on the nodes and the four ends on the edges — plain columns, at the cursor', async () => {
    const session = await tinySession();
    const rows = await graphRowsAt(session, TINY);
    expect(rows.refused).toBeNull();
    expect(rows.nodes).toHaveLength(3);
    expect(rows.edges).toHaveLength(2);
    expect(Object.keys(rows.nodes[0]!)).toEqual(['disease', 'cases_total', 'jurisdictions_reporting', 'weeks_reporting', 'x', 'y']);
    expect(Object.keys(rows.edges[0]!)).toEqual(['source', 'target', 'weight', 'jurisdictions', 'source_x', 'source_y', 'target_x', 'target_y']);
    for (const n of rows.nodes) expect([typeof n['x'], typeof n['y']]).toEqual(['number', 'number']);
  });

  it('the join is REAL: every edge end is exactly its endpoint node position', async () => {
    const session = await tinySession();
    const { nodes, edges } = await graphRowsAt(session, TINY);
    const at = new Map(nodes.map((n) => [String(n['disease']), [numberAt(n, 'x'), numberAt(n, 'y')] as const]));
    for (const e of edges) {
      expect([numberAt(e, 'source_x'), numberAt(e, 'source_y')]).toEqual(at.get(String(e['source'])));
      expect([numberAt(e, 'target_x'), numberAt(e, 'target_y')]).toEqual(at.get(String(e['target'])));
    }
    // three nodes, and no two of them share a place — a layout that stacked them would draw one circle
    const places = new Set(nodes.map((n) => `${String(numberAt(n, 'x'))},${String(numberAt(n, 'y'))}`));
    expect(places.size).toBe(3);
  });

  it('the seed is DATA, so two sessions place the diseases identically', async () => {
    const first = await graphRowsAt(await tinySession(), TINY);
    const second = await graphRowsAt(await tinySession(), TINY);
    expect(second.nodes).toEqual(first.nodes);
    expect(second.edges).toEqual(first.edges);
  });

  it('a replay of the log rebuilds every coordinate — the act is on the trace, the values never were', async () => {
    const session = await tinySession();
    const before = await graphRowsAt(session, TINY);
    const log = session.log.records as readonly CommitRecord[];

    const fresh = buildDashboard(nndssDef(TABLES, TINY)).createSession({ as: 'user' });
    const replayed = await fresh.replay(log);
    expect(replayed.ok).toBe(true);
    const after = await graphRowsAt(fresh, TINY);
    expect(after.nodes).toEqual(before.nodes);
    expect(after.edges).toEqual(before.edges);
  });

  it('the layer address is what the marks speak under, and it answers its own window', async () => {
    const session = await tinySession();
    const nodes = await session.viewQuery({ viewId: layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER), limit: 10 });
    expect(nodes.ok && nodes.count).toBe(3);
    const edges = await session.viewQuery({ viewId: layerAddress(NETWORK_VIEW, NETWORK_EDGES_LAYER), limit: 10 });
    expect(edges.ok && edges.count).toBe(2);
    // the address resolves the table; naming a DIFFERENT one is two answers to one question, and is refused
    const crossed = await session.viewQuery({ viewId: layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER), table: 'edges' });
    expect(crossed.ok).toBe(false);
  });
});

describe('a gesture on the frame is a gesture on the LAYER', () => {
  it('lands a select under net~nodes, and the clause is addressable there — never under net', async () => {
    const session = await tinySession();
    const address = layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER);
    const picked = await session.dispatch({ verb: 'select', viewId: address, field: 'disease', value: 'Mumps', cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick Mumps on the network' } });
    expect(picked.ok).toBe(true);
    const landed = session.commits('anywhere').at(-1)!;
    expect([landed.viewId, landed.field, landed.value]).toEqual([address, 'disease', 'Mumps']);
    // every circle on that frame belongs to the nodes layer, so this is the clause the chart must
    // NOT dim itself by — the host folds for the layer address, never the view (`selectionForView`)
    expect(landed.viewId).not.toBe(NETWORK_VIEW);
  });

  it('takes the plural of a point — shift-click is a match on the same field', async () => {
    const session = await tinySession();
    const address = layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER);
    const many = await session.dispatch({ verb: 'select', viewId: address, field: 'disease', values: ['Mumps', 'Rubella'], cause: { requestedBy: 'user', computedBy: 'user', intent: 'add Rubella' } });
    expect(many.ok).toBe(true);
    expect(session.commits('anywhere').at(-1)!.kind).toBe('match');
  });
});

// ── the honest refusals ─────────────────────────────────────────────────────

describe('a surface with no graph says so, and starts anyway', () => {
  it('refuses the layout in the library sentence, SKIPS the bring-over, and throws nothing', async () => {
    const session = buildDashboard(nndssDef(TABLES)).createSession({ as: 'user' });
    const refusals = await layOutGraph(session);
    // one sentence, not two: `graphEndpoints` brings `x` and `y` ACROSS the
    // relations, and a bring-over whose source table has no such column THROWS.
    // Running it after a layout that landed nothing is what turns a refusal
    // into an uncaught error out of the server's boot.
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain('graphLayout');
    expect(session.commits('anywhere')).toHaveLength(0);
  });

  it('an act that lands NOTHING is a refusal too — `ok` is not a commit', async () => {
    const session = buildDashboard(nndssDef(TABLES, TINY)).createSession({ as: 'user' });
    // one node is a degenerate layout: the builtin's precheck answers `ok` with
    // no commit, which a caller reading `res.ok` alone would call a success
    const one: NndssGraph = { nodes: [TINY.nodes[0]!], edges: [] };
    const solo = buildDashboard(nndssDef(TABLES, one)).createSession({ as: 'user' });
    const refusals = await layOutGraph(solo);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain('graphLayout');
    expect(solo.commits('anywhere')).toHaveLength(0);
    // and the real one still lands both
    expect(await layOutGraph(session)).toEqual([]);
  });

  it('the async surface KEEPS the refusals and reads the graph once, before any clause exists', async () => {
    const surface = await buildNndssSurfaceAsync(TABLES, TINY);
    expect(surface.layoutRefusals).toEqual([]);
    expect(surface.graphRows.refused).toBeNull();
    expect(surface.graphRows.nodes).toHaveLength(3);
    // A view's clause reaches EVERY table, and `edges` has no `disease` column. That used to
    // REFUSE this read outright — the sentence this test asserted. The library now NARROWS the
    // one clause the table cannot judge and REPORTS it on the window, so the read succeeds, the
    // clause is still listed, and it filtered nothing.
    await surface.session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: 'Measles', cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick a disease' } });
    const live = await graphRowsAt(surface.session, TINY);
    expect(live.refused).toBeNull();
    expect(live.edges).toHaveLength(TINY.edges.length);
    const window = await surface.session.viewQuery({ table: 'edges', limit: TINY.edges.length });
    const narrowed = window.ok ? window.clauses.find((c) => c.narrowed !== undefined) : undefined;
    expect(narrowed?.narrowed?.column).toBe('disease');
    expect(narrowed?.narrowed?.reason).toContain('no column "disease"');
    // …which is why the frozen read still has to exist: the NODES window really does narrow under
    // a node selection, and a node-link drawn from it would point at nodes that are not there
    // (`src/nndss/session.ts` · `graphRowsAt`). The frozen one does not move.
    expect(surface.graphRows.refused).toBeNull();
    expect(surface.graphRows.edges).toHaveLength(2);
  });

  it('the SYNC surface says it never laid the graph out, rather than serving positionless rows in silence', () => {
    const surface = buildNndssSurface(TABLES, TINY);
    expect(surface.layoutRefusals).toEqual([]);
    expect(surface.graphRows.refused).toContain('has not landed on this session');
    expect(surface.graphRows.nodes).toEqual(TINY.nodes);
  });

  it('hands the committed rows back with the sentence when the window is refused', async () => {
    const session = buildDashboard(nndssDef(TABLES)).createSession({ as: 'user' });
    const rows = await graphRowsAt(session, TINY);
    // the library's sentence names the tables HERE, not what the def declared:
    // a table an act cut is readable on the branch that cut it, so "declared"
    // would send a reader to look for a declaration that never existed
    expect(rows.refused).toContain('no table "nodes" here');
    expect(rows.nodes).toEqual(TINY.nodes); // the committed rows, with no positions — the cell then says it cannot draw
    expect(rows.nodes.every((n) => n['x'] === undefined)).toBe(true);
  });
});

// ── the real graph: the counts the cell actually draws ──────────────────────

describe('the committed CDC graph, laid out', () => {
  it('draws 15 diseases and 105 ties — every pair, which is what makes it a matrix reading', async () => {
    const graph = loadGraph();
    const { session } = buildNndssSurface(undefined, graph);
    expect(await layOutGraph(session)).toEqual([]);
    const rows = await graphRowsAt(session, graph);
    expect(rows.refused).toBeNull();
    expect(rows.nodes).toHaveLength(15);
    expect(rows.edges).toHaveLength(105);
    // 105 = 15 × 14 / 2: the graph is COMPLETE, so the drawing is a hairball and the caption must say so
    expect(rows.edges.length).toBe((rows.nodes.length * (rows.nodes.length - 1)) / 2);
    // every mark the chart draws has a place, and every link has both of its ends
    expect(rows.nodes.filter((n) => typeof n['x'] === 'number' && typeof n['y'] === 'number')).toHaveLength(15);
    expect(rows.edges.filter((e) => ['source_x', 'source_y', 'target_x', 'target_y'].every((c) => typeof e[c] === 'number'))).toHaveLength(105);
  }, 60_000);
});

// ── the network's own envelope, grain and words ─────────────────────────────

describe('what the def says ABOUT the network, and not just about its rows', () => {
  it('gives it an honest capability envelope — a node-link speaks a point and a match, and nothing else', async () => {
    const session = await tinySession();
    const address = layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER);
    // R14's default with nothing declared is EVERY kind, which would put editable
    // `net --interval-->` and `net --cell-->` rows in the Grammar matrix for
    // gestures no circle on that frame can make
    const brushed = await session.dispatch({
      verb: 'filter',
      viewId: address,
      field: 'cases_total',
      range: [0, 3],
      cause: { requestedBy: 'user', computedBy: 'user', intent: 'brush the network' },
    });
    expect(brushed.ok).toBe(false);
    expect(!brushed.ok && brushed.rejection.detail).toContain('does not encode a interval selection');
    // and the point it CAN make still lands — a capability on the frame reaches its layers
    const point = await session.dispatch({ verb: 'select', viewId: address, field: 'disease', value: 'Mumps', cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick Mumps' } });
    expect(point.ok).toBe(true);
  });

  it('declares its GRAIN — and, the frame being its layers, the edges land on the nodes layer with no fold to name', async () => {
    const session = await tinySession();
    const { links } = await session.overview();
    expect(links.views.find((v) => v.viewId === NETWORK_VIEW)?.grain).toEqual(['disease']);

    // RE-PINNED under AJ ("the frame is its layers", `vizfootprint/def` README law 6a; packet AH2). `net` binds
    // nothing at its own level, so it is a FRAME on the map — it lists its layers in declaration order, draws no
    // table, and the default rule mints no edge into or out of it. The edge this test used to read, `map:point→net`
    // with `fold: 'crossfilter'`, does not exist any more; what exists is `map:point→net~nodes`.
    const nodes = layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER);
    expect(links.views.find((v) => v.viewId === NETWORK_VIEW)).toMatchObject({ frame: [layerAddress(NETWORK_VIEW, NETWORK_EDGES_LAYER), nodes] });
    expect(links.edges.filter((e) => e.source === NETWORK_VIEW || e.target === NETWORK_VIEW)).toEqual([]);
    const edge = links.edges.find((e) => e.source === 'map' && e.target === nodes && e.kind === 'point');
    expect(edge).toMatchObject({ response: 'filter', origin: 'default' });
    // THE RESIDUE, stated rather than hidden: a grain is declared per VIEW and a layer's node carries none
    // (`vizfootprint/def` · `layers.ts` · `layerLinkViewOf`: `{ viewId, voice, table }`), so `crossesGrain` is
    // false at the layer and the crossing the map used to state on the frame's edge is stated nowhere. The
    // nodes layer draws one mark per disease and the map emits over jurisdictions — that IS a crossing. When
    // the library gives a layer its frame's grain, this line moves to `'crossfilter'`; until then the map
    // names none, and this pin is what will say so the day it changes.
    expect(edge?.fold).toBeUndefined();
    // …and the one over the SAME grain names none either, for the reason it always did
    const same = links.edges.find((e) => e.source === 'diseases' && e.target === nodes && e.kind === 'point');
    expect(same).toMatchObject({ response: 'filter', origin: 'default' });
    expect(same?.fold).toBeUndefined();
  });

  it('says the density it MEASURED — the long description is a function of the graph, not a constant', async () => {
    const complete = buildDashboard(nndssDef(TABLES, loadGraph()));
    const long = (viz: ReturnType<typeof buildDashboard>): string =>
      String(viz.def.prose?.find((p) => p.viewId === NETWORK_VIEW)?.slots.altLong?.text);
    expect(long(complete)).toContain('the graph is complete');
    // TINY is 3 nodes and 2 of 3 possible ties — telling a screen-reader user it
    // is complete would be the one reading of the chart they have, and false
    const partial = buildDashboard(nndssDef(TABLES, TINY));
    expect(long(partial)).toContain('2 of the 3 possible ties are drawn');
    expect(long(partial)).not.toContain('complete');
    // and the basis names only a column on the branch it is judged against
    expect(await complete.lintProse()).toEqual([]);
  }, 60_000);
});

// ── the walk: one gesture on a node, one commit, the ids recorded ────────────

describe('one gesture on a node selects that node and what it touches', () => {
  const cause = { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'alt-click Mumps' };
  const EDGES = layerAddress(NETWORK_VIEW, NETWORK_EDGES_LAYER);
  const NODES = layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER);

  it('lands ONE commit on the EDGES address, carrying the question and the answer', async () => {
    const session = await tinySession();
    const before = session.commits('anywhere').length;
    const res = await session.dispatch({ verb: 'select', viewId: EDGES, field: 'source', seed: 'Mumps', cause });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(session.commits('anywhere')).toHaveLength(before + 1);
    expect([res.commit!.viewId, res.commit!.kind, res.commit!.fields]).toEqual([EDGES, 'neighbourhood', ['source', 'target']]);
    // Mumps ties to Measles and Rubella in TINY — the seed rides in its own set
    expect(res.commit!.value).toEqual({ seed: 'Mumps', derivation: 'ego', hops: 1, ids: ['Mumps', 'Measles', 'Rubella'] });
    // the ANSWER is what the predicate is made of: either endpoint in the walked set
    expect(res.commit!.predicateSQL).toContain('"source" IN (\'Mumps\', \'Measles\', \'Rubella\')');
  });

  it('is REFUSED on a column that is not an endpoint of any declared relation, in a sentence', async () => {
    const session = await tinySession();
    const res = await session.dispatch({ verb: 'select', viewId: EDGES, field: 'weight', seed: 'Mumps', cause });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rejection.detail).toContain('weight');
  });

  it('a live selection elsewhere does not stop the walk — a clause about `disease` is not a claim about the ties', async () => {
    const session = await tinySession();
    await session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: 'Measles', cause });
    const res = await session.dispatch({ verb: 'select', viewId: EDGES, field: 'source', seed: 'Mumps', cause });
    expect(res.ok && (res.commit!.value as { ids: unknown[] }).ids).toEqual(['Mumps', 'Measles', 'Rubella']);
  });

  it('reaches the NODES layer and nothing else: the def routes the walk, the default rule does not — and it arrives BY IDENTITY, the recorded ids as a match on the key', async () => {
    const session = await tinySession();
    const res = await session.dispatch({ verb: 'select', viewId: EDGES, field: 'source', seed: 'Mumps', cause });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // COUNTED BY HAND off TINY: Mumps ties to Measles (edge 1, as its target) and to Rubella (edge 2, as its
    // source), so one hop of ego from Mumps is the seed and both — THREE ids, seed first, then in edge order.
    const ids = (res.commit!.value as { readonly ids: readonly string[] }).ids;
    expect(ids).toEqual(['Mumps', 'Measles', 'Rubella']);

    // THE WALK TRAVELS BY IDENTITY (`vizfootprint` · `src/session/session.ts` · `travelByIdentity`; the travel is
    // a strategy per clause kind — a point semi-joins, a walk does not). The clause is over the EDGES table's
    // two endpoint columns, which `nodes` has not got; but the walk RECORDED the node keys it reached, and both
    // endpoint relations land on `nodes.disease`, the consumer's key — so the nodes receive the recorded set as a
    // `match` on that key with NO engine ask: the two relations on `via.path` in the def's order, `via.rows` the
    // set's size, `via.label` both declarations' words joined, and the walk itself as `via.from`. (A semi-join
    // over `source` would have answered {Measles, Mumps} and dropped Rubella, only ever a target — the defect
    // this test caught, fixed in the library.) `narrowed` is absent: the clause was judged, on the key.
    const [relSource, relTarget] = GRAPH_RELATIONS;
    expect(session.clausesFor(NODES)).toEqual([{
      from: EDGES,
      fromLabel: 'Co-occurrences',
      response: 'mirror', // the def's routing, not the default rule
      clause: { kind: 'match', field: 'disease', values: ['Mumps', 'Measles', 'Rubella'] },
      via: {
        path: [{ from: relSource!.from, to: relSource!.to }, { from: relTarget!.from, to: relTarget!.to }],
        label: 'one end of the pair, the other end of the pair',
        rows: 3,
        from: { kind: 'neighbourhood', fields: ['source', 'target'], ids: ['Mumps', 'Measles', 'Rubella'] },
      },
    }]);
    const [arrived] = session.clausesFor(NODES);
    expect(arrived?.clause.kind === 'match' ? arrived.clause.values : undefined).toEqual(ids); // derived from the commit's own record
    expect(arrived?.via?.rows).toBe(ids.length);
    expect(arrived?.via?.from.kind === 'neighbourhood' ? arrived.via.from.ids : undefined).toEqual(ids);
    expect(arrived?.via?.label).toBe(`${relSource!.label}, ${relTarget!.label}`);
    expect(arrived?.narrowed).toBeUndefined();
    // every other view receives NOTHING — the def's `none` cuts stand, whatever kind the clause arrives as
    for (const other of ['diseases', 'coverage', 'kinds', 'map', 'weeks', 'trend', 'table', 'sheet']) expect(session.clausesFor(other), other).toEqual([]);

    // THE READ: the nodes window keeps the three node rows the set names — every row TINY has, since the ego net
    // from Mumps is the whole tiny graph (3 node rows, counted off the fixture)
    const nodes = await session.viewQuery({ viewId: NODES });
    expect(nodes.ok && nodes.count).toBe(3);
    expect(nodes.ok && nodes.count).toBe(TINY.nodes.filter((n) => ids.includes(n.disease)).length);
    expect(nodes.ok && nodes.count).toBe(TINY.nodes.length);
    // …and the overview says it for exactly this one consumer, under the layer's declared label
    const live = (await session.overview()).activeSelections.find((s) => s.viewId === EDGES)!;
    expect(Object.keys(live.travelled ?? {})).toEqual([NODES]);
    expect(live.travelled?.[NODES]).toEqual({ clause: { kind: 'match', field: 'disease', values: ids }, via: { path: arrived!.via!.path, label: arrived!.via!.label, rows: 3 }, label: 'Diseases' });
    expect(live.narrowedFor).toBeUndefined();
    // …so every other view's window still reads: a clause naming `source` would refuse a table that has no such column
    const window = await session.viewQuery({ viewId: 'diseases' });
    expect(window.ok).toBe(true);
  });

  it('the live selection carries the WIRE BODY, so the nodes layer can read the set back', async () => {
    const session = await tinySession();
    await session.dispatch({ verb: 'select', viewId: EDGES, field: 'source', seed: 'Mumps', cause });
    const live = (await session.overview()).activeSelections.find((s) => s.viewId === EDGES)!;
    expect([live.kind, live.fields]).toEqual(['neighbourhood', ['source', 'target']]);
    expect(live.value).toEqual({ seed: 'Mumps', derivation: 'ego', hops: 1, ids: ['Mumps', 'Measles', 'Rubella'] });
  });

  it('alt-clicking the SAME node again clears the walk — the point\'s own rule', async () => {
    const session = await tinySession();
    await session.dispatch({ verb: 'select', viewId: EDGES, field: 'source', seed: 'Mumps', cause });
    const cleared = await session.dispatch({ verb: 'select', viewId: EDGES, field: 'source', seed: null, cause });
    expect(cleared.ok && cleared.commit!.value).toBeNull();
    expect((await session.overview()).activeSelections.some((s) => s.viewId === EDGES)).toBe(false);
  });
});
