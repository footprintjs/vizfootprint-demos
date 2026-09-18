/**
 * STAGE 5 — the law, walked once for every way it can be broken.
 *
 * **A model's ranking is evidence with a citation, or it is not shown.** So
 * what is asserted here is not that the stage answers: it is that the answer is
 * judged against the run's own evidence, and that every way of failing that
 * judgement has its own sentence with the model's own words in it.
 *
 * EVERY TEST RUNS ON THE `mock` PROVIDER and the scripted `Classifier` — the
 * precedent is this repository's NNDSS suite, and the whole point of those
 * adapters is that a stubbed provider and a real one are THE SAME CODE PATH.
 * No test here needs a key, a network call or a real model, and
 * `tests/prot-doors.test.ts` asserts the same about the door.
 *
 * The one test that opens a real session is the one about the commit: a
 * ranking that lands is a ranking on a dashboard's own log, with its columns
 * on the same table and the same key every other stage writes to, and nothing
 * short of the real session can show that.
 */
import { describe, expect, it } from 'vitest';
import type { Row } from 'vizfootprint/data';
import { ACT_KEY_COLUMN, CONSERVATION_ACT, CONTACTS_ACT, SURFACE_ACT } from '../src/prot/analyses.js';
import { RESIDUE_KEY } from '../src/prot/def.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import {
  EVIDENCE_TOOL,
  FROM_THE_PARSE,
  HOTSPOTS_ACT,
  HOTSPOT_CITES_COLUMN,
  HOTSPOT_RANK_COLUMN,
  HOTSPOT_REASON_COLUMN,
  HOTSPOT_TAG,
  NO_KEY_SENTENCE,
  REFUSE_CITES_NOTHING,
  REFUSE_NOT_IN_TABLE,
  REFUSE_NO_REASON,
  REFUSE_PAST_CEILING,
  REFUSE_TWICE,
  REFUSE_UNKNOWN_FACT,
  askHotspots,
  hotspotLedger,
  hotspotSlot,
  providerJudge,
  scriptedHotspotModel,
  scriptedJudge,
  type HotspotAnswered,
  type LedgerFact,
} from '../src/prot/hotspots.js';
import { landHotspots, openProtSurfaceAsync, residuesAt } from '../src/prot/session.js';
import { loadStructure, readCommittedFile } from '../src/prot/snapshot.js';
import { evidenceFromCommitted } from '../src/prot/conservationEvidence.js';
import { mock, type LLMProvider } from 'agentfootprint/providers';
import { mockClassifier } from 'agentfootprint/classify';

// ── a run, and its rows, small enough to read ────────────────────────────────

/**
 * ONE ROW, as the session serves it at the cursor. Only the columns the ledger
 * reads are spelled, because the ledger reads exactly those and a fixture that
 * carried more would be a fixture claiming the fold looks at them.
 */
const row = (key: string, over: Record<string, unknown> = {}): Row => ({
  [ACT_KEY_COLUMN]: key,
  chain: key.split(':')[0],
  resnum: Number(key.split(':')[1]),
  resname: 'GLU',
  ...over,
});

/** A run whose three acts landed the columns they land — the shape `ActOutcome.materialized` really carries. */
const landedRun = (): ProtRun => ({
  outcomes: [
    { stage: 'conservation', act: CONSERVATION_ACT, commit: 'c1', refusal: null, materialized: ['conservation', 'conservation_basis'] },
    { stage: 'interactions', act: CONTACTS_ACT, commit: 'c2', refusal: null, materialized: ['contacts', 'interface_contacts', 'interface_separation'] },
    { stage: 'surface', act: SURFACE_ACT, commit: 'c3', refusal: null, materialized: ['sasa', 'relative_sasa'] },
  ] satisfies readonly ActOutcome[],
  narrative: [],
  pairs: null,
  contacts: null,
  surface: null,
  conservation: null,
});

