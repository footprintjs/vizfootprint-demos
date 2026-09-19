/**
 * THE PROTEIN DESK'S DOORS — stage 5 on the wire, and the key that never
 * reaches it.
 *
 * Four claims:
 *
 *  1. **fail closed and say WHICH.** No key ⇒ the door answers that it has no
 *     key, in a sentence that is explicitly NOT the static build's reason, and
 *     never a scripted ranking in a real model's place.
 *  2. **every failure is its own sentence.** A bad request, a model that could
 *     not be reached, one that refused, one that answered nonsense, one that
 *     cited nothing — each arrives as itself, and none of them as a silent
 *     empty list.
 *  3. **a served page reads the committed bytes by the declared name**, and by
 *     no other: a path outside the list is not a file this door has.
 *  4. **THE KEY NEVER LEAVES THE PROVIDER.** Every body, every sentence and
 *     every state this file can produce is searched for it, byte for byte, and
 *     the presence check is a boolean.
 *
 * EVERY TEST RUNS ON THE `mock` PROVIDER and the scripted `Classifier`. The one
 * test about a real model is a GUARD rather than a skip: with no key in the
 * environment it asserts that the driver says so and that nothing was asked,
 * which is a real assertion and keeps the suite at zero skipped.
 */
import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { mock } from 'agentfootprint/providers';
import {
  PROT_SERVED_FILES,
  answerHotspots,
  chooseHotspotDriver,
  SCRIPTED_ENV,
  createProtDesk,
  driverFromEnvironment,
  ledgerOf,
  NDJSON_TYPE,
  PROT_DEFAULT_MODEL,
  protModel,
  protStateOf,
  scriptedHotspotDriver,
  serveProtDoors,
  type ProtDesk,
} from '../server/prot-doors.js';
import { HOTSPOT_TAG, NO_KEY_SENTENCE, hotspotLedger, scriptedJudge, type HotspotLedger } from '../src/prot/hotspots.js';
import { ACT_KEY_COLUMN, CONTACTS_ACT, SURFACE_ACT } from '../src/prot/analyses.js';
import { PROT_FILES } from '../src/data/files.js';
import type { ProtRun } from '../src/prot/orchestrator.js';

/** A key this test invents, so nothing real is ever in play — and the thing every body below is searched for. */
const FAKE_KEY = 'sk-ant-this-is-a-test-key-abcdef0123456789';

// ── the evidence a page would send ───────────────────────────────────────────

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

/**
 * Two residues at the interface in a table of six — a proper minority, so a
 * cover. Only the two carry `interface_separation`, which is the column the
 * act lands ABSENT and the one the cover is read off; every row carries an
 * `interface_contacts` COUNT, including the zeros, which is what made the
 * cover wrong for a release.
 */
const LEDGER: HotspotLedger = hotspotLedger(
  run,
  [
    { [ACT_KEY_COLUMN]: 'A:57', chain: 'A', resnum: 57, resname: 'GLU', contacts: 14, interface_contacts: 4, interface_separation: 2.81, sasa: 18.4, relative_sasa: 0.12 },
    { [ACT_KEY_COLUMN]: 'B:35', chain: 'B', resnum: 35, resname: 'ARG', contacts: 9, interface_contacts: 3, interface_separation: 3.02, sasa: 41.2, relative_sasa: 0.3 },
    { [ACT_KEY_COLUMN]: 'A:12', chain: 'A', resnum: 12, resname: 'ALA', contacts: 2, interface_contacts: 0, sasa: 90.1, relative_sasa: 0.8 },
    { [ACT_KEY_COLUMN]: 'A:13', chain: 'A', resnum: 13, resname: 'GLY', contacts: 3, interface_contacts: 0, sasa: 61.2, relative_sasa: 0.6 },
    { [ACT_KEY_COLUMN]: 'A:14', chain: 'A', resnum: 14, resname: 'SER', contacts: 1, interface_contacts: 0, sasa: 40.0, relative_sasa: 0.4 },
    { [ACT_KEY_COLUMN]: 'B:70', chain: 'B', resnum: 70, resname: 'LEU', contacts: 0, interface_contacts: 0, sasa: 8.0, relative_sasa: 0.08 },
  ],
  's4',
);

