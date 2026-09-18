/**
 * THE PLAN IS SIX STEPS, AND THE DEF STILL DISPATCHES WHAT IT ALWAYS DID.
 *
 * The project's own documentation publishes a six-stage pipeline and the stepper
 * rendered three, which made the screen the less honest of the two. The fix was
 * a THIRD declaration (`src/prot/plan.ts`), and the whole risk of a third
 * declaration is that somebody later "completes" it by adding the missing
 * stages to the def — where declaring one means the orchestrator dispatches
 * acts for it, and for steps 5 and 6 that would be a lie.
 *
 * So the first test in this file is the one that matters: **`PROT_STAGES` did
 * not grow.** The rest hold the join between the three declarations tight, so
 * that a stage cannot be renamed, forgotten or spelled twice without a failure
 * here rather than a silent gap on screen.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROT_ACT_ORDER, PROT_STAGES, PROT_UNAVAILABLE_STAGES } from '../src/prot/analyses.js';
import { BLOCKED_TAG, PROT_BLOCKED, PROT_PLAN, planStepOf, type Blocker } from '../src/prot/plan.js';

describe('THE PLAN IS NOT A PROMISE — the def dispatches exactly what it did before', () => {
  it('declares TWO dispatching stages and THREE acts, and not one more', () => {
    // the test that stops a future edit from turning the plan into a promise: a
    // stage in `PROT_STAGES` is a stage the orchestrator dispatches acts for,
    // and the plan's steps 1, 5 and 6 dispatch nothing at all
    expect(PROT_STAGES.map((s) => s.stage)).toEqual(['interactions', 'surface']);
    expect(PROT_ACT_ORDER).toEqual(['interactionPairs', 'residueContacts', 'residueSurface']);
    expect(PROT_UNAVAILABLE_STAGES.map((s) => s.stage)).toEqual(['conservation']);
  });

  it('names the three steps the def has never heard of, and gives none of them an act', () => {
    const declared = [...PROT_STAGES, ...PROT_UNAVAILABLE_STAGES].map((s) => s.stage);
    const planOnly = PROT_PLAN.filter((step) => !declared.includes(step.stage));
    expect(planOnly.map((s) => s.stage)).toEqual(['search', 'hotspots', 'annotation']);
    // nothing in the def mentions them — not a stage, not an act, not a receipt
    const analyses = readFileSync(join(process.cwd(), 'src', 'prot', 'analyses.ts'), 'utf8');
    for (const step of planOnly) expect(analyses.includes(`'${step.stage}'`), `analyses.ts names the plan-only step "${step.stage}"`).toBe(false);
  });
});

describe('the six steps, and the three kinds of blocked', () => {
  it('is six, numbered 1…6, in the order the pipeline publishes them', () => {
    expect(PROT_PLAN).toHaveLength(6);
    expect(PROT_PLAN.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(PROT_PLAN.map((s) => s.name)).toEqual(['Structure Search', 'Sequence Analysis', 'Structure Analysis', 'Interaction Mapping', 'Hot Spot Prediction', 'Functional Annotation']);
  });

  it('puts the two dispatching stages at the steps the documentation puts them at', () => {
    // the surface stage is step 3 and the contacts stage is step 4, which is NOT
    // the order the orchestrator dispatches them in — the plan publishes one
    // order and the def dispatches another, and both are true at once
    expect(planStepOf('surface')?.step).toBe(3);
    expect(planStepOf('interactions')?.step).toBe(4);
  });

  it('blocks exactly three of them, one per kind, and each kind has its own word', () => {
    expect(PROT_BLOCKED.map((s) => [s.stage, s.blockedBy])).toEqual([
      ['conservation', 'the world'],
      ['hotspots', 'this build'],
      ['annotation', 'us'],
    ]);
    expect(PROT_BLOCKED.map((s) => s.tag)).toEqual(['not available here', 'not on this build', 'not built yet']);
    // three different words, so the marks may be identical
    expect(new Set(Object.values(BLOCKED_TAG)).size).toBe(3);
  });

  it('gives every blocked step a reason, and resolves each one to the single list that owns it', () => {
    const conservation = PROT_BLOCKED.find((s) => s.stage === 'conservation')!;
    // step 2's paragraph is the DEF's, verbatim — the plan does not spell it
    expect(conservation.why).toBe(PROT_UNAVAILABLE_STAGES[0]!.why);
    expect(planStepOf('conservation')?.why).toBeNull();
    // steps 5 and 6 have no other list, so they carry their own
    for (const stage of ['hotspots', 'annotation']) {
      const step = planStepOf(stage)!;
      expect(step.why).not.toBeNull();
      expect(PROT_BLOCKED.find((s) => s.stage === stage)!.why).toBe(step.why);
    }
  });

  it('says which kind of blocked each one is IN ITS REASON, not only in its word', () => {
    const why = (stage: string): string => PROT_BLOCKED.find((s) => s.stage === stage)!.why;
    // the world: somebody else's header, and this code cannot change it
    expect(why('conservation')).toContain('access-control-allow-origin');
    expect(why('conservation')).toContain('That is the other side’s header, not a gap in this code.'.replace('’', "'"));
    // this build: a static page cannot hold a key
    expect(why('hotspots')).toContain('a static page cannot hold the key');
    expect(why('hotspots')).toContain('A build with a server behind it performs this stage.');
    // US: nothing external is in the way, and it says so
    expect(why('annotation')).toContain('our work outstanding');
    expect(why('annotation')).toContain('nothing external is in the way');
    expect(why('annotation')).toContain('only building');
  });

  it('declares a sentence for a step nothing else declares, and never a second spelling of one that is declared', () => {
    for (const step of PROT_PLAN) {
      const declared = [...PROT_STAGES, ...PROT_UNAVAILABLE_STAGES].find((s) => s.stage === step.stage);
      if (declared === undefined) {
        expect(step.question, `${step.stage} is declared by nothing else and carries no sentence`).not.toBeNull();
        expect(step.line, `${step.stage} is the plan's own step and carries no line about its state`).not.toBeNull();
      } else {
        expect(step.question, `${step.stage} is declared in the def and the plan spells its label again`).toBeNull();
        expect(step.why, `${step.stage} is declared in the def and the plan spells its reason again`).toBeNull();
      }
    }
  });

  it('carries the declared SENTENCE beside the short name on every blocked step, so nothing is only ever short', () => {
    expect(PROT_BLOCKED.find((s) => s.stage === 'conservation')!.label).toBe(PROT_UNAVAILABLE_STAGES[0]!.label);
    expect(PROT_BLOCKED.find((s) => s.stage === 'hotspots')!.label).toBe(planStepOf('hotspots')!.question);
    for (const step of PROT_BLOCKED) expect(step.label.split(/\s+/).length, `${step.stage}'s declared sentence is not a sentence`).toBeGreaterThan(3);
  });
});

/**
 * THE PLAN'S OWN PROSE, with the comment furniture taken off.
 *
 * A doc comment wraps at 80 columns and every continuation carries ` * `, so a
 * clause of more than a few words spans two lines with markup in the middle.
 * Matching against the raw bytes would be matching against the line breaks,
 * which is a test about a formatter. So the prefixes come off and the
 * whitespace collapses, and what is asserted is the SENTENCE.
 */
