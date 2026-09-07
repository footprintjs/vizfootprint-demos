/**
 * THE GRID'S NETWORK — where the positions came from, and which picture the
 * rule says to draw.
 *
 * Two claims are pinned here and they are different claims.
 *
 * PROVENANCE. Nothing on the frame was computed by the page: a seeded stress
 * layout landed `x`/`y` on `authorities` as an `analyze` commit, and a
 * bring-over carried them across the two DECLARED relations onto `links` as
 * `from_authority_x` … `to_authority_y` as a second. So: both acts land, the
 * columns arrive, the join is real, the seed makes it reproducible, and a
 * replay of the log rebuilds every coordinate.
 *
 * THE READING. `graphReadingFor` is the library's rule, with its two studies
 * named in its own reason. Given THIS graph's counts it prefers the node-link;
 * given the CDC demo's it prefers the matrix. Neither verdict is written down
 * in this repo — these tests ask the rule and check the answer it gives, so a
 * change in the library's thresholds shows up here rather than in a caption
 * nobody re-read.
 */
import { describe, expect, it } from 'vitest';
import { buildDashboard, graphReadingFor, layerAddress } from 'vizfootprint/def';
import type { CommitRecord } from 'vizfootprint/log';
import { GRID_LAYOUT_SEED, NETWORK_EDGES_LAYER, NETWORK_NODES_LAYER, NETWORK_VIEW, gridDef } from '../src/grid/def.js';
import { buildGridSurface, buildGridSurfaceAsync, graphRowsAt, layOutGrid } from '../src/grid/surface.js';
import { loadGrid } from '../src/grid/snapshot.js';
import { TINY_GRID } from './gridFixture.js';

const numberAt = (row: Readonly<Record<string, unknown>>, column: string): number => {
  const v = row[column];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`"${column}" is ${JSON.stringify(v)}, not a finite number`);
  return v;
};

/** A session over the tiny grid, with the two acts landed — the shape the async surface builds. */
async function tinySession(): Promise<ReturnType<ReturnType<typeof buildDashboard>['createSession']>> {
  const session = buildDashboard(gridDef(TINY_GRID)).createSession({ as: 'user' });
  expect(await layOutGrid(session)).toEqual([]); // no refusals: both acts landed
  return session;
}

/** An unordered pair, spelled the same whichever direction wrote it — the fact the reading rule asks for. */
const pairKey = (a: string, b: string): string => (a < b ? `${a} ${b}` : `${b} ${a}`);

/**
 * The committed slice, parsed ONCE for this file. 8.7 MB of CSV per test is a
 * cost that proves nothing the first parse did not, and it starves the rest of
 * the suite's workers — which is how a five-second budget elsewhere runs out.
 */
let slice: ReturnType<typeof loadGrid> | null = null;
const theSlice = (): ReturnType<typeof loadGrid> => (slice ??= loadGrid());

// ── the def declares the frame ───────────────────────────────────────────────

describe('the def: one view, two layers, one table each', () => {
  it('draws the links UNDER the authorities, each over its own table', () => {
    const net = (gridDef(TINY_GRID).encodings ?? []).find((e) => e.viewId === NETWORK_VIEW);
    expect(net?.chartKind).toBe('network');
    expect((net?.layers ?? []).map((l) => [l.layerId, l.table, l.channels])).toEqual([
      [NETWORK_EDGES_LAYER, 'links', ['source', 'target', 'sourceX', 'sourceY', 'targetX', 'targetY']],
      [NETWORK_NODES_LAYER, 'authorities', ['x', 'y', 'key']],
    ]);
    // declaration order is paint order
    expect((net?.layers ?? [])[0]?.layerId).toBe(NETWORK_EDGES_LAYER);
    // the nodes layer binds the two columns the layout writes, and EIA's code as the key
    expect((net?.layers ?? [])[1]?.initial).toEqual({ x: 'x', y: 'y', key: 'authority' });
    // the edges layer binds the four columns the bring-over writes
    expect((net?.layers ?? [])[0]?.initial).toMatchObject({ sourceX: 'from_authority_x', sourceY: 'from_authority_y', targetX: 'to_authority_x', targetY: 'to_authority_y' });
  });
});