/** Two residues at the interface and one that is not — the shape the absence vocabulary really produces. */
const ROWS: readonly Row[] = [
  row('A:57', { contacts: 14, interface_contacts: 4, interface_separation: 2.81, sasa: 18.4, relative_sasa: 0.12, conservation: 0.94, conservation_basis: 'PF00545.26, 283 sequences' }),
  row('B:35', { contacts: 9, interface_contacts: 3, interface_separation: 3.02, sasa: 41.2, relative_sasa: null, conservation: 0.71, conservation_basis: 'PF01337.25, 69 sequences' }),
  row('A:12', { contacts: 5, sasa: 88.1, relative_sasa: 0.6 }),
];

const ask = (provider: LLMProvider, over: Partial<Parameters<typeof askHotspots>[0]> = {}) =>
  askHotspots({ provider, judge: scriptedJudge(), model: 'a-test-model', ledger: hotspotLedger(landedRun(), ROWS), timeoutMs: 5_000, ...over });

/** A model that answers whatever is handed here, with no tool call at all — for the doors that never reach the evidence. */
const answering = (reply: string): LLMProvider => mock({ name: 'flat', respond: () => reply });

/** A model that throws — the four failure doors are about what came back, so each one scripts its own throw. */
const throwing = (error: unknown): LLMProvider =>
  mock({
    name: 'throwing',
    respond: () => {
      throw error;
    },
  });

// ── the ledger ───────────────────────────────────────────────────────────────

describe('the findings ledger holds what the pipeline established, and nothing it computed twice', () => {
  it('covers the residues an act\'s own absence vocabulary singles out, and says so instead of naming a threshold', () => {
    const ledger = hotspotLedger(landedRun(), ROWS);
    expect([...new Set(ledger.facts.map((f) => f.residue))]).toEqual(['A:57', 'B:35']);
    expect(ledger.residues).toEqual(['A:57', 'B:35', 'A:12']);
    expect(ledger.basis).toContain('the interaction act\'s own absence vocabulary and not a threshold anybody picked');
    expect(ledger.basis).toContain('2 residues of 3');
  });

  it('gives every fact an id and attributes it to the act that landed the column', () => {
    const { facts } = hotspotLedger(landedRun(), ROWS);
    expect(facts.map((f) => f.id)).toEqual(facts.map((_, at) => `f${String(at + 1)}`));
    expect([...new Set(facts.map((f) => f.from))].sort()).toEqual([CONSERVATION_ACT, CONTACTS_ACT, SURFACE_ACT, FROM_THE_PARSE].sort());
  });

  it('states the values the acts landed and never a number of its own', () => {
    const { facts } = hotspotLedger(landedRun(), ROWS);
    const said = (residue: string, from: string): string => facts.find((f) => f.residue === residue && f.from === from)!.text;
    expect(said('A:57', CONTACTS_ACT)).toBe('A:57 is in 14 non-covalent contacts, 4 of them crossing to the other chain, the tightest of those at 2.81 ångström');
    expect(said('A:57', SURFACE_ACT)).toBe('A:57 exposes 18.4 square ångström of surface the solvent can reach, which is 12% of the published maximum for its residue type');
    // THE BASIS RIDES WITH THE SCORE: two chains, two curated alignments, so a
    // score with no accession beside it is two claims wearing one number
    expect(said('B:35', CONSERVATION_ACT)).toContain('(PF01337.25, 69 sequences)');
    // and the relative value is ABSENT, never zero, where the residue type has no published maximum
    expect(said('B:35', SURFACE_ACT)).toContain('no published maximum to express that as a fraction of');
  });

  it('holds no fact from an act that was refused — the model cannot cite what it was never served', () => {
    const run = landedRun();
    const without: ProtRun = { ...run, outcomes: run.outcomes.map((o) => (o.act === SURFACE_ACT ? { ...o, commit: null, refusal: 'act "residueSurface" landed nothing', materialized: [] } : o)) };
    const ledger = hotspotLedger(without, ROWS.map((r) => ({ ...r, sasa: undefined, relative_sasa: undefined })));
    expect(ledger.from).not.toContain(SURFACE_ACT);
    expect(ledger.facts.some((f) => f.text.includes('surface the solvent can reach'))).toBe(false);
  });

  it('covers nothing, and says which column is absent, when the interaction act landed none of it', () => {
    const ledger = hotspotLedger(landedRun(), [row('A:12', { sasa: 88.1 })]);
    expect(ledger.facts).toEqual([]);
    expect(ledger.basis).toContain('no residue at this cursor carries an "interface_contacts" value');
  });
});

