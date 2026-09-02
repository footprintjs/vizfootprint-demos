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
 *   GET  /api/geo          US state boundaries (Census-derived, pre-projected) for the map view
 *   GET  /api/analyst      the analyst's transcript, its acts, its mode (mock | live)
 *   DELETE /api/analyst    clear the chat (the analyst forgets; its commits stay)
 *   POST /api/chat         one analyst turn — acts land as agent-badged commits meanwhile
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
import type { InteractionSession } from '../../vizfootprint/src/session/index.js';
import { openSource } from '../../vizfootprint/src/source/index.js';
import { fileSource } from '../../vizfootprint/src/source/file.js';
import { MODEL, createNndssAnalyst, liveProvider, scriptedNndssMock, type ActivityStep, type NndssAnalyst } from '../src/nndss/analyst.js';
import type { NndssTables } from '../src/nndss/etl.js';

export const API_ROOT = '/api';
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

/** One line of the analyst conversation; an analyst line carries the acts it took. */
export interface TranscriptLine {
  readonly role: 'user' | 'analyst' | 'error';
  readonly text: string;
  readonly activity?: readonly ActivityStep[];
  /** A user line: the "on screen now" block that rode with the message (from the record). */
  readonly context?: string;
  /** An analyst line: spans of the text tied to a commit — resolved against the log, never invented. */
  readonly refs?: readonly { readonly span: readonly [number, number]; readonly commit: string; readonly label?: string }[];
}

/** What is on screen now, FROM THE RECORD (never the browser): a bounded block the analyst reads as context. */
async function onScreenNow(session: InteractionSession): Promise<string> {
  const o = await session.overview();
  const lines: string[] = ['On screen now (from the record):'];
  const selections = o.activeSelections.map((sel) => `${sel.viewId}: ${sel.field} ${sel.kind} ${JSON.stringify(sel.value)}`);
  lines.push(`- selections: ${selections.length > 0 ? selections.join('; ') : 'none'}`);
  const recent = session.log.records.slice(-6).map((r) => `#${r.id} ${r.viewId}${r.field ? '.' + r.field : ''}${r.cause.intent ? ' — ' + r.cause.intent : ''}`);
  lines.push(`- last acts: ${recent.length > 0 ? recent.join('; ') : 'none yet'}`);
  const shown = Object.entries(o.effectiveEncodings)
    .filter(([, enc]) => Object.keys(enc).length > 0)
    .map(([viewId, enc]) => `${viewId}(${Object.entries(enc).map(([ch, f]) => `${ch}=${f}`).join(', ')})`);
  lines.push(`- charts show: ${shown.join('; ')}`);
  const beats = session.checkpoints().map((b) => b.label);
  if (beats.length > 0) lines.push(`- beats: ${beats.join('; ')}`);
  return lines.join('\n').slice(0, 2000);
}

/** The analyst's reply parsed: JSON {text, refs} when it managed one, plain text otherwise; refs resolved against the log and this turn's acts, else dropped. */
function parseReply(raw: string, session: InteractionSession, activity: readonly ActivityStep[]): { readonly text: string; readonly refs: TranscriptLine['refs'] } {
  let parsed: { text?: unknown; refs?: unknown } | null = null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      parsed = JSON.parse(trimmed) as { text?: unknown; refs?: unknown };
    } catch {
      parsed = null;
    }
  }
  if (parsed === null || typeof parsed.text !== 'string') return { text: raw, refs: [] };
  const text = parsed.text;
  const known = new Set(session.log.records.map((r) => r.id));
  const refs: { span: readonly [number, number]; commit: string; label?: string }[] = [];
  for (const r of Array.isArray(parsed.refs) ? parsed.refs : []) {
    const x = r as { quote?: unknown; commit?: unknown; act?: unknown } | null;
    if (x === null || typeof x !== 'object' || typeof x.quote !== 'string' || x.quote.length === 0) continue;
    const quote: string = x.quote;
    const start = text.indexOf(quote);
    if (start < 0) continue;
    let commit: string | undefined;
    if (typeof x.commit === 'string' && known.has(x.commit)) commit = x.commit;
    else if (typeof x.act === 'number' && Number.isInteger(x.act)) {
      const step = activity[x.act - 1];
      const result = step?.result as { ok?: boolean; commit?: { id?: unknown }; analysis?: { commit?: { id?: unknown } } } | undefined;
      const id = result?.ok === true ? (typeof result.commit?.id === 'string' ? result.commit.id : typeof result.analysis?.commit?.id === 'string' ? result.analysis.commit.id : undefined) : undefined;
      if (id !== undefined && known.has(id)) commit = id;
    }
    if (commit === undefined) continue;
    if (refs.some((have) => start < have.span[1] && start + quote.length > have.span[0])) continue; // overlaps a ref already kept
    refs.push({ span: [start, start + quote.length], commit, ...(step_label(activity, commit) !== undefined ? { label: step_label(activity, commit) } : {}) });
  }
  return { text, refs };
}