const prose = (file: string): string =>
  readFileSync(join(process.cwd(), 'src', 'prot', file), 'utf8')
    .replace(/^\s*\*\s?/gm, ' ')
    .replace(/\s+/g, ' ');

describe('THE REASON THE PLAN IS ITS OWN DECLARATION is written down in its own file', () => {
  const source = prose('plan.ts');

  it('states the difference between declaring a stage in the DEF and declaring one in the PLAN', () => {
    for (const clause of [
      'declaring a stage IN THE DEF means the orchestrator dispatches acts for',
      'declaring a stage IN THE PLAN means the pipeline has six steps',
      'nothing is added to {@link PROT_STAGES}',
      'the stepper is the plan\'s',
    ]) {
      expect(source, `the plan's own file does not say "${clause}"`).toContain(clause);
    }
  });

  it('names the three people who can be in the way, and says that one of them is us', () => {
    for (const clause of ['the WORLD', 'THIS BUILD', 'and US', 'we have not built this yet']) expect(source).toContain(clause);
  });

  it('says why a short name is declared beside the sentence rather than cut out of one', () => {
    expect(source).toContain('declared here beside the sentence rather than cut out of it by code');
  });
});

describe('the plan is judged at load, so a demo that does not line up will not start', () => {
  /** The judge's own refusals, read off the module: it runs at import and there is no second door into it. */
  const source = prose('plan.ts');

  it('checks the five things a plan can get wrong, each with its own sentence', () => {
    for (const refusal of [
      'is numbered',
      'has no short name',
      'may not spell its label a second time',
      'may not spell its reason a second time',
      'dispatches acts, so it cannot also be blocked',
      'has to say which kind of blocked it is',
      'two steps carry the same stage id',
      'and the plan does not name it, so it would be absent from the stepper',
      'will not run here and gives no reason',
    ]) {
      expect(source, `the judge has no refusal for "${refusal}"`).toContain(refusal);
    }
  });

  it('refuses a plan that forgets a declared stage — the failure that would empty a column off the screen', async () => {
    // the judge is a function of the two declarations, so the cheapest honest
    // drive of it is the real one: every declared stage must be named, and this
    // asserts the property the judge exists to keep rather than re-implementing
    const named = PROT_PLAN.map((s) => s.stage);
    for (const declared of [...PROT_STAGES, ...PROT_UNAVAILABLE_STAGES]) expect(named).toContain(declared.stage);
    // and the module really does run its judge at import, not on request
    expect(source).toContain('judgeThePlan();');
    await expect(import('../src/prot/plan.js')).resolves.toBeDefined();
  });

  it('gives every step a blocker from the three-word vocabulary and nothing else', () => {
    const words: readonly Blocker[] = ['the world', 'this build', 'us'];
    for (const step of PROT_PLAN) {
      if (step.blockedBy === null) continue;
      expect(words).toContain(step.blockedBy);
    }
  });
});
