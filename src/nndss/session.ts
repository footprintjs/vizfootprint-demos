/**
 * THE SURFACE — one live vizfootprint session over the NNDSS tables, and the
 * fixed tool port the agent drives it through. Layer 5, wired.
 *
 * PURE: nothing here reads a disk, so this module runs in a browser as well as
 * in the server. The tables and the graph are ARGUMENTS. `./surface.ts` beside
 * it is the node door that defaults them off the committed files; the static
 * site's page hands in tables it fetched over http. One session builder, two
 * ways in — see `./http.ts`.
 *
 *   tables  = loadSnapshot()          layer 1 — CDC's bytes, shaped, with the Census denominator beside them
 *   graph   = loadGraph()             layer 1 — the committed co-occurrence graph, read back
 *   def     = nndssDef(tables, graph) layers 2–4 — declared: six tables, three relations
 *   session = buildDashboard(def)     validated (the firewall throws on a lie)
 *               .createSession()
 *   port    = vizAsTools(session)     the eight tools the agent may call
 *
 * Nothing here knows about HTTP; `server/` puts it on the wire.
 */
import { buildDashboard, vizAsTools } from 'vizfootprint/agent';
import type { Cause } from 'vizfootprint/cause';
import { buildDashboardAsync } from 'vizfootprint/def';
import type { Dashboard } from 'vizfootprint/def';
import type { InteractionSession, VizToolsPort } from 'vizfootprint/agent';
import type { Row } from 'vizfootprint/data';
import { GRAPH_LAYOUT_SEED, nndssDef } from './def.js';
import type { NndssTables } from './etl.js';
import type { NndssGraph } from './graph.js';
import { POPULATION_ACTS, POPULATION_ON_CELLS, RATE_COLUMN } from './population.js';

export interface NndssSurface {
  readonly session: InteractionSession;
  readonly port: VizToolsPort;
  readonly tables: NndssTables;
  /** The graph's two tables, as the def declared them — the `/api/rows` door serves them beside the three. */
  readonly graph: NndssGraph;
  /** The dashboard behind the session — its refresh door, data checks and journal. */
  readonly dashboard: Dashboard;
  /**
   * What the two layout acts REFUSED, kept. `layOutGraph` returns its refusals
   * rather than throwing precisely so a caller can report them, and a builder
   * that dropped them would leave an operator with a graph that will not draw
   * and no sentence saying why: `graphRowsAt` reports only a refused WINDOW,
   * never a refused act.
   */
  readonly layoutRefusals: readonly string[];
  /**
   * The graph's two tables READ ONCE, here, where no clause can exist. The rows
   * door serves this instead of re-reading per request — see {@link graphRowsAt}.
   */
  readonly graphRows: GraphRowsAtCursor;
  /** What the two rate acts REFUSED, kept for the same reason `layoutRefusals` is — see {@link landTheRate}. */
  readonly rateRefusals: readonly string[];
  /**
   * The cells table AT THE CURSOR — CDC's rows plus the two columns the rate
   * acts wrote onto them — read once, at the same clause-free moment as the
   * graph. The rows door serves THIS as `cells`; see {@link cellsAt}.
   */
  readonly cellsAtCursor: CellsAtCursor;
}

/**
 * THE TWO ACTS THAT PUT THE GRAPH ON A FRAME — dispatched, never computed.
 *
 * `graphLayout` writes `x` / `y` onto the nodes table from a seeded stress
 * layout; `graphEndpoints` brings those two columns across the declared
 * relations onto the edges table as `source_x` … `target_y`. Both are declared
 * in the def (`GRAPH_ANALYSES`) and land here as ordinary `analyze` commits, at
 * the top of the log, before anybody has looked at anything.
 *
 * WHY through the verb and not in the page: a position that is not on the trace
 * is a position a replay cannot promise. A reader who asks where a circle on
 * screen came from gets two commits and a seed; a script that pre-computed the
 * coordinates into the CSV would have nothing to show them.
 *
 * The refusals are RETURNED, never thrown: a session with no graph tables
 * refuses both acts in the library's own sentence, and a surface that still
 * serves three tables is better than a server that will not start.
 */
