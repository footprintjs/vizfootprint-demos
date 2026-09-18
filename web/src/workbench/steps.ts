/**
 * THE STEPPER, AS RULES — LAYER 3: the fold from the run's own stages to the
 * columns `./Stepper.tsx` draws. Pure; no React, no DOM, no session.
 *
 * `web/src/protStages.ts` · `stepperStages` already folds the declared plan
 * over the run's outcomes into the five states. This file turns that into the
 * design's picture: which mark, which tag, which connector, whether the name is
 * a control and what it is called.
 *
 * ── THE CONNECTORS, and why they are a rule rather than a guess ────────────
 * The design draws three weights of link and they mean three different things:
 * SOLID between two stages that have both run, a NEAR dash up to the last
 * stage that ran, and a FAR dash past it. So the rule is stated once, here:
 *
 *   `run`   both stages either side of this boundary have run;
 *   `near`  the boundary is at or before the last stage that ran;
 *   `far`   beyond it — the part of the plan nothing has reached.
 *
 * ── AND THE THREE NAMES THAT ARE A CONTRACT ────────────────────────────────
 * The seek control's accessible name, the expander's, and the nav's are all
 * unchanged from before this packet: tests name controls by them, and a test
 * that had to be edited to keep passing is a contract that was broken quietly.
 */
import { BLOCKED_TAG } from '../../../src/prot/plan.js';
import type { StageState, StepperStage } from '../protStages.js';
import type { LinkReach, StageLook, StepView } from './Stepper.js';

/**
 * The word under the name, in Mono uppercase — only for the states the mark
 * alone cannot tell.
 *
 * The two states of the DECLARED-AND-NOT-HAPPENING family take no word from
 * here: theirs is `src/prot/plan.ts` · `BLOCKED_TAG`, keyed by which kind of
 * blocked the step is, because that is the whole difference between them and
 * the paint is deliberately the same.
 */
const TAG: Readonly<Record<StageState, string | null>> = {
  'not-run': null,
  running: null,
  landed: null,
  refused: 'refused',
  unavailable: null,
  blocked: null,
};

/**
 * The mark is named the same as the state — one vocabulary for the fold, the
 * screen and the tests — with ONE deliberate exception.
 *
 * `unavailable` and `blocked` map to the SAME mark, and the mark's name is the
 * family's (`declared-not-here`) rather than either state's. That is the
 * packet's decision, drawn: the hatched, struck-through circle says *declared
 * and not going to happen here*, all three reasons for that are true of that
 * sentence, and a component that cannot express two marks cannot let them
 * drift. What differs is the word beneath and the paragraph behind the fold.
 */
const LOOK: Readonly<Record<StageState, StageLook>> = {
  'not-run': 'not-run',
  running: 'running',
  landed: 'landed',
  refused: 'refused',
  unavailable: 'declared-not-here',
  blocked: 'declared-not-here',
};

/** A stage that HAS RUN: it landed commits, or it ran and was refused. Neither of the other three has been reached. */
const hasRun = (stage: StepperStage): boolean => stage.state === 'landed' || stage.state === 'refused';

/** What one seek control is called. Unchanged since the stepper became a cursor — the tests name it by this. */
export const seekLabelOf = (stage: StepperStage): string =>
  `move the desk to stage ${String(stage.number)}, ${stage.label} — seek the cursor to the commit its last act landed`;

/**
 * What the control on a stage THAT WILL NOT RUN HERE is called.
 *
 * It is a different sentence from a seek's because it is a different act: there
 * is no commit to move to, so the press brings that stage's CARD into the focus
 * — where the reason is, at the size of the thing it is about. The name says
 * exactly that, so nobody presses it expecting the cursor to move.
 */
export const showLabelOf = (stage: StepperStage): string =>
  `bring stage ${String(stage.number)}, ${stage.label} into the focus — it will not run on this build, and its card says why`;

/**
 * What the control on the step that landed AT THE ROOT is called — and it is a
 * third sentence, not a reuse of either of the others.
 *
 * The parse RAN and landed the whole residues table; it simply landed no
 * commit, because its answer is already true before the record begins. So the
 * press takes the focus to its picture and the cursor stays where it is — and
 * *this step cannot run here* would be false about the one step that certainly
 * did.
 */