/** What a page puts on the wire — the ledger's own fields and nothing invented for the request. */
const wire = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ facts: LEDGER.facts, residues: LEDGER.residues, basis: LEDGER.basis, from: LEDGER.from, at: LEDGER.at, ...over });

// ── one request, answered ────────────────────────────────────────────────────

interface Answered {
  readonly status: number;
  /** Every byte the door wrote, in order — what the key test searches. */
  readonly text: string;
  /**
   * THE ANSWER, whichever way the door delivered it: the one JSON body of a
   * status answer (a 400, a 404, a 405, a served file) or the `answer` frame of
   * a streamed one — which carries exactly what the non-streaming
   * {@link answerHotspots} answers.
   */
  readonly body: Record<string, unknown>;
  /** The REPORTS the streamed door wrote ahead of the answer, in order. Empty for every non-streamed door. */
  readonly reports: readonly Record<string, unknown>[];
  /** Every frame, whole — so a test can assert the answer is LAST and appears exactly once. */
  readonly frames: readonly Record<string, unknown>[];
  readonly contentType: string;
}

/**
 * One request/response pair through the real door — buffers in, the way node's
 * http server yields a body.
 *
 * `write` IS COLLECTED BESIDE `end`, because the hot spots door STREAMS: one
 * `HotspotFrame` per line, the answer always last
 * (`server/prot-doors.ts` · `HotspotFrame`). Everything else answers with one
 * body through `end` exactly as it always did, and the parse below handles both
 * out of the same bytes rather than by branching on the door.
 */
async function ask(desk: ProtDesk, method: string, path: string, body?: unknown, expectHandled = true): Promise<Answered> {
  const req = Readable.from([Buffer.from(body === undefined ? '' : JSON.stringify(body))]) as unknown as IncomingMessage;
  req.method = method;
  req.url = path;
  req.headers = {};
  let status = 0;
  let text = '';
  let contentType = '';
  const res = {
    writeHead: (code: number, headers?: Record<string, string>) => {
      status = code;
      contentType = headers?.['content-type'] ?? '';
      return res;
    },
    write: (chunk: string | Buffer) => {
      text += String(chunk);
      return true;
    },
    end: (chunk?: string | Buffer) => {
      if (chunk !== undefined) text += String(chunk);
    },
  } as unknown as ServerResponse;
  expect(await serveProtDoors(desk, req, res, process.cwd())).toBe(expectHandled);
  /** Every line that parses as an object — one for a status answer, N for a streamed one. */
  const frames = text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line) => {
      try {
        const maybe: unknown = JSON.parse(line);
        return typeof maybe === 'object' && maybe !== null && !Array.isArray(maybe) ? [maybe as Record<string, unknown>] : [];
      } catch {
        return [];
      }
    });
  const answered = frames.filter((frame) => 'answer' in frame);
  const last = frames[frames.length - 1];
  return {
    status,
    text,
    // the streamed door's `answer` frame, or the one body every other door writes
    body: (answered[0]?.['answer'] as Record<string, unknown> | undefined) ?? (last !== undefined && !('report' in last) ? last : {}),
    reports: frames.flatMap((frame) => ('report' in frame ? [frame['report'] as Record<string, unknown>] : [])),
    frames,
    contentType,
  };
}

// ── the driver ───────────────────────────────────────────────────────────────

