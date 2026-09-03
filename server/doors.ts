/**
 * THE DOORS — the vizfootprint session on the wire. One function that answers
 * `true` when it owned the request. The state door speaks vizfootprint-ui's
 * polled `/api/state` contract verbatim; the rest mirror the library's own
 * demo, so the same cockpit code drives both.
 *
 *   GET  /api/state        everything the cockpit renders
 *   GET  /api/rows         the three tables + grain + the absence vocabulary
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
import type { DispatchAction, FilterRange } from '../../vizfootprint/src/agent/index.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/nndss/absence.js';
import { runScriptedProposals, type ProposalOutcome } from '../src/nndss/proposals.js';
import { buildNndssSurfaceAsync, type NndssSurface } from '../src/nndss/surface.js';
import { DISPATCH_VERBS } from '../../vizfootprint/src/def/index.js';
import { DASHBOARD_WORDS, nndssDef } from '../src/nndss/def.js';
import type { InteractionSession, ViewQuery } from '../../vizfootprint/src/session/index.js';
import type { SortSpec } from '../../vizfootprint/src/data/index.js';
import { openSource } from '../../vizfootprint/src/source/index.js';
import { fileSource } from '../../vizfootprint/src/source/file.js';
import { MODEL, createNndssAnalyst, liveProvider, scriptedNndssMock, type ActivityStep, type NndssAnalyst } from '../src/nndss/analyst.js';
import type { NndssTables } from '../src/nndss/etl.js';

export const API_ROOT = '/api';

// ── the window door: the Sheet's one question, parsed strictly ───────────────

/** One sort key as the wire may carry it: a field, a direction, and where absent values go. */
function isSortSpec(value: unknown): value is SortSpec {
  if (typeof value !== 'object' || value === null) return false;
  const spec = value as { field?: unknown; dir?: unknown; absent?: unknown };
  return typeof spec.field === 'string' && spec.field !== '' && (spec.dir === 'asc' || spec.dir === 'desc') && (spec.absent === undefined || spec.absent === 'first' || spec.absent === 'last');
}