export async function layOutGraph(session: InteractionSession): Promise<readonly string[]> {
  const cause = (intent: string): Cause => ({ requestedBy: 'system', computedBy: 'system', intent });
  const refusals: string[] = [];
  const layout = await land(session, 'graphLayout', 'nodes', cause(`lay the disease graph out — seeded stress, seed ${String(GRAPH_LAYOUT_SEED)}`));
  if (layout !== null) refusals.push(layout);
  // WHY the skip and not a second attempt: `graphEndpoints` brings `x` and `y`
  // ACROSS the relations, and a bring-over whose source table has no such column
  // THROWS rather than refusing. Running it after a layout that landed nothing
  // is what turns one refusal into an uncaught error out of the server's boot.
  if (layout !== null) return refusals;
  const ends = await land(session, 'graphEndpoints', 'edges', cause('bring each edge\'s two endpoint positions over from the nodes'));
  if (ends !== null) refusals.push(ends);
  return refusals;
}

/**
 * THE TWO ACTS THAT TURN COUNTS INTO A RATE — dispatched, never computed.
 *
 * `bringPopulation` carries `population` across the declared relation
 * `cells.jurisdiction → population.jurisdiction` and lands it on `cells` as
 * `jurisdiction_population`; `casesPer100k` then lands
 * `cases / jurisdiction_population * 100000` as a declared column
 * (`POPULATION_ANALYSES`, `./population.ts`). Both are ordinary `analyze`
 * commits at the top of the log, right after the layout's two, carrying their
 * whole declaration — so a replay rebuilds the rate from bytes alone and a
 * reader who asks where a number came from is shown two commits.
 *
 * WHY the second is skipped when the first refused: the derive column is judged
 * against the columns visible at the cursor, and without the denominator it is
 * refused in a sentence naming the column it could not read — a second sentence
 * about the same missing table, which a reader has already been told.
 *
 * A surface with no population table refuses both here, in words, before any
 * dispatch: the def declared no such act, and a session sentence about an
 * undeclared analysis would name the symptom rather than the cause.
 */
export async function landTheRate(session: InteractionSession, tables: Pick<NndssTables, 'population'>): Promise<readonly string[]> {
  if (tables.population === undefined) return ['this surface declares no population table, so there is no denominator to bring over and no rate to derive'];
  const cause = (intent: string): Cause => ({ requestedBy: 'system', computedBy: 'system', intent });
  const [bring, derive] = POPULATION_ACTS;
  const brought = await land(session, bring, 'cells', cause(`bring each place's Census population over the declared relation onto the cells, as ${POPULATION_ON_CELLS}`));
  if (brought !== null) return [brought];
  const rate = await land(session, derive, 'cells', cause(`derive ${RATE_COLUMN} = cases / ${POPULATION_ON_CELLS} * 100000 on every cell`));
  return rate === null ? [] : [rate];
}

/**
 * One `analyze` act, landed — the refusal SENTENCE, or null when a commit
 * landed. Three ways an act can fail to put anything on the log, and all three
 * come back as words:
 *   - the session rejected it (`ok: false`);
 *   - it was accepted and landed NOTHING (a degenerate precheck answers `ok`
 *     with no commit — R14's honest flag, which is not a rejection);
 *   - it THREW (a bring-over over a column the related table does not carry
 *     throws by design). A server that will not start is worse than a surface
 *     that serves three tables and says why the other two have no positions.
 */
