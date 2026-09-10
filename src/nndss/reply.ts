/**
 * READING THE ANALYST'S REPLY — and telling it what is on screen.
 *
 * What one TURN needs and no door needs: the "on screen now" block that rides
 * with a message, the envelope reader that finds the answer wherever the model
 * left it, and the resolver that ties a quoted sentence to a commit or a tag.
 *
 * It lives here rather than in `server/doors.ts` because a turn now runs on
 * either side of the wire — on the server when a key is in the environment, in
 * the visitor's own browser when the key is theirs — and both sides must read
 * the same reply the same way. WHY not import the doors from a page: that file
 * opens files off the disk, and a browser has none. The doors re-export every
 * name below, so the tests that ask for them there still find them.
 */
import { whatLanded } from 'vizfootprint/agent';
import type { VizLanded } from 'vizfootprint/agent';
import type { InteractionSession } from 'vizfootprint/session';
import type { ActivityStep } from './analyst.js';

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
  /** An analyst line: the turn it answered (`turn-N`) — the key a kept recording is read back by. */
  readonly correlationId?: string;
  /** An analyst line: whether what the model was served on this turn can be shown. Absent on lines older than the recording. */
  readonly recording?: RecordingStatus;
}

/**
 * Whether a turn's recording exists — the wire says which, never silently
 * nothing: `kept` (read it back by the line's `correlationId`), `off` (the
 * desk's dial), or `lost` with the library's own reason.
 */
export type RecordingStatus = { readonly kind: 'kept' } | { readonly kind: 'off' } | { readonly kind: 'lost'; readonly why: string };

/** How many recent acts the on-screen block carries — the number the disclosure below is measured against. */
const RECENT_ACTS = 6;

/** "1 act" / "3 acts" — a count that reads as a sentence rather than a field. */
function plural(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`;
}

/** What is on screen now, FROM THE RECORD (never the browser): a bounded block the analyst reads as context. */
export async function onScreenNow(session: InteractionSession): Promise<string> {
  const o = await session.overview();
  const lines: string[] = ['On screen now (from the record):'];
  const selections = o.activeSelections.map((sel) => `${sel.viewId}: ${sel.field} ${sel.kind} ${JSON.stringify(sel.value)}`);
  lines.push(`- selections: ${selections.length > 0 ? selections.join('; ') : 'none'}`);
  // the acts THIS position saw: `commits('path')` is root->cursor, so a seek or a fork
  // never hands the analyst six acts from a branch the dashboard is not standing on
  const onPath = session.commits('path');
  const recent = onPath.slice(-RECENT_ACTS).map((r) => `#${r.id} ${r.viewId}${r.field ? '.' + r.field : ''}${r.cause.intent ? ' — ' + r.cause.intent : ''}`);
  lines.push(`- last acts: ${recent.length > 0 ? recent.join('; ') : 'none yet'}`);
  // Showing fewer acts than the block asks for, with nothing said, reads as "this
  // dashboard has a short history" when the truth is that it has a DIFFERENT one.
  // So when the path runs short and there are acts elsewhere in the tree, say the
  // two numbers — and only the numbers: the other acts are not on this path, and
  // naming them would invite the off-branch citation the library refuses.
  const elsewhere = session.commits('anywhere').length - onPath.length;
  if (onPath.length < RECENT_ACTS && elsewhere > 0) {
    lines.push(`- ${plural(onPath.length, 'act')} on this path; ${String(elsewhere)} more on other paths.`);
  }
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

/**
 * Where one ref lands: a commit to seek, or a bookmark (a tag) to go to.
 *
 * `whatLanded` is the library's — this file used to walk the four result
 * shapes itself, in two places that had already drifted (one gated on
 * `ok === true` and the other did not). A tool result is the port's to
 * describe, so the reader is the port's too.
 */
type RefTarget = VizLanded;

/** The one target a cited ref resolves to, or nothing — a commit the log does not hold and a tag nobody named resolve to nothing, and nothing is guessed. */
function resolveTarget(cited: { readonly commit?: unknown; readonly bookmark?: unknown; readonly act?: unknown }, known: KnownTargets, activity: readonly ActivityStep[]): RefTarget | undefined {
  if (typeof cited.commit === 'string' && known.commits.has(cited.commit)) return { commit: cited.commit };
  if (typeof cited.bookmark === 'string' && known.bookmarks.has(cited.bookmark)) return { bookmark: cited.bookmark };
  if (typeof cited.act !== 'number' || !Number.isInteger(cited.act)) return undefined;
  const landed = whatLanded(activity[cited.act - 1]?.result);
  if (landed?.commit !== undefined && known.commits.has(landed.commit)) return landed;
  if (landed?.bookmark !== undefined && known.bookmarks.has(landed.bookmark)) return landed;
  return undefined;
}

/** Words for a ref's anchor: the act's own framing when the target came from this turn. */
function actLabel(activity: readonly ActivityStep[], target: RefTarget): string | undefined {
  const step = activity.find((st) => {
    const landed = whatLanded(st.result);
    return landed !== undefined && landed.commit === target.commit && landed.bookmark === target.bookmark;
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