/** A whole number of rows, or the sentence saying what arrived instead. */
function rowCount(name: string, raw: string): number | { readonly error: string } {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return { error: `${name}=${raw} is not a whole number of rows` };
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

/** A span of an analyst reply tied to the record: a COMMIT to seek, or a BEAT (a tag) to go to. Resolved against the log, never invented. */
export interface TranscriptRef {
  readonly span: readonly [number, number];
  readonly commit?: string;
  /** A tag by its ID (`t1`, …) — how a bookmark is cited, since it lands no commit of its own. */
  readonly bookmark?: string;
  readonly label?: string;
}

/** One line of the analyst conversation; an analyst line carries the acts it took. */
export interface TranscriptLine {
  readonly role: 'user' | 'analyst' | 'error';
  readonly text: string;
  readonly activity?: readonly ActivityStep[];
  /** A user line: the "on screen now" block that rode with the message (from the record). */
  readonly context?: string;
  /** An analyst line: the words that link, and where they link to. */
  readonly refs?: readonly TranscriptRef[];
  /** An analyst line: what was lost reading the reply — shown quietly under it, never in silence. */
  readonly note?: string;
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
  const bookmarks = session.bookmarkViews().map((b) => b.label);
  if (bookmarks.length > 0) lines.push(`- bookmarks: ${bookmarks.join('; ')}`);
  const summary = o.dashboard.prose.find((p) => p.slot === 'caption');
  if (summary !== undefined) lines.push(`- the dashboard's summary (${summary.status}${summary.status === 'stale' ? ', moved: ' + summary.changed.join(', ') : ''}): ${summary.text}`);
  const drafts = o.dashboard.proposals.filter((p) => p.status === 'open').map((p) => p.slot);
  if (drafts.length > 0) lines.push(`- summary proposals awaiting a person: ${drafts.join(', ')}`);
  return lines.join('\n').slice(0, 2000);
}

/** What a reply turned out to be carrying, once the machinery was found. */
type Reading =
  | { readonly kind: 'words' }
  | { readonly kind: 'envelope'; readonly value: EnvelopeValue; readonly prose: string; readonly envelopes: number; readonly strays: readonly string[] }
  | { readonly kind: 'unreadable'; readonly source: string; readonly prose: string; readonly closed: boolean };

/** The object the analyst was asked for, before anything in it is believed. */
interface EnvelopeValue {
  readonly text?: unknown;
  readonly refs?: unknown;
}

/** A fenced block whose fence OPENS and CLOSES at the start of a line — so a stray ``` inside the envelope's own words cannot close it early. */
const FENCE = /^[ \t]*```[ \t]*[A-Za-z]*[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*$/gm;
/** A line that is nothing but a fence marker: machinery, wherever it was left behind. A line with words on it is never touched. */
const ORPHAN_FENCE = /^[ \t]*```[ \t]*[A-Za-z]*[ \t]*$/gm;
/** The envelope's own keys — and the ONLY keys it may carry (see `isEnvelope`). */
const ENVELOPE_KEYS: readonly string[] = ['text', 'refs'];
/** How far into an object we look for its name. An envelope says what it is in its first characters, and a bounded look keeps a long reply linear. */
const HEAD = 200;
/** Shown when the machinery was all that arrived and nothing readable came with it. */
const CUT_OFF = "(the analyst's reply was cut off before any words arrived)";
/** Shown when there are no words to show: an empty reply, or an envelope that carried none. */
const NO_WORDS = '(the analyst replied with no words)';

/** The words with the machinery taken out: leftover fence lines go, and the gap they leave does not become a hole. */
function tidy(prose: string): string {
  return prose.replace(ORPHAN_FENCE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * How well does this parsed value fit the envelope?
 *
 *   exact — the envelope's own keys and NOTHING else.
 *   loose — words and links of the right TYPE, beside keys we do not know.
 *
 * The distinction is PREFERENCE, not a gate (`readReply` takes the last exact
 * one, and only falls back to a loose one). Both cases then come out right for
 * the same reason rather than by luck: this product's prose records are objects
 * with a `text` of their own, so a chart caption quoted in the words is never
 * exact and never beats the real reply — while a model that adds a field of its
 * own is still read, and the person is told what was ignored.
 */
function envelopeShape(value: unknown): 'exact' | 'loose' | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length > 0 && keys.every((key) => ENVELOPE_KEYS.includes(key))) return 'exact';
  const held = value as { text?: unknown; refs?: unknown };
  return typeof held.text === 'string' && (held.refs === undefined || Array.isArray(held.refs)) ? 'loose' : undefined;
}

/** The keys of an envelope we do not know — what the note names, so nothing is ignored in silence. */
function strayKeys(value: EnvelopeValue): readonly string[] {
  return Object.keys(value).filter((key) => !ENVELOPE_KEYS.includes(key));
}

/** Does this offset begin its line? What tells a BLOCK of machinery from a brace inside a sentence — and a brace inside a sentence is words. */
function startsLine(raw: string, at: number): boolean {
  for (let i = at - 1; i >= 0; i -= 1) {
    const ch = raw[i];
    if (ch === '\n') return true;
    if (ch !== ' ' && ch !== '\t' && ch !== '\r') return false;
  }
  return true;
}

/** Does the object opening here name itself as the envelope? Only its first characters are read, so a long reply stays linear. */
function looksLikeEnvelope(raw: string, from: number): boolean {
  const head = raw.slice(from, from + HEAD);
  return ENVELOPE_KEYS.some((key) => head.includes(`"${key}"`));
}

/**
 * Every `{…}` in the reply, in ONE left-to-right pass: where each opened, and
 * where it closed (`end` -1 = it never did). Strings and their escapes are
 * counted, so a brace inside a quoted value is just a character. One pass, so a
 * reply full of unclosed braces costs what its length costs and no more.
 */
function objects(raw: string): readonly { readonly start: number; readonly end: number }[] {
  const out: { start: number; end: number }[] = [];
  const open: number[] = [];
  let inString = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (ch === '\\') i += 1;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') {
      open.push(out.length);
      out.push({ start: i, end: -1 });
    } else if (ch === '}') {
      const k = open.pop();
      if (k !== undefined) out[k]!.end = i + 1;
    }
  }
  return out;
}

/** One place the reply could be carrying its envelope. */
interface Candidate {
  readonly json: string;
  readonly start: number;
  readonly end: number;
  /** Fenced machinery is machinery wherever it sits; a bare object has to start its line to count as a block. */
  readonly fenced: boolean;
}

/**
 * What the reply is carrying, wherever the model put it: a fenced block, a bare
 * object, or the whole body. The LAST candidate that parses as an envelope wins,
 * so a self-correction ("Actually: …") comes out right — and `envelopes` counts
 * how many there were, because more than one is worth saying out loud. When
 * nothing parses, the machinery is still named — `closed: false` for a reply cut
 * off mid-object — so half-written JSON is never handed over in silence. An
 * unreadable object INSIDE a sentence is left exactly where it is: words are
 * never deleted to tidy up.
 */
