// @vitest-environment jsdom
/**
 * STAGE 5 REPORTS THE ASK — and the law it is all built around:
 * **SHOW THE ACT, NEVER THE ANSWER.**
 *
 * ── WHY THAT IS A LAW AND NOT A PREFERENCE ─────────────────────────────────
 * Stage 5's discipline is that the ranking is frozen as a commit before
 * anything checks it, and every ranking then goes through the hallucination
 * door. Streaming a partial ranking would put residues on screen before that
 * door had refused any of them — and when a residue absent from the run's own
 * table was planted in the evidence, the model ranked it **first**. The screen
 * would have shown it as the top hot spot and the refusal would have arrived
 * afterwards: the record correct, the screen lying.
 *
 * So four claims:
 *
 *   1. **every event kind produces its own line**, off the library's real
 *      payload types (`agentfootprint/events`);
 *   2. **the retry row appears** when the first answer does not parse — the
 *      re-ask we built, made visible instead of hidden;
 *   3. **a stream that dies is a stated outcome**, never a spinner;
 *   4. **no partial ranking text exists anywhere in the channel** — asserted
 *      over the report type, over a real run's reports, and over the DOM of a
 *      card whose stage is in flight.
 *
 * Every test is on the `mock` provider and the scripted classifier. No key, no
 * network, no model.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { mock, type LLMProvider } from 'agentfootprint/providers';
import { ACT_KEY_COLUMN, CONTACTS_ACT, SURFACE_ACT } from '../src/prot/analyses.js';
import { stepperStages } from '../web/src/protStages.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { HOTSPOTS_ACT, HOTSPOT_ANSWER_SCHEMA, RETRYABLE, STREAM_DIED, askHotspots, hotspotLedger, retryable, scriptedHotspotModel, scriptedJudge, type HotspotFailure, type HotspotOutcome } from '../src/prot/hotspots.js';
import { ASK_EVENTS, watchTheAsk, type HotspotReport, type Watchable } from '../src/prot/streamReports.js';
import { askingLogged, askingSaid } from '../web/src/workbench/boot.js';
import { hotspotCard, recommendationOf, retryLabelOf } from '../web/src/workbench/panel.js';
import { readAnswer } from '../web/src/protDoor.js';
import { Recommendation } from '../web/src/workbench/ChartCard.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── the evidence, small enough to read ──────────────────────────────────────

const run: ProtRun = {
  outcomes: [
    { stage: 'interactions', act: CONTACTS_ACT, commit: 'c1', refusal: null, materialized: ['contacts', 'interface_contacts', 'interface_separation'] },
    { stage: 'surface', act: SURFACE_ACT, commit: 'c2', refusal: null, materialized: ['sasa', 'relative_sasa'] },
  ],
  narrative: [],
  pairs: null,
  contacts: null,
  surface: null,
  conservation: null,
};

const LEDGER = hotspotLedger(
  run,
  [
    { [ACT_KEY_COLUMN]: 'A:57', chain: 'A', resnum: 57, resname: 'GLU', contacts: 14, interface_contacts: 4, interface_separation: 2.81, sasa: 18.4, relative_sasa: 0.12 },
    { [ACT_KEY_COLUMN]: 'B:35', chain: 'B', resnum: 35, resname: 'ARG', contacts: 9, interface_contacts: 3, interface_separation: 3.02, sasa: 41.2, relative_sasa: 0.3 },
    { [ACT_KEY_COLUMN]: 'A:12', chain: 'A', resnum: 12, resname: 'ALA', contacts: 2, interface_contacts: 0, sasa: 90.1, relative_sasa: 0.8 },
    { [ACT_KEY_COLUMN]: 'A:13', chain: 'A', resnum: 13, resname: 'GLY', contacts: 3, interface_contacts: 0, sasa: 61.2, relative_sasa: 0.6 },
    { [ACT_KEY_COLUMN]: 'A:14', chain: 'A', resnum: 14, resname: 'SER', contacts: 1, interface_contacts: 0, sasa: 40.0, relative_sasa: 0.4 },
    { [ACT_KEY_COLUMN]: 'B:70', chain: 'B', resnum: 70, resname: 'LEU', contacts: 0, interface_contacts: 0, sasa: 8.0, relative_sasa: 0.08 },
  ],
  'c2',
);

/** One ask, with its reports collected. */
async function askWithReports(provider: LLMProvider): Promise<{ readonly outcome: HotspotOutcome; readonly reports: readonly HotspotReport[] }> {
  const reports: HotspotReport[] = [];
  const outcome = await askHotspots({ provider, judge: scriptedJudge(), model: 'a-test-model', ledger: LEDGER, timeoutMs: 10_000, report: (report) => reports.push(report) });
  return { outcome, reports };
}

