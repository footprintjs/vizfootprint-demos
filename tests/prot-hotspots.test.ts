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
import { INTERFACE_VIEW, RAMA_VIEW, RESIDUES_TABLE, RESIDUE_KEY } from '../src/prot/def.js';
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
  coverVerdict,
  hotspotLedger,
  landedThrough,
  notTheEndOfTheRun,
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
import { createSessionView, sessionSource } from 'vizfootprint-ui';
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
  annotation: null,
});

/**
 * TWO RESIDUES AT THE INTERFACE IN A TABLE OF EIGHT — and the shape matters,
 * because it is the shape the real columns have.
 *
 * `interface_contacts` is a real ZERO for a residue that touches no other chain
 * (`src/prot/interactions.ts` · `residueContactColumns` lands it `?? 0`), and
 * `interface_separation` is the one landed ABSENT. So every row here carries a
 * count and only two carry a distance — which is exactly what made the cover
 * rule wrong for a release, and is what these fixtures now pin.
 *
 * Two of eight is a proper minority, so it is a cover (`coverVerdict`). A
 * fixture of two-in-three would not be, and it is worth knowing that the guard
 * bit these very rows the moment it was written.
 */
const ROWS: readonly Row[] = [
  row('A:57', { contacts: 14, interface_contacts: 4, interface_separation: 2.81, sasa: 18.4, relative_sasa: 0.12, conservation: 0.94, conservation_basis: 'PF00545.26, 283 sequences' }),
  row('B:35', { contacts: 9, interface_contacts: 3, interface_separation: 3.02, sasa: 41.2, relative_sasa: null, conservation: 0.71, conservation_basis: 'PF01337.25, 69 sequences' }),
  row('A:12', { contacts: 5, interface_contacts: 0, sasa: 88.1, relative_sasa: 0.6, conservation: 0.4, conservation_basis: 'PF00545.26, 283 sequences' }),
  row('A:13', { contacts: 4, interface_contacts: 0, sasa: 71.0, relative_sasa: 0.5 }),
  row('A:14', { contacts: 6, interface_contacts: 0, sasa: 52.3, relative_sasa: 0.4 }),
  row('B:70', { contacts: 3, interface_contacts: 0, sasa: 33.8, relative_sasa: 0.3 }),
  row('B:71', { contacts: 2, interface_contacts: 0, sasa: 12.1, relative_sasa: 0.1 }),
  row('B:72', { contacts: 0, interface_contacts: 0, sasa: 0, relative_sasa: 0 }),
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
    expect(ledger.residues).toHaveLength(8);
    expect(ledger.cover).toBe('covers');
    expect(ledger.covered).toBe(2);
    expect(ledger.basis).toContain('the interaction act\'s own absence vocabulary and not a threshold anybody picked');
    expect(ledger.basis).toContain('2 residues of 8');
  });

  /**
   * THE BUG THAT SHIPPED FOR ONE RELEASE, pinned at the root.
   *
   * The cover read `interface_contacts`, which `residueContactColumns` lands
   * `?? 0` — so it has NO ABSENCE, every row carried a value, and the ledger
   * covered the whole table: measured on the committed entry, 185 of 185 and
   * 717 facts served to a model that then answered prose. The column whose
   * absence the ACT declares is `interface_separation`.
   */
  it('reads the column that is landed ABSENT, never the count that is landed zero', () => {
    const counts = ROWS.filter((r) => typeof r['interface_contacts'] === 'number');
    const distances = ROWS.filter((r) => typeof r['interface_separation'] === 'number');
    // every row has a count; only the interface rows have a distance
    expect(counts).toHaveLength(8);
    expect(distances).toHaveLength(2);
    // and the ledger follows the distance
    expect(new Set(hotspotLedger(landedRun(), ROWS).facts.map((f) => f.residue)).size).toBe(distances.length);
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
    const ledger = hotspotLedger(landedRun(), [row('A:12', { sasa: 88.1 }), row('A:13', { sasa: 71 })]);
    expect(ledger.facts).toEqual([]);
    expect(ledger.cover).toBe('nothing');
    expect(ledger.basis).toContain('no residue at this cursor carries an "interface_separation" value');
    expect(ledger.basis).toContain('absent — never zero — for a residue with no contact across the chains');
  });

  /**
   * A COVER THAT IS NOT A MINORITY IS NOT A COVER — the guard the 717-fact ask
   * did not have, and it answers with the counts rather than a bigger ask.
   */
  it('REFUSES a selection of half the table or more, and serves no facts at all', () => {
    // every row at the interface: the shape a rule that did not discriminate
    // produces, and the shape the real bug produced at 185 of 185
    const everything = ROWS.map((r) => ({ ...r, interface_separation: 2.5 }));
    const ledger = hotspotLedger(landedRun(), everything);
    expect(ledger.cover).toBe('not-a-cover');
    expect(ledger.covered).toBe(8);
    // AND THE FACTS ARE NOT EVEN BUILT: a pile nobody can answer is not carried
    expect(ledger.facts).toEqual([]);
    expect(ledger.from).toEqual([]);
    expect(ledger.basis).toContain('the cover rule selected 8 of this run\'s 8 residues, and that is not a cover');
    expect(ledger.basis).toContain('did not tell the two apart');
  });

  it('the minority boundary is the definition of a minority, and nothing anybody picked', () => {
    expect(coverVerdict(0, 10)).toBe('nothing');
    expect(coverVerdict(4, 10)).toBe('covers');
    // exactly half is NOT a minority
    expect(coverVerdict(5, 10)).toBe('not-a-cover');
    expect(coverVerdict(10, 10)).toBe('not-a-cover');
    // the committed entry's real shape, and it clears the boundary with room
    expect(coverVerdict(18, 185)).toBe('covers');
    expect(coverVerdict(0, 0)).toBe('nothing');
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

  /**
   * ONE CORRECTIVE RE-ASK, AND WHY IT IS NOT A RE-ROLL.
   *
   * The shape is DECLARED (`HOTSPOT_ANSWER_SCHEMA`), so the library judges the
   * answer in the loop and quotes its own validator's failure back to the
   * model. That is a correction. It was worth buying once a measurement showed
   * the prose answer happened on EVERY run rather than rarely — and the
   * sentence still counts the attempts, so a model that cannot read the
   * contract is reported rather than bought past.
   */
  it('recovers when the model answers prose once and the shape on the re-ask', async () => {
    let answers = 0;
    const slips = mock({
      name: 'slips-once',
      respond: (request) => {
        const done = request.messages.filter((m) => m.role === 'tool').length;
        if (done === 0) return { content: '', toolCalls: [{ id: 'h0', name: EVIDENCE_TOOL, args: {} }], stopReason: 'tool_use' };
        answers += 1;
        if (answers === 1) return 'The hot spots are obviously A:57 and B:35.';
        return JSON.stringify({ ranked: [{ residue: 'A:57', reason: 'corrected on the re-ask', cites: ['f1'] }] });
      },
    });
    const answer = await ask(slips);
    expect(answers).toBe(2);
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.picks).toEqual([{ residue: 'A:57', rank: 1, reason: 'corrected on the re-ask', cites: ['f1'] }]);
  });

  it('a malformed answer reports how many times the model was asked, in the library’s own words', async () => {
    const prose = await ask(answering('The hot spots are obviously Asp39 and Arg87.'));
    expect(prose.ok).toBe(false);
    if (prose.ok) return;
    // TWO answers judged and ONE re-ask paid for: a model asked twice with its
    // own failure quoted back, which is a different fact from one asked once
    expect(prose.sentence).toContain('The library judged 2 answers against the declared shape and paid for 1 corrective re-ask');
    expect(prose.sentence).toContain("its own validator said: ");
    expect(prose.sentence).toContain('an answer nobody can read is not a ranking');
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

// ── which cursor stage 5 is about ────────────────────────────────────────────

/**
 * THE DECISION, ASSERTED: stage 5 is about the END OF THE RUN, and a read from
 * anywhere else is refused rather than folded into a ledger.
 *
 * Every other picture on this desk is drawn at the cursor. This stage cannot
 * be, because of what it IS — a reading of what stages 1 to 4 landed — and a
 * subset of those stages is not that. So the guard refuses, no model is asked,
 * and the card declares which cursor its answer came from instead of being
 * taken for a picture of wherever the reader is standing.
 */
describe('stage 5 reads the end of the run, and refuses any other cursor', () => {
  it('says nothing when the rows really are the last commit the stages landed', () => {
    expect(landedThrough(landedRun())).toBe('c3');
    expect(notTheEndOfTheRun(landedRun(), 'c3')).toBe(null);
  });

  it('refuses a read taken behind the stages, and names both commits', () => {
    const said = notTheEndOfTheRun(landedRun(), 'c1')!;
    expect(said).toContain('the rows it was handed were read at commit c1 while those stages landed through commit c3');
    expect(said).toContain('a ranking folded from part of the evidence would answer a question nobody asked');
  });

  it('refuses a read at the root of the log by name', () => {
    expect(notTheEndOfTheRun(landedRun(), null)).toContain('read at the root of this log');
  });

  it('refuses a run that landed nothing at all', () => {
    expect(landedThrough(null)).toBe(null);
    expect(notTheEndOfTheRun(null, null)).toContain('this run landed no commit at all');
  });

  it('ignores an act that landed no commit when it asks what the end is', () => {
    const run = landedRun();
    const partial: ProtRun = { ...run, outcomes: [...run.outcomes, { stage: 'surface', act: SURFACE_ACT, commit: null, refusal: 'refused', materialized: [] }] };
    // the END is the last commit, not the last outcome
    expect(landedThrough(partial)).toBe('c3');
  });

  it('the ledger carries the cursor its rows were read at, and never invents one', () => {
    expect(hotspotLedger(landedRun(), ROWS, 'c3').at).toBe('c3');
    expect(hotspotLedger(landedRun(), ROWS).at).toBe(null);
  });
});

// ── the commit ───────────────────────────────────────────────────────────────

describe('the ranking lands as a commit, with its citations, on the table every other stage writes to', () => {
  it('lands three columns on the residues table and carries the fact ids in the data', async () => {
    const slot = hotspotSlot();
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, evidence, slot);
    const before = await residuesAt(surface.session, surface.tables);
    const ledger = hotspotLedger(surface.run, before.rows, before.cursor);
    // the evidence really is the run's own: 18 of 185 residues carry a value in
    // the column the interaction act lands absent for a residue that touches no
    // other chain
    expect(ledger.residues).toHaveLength(surface.tables.residues.length);
    /*
      THE REAL SHAPE, MEASURED ON THE COMMITTED ENTRY — and this is the
      assertion the 717-fact bug would have failed.

      18 of 185 residues carry an `interface_separation`, which is the column
      the act lands ABSENT for a residue with no contact across the chains. All
      185 carry an `interface_contacts` COUNT, 167 of them zero — so a cover
      read off the count covers everything, which is what shipped for a release.
      The two rules AGREE at 18, and pinning that here is what makes a drift
      between the two columns fail a test rather than quietly move the cover.
    */
    const withDistance = before.rows.filter((r) => typeof r['interface_separation'] === 'number');
    const withCrossing = before.rows.filter((r) => typeof r['interface_contacts'] === 'number' && (r['interface_contacts'] as number) > 0);
    const withAnyCount = before.rows.filter((r) => typeof r['interface_contacts'] === 'number');
    expect(withDistance).toHaveLength(18);
    expect(withCrossing).toHaveLength(18);
    expect(withAnyCount).toHaveLength(185);
    expect(ledger.cover).toBe('covers');
    expect(ledger.covered).toBe(18);
    expect(new Set(ledger.facts.map((f) => f.residue)).size).toBe(18);
    // 18 parse + 18 contacts + 18 surface + 17 conservation (one has no column)
    expect(ledger.facts).toHaveLength(71);
    // and the cursor the rows came from IS the end of the run
    expect(notTheEndOfTheRun(surface.run, before.cursor)).toBe(null);

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

// ── the payoff ───────────────────────────────────────────────────────────────

/**
 * THE MODEL'S PICKS REACH THE CROSSFILTER — the reason the columns land on
 * `residues` at all, and the law a REAL BROWSER had to teach.
 *
 * The first version dispatched straight on the session. The act landed, the log
 * grew, and **not one picture moved** — 185 dots stayed 185 and no pane said a
 * clause had reached it. Every gesture on this desk goes through the SESSION
 * VIEW (`web/src/protCells.tsx` · `emit`), which is the one cursor the charts
 * are folded at; a dispatch beside it is the second cursor this page spends a
 * memo to avoid. Measured after the fix, in a real browser at 1440×900: the
 * surface run 185 → 6 marks, the conservation run 162 → 6, the Ramachandran
 * dimming 175 of 181, and every pane carrying its own narrowing sentence.
 *
 * What is asserted here is the half that needs no browser: the emission is
 * ACCEPTED at the view the picks are made at, and another view's window
 * narrows to exactly the residues the model named.
 */
describe('the picks narrow the desk, through the machinery that was already there', () => {
  it('a MATCH at the interface view narrows every other pane to exactly those residues', async () => {
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, evidence, hotspotSlot());
    const view = createSessionView(sessionSource(surface.session), { as: 'user' });
    const picks = ['A:40', 'B:39', 'A:85'];
    /*
      A MATCH AND NOT THREE POINTS: the emission carries the list and its
      polarity as one `MatchValue`, which is what *a set is a point's plural,
      never a new capability* means on the wire. `interface` declares `point`,
      and the library's law is that a view declaring only point accepts a match.
    */
    await view.emit(INTERFACE_VIEW, { rawValue: { values: picks }, encoding: { kind: 'match', field: RESIDUE_KEY } }, 'keep the residues a model ranked as hot spots');
    // ANOTHER VIEW'S EYES — the question is whether the clause REACHED the rest
    // of the desk, which is what "the crossfilter connects them" means
    const elsewhere = await surface.session.viewQuery({ table: RESIDUES_TABLE, viewId: RAMA_VIEW, limit: 500 });
    expect(elsewhere.ok).toBe(true);
    if (!elsewhere.ok) return;
    expect(elsewhere.rows.map((r) => String(r[RESIDUE_KEY])).sort()).toEqual([...picks].sort());
  });

  /**
   * AND THE PAGE EMITS THROUGH THE VIEW — asserted on the source, the
   * `tests/prot-site.test.ts` precedent, because the alternative failed
   * SILENTLY: a session dispatch is accepted, lands a commit and moves nothing.
   */
  it('the served page makes this gesture through the view and never beside it', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('../web/src/protServed.tsx', import.meta.url), 'utf8'));
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toContain('view\n        .emit(');
    expect(code).not.toContain('session.dispatch');
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
