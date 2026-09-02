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
import { buildDashboard, vizAsTools } from '../../../vizfootprint/src/agent/index.js';
import type { InteractionSession, VizToolsPort } from '../../../vizfootprint/src/agent/index.js';
import { nndssDef } from './def.js';
import { loadSnapshot, type NndssTables } from './etl.js';

export interface NndssSurface {
  readonly session: InteractionSession;
  readonly port: VizToolsPort;
  readonly tables: NndssTables;
}

export function buildNndssSurface(tables: NndssTables = loadSnapshot()): NndssSurface {
  const dashboard = buildDashboard(nndssDef(tables));
  const session = dashboard.createSession({ as: 'agent' });
  const port = vizAsTools(session, { as: 'agent' });
  return { session, port, tables };
}