export function readReply(raw: string): Reading {
  const fences = [...raw.matchAll(FENCE)].map((m) => ({ start: m.index, end: m.index + m[0].length, json: (m[1] ?? '').trim() }));
  const inFence = (at: number): boolean => fences.some((f) => at >= f.start && at < f.end);
  const all = objects(raw);
  const found: Candidate[] = [
    ...fences.filter((f) => f.json.startsWith('{')).map((f) => ({ json: f.json, start: f.start, end: f.end, fenced: true })), // a fence around prose or code is not the envelope and is left where it is
    ...all.filter((o) => o.end > 0 && !inFence(o.start)).map((o) => ({ json: raw.slice(o.start, o.end), start: o.start, end: o.end, fenced: false })),
  ].sort((a, b) => a.start - b.start);

  const held: Record<'exact' | 'loose', { value: EnvelopeValue; prose: string; seen: number } | null> = { exact: null, loose: null };
  let broken: { readonly source: string; readonly prose: string } | null = null;
  for (const c of found) {
    const block = c.fenced || startsLine(raw, c.start);
    let value: unknown;
    try {
      value = JSON.parse(c.json);
    } catch {
      // only a BLOCK that plainly meant to be the envelope counts as machinery — an object inside a sentence stays in the sentence
      if (block && looksLikeEnvelope(raw, c.start)) broken = { source: c.json, prose: tidy(raw.slice(0, c.start) + raw.slice(c.end)) };
      continue;
    }
    const shape = envelopeShape(value);
    if (shape === undefined) continue;
    if (shape === 'loose' && !block) continue; // a shape we cannot recognise on sight is trusted only where the model wrote a BLOCK, never mid-sentence
    held[shape] = { value: value as EnvelopeValue, prose: tidy(raw.slice(0, c.start) + raw.slice(c.end)), seen: (held[shape]?.seen ?? 0) + 1 };
  }
  const chosen = held.exact ?? held.loose;
  if (chosen !== null) return { kind: 'envelope', value: chosen.value, prose: chosen.prose, envelopes: chosen.seen, strays: strayKeys(chosen.value) };
  const open = all.find((o) => o.end < 0 && !inFence(o.start) && startsLine(raw, o.start) && looksLikeEnvelope(raw, o.start));
  if (open !== undefined) return { kind: 'unreadable', source: raw.slice(open.start), prose: tidy(raw.slice(0, open.start)), closed: false };
  if (broken !== null) return { kind: 'unreadable', source: broken.source, prose: broken.prose, closed: true };
  return { kind: 'words' };
}

/** The words of a `"text": "…"` that was begun and never finished — everything up to the closing quote, or to the end of what arrived. */
function salvageText(source: string): string | undefined {
  const m = /"text"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(source);
  if (m === null) return undefined;
  const body = m[1] ?? '';
  let words: string;
  try {
    words = JSON.parse(`"${body}"`) as string; // the escapes as the model meant them
  } catch {
    words = body; // an escape or a control character cut in half — the characters as they arrived
  }
  return words.trim() === '' ? undefined : words;
}

/** What a ref may point at, as the record actually holds it: the commits in the log, and the tags beside it. */
export interface KnownTargets {
  readonly commits: ReadonlySet<string>;
  readonly bookmarks: ReadonlySet<string>;
}

/** Where one ref lands: a commit to seek, or a bookmark (a tag) to go to. */
type RefTarget = { readonly commit: string; readonly bookmark?: undefined } | { readonly commit?: undefined; readonly bookmark: string };

/**
 * What an act left behind: the commit it landed, or the TAG it named — a
 * bookmark lands no commit, and is cited by its tag.
 *
 * `commitId` is the chart proposal's: `propose_chart` deliberately never hands
 * back the commit RECORD (its value is the spec, and the surface does not echo
 * a spec), so it names the moment by id. Without that case a reply saying "the
 * chart I just proposed" resolved to nothing and the link was dropped as
 * unverifiable — a real act, on the trace, that the reply could not point at.
 */