export const focusLabelOf = (stage: StepperStage): string =>
  `bring stage ${String(stage.number)}, ${stage.label} into the focus — it landed before this record starts, so the cursor does not move`;

/**
 * What the list of one stage's acts is called.
 *
 * It used to be an EXPANDER on the column and is now a section of the record
 * drawer: the author's ruling left nothing between the stepper and the charts,
 * and the act rows are record rather than chrome. The name is unchanged from
 * when it named the expander — `tests/prot-cursor.smoke.test.ts` walks past it
 * to find an act's own seek control, and a name a test finds a control by is a
 * contract.
 */
export const actsLabelOf = (stage: StepperStage): string => `show the acts of stage ${String(stage.number)}, ${stage.label}`;

/** The nav's accessible name. */
export const STEPPER_LABEL = 'the stages this desk declares, in the order they land';

/**
 * THE COLUMNS.
 *
 * `seekable` is `false` while the run is still dispatching: the cursor these
 * stages move arrives with the desk, so until then no mark is a control at all
 * — not even the stages that will not run, whose press needs a focus to promote
 * their card into — and the note below says so rather than offering a click
 * that would answer a refusal.

 */
export function stepViews(stages: readonly StepperStage[], here: StepperStage | null, seekable: boolean): readonly StepView[] {
  let lastRun = -1;
  stages.forEach((stage, index) => {
    if (hasRun(stage)) lastRun = index;
  });
  /** The weight of the boundary to the LEFT of column `index`. `null` at the first column, which has none. */
  const reachBefore = (index: number): LinkReach | null => {
    const before = stages[index - 1];
    const at = stages[index];
    if (before === undefined || at === undefined) return null;
    if (hasRun(before) && hasRun(at)) return 'run';
    return index <= lastRun ? 'near' : 'far';
  };
  return stages.map((stage, index) => ({
    key: stage.stage,
    number: stage.number,
    // THE SHORT DECLARED NAME, because six sentences across one screen do not
    // fit and code may not cut a declared label. The SENTENCE is still on the
    // column — as the accessible name of its seek control and of its expander,
    // both of which carry `stage.label` — and on the panel's eyebrow and the
    // foot of every card the stage owns.
    name: stage.name,
    // the word under the mark: the state's, or — for the one mark family the
    // three not-happening steps share — which kind of blocked this one is
    tag: stage.blockedBy === null ? TAG[stage.state] : BLOCKED_TAG[stage.blockedBy],
    look: LOOK[stage.state],
    here: here?.stage === stage.stage,
    // ONE CONTROL PER COLUMN, TWO THINGS IT CAN ANSWER. A commit to seek to, or
    // — for a stage that will not run here — a card to bring into the focus.
    // Neither before the desk has a cursor at all: `seekable` gates both,
    // because there is no focus to promote into while the run is dispatching.
    // ONE CONTROL PER COLUMN, THREE THINGS IT CAN ANSWER. A commit to seek to;
    // a card to bring into the focus, for a stage that will not run here; or a
    // PICTURE to bring into the focus, for the step that landed at the root and
    // has no commit to move to. Nothing at all before the desk has a cursor:
    // `seekable` gates all three, because there is no focus to promote into
    // while the run is still dispatching.
    pressLabel: seekable
      ? stage.commit !== null
        ? seekLabelOf(stage)
        : stage.state === 'blocked' || stage.state === 'unavailable'
          ? showLabelOf(stage)
          : stage.landsAtRoot
            ? focusLabelOf(stage)
            : null
      : null,
    linkBefore: reachBefore(index),
    linkAfter: reachBefore(index + 1),
    // the share of its acts that are back — the one state that moves, and the
    // only one with a number to move by
    progress: stage.state === 'running' ? (stage.declared === 0 ? 0 : stage.acts.length / stage.declared) : null,
  }));
}

/*
 * ── AND THE PLAN'S ACCOUNTING, WHICH WAS BRIEFLY HERE ──────────────────────
 * `stepperNote` wrote a sentence under the marks and `stepperTally` counted the
 * same thing into the facts strip. Both are gone, and the author's reason is
 * the better one: THE SIX MARKS ARE THE ACCOUNTING. Three solid circles, one
 * hatched with NOT AVAILABLE HERE under it, one with NOT ON THIS BUILD and one
 * with NOT BUILT YET — a reader can count that, and it says which kind of
 * blocked each one is in a register no prose beats.
 */
