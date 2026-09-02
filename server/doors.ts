/**
 * THE DOORS — the vizfootprint session on the wire. One function that answers
 * `true` when it owned the request. The state door speaks vizfootprint-ui's
 * polled `/api/state` contract verbatim; the rest mirror the library's own
 * demo, so the same cockpit code drives both.
 *
 *   GET  /api/state        everything the cockpit renders
 *   GET  /api/rows         the three tables + grain + the absence vocabulary
 *   GET  /api/proposals    what beat 1 already did here (survives a reload)
 *   POST /api/dispatch     a human gesture → a user-badged commit
 *   POST /api/seek | checkpoint | paths | compare | bring-over | undo
 *   POST /api/proposals    beat 1 — six scripted proposals; the ledger rules
 *   POST /api/reset        a fresh surface (a session is cheap)
 *
 * One surface per server, single-user — the honest scope of a demo.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DispatchAction, FilterRange } from '../../vizfootprint/src/agent/index.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/nndss/absence.js';
import { runScriptedProposals, type ProposalOutcome } from '../src/nndss/proposals.js';
import { buildNndssSurface, type NndssSurface } from '../src/nndss/surface.js';
import { DISPATCH_VERBS } from '../../vizfootprint/src/def/index.js';
import { nndssDef } from '../src/nndss/def.js';

export const API_ROOT = '/api';
const MAX_BODY_BYTES = 64 * 1024;

export interface Desk {
  surface: NndssSurface;
  proposals: readonly ProposalOutcome[];
}

export function createDesk(): Desk {
  return { surface: buildNndssSurface(), proposals: [] };
}

class BodyRefusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BodyRefusal(413, `body over ${String(MAX_BODY_BYTES)} bytes`);
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BodyRefusal(400, 'body is not JSON');
  }
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

const userCause = (intent: string) => ({ requestedBy: 'user', computedBy: 'user', intent }) as const;

/** A human gesture from the cockpit → a validated dispatch action, or a plain refusal. */
function userAction(body: Record<string, unknown>): DispatchAction | { readonly error: string } {
  const verb = body['verb'];
  const str = (k: string): string | undefined => (typeof body[k] === 'string' ? (body[k] as string) : undefined);
  const cause = userCause(str('intent') ?? `${String(verb)} ${str('field') ?? str('analysisId') ?? ''}`.trim());
  const viewId = str('viewId');
  const field = str('field');
  switch (verb) {
    case 'filter': {
      if (viewId === undefined || field === undefined) return { error: 'filter needs viewId and field' };
      const range = body['range'];
      return { verb: 'filter', viewId, field, range: (Array.isArray(range) ? (range as unknown as FilterRange) : null) as FilterRange, cause };
    }
    case 'select':
      if (viewId === undefined || field === undefined) return { error: 'select needs viewId and field' };
      return { verb: 'select', viewId, field, value: body['value'] as string | number | null, cause };
    case 'analyze': {
      const analysisId = str('analysisId');
      if (analysisId === undefined) return { error: 'analyze needs analysisId' };
      return { verb: 'analyze', analysisId, cause };
    }
    case 'reencode': {
      const channel = str('channel');
      if (viewId === undefined || channel === undefined || field === undefined) return { error: 'reencode needs viewId, channel, and field' };
      return { verb: 'reencode', viewId, channel, field, cause };
    }
    case 'navigate':
      if (viewId === undefined) return { error: 'navigate needs a viewId' };
      return { verb: 'navigate', viewId, field, value: str('value'), cause };
    default:
      return { error: `unsupported human verb "${String(verb)}"` };
  }
}

/** The cockpit's polled state — vizfootprint-ui's documented `/api/state` shape. */
async function stateOf(desk: Desk): Promise<Record<string, unknown>> {
  const { session, tables } = desk.surface;
  const overview = await session.overview();
  const selected = await session.selectedRows();
  return {
    records: session.log.records,
    fdr: overview.fdr,
    analyses: overview.analyses,
    activeSelections: overview.activeSelections,
    views: overview.views,
    gaps: session.gaps(),
    selectedCount: selected.length,
    totalRows: tables.cells.length,
    defaultTable: overview.defaultTable,
    columns: overview.columns,
    encodings: overview.encodings,
    activity: [],
    turnActive: false,
    mode: 'snapshot',
    cursor: overview.time.cursor,
    head: overview.time.head,
    branches: session.branches().map((b) => ({ tip: b.tip, length: b.length, actor: b.actor, active: b.active })),
    checkpoints: session.checkpoints().map((c) => ({ label: c.label, commitId: c.commitId, at: c.at, ts: c.ts })),
    cursorTests: overview.time.cursorTests,
    viewingPast: overview.time.viewingPast,
    paths: { ...overview.paths, archivedList: session.paths({ includeArchived: true }) },
    charts: session.charts(),
    layouts: overview.layouts,
  };
}