describe('what is driving stage 5 is decided by what this environment offered', () => {
  it('no key means NONE — with the sentence, and never a scripted ranking in a real model’s place', () => {
    const driver = chooseHotspotDriver(undefined);
    expect(driver.mode).toBe('none');
    if (driver.mode !== 'none') return;
    expect(driver.reason).toBe(NO_KEY_SENTENCE);
    // AND IT IS NOT THE STATIC BUILD'S REASON. That is the whole distinction
    // this door exists to make: a server is standing here with nothing to ask.
    expect(driver.reason).not.toContain('static page cannot hold');
    expect(driver.reason).toContain('That is NOT this build\'s static-page limit');
    // a blank and a whitespace key are the same fact as no key
    expect(chooseHotspotDriver('').mode).toBe('none');
    expect(chooseHotspotDriver('   ').mode).toBe('none');
  });

  it('a key means LIVE, with a judge that declares itself the weaker of the two', () => {
    const driver = chooseHotspotDriver(FAKE_KEY);
    expect(driver.mode).toBe('live');
    if (driver.mode === 'none') return;
    expect(driver.provider.name).toBe('browser-anthropic');
    expect(driver.model).toBe(protModel());
    expect(driver.judge.weaker).toBe(true);
    expect(driver.judge.said).toContain('SAME family of model that answered');
  });

  it('DEFAULTS TO THE SMALL MODEL, and the knob is what a comparison rides', () => {
    // The author's ruling: this stage is asked on every boot of a desk that is
    // driven all day, so the default is the small model and the larger one is a
    // knob away. Pinned so it cannot drift back silently — the cost of this
    // stage is a property of the desk, not an accident of whoever edited last.
    const held = process.env['ANTHROPIC_MODEL'];
    try {
      delete process.env['ANTHROPIC_MODEL'];
      expect(protModel()).toBe(PROT_DEFAULT_MODEL);
      expect(PROT_DEFAULT_MODEL).toContain('haiku');
      // …and a blank is ABSENT rather than the model "", which is the whole
      // reason this is a function and not a constant read at the call site
      process.env['ANTHROPIC_MODEL'] = '   ';
      expect(protModel()).toBe(PROT_DEFAULT_MODEL);
      process.env['ANTHROPIC_MODEL'] = 'claude-sonnet-5';
      expect(protModel()).toBe('claude-sonnet-5');
    } finally {
      if (held === undefined) delete process.env['ANTHROPIC_MODEL'];
      else process.env['ANTHROPIC_MODEL'] = held;
    }
  });

  it('the scripted driver has to be asked for BY NAME', () => {
    const scripted = scriptedHotspotDriver();
    expect(scripted.mode).toBe('scripted');
    if (scripted.mode === 'none') return;
    // and it says so in three places at once, so nothing on a screen can read
    // it as a model's opinion
    expect(scripted.model).toBe('scripted (no model)');
    expect(scripted.judge.said).toContain('no model was asked');
  });

  it('the environment can ask for it by that name, and the ask wins over a key', () => {
    // BOTH NAMES ARE SAVED AND PUT BACK. A suite that left either one moved
    // would decide the live guard at the bottom of this file for it.
    const wasScripted = process.env[SCRIPTED_ENV];
    const wasKey = process.env['ANTHROPIC_API_KEY'];
    const put = (name: string, value: string | undefined): void => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    try {
      put(SCRIPTED_ENV, undefined);
      put('ANTHROPIC_API_KEY', undefined);
      expect(driverFromEnvironment().mode).toBe('none');
      put(SCRIPTED_ENV, '1');
      expect(driverFromEnvironment().mode).toBe('scripted');
      // a request BY NAME is not second-guessed, whatever else the environment
      // offered — a developer who wants the shape of stage 5 without spending a
      // call has said so
      put('ANTHROPIC_API_KEY', FAKE_KEY);
      expect(driverFromEnvironment().mode).toBe('scripted');
      // and anything other than the one value is not the ask
      put(SCRIPTED_ENV, 'yes');
      expect(driverFromEnvironment().mode).toBe('live');
      put('ANTHROPIC_API_KEY', undefined);
      expect(driverFromEnvironment().mode).toBe('none');
    } finally {
      put(SCRIPTED_ENV, wasScripted);
      put('ANTHROPIC_API_KEY', wasKey);
    }
  });
});

// ── GET /api/prot/state ──────────────────────────────────────────────────────

