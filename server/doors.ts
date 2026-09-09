/**
 * THE DOORS — the vizfootprint session on the wire. One function that answers
 * `true` when it owned the request. The state door speaks vizfootprint-ui's
 * polled `/api/state` contract verbatim; the rest mirror the library's own
 * demo, so the same cockpit code drives both.
 *
 *   GET  /api/state        everything the cockpit renders
 *   GET  /api/rows         the five tables (three ETL'd; the graph's two with the
 *                         positions the layout and bring-over acts landed, or the
 *                         library's refusal sentence in `netRefused`) + grain +
 *                         the absence vocabulary
 *   GET  /api/summary      the front door's figures — what this snapshot holds, counted
 *   GET  /api/window       ONE window of rows for the Sheet (the session's view-query port)
 *   GET  /api/proposals    what beat 1 already did here (survives a reload)
 *   POST /api/dispatch     a human gesture → a user-badged commit
 *   POST /api/seek | bookmark | paths | compare | bring-over | undo
 *   POST /api/saved       name / rename / apply a SAVED PICTURE (the store's own
 *                         doors — naming lands no commit, applying lands several)
 *   POST /api/proposals    beat 1 — six scripted proposals; the ledger rules
 *   POST /api/reset        a fresh surface (a session is cheap)
 *   GET  /api/geo          US state boundaries (Census-derived, pre-projected) for the map view
 *   GET  /api/analyst      the analyst's transcript, its acts, its mode (mock | live)
 *   DELETE /api/analyst    clear the chat (the analyst forgets; its commits stay)
 *   POST /api/chat         one analyst turn — acts land as agent-badged commits meanwhile
 *
 * One surface per server, single-user — the honest scope of a demo.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DispatchAction, FilterRange } from 'vizfootprint/agent';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/nndss/absence.js';
import { runScriptedProposals, type ProposalOutcome } from '../src/nndss/proposals.js';
import { buildNndssSurfaceAsync, type NndssSurface } from '../src/nndss/surface.js';
import { LINK_KINDS, LINK_ON_CLEAR, responsesFor } from 'vizfootprint/def';
import type { LinkKind } from 'vizfootprint/def';
import { DASHBOARD_WORDS, NNDSS_VIEWS } from '../src/nndss/def.js';
import { nndssRows } from '../src/nndss/rows.js';
import type { InteractionSession, ViewQuery } from 'vizfootprint/session';
import type { SortSpec } from 'vizfootprint/data';
import { openSource } from 'vizfootprint/source';
import { fileSource } from 'vizfootprint/source/file';
import { chooseDriver, createNndssAnalyst, type ActivityStep, type NndssAnalyst } from '../src/nndss/analyst.js';
import { analystWire, forgetConversation, runTurn } from '../src/nndss/turn.js';
import type { NndssTables } from '../src/nndss/etl.js';
import type { NndssGraph } from '../src/nndss/graph.js';

export const API_ROOT = '/api';

// ── the window door: the Sheet's one question, parsed strictly ───────────────

/** One sort key as the wire may carry it: a field, a direction, and where absent values go. */
function isSortSpec(value: unknown): value is SortSpec {
  if (typeof value !== 'object' || value === null) return false;
  const spec = value as { field?: unknown; dir?: unknown; absent?: unknown };
  return typeof spec.field === 'string' && spec.field !== '' && (spec.dir === 'asc' || spec.dir === 'desc') && (spec.absent === undefined || spec.absent === 'first' || spec.absent === 'last');
}

/**
 * A whole number of rows, or the sentence saying what arrived instead.
 *
 * WHY the characters and not `Number`: `Number('')` is 0, `Number('0x400')` is
 * 1024 and `Number('1e3')` is 1000 — so an empty `?offset=` would quietly become
 * a default window (the one thing this door promises never to do), and the limit
 * refusals below would quote back a number the caller never wrote.
 */
function rowCount(name: string, raw: string): number | { readonly error: string } {
  if (!/^\d+$/.test(raw)) return { error: `${name}=${raw} is not a whole number of rows` };
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) return { error: `${name}=${raw} is not a whole number of rows` };
  return n;
}

/** The most rows one window may ask for. A grid shows tens; a thousand is already a generous block. */
export const WINDOW_LIMIT_MAX = 1000;

