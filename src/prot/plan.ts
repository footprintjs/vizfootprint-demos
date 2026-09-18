/**
 * THE PLAN — all six steps of this pipeline, and which kind of blocked each one
 * that will not run here is.
 *
 * ── WHY THIS IS A DECLARATION OF ITS OWN, BESIDE THE OTHER TWO ──────────────
 * `./analyses.ts` already declares two lists, and both are about DISPATCH:
 * {@link PROT_STAGES} is the stages the orchestrator dispatches acts for, and
 * `PROT_UNAVAILABLE_STAGES` is the one stage that is declared to the same
 * machinery and measured impossible on it. This file declares a THIRD thing,
 * which is not dispatch at all: **the pipeline the project publishes.**
 *
 * The two declarations are different in kind, and conflating them is what made
 * the screen less honest than the documentation for a release:
 *
 *   - declaring a stage IN THE DEF means the orchestrator dispatches acts for
 *     it. For steps 5 and 6 that would be a LIE — nothing runs — so nothing is
 *     added to {@link PROT_STAGES}, and `tests/prot-plan.test.ts` is the test
 *     that stops a later edit from turning the plan into a promise.
 *   - declaring a stage IN THE PLAN means the pipeline has six steps and that
 *     three of them are performed here. That is simply true, it is what the
 *     project's own `docs/stages.md` publishes, and the stepper is the plan's
 *     view — so the stepper shows six.
 *
 * A grey circle would have hidden the interesting half of that. THREE of these
 * six will not run on this build and they are blocked by three different
 * people: the WORLD (a service that answers no browser), THIS BUILD (a static
 * page that cannot hold a key), and US (work outstanding, with nothing external
 * in the way). A reader deserves to know which, and before this file the page
 * had no way to say *we have not built this yet* out loud.
 *
 * ── AND WHY EVERY LABEL HERE IS EITHER NEW OR A POINTER ────────────────────
 * Two spellings of one name is the thing this repository refuses (the
 * `ACT_TABLE` precedent in `./analyses.ts`, judged at load). So a step the def
 * already declares carries NO question and NO reason of its own — it carries
 * the id, and the sentence comes from the list that owns it. A step the def
 * does not declare carries its own, because nothing else can.
 *
 * What every step does carry is a SHORT NAME: the name this project's own
 * documentation gives it, declared here beside the sentence rather than cut out
 * of it by code. The stepper prints the short name across six columns and the
 * declared sentence rides the column's own accessible name, the panel's eyebrow
 * and each card's foot — so nothing on screen is a label this code shortened.
 */
import { PROT_STAGES, PROT_UNAVAILABLE_STAGES } from './analyses.js';

/**
 * WHO IS IN THE WAY — the whole vocabulary, and it is three words long because
 * there are exactly three answers and they are not the same answer.
 *
 *   `the world`   somebody else's service will not answer a browser. No amount
 *                 of code on this side changes it.
 *   `this build`  a static page cannot do it. A build with a server behind it
 *                 performs the same stage.
 *   `us`          nothing external is in the way. It is work outstanding.
 */
export type Blocker = 'the world' | 'this build' | 'us';

/** The word under the mark, per kind of blocked — one vocabulary for the stepper, the panel and the tests. */
export const BLOCKED_TAG: Readonly<Record<Blocker, string>> = {
  // UNCHANGED, and deliberately: this is the word the screen has carried for
  // the conservation stage since it was first declared, and a test names it
  'the world': 'not available here',
  'this build': 'not on this build',
  us: 'not built yet',
};

/** One step of the published pipeline. See the file header for which fields a step may carry. */
export interface PlanStep {
  /** Its place in the pipeline, from 1 — the number in the mark. */
  readonly step: number;
  /** The stage id. For a step the def declares, THE DEF'S OWN id — that is the join. */
  readonly stage: string;
  /** The short declared name, as the project's own documentation names it. */
  readonly name: string;
  /** The declared sentence, for a step no other list declares. `null` where one does — never a second spelling. */
  readonly question: string | null;
  /** Which kind of blocked this step is, or `null` for a step that is performed here. */
  readonly blockedBy: Blocker | null;
  /** The whole reason, for a step no other list declares it. `null` where one does. */
  readonly why: string | null;
  /** The ONE LINE about this step's state, for a step the run's own fold cannot write one for. `null` where it can. */
  readonly line: string | null;
}

