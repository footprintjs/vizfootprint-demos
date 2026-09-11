/**
 * THE GRID DOORS — the second demo's vizfootprint session on the wire.
 *
 * The same contract the CDC doors answer, under a prefix of its own, so ONE
 * process serves two live dashboards without either knowing about the other:
 *
 *   GET  /api/grid/state        everything the cockpit renders (the polled shape)
 *   GET  /api/grid/rows         THE FOUR TABLES — `authorities` and `links` at the
 *                               CURSOR (with the columns the two acts wrote onto
 *                               them), `hourly` and `interchange` as the ETL made
 *                               them — plus the absence vocabulary, the declared
 *                               grammar, and the CDC graph's COUNTS so the page
 *                               can put the reading rule to both demos
 *   GET  /api/grid/window       ONE window of rows for the Sheet (the session's
 *                               view-query port, verbatim)
 *   POST /api/grid/find         WHERE the next match is, in the Sheet's order (the
 *                               session's find port, verbatim — the body is the
 *                               library's `FindQuery`)
 *   GET  /api/grid/lint         the declarations judged against the real data
 *   POST /api/grid/dispatch     a human gesture → a user-badged commit
 *   POST /api/grid/seek | bookmark | paths | compare | bring-over | undo | saved
 *   POST /api/grid/reset        a fresh surface over the same tables
 *
 * WHY a sibling file and not a second mode of `doors.ts`: that file's desk
 * carries an analyst, a proposal ledger and a transcript, and none of those is
 * this demo's. What the two really share — the window parser, the find parser
 * and the gesture parser — is IMPORTED from there, so the two demos cannot
 * drift on the three things a client actually sends.
 *
 * One surface per server, single-user — the honest scope of a demo.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DISPATCH_VERBS } from 'vizfootprint/def';
import type { InteractionSession } from 'vizfootprint/session';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/grid/absence.js';
import { gridRows } from '../src/grid/rows.js';
import type { ContrastGraph } from '../src/grid/rows.js';
import type { GridTables } from '../src/grid/etl.js';
import { buildGridSurfaceAsync, type GridSurface } from '../src/grid/surface.js';
import { answerFind, answerWindow, userAction } from './doors.js';

/** Where the grid's doors live — a prefix, so the CDC doors keep theirs. */
export const GRID_API_ROOT = '/api/grid';

/** The OTHER demo's graph, counted — the shape and its reason live with the payload that carries it. */
export type { ContrastGraph } from '../src/grid/rows.js';

export interface GridDesk {
  surface: GridSurface;
  /** What the carrier vouched for about each committed CSV the tables were read from. */
  readonly provenance: Readonly<Record<string, unknown>>;
  /** The CDC demo's graph as counts, for the reading-rule contrast. Absent when this process serves the grid alone. */
  readonly contrast?: ContrastGraph;
}