/** Words for a ref's anchor: the act's framing when the commit came from this turn. */
function step_label(activity: readonly ActivityStep[], commit: string): string | undefined {
  const step = activity.find((st) => {
    const r = st.result as { commit?: { id?: unknown }; analysis?: { commit?: { id?: unknown } } };
    return r.commit?.id === commit || r.analysis?.commit?.id === commit;
  });
  if (step === undefined) return undefined;
  const args = step.args as { verb?: unknown; intent?: unknown; label?: unknown; analysisId?: unknown };
  return [step.tool, typeof args.verb === 'string' ? args.verb : undefined, typeof args.intent === 'string' ? args.intent : typeof args.label === 'string' ? args.label : typeof args.analysisId === 'string' ? args.analysisId : undefined].filter((w) => w !== undefined).join(' · ');
}

export interface Desk {
  surface: NndssSurface;
  proposals: readonly ProposalOutcome[];
  analyst: NndssAnalyst;
  /** `live` when an Anthropic key is present at boot; `mock` runs the scripted turn. */
  readonly mode: 'mock' | 'live';
  /** The acts of the turn in flight — ONE array for the desk's life, mutated in place (the analyst's closure holds it). */
  readonly activity: ActivityStep[];
  turnActive: boolean;
  transcript: TranscriptLine[];
}

/** Asks the panel offers on an empty transcript — each exercises a different verb. */
export const SUGGESTIONS = [
  'Which region reports the most pertussis this year? Save it as a beat.',
  'Is gonorrhea tracking its 52-week high across the states?',
  'Where are the silences this week, and what kind are they?',
] as const;

const hasKey = (): boolean => (process.env['ANTHROPIC_API_KEY'] ?? '') !== '';

export function createDesk(tables?: NndssTables, activity: ActivityStep[] = []): Desk {
  const surface = buildNndssSurface(tables);
  const analyst = createNndssAnalyst(surface.port, {
    provider: hasKey() ? liveProvider(process.env['ANTHROPIC_API_KEY']!) : scriptedNndssMock(),
    onActivity: (step) => activity.push(step),
  });
  return { surface, proposals: [], analyst, mode: hasKey() ? 'live' : 'mock', activity, turnActive: false, transcript: [] };
}