/**
 * THE SIX, IN THE ORDER THE PIPELINE PUBLISHES THEM.
 *
 * The order is the PLAN's and not the orchestrator's: the def dispatches
 * contacts before surface, and the pipeline names surface third and contacts
 * fourth, because one reads the file's own geometry and the other reads what
 * the first found. Both are true at once, and the fold keeps them apart —
 * `web/src/protStages.ts` decides WHICH STAGE IS RUNNING in dispatch order and
 * lays the columns out in this one.
 */
export const PROT_PLAN: readonly PlanStep[] = [
  {
    step: 1,
    stage: 'search',
    name: 'Structure Search',
    question: 'Which entry this is, and one row per residue read off its own coordinates',
    blockedBy: null,
    why:
      'the archive answers a browser directly, so this step is performed here: the entry is searched for and downloaded, and the parse reads the residue key, the chain, the number, the type and the two backbone angles off the file\'s own coordinate records. ' +
      'ITS RESULT IS THE RESIDUES TABLE — every row on this desk is this step\'s, and every later step writes its own columns onto those rows. The FILE is its input, and it is the one thing on this page with no version: a structure file is not rows, CSV or JSON, so no carrier will take it. ' +
      'The 3D view and the backbone-angle scatter are two pictures of this one result, which is why they are this step\'s pictures and not nobody\'s. ' +
      'It is the only step of the plan that lands no commit of its own — its answer is already true at the root of this log, before the record starts — so its mark is landed, its press takes the focus, and there is nowhere earlier for the cursor to go.',
    line: 'landed by the parse, before this record starts — no commit of its own',
  },
  {
    step: 2,
    stage: 'conservation',
    name: 'Sequence Analysis',
    question: null,
    blockedBy: 'the world',
    why: null,
    line: null,
  },
  { step: 3, stage: 'surface', name: 'Structure Analysis', question: null, blockedBy: null, why: null, line: null },
  { step: 4, stage: 'interactions', name: 'Interaction Mapping', question: null, blockedBy: null, why: null, line: null },
  {
    step: 5,
    stage: 'hotspots',
    name: 'Hot Spot Prediction',
    question: 'Which residues a model would call hot, and the reason it gives for each',
    blockedBy: 'this build',
    why:
      'this stage needs a model, and a static page cannot hold the key that would call one: a key shipped inside a page\'s own bytes is a key given away, so there is nothing here to ask. ' +
      'The evidence it would read has already landed — the contacts, the reachable surface and the backbone geometry are on the record above, and each stage\'s recorder keeps what it did and what it refused — so what is missing is a process of our own standing in front of the model, not the evidence. ' +
      'A build with a server behind it performs this stage. And when it does, the answer is a PREDICTION rather than a measurement, so the screen may not let it look like one.',
    line: 'declared, and this build cannot perform it — the block is the build\'s, and the evidence a model would read has already landed',
  },
  {
    step: 6,
    stage: 'annotation',
    name: 'Functional Annotation',
    question: 'What is already known about this sequence, its domains and its epitopes',
    blockedBy: 'us',
    why:
      'this one is our work outstanding, and nothing external is in the way: UniProt, InterPro and the IEDB query API all answer a browser directly, so this stage needs no server — only building. ' +
      'It says that rather than wearing a reason somebody else owns, which is the whole point of naming three kinds of blocked instead of one. ' +
      'What it would land, beside the residues this desk already draws: the sequence\'s own annotations, the domains and families it belongs to, and the epitopes already recorded for it.',
    line: 'declared, and not built yet — the block is OURS, and nothing external is in the way',
  },
];

/** The plan step for one stage id, or `undefined` for an id the plan does not name. */
export const planStepOf = (stage: string): PlanStep | undefined => PROT_PLAN.find((step) => step.stage === stage);

/** A declared step that will not run here, with its reason resolved to whichever list owns it — its card's whole content. */
export interface BlockedStep {
  readonly stage: string;
  /** The short declared name. */
  readonly name: string;
  /** The declared SENTENCE, from whichever list declares it — so a fold can show it beside the reason and nothing is only ever short. */
  readonly label: string;
  readonly blockedBy: Blocker;
  /** The word in the card's corner, and under the mark. */
  readonly tag: string;
  /** The whole reason, verbatim from the list that declares it. */
  readonly why: string;
}