function landedBy(activity: readonly ActivityStep[], act: number): RefTarget | undefined {
  const result = activity[act - 1]?.result as { ok?: boolean; commit?: { id?: unknown }; commitId?: unknown; analysis?: { commit?: { id?: unknown } }; bookmark?: { id?: unknown } } | undefined;
  if (result?.ok !== true) return undefined;
  if (typeof result.commit?.id === 'string') return { commit: result.commit.id };
  if (typeof result.commitId === 'string') return { commit: result.commitId };
  if (typeof result.analysis?.commit?.id === 'string') return { commit: result.analysis.commit.id };
  if (typeof result.bookmark?.id === 'string') return { bookmark: result.bookmark.id };
  return undefined;
}

/** The one target a cited ref resolves to, or nothing — a commit the log does not hold and a tag nobody named resolve to nothing, and nothing is guessed. */
function resolveTarget(cited: { readonly commit?: unknown; readonly bookmark?: unknown; readonly act?: unknown }, known: KnownTargets, activity: readonly ActivityStep[]): RefTarget | undefined {
  if (typeof cited.commit === 'string' && known.commits.has(cited.commit)) return { commit: cited.commit };
  if (typeof cited.bookmark === 'string' && known.bookmarks.has(cited.bookmark)) return { bookmark: cited.bookmark };
  if (typeof cited.act !== 'number' || !Number.isInteger(cited.act)) return undefined;
  const landed = landedBy(activity, cited.act);
  if (landed?.commit !== undefined && known.commits.has(landed.commit)) return landed;
  if (landed?.bookmark !== undefined && known.bookmarks.has(landed.bookmark)) return landed;
  return undefined;
}

/** Words for a ref's anchor: the act's own framing when the target came from this turn. */
function actLabel(activity: readonly ActivityStep[], target: RefTarget): string | undefined {
  const step = activity.find((st) => {
    const r = st.result as { commit?: { id?: unknown }; commitId?: unknown; analysis?: { commit?: { id?: unknown } }; bookmark?: { id?: unknown } };
    return target.commit !== undefined ? r.commit?.id === target.commit || r.commitId === target.commit || r.analysis?.commit?.id === target.commit : r.bookmark?.id === target.bookmark;
  });
  if (step === undefined) return undefined;
  const args = step.args as { verb?: unknown; intent?: unknown; label?: unknown; analysisId?: unknown };
  return [step.tool, typeof args.verb === 'string' ? args.verb : undefined, typeof args.intent === 'string' ? args.intent : typeof args.label === 'string' ? args.label : typeof args.analysisId === 'string' ? args.analysisId : undefined].filter((w) => w !== undefined).join(' · ');
}

/** One sentence per way a citation was lost — the two are DIFFERENT facts and are said differently. */
function droppedNote(offered: number, unverified: number, overlapped: number): string | undefined {
  const said: string[] = [];
  if (unverified > 0) said.push(`${String(unverified)} of ${String(offered)} links could not be verified and ${unverified === 1 ? 'was' : 'were'} dropped`);
  if (overlapped > 0) said.push(`${String(overlapped)} of ${String(offered)} links repeated words already linked and ${overlapped === 1 ? 'was' : 'were'} dropped`);
  return said.length > 0 ? said.join('; ') : undefined;
}

/** The reply as the person should read it, with the note the panel shows under it (and the door logs). */
export interface ParsedReply {
  readonly text: string;
  readonly refs: readonly TranscriptRef[];
  /** What was lost on the way, in plain words — a silent drop is never the answer. `undefined` = nothing to say. */
  readonly note?: string;
}

/**
 * The analyst's reply as the PERSON should read it. The envelope is found
 * wherever it landed and its `text` is what is shown — the JSON itself never
 * reaches the screen, whether the model wrote words before it, after it, or
 * both. Prose beside an envelope that carries words is dropped (the model was
 * told it would be); prose is what is shown when the envelope carried none.
 * A reply cut off at the token ceiling keeps whatever words it managed and
 * SAYS it was cut off.
 *
 * Refs are resolved against the commit log and this turn's acts: a quote that
 * is not in the final text, a commit the log does not hold, a tag nobody named,
 * and a quote that overlaps one already kept are DROPPED — a span is never
 * guessed — and the count of each comes back in `note`.
 */