export async function createGridDesk(tables?: GridTables, provenance: GridDesk['provenance'] = {}, contrast?: ContrastGraph): Promise<GridDesk> {
  const surface = await buildGridSurfaceAsync(tables);
  return { surface, provenance, ...(contrast === undefined ? {} : { contrast }) };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 1_000_000;

class BodyRefusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
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
const plainUserCause = () => ({ requestedBy: 'user', computedBy: 'user' }) as const;
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (body: Record<string, unknown>, key: string): string => (typeof body[key] === 'string' ? (body[key] as string) : '');

/** The cockpit's polled state — vizfootprint-ui's documented `/api/state` shape. */
export async function gridStateOf(desk: GridDesk): Promise<Record<string, unknown>> {
  const { session, tables } = desk.surface;
  const overview = await session.overview(); // one walk per poll: the overview already counted the selection through the engine
  return {
    records: session.commits('anywhere'), // the whole tree: the rail and the branch map draw every lineage
    fdr: overview.fdr,
    analyses: overview.analyses,
    activeSelections: overview.activeSelections,
    clearedSelections: overview.clearedSelections,
    views: overview.views,
    dashboard: overview.dashboard,
    notes: overview.notes,
    tables: overview.tables,
    journal: overview.journal,
    journalTotal: overview.journalTotal,
    filters: overview.filters,
    gaps: session.gaps(),
    selectedCount: overview.selectedRowCount, // null when the engine could not answer — never a fake 0
    // two truths side by side: the CSVs the desk was ETL'd from (the carrier's
    // provenance) and the library's own per-table provenance
    sources: { ...desk.provenance, ...overview.sources },
    totalRows: tables.hourly.length,
    defaultTable: overview.defaultTable,
    columns: overview.columns,
    encodings: overview.encodings,
    cursor: overview.time.cursor,
    head: overview.time.head,
    branches: session.branches().map((b) => ({ tip: b.tip, length: b.length, actor: b.actor, active: b.active })),
    bookmarks: session.bookmarkViews(),
    saved: overview.saved,
    cursorTests: overview.time.cursorTests,
    viewingPast: overview.time.viewingPast,
    paths: { ...overview.paths, archivedList: session.paths({ includeArchived: true }) },
    charts: session.charts(),
    layouts: overview.layouts,
    links: overview.links,
    rules: overview.rules,
    encodingPolicy: overview.encodingPolicy,
    effectiveEncodings: overview.effectiveEncodings,
  };
}

/**
 * THE FOUR TABLES, on one door — the way the CDC demo serves its five.
 *
 * `authorities` and `links` come from the SURFACE, not from the ETL: their
 * positions are two commits' output, and a door that re-read the ETL would
 * serve a graph with nowhere to put anything. They were read ONCE at build,
 * where no clause exists (see `graphRowsAt`); re-reading here would hand a
 * reload-after-a-selection either a refusal about a column nobody asked for or
 * a graph whose lines point at absent circles.
 *
 * `hourly` and `interchange` are the ETL's own arrays. `interchange` is the big
 * one — 149,848 rows, the same trade the 303 `links` rows fold — and it is
 * served because the demo declares FOUR tables and a door that shipped three
 * would be a shorter answer to "what does this dashboard hold?" than the def
 * gives.
 *
 * The whole body is 30.7 MB (measured over the committed slice), the same order
 * as the CDC demo's `/api/rows`, and for the same reason: this door IS the
 * dataset. It is read once, on entry, and never polled — `/api/grid/state` is
 * the cheap poll.
 */
export function gridRowsOf(desk: GridDesk): Record<string, unknown> {
  return gridRows(desk.surface, desk.contrast);
}

/** The saved-picture door — naming, renaming and applying, each answered with the SESSION'S OWN result, verbatim. */
async function savedAction(session: InteractionSession, body: Record<string, unknown>): Promise<unknown> {
  const name = str(body, 'name');
  switch (body['action']) {
    case 'save': {
      const source = body['source'];
      if (!isObject(source)) return { ok: false, rejected: 'saving a picture needs a source: { live: "all" }, { viewId } or { conditions }' };
      return session.saveSelection(name, source as Parameters<typeof session.saveSelection>[1], 'user');
    }
    case 'rename':
      return session.renameSaved(str(body, 'from'), str(body, 'to'), 'user');
    case 'apply': {
      const mode = body['mode'] === 'layer' ? 'layer' : 'replace';
      // no intent of our own: the session stamps "applied saved selection <name>" on every commit of the batch
      return session.applySaved(name, plainUserCause(), { mode, as: 'user' });
    }
    default:
      return { ok: false, rejected: `no saved-selection action "${String(body['action'])}" — save, rename or apply` };
  }
}

/** The trail lifecycle, one door, every action answered with the session's own result. */
async function pathsAction(session: InteractionSession, body: Record<string, unknown>): Promise<unknown> {
  const name = str(body, 'name');
  const commitId = typeof body['commitId'] === 'string' ? (body['commitId'] as string) : undefined;
  switch (body['action']) {
    case 'switch':
      return name === '' ? { ok: false, error: 'paths switch needs a name' } : session.switchPath(name);
    case 'rename': {
      const from = str(body, 'from');
      const to = str(body, 'to');
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

/** The doors that only answer a POST — so a GET at one of them says "wrong verb", not "no such door". */
const POST_DOORS = new Set(['find', 'dispatch', 'seek', 'bookmark', 'paths', 'compare', 'bring-over', 'undo', 'saved', 'reset']);

/**
 * One request. Answers `true` when it handled it, `false` when the path is not
 * one of ours — the same shape `serveDoors` has, so the server can try the two
 * in a row and fall through to the static files.
 */
export async function serveGridDoors(desk: GridDesk, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(`${GRID_API_ROOT}/`)) return false;
  const door = url.pathname.slice(GRID_API_ROOT.length + 1);
  const { session } = desk.surface;
  try {
    if (req.method === 'GET' && door === 'state') return sendJson(res, 200, await gridStateOf(desk)), true;
    if (req.method === 'GET' && door === 'rows') return sendJson(res, 200, gridRowsOf(desk)), true;
    if (req.method === 'GET' && door === 'window') {
      const answer = await answerWindow(session, url.searchParams);
      return sendJson(res, answer.status, answer.body), true;
    }
    // the data checks: the declarations judged against the real data — sentences, never thrown
    if (req.method === 'GET' && door === 'lint') return sendJson(res, 200, { checks: await desk.surface.dashboard.lintData() }), true;
    // a GET that matched no door above is a door that does not exist — telling its
    // caller to change its verb would send them after the wrong bug
    if (req.method !== 'POST') {
      return POST_DOORS.has(door) ? (sendJson(res, 405, { error: `${door} is POST` }), true) : (sendJson(res, 404, { error: `no door "${door}"` }), true);
    }
    const body = await readJson(req);
    switch (door) {
      // the Sheet's find, through the SAME door function the CDC desk answers with
      case 'find': {
        const answer = await answerFind(session, body);
        return sendJson(res, answer.status, answer.body), true;
      }
      case 'dispatch': {
        const action = userAction(body);
        if ('error' in action) return sendJson(res, 400, { ok: false, error: action.error }), true;
        return sendJson(res, 200, await session.dispatch(action, { as: 'user' })), true;
      }
      case 'seek':
        return sendJson(res, 200, session.seek(str(body, 'commitId'))), true;
      case 'bookmark':
        return sendJson(res, 200, await session.dispatch({ verb: 'bookmark', label: str(body, 'label'), cause: userCause('name this position') }, { as: 'user' })), true;
      case 'paths':
        return sendJson(res, 200, await pathsAction(session, body)), true;
      case 'saved':
        return sendJson(res, 200, await savedAction(session, body)), true;
      case 'compare':
        return sendJson(res, 200, await session.compare(str(body, 'a'), str(body, 'b'))), true;
      case 'bring-over':
        return sendJson(res, 200, await session.bringOver(str(body, 'commitId'))), true;
      case 'undo':
        return sendJson(res, 200, await session.undo(str(body, 'commitId'))), true;
      case 'reset': {
        // a fresh surface over the SAME tables: the data stays exactly where it was,
        // the commit log is emptied — and the two layout acts land again, so the
        // positions on screen are still two commits and a seed
        const fresh = await createGridDesk(desk.surface.tables, desk.provenance, desk.contrast);
        desk.surface = fresh.surface;
        return sendJson(res, 200, { ok: true }), true;
      }
      default:
        return sendJson(res, 404, { error: `no door "${door}"` }), true;
    }
  } catch (error) {
    if (error instanceof BodyRefusal) return sendJson(res, error.status, { error: error.message }), true;
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) }), true;
  }
}