async function land(session: InteractionSession, analysisId: string, table: string, cause: Cause): Promise<string | null> {
  try {
    const res = await session.dispatch({ verb: 'analyze', analysisId, table, cause });
    if (!res.ok) return res.rejection.detail;
    if (res.analysis?.commit !== undefined) return null;
    const result = res.analysis?.result;
    // Two ways an analysis lands nothing, and they are not the same thing: a
    // DEGENERATE fit read the rows and found no honest answer in them; an
    // UNAVAILABLE one never read them, because the engine refused — so it
    // carries the engine's own sentence and no row count at all.
    const why =
      result === undefined || result.ok
        ? ''
        : result.reason === 'unavailable'
          ? ` — the rows could not be read: ${result.rejection.detail ?? result.rejection.reason}`
          : ` — ${result.reason} at ${String(result.n)} rows`;
    return `analysis "${analysisId}" landed nothing${why}`;
  } catch (err) {
    return `analysis "${analysisId}" threw: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * THE GRAPH'S TWO TABLES AT THE CURSOR — the committed rows plus whatever the
 * acts above wrote onto them (`x`, `y` on the nodes; `source_x` … `target_y` on
 * the edges). The network cell draws these and nothing else.
 *
 * WHY the session and not the committed CSVs: the positions are DERIVED
 * COLUMNS, landed by two commits. Reading the files would give the rows without
 * them, and the page would have to invent coordinates — the exact thing the
 * layout act exists to stop.
 *
 * The window is the whole-dashboard truth (no `viewId`), which the library
 * defines as "every live clause filtering" — so this is read ONCE, by
 * {@link buildNndssSurfaceAsync}, immediately after the layout acts and BEFORE
 * any clause can exist, and the answer is carried on the surface. The desk
 * narrows in the browser afterwards the way every other cell does.
 *
 * WHY it must not be re-read per request: a view's clause reaches EVERY table,
 * and the graph's two share almost no column with the other three. With a node
 * selected on the network itself, the nodes window narrows to one row while all
 * 105 edges still come — a node-link whose links point at nodes that are not
 * there, handed over as "nothing was refused". That is a plain browser reload
 * away on a long-lived session, and it is this law's whole reason.
 *
 * It is no longer the OTHER reason. A disease selected on the bar used to make
 * the edges window fail outright ("table \"edges\" has no column \"disease\""),
 * because an engine asked to judge a column the table has not got refused the
 * whole read. The library now NARROWS such a clause and reports it on the window
 * (`ReachingClause.narrowed`), so that read succeeds and the clause is listed as
 * having filtered nothing — see the library's `src/session/README.md` and
 * `../exo/README.md`, where deleting the demo's workaround for the old
 * behaviour was the point of a whole packet.
 *
 * A refusal is REPORTED, not thrown: the committed rows come back with the
 * library's sentence beside them, and the cell says it cannot draw rather than
 * drawing a graph with no positions.
 */
export interface GraphRowsAtCursor {
  readonly nodes: readonly Row[];
  readonly edges: readonly Row[];
  /** `null` when the session answered both windows; the refusal sentence when it did not. */
  readonly refused: string | null;
}

export async function graphRowsAt(session: InteractionSession, graph: NndssGraph): Promise<GraphRowsAtCursor> {
  // the limit is the table's own row count: a window narrower than the table would
  // draw a graph missing edges nobody filtered out
  const nodes = await session.viewQuery({ table: 'nodes', limit: graph.nodes.length });
  const edges = await session.viewQuery({ table: 'edges', limit: graph.edges.length });
  if (!nodes.ok) return { nodes: graph.nodes, edges: graph.edges, refused: nodes.rejected };
  if (!edges.ok) return { nodes: graph.nodes, edges: graph.edges, refused: edges.rejected };
  return { nodes: nodes.rows, edges: edges.rows, refused: null };
}

/**
 * THE CELLS TABLE AT THE CURSOR — CDC's rows plus whatever the rate acts wrote
 * onto them (`jurisdiction_population`, `cases_per_100k`). The graph's law,
 * applied to the cells: a derived column lives on the session, not in the CSV,
 * and a desk drawn off the file would have to divide on its own — the exact
 * thing the acts exist to have already done, on the trace.
 *
 * Read ONCE, clause-free, by {@link openNndssSurfaceAsync}, for the reason
 * {@link graphRowsAt} gives: a window read later narrows under whatever is
 * selected, and a reload would serve a dashboard missing the cells somebody
 * happened to have filtered out.
 *
 * `refused` carries the sentence when the acts did not land or the window was
 * not answered — and the rows are then CDC's own, so a desk still draws its
 * counts and its rate cell says why it has none.
 */
export interface CellsAtCursor {
  readonly rows: readonly Row[];
  /** `null` when both acts landed and the window answered; the sentence when it did not. */
  readonly refused: string | null;
}

export async function cellsAt(session: InteractionSession, tables: NndssTables, rateRefusals: readonly string[]): Promise<CellsAtCursor> {
  if (rateRefusals.length > 0) return { rows: tables.cells, refused: rateRefusals.join('; ') };
  // a window of zero rows is a table of zero rows, not a question worth asking
  if (tables.cells.length === 0) return { rows: [], refused: null };
  const window = await session.viewQuery({ table: 'cells', limit: tables.cells.length });
  return window.ok ? { rows: window.rows, refused: null } : { rows: tables.cells, refused: window.rejected };
}

/**
 * The surface, SYNCHRONOUSLY — for a test or a script that wants a session and
 * nothing else. The graph is declared but NOT laid out: dispatching is async,
 * and a builder that quietly returned before its own acts landed would be a
 * surface whose nodes have no positions and no sign of why. Call
 * {@link layOutGraph} after it, or use the async builder, which does.
 */
export function openNndssSurface(tables: NndssTables, graph: NndssGraph): NndssSurface {
  const dashboard = buildDashboard(nndssDef(tables, graph));
  const session = dashboard.createSession({ as: 'agent' });
  const port = vizAsTools(session, { as: 'agent' });
  // no acts landed, so the committed rows are all there is — and the sentence
  // says exactly that rather than leaving the cell to guess
  const graphRows: GraphRowsAtCursor = {
    nodes: graph.nodes,
    edges: graph.edges,
    refused: 'the layout act has not landed on this session — this surface was built synchronously, which declares the graph without laying it out',
  };
  const cellsAtCursor: CellsAtCursor = {
    rows: tables.cells,
    refused: 'the rate acts have not landed on this session — this surface was built synchronously, which declares the population without bringing it over',
  };
  return { session, port, tables, graph, dashboard, layoutRefusals: [], graphRows, rateRefusals: [], cellsAtCursor };
}

/**
 * The same surface through the async builder — the one with a refresh door and a
 * data journal (the server's way in), and the one that LAYS THE GRAPH OUT: two
 * `analyze` commits land before the first request is served, so every position
 * the network view draws is already on the trace.
 */
export async function openNndssSurfaceAsync(tables: NndssTables, graph: NndssGraph): Promise<NndssSurface> {
  const dashboard = await buildDashboardAsync(nndssDef(tables, graph));
  const session = dashboard.createSession({ as: 'agent' });
  const port = vizAsTools(session, { as: 'agent' });
  const layoutRefusals = await layOutGraph(session);
  const rateRefusals = await landTheRate(session, tables);
  // read HERE and nowhere else: this is the one moment the session is guaranteed
  // to hold no clause, which is the only moment the whole-dashboard window is
  // the whole graph — and the whole cells table
  const read = await graphRowsAt(session, graph);
  const graphRows: GraphRowsAtCursor = read.refused === null && layoutRefusals.length > 0 ? { ...read, refused: layoutRefusals.join('; ') } : read;
  const cellsAtCursor = await cellsAt(session, tables, rateRefusals);
  return { session, port, tables, graph, dashboard, layoutRefusals, graphRows, rateRefusals, cellsAtCursor };
}