describe('GET /api/prot/state says whether the stage can run here, and if not why', () => {
  it('reports no key as the stage’s own reason, and names no model', async () => {
    const desk = createProtDesk(chooseHotspotDriver(undefined));
    const { status, body } = await ask(desk, 'GET', '/api/prot/state');
    expect(status).toBe(200);
    expect(body['mode']).toBe('none');
    expect(body['reason']).toBe(NO_KEY_SENTENCE);
    expect(body['model']).toBeUndefined();
    expect(body['judge']).toBeUndefined();
    expect(body['tag']).toBe(HOTSPOT_TAG);
  });

  it('reports the judge and the model when there is something to ask', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    const { body } = await ask(desk, 'GET', '/api/prot/state');
    expect(body['mode']).toBe('scripted');
    expect(body['reason']).toBeUndefined();
    expect((body['judge'] as Record<string, unknown>)['weaker']).toBe(true);
    expect(body['asks']).toBe(0);
  });

  it('counts the asks it answered', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    await ask(desk, 'POST', '/api/prot/hotspots', wire());
    const { body } = await ask(desk, 'GET', '/api/prot/state');
    expect(body['asks']).toBe(1);
  });
});

// ── POST /api/prot/hotspots ──────────────────────────────────────────────────

/**
 * THE DOOR IS STREAMED, and the two things that makes it responsible for.
 *
 * The status has to travel, so the reports are framed AHEAD of the answer on
 * the same response (`server/prot-doors.ts` · `HotspotFrame` argues the choice
 * against a second progress door and against SSE). What that must never cost:
 *
 *  1. **THE ANSWER IS STILL THE ANSWER.** The last frame carries exactly what
 *     the non-streaming {@link answerHotspots} answers, byte for byte — so
 *     every other test in this file goes on asserting the same object.
 *  2. **NO REPORT CARRIES A WORD OF IT.** Progress is a state, so every field
 *     of every report is a count or a declared word, and the whole report
 *     stream is searched for the answer's own residues and reasons.
 */
describe('the door reports what the stage is DOING, ahead of what it answered', () => {
  it('frames reports first and the answer LAST, exactly once, as newline-delimited JSON', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    const answered = await ask(desk, 'POST', '/api/prot/hotspots', wire());
    expect(answered.status).toBe(200);
    expect(answered.contentType).toBe(NDJSON_TYPE);
    // one frame per line, and the file ends with a newline rather than mid-line
    expect(answered.text.endsWith('\n')).toBe(true);
    expect(answered.frames.length).toBe(answered.text.trim().split('\n').length);
    // THE ANSWER IS LAST AND THERE IS ONE OF IT
    expect(answered.frames.filter((frame) => 'answer' in frame)).toHaveLength(1);
    expect(Object.keys(answered.frames[answered.frames.length - 1]!)).toEqual(['answer']);
    // and reports really arrived ahead of it
    expect(answered.reports.length).toBeGreaterThan(0);
    // the LAST FRAME is what the non-streaming door answers — one owner, two
    // deliveries (`server/prot-doors.ts` · `askOnThisDesk`)
    const blocking = await answerHotspots(createProtDesk(scriptedHotspotDriver()), wire());
    expect(blocking.status).toBe(200);
    const streamed = answered.body as Record<string, unknown>;
    const direct = blocking.body as Record<string, unknown>;
    expect(streamed['ok']).toBe(direct['ok']);
    expect(streamed['picks']).toEqual(direct['picks']);
    expect(streamed['served']).toEqual(direct['served']);
  });

  it('EVERY REPORT IS THE ACT — a count or a declared word, and never a word of the answer', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    const answered = await ask(desk, 'POST', '/api/prot/hotspots', wire());
    const picks = (answered.body['picks'] ?? []) as readonly { readonly residue: string; readonly reason: string; readonly cites: readonly string[] }[];
    expect(picks.length).toBeGreaterThan(0);
    /**
     * THE HONESTY ASSERTION, over the reports as BYTES: nothing the answer
     * carries — not a residue key, not a reason, not a cited fact id — appears
     * anywhere in the progress stream.
     */
    const progress = JSON.stringify(answered.reports);
    for (const pick of picks) {
      expect(progress).not.toContain(pick.residue);
      expect(progress).not.toContain(pick.reason);
      for (const id of pick.cites) expect(progress).not.toContain(id);
    }
    // and every report's own act is one of the declared words
    const acts = new Set(answered.reports.map((report) => report['act']));
    for (const act of acts) expect(['asking', 'reading-evidence', 'read-evidence', 'answering', 'thinking', 're-asking', 'retrying', 'scoring']).toContain(act);
    // the ask says what it is asking and out of how much — both known before the call
    const asking = answered.reports.find((report) => report['act'] === 'asking');
    expect(asking?.['facts']).toBe(LEDGER.facts.length);
    expect(asking?.['residues']).toBe(LEDGER.covered);
    // and the judge's own step is reported, after the answer and before the verdict
    expect(answered.reports.some((report) => report['act'] === 'scoring')).toBe(true);
  });

  it('a process with no key reports NOTHING and answers its own sentence — there is no ask to report on', async () => {
    const desk = createProtDesk(chooseHotspotDriver(undefined));
    const answered = await ask(desk, 'POST', '/api/prot/hotspots', wire());
    expect(answered.reports).toEqual([]);
    expect(answered.body['kind']).toBe('no-key');
  });

  it('a malformed request is NOT a stream — the status has to be written before any frame could be', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    const answered = await ask(desk, 'POST', '/api/prot/hotspots', { facts: LEDGER.facts });
    expect(answered.status).toBe(400);
    expect(answered.contentType).toContain('application/json');
    expect(answered.reports).toEqual([]);
    expect(answered.body['kind']).toBe('malformed-request');
  });
});