/**
 * `?table=&viewId=&columns=&sort=&offset=&limit=` → the session's `ViewQuery`.
 * Every part is optional and every bad part is REFUSED with a sentence — a
 * query the door could not read is never quietly turned into a default window.
 */
export function windowQueryOf(params: URLSearchParams): ViewQuery | { readonly error: string } {
  const query: { table?: string; viewId?: string; columns?: string[]; sort?: SortSpec[]; offset?: number; limit?: number } = {};
  const table = params.get('table');
  if (table !== null) {
    if (table === '') return { error: 'table= was empty — name a declared table, or leave it out for the default one' };
    query.table = table;
  }
  const viewId = params.get('viewId');
  if (viewId !== null) {
    if (viewId === '') return { error: 'viewId= was empty — name a declared view, or leave it out for every live clause' };
    query.viewId = viewId;
  }
  const columns = params.get('columns');
  if (columns !== null) {
    // JSON, never a joined list: a column may be called `a,b`, and a delimiter would split it in two
    let names: unknown;
    try {
      names = JSON.parse(columns);
    } catch {
      return { error: 'columns= is not JSON — send a list like ["jurisdiction","cases"]' };
    }
    if (!Array.isArray(names) || names.length === 0 || !names.every((n) => typeof n === 'string' && n !== '')) {
      return { error: 'columns= must be a non-empty JSON list of column names — or leave it out for every column the cursor sees' };
    }
    query.columns = names as string[];
  }
  const sort = params.get('sort');
  if (sort !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(sort);
    } catch {
      return { error: 'sort= is not JSON — send a list like [{"field":"cases","dir":"desc"}]' };
    }
    if (!Array.isArray(parsed) || !parsed.every(isSortSpec)) return { error: 'sort= must be a list of {field, dir: "asc" | "desc", absent?: "first" | "last"} — nothing else' };
    query.sort = parsed;
  }
  const offset = params.get('offset');
  if (offset !== null) {
    const n = rowCount('offset', offset);
    if (typeof n !== 'number') return n;
    query.offset = n;
  }
  const limit = params.get('limit');
  if (limit !== null) {
    const n = rowCount('limit', limit);
    if (typeof n !== 'number') return n;
    if (n === 0) return { error: 'limit=0 asks for no rows — ask for at least one' };
    if (n > WINDOW_LIMIT_MAX) return { error: `limit=${String(n)} is more than one window — ask for at most ${String(WINDOW_LIMIT_MAX)} rows` };
    query.limit = n;
  }
  return query;
}

/** The window door itself: a refusal with its sentence, or the session's own `ViewQueryResult`, verbatim. */
export async function answerWindow(session: Pick<InteractionSession, 'viewQuery'>, params: URLSearchParams): Promise<{ readonly status: number; readonly body: unknown }> {
  const query = windowQueryOf(params);
  if ('error' in query) return { status: 400, body: { error: query.error } };
  return { status: 200, body: await session.viewQuery(query) };
}
/**
 * The committed US state boundaries (data/geo, with their provenance) — read
 * once through the source layer, served with the version the file system
 * vouched for as the ETag. JSON over the same file carrier the CSV uses: the
 * format is separable from the transport. One in-flight read, however many
 * requests arrive before it lands.
 */
let geoRead: Promise<{ text: string; version: string }> | null = null;
const geoJson = (): Promise<{ text: string; version: string }> => {
  geoRead ??= (async () => {
    const handle = await openSource(
      { format: 'json', via: 'file', at: new URL('../data/geo/us-states.geo.json', import.meta.url).href, options: { as: 'one-row' } },
      'geo',
      [fileSource],
    );
    try {
      const snap = await handle.snapshot();
      if ('unchanged' in snap) throw new Error('geo: a first read never answers unchanged');
      const collection = snap.rows[0]; // a FeatureCollection is one row — the def says so
      if (collection === undefined) throw new Error('geo: us-states.geo.json decoded to zero rows');
      return { text: JSON.stringify(collection), version: snap.version };
    } finally {
      await handle.close();
    }
  })().catch((e: unknown) => {
    geoRead = null; // a failed read is not cached — the next request tries again
    throw e;
  });
  return geoRead;
};
const MAX_BODY_BYTES = 64 * 1024;