// ── the answer, and the hallucination door ───────────────────────────────────

describe('the answer is judged against the evidence, never trusted because it is well formed', () => {
  it('keeps a ranking that names a residue in the table and cites facts the ledger holds', async () => {
    const answer = await ask(scriptedHotspotModel());
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.picks.map((p) => p.residue)).toEqual(['A:57', 'B:35']);
    expect(answer.picks.map((p) => p.rank)).toEqual([1, 2]);
    expect(answer.picks[0]!.cites.length).toBeGreaterThan(0);
    expect(answer.refused).toEqual([]);
    expect(answer.served).toBe(hotspotLedger(landedRun(), ROWS).facts.length);
  });

  it('REFUSES A RESIDUE THE RUN\'S TABLE HAS NO ROW FOR, by name, with the name it gave', async () => {
    const answer = await ask(scriptedHotspotModel({ pick: (facts) => [{ residue: 'Z:999', reason: 'a residue this entry does not have', cites: [facts[0]!.id] }, { residue: 'A:57', reason: 'at the interface', cites: [facts[0]!.id] }] }));
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.refused).toContain(REFUSE_NOT_IN_TABLE('Z:999'));
    expect(answer.refused[0]).toBe('the model named "Z:999" and this run\'s residue table has no row for it — a prediction about a residue that is not in the evidence is refused by name, and nothing of that ranking was landed');
    // and the rest of the answer stands, renumbered by nobody: the surviving
    // ranking is rank 1 because it is the first ranking that survived
    expect(answer.picks).toEqual([{ residue: 'A:57', rank: 1, reason: 'at the interface', cites: ['f1'] }]);
  });

  it('refuses a ranking that cites nothing, and reports the whole answer as citing nothing when none of them did', async () => {
    const one = await ask(scriptedHotspotModel({ pick: (facts) => [{ residue: 'A:57', reason: 'because I say so', cites: [] }, { residue: 'B:35', reason: 'cited', cites: [facts[0]!.id] }] }));
    expect(one.ok).toBe(true);
    if (one.ok) expect(one.refused).toEqual([REFUSE_CITES_NOTHING('A:57')]);

    const none = await ask(scriptedHotspotModel({ pick: () => [{ residue: 'A:57', reason: 'because I say so', cites: [] }] }));
    expect(none.ok).toBe(false);
    if (none.ok) return;
    expect(none.kind).toBe('cites-nothing');
    expect(none.sentence).toBe('the model answered with 1 ranking and not one of them cited a fact id. The whole answer is a claim about evidence it never quoted, so stage 5 landed none of it.');
  });

  it('refuses a citation the ledger cannot answer, by that id', async () => {
    const answer = await ask(scriptedHotspotModel({ pick: (facts) => [{ residue: 'A:57', reason: 'cited something nobody served', cites: [facts[0]!.id, 'f9999'] }] }));
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.kind).toBe('nothing-left');
    expect(answer.sentence).toContain(REFUSE_UNKNOWN_FACT('A:57', 'f9999'));
  });

  it('refuses a second ranking of one residue, a ranking with no reason, and a ranking past the ceiling', async () => {
    const twice = await ask(scriptedHotspotModel({ pick: (f) => [{ residue: 'A:57', reason: 'once', cites: [f[0]!.id] }, { residue: 'A:57', reason: 'twice', cites: [f[0]!.id] }] }));
    if (twice.ok) expect(twice.refused).toEqual([REFUSE_TWICE('A:57')]);

    const mute = await ask(scriptedHotspotModel({ pick: (f) => [{ residue: 'A:57', reason: '   ', cites: [f[0]!.id] }, { residue: 'B:35', reason: 'said', cites: [f[0]!.id] }] }));
    if (mute.ok) expect(mute.refused).toEqual([REFUSE_NO_REASON('A:57')]);

    const over = await ask(scriptedHotspotModel({ pick: (f) => [{ residue: 'A:57', reason: 'one', cites: [f[0]!.id] }, { residue: 'B:35', reason: 'two', cites: [f[0]!.id] }] }), { want: 1 });
    if (over.ok) expect(over.refused).toEqual([REFUSE_PAST_CEILING('B:35', 1)]);
  });
});