/**
 * A DOUBLE OF THE RUNNER'S OWN `on` DOOR — the SHAPE, so a test can fire one
 * event of each declared kind without a provider that happens to stream.
 *
 * It is the shape and not a stub of the library: `watchTheAsk` takes
 * {@link Watchable}, which is `on(type, listener) => Unsubscribe` and nothing
 * else, so what is under test is the mapping from event to line rather than a
 * provider's streaming behaviour. The EVENT NAMES are the library's own
 * (`ASK_EVENTS`, read off `agentfootprint/events`), so a rename upstream fails
 * the type-check rather than silencing a line.
 */
function fakeRunner(): { readonly runner: Watchable; readonly fire: (type: string, payload: unknown) => void; readonly listening: () => readonly string[] } {
  const listeners = new Map<string, ((event: { readonly type: string; readonly payload: unknown }) => void)[]>();
  return {
    runner: {
      on: (type, listener) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        return () => listeners.set(type, (listeners.get(type) ?? []).filter((one) => one !== listener));
      },
    },
    fire: (type, payload) => {
      for (const listener of listeners.get(type) ?? []) listener({ type, payload });
    },
    listening: () => [...listeners.entries()].flatMap(([type, list]) => (list.length > 0 ? [type] : [])),
  };
}

async function mount(element: ReactElement): Promise<{ readonly words: () => string; readonly unmount: () => Promise<void> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    words: () => (host.textContent ?? '').replace(/\s+/g, ' '),
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

// ── each event kind, its own line ──────────────────────────────────────────

describe('each event kind the library emits produces its own line', () => {
  it('subscribes to exactly the declared events, and every one of them is a real agentfootprint event name', () => {
    const { runner, fire, listening } = fakeRunner();
    const off = watchTheAsk(runner, { model: 'claude-sonnet-5', facts: 71, residues: 18 }, () => {});
    expect([...listening()].sort()).toEqual([...ASK_EVENTS].sort());
    // and every name carries the library's domain prefix — a subscription
    // without it is a subscription to nothing
    for (const name of ASK_EVENTS) expect(name.startsWith('agentfootprint.')).toBe(true);
    off();
    // THE LISTENERS COME OFF: a runner outlives one ask, and a listener left on
    // it would report a later ask to an earlier reader
    expect(listening()).toEqual([]);
    fire('agentfootprint.stream.token', { iteration: 0, tokenIndex: 0, content: 'hot' });
  });

  it('turns each event into the ACT it means, and the line is a count or a declared word', () => {
    const { runner, fire } = fakeRunner();
    const reports: HotspotReport[] = [];
    const off = watchTheAsk(runner, { model: 'claude-sonnet-5', facts: 71, residues: 18 }, (report) => reports.push(report));

    fire('agentfootprint.stream.llm_start', { iteration: 0, provider: 'anthropic', model: 'claude-sonnet-5', systemPromptChars: 900, messagesCount: 1, toolsCount: 1 });
    /*
      TWO REGISTERS, ONE REPORT — and the split is the author's own ruling.
      `askingSaid` is the CENTRED LINE under the stepper: present tense, short,
      no explanatory clause. `askingLogged` is the RECORD'S line, where the
      explanation belongs. Both are asserted at every event, because a change
      that dropped one of them would leave a reader either with a log entry
      where a status line belongs or with a count nobody explained.
    */
    expect(askingSaid(reports[reports.length - 1]!)).toBe('asking claude-sonnet-5 · 71 facts about 18 residues');
    expect(askingLogged(reports[reports.length - 1]!)).toBe('asking claude-sonnet-5 — 71 facts about 18 residues served, both known before the call');

    // AND A SECOND *the model is being asked* EVENT SAYS IT ONCE: a live
    // provider fires both `stream.llm_start` and `agent.turn_start`, and they
    // mean the same act
    const asks = reports.length;
    fire('agentfootprint.agent.turn_start', { turnIndex: 0, userPrompt: 'which residues' });
    expect(reports.length).toBe(asks);

    fire('agentfootprint.stream.tool_start', { toolName: 'read_evidence', toolCallId: 't1', args: {} });
    expect(askingSaid(reports[reports.length - 1]!)).toContain('reading this run’s evidence');
    expect(askingLogged(reports[reports.length - 1]!)).toContain('called the evidence tool');

    fire('agentfootprint.stream.tool_end', { toolCallId: 't1', result: '{"facts":[{"id":"f1","residue":"A:57"}]}', durationMs: 3 });
    expect(askingSaid(reports[reports.length - 1]!)).toBe('it read 71 facts, one per id');

    fire('agentfootprint.stream.token', { iteration: 0, tokenIndex: 0, content: '{"ranked":[{"residue":"A:57"' });
    fire('agentfootprint.stream.token', { iteration: 0, tokenIndex: 1, content: ',"reason":"it is buried"' });
    // THE LINE IS A COUNT AND NOTHING ELSE; the explanation is the record's
    expect(askingSaid(reports[reports.length - 1]!)).toBe('answering · 2 tokens');
    expect(askingLogged(reports[reports.length - 1]!)).toContain('a count of the act');

    fire('agentfootprint.stream.thinking_delta', { iteration: 0, tokenIndex: 0, content: 'the buried arginine looks like the anchor' });
    expect(askingSaid(reports[reports.length - 1]!)).toBe('thinking · 1 block');
    expect(askingLogged(reports[reports.length - 1]!)).toContain('counted and not shown');

    fire('agentfootprint.agent.output_schema_retry', { attempt: 1, retriesRemaining: 1, iteration: 1, stage: 'json-parse', error: 'nothing in the reply parses as JSON', correctiveMessageHash: 'abc' });
    expect(askingSaid(reports[reports.length - 1]!)).toBe('the answer did not parse — asking once more');
    expect(askingLogged(reports[reports.length - 1]!)).toContain('attempt 1, 1 correction left');

    fire('agentfootprint.error.retried', { attempt: 2 });
    expect(askingSaid(reports[reports.length - 1]!)).toBe('the call failed — asking again, attempt 2');
    fire('agentfootprint.reliability.retried', { attempt: 3 });
    expect(askingLogged(reports[reports.length - 1]!)).toBe('the call failed and was retried — attempt 3');

    /**
     * AND THE HONESTY ASSERTION OVER THE WHOLE CHANNEL: every one of those
     * events carried model text, and not a character of it is in any report.
     */
    const channel = JSON.stringify(reports);
    for (const said of ['A:57', 'it is buried', 'the buried arginine looks like the anchor', 'ranked', 'nothing in the reply parses as JSON']) {
      expect(channel, `"${said}" reached the progress channel`).not.toContain(said);
    }
    off();
  });

  it('SCHEMA-VALIDATE and JSON-PARSE are two different lines — they trend differently, and a reader learns which', () => {
    const { runner, fire } = fakeRunner();
    const reports: HotspotReport[] = [];
    const off = watchTheAsk(runner, { model: 'm', facts: 3, residues: 2 }, (report) => reports.push(report));
    fire('agentfootprint.agent.output_schema_retry', { attempt: 1, retriesRemaining: 0, iteration: 1, stage: 'schema-validate', error: 'ranked: expected array', correctiveMessageHash: 'x' });
    expect(askingSaid(reports[0]!)).toContain('did not fit the declared shape');
    expect(askingLogged(reports[0]!)).toContain('0 corrections left');
    off();
  });

  it('the judge’s own step is reported, after the answer and before the verdict', async () => {
    const { reports, outcome } = await askWithReports(scriptedHotspotModel({ want: 2 }));
    expect(outcome.ok).toBe(true);
    const acts = reports.map((report) => report.act);
    expect(acts).toContain('scoring');
    // and it is the LAST thing reported: it happens after the reply is in hand
    expect(acts[acts.length - 1]).toBe('scoring');
    expect(askingSaid({ act: 'scoring' })).toContain('scoring against the ledger');
  });

  it('an ask with NO report channel subscribes nothing at all — an unwatched ask spends what it always spent', async () => {
    const outcome = await askHotspots({ provider: scriptedHotspotModel({ want: 2 }), judge: scriptedJudge(), model: 'a-test-model', ledger: LEDGER, timeoutMs: 10_000 });
    expect(outcome.ok).toBe(true);
  });
});

// ── the retry row ──────────────────────────────────────────────────────────

describe('the re-ask we built is VISIBLE instead of hidden', () => {
  /**
   * A MODEL THAT ANSWERS PROSE ONCE AND THE SHAPE ON THE RE-ASK — the real
   * library path (`.outputSchema(…, { retries: 1 })`), so the retry row comes
   * off the library's own event rather than a count kept anywhere here.
   */
  const proseThenShape = (): LLMProvider => {
    let asked = 0;
    return mock({
      name: 'prose-then-shape',
      respond: (request) => {
        const wantsTool = JSON.stringify(request).includes('read_evidence') && asked === 0;
        if (wantsTool) return '';
        asked += 1;
        if (asked === 1) return 'I would look at the buried arginine first.';
        return JSON.stringify({ ranked: [{ residue: 'A:57', reason: 'buried at the interface', cites: [LEDGER.facts[0]!.id] }] });
      },
    });
  };

  it('reports the retry when the first answer does not parse, and STILL answers', async () => {
    const { outcome, reports } = await askWithReports(proseThenShape());
    const retries = reports.filter((report) => report.act === 're-asking');
    /*
      A READER WHO NEVER LEARNS THE MODEL WAS ASKED TWICE HAS BEEN TOLD LESS
      THAN THE RECORD KNOWS. The library judged the answer in the loop and filed
      what it judged; this row is that fact, made visible while it happens
      rather than only inside a failure sentence afterwards.
    */
    expect(retries.length).toBeGreaterThan(0);
    expect(askingSaid(retries[0]!)).toContain('asking once more');
    expect(askingLogged(retries[0]!)).toContain('validator quoted back');
    // and the validator's own message — which quotes what the MODEL produced —
    // is NOT in the channel
    expect(JSON.stringify(reports)).not.toContain('buried arginine');
  });
});

// ── a stream that dies ─────────────────────────────────────────────────────

describe('a stream that dies is a stated outcome, never a spinner that never stops', () => {
  it('names how many reports arrived and says the late answer is DROPPED rather than landed', () => {
    const said = STREAM_DIED(4);
    expect(said).toContain('ended after 4 reports and before the answer itself');
    expect(said).toContain('stage 5 landed nothing');
    // THE TIMEOUT'S OWN CLAUSE, borrowed because it is the same fact
    expect(said).toContain('the answer, if one arrives now, is dropped rather than landed late');
    expect(STREAM_DIED(1)).toContain('1 report and');
  });

  it('the card draws that sentence in place of a ranking, and shows no rows at all', async () => {
    const outcome: HotspotOutcome = { ok: false, kind: 'stream-died', sentence: STREAM_DIED(4), verdicts: [] };
    const view = recommendationOf({ outcome, judge: 'the scripted judge', at: 'c2', landed: null });
    expect(view.rows).toEqual([]);
    expect(view.said).toBe(STREAM_DIED(4));
    const card = await mount(<Recommendation {...view} focused />);
    expect(card.words()).toContain('dropped rather than landed late');
    await card.unmount();
  });
});

// ── the card's fourth state ────────────────────────────────────────────────

describe('the card gains a fourth state — IN FLIGHT — and it is the ACT with no part of the answer', () => {
  it('shows the status line, no rows, no refusals and no verdicts', () => {
    const view = recommendationOf({ outcome: null, asking: { act: 'answering', tokens: 128 }, judge: 'the scripted judge', at: 'c2', landed: null });
    expect(view.rows).toEqual([]);
    expect(view.refused).toEqual([]);
    expect(view.verdicts).toEqual([]);
    expect(view.figures).toBe('in flight');
    // ONE OWNER for the line: the card and the boot report say the same thing
    expect(view.said).toBe(askingSaid({ act: 'answering', tokens: 128 }));
    // and it still declares its register
    expect(view.tag).toBe('a recommendation, not a measurement');
  });

  it('says so before the first report too, rather than looking like a stage that answered nothing', () => {
    const view = recommendationOf({ outcome: null, asking: null, judge: 'the scripted judge', at: null, landed: null });
    expect(view.said).toContain('has not reported anything yet');
  });

  it('the `Full note` of an in-flight card is its OWN paragraph — never the answered one in the past tense', () => {
    const card = hotspotCard({ name: 'Hot Spot Prediction', label: 'which residues a model would call hot' }, { outcome: null, asking: { act: 'answering', tokens: 12 }, judge: 'the scripted judge', at: 'c2', landed: null });
    expect(card.why).toContain('THE STAGE IS RUNNING');
    expect(card.why).toContain('NOTHING OF THE ANSWER IS SHOWN YET');
    // it says WHY, with the measurement: the planted residue was ranked FIRST
    expect(card.why).toContain('the model ranked it FIRST');
    // and it does NOT claim a record it does not have
    expect(card.why).not.toContain('A MODEL WAS ASKED, and what it said');
    expect(card.why).not.toContain('Nothing it said was refused');
  });

  /**
   * THE HONESTY TEST, OVER THE DOM, WHILE THE CALL IS IN FLIGHT — and it is
   * driven by a REAL ANSWER so that there is something to have leaked.
   *
   * The answer is produced first, on the scripted model, and then every report
   * that run emitted is rendered as an in-flight card. Not one residue, reason
   * or cited id of the answer may appear in the markup.
   */
  it('NO PARTIAL RANKING TEXT IS IN THE DOM AT ANY POINT WHILE THE ASK IS IN FLIGHT', async () => {
    const { outcome, reports } = await askWithReports(scriptedHotspotModel({ want: 3 }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.picks.length).toBeGreaterThan(0);
    expect(reports.length).toBeGreaterThan(0);
    for (const report of reports) {
      const view = await mount(<Recommendation {...recommendationOf({ outcome: null, asking: report, judge: 'the scripted judge', at: 'c2', landed: null })} focused />);
      const said = view.words();
      for (const pick of outcome.picks) {
        expect(said, `the residue "${pick.residue}" reached the DOM while the ask was in flight`).not.toContain(pick.residue);
        expect(said, `the reason for "${pick.residue}" reached the DOM while the ask was in flight`).not.toContain(pick.reason);
        for (const id of pick.cites) expect(said, `the citation "${id}" reached the DOM while the ask was in flight`).not.toContain(id);
      }
      await view.unmount();
    }
    // AND THE ANSWERED CARD DOES SHOW THEM — so the assertion above is about
    // WHEN the ranking appears and not about a card that shows nothing ever
    const answered = await mount(<Recommendation {...recommendationOf({ outcome, judge: 'the scripted judge', at: 'c2', landed: 's5' })} focused />);
    expect(answered.words()).toContain(outcome.picks[0]!.residue);
    await answered.unmount();
  });

  it('the report TYPE has no field a model wrote — which is what makes the law a property rather than a discipline', () => {
    /*
      Every arm of `HotspotReport`, with its every field — written out, so that
      a field ADDED to the type has to be added here and judged. `model` is the
      one string, and it is the caller's own word for which model was asked
      (`server/prot-doors.ts` · `protModel`), never anything the model said.
    */
    const arms: readonly HotspotReport[] = [
      { act: 'asking', model: 'claude-sonnet-5', facts: 71, residues: 18 },
      { act: 'reading-evidence' },
      { act: 'read-evidence', served: 71 },
      { act: 'answering', tokens: 400 },
      { act: 'thinking', chunks: 9 },
      { act: 're-asking', attempt: 1, remaining: 1, why: 'json-parse' },
      { act: 'retrying', attempt: 2 },
      { act: 'scoring' },
    ];
    for (const arm of arms) {
      for (const [field, value] of Object.entries(arm)) {
        if (field === 'act' || field === 'why') continue;
        // a count, or the caller's own name for the model asked
        expect(typeof value === 'number' || field === 'model', `${arm.act}.${field} is neither a count nor the model asked`).toBe(true);
      }
      // and every arm renders BOTH registers
      expect(askingSaid(arm).length).toBeGreaterThan(10);
      expect(askingLogged(arm).length).toBeGreaterThan(10);
    }
    // the shape the answer is DECLARED in is a different thing from the report,
    // and it is what the library judges the answer against
    expect(typeof HOTSPOT_ANSWER_SCHEMA).toBe('object');
  });
});

// ── the whole trip ─────────────────────────────────────────────────────────

/**
 * THE STREAM CARRIES ITS REPORTS **AND** THE ANSWER ARRIVES — and the second
 * half is the one a defect walked straight through.
 *
 * The reader took an `answer` frame or nothing, so a body carrying the outcome
 * with NO FRAMING round it read as *a stream that ended after 0 reports* and
 * the stage was marked refused on a page whose door had answered a perfectly
 * good ranking. A test that asserted only the reports would have passed.
 */
describe('the whole trip: the reports arrive AND the answer does', () => {
  /** The lines of a framed body, as the page's reader takes them. */
  const framed = async function* (lines: readonly unknown[]): AsyncGenerator<unknown> {
    for (const line of lines) yield line;
  };

  it('reads the reports in order and the answer last', async () => {
    const reports: HotspotReport[] = [];
    const answered = await readAnswer(
      framed([
        { report: { act: 'asking', model: 'm', facts: 3, residues: 2 } },
        { report: { act: 'answering', tokens: 7 } },
        { answer: { ok: true, model: 'm', picks: [{ residue: 'A:57', rank: 1, reason: 'buried', cites: ['f1'] }], refused: [], verdicts: [], disagreements: [], served: 3 } },
      ]),
      200,
      (report) => reports.push(report),
    );
    expect(reports.map((one) => one.act)).toEqual(['asking', 'answering']);
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.picks.map((pick) => pick.residue)).toEqual(['A:57']);
  });

  it('AN UNFRAMED OUTCOME IS STILL THE ANSWER — the defect that marked a good ranking refused', async () => {
    /*
      A body with neither `report` nor `answer` in it: exactly what a process
      started before this packet answers, and what anything in front of the
      door might. ZERO REPORTS AND NO ANSWER was the signature, and it is not a
      framing bug in the last chunk — it is a body with neither key.
    */
    const answered = await readAnswer(framed([{ ok: true, model: 'm', picks: [{ residue: 'B:35', rank: 1, reason: 'buried', cites: ['f1'] }], refused: [], verdicts: [], disagreements: [], served: 3 }]), 200);
    expect(answered.ok, 'an unframed outcome was read as a dead stream').toBe(true);
    if (!answered.ok) return;
    expect(answered.picks.map((pick) => pick.residue)).toEqual(['B:35']);
  });

  it('and a body with neither is a DEAD STREAM, with the count of what did arrive', async () => {
    const empty = await readAnswer(framed([]), 200);
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.kind).toBe('stream-died');
    expect(empty.sentence).toBe(STREAM_DIED(0));
    const reported = await readAnswer(framed([{ report: { act: 'answering', tokens: 3 } }, { report: { act: 'scoring' } }]), 200);
    expect(reported.ok).toBe(false);
    if (reported.ok) return;
    expect(reported.sentence).toBe(STREAM_DIED(2));
  });

  it('a garbled progress line is DROPPED and does not become a stage that never ran', async () => {
    const answered = await readAnswer(framed([{ report: { act: 'asking', model: 'm', facts: 3, residues: 2 } }, 'not an object', { answer: { ok: false, kind: 'timeout', sentence: 'timed out', verdicts: [] } }]), 200);
    expect(answered.ok).toBe(false);
    if (answered.ok) return;
    expect(answered.kind).toBe('timeout');
  });
});