describe('POST /api/prot/hotspots answers the ranked list with its citations and the judge’s verdicts', () => {
  it('answers picks that cite ids the ledger holds, and records a verdict beside them', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    const { status, body } = await ask(desk, 'POST', '/api/prot/hotspots', wire());
    expect(status).toBe(200);
    expect(body['ok']).toBe(true);
    const picks = body['picks'] as readonly Record<string, unknown>[];
    expect(picks.length).toBeGreaterThan(0);
    expect(LEDGER.residues).toContain(picks[0]!['residue']);
    expect((picks[0]!['cites'] as readonly string[]).every((id) => LEDGER.facts.some((f) => f.id === id))).toBe(true);
    expect((body['verdicts'] as readonly unknown[]).length).toBe(1);
    expect(body['served']).toBe(LEDGER.facts.length);
  });

  it('answers NO KEY with that reason, at 200 — the door answered, and what it answered is a fact about this process', async () => {
    const desk = createProtDesk(chooseHotspotDriver(undefined));
    const { status, body } = await ask(desk, 'POST', '/api/prot/hotspots', wire());
    // NOT a 5xx: a 500 would make "this process has no key" look like a fault,
    // and the page has to show it as the stage's own reason
    expect(status).toBe(200);
    expect(body['ok']).toBe(false);
    expect(body['kind']).toBe('no-key');
    expect(body['sentence']).toBe(NO_KEY_SENTENCE);
    expect(body['verdicts']).toEqual([]);
  });

  it('refuses a request with no residue table — a name judged against nothing would pass every hallucination', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    const { status, body } = await ask(desk, 'POST', '/api/prot/hotspots', { facts: LEDGER.facts });
    expect(status).toBe(400);
    expect(body['kind']).toBe('malformed-request');
    expect(body['sentence']).toContain('would let every hallucination through');
    // and nothing was asked of a model
    expect(desk.asks).toEqual([]);
  });

  it('refuses a request whose facts are not facts, naming which one', () => {
    expect(ledgerOf({ residues: ['A:1'] })).toEqual({ error: 'this door needs "facts": the findings ledger the run\'s own recorders produced, as an array' });
    expect(ledgerOf({ residues: ['A:1'], facts: [{ residue: 'A:1', text: 'x', from: 'y' }] })).toEqual({
      error: 'the fact at position 1 carries no id, and an id is what the model is asked to quote',
    });
    expect(ledgerOf({ residues: ['A:1'], facts: [{ id: 'f1', text: 'x' }] })).toEqual({ error: 'the fact "f1" is missing its residue, its text or the act it came from' });
    expect(ledgerOf({ residues: [], facts: [] })).toMatchObject({ error: expect.stringContaining('every residue key the run\'s own table holds') as unknown as string });
  });

  it('reads a well-formed ledger back off the wire, field for field', () => {
    const read = ledgerOf(wire());
    expect('error' in read).toBe(false);
    if ('error' in read) return;
    expect(read.facts).toEqual(LEDGER.facts);
    expect(read.residues).toEqual(LEDGER.residues);
    expect(read.basis).toBe(LEDGER.basis);
    // the cursor the rows were read at rides across, so the answer can say
    // which one it is about
    expect(read.at).toBe('s4');
    expect(read.cover).toBe('covers');
    expect(read.covered).toBe(2);
  });

  /**
   * THE DOOR JUDGES THE COVER IT WAS HANDED, whoever sent it — the belt the
   * 717-fact ask did not have.
   *
   * The page folds the ledger and decides what it covers, and for one release a
   * fault there put facts for every one of 185 residues on the wire and this
   * door asked a model to rank hot spots out of them. The door cannot re-run
   * the rule, but it can ask the same question of the pile: how many residues
   * are these facts about, against the table they are judged against?
   */
  it('REFUSES a pile that is not a cover before a single call is spent', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    // the exact shape the bug produced: a fact per residue, over the whole table
    const everything = LEDGER.residues.map((residue, at) => ({ id: `f${String(at + 1)}`, residue, text: `${residue} is a residue`, from: 'the parse' }));
    const { status, body } = await ask(desk, 'POST', '/api/prot/hotspots', { facts: everything, residues: LEDGER.residues, basis: 'the page believed this was a cover', at: 's4' });
    expect(status).toBe(200);
    expect(body['ok']).toBe(false);
    expect(body['kind']).toBe('no-cover');
    expect(body['sentence']).toContain("the cover rule selected 6 of this run's 6 residues, and that is not a cover");
    expect(body['sentence']).toContain('an ask nobody can answer is worse than one that was never made');
    // AND NOTHING WAS ASKED OF A MODEL. That is the whole point: the refusal is
    // reached without spending the call the old code spent to reach it.
    expect(desk.asks).toHaveLength(1);
    expect(desk.asks[0]).toMatchObject({ ok: false, kind: 'no-cover' });
  });

  it('the door’s own verdict wins over whatever the page believed about the pile', () => {
    const read = ledgerOf({ facts: LEDGER.residues.map((residue, at) => ({ id: `f${String(at + 1)}`, residue, text: 'x', from: 'the parse' })), residues: LEDGER.residues, basis: 'the page said this was fine' });
    expect('error' in read).toBe(false);
    if ('error' in read) return;
    expect(read.cover).toBe('not-a-cover');
  });

  it('hands every model failure through as its own sentence', async () => {
    const failing = (error: Error) =>
      createProtDesk({
        mode: 'scripted',
        model: 'scripted (no model)',
        judge: scriptedJudge(),
        provider: mock({
          name: 'failing',
          respond: () => {
            throw error;
          },
        }),
      });
    const unreachable = await answerHotspots(failing(new Error('fetch failed')), wire());
    expect((unreachable.body as Record<string, unknown>)['kind']).toBe('unreachable');
    const refused = await answerHotspots(failing(new Error('Anthropic 401: invalid x-api-key')), wire());
    expect((refused.body as Record<string, unknown>)['kind']).toBe('refused');

    const nonsense = createProtDesk({ mode: 'scripted', model: 'scripted (no model)', judge: scriptedJudge(), provider: mock({ name: 'prose', respond: () => 'the hot spots are obvious' }) });
    const malformed = await answerHotspots(nonsense, wire());
    expect((malformed.body as Record<string, unknown>)['kind']).toBe('malformed');
    // EVERY ONE OF THEM IS AN ANSWER, never an empty list: a reader learns which
    for (const said of [unreachable, refused, malformed]) {
      expect(said.status).toBe(200);
      expect(String((said.body as Record<string, unknown>)['sentence']).length).toBeGreaterThan(40);
    }
  });
});

