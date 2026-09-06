/**
 * THE SURFACE — one live vizfootprint session over the NNDSS tables, and the
 * fixed tool port the agent drives it through. Layer 5, wired.
 *
 *   tables  = loadSnapshot()          layer 1 — CDC's bytes, shaped
 *   graph   = loadGraph()             layer 1 — the committed co-occurrence graph, read back
 *   def     = nndssDef(tables, graph) layers 2–4 — declared: five tables, two relations
 *   session = buildDashboard(def)     validated (the firewall throws on a lie)
 *               .createSession()
 *   port    = vizAsTools(session)     the eight tools the agent may call
 *
 * Nothing here knows about HTTP; `server/` puts it on the wire.
 */
import { buildDashboard, vizAsTools } from 'vizfootprint/agent';
import { buildDashboardAsync } from 'vizfootprint/def';
import type { Dashboard } from 'vizfootprint/def';
import type { InteractionSession, VizToolsPort } from 'vizfootprint/agent';
import { nndssDef } from './def.js';
import type { NndssTables } from './etl.js';
import type { NndssGraph } from './graph.js';
import { loadGraph, loadSnapshot } from './snapshot.js';

export interface NndssSurface {
  readonly session: InteractionSession;
  readonly port: VizToolsPort;
  readonly tables: NndssTables;
  /** The graph's two tables, as the def declared them — the `/api/rows` door serves them beside the three. */
  readonly graph: NndssGraph;
  /** The dashboard behind the session — its refresh door, data checks and journal. */
  readonly dashboard: Dashboard;
}

export function buildNndssSurface(tables: NndssTables = loadSnapshot(), graph: NndssGraph = loadGraph()): NndssSurface {
  const dashboard = buildDashboard(nndssDef(tables, graph));
  const session = dashboard.createSession({ as: 'agent' });
  const port = vizAsTools(session, { as: 'agent' });
  return { session, port, tables, graph, dashboard };
}

/** The same surface through the async builder — the one with a refresh door and a data journal (the server's way in). */
export async function buildNndssSurfaceAsync(tables: NndssTables = loadSnapshot(), graph: NndssGraph = loadGraph()): Promise<NndssSurface> {
  const dashboard = await buildDashboardAsync(nndssDef(tables, graph));
  const session = dashboard.createSession({ as: 'agent' });
  const port = vizAsTools(session, { as: 'agent' });
  return { session, port, tables, graph, dashboard };
}