/**
 * The analyst-side reading, re-exported. It MOVED to `src/nndss/reply.ts` when
 * the turn learned to run in a visitor's browser (a page cannot import this
 * file — it reads the disk). The names stay on the doors because that is where
 * this repository's callers and tests already ask for them.
 */
import type { TranscriptLine } from '../src/nndss/reply.js';
export { onScreenNow, parseReply, readReply, type KnownTargets, type ParsedReply, type TranscriptLine, type TranscriptRef } from '../src/nndss/reply.js';
export { SUGGESTIONS } from '../src/nndss/turn.js';
export interface Desk {
  surface: NndssSurface;
  proposals: readonly ProposalOutcome[];
  analyst: NndssAnalyst;
  /** `live` when an Anthropic key is present at boot; `mock` runs the scripted turn. */
  readonly mode: 'mock' | 'live';
  /** The model a live turn names — the driver's own word for it, absent in mock. */
  readonly model?: string;
  /** The acts of the turn in flight — ONE array for the desk's life, mutated in place (the analyst's closure holds it). */
  readonly activity: ActivityStep[];
  /** Provenance of the tables the desk was built from — what the snapshot's carrier vouched for (the def declares the ETL'd tables inline, so the overview's own `sources` is empty). */
  readonly provenance: Readonly<Record<string, { readonly format: string; readonly via: string; readonly at?: string; readonly version: string; readonly retrievedAt: string; readonly rows: number }>>;
  turnActive: boolean;
  transcript: TranscriptLine[];
}

/**
 * THE SERVED DESK. Its driver is chosen by what THIS environment offers: a key
 * in `ANTHROPIC_API_KEY` runs the live analyst here on the server, and no key
 * runs the scripted turn over the same tools. The published page asks the same
 * question of the visitor's browser instead — one analyst, two drivers.
 */