// ── the manners ──────────────────────────────────────────────────────────────

describe('the door has the manners the other two have', () => {
  it('a GET at a POST door is the wrong VERB, and an unknown door is a missing door', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    expect((await ask(desk, 'GET', '/api/prot/hotspots')).status).toBe(405);
    expect((await ask(desk, 'GET', '/api/prot/nothing-here')).status).toBe(404);
    expect((await ask(desk, 'POST', '/api/prot/nothing-here')).body['error']).toBe('no door "nothing-here"');
  });

  it('answers `false` for a path that is not ours, so the server can try the next desk', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    await ask(desk, 'GET', '/api/grid/rows', undefined, false);
    await ask(desk, 'GET', '/api/state', undefined, false);
  });

  it('refuses a body that is not JSON', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    const req = Readable.from([Buffer.from('{not json')]) as unknown as IncomingMessage;
    req.method = 'POST';
    req.url = '/api/prot/hotspots';
    req.headers = {};
    let status = 0;
    let text = '';
    const res = { writeHead: (c: number) => ((status = c), res), end: (chunk?: string) => void (text = chunk ?? '') } as unknown as ServerResponse;
    expect(await serveProtDoors(desk, req, res)).toBe(true);
    expect(status).toBe(400);
    expect(JSON.parse(text)).toEqual({ error: 'body is not JSON' });
  });
});