// ── the judge ────────────────────────────────────────────────────────────────

describe('the standing judge is a second source, and its disagreements are recorded rather than smoothed over', () => {
  it('records the judge\'s verdict beside the model\'s own standing', async () => {
    const answer = await ask(scriptedHotspotModel());
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.verdicts).toHaveLength(1);
    expect(answer.verdicts[0]).toMatchObject({ of: EVIDENCE_TOOL, judge: 'fact', model: 'fact', by: 'mock · scripted-standing-judge' });
    // the two agree, so there is nothing to say and an absence is absent
    expect(answer.disagreements).toEqual([]);
  });

  it('SAYS SO when the judge read the evidence the ranking rests on differently from the model', async () => {
    const answer = await ask(scriptedHotspotModel(), { judge: scriptedJudge('noise', 0.77) });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.verdicts[0]).toMatchObject({ judge: 'noise', model: 'fact' });
    expect(answer.disagreements).toEqual([
      'the model declared the "read_evidence" result fact and the judge read it as noise (confidence 0.77) — the two sources disagree, both readings are on the record, and nothing here resolves them',
    ]);
    // AND THE RANKING IS STILL THERE. That is the point: a disagreement is a
    // fact of the record, not a veto — the answer stands and the verdict stands
    // beside it, resolved by nobody.
    expect(answer.picks.length).toBeGreaterThan(0);
  });

  it('records a judge that produced no verdict as an absent judgment with a reason, never a guessed standing', async () => {
    const broken = mockClassifier(() => {
      throw new Error('the judge was unreachable');
    });
    const answer = await ask(scriptedHotspotModel(), { judge: { classifier: broken, said: 'a judge that failed', weaker: true } });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.verdicts[0]).toMatchObject({ judge: 'no verdict', failed: 'the judge was unreachable' });
    expect(answer.disagreements[0]).toContain('produced no verdict: the judge was unreachable');
    expect(answer.disagreements[0]).toContain('never a guessed one');
  });

  it('the provider-backed judge declares itself THE WEAKER of the two, in words and in a boolean', () => {
    const judge = providerJudge(answering('{"choice":"fact","confidence":0.5,"probabilities":{"fact":0.5}}'));
    expect(judge.weaker).toBe(true);
    expect(judge.said).toContain('SAME family of model that answered');
    expect(judge.classifier.name).toBe('provider-standing');
  });

  it('the provider-backed judge refuses an answer outside the vocabulary rather than recording a verdict nobody produced', async () => {
    const judge = providerJudge(answering('I think it is probably fine, honestly'));
    await expect(judge.classifier.classify({ state: {}, questions: { standing: { type: 'choice', instructions: 'judge', criteria: { fact: 'a', open: 'b' } } } })).rejects.toThrow('not one JSON object');
  });
});

// ── the failure doors, each its own sentence ─────────────────────────────────