// ── the reason, and the retry ──────────────────────────────────────────────

describe('THE REASON IS IN THE CARD, and a retry is offered only where a re-ask could differ', () => {
  const failed = (kind: HotspotFailure, sentence = 'the stage said what happened'): HotspotOutcome => ({ ok: false, kind, sentence, verdicts: [] });

  it('the card shows the declared KIND beside the stage’s own sentence, verbatim', async () => {
    const view = recommendationOf({ outcome: failed('timeout', 'the model did not answer stage 5 within 60000 milliseconds.'), judge: 'the scripted judge', at: 'c2', landed: null });
    expect(view.kind).toBe('timeout');
    expect(view.said).toBe('the model did not answer stage 5 within 60000 milliseconds.');
    const card = await mount(<Recommendation {...view} focused retry={{ label: 'ask again', busy: false, onPress: () => {} }} />);
    // the stepper says REFUSED; the card says which kind, and why
    expect(card.words()).toContain('refused · timeout');
    expect(card.words()).toContain('did not answer stage 5 within 60000 milliseconds');
    await card.unmount();
  });

  it('RETRYABLE where the same question could answer differently, and absent where it could not', () => {
    for (const kind of ['unreachable', 'timeout', 'threw', 'malformed', 'cites-nothing', 'nothing-left', 'stream-died'] as const) {
      expect(retryable(kind), `${kind} should be retryable`).toBe(true);
      expect(recommendationOf({ outcome: failed(kind), judge: 'j', at: null, landed: null }).retryable).toBe(true);
    }
    /*
      AND EACH `false` IS ITS OWN REASON, never *we did not get round to it*:
      no key is a lie about the environment; no evidence and no cover ask the
      same unanswerable question and spend a real call to arrive at the same
      sentence; not-the-end needs a different READ, not a second ask; and a
      refusal cannot tell an invalid key from a rate limit.
    */
    for (const kind of ['no-key', 'no-evidence', 'no-cover', 'not-the-end', 'refused'] as const) {
      expect(retryable(kind), `${kind} should NOT be retryable`).toBe(false);
      expect(recommendationOf({ outcome: failed(kind), judge: 'j', at: null, landed: null }).retryable).toBe(false);
    }
    // every kind has an answer — a new one cannot slip through undecided
    expect(Object.keys(RETRYABLE).sort()).toEqual(['cites-nothing', 'malformed', 'no-cover', 'no-evidence', 'no-key', 'not-the-end', 'nothing-left', 'refused', 'stream-died', 'threw', 'timeout', 'unreachable']);
  });

  it('a ranking offers no retry at all, and neither does a stage in flight', () => {
    const answered: HotspotOutcome = { ok: true, model: 'm', picks: [{ residue: 'A:57', rank: 1, reason: 'buried', cites: ['f1'] }], refused: [], verdicts: [], disagreements: [], served: 3 };
    expect(recommendationOf({ outcome: answered, judge: 'j', at: 'c2', landed: 's5' }).retryable).toBe(false);
    expect(recommendationOf({ outcome: null, asking: { act: 'answering', tokens: 3 }, judge: 'j', at: 'c2', landed: null }).retryable).toBe(false);
  });

  it('the control’s NAME says the record survives it — never that the page starts over', () => {
    expect(retryLabelOf(false)).toContain('on this same run');
    expect(retryLabelOf(false)).toContain('keeping this refusal on the record');
    expect(retryLabelOf(true)).toBe('asking again…');
  });

  it('and it is NOT PRESSABLE mid-ask, and says so rather than looking idle', async () => {
    let pressed = 0;
    const view = recommendationOf({ outcome: null, asking: { act: 'answering', tokens: 3 }, judge: 'j', at: 'c2', landed: null, asked: 2 });
    const card = await mount(<Recommendation {...view} focused retry={{ label: retryLabelOf(true), busy: true, onPress: () => (pressed += 1) }} />);
    const button = document.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
    button?.click();
    expect(pressed).toBe(0);
    await card.unmount();
  });

  it('THE COUNT IS A FACT THE READER IS OWED, and it is not the library’s re-ask count', async () => {
    const answered: HotspotOutcome = { ok: true, model: 'm', picks: [{ residue: 'A:57', rank: 1, reason: 'buried', cites: ['f1'] }], refused: [], verdicts: [], disagreements: [], served: 3 };
    // asked once: no count at all, because an absence is absent
    expect(recommendationOf({ outcome: answered, judge: 'j', at: 'c2', landed: 's5' }).asked).toBe(1);
    const once = await mount(<Recommendation {...recommendationOf({ outcome: answered, judge: 'j', at: 'c2', landed: 's5' })} focused />);
    // (the card's `where` line already begins *asked once, from the rows at
    // commit …*, which is a different fact — which CURSOR the answer is about —
    // so the phrase asserted is the count's own)
    expect(once.words()).not.toContain('times in this run');
    await once.unmount();
    // asked twice: the card says so, BESIDE the library's own corrective
    // re-ask count rather than instead of it — two facts, two numbers
    const twice = await mount(<Recommendation {...recommendationOf({ outcome: answered, judge: 'j', at: 'c2', landed: 's6', asked: 2 })} focused />);
    expect(twice.words()).toContain('asked 2 times in this run');
    await twice.unmount();
    const failedTwice = await mount(<Recommendation {...recommendationOf({ outcome: failed('timeout'), judge: 'j', at: 'c2', landed: null, asked: 3 })} focused />);
    expect(failedTwice.words()).toContain('asked 3 times in this run');
    await failedTwice.unmount();
  });
});