// ── the committed files ──────────────────────────────────────────────────────

describe('a served page reads the committed bytes by the declared name, and by no other', () => {
  it('serves the entry, and it is the bytes this repository committed', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    const { status, text } = await ask(desk, 'GET', `/api/prot/${PROT_FILES.structure}`);
    expect(status).toBe(200);
    expect(text.startsWith('HEADER')).toBe(true);
    expect(text).toBe(readFileSync(PROT_FILES.structure, 'utf8'));
  });

  it('serves every file the conservation stage cites, and its list is the one the static build copies', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    for (const file of PROT_SERVED_FILES) expect((await ask(desk, 'GET', `/api/prot/${file}`)).status).toBe(200);
    expect(PROT_SERVED_FILES).toContain(PROT_FILES.structure);
    expect(PROT_SERVED_FILES.length).toBe(6);
  });

  it('a path outside the list is not a file this door has — it is a door it does not have', async () => {
    const desk = createProtDesk(scriptedHotspotDriver());
    // not "forbidden", not a traversal refusal: the list is the whole of what
    // exists here, so anything else falls through to the unknown-door answer
    expect((await ask(desk, 'GET', '/api/prot/package.json')).body['error']).toBe('no door "package.json"');
    // A TRAVERSAL NEVER EVEN REACHES THIS DOOR, and that is measured rather
    // than assumed: `new URL` normalises the dots away, so the path the door is
    // asked about is `/etc/passwd`, which does not carry this desk's prefix —
    // the door answers `false` and the request falls through to the next desk
    // and then to the static files. The list-not-a-directory rule above is what
    // holds for every path that DOES carry the prefix.
    await ask(desk, 'GET', '/api/prot/../../etc/passwd', undefined, false);
  });
});

// ── THE KEY ──────────────────────────────────────────────────────────────────

/**
 * THE HONESTY TEST ABOUT THE KEY. It is asserted over what this process can
 * PRODUCE — every body, the state wire, every sentence and the desk itself —
 * rather than over a line of source, because a line can be right and a
 * serialisation still wrong.
 */
