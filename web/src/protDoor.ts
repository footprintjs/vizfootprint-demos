/**
 * THE SERVED PAGE'S DOOR — everything `web/src/protServed.tsx` says to the demo
 * API, and nothing else.
 *
 * ── WHY IT IS ITS OWN MODULE ───────────────────────────────────────────────
 * It is LAYER 4 (the only code on this page that reaches outside the browser)
 * and it is the page's BOUNDARY READER: what comes back over a wire is judged
 * here, defensively, because a wire is a boundary. The page that composes the
 * desk mounts a React root at import, so a test of this reader could not
 * import it from there without mounting a page — and the whole trip through
 * this reader is exactly what a defect walked through once
 * ({@link askDoorForHotspots}). One module, no side effect, drivable from a
 * test without a browser or a socket.
 */
import { STREAM_DIED, type HotspotFailure, type HotspotLedger, type HotspotOutcome } from '../../src/prot/hotspots.js';
import type { HotspotReport } from '../../src/prot/streamReports.js';

/**
 * WHERE THE DOOR IS, and it is also where the committed bytes are.
 *
 * `src/prot/http.ts`'s loaders take a BASE and resolve every declared path
 * against it (`src/data/files.ts` holds the paths, and the static build copies
 * the same names beside the published page). So one base answers both halves:
 * `/api/prot/data/prot/1ay7.pdb` is the door serving the file this repository
 * committed, and `/api/prot/hotspots` is the door asking a model — the same
 * prefix, proxied in dev and same-origin in a build.
 */
export const DOOR = (): URL => new URL('/api/prot/', window.location.href);

/** What the door says about itself — `server/prot-doors.ts` · `ProtStateWire`, read defensively because a wire is a boundary. */
export interface DoorState {
  readonly mode: 'live' | 'scripted' | 'none';
  readonly model?: string;
  readonly reason?: string;
  readonly judge?: { readonly said: string; readonly weaker: boolean };
  readonly tag: string;
}

export async function askDoorState(): Promise<DoorState> {
  const at = new URL('state', DOOR()).href;
  const res = await fetch(at);
  if (!res.ok) throw new Error(`the demo API at ${at} answered ${String(res.status)} ${res.statusText} — this page is the SERVED protein desk and needs it: run \`npm run serve\` beside it, or open the published desk, which performs stages 1 to 4 with no server at all`);
  return (await res.json()) as DoorState;
}

/**
 * ONE ASK — the run's own evidence up; what the stage is DOING back as it
 * happens, and then the ranked list with its citations and the judge's
 * verdicts.
 *
 * ── THE TRANSPORT, AND THE ARGUMENT FOR IT ─────────────────────────────────
 * One POST, and the reports are framed AHEAD of the answer on the same
 * response — newline-delimited JSON, one `HotspotFrame` per line, the answer
 * always last (`server/prot-doors.ts` · `HotspotFrame` carries the whole
 * argument, including why a second progress door is refused and why SSE does
 * not fit a request with a seventy-kilobyte body).
 *
 * ── AND WHAT A DEAD STREAM SAYS ────────────────────────────────────────────
 * A stream that dies is a STATED OUTCOME and never a spinner that never stops:
 * the body ended, no answer frame came, and the stage landed nothing
 * (`src/prot/hotspots.ts` · `STREAM_DIED`). The precedent is the packet's own
 * timeout sentence, whose clause it borrows — *the answer, if one arrives now,
 * is dropped rather than landed late*.
 *
 * ── AND A BODY THAT IS NOT FRAMED AT ALL IS STILL AN ANSWER ────────────────
 * **This is the defect that shipped for one round and it is worth reading.**
 * The reader took an `answer` frame or nothing, so a body carrying the OUTCOME
 * with no framing round it — which is exactly what a process started before
 * this packet answers, and what anything else in front of the door might — was
 * read as *a stream that ended after 0 reports*. The stage was marked refused
 * on a page whose door had answered a perfectly good ranking.
 *
 * Zero reports AND no answer is the signature: it is not the last chunk being
 * mis-cut, it is a body with neither key in it. So {@link readAnswer} accepts
 * either — a framed answer, or an unframed one that looks like this stage's own
 * outcome — which is the discipline this file already keeps everywhere else: *a
 * wire is a boundary, read defensively*.
 */