// ── the acts land, and what they left behind ─────────────────────────────────

describe('the positions come from two commits', () => {
  it('lands one analyze commit per act, in order, with the seed in the words', async () => {
    const session = await tinySession();
    const records = session.commits('anywhere');
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.viewId)).toEqual(['analysis:gridLayout', 'analysis:gridEndpoints']);
    // WHY the seed is in the intent: a reader who asks where a circle came from gets the act AND the number that made it repeatable
    expect(records[0]!.cause.intent).toBe(`lay the grid out — seeded stress, seed ${String(GRID_LAYOUT_SEED)}`);
    expect(records[1]!.cause.intent).toBe("bring each link's two endpoint positions over from the authorities");
  });

  it('puts x and y on the authorities and the four ends on the links — plain columns, at the cursor', async () => {
    const session = await tinySession();
    const rows = await graphRowsAt(session, TINY_GRID);
    expect(rows.refused).toBeNull();
    expect(rows.authorities).toHaveLength(3);
    expect(rows.links).toHaveLength(3);
    expect(Object.keys(rows.authorities[0]!)).toContain('x');
    expect(Object.keys(rows.links[0]!)).toEqual([
      'from_authority',
      'to_authority',
      'to_kind',
      'hours',
      'hours_reported',
      'first_hour',
      'last_hour',
      'net_mwh',
      'report_state',
      'from_authority_x',
      'from_authority_y',
      'to_authority_x',
      'to_authority_y',
    ]);
    for (const a of rows.authorities) expect([typeof a['x'], typeof a['y']]).toEqual(['number', 'number']);
  });

  it('the join is REAL: every link end is exactly its endpoint authority\'s position', async () => {
    const session = await tinySession();
    const { authorities, links } = await graphRowsAt(session, TINY_GRID);
    const at = new Map(authorities.map((a) => [String(a['authority']), [numberAt(a, 'x'), numberAt(a, 'y')] as const]));
    for (const l of links) {
      expect([numberAt(l, 'from_authority_x'), numberAt(l, 'from_authority_y')]).toEqual(at.get(String(l['from_authority'])));
      expect([numberAt(l, 'to_authority_x'), numberAt(l, 'to_authority_y')]).toEqual(at.get(String(l['to_authority'])));
    }
    // three authorities, and no two of them share a place — a layout that stacked them would draw one circle
    expect(new Set(authorities.map((a) => `${String(numberAt(a, 'x'))},${String(numberAt(a, 'y'))}`)).size).toBe(3);
  });

  it('the seed is DATA, so two sessions place the authorities identically', async () => {
    const first = await graphRowsAt(await tinySession(), TINY_GRID);
    const second = await graphRowsAt(await tinySession(), TINY_GRID);
    expect(second.authorities).toEqual(first.authorities);
    expect(second.links).toEqual(first.links);
  });

  it('a replay of the log rebuilds every coordinate — the act is on the trace, the values never were', async () => {
    const session = await tinySession();
    const before = await graphRowsAt(session, TINY_GRID);
    const log = session.log.records as readonly CommitRecord[];

    const fresh = buildDashboard(gridDef(TINY_GRID)).createSession({ as: 'user' });
    const replayed = await fresh.replay(log);
    expect(replayed.ok).toBe(true);
    const after = await graphRowsAt(fresh, TINY_GRID);
    expect(after.authorities).toEqual(before.authorities);
    expect(after.links).toEqual(before.links);
  });

  it('the layer address is what the marks speak under, and it answers its own window', async () => {
    const session = await tinySession();
    const nodes = await session.viewQuery({ viewId: layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER), limit: 10 });
    expect(nodes.ok && nodes.count).toBe(3);
    const edges = await session.viewQuery({ viewId: layerAddress(NETWORK_VIEW, NETWORK_EDGES_LAYER), limit: 10 });
    expect(edges.ok && edges.count).toBe(3);
  });

  it('a click on a circle lands under net~nodes, never under net', async () => {
    const session = await tinySession();
    const address = layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER);
    const picked = await session.dispatch({ verb: 'select', viewId: address, field: 'authority', value: 'BBB', cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick BBB on the network' } });
    expect(picked.ok).toBe(true);
    const landed = session.commits('anywhere').at(-1)!;
    expect([landed.viewId, landed.field, landed.value]).toEqual([address, 'authority', 'BBB']);
    expect(landed.viewId).not.toBe(NETWORK_VIEW);
  });

  it('the synchronous surface declares the graph and says, in words, that it has not laid it out', () => {
    const surface = buildGridSurface(TINY_GRID);
    expect(surface.session.commits('anywhere')).toHaveLength(0);
    expect(surface.graphRows.refused).toContain('built synchronously');
  });
});