describe('the key reaches the provider and nothing else', () => {
  it('no body, sentence or state this door produces carries it — with a live driver built from one', async () => {
    const desk = createProtDesk(chooseHotspotDriver(FAKE_KEY));
    expect(JSON.stringify(protStateOf(desk))).not.toContain(FAKE_KEY);
    // the live provider WILL fail here (no network in this suite), which is the
    // interesting case: a failure sentence quotes the error, and an error is
    // exactly where a key leaks if anything is going to leak one
    const said = await ask(desk, 'POST', '/api/prot/hotspots', wire({ timeoutMs: 8_000 }));
    expect(said.body['ok']).toBe(false);
    expect(said.text).not.toContain(FAKE_KEY);
    expect(said.text).not.toContain('sk-ant');
    expect(JSON.stringify(desk.asks)).not.toContain(FAKE_KEY);
    /*
      AND EVERY STATUS LINE THE STREAM WROTE, which is new bytes on this door
      and therefore a new place a key could have leaked. `said.text` above is
      the whole NDJSON body, so it already covers them — this asserts the
      REPORTS on their own so the coverage is legible rather than incidental,
      and because a failing live call is exactly where the reports are written.
    */
    expect(JSON.stringify(said.reports)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(said.reports)).not.toContain('sk-ant');
    expect(JSON.stringify(said.frames)).not.toContain(FAKE_KEY);
    // and the whole desk, driver included, does not serialise it into anything
    // a caller could hand onward
    expect(JSON.stringify(protStateOf(desk))).not.toContain('sk-ant');
  });

  it('presence is a BOOLEAN — this suite never asserts on a value', () => {
    // the shape the repository's own boot banner and this door both use
    expect(chooseHotspotDriver(process.env['ANTHROPIC_API_KEY']).mode === 'live').toBe(typeof process.env['ANTHROPIC_API_KEY'] === 'string' && process.env['ANTHROPIC_API_KEY'].trim() !== '');
  });

  it('the state wire has no field a key could ride on', async () => {
    const desk = createProtDesk(chooseHotspotDriver(FAKE_KEY));
    const { body } = await ask(desk, 'GET', '/api/prot/state');
    expect(Object.keys(body).sort()).toEqual(['asks', 'judge', 'mode', 'model', 'tag', 'want']);
  });
});

/**
 * THE ONE TEST ABOUT A REAL MODEL — a GUARD and not a skip.
 *
 * With no key, or without `PROT_LIVE=1`, it asserts the thing that is true in
 * that case: the driver says there is nothing to ask, and no ask was made. A
 * test that skipped itself here would be a green that proves nothing, which is
 * what this repository refuses.
 */
describe('the real provider, behind a guard', () => {
  it('runs a live ask only when the environment asks for one, and says which it did', async () => {
    const offered = process.env['ANTHROPIC_API_KEY'];
    const wanted = process.env['PROT_LIVE'] === '1';
    if (!wanted || offered === undefined || offered.trim() === '') {
      const desk = createProtDesk(chooseHotspotDriver(undefined));
      expect(protStateOf(desk).mode).toBe('none');
      expect(desk.asks).toEqual([]);
      // SAID OUT LOUD: the live arm did not run, and this is the assertion made instead
      expect(NO_KEY_SENTENCE).toContain('nothing to ask');
      return;
    }
    const desk = createProtDesk(chooseHotspotDriver(offered));
    const answer = await answerHotspots(desk, wire({ timeoutMs: 90_000 }));
    const body = answer.body as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain(offered);
    // a live model may refuse, time out or answer — what is asserted is that it
    // did ONE of those and said which, never that it agreed with us
    expect(typeof body['ok']).toBe('boolean');
    if (body['ok'] === true) {
      for (const pick of body['picks'] as readonly Record<string, unknown>[]) {
        expect(LEDGER.residues).toContain(pick['residue']);
        expect((pick['cites'] as readonly string[]).length).toBeGreaterThan(0);
      }
    } else {
      expect(String(body['sentence']).length).toBeGreaterThan(40);
    }
  });
});
