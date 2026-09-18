/**
 * STAGE 5, WHILE IT IS HAPPENING — and the ONE law this whole module exists to
 * keep: **show the ACT, never the ANSWER.**
 *
 * ── THE LAW, AND IT IS NOT A STYLE CHOICE ──────────────────────────────────
 * Progress is a REPORT: transient, reaching no commit, never evidence, and
 * nothing computes from it. A stage's STATE is a fact and belongs on screen; a
 * PAYLOAD never does (`vizfootprint/docs/proposals/data-arrival.md` §2, and it
 * is the same law at this tier).
 *
 * For stage 5 that law has a sharp edge, and it was decided by a measurement
 * rather than by taste. Stage 5's discipline is that the ranking is FROZEN AS A
 * COMMIT before anything checks it (`./session.ts` · `landHotspots`), and every
 * ranking then goes through the hallucination door (`./hotspots.ts` ·
 * `judgeTheAnswer`). Streaming a partial ranking would put residues on a screen
 * *before* that door had refused any of them — and when a residue absent from
 * the run's own table was planted in the evidence, the model ranked it **first**.
 * A page that showed tokens as they arrived would have shown that residue as the
 * top hot spot, and the refusal would have landed afterwards. The record would
 * have stayed correct and the SCREEN would have lied.
 *
 * So **no partial ranking text reaches this channel at any point**, and that is
 * a property of the TYPE rather than of anybody's discipline: every field of
 * {@link HotspotReport} is a count, a declared word or a number the library
 * stamped. There is no `string` on it that a model wrote.
 *
 *   `stream.token.content`          the token's text          — NOT carried; COUNTED
 *   `stream.thinking_delta.content` the model's reasoning     — NOT carried; COUNTED
 *   `stream.llm_end.content`        the whole reply           — NOT carried at all
 *   `stream.tool_end.result`        the evidence we served it — NOT carried at all
 *
 * `tests/prot-stream.test.ts` asserts that over every report this module can
 * produce, and asserts it again over the DOM while a call is in flight.
 *
 * ── WHY THE RETRY ROW IS HERE AT ALL ───────────────────────────────────────
 * `.outputSchema(…, { retries: 1 })` means a model that answers prose is asked
 * again with the library's own validator quoted back at it (`./hotspots.ts`
 * says why one is the right number). That correction was INVISIBLE: the final
 * sentence counts the attempts only when the stage FAILS, so a reader of a
 * successful run never learned the model had been asked twice — and a reader
 * who never learns that has been told less than the record knows.
 */
import type { AgentfootprintEventType, Payloads } from 'agentfootprint/events';

/**
 * WHAT THE ASK IS DOING RIGHT NOW — one report per act, and every field is a
 * count, a declared word or a number the library stamped.
 *
 * The discriminant is `act` and not `event`, deliberately: this is the STAGE's
 * account of itself, and it must not become a re-export of somebody else's
 * event names. Two event kinds can mean one act (a live ask reports
 * `stream.llm_start`, a non-streaming one reports `agent.turn_start`) and one
 * event kind can mean nothing at all to a reader.
 */
export type HotspotReport =
  /** The model is being asked. `facts` and `residues` were known before the call. */
  | { readonly act: 'asking'; readonly model: string; readonly facts: number; readonly residues: number }
  /** It called the evidence tool — the one tool it has, and the only way it sees the ledger. */
  | { readonly act: 'reading-evidence' }
  /** The evidence tool answered: how many facts it served. A COUNT of what WE gave it, never what it said. */
  | { readonly act: 'read-evidence'; readonly served: number }
  /** It is answering. `tokens` is a measure of the act; the text of those tokens is not carried. */
  | { readonly act: 'answering'; readonly tokens: number }
  /** It is thinking. `chunks` is a count of reasoning deltas; their text is not carried. */
  | { readonly act: 'thinking'; readonly chunks: number }
  /** The answer did not parse or did not fit the declared shape, and the library is asking once more. */
  | { readonly act: 're-asking'; readonly attempt: number; readonly remaining: number; readonly why: 'json-parse' | 'schema-validate' }
  /** A call failed and the library's own resilience retried it — a different fact from a re-ask. */
  | { readonly act: 'retrying'; readonly attempt: number }
  /** The answer is in and the standing judge is scoring what the model was served against the ledger. */
  | { readonly act: 'scoring' };

/** Somebody watching one ask. A caller that passes none spends nothing: no listener is subscribed. */
export type ReportAsk = (report: HotspotReport) => void;

/**
 * THE EVENT TYPES THIS MODULE SUBSCRIBES TO — named once, because two things
 * read the list: {@link watchTheAsk}, which attaches one listener per name, and
 * the test that asserts every one of them produces a line.
 *
 * They are the library's own spellings, read off `agentfootprint/events` ·
 * `EVENT_NAMES` in the installed package rather than out of a doc: the domain
 * prefix (`agentfootprint.`) is part of the name and a subscription without it
 * is a subscription to nothing.
 */