export async function createDesk(tables?: NndssTables, activity: ActivityStep[] = [], provenance: Desk['provenance'] = {}, graph?: NndssGraph): Promise<Desk> {
  const surface = await buildNndssSurfaceAsync(tables, graph);
  const driver = chooseDriver(process.env['ANTHROPIC_API_KEY']);
  const analyst = createNndssAnalyst(surface.port, {
    provider: driver.provider,
    // the driver already decided this: absent in mock, because nothing is asked of a model
    ...(driver.model !== undefined ? { model: driver.model } : {}),
    onActivity: (step) => activity.push(step),
  });
  return { surface, proposals: [], analyst, mode: driver.mode, ...(driver.model !== undefined ? { model: driver.model } : {}), activity, turnActive: false, transcript: [], provenance };
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
/** A person's cause with NO intent of ours — for an act the session names itself (an apply stamps "applied saved selection <name>"). */
const plainUserCause = () => ({ requestedBy: 'user', computedBy: 'user' }) as const;
/** A JSON object off the wire (never an array, never null). */
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The def's declared dashboard words (title, caption) as plain text — what a story falls back to before any describe. */
function declaredDashboardWords(): { readonly title: string; readonly caption: string } {
  return { ...DASHBOARD_WORDS };
}

/** A human gesture from the cockpit → a validated dispatch action, or a plain refusal. */
export function userAction(body: Record<string, unknown>): DispatchAction | { readonly error: string } {
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
    case 'select': {
      if (viewId === undefined || field === undefined) return { error: 'select needs viewId and field' };
      // SET-1: the many-values form — `values` (an array, or null to clear) + optional `exclude`
      if ('values' in body) {
        const values = body['values'];
        if (values !== null && !Array.isArray(values)) return { error: 'select.values must be an array of values, or null to clear' };
        const exclude = body['exclude'] === true;
        return { verb: 'select', viewId, field, values: values as readonly unknown[] | null, ...(exclude ? { exclude: true } : {}), cause };
      }
      // the POINT form: the value, or `null` to clear (the one spelling of cleared, whatever the kind).
      // A body with no `value` at all is passed through as-is and the library refuses it in a sentence —
      // this door never guesses that an absent value meant a clear.
      return { verb: 'select', viewId, field, value: body['value'] as string | number | null, cause };
    }
    case 'analyze': {
      const analysisId = str('analysisId');
      if (analysisId === undefined) return { error: 'analyze needs analysisId' };
      // An act may bring its own DECLARATION — a builtin record, which is data,
      // and is what lets the desk's "add a column" reach a session over a wire.
      // This door checks only that it is an object; WHAT it declares is the
      // library's to judge, and the library's sentence is what comes back.
      const def = body['def'];
      if (def !== undefined && !isObject(def)) return { error: 'analyze.def must be a record naming a builtin analysis' };
      const table = str('table');
      return {
        verb: 'analyze',
        analysisId,
        ...(def !== undefined ? { def: def as never } : {}),
        ...(table !== undefined ? { table } : {}),
        cause,
      };
    }
    case 'reencode': {
      // the encoding plane: one channel, or a binding SET (several channels in one act — a swap is one commit)
      const bindings = body['bindings'];
      if (bindings !== undefined) {
        if (viewId === undefined) return { error: 'reencode needs viewId' };
        if (typeof bindings !== 'object' || bindings === null || Array.isArray(bindings) || Object.values(bindings).some((f) => typeof f !== 'string')) {
          return { error: 'reencode bindings must map channel -> column name' };
        }
        return { verb: 'reencode', viewId, bindings: bindings as Record<string, string>, cause };
      }
      const channel = str('channel');
      if (viewId === undefined || channel === undefined || field === undefined) return { error: 'reencode needs viewId, channel, and field — or bindings' };
      return { verb: 'reencode', viewId, channel, field, cause };
    }
    case 'link': {
      // layer 4: one edge, as the matrix hands it over — response null = back to the def's rule
      const source = str('source');
      const target = str('target');
      const kind = str('kind');
      const response = body['response'];
      if (source === undefined || target === undefined || kind === undefined) return { error: 'link needs source, kind, and target' };
      // the library's own vocabularies, never a copy: a kind this demo spelled by
      // hand would refuse tomorrow's selection kind in a sentence blaming the caller
      if (!(LINK_KINDS as readonly string[]).includes(kind)) return { error: `link.kind must be ${LINK_KINDS.join(' | ')}` };
      // an encoding edge answers with follow | none; a selection edge with the rest — the session refuses the rest with its own sentence
      const allowed: readonly string[] = responsesFor(kind as LinkKind);
      if (response !== null && !allowed.includes(String(response))) return { error: `link.response must be ${allowed.join(' | ')}, or null` };
      const mapping = Array.isArray(body['mapping']) ? (body['mapping'] as readonly { from: string; to: string }[]) : undefined;
      const channels = Array.isArray(body['channels']) ? (body['channels'] as readonly { from: string; to: string }[]) : undefined;
      const onClear = str('onClear');
      if (onClear !== undefined && !(LINK_ON_CLEAR as readonly string[]).includes(onClear)) return { error: `link.onClear must be ${LINK_ON_CLEAR.join(' | ')}` };
      const fold = str('fold');
      return {
        verb: 'link',
        source,
        kind: kind as 'point' | 'interval' | 'cell' | 'match' | 'encoding',
        target,
        response: response as 'filter' | 'highlight' | 'navigate' | 'mirror' | 'none' | 'follow' | null,
        ...(mapping !== undefined ? { mapping } : {}),
        ...(channels !== undefined ? { channels } : {}),
        ...(onClear !== undefined ? { onClear: onClear as 'leave' | 'showAll' | 'excludeAll' } : {}),
        ...(fold !== undefined ? { fold } : {}),
        cause,
      };
    }
    case 'annotate': {
      // an inert note on a target (a commit id, a view, a column); a note on a selection commit is a SAVED selection
      const target = str('target');
      const note = str('note');
      if (target === undefined || note === undefined || note.length === 0) return { error: 'annotate needs target and note' };
      return { verb: 'annotate', target, note, cause };
    }
    case 'describe': {
      // the prose plane: one of a view's words as a record (the session judges it), or null = back to the declaration
      const slot = str('slot');
      if (viewId === undefined || slot === undefined) return { error: 'describe needs viewId and slot' };
      const record = body['record'];
      if (record !== undefined && record !== null && (typeof record !== 'object' || Array.isArray(record))) return { error: 'describe.record must be an object, or null' };
      // the author port: propose (an agent's draft for a person), accept (by the proposing commit's id), decline (with a reason)
      const accept = str('accept');
      const decline = body['decline'];
      const declineOk = typeof decline === 'object' && decline !== null && typeof (decline as { proposal?: unknown }).proposal === 'string' && typeof (decline as { reason?: unknown }).reason === 'string';
      if (decline !== undefined && !declineOk) return { error: 'describe.decline must be { proposal, reason }' };
      return {
        verb: 'describe',
        viewId,
        slot: slot as 'title',
        record: (record ?? null) as null,
        ...(body['proposal'] === true ? { proposal: true } : {}),
        ...(accept !== undefined ? { accept } : {}),
        ...(declineOk ? { decline: decline as { proposal: string; reason: string } } : {}),
        cause,
      };
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
  const overview = await session.overview(); // one walk per poll: the overview already counted the selection through the engine
  return {
    records: session.commits('anywhere'), // the whole tree: the rail and the branch map draw every lineage
    fdr: overview.fdr,
    analyses: overview.analyses,
    activeSelections: overview.activeSelections,
    clearedSelections: overview.clearedSelections,
    views: overview.views,
    dashboard: overview.dashboard, // the cockpit's own words (its caption = the summary), with the proposals on the table
    notes: overview.notes, // the Text tool: every note with words at the cursor
    tables: overview.tables, // the Sources tab's rows: every declared table as the def states it
    journal: overview.journal, // the data journal's latest records, oldest first
    journalTotal: overview.journalTotal, // how many the journal holds in all
    filters: overview.filters, // the live selections in the shape a prose basis states them
    gaps: session.gaps(),
    selectedCount: overview.selectedRowCount, // null when the engine could not answer — never a fake 0
    // two truths side by side: the snapshot file the desk was ETL'd from (the carrier's provenance) and the library's
    // own per-table provenance (the version every commit is stamped with)
    sources: { ...desk.provenance, ...overview.sources },
    totalRows: tables.cells.length,
    defaultTable: overview.defaultTable,
    columns: overview.columns,
    encodings: overview.encodings,
    activity: desk.activity,
    turnActive: desk.turnActive,
    mode: desk.mode,
    cursor: overview.time.cursor,
    head: overview.time.head,
    branches: session.branches().map((b) => ({ tip: b.tip, length: b.length, actor: b.actor, active: b.active })),
    bookmarks: session.bookmarkViews(), // already the WIRE's view of the bookmarks (the tag's id travels: a note links a tag by id, never by its name) — re-projecting it here made a second copy of the library's own answer
    saved: overview.saved, // the saved PICTURES, whole: their own ids, their conditions, who saved them and when — the cockpit projects this list and derives nothing

    cursorTests: overview.time.cursorTests,
    viewingPast: overview.time.viewingPast,
    paths: { ...overview.paths, archivedList: session.paths({ includeArchived: true }) },
    charts: session.charts(),
    layouts: overview.layouts,
    links: overview.links,
    // the encoding plane: the house rules as sentences + the policy (the cockpit's Grammar panel)
    rules: overview.rules,
    encodingPolicy: overview.encodingPolicy,
    // encoding links: what each view shows under the graph (views[] carry the per-view `effective` block)
    effectiveEncodings: overview.effectiveEncodings,
  };
}

/**
 * The saved-picture door (`POST /api/saved`) — naming, renaming and applying,
 * each answered with the SESSION'S OWN result, verbatim.
 *
 * None of these is a dispatch verb, and that is the point: naming a picture
 * lands NO commit (it is a record beside the log), and applying one lands
 * SEVERAL under a single cause. Routing either through `/api/dispatch` would put
 * the act on the trace under another act's name.
 */
export async function savedAction(desk: Desk, body: Record<string, unknown>): Promise<unknown> {
  const { session } = desk.surface;
  const name = typeof body['name'] === 'string' ? body['name'] : '';
  switch (body['action']) {
    case 'save': {
      const source = body['source'];
      if (!isObject(source)) return { ok: false, rejected: 'saving a picture needs a source: { live: "all" }, { viewId } or { conditions }' };
      return session.saveSelection(name, source as Parameters<typeof session.saveSelection>[1], 'user');
    }
    case 'rename': {
      const from = typeof body['from'] === 'string' ? body['from'] : '';
      const to = typeof body['to'] === 'string' ? body['to'] : '';
      return session.renameSaved(from, to, 'user');
    }
    case 'apply': {
      const mode = body['mode'] === 'layer' ? 'layer' : 'replace';
      // no intent of our own: the session stamps "applied saved selection <name>" on every commit of the batch
      return session.applySaved(name, plainUserCause(), { mode, as: 'user' });
    }
    default:
      return { ok: false, rejected: `no saved-selection action "${String(body['action'])}" — save, rename or apply` };
  }
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

/**
 * THE FRONT DOOR'S FIGURES — what the landing page (`web/src/Home.tsx`) says
 * this desk holds, counted from the tables the dashboard actually runs on.
 *
 * It is its own door because neither of the two that already exist can be the
 * one a landing page reads. `/api/state` is the cheap poll (tens of KB) and it
 * carries the rows, the jurisdictions and the views — but not how many
 * DISEASES or how many WEEKS the snapshot holds; the only door that carries
 * those is `/api/rows`, and `/api/rows` is thirty megabytes because it is the
 * whole dataset. Growing `/api/state` instead would put these counts on every
 * poll of a session that never changes them.
 *
 * So: a few hundred bytes, read once, before anything is mounted. It lands no
 * commit, touches no session state, and every number in it is a length of a
 * real table — there is no figure here a page could have written down.
 */
export function summaryOf(desk: Desk): Record<string, unknown> {
  const { cells, diseases, weeks, jurisdictions } = desk.surface.tables;
  const snapshot = desk.provenance['snapshot.csv'];
  return {
    rows: cells.length,
    diseases: diseases.length,
    weeks: weeks.length,
    jurisdictions: jurisdictions.length,
    views: NNDSS_VIEWS.length, // what the DEF declares, not what happens to be mounted
    absence: { field: ABSENCE_FIELD, states: ABSENCE_STATES },
    words: declaredDashboardWords(), // the dashboard's own title and summary — the page borrows them rather than writing a headline
    mode: desk.mode,
    snapshot: snapshot === undefined ? null : { retrievedAt: snapshot.retrievedAt, rows: snapshot.rows },
  };
}

/** The doors that answer a POST — data, so the method check can tell a wrong VERB from a wrong DOOR. */
const POST_DOORS: ReadonlySet<string> = new Set(['refresh', 'dispatch', 'seek', 'bookmark', 'paths', 'saved', 'compare', 'bring-over', 'undo', 'proposals', 'chat', 'reset']);

export async function serveDoors(desk: Desk, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(`${API_ROOT}/`)) return false;
  const door = url.pathname.slice(API_ROOT.length + 1);
  const { session, tables } = desk.surface;
  try {
    if (req.method === 'GET' && door === 'state') return sendJson(res, 200, await stateOf(desk)), true;
    // the landing page, before anything is mounted: the counts, and nothing that costs a walk
    if (req.method === 'GET' && door === 'summary') return sendJson(res, 200, summaryOf(desk)), true;
    // the whole dataset, in one object — built by `src/nndss/rows.ts`, which the
    // static site's page calls on its own in-browser session. One payload, two hosts.
    if (req.method === 'GET' && door === 'rows') return sendJson(res, 200, nndssRows(desk.surface)), true;
    // the Sheet's window: one question, answered by the session's view-query port verbatim
    if (req.method === 'GET' && door === 'window') {
      const answer = await answerWindow(session, url.searchParams);
      return sendJson(res, answer.status, answer.body), true;
    }
    if (req.method === 'GET' && door === 'proposals') return sendJson(res, 200, { proposals: desk.proposals, ledger: (await session.overview()).fdr }), true;
    if (req.method === 'GET' && door === 'analyst') return sendJson(res, 200, analystWire(desk)), true;
    // the data checks: the declarations judged against the real data — sentences, never thrown
    if (req.method === 'GET' && door === 'lint') return sendJson(res, 200, { checks: await desk.surface.dashboard.lintData() }), true;
    // clear the chat window: the analyst forgets the conversation; every commit it landed stays in the log
    if (req.method === 'DELETE' && door === 'analyst') {
      if (desk.turnActive) return sendJson(res, 409, { error: 'a turn is in flight — wait for it to land' }), true;
      forgetConversation(desk);
      return sendJson(res, 200, analystWire(desk)), true;
    }
    if (req.method === 'GET' && door === 'geo') {
      const geo = await geoJson();
      const etag = `"${geo.version}"`;
      if (req.headers['if-none-match'] === etag) return res.writeHead(304, { etag }), res.end(), true;
      res.writeHead(200, { 'content-type': 'application/json', etag });
      res.end(geo.text);
      return true;
    }
    // a GET that matched no door above is a door that does not exist — telling
    // its caller to change its verb would send them after the wrong bug
    if (req.method !== 'POST') {
      return POST_DOORS.has(door) ? (sendJson(res, 405, { error: `${door} is POST` }), true) : (sendJson(res, 404, { error: `no door "${door}"` }), true);
    }
    const body = await readJson(req);
    switch (door) {
      case 'refresh': {
        // a dashboard-level act: re-read the named sources (every source when none is named) with the version held; journaled by the library
        // `named`, not `tables`: the desk's own tables are bound at the top of
        // this function, and a second `tables` here would be a different thing
        // under one name — the NAMES the caller asked to re-read
        const named = Array.isArray(body['tables']) ? (body['tables'] as unknown[]).map(String) : undefined;
        // a dashboard-level act on an open door: only declared tables may be named, so no invented name reaches the shared journal
        const declared = new Set(Object.keys(desk.surface.dashboard.def.data));
        const unknown = (named ?? []).filter((t) => !declared.has(t));
        if (unknown.length > 0) return sendJson(res, 400, { error: `no table ${unknown.map((t) => `"${t}"`).join(', ')} is declared — the tables are ${[...declared].join(', ')}` }), true;
        return sendJson(res, 200, await desk.surface.dashboard.refresh(named)), true;
      }
      case 'dispatch': {
        const action = userAction(body);
        if ('error' in action) return sendJson(res, 400, { ok: false, error: action.error }), true;
        return sendJson(res, 200, await session.dispatch(action, { as: 'user' })), true;
      }
      case 'seek':
        return sendJson(res, 200, session.seek(String(body['commitId'] ?? ''))), true;
      case 'bookmark':
        return sendJson(res, 200, await session.dispatch({ verb: 'bookmark', label: String(body['label'] ?? ''), cause: userCause('name this position') }, { as: 'user' })), true;
      case 'paths':
        return sendJson(res, 200, await pathsAction(desk, body)), true;
      case 'saved':
        return sendJson(res, 200, await savedAction(desk, body)), true;
      case 'compare':
        return sendJson(res, 200, await session.compare(String(body['a'] ?? ''), String(body['b'] ?? ''))), true;
      case 'bring-over':
        return sendJson(res, 200, await session.bringOver(String(body['commitId'] ?? ''))), true;
      case 'undo':
        return sendJson(res, 200, await session.undo(String(body['commitId'] ?? ''))), true;
      case 'proposals':
        desk.proposals = await runScriptedProposals(session);
        return sendJson(res, 200, { proposals: desk.proposals, ledger: (await session.overview()).fdr }), true;
      case 'chat': {
        const message = String(body['message'] ?? '').trim();
        if (message === '') return sendJson(res, 400, { error: 'chat needs a message' }), true;
        if (desk.turnActive) return sendJson(res, 409, { error: 'the analyst is mid-turn — wait for it' }), true;
        // `runTurn` owns the flag, the record's on-screen block, the reply
        // reading and both transcript lines — the published page runs the very
        // same function against its own session. What is left here is the only
        // part that is about HTTP: which status a finished turn gets.
        const outcome = await runTurn(desk, session, message);
        if (!outcome.ok) return sendJson(res, 502, { error: outcome.error, activity: outcome.activity }), true;
        // the log hears it too; the person is handed words and the same sentence, never machinery
        if (outcome.note !== undefined) console.warn(`  chat: ${outcome.note}`);
        return sendJson(res, 200, outcome), true;
      }
      case 'reset': {
        if (desk.turnActive) return sendJson(res, 409, { error: 'a turn is in flight — wait for it to land before starting fresh' }), true; // a reset mid-turn would leave the turn writing into a desk that no longer exists
        desk.activity.length = 0;
        const fresh = await createDesk(desk.surface.tables, desk.activity, desk.provenance, desk.surface.graph); // the carrier's facts about the snapshot survive a reset
        desk.surface = fresh.surface;
        desk.proposals = [];
        desk.analyst = fresh.analyst;
        desk.transcript = [];
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