// ── the retry's own record-keeping, as a fold ──────────────────────────────

/**
 * THE STEPPER MARKS THE LATEST ATTEMPT AND HIDES NONE OF THE EARLIER ONES.
 *
 * The live-session half of this — two asks, two acts, two commits, the first
 * still on the log — is in `tests/prot-hotspot-marks.test.tsx`, which opens a
 * real session. What is asserted here is the FOLD, because the fold is where a
 * retry could quietly erase a refusal.
 */
describe('a retry keeps the first attempt on the record', () => {
  it('the mark follows the latest attempt and the refusal sentence survives it', () => {
    const refused: ActOutcome = { stage: 'hotspots', act: HOTSPOTS_ACT, commit: null, refusal: 'the door\u2019s answer stream ended after 0 reports', materialized: [] };
    const landedAgain: ActOutcome = { stage: 'hotspots', act: HOTSPOTS_ACT, commit: 's6', refusal: null, materialized: ['hotspot_rank', 'hotspot_cites', 'hotspot_reason'] };
    const five = stepperStages([refused, landedAgain], null).find((stage) => stage.stage === 'hotspots')!;
    // WHAT HAPPENED is that the second ask answered, so the mark says landed\u2026
    expect(five.state).toBe('landed');
    expect(five.commit).toBe('s6');
    // \u2026and NOTHING IS HIDDEN by the mark moving on: the refusal is still
    // there, verbatim, and both acts are on the rows
    expect(five.detail).toBe('the door\u2019s answer stream ended after 0 reports');
    expect(five.acts).toHaveLength(2);
    // and one attempt alone reads exactly as it did before retries existed
    expect(stepperStages([refused], null).find((stage) => stage.stage === 'hotspots')!.state).toBe('refused');
  });
});