export async function askDoorForHotspots(ledger: HotspotLedger, onReport?: (report: HotspotReport) => void): Promise<HotspotOutcome> {
  const res = await fetch(new URL('hotspots', DOOR()).href, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // THE LEDGER'S OWN FIELDS AND NOTHING INVENTED FOR THE REQUEST: the facts,
    // the residue keys the door judges a named residue against, the sentence
    // about which residues it covers, and which acts it was read off
    body: JSON.stringify({ facts: ledger.facts, residues: ledger.residues, basis: ledger.basis, from: ledger.from, at: ledger.at }),
  });
  /**
   * A 400 IS NOT A STREAM — the door decides between a status and a stream
   * before it writes a header, so a request it could not read comes back as
   * one JSON body exactly as it always did (`server/prot-doors.ts`).
   */
  if (!res.ok) return offTheWire(await res.json().catch(() => ({})), res.status);
  return readAnswer(ndjson(res), res.status, onReport);
}

/**
 * THE ANSWER OUT OF A FRAMED BODY — exported and taken as lines, so the whole
 * trip can be driven from a test without a browser or a socket.
 *
 * Three things can come down, and each is read as itself:
 *
 *   `{ report }`  a state of the act, offered to the caller and counted;
 *   `{ answer }`  the outcome, and there is exactly one of it, last;
 *   anything else that carries `ok` — an UNFRAMED outcome, read as the answer
 *                 (see {@link askDoorForHotspots} for the defect that taught
 *                 this).
 *
 * A body with none of those is a dead stream, and that is a stated outcome.
 */
export async function readAnswer(lines: AsyncIterable<unknown>, status: number, onReport?: (report: HotspotReport) => void): Promise<HotspotOutcome> {
  let answer: unknown = null;
  let reports = 0;
  for await (const line of lines) {
    const frame = line as Partial<{ readonly report: HotspotReport; readonly answer: unknown }> & Record<string, unknown>;
    if (frame.answer !== undefined) {
      answer = frame.answer;
      continue;
    }
    if (frame.report !== undefined) {
      reports += 1;
      onReport?.(frame.report);
      continue;
    }
    // AN UNFRAMED OUTCOME — `ok` is this stage's own discriminant, and a body
    // carrying it is an answer whatever wrote it
    if (typeof frame.ok === 'boolean') answer = frame;
  }
  if (answer === null) return { ok: false, kind: 'stream-died', sentence: STREAM_DIED(reports), verdicts: [] };
  return offTheWire(answer, status);
}

/**
 * THE LINES OF AN NDJSON BODY, one parsed object at a time — and a line that
 * does not parse is DROPPED rather than thrown on.
 *
 * Dropped, because a report is a report: half a progress line is not a fact
 * worth failing an ask over, and the ANSWER's absence is already an outcome of
 * its own ({@link askDoorForHotspots}). Throwing here would turn a garbled
 * status line into a stage that never ran.
 */
export async function* ndjson(res: Response): AsyncGenerator<unknown> {
  const body = res.body;
  if (body === null) return;
  const reader = body.getReader();
  const decode = new TextDecoder();
  let held = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    held += decode.decode(value, { stream: true });
    const lines = held.split('\n');
    // the last piece may be half a line; it waits for the next chunk
    held = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim() === '') continue;
      try {
        yield JSON.parse(line);
      } catch {
        continue;
      }
    }
  }
  if (held.trim() !== '') {
    try {
      yield JSON.parse(held);
    } catch {
      /* a half-written last line is a dead stream, and the caller says so */
    }
  }
}

/**
 * AN OUTCOME OFF THE WIRE, read defensively — the door's own `kind` when it is
 * one of the failures this stage has a vocabulary for, and `threw` when it is
 * not. A kind nobody declared would let the screen branch on a word the library
 * has never heard of; the SENTENCE is what a reader sees either way, and it is
 * the door's, verbatim.
 */
function offTheWire(body: unknown, status: number): HotspotOutcome {
  const said = (body ?? {}) as Partial<{ readonly ok: boolean; readonly kind: string; readonly sentence: string }> & Record<string, unknown>;
  if (said.ok === true) return said as unknown as HotspotOutcome;
  const kinds: readonly HotspotFailure[] = ['no-key', 'no-evidence', 'unreachable', 'timeout', 'refused', 'threw', 'malformed', 'cites-nothing', 'nothing-left', 'stream-died'];
  const kind = kinds.find((one) => one === said.kind) ?? 'threw';
  return {
    ok: false,
    kind,
    sentence: typeof said.sentence === 'string' ? said.sentence : `the demo API answered ${String(status)} and no sentence — stage 5 did not run, and the door said nothing this page can print`,
    verdicts: [],
  };
}