describe('a reader always learns whether the stage did not run, ran and refused, or ran and answered', () => {
  it('no evidence at all — nothing is asked of a model', async () => {
    const answer = await askHotspots({ provider: throwing(new Error('this must never be called')), judge: scriptedJudge(), ledger: hotspotLedger(landedRun(), [row('A:12', { sasa: 1 })]) });
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.kind).toBe('no-evidence');
    expect(answer.sentence).toContain('stage 5 ran and had nothing to ask about');
    expect(answer.sentence).toContain('a ranking over no evidence would be a ranking of nothing');
  });

  it('a malformed answer — nothing is landed, because an answer nobody can read is not a ranking', async () => {
    const prose = await ask(answering('The hot spots are obviously Asp39 and Arg87.'));
    expect(prose.ok).toBe(false);
    if (!prose.ok) expect(prose.sentence).toContain('nothing in the reply parses as a JSON object');

    const wrongShape = await ask(answering('{"hotspots": ["A:57"]}'));
    expect(wrongShape.ok).toBe(false);
    if (wrongShape.ok) return;
    expect(wrongShape.kind).toBe('malformed');
    expect(wrongShape.sentence).toContain('it parses, and carries no "ranked" array');
  });

  it('unreachable, timed out, refused and threw are four different sentences', async () => {
    const unreachable = await ask(throwing(new Error('fetch failed')));
    expect(unreachable.ok === false && unreachable.kind).toBe('unreachable');
    expect(unreachable.ok === false && unreachable.sentence).toContain('this is the network, not a refusal');

    const timedOut = await ask(throwing(Object.assign(new Error('the request was aborted'), { name: 'TimeoutError' })));
    expect(timedOut.ok === false && timedOut.kind).toBe('timeout');
    expect(timedOut.ok === false && timedOut.sentence).toContain('ran and timed out');

    const refused = await ask(throwing(new Error('Anthropic 401: invalid x-api-key')));
    expect(refused.ok === false && refused.kind).toBe('refused');
    expect(refused.ok === false && refused.sentence).toContain('it declined, which is a different fact from a network that dropped it');

    const threw = await ask(throwing(new Error('something nobody has a category for')));
    expect(threw.ok === false && threw.kind).toBe('threw');
    expect(threw.ok === false && threw.sentence).toContain('rather than a category this desk invented for it');
  });

  it('a stage that never got asked at all has its own sentence, and it is NOT the static-build one', () => {
    expect(NO_KEY_SENTENCE).toContain('ANTHROPIC_API_KEY');
    expect(NO_KEY_SENTENCE).toContain('That is NOT this build\'s static-page limit');
    expect(NO_KEY_SENTENCE).toContain('there is simply nothing to ask');
  });

  it('the whole ask times out rather than hanging, and says the late answer is dropped', async () => {
    // A PROVIDER OF THIS TEST'S OWN, because `mock`'s script is synchronous and
    // a call that never comes back is exactly what a timeout is about. It is
    // still the port and nothing else: one name, one `complete`.
    const never: LLMProvider = { name: 'never-answers', complete: () => new Promise(() => undefined) };
    const answer = await ask(never, { timeoutMs: 40 });
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.kind).toBe('timeout');
    expect(answer.sentence).toContain('the answer, if one arrives now, is dropped rather than landed late');
  });
});

// ── the commit ───────────────────────────────────────────────────────────────