/**
 * THE THREE STEPS THAT WILL NOT RUN HERE — each one a CARD in the grid, because
 * the author asked for the reason to be read at the size and in the place of
 * the thing it is about: *"for not-available, show the widget and tell inside it
 * a text to tell why it's not there."*
 *
 * THE OTHER THREE STEPS ARE PICTURES, including step 1: the parse's own columns
 * are its landed columns, so the 3D view and the backbone-angle scatter ARE its
 * evidence (`web/src/protStages.ts` · `chartsOfStage`, which derives that
 * rather than being told it). A step with a picture does not also get a card of
 * words — that would be two homes for one answer.
 *
 * The reason is RESOLVED rather than copied: step 2's paragraph belongs to
 * `PROT_UNAVAILABLE_STAGES` (the list the def declares it to) and the plan's own
 * two carry their own. One owner each, and no step has two.
 */
export const PROT_BLOCKED: readonly BlockedStep[] = PROT_PLAN.flatMap((step) => {
  if (step.blockedBy === null) return [];
  const declared = PROT_UNAVAILABLE_STAGES.find((s) => s.stage === step.stage);
  const why = step.why ?? declared?.why;
  /* c8 ignore next -- the judge below refuses a blocked step with no reason at load */
  if (why === undefined) return [];
  return [{ stage: step.stage, name: step.name, label: step.question ?? declared?.label ?? step.name, blockedBy: step.blockedBy, tag: BLOCKED_TAG[step.blockedBy], why }];
});

/**
 * THE PLAN IS JUDGED AT LOAD — the `./analyses.ts` · `ACT_TABLE` precedent: a
 * demo that will not start beats one whose stepper claims something the def
 * cannot back.
 *
 * Five things are checked, and each one is a way this file could quietly start
 * lying: a step out of order, a stage the plan forgot (it would vanish from the
 * screen), a stage declared twice, a second spelling of a label the def owns,
 * and a blocked step with no reason to give.
 */
function judgeThePlan(): void {
  const refuse = (why: string): never => {
    throw new Error(`the published plan (src/prot/plan.ts) does not line up with the def's own stages: ${why}`);
  };
  PROT_PLAN.forEach((step, index) => {
    if (step.step !== index + 1) refuse(`step "${step.stage}" is numbered ${String(step.step)} at position ${String(index + 1)}`);
    if (step.name.trim() === '') refuse(`step ${String(step.step)} has no short name, and the stepper prints the short name`);
    const runnable = PROT_STAGES.some((s) => s.stage === step.stage);
    const unavailable = PROT_UNAVAILABLE_STAGES.some((s) => s.stage === step.stage);
    if (runnable && unavailable) refuse(`"${step.stage}" is in both of the def's lists`);
    if (runnable || unavailable) {
      if (step.question !== null) refuse(`"${step.stage}" is declared in the def, so the plan may not spell its label a second time`);
      if (step.why !== null) refuse(`"${step.stage}" is declared in the def, so the plan may not spell its reason a second time`);
    } else if (step.question === null) {
      refuse(`"${step.stage}" is declared by nothing else, so the plan has to carry its own sentence`);
    }
    if (runnable && step.blockedBy !== null) refuse(`"${step.stage}" dispatches acts, so it cannot also be blocked`);
    if (unavailable && step.blockedBy === null) refuse(`"${step.stage}" is declared unavailable to the def, so the plan has to say which kind of blocked it is`);
    if (!runnable && !unavailable && step.line === null) refuse(`"${step.stage}" is the plan's own step, so the plan has to carry the one line about its state`);
  });
  const ids = PROT_PLAN.map((s) => s.stage);
  if (new Set(ids).size !== ids.length) refuse('two steps carry the same stage id');
  for (const declared of [...PROT_STAGES, ...PROT_UNAVAILABLE_STAGES]) {
    if (!ids.includes(declared.stage)) refuse(`the def declares "${declared.stage}" and the plan does not name it, so it would be absent from the stepper`);
  }
  for (const step of PROT_BLOCKED) {
    if (step.why.trim() === '') refuse(`"${step.stage}" will not run here and gives no reason`);
  }
}

judgeThePlan();
