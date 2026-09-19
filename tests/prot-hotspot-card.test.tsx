// @vitest-environment jsdom
/**
 * STAGE 5 ON THE SCREEN — and the two things that have to be true at once.
 *
 * 1. **THE PUBLISHED BUILD IS UNCHANGED.** With no answer in hand the rail
 *    carries the card the plan declares, word for word, the stepper's mark
 *    still says *not on this build*, and the whole measured reason is still
 *    behind its `Full note`. Nothing in this packet may make the Pages build
 *    claim otherwise, and the assertions here are what stop it.
 * 2. **WITH AN ANSWER, THE SAME SLOT CARRIES WHAT A MODEL SAID** — visibly a
 *    recommendation, every row with the fact ids it cited, every refusal
 *    verbatim and by name, and the judge's disagreement on the screen rather
 *    than folded away.
 *
 * And the third state, which is the one the door exists to make possible: a
 * process that HAS a server and no key shows stage 5 as unavailable for THAT
 * reason and not for the static build's.
 *
 * Nothing here asks a model. The answers are the shapes `askHotspots` really
 * produces (`tests/prot-hotspots.test.ts` runs the real thing on the `mock`
 * provider and pins them).
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { BLOCKED_TAG, PROT_BLOCKED, planStepOf } from '../src/prot/plan.js';
import { HOTSPOTS_ACT, HOTSPOTS_STAGE, HOTSPOT_TAG, NO_KEY_SENTENCE, REFUSE_NOT_IN_TABLE, type HotspotOutcome } from '../src/prot/hotspots.js';
import type { ActOutcome } from '../src/prot/orchestrator.js';
import { stepperStages } from '../web/src/protStages.js';
import { BLOCKED_CARDS, firstClause, hotspotCard, railCards, rankingVsCursor, recommendationOf } from '../web/src/workbench/panel.js';
import { BlockedGroup, Recommendation } from '../web/src/workbench/ChartCard.js';
import { stepViews } from '../web/src/workbench/steps.js';

/** One element, rendered — the same helper `tests/prot-cards.test.tsx` uses, for the same reason. */
async function mount(element: ReactElement): Promise<{ readonly words: () => string; readonly press: (label: string) => Promise<void>; readonly unmount: () => Promise<void> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    words: () => (host.textContent ?? '').replace(/\s+/g, ' '),
    press: async (label) => {
      const found = ([...host.querySelectorAll('button')] as HTMLElement[]).find((el) => (el.textContent ?? '').includes(label));
      if (found === undefined) throw new Error(`no control says "${label}" — the card says: ${(host.textContent ?? '').slice(0, 400)}`);
      await act(async () => {
        found.click();
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

// ── the answers, in the shapes the stage really produces ─────────────────────

const ANSWERED: HotspotOutcome = {
  ok: true,
  model: 'claude-sonnet-5',
  picks: [
    { residue: 'A:57', rank: 1, reason: 'Buried at the interface, in four contacts across it and the most conserved column of its family.', cites: ['f2', 'f3', 'f4'] },
    { residue: 'B:35', rank: 2, reason: 'Three crossing contacts and a tight closest approach, and its column is well agreed on.', cites: ['f6', 'f8'] },
  ],
  refused: [REFUSE_NOT_IN_TABLE('Z:999')],
  verdicts: [{ of: 'read_evidence', judge: 'noise', model: 'fact', confidence: 0.77, by: 'provider-standing · claude-sonnet-5' }],
  disagreements: ['the model declared the "read_evidence" result fact and the judge read it as noise (confidence 0.77) — the two sources disagree, both readings are on the record, and nothing here resolves them'],
  served: 68,
};

const NO_KEY: HotspotOutcome = { ok: false, kind: 'no-key', sentence: NO_KEY_SENTENCE, verdicts: [] };

const JUDGE_SAID = 'scored by a standing judge running on the SAME family of model that answered — the weaker of the two';

/**
 * WHAT THE PAGE HANDS THE FOLD — and the two commits are part of it, because
 * stage 5's answer has to say which cursor it is about: it is asked once, from
 * the rows at the end of the run (`src/prot/hotspots.ts` · `notTheEndOfTheRun`).
 */
const SAID = { outcome: ANSWERED, judge: JUDGE_SAID, at: 's4', landed: 's5' } as const;
const NO_KEY_SAID = { outcome: NO_KEY, judge: 'no second source read anything', at: 's4', landed: null } as const;

const landed = (): ActOutcome => ({ stage: HOTSPOTS_STAGE, act: HOTSPOTS_ACT, commit: 'c9', refusal: null, materialized: ['hotspot_rank', 'hotspot_cites', 'hotspot_reason'] });
const refused = (why: string): ActOutcome => ({ stage: HOTSPOTS_STAGE, act: HOTSPOTS_ACT, commit: null, refusal: why, materialized: [] });

// ── 1. the published build is unchanged ──────────────────────────────────────

describe('the Pages build still declares stage 5 unavailable, for the static-build reason', () => {
  it('the plan is untouched: stage 5 is blocked by THIS BUILD, with the key sentence and the promise a server keeps', () => {
    const step = planStepOf(HOTSPOTS_STAGE)!;
    expect(step.blockedBy).toBe('this build');
    expect(step.why).toContain('a static page cannot hold the key that would call one');
    expect(step.why).toContain('A build with a server behind it performs this stage.');
    expect(PROT_BLOCKED.find((s) => s.stage === HOTSPOTS_STAGE)!.tag).toBe(BLOCKED_TAG['this build']);
  });

  it('with no answer in hand the rail carries the blocked card, byte for byte', () => {
    // NOT "equivalent": the same array the page has always drawn
    expect(railCards(null)).toBe(BLOCKED_CARDS);
    const card = BLOCKED_CARDS.find((c) => c.id === HOTSPOTS_STAGE)!;
    expect(card.tag).toBe('not on this build');
    expect(card.recommendation).toBeUndefined();
    expect(card.blockedBy).toBe('this build');
  });

  it('and the stepper’s mark still says so, and still carries the whole reason', () => {
    const stages = stepperStages([], null);
    const five = stages.find((s) => s.stage === HOTSPOTS_STAGE)!;
    expect(five.state).toBe('blocked');
    expect(five.blockedBy).toBe('this build');
    expect(five.detail).toContain('a static page cannot hold the key');
    expect(stepViews(stages, five, true)[4]!.tag).toBe('not on this build');
  });

  it('the blocked card renders its reason’s first clause and nothing about a model', async () => {
    const card = BLOCKED_CARDS.find((c) => c.id === HOTSPOTS_STAGE)!;
    const panel = await mount(<BlockedGroup label="the declared steps this build will not run" rows={[{ id: card.id, name: card.name, tag: card.tag, short: card.short, promote: { label: 'open it', onPress: () => undefined } }]} />);
    expect(panel.words()).toContain('declared · will not run here');
    expect(panel.words()).toContain('not on this build');
    expect(panel.words()).not.toContain('recommendation');
    await panel.unmount();
  });
});

// ── 2. with an answer, the same slot carries what a model said ───────────────

describe('a model’s ranking is shown as a recommendation, with its citations', () => {
  it('replaces stage 5’s blocked card and keeps every other one', () => {
    const cards = railCards(SAID);
    expect(cards).toHaveLength(BLOCKED_CARDS.length);
    const five = cards.find((c) => c.id === HOTSPOTS_STAGE)!;
    expect(five.tag).toBe(HOTSPOT_TAG);
    expect(five.blockedBy).toBe(null);
    expect(five.recommendation?.rows.map((r) => r.residue)).toEqual(['A:57', 'B:35']);
    // the OTHER blocked step is untouched — one card replaced, not the list rewritten
    expect(cards.find((c) => c.id === 'annotation')).toBe(BLOCKED_CARDS.find((c) => c.id === 'annotation'));
  });

  it('folds one line of figures out of the answer and never composes a number', () => {
    const view = recommendationOf(SAID);
    expect(view.figures).toBe('2 residues ranked · 68 facts served · 1 refused · 1 judge disagreement');
    expect(view.said).toBe(null);
    expect(view.model).toBe('claude-sonnet-5');
  });

  it('SAYS IT IS A RECOMMENDATION, shows every cited id, and offers the picks to the crossfilter', async () => {
    const view = recommendationOf(SAID);
    let selected: readonly string[] | null = null;
    const panel = await mount(<Recommendation {...view} focused select={{ label: 'select these 2 residues across the desk', onPress: () => void (selected = view.rows.map((r) => r.residue)) }} />);
    const words = panel.words();
    expect(words).toContain('a recommendation, not a measurement');
    // EVERY ROW WITH ITS CITATIONS — a rank with nothing behind it cannot be drawn
    expect(words).toContain('cites f2 f3 f4');
    expect(words).toContain('cites f6 f8');
    expect(words).toContain('A:57');
    expect(words).toContain('Buried at the interface');
    // and the press hands the page the residues off the answer, never a literal
    await panel.press('select these 2 residues');
    expect(selected).toEqual(['A:57', 'B:35']);
    await panel.unmount();
  });

  it('shows the refusal VERBATIM AND BY NAME, with the name the model gave', async () => {
    const view = recommendationOf(SAID);
    const panel = await mount(<Recommendation {...view} focused />);
    expect(panel.words()).toContain('the model named "Z:999" and this run\'s residue table has no row for it');
    expect(panel.words()).toContain('refused by name');
    await panel.unmount();
  });

  it('SHOWS THE JUDGE’S DISAGREEMENT rather than smoothing it over — and keeps the ranking', async () => {
    const view = recommendationOf(SAID);
    const panel = await mount(<Recommendation {...view} focused />);
    const words = panel.words();
    expect(words).toContain('the model declared the "read_evidence" result fact and the judge read it as noise');
    expect(words).toContain('nothing here resolves them');
    // the ranking is STILL THERE: a disagreement is a fact of the record, not a veto
    expect(words).toContain('A:57');
    await panel.unmount();
  });

  it('puts the same disagreement, the refusal and the judge into the card’s own note', () => {
    const card = hotspotCard({ name: 'Hot Spot Prediction', label: 'Which residues a model would call hot' }, SAID);
    expect(card.why).toContain('IT DID NOT AGREE WITH THE MODEL, and both readings are on the record');
    expect(card.why).toContain(REFUSE_NOT_IN_TABLE('Z:999'));
    expect(card.why).toContain('The model asked was claude-sonnet-5.');
    expect(card.why).toContain('never computed a second time for its benefit');
  });

  it('and the stepper stops calling the step blocked, because something performed it', () => {
    const stages = stepperStages([landed()], null);
    const five = stages.find((s) => s.stage === HOTSPOTS_STAGE)!;
    expect(five.state).toBe('landed');
    expect(five.blockedBy).toBe(null);
    expect(five.commit).toBe('c9');
    expect(five.subtitle).toContain('landed 3 columns on the residues table — hotspot_rank, hotspot_cites, hotspot_reason');
    // the mark is no longer the blocked family's
    expect(stepViews(stages, five, true)[4]!.tag).not.toBe('not on this build');
    /*
      AND THE PLAN IS STILL THE PLAN. This used to name step 6, which was the
      OTHER blocked step; step 6 was then built and is blocked by nobody, so
      what is asserted now is the property rather than a second blocked step
      that no longer exists: performing step 5 changes the mark of step 5 and of
      no other column.
    */
    expect(stages.filter((s) => s.blockedBy !== null)).toEqual([]);
    expect(stages.find((s) => s.stage === 'annotation')!.blockedBy).toBe(null);
  });
});

// ── the card declares which cursor its answer is about ──────────────────────

/**
 * STAGE 5 IS THE ONE CARD ON THIS DESK THAT IS NOT DRAWN AT THE CURSOR, and
 * the resolution is that it SAYS SO rather than pretending otherwise.
 *
 * It is asked once, from the rows at the end of the run, because that is what
 * the stage reads (`src/prot/hotspots.ts` · `notTheEndOfTheRun`). So the card
 * carries both commits — the one its evidence came from and the one the ranking
 * landed as — and when a reader steps behind the second one it says the rows
 * underneath carry no rank at all.
 */
describe('the card says which cursor its answer is about', () => {
  it('names both commits: where the evidence was read and where the ranking landed', async () => {
    const view = recommendationOf(SAID);
    expect(view.where).toBe('asked once, from the rows at commit s4 — the end of what stages 1 to 4 landed — and the ranking landed as commit s5');
    const panel = await mount(<Recommendation {...view} focused />);
    expect(panel.words()).toContain('asked once, from the rows at commit s4');
    expect(panel.words()).toContain('the ranking landed as commit s5');
    await panel.unmount();
  });

  it('says an absent commit rather than leaving it blank', () => {
    expect(recommendationOf({ ...SAID, at: null, landed: null }).where).toBe('asked once, from the rows at the root of this log — the end of what stages 1 to 4 landed — and the ranking landed no commit of its own');
  });

  it('SAYS the rows carry no rank when the reader has stepped behind the ranking', async () => {
    const path = ['s1', 's2', 's3', 's4', 's5'];
    // at or after: nothing to say, and an absence is absent
    expect(rankingVsCursor('s5', path, 's5')).toBe(null);
    // behind it: the rows really do not carry a rank there
    const said = rankingVsCursor('s5', path, 's3')!;
    expect(said).toContain('The cursor is standing behind commit s5, which is where this ranking landed');
    expect(said).toContain('the rows on this desk carry no rank at all');
    const panel = await mount(<Recommendation {...recommendationOf(SAID)} focused behind={said} />);
    expect(panel.words()).toContain('the rows on this desk carry no rank at all');
    // and the answer is STILL shown, as the answer it was given
    expect(panel.words()).toContain('A:57');
    await panel.unmount();
  });

  it('says nothing about a cursor it cannot place, and nothing about a ranking that landed nothing', () => {
    // a fork: this page draws no branch map, so it does not guess
    expect(rankingVsCursor('s5', ['s1', 's5'], 'elsewhere')).toBe(null);
    expect(rankingVsCursor(null, ['s1'], 's1')).toBe(null);
    expect(rankingVsCursor('s5', ['s1'], null)).toBe(null);
  });

  it('a failure has no basis line, because there is no answer for one to be about', () => {
    expect(recommendationOf(NO_KEY_SAID).where).toBe(null);
  });
});

// ── 3. a server, and no key ──────────────────────────────────────────────────

describe('no key ⇒ the desk shows stage 5 unavailable for THAT reason, not the static build’s', () => {
  it('the card carries the door’s sentence where its ranking would be', async () => {
    const view = recommendationOf(NO_KEY_SAID);
    expect(view.rows).toEqual([]);
    expect(view.said).toBe(NO_KEY_SENTENCE);
    const card = railCards(NO_KEY_SAID).find((c) => c.id === HOTSPOTS_STAGE)!;
    // THE RAIL'S ONE LINE is the sentence's first clause, cut at a punctuation
    // boundary the way every blocked card's is — and the WHOLE sentence is in
    // the card's own note, so the cut is never the only copy
    expect(card.short).toBe(firstClause(NO_KEY_SENTENCE));
    expect(card.short).toBe('stage 5 did not run because this process has no key to call a model with');
    expect(card.why).toContain(NO_KEY_SENTENCE);
    const panel = await mount(<Recommendation {...view} focused />);
    const words = panel.words();
    expect(words).toContain('ANTHROPIC_API_KEY');
    expect(words).toContain('That is NOT this build\'s static-page limit');
    // AND NOT THE OTHER REASON. This is the distinction the whole door exists
    // to make: a server is standing here and has nothing to ask.
    expect(words).not.toContain('a static page cannot hold the key');
    await panel.unmount();
  });

  it('the stepper says the step was refused, with that reason and not the build’s', () => {
    const stages = stepperStages([refused(NO_KEY_SENTENCE)], null);
    const five = stages.find((s) => s.stage === HOTSPOTS_STAGE)!;
    expect(five.state).toBe('refused');
    expect(five.blockedBy).toBe(null);
    expect(five.detail).toBe(NO_KEY_SENTENCE);
    expect(five.detail).not.toContain('a static page cannot hold the key');
  });

  it('a stage that ran and answered nothing still says which of the things happened', () => {
    for (const outcome of [
      { ok: false as const, kind: 'unreachable' as const, sentence: 'the model could not be reached from this process: fetch failed.', verdicts: [] },
      { ok: false as const, kind: 'malformed' as const, sentence: 'the model answered and the answer is not the one object stage 5 asked for.', verdicts: [] },
      { ok: false as const, kind: 'cites-nothing' as const, sentence: 'the model answered with 3 rankings and not one of them cited a fact id.', verdicts: [] },
    ]) {
      const view = recommendationOf({ outcome, judge: JUDGE_SAID, at: 's4', landed: null });
      expect(view.rows).toEqual([]);
      expect(view.said).toBe(outcome.sentence);
      // never an empty list with no words: the sentence IS what the card shows
      expect(view.figures).toBe('nothing ranked');
    }
  });
});