async function pathsAction(desk: Desk, body: Record<string, unknown>): Promise<unknown> {
  const { session } = desk.surface;
  const name = typeof body['name'] === 'string' ? (body['name'] as string) : '';
  const commitId = typeof body['commitId'] === 'string' ? (body['commitId'] as string) : undefined;
  switch (body['action']) {
    case 'switch':
      return name === '' ? { ok: false, error: 'paths switch needs a name' } : session.switchPath(name);
    case 'rename': {
      const from = typeof body['from'] === 'string' ? (body['from'] as string) : '';
      const to = typeof body['to'] === 'string' ? (body['to'] as string) : '';
      return from === '' || to === '' ? { ok: false, error: 'paths rename needs from and to' } : session.renamePath(from, to);
    }
    case 'new':
      return commitId === undefined ? { ok: false, error: 'paths new needs a commitId' } : session.newPathAt(commitId, name === '' ? undefined : name);
    case 'archive':
      return name === '' ? { ok: false, error: 'paths archive needs a name' } : session.archivePath(name, { as: 'user' });
    case 'restore':
      return name === '' ? { ok: false, error: 'paths restore needs a name' } : session.restorePath(name, { as: 'user' });
    case 'discard':
      return session.discardFromHere({ ...(commitId !== undefined ? { at: commitId } : {}), as: 'user' });
    case 'adopt':
      return name === '' ? { ok: false, error: 'paths adopt needs a name' } : session.adoptPath(name, { as: 'user' });
    default:
      return { ok: false, error: `unknown paths action "${String(body['action'])}"` };
  }
}

export async function serveDoors(desk: Desk, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(`${API_ROOT}/`)) return false;
  const door = url.pathname.slice(API_ROOT.length + 1);
  const { session, tables } = desk.surface;
  try {
    if (req.method === 'GET' && door === 'state') return sendJson(res, 200, await stateOf(desk)), true;
    if (req.method === 'GET' && door === 'rows') {
      return sendJson(res, 200, {
        cells: tables.cells,
        jurisdictions: tables.jurisdictions,
        series: tables.series,
        grain: tables.grain,
        diseases: tables.diseases,
        weeks: tables.weeks,
        counts: tables.counts,
        absence: { field: ABSENCE_FIELD, states: ABSENCE_STATES },
        // THE GRAMMAR, as declared — the Grammar panel renders this and nothing else:
        // the verbs the library dispatches, each view's channel vocabulary and its
        // starting bindings, and the one wiring rule in force today.
        grammar: {
          verbs: DISPATCH_VERBS,
          encodings: nndssDef(tables).encodings ?? [],
          links: 'implicit-crossfilter',
          linksMeaning: 'every view\'s selection filters every other view; a view never filters itself',
        },
      }), true;
    }
    if (req.method === 'GET' && door === 'proposals') return sendJson(res, 200, { proposals: desk.proposals, ledger: (await session.overview()).fdr }), true;
    if (req.method !== 'POST') return sendJson(res, 405, { error: `${door} is POST` }), true;
    const body = await readJson(req);
    switch (door) {
      case 'dispatch': {
        const action = userAction(body);
        if ('error' in action) return sendJson(res, 400, { ok: false, error: action.error }), true;
        return sendJson(res, 200, await session.dispatch(action, { as: 'user' })), true;
      }
      case 'seek':
        return sendJson(res, 200, session.seek(String(body['commitId'] ?? ''))), true;
      case 'checkpoint':
        return sendJson(res, 200, await session.dispatch({ verb: 'checkpoint', label: String(body['label'] ?? ''), cause: userCause('name this position') }, { as: 'user' })), true;
      case 'paths':
        return sendJson(res, 200, await pathsAction(desk, body)), true;
      case 'compare':
        return sendJson(res, 200, await session.compare(String(body['a'] ?? ''), String(body['b'] ?? ''))), true;
      case 'bring-over':
        return sendJson(res, 200, await session.bringOver(String(body['commitId'] ?? ''))), true;
      case 'undo':
        return sendJson(res, 200, await session.undo(String(body['commitId'] ?? ''))), true;
      case 'proposals':
        desk.proposals = await runScriptedProposals(session);
        return sendJson(res, 200, { proposals: desk.proposals, ledger: (await session.overview()).fdr }), true;
      case 'reset':
        desk.surface = buildNndssSurface(desk.surface.tables);
        desk.proposals = [];
        return sendJson(res, 200, { ok: true }), true;
      default:
        return sendJson(res, 404, { error: `no door "${door}"` }), true;
    }
  } catch (error) {
    if (error instanceof BodyRefusal) return sendJson(res, error.status, { error: error.message }), true;
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) }), true;
  }
}