/** What the Analyst panel renders. */
function analystState(desk: Desk): Record<string, unknown> {
  return { mode: desk.mode, model: desk.mode === 'live' ? MODEL : undefined, turnActive: desk.turnActive, activity: desk.activity, transcript: desk.transcript, suggestions: SUGGESTIONS, tools: desk.analyst.tools };
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
    case 'select': {
      if (viewId === undefined || field === undefined) return { error: 'select needs viewId and field' };
      // SET-1: the many-values form — `values` (an array, or null to clear) + optional `exclude`
      if ('values' in body) {
        const values = body['values'];
        if (values !== null && !Array.isArray(values)) return { error: 'select.values must be an array of values, or null to clear' };
        const exclude = body['exclude'] === true;
        return { verb: 'select', viewId, field, values: values as readonly unknown[] | null, ...(exclude ? { exclude: true } : {}), cause };
      }
      return { verb: 'select', viewId, field, value: body['value'] as string | number | null, cause };
    }
    case 'analyze': {
      const analysisId = str('analysisId');
      if (analysisId === undefined) return { error: 'analyze needs analysisId' };
      return { verb: 'analyze', analysisId, cause };
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
      if (!['point', 'interval', 'cell', 'match', 'encoding'].includes(kind)) return { error: 'link.kind must be point | interval | cell | match | encoding' };
      // an encoding edge answers with follow | none; a selection edge with the rest — the session refuses the rest with its own sentence
      const allowed = kind === 'encoding' ? ['follow', 'none'] : ['filter', 'highlight', 'navigate', 'mirror', 'none'];
      if (response !== null && !allowed.includes(String(response))) return { error: `link.response must be ${allowed.join(' | ')}, or null` };
      const mapping = Array.isArray(body['mapping']) ? (body['mapping'] as readonly { from: string; to: string }[]) : undefined;
      const channels = Array.isArray(body['channels']) ? (body['channels'] as readonly { from: string; to: string }[]) : undefined;
      const onClear = str('onClear');
      if (onClear !== undefined && !['leave', 'showAll', 'excludeAll'].includes(onClear)) return { error: 'link.onClear must be leave | showAll | excludeAll' };
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
  const overview = await session.overview();
  const selected = await session.selectedRows();
  return {
    records: session.log.records,
    fdr: overview.fdr,
    analyses: overview.analyses,
    activeSelections: overview.activeSelections,
    clearedSelections: overview.clearedSelections,
    views: overview.views,
    gaps: session.gaps(),
    selectedCount: selected.length,
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
    checkpoints: session.checkpoints().map((c) => ({ label: c.label, commitId: c.commitId, at: c.at, ts: c.ts })),
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
    if (req.method === 'GET' && door === 'analyst') return sendJson(res, 200, analystState(desk)), true;
    // clear the chat window: the analyst forgets the conversation; every commit it landed stays in the log
    if (req.method === 'DELETE' && door === 'analyst') {
      if (desk.turnActive) return sendJson(res, 409, { error: 'a turn is in flight — wait for it to land' }), true;
      desk.transcript.length = 0;
      desk.activity.length = 0;
      desk.analyst.reset();
      return sendJson(res, 200, analystState(desk)), true;
    }
    if (req.method === 'GET' && door === 'geo') {
      const geo = await geoJson();
      const etag = `"${geo.version}"`;
      if (req.headers['if-none-match'] === etag) return res.writeHead(304, { etag }), res.end(), true;
      res.writeHead(200, { 'content-type': 'application/json', etag });
      res.end(geo.text);
      return true;
    }
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
      case 'chat': {
        const message = String(body['message'] ?? '').trim();
        if (message === '') return sendJson(res, 400, { error: 'chat needs a message' }), true;
        if (desk.turnActive) return sendJson(res, 409, { error: 'the analyst is mid-turn — wait for it' }), true;
        desk.activity.length = 0;
        desk.turnActive = true;
        const context = await onScreenNow(session);
        desk.transcript.push({ role: 'user', text: message, context });
        try {
          const turn = await desk.analyst.send(message, context);
          const reply = parseReply(turn.text, session, desk.activity);
          desk.transcript.push({ role: 'analyst', text: reply.text, refs: reply.refs, activity: [...desk.activity] });
          return sendJson(res, 200, { ...turn, text: reply.text, refs: reply.refs, activity: desk.activity }), true;
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          desk.transcript.push({ role: 'error', text, activity: [...desk.activity] });
          return sendJson(res, 502, { error: text, activity: desk.activity }), true;
        } finally {
          desk.turnActive = false;
        }
      }
      case 'reset': {
        desk.activity.length = 0;
        const fresh = createDesk(desk.surface.tables, desk.activity);
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
