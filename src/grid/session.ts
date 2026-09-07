/**
 * THE GRID SURFACE — one live vizfootprint session over EIA's four tables.
 *
 *   tables  = loadGrid()              layer 1 — EIA's bytes, shaped
 *   def     = gridDef(tables)         layers 2–4 — declared: four tables, two relations
 *   session = buildDashboard(def)     validated (the firewall throws on a lie)
 *               .createSession()
 *
 * PURE: nothing here reads a disk, so this module runs in a browser as well as
 * in the server. The tables are an ARGUMENT. `./surface.ts` beside it is the
 * node door that defaults them off the committed CSVs; the static site's page
 * hands in tables it fetched over http — see `./http.ts`.
 *
 * Nothing here knows about HTTP; `server/grid-doors.ts` puts it on the wire.
 * It is the CDC demo's `src/nndss/surface.ts` with one difference: this def has
 * no optional half. The nodes and the edges come out of the SAME ETL as the
 * hours, so a grid surface either has all four tables or has no data at all.
 */
import { buildDashboard } from 'vizfootprint/agent';
import type { Cause } from 'vizfootprint/cause';
import { buildDashboardAsync } from 'vizfootprint/def';
import type { Dashboard } from 'vizfootprint/def';
import type { InteractionSession } from 'vizfootprint/agent';
import type { Row } from 'vizfootprint/data';
import { GRID_LAYOUT_SEED, gridDef } from './def.js';
import type { GridTables } from './etl.js';

export interface GridSurface {
  readonly session: InteractionSession;
  readonly tables: GridTables;
  /** The dashboard behind the session — its refresh door, data checks and journal. */
  readonly dashboard: Dashboard;
  /**
   * What the two layout acts REFUSED, kept. `layOutGrid` returns its refusals
   * rather than throwing precisely so a caller can report them: a builder that
   * dropped them would leave an operator with a graph that will not draw and no
   * sentence saying why.
   */
  readonly layoutRefusals: readonly string[];
  /**
   * The graph's two tables READ ONCE, here, where no clause can exist. The rows
   * door serves this instead of re-reading per request — see {@link graphRowsAt}.
   */
  readonly graphRows: GraphRowsAtCursor;
}

/**
 * THE TWO ACTS THAT PUT THE GRID ON A FRAME — dispatched, never computed.
 *
 * `gridLayout` writes `x` / `y` onto `authorities` from a seeded stress layout
 * over `links`; `gridEndpoints` brings those two columns across the two
 * declared relations onto `links` as `from_authority_x` … `to_authority_y`.
 * Both are declared in the def (`GRID_ANALYSES`) and land here as ordinary
 * `analyze` commits, at the top of the log, before anybody has looked at
 * anything.
 *
 * WHY through the verb and not in the page: a position that is not on the trace
 * is a position a replay cannot promise. A reader who asks where a circle came
 * from gets two commits and a seed.
 */
export async function layOutGrid(session: InteractionSession): Promise<readonly string[]> {
  const cause = (intent: string): Cause => ({ requestedBy: 'system', computedBy: 'system', intent });
  const refusals: string[] = [];
  const layout = await land(session, 'gridLayout', 'authorities', cause(`lay the grid out — seeded stress, seed ${String(GRID_LAYOUT_SEED)}`));
  if (layout !== null) refusals.push(layout);
  // WHY the skip and not a second attempt: `gridEndpoints` brings `x` and `y`
  // ACROSS the relations, and a bring-over whose source table has no such column
  // THROWS rather than refusing. Running it after a layout that landed nothing is
  // what turns one refusal into an uncaught error out of the server's boot.
  if (layout !== null) return refusals;
  const ends = await land(session, 'gridEndpoints', 'links', cause('bring each link\'s two endpoint positions over from the authorities'));
  if (ends !== null) refusals.push(ends);
  return refusals;
}

/**
 * One `analyze` act, landed — the refusal SENTENCE, or null when a commit
 * landed. Three ways an act can fail to put anything on the log, and all three
 * come back as words: the session rejected it; it was accepted and landed
 * NOTHING (a degenerate precheck, which is not a rejection); or it THREW.
 */
