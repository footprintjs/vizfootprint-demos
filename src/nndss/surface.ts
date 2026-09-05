/**
 * THE SURFACE — one live vizfootprint session over the NNDSS tables, and the
 * fixed tool port the agent drives it through. Layer 5, wired.
 *
 *   tables  = loadSnapshot()          layer 1 — CDC's bytes, shaped
 *   def     = nndssDef(tables)        layers 2–4 — declared
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
import { loadSnapshot } from './snapshot.js';

export interface NndssSurface {
  readonly session: InteractionSession;
  readonly port: VizToolsPort;
  readonly tables: NndssTables;
  /** The dashboard behind the session — its refresh door, data checks and journal. */
  readonly dashboard: Dashboard;
}

export function buildNndssSurface(tables: NndssTables = loadSnapshot()): NndssSurface {
  const dashboard = buildDashboard(nndssDef(tables));
  const session = dashboard.createSession({ as: 'agent' });
  const port = vizAsTools(session, { as: 'agent' });
  return { session, port, tables, dashboard };
}

/** The same surface through the async builder — the one with a refresh door and a data journal (the server's way in). */
export async function buildNndssSurfaceAsync(tables: NndssTables = loadSnapshot()): Promise<NndssSurface> {
  const dashboard = await buildDashboardAsync(nndssDef(tables));
  const session = dashboard.createSession({ as: 'agent' });
  const port = vizAsTools(session, { as: 'agent' });
  return { session, port, tables, dashboard };
}