export function parseReply(raw: string, known: KnownTargets, activity: readonly ActivityStep[]): ParsedReply {
  if (raw.trim() === '') return { text: NO_WORDS, refs: [] }; // an empty reply is said, never shown as a blank bubble
  const reading = readReply(raw);
  if (reading.kind === 'words') return { text: raw, refs: [] }; // words only — the reply exactly as written
  if (reading.kind === 'unreadable') {
    const salvaged = salvageText(reading.source);
    return {
      text: salvaged ?? (reading.prose !== '' ? reading.prose : CUT_OFF),
      refs: [],
      note: reading.closed ? "the analyst's envelope could not be read as JSON, so its links were lost" : "the analyst's reply was cut off before it finished",
    };
  }

  const many = reading.envelopes > 1 ? `the reply carried ${String(reading.envelopes)} envelopes; the last one was read as the answer` : undefined;
  const stray = reading.strays.length > 0 ? `the analyst's envelope carried fields I do not know: ${reading.strays.join(', ')}; its words and links were read anyway` : undefined;
  const said = (...parts: readonly (string | undefined)[]): string | undefined => {
    const words = parts.filter((w) => w !== undefined);
    return words.length > 0 ? words.join('; ') : undefined;
  };
  if (reading.value.text !== undefined && typeof reading.value.text !== 'string') {
    return { text: reading.prose !== '' ? reading.prose : NO_WORDS, refs: [], note: said(stray, many, "the analyst's words were not text, so none of its links could be placed")! };
  }
  const envelopeText = typeof reading.value.text === 'string' && reading.value.text.trim() !== '' ? reading.value.text : undefined;
  const text = envelopeText ?? (reading.prose !== '' ? reading.prose : NO_WORDS);
  if (reading.value.refs !== undefined && !Array.isArray(reading.value.refs)) return { text, refs: [], note: said(stray, many, "the analyst's links were not a list, so none could be kept")! };

  const offered = Array.isArray(reading.value.refs) ? (reading.value.refs as readonly unknown[]) : [];
  const refs: TranscriptRef[] = [];
  let overlapped = 0;
  for (const r of offered) {
    const cited = r as { quote?: unknown; commit?: unknown; bookmark?: unknown; act?: unknown } | null;
    if (cited === null || typeof cited !== 'object' || typeof cited.quote !== 'string' || cited.quote === '') continue;
    const quote: string = cited.quote;
    const start = text.indexOf(quote); // first occurrence, exact — an unfindable quote is dropped, never approximated
    if (start < 0) continue;
    const target = resolveTarget(cited, known, activity);
    if (target === undefined) continue;
    if (refs.some((have) => start < have.span[1] && start + quote.length > have.span[0])) {
      overlapped += 1; // the words are already linked — a different fact from a citation that did not resolve
      continue;
    }
    const label = actLabel(activity, target);
    refs.push({ span: [start, start + quote.length], ...target, ...(label !== undefined ? { label } : {}) });
  }
  const note = said(stray, many, droppedNote(offered.length, offered.length - refs.length - overlapped, overlapped));
  return { text, refs, ...(note !== undefined ? { note } : {}) };
}

export interface Desk {
  surface: NndssSurface;
  proposals: readonly ProposalOutcome[];
  analyst: NndssAnalyst;
  /** `live` when an Anthropic key is present at boot; `mock` runs the scripted turn. */
  readonly mode: 'mock' | 'live';
  /** The acts of the turn in flight — ONE array for the desk's life, mutated in place (the analyst's closure holds it). */
  readonly activity: ActivityStep[];
  /** Provenance of the tables the desk was built from — what the snapshot's carrier vouched for (the def declares the ETL'd tables inline, so the overview's own `sources` is empty). */
  readonly provenance: Readonly<Record<string, { readonly format: string; readonly via: string; readonly at?: string; readonly version: string; readonly retrievedAt: string; readonly rows: number }>>;
  turnActive: boolean;
  transcript: TranscriptLine[];
}

/** Asks the panel offers on an empty transcript — each exercises a different verb. */
export const SUGGESTIONS = [
  'Which region reports the most pertussis this year? Save it as a bookmark.',
  'Is gonorrhea tracking its 52-week high across the states?',
  'Where are the silences this week, and what kind are they?',
] as const;

const hasKey = (): boolean => (process.env['ANTHROPIC_API_KEY'] ?? '') !== '';