export const ASK_EVENTS = [
  'agentfootprint.stream.llm_start',
  'agentfootprint.agent.turn_start',
  'agentfootprint.stream.tool_start',
  'agentfootprint.stream.tool_end',
  'agentfootprint.stream.token',
  'agentfootprint.stream.thinking_delta',
  'agentfootprint.agent.output_schema_retry',
  'agentfootprint.error.retried',
  'agentfootprint.reliability.retried',
] as const satisfies readonly AgentfootprintEventType[];

/** What one ask needs to say about itself before the model has said anything. */
export interface AskFacts {
  readonly model: string;
  readonly facts: number;
  readonly residues: number;
}

/** Anything with the runner's `on` door on it — the shape, so nothing here imports a class. */
export interface Watchable {
  on(type: string, listener: (event: { readonly type: string; readonly payload: unknown }) => void): () => void;
}

/**
 * SUBSCRIBE, REPORT, AND HAND BACK THE WAY OFF — one listener per event name,
 * and the counters that make a count out of a stream.
 *
 * ── WHY IT COUNTS RATHER THAN FORWARDS ─────────────────────────────────────
 * `stream.token` fires once per token and carries the token's TEXT. Forwarding
 * it is the failure at the top of this file; counting it is the honest half of
 * the same event — *a measure of the ACT, not the answer*. The count lives in
 * this closure and dies with it, which is what makes it a report rather than
 * state: nothing reads it back, nothing computes from it, and it reaches no
 * commit.
 *
 * ── AND WHY EVERY REPORT IS COALESCED BY ITS OWN ACT ───────────────────────
 * A 400-token answer fires 400 events. The report is the SAME act each time
 * with a larger number, so a consumer that renders the latest report per act
 * renders one line that counts up — which is exactly what a status line is. The
 * caller decides; this offers every one and drops nothing.
 *
 * Returns ONE function that removes every listener. It must be called: the
 * runner outlives one ask, and a listener left on it would report a later ask
 * to an earlier reader.
 */
export function watchTheAsk(agent: Watchable, facts: AskFacts, report: ReportAsk): () => void {
  let tokens = 0;
  let chunks = 0;
  /**
   * WHICH ACT THE ASK HAS ALREADY REPORTED, so `asking` is said once.
   *
   * A live provider fires `stream.llm_start` AND `agent.turn_start`, and a
   * non-streaming one may fire only the second. Both mean *the model is being
   * asked*, and a reader must not be told it twice — nor be left with nothing
   * because the library sensibly fires whichever is true.
   */
  let asked = false;
  const sayAsking = (): void => {
    if (asked) return;
    asked = true;
    report({ act: 'asking', model: facts.model, facts: facts.facts, residues: facts.residues });
  };
  const off: (() => void)[] = [];
  const listen = (type: (typeof ASK_EVENTS)[number], on: (payload: unknown) => void): void => {
    off.push(agent.on(type, (event) => on(event.payload)));
  };
  listen('agentfootprint.stream.llm_start', () => sayAsking());
  listen('agentfootprint.agent.turn_start', () => sayAsking());
  listen('agentfootprint.stream.tool_start', () => report({ act: 'reading-evidence' }));
  // THE COUNT IS OURS AND NOT THE EVENT'S: `stream.tool_end.result` is the
  // JSON this run served the model, and putting it on the wire would be
  // streaming the evidence to the screen through the progress channel. How many
  // facts were served is a number the ledger already knew before the call.
  listen('agentfootprint.stream.tool_end', () => report({ act: 'read-evidence', served: facts.facts }));
  listen('agentfootprint.stream.token', () => {
    tokens += 1;
    report({ act: 'answering', tokens });
  });
  listen('agentfootprint.stream.thinking_delta', () => {
    chunks += 1;
    report({ act: 'thinking', chunks });
  });
  listen('agentfootprint.agent.output_schema_retry', (payload) => {
    // THE ONE PLACE A PAYLOAD FIELD IS READ, and all three of them are the
    // LIBRARY'S OWN numbers and vocabulary: the attempt, the corrections left,
    // and which half of validation failed. The validator's `error` string is
    // deliberately NOT carried — it quotes what the model produced, and the
    // final sentence is where that belongs, after the answer is frozen
    // (`./hotspots.ts` · `agent.outputContractUnmet()`).
    const said = payload as Payloads.AgentOutputSchemaRetryPayload;
    report({ act: 're-asking', attempt: said.attempt, remaining: said.retriesRemaining, why: said.stage });
  });
  const retried = (payload: unknown): void => {
    const said = payload as { readonly attempt?: number };
    report({ act: 'retrying', attempt: typeof said.attempt === 'number' ? said.attempt : 1 });
  };
  listen('agentfootprint.error.retried', retried);
  listen('agentfootprint.reliability.retried', retried);
  return () => {
    for (const drop of off) drop();
    off.length = 0;
  };
}