describe('the ranking lands as a commit, with its citations, on the table every other stage writes to', () => {
  it('lands three columns on the residues table and carries the fact ids in the data', async () => {
    const slot = hotspotSlot();
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, evidence, slot);
    const before = await residuesAt(surface.session, surface.tables);
    const ledger = hotspotLedger(surface.run, before.rows);
    // the evidence really is the run's own: 18 of 185 residues carry a value in
    // the column the interaction act lands absent for a residue that touches no
    // other chain
    expect(ledger.residues).toHaveLength(surface.tables.residues.length);
    expect(new Set(ledger.facts.map((f) => f.residue)).size).toBeGreaterThan(0);

    const answer = await askHotspots({ provider: scriptedHotspotModel({ want: 2 }), judge: scriptedJudge(), model: 'a-test-model', ledger });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    const outcome = await landHotspots(surface, answer);
    expect(outcome.refusal).toBe(null);
    expect(outcome.commit).not.toBe(null);
    expect(outcome.stage).toBe('hotspots');
    expect(outcome.act).toBe(HOTSPOTS_ACT);
    expect([...outcome.materialized].sort()).toEqual([HOTSPOT_CITES_COLUMN, HOTSPOT_RANK_COLUMN, HOTSPOT_REASON_COLUMN].sort());

    const after = await residuesAt(surface.session, surface.tables);
    expect(after.refused).toBe(null);
    const ranked = after.rows.filter((r) => r[HOTSPOT_RANK_COLUMN] !== null && r[HOTSPOT_RANK_COLUMN] !== undefined);
    expect(ranked.map((r) => r[RESIDUE_KEY])).toEqual(answer.picks.map((p) => p.residue));
    // THE CITATION IS IN THE DATA, beside the value — the `conservation_basis`
    // precedent: a rank whose fact ids were only ever on a card would be a
    // number a reader could quote with nothing behind it
    expect(String(ranked[0]![HOTSPOT_CITES_COLUMN])).toBe(answer.picks[0]!.cites.join(' '));
    expect(String(ranked[0]![HOTSPOT_REASON_COLUMN])).toBe(answer.picks[0]!.reason);
    // and the rank is ABSENT for every residue the model did not name — never 0, never last
    expect(after.rows.filter((r) => r[HOTSPOT_RANK_COLUMN] === 0)).toEqual([]);

    /*
      THE PREDICTION IS WHAT IS FROZEN, AND ONLY THE PREDICTION.

      The judge's verdicts came back WITH the answer and reach no column: what
      landed is the ranking and the ids it cited, which is the claim, and the
      second source's reading of the same evidence is recorded BESIDE the act
      (`HotspotAnswered.verdicts`, shown on the card). A commit that also
      carried its own check would be a prediction revised by the check — and a
      prediction that can be revised after the outcome is not a prediction.
    */
    expect(answer.verdicts.length).toBeGreaterThan(0);
    const landedValues = JSON.stringify(ranked);
    for (const verdict of answer.verdicts) {
      expect(landedValues).not.toContain(verdict.by);
      expect(landedValues).not.toContain(`"${verdict.judge}"`);
    }
  });

  it('a surface with no slot REFUSES the landing, which is the honest state of every static build', async () => {
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, evidence);
    const answer: HotspotAnswered = { ok: true, model: 'a-test-model', picks: [{ residue: 'A:57', rank: 1, reason: 'x', cites: ['f1'] }], refused: [], verdicts: [], disagreements: [], served: 1 };
    const outcome = await landHotspots(surface, answer);
    expect(outcome.commit).toBe(null);
    expect(outcome.refusal).toContain('was never declared on this surface');
    expect(outcome.refusal).toContain('every build that cannot ask a model does');
  });

  it('the act says out loud that it is a recommendation', () => {
    expect(HOTSPOT_TAG).toBe('a recommendation, not a measurement');
  });
});

// ── the key ──────────────────────────────────────────────────────────────────

/**
 * THE HONESTY TEST ABOUT THE KEY, on this side of the wire: nothing in this
 * module reads an environment variable, and nothing it produces could carry a
 * secret because it never receives one. `tests/prot-doors.test.ts` makes the
 * same assertion about the door, which is the one place that does read it.
 */
describe('no key reaches anything this stage produces', () => {
  it('the module names no environment variable at all — the provider and the judge are handed in', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/prot/hotspots.ts', import.meta.url), 'utf8'));
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('import.meta.env');
    // it NAMES the variable in the sentence a reader sees, which is the
    // variable's name and not anybody's key — and it never reads one
    expect(source.split('ANTHROPIC_API_KEY').length - 1).toBe(1);
    expect(source).toContain('NO_KEY_SENTENCE');
  });

  it('an ask made with a secret-carrying provider leaks nothing into the answer, the refusals or the verdicts', async () => {
    const SECRET = 'sk-ant-not-a-real-key-000111222';
    // the provider is the only thing holding it, exactly as `liveProvider` is on
    // the NNDSS desk — and what comes back is searched for it, byte for byte
    const holder = mock({ name: 'holder', respond: () => JSON.stringify({ ranked: [{ residue: 'A:57', reason: `keyed with ${SECRET.slice(0, 3)}`, cites: ['f1'] }] }) });
    const answer = await ask(holder);
    expect(JSON.stringify(answer)).not.toContain(SECRET);
  });
});

/** The ledger facts a test reads for their ids, typed so a refactor of the shape fails here. */
export type { LedgerFact };