async function land(session: InteractionSession, analysisId: string, table: string, cause: Cause): Promise<string | null> {
  try {
    const res = await session.dispatch({ verb: 'analyze', analysisId, table, cause });
    if (!res.ok) return res.rejection.detail;
    if (res.analysis?.commit !== undefined) return null;
    const result = res.analysis?.result;
    const why = result !== undefined && !result.ok ? ` — ${result.reason} at ${String(result.n)} rows` : '';
    return `analysis "${analysisId}" landed nothing${why}`;
  } catch (err) {
    return `analysis "${analysisId}" threw: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * THE GRAPH'S TWO TABLES AT THE CURSOR — the committed rows plus whatever the
 * acts above wrote onto them (`x`, `y` on the authorities; the four endpoint
 * columns on the links). The network cell draws these and nothing else.
 *
 * WHY the session and not the ETL's own arrays: the positions are DERIVED
 * COLUMNS landed by two commits, and reading the ETL would give the rows
 * without them — leaving the page to invent coordinates, the exact thing the
 * layout act exists to stop.
 *
 * WHY it must not be re-read per request: a view's clause reaches EVERY table.
 * With a region picked on the bar, the `links` window is REFUSED (that table has
 * no `region` column); with an authority picked on the network itself, the
 * authorities window narrows to one row while all 303 links still come — a
 * node-link whose lines point at circles that are not there. Both are a plain
 * browser reload away on a long-lived session. So this is read ONCE, by
 * {@link buildGridSurfaceAsync}, immediately after the layout acts and BEFORE
 * any clause can exist; the desk narrows in the browser afterwards.
 */
export interface GraphRowsAtCursor {
  readonly authorities: readonly Row[];
  readonly links: readonly Row[];
  /** `null` when the session answered both windows; the refusal sentence when it did not. */
  readonly refused: string | null;
}

export async function graphRowsAt(session: InteractionSession, tables: GridTables): Promise<GraphRowsAtCursor> {
  // the limit is the table's own row count: a window narrower than the table would
  // draw a graph missing links nobody filtered out
  const nodes = await session.viewQuery({ table: 'authorities', limit: tables.authorities.length });
  const edges = await session.viewQuery({ table: 'links', limit: tables.links.length });
  const fallback = { authorities: tables.authorities as readonly Row[], links: tables.links as readonly Row[] };
  if (!nodes.ok) return { ...fallback, refused: nodes.rejected };
  if (!edges.ok) return { ...fallback, refused: edges.rejected };
  return { authorities: nodes.rows, links: edges.rows, refused: null };
}

/**
 * The surface, SYNCHRONOUSLY — for a test or a script that wants a session and
 * nothing else. The graph is declared but NOT laid out: dispatching is async,
 * and a builder that quietly returned before its own acts landed would be a
 * surface whose authorities have no positions and no sign of why. Call
 * {@link layOutGrid} after it, or use the async builder, which does.
 */
export function openGridSurface(tables: GridTables): GridSurface {
  const dashboard = buildDashboard(gridDef(tables));
  const session = dashboard.createSession({ as: 'user' });
  const graphRows: GraphRowsAtCursor = {
    authorities: tables.authorities,
    links: tables.links,
    refused: 'the layout act has not landed on this session — this surface was built synchronously, which declares the graph without laying it out',
  };
  return { session, tables, dashboard, layoutRefusals: [], graphRows };
}

/**
 * The same surface through the async builder — the one with a refresh door and
 * a data journal (the server's way in), and the one that LAYS THE GRID OUT: two
 * `analyze` commits land before the first request is served, so every position
 * the network view draws is already on the trace.
 */
export async function openGridSurfaceAsync(tables: GridTables): Promise<GridSurface> {
  const dashboard = await buildDashboardAsync(gridDef(tables));
  const session = dashboard.createSession({ as: 'user' });
  const layoutRefusals = await layOutGrid(session);
  // read HERE and nowhere else: this is the one moment the session is guaranteed
  // to hold no clause, which is the only moment the whole-dashboard window is the
  // whole graph
  const read = await graphRowsAt(session, tables);
  const graphRows: GraphRowsAtCursor = read.refused === null && layoutRefusals.length > 0 ? { ...read, refused: layoutRefusals.join('; ') } : read;
  return { session, tables, dashboard, layoutRefusals, graphRows };
}