// ── the real slice: the counts the page actually draws ───────────────────────

describe('over the committed three weeks, the view draws every row', () => {
  it('places all 70 authorities and all 303 directed links, and refuses nothing', async () => {
    const tables = theSlice();
    const surface = await buildGridSurfaceAsync(tables);
    expect(surface.layoutRefusals).toEqual([]);
    expect(surface.graphRows.refused).toBeNull();
    expect(tables.authorities).toHaveLength(70);
    expect(tables.links).toHaveLength(303);
    expect(tables.hourly).toHaveLength(30_746);
    expect(tables.interchange).toHaveLength(149_848);
    expect(tables.hours).toHaveLength(504);

    const placed = surface.graphRows.authorities.filter((a) => typeof a['x'] === 'number' && typeof a['y'] === 'number');
    expect(placed).toHaveLength(70); // a circle with no position is not drawn, so "all placed" is what makes the count on screen the table's own
    const drawn = surface.graphRows.links.filter((l) => typeof l['from_authority_x'] === 'number' && typeof l['to_authority_x'] === 'number');
    expect(drawn).toHaveLength(303);
  }, 120_000);

  it('303 directed links are 157 undirected pairs among 70 authorities — sparse, about five neighbours each', () => {
    const tables = theSlice();
    const pairs = new Set(tables.links.map((l) => pairKey(l.from_authority, l.to_authority)));
    expect(pairs.size).toBe(157);
    expect(Math.round((tables.links.length / tables.authorities.length) * 10) / 10).toBe(4.3);
  }, 120_000);
});

// ── the reading rule, over BOTH demos ────────────────────────────────────────

describe('which picture the library says to draw', () => {
  it('prefers the NODE-LINK here, and its reason names the study', () => {
    const reading = graphReadingFor({ nodes: 70, edges: 157, interaction: true });
    expect(reading.prefer).toBe('node-link');
    expect(reading.reason).toContain('Ghoniem');
    // the demo can hover, and that is the fact that keeps a 70-node picture readable:
    // take the interaction away and the same rule sends the reader to the matrix
    expect(graphReadingFor({ nodes: 70, edges: 157 }).prefer).toBe('matrix');
  });

  it('prefers the MATRIX over the CDC demo\'s graph, which is complete', () => {
    // 15 diseases, 105 pairs = every pair, so density 1
    const reading = graphReadingFor({ nodes: 15, edges: 105, interaction: true });
    expect(reading.prefer).toBe('matrix');
    expect(reading.rule).toBe('dense');
    expect(reading.reason).toContain('the lines cross more than they connect');
  });

  it('the two demos differ because the GRAPHS differ, not because the pages do — same interaction, opposite verdicts', () => {
    const grid = graphReadingFor({ nodes: 70, edges: 157, interaction: true });
    const cdc = graphReadingFor({ nodes: 15, edges: 105, interaction: true });
    expect([grid.prefer, cdc.prefer]).toEqual(['node-link', 'matrix']);
  });
});