export async function createDesk(tables?: NndssTables, activity: ActivityStep[] = [], provenance: Desk['provenance'] = {}): Promise<Desk> {
  const surface = await buildNndssSurfaceAsync(tables);
  const analyst = createNndssAnalyst(surface.port, {
    provider: hasKey() ? liveProvider(process.env['ANTHROPIC_API_KEY']!) : scriptedNndssMock(),
    onActivity: (step) => activity.push(step),
  });
  return { surface, proposals: [], analyst, mode: hasKey() ? 'live' : 'mock', activity, turnActive: false, transcript: [], provenance };
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
/** A person's cause with NO intent of ours — for an act the session names itself (an apply stamps "applied saved selection <name>"). */
const plainUserCause = () => ({ requestedBy: 'user', computedBy: 'user' }) as const;
/** A JSON object off the wire (never an array, never null). */
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The def's declared dashboard words (title, caption) as plain text — what a story falls back to before any describe. */
function declaredDashboardWords(): { readonly title: string; readonly caption: string } {
  return { ...DASHBOARD_WORDS };
}

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
  const overview = await session.overview(); // one walk per poll: the overview already counted the selection through the engine
  return {
    records: session.log.records,
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
    bookmarks: session.bookmarkViews().map((c) => ({ id: c.id, label: c.label, commitId: c.commitId, at: c.at, ts: c.ts })), // the tag's id travels: a note links a tag by id, never by its name
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
        // the def's DECLARED dashboard words — the story's fallback for bookmarks no describe reached (never the live words)
        declared: { dashboard: declaredDashboardWords() },
        grammar: {
          verbs: DISPATCH_VERBS,
          encodings: nndssDef(tables).encodings ?? [],
          links: 'implicit-crossfilter',
          linksMeaning: 'every view\'s selection filters every other view; a view never filters itself',
        },
      }), true;
    }
    // the Sheet's window: one question, answered by the session's view-query port verbatim
    if (req.method === 'GET' && door === 'window') {
      const answer = await answerWindow(session, url.searchParams);
      return sendJson(res, answer.status, answer.body), true;
    }
    if (req.method === 'GET' && door === 'proposals') return sendJson(res, 200, { proposals: desk.proposals, ledger: (await session.overview()).fdr }), true;
    if (req.method === 'GET' && door === 'analyst') return sendJson(res, 200, analystState(desk)), true;
    // the data checks: the declarations judged against the real data — sentences, never thrown
    if (req.method === 'GET' && door === 'lint') return sendJson(res, 200, { checks: await desk.surface.dashboard.lintData() }), true;
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
      case 'refresh': {
        // a dashboard-level act: re-read the named sources (every source when none is named) with the version held; journaled by the library
        const tables = Array.isArray(body['tables']) ? (body['tables'] as unknown[]).map(String) : undefined;
        // a dashboard-level act on an open door: only declared tables may be named, so no invented name reaches the shared journal
        const declared = new Set(Object.keys(desk.surface.dashboard.def.data));
        const unknown = (tables ?? []).filter((t) => !declared.has(t));
        if (unknown.length > 0) return sendJson(res, 400, { error: `no table ${unknown.map((t) => `"${t}"`).join(', ')} is declared — the tables are ${[...declared].join(', ')}` }), true;
        return sendJson(res, 200, await desk.surface.dashboard.refresh(tables)), true;
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
        desk.activity.length = 0;
        desk.turnActive = true;
        const context = await onScreenNow(session);
        desk.transcript.push({ role: 'user', text: message, context });
        try {
          const turn = await desk.analyst.send(message, context);
          const known = { commits: new Set(session.log.records.map((r) => r.id)), bookmarks: new Set(session.bookmarkViews().map((c) => c.id)) };
          const reply = parseReply(turn.text, known, desk.activity);
          if (reply.note !== undefined) console.warn(`  chat: ${reply.note}`); // the log hears it too; the person is handed words and the same sentence, never machinery
          const said = { text: reply.text, refs: reply.refs, ...(reply.note !== undefined ? { note: reply.note } : {}) };
          desk.transcript.push({ role: 'analyst', ...said, activity: [...desk.activity] });
          return sendJson(res, 200, { ...turn, ...said, activity: desk.activity }), true;
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          desk.transcript.push({ role: 'error', text, activity: [...desk.activity] });
          return sendJson(res, 502, { error: text, activity: desk.activity }), true;
        } finally {
          desk.turnActive = false;
        }
      }
      case 'reset': {
        if (desk.turnActive) return sendJson(res, 409, { error: 'a turn is in flight — wait for it to land before starting fresh' }), true; // a reset mid-turn would leave the turn writing into a desk that no longer exists
        desk.activity.length = 0;
        const fresh = await createDesk(desk.surface.tables, desk.activity, desk.provenance); // the carrier's facts about the snapshot survive a reset
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
