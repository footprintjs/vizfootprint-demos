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
import type { ReactNode } from 'react';
import type { StageState, StepperStage } from '../protStages.js';
import type { LinkReach, StageLook, StepView } from './Stepper.js';

/** The word under the name, in Mono uppercase — only for the two states the mark alone cannot tell. */
const TAG: Readonly<Record<StageState, string | null>> = {
  'not-run': null,
  running: null,
  landed: null,
  refused: 'refused',
  unavailable: 'not available here',
};

/** The mark is named the same as the state: one vocabulary for the fold, the screen and the tests. */
const LOOK: Readonly<Record<StageState, StageLook>> = {
  'not-run': 'not-run',
  running: 'running',
  landed: 'landed',
  refused: 'refused',
  unavailable: 'unavailable',
};

/** A stage that HAS RUN: it landed commits, or it ran and was refused. Neither of the other three has been reached. */
const hasRun = (stage: StepperStage): boolean => stage.state === 'landed' || stage.state === 'refused';

/** What one seek control is called. Unchanged since the stepper became a cursor — the tests name it by this. */
export const seekLabelOf = (stage: StepperStage): string =>
  `move the desk to stage ${String(stage.number)}, ${stage.label} — seek the cursor to the commit its last act landed`;

/** What one expander is called. Static: `aria-expanded` carries whether it is open, so the NAME does not move under a reader. */
export const expandLabelOf = (stage: StepperStage): string => `show the acts of stage ${String(stage.number)}, ${stage.label}`;

/** The nav's accessible name. */
export const STEPPER_LABEL = 'the stages this desk declares, in the order they land';

/**
 * THE COLUMNS.
 *
 * `seekable` is `false` while the run is still dispatching: the cursor these
 * stages move arrives with the desk, so until then no mark is a control and the
 * note below says so rather than offering a click that would answer a refusal.
 *
 * `detailOf` is how the composition hands each column what its expander opens —
 * the act rows, which are made of the run's own outcomes and therefore cannot
 * be built in a presentational file.
 */
export function stepViews(stages: readonly StepperStage[], here: StepperStage | null, seekable: boolean, detailOf: (stage: StepperStage) => ReactNode): readonly StepView[] {
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
    name: stage.label,
    tag: TAG[stage.state],
    look: LOOK[stage.state],
    here: here?.stage === stage.stage,
    seekLabel: seekable && stage.commit !== null ? seekLabelOf(stage) : null,
    linkBefore: reachBefore(index),
    linkAfter: reachBefore(index + 1),
    // the share of its acts that are back — the one state that moves, and the
    // only one with a number to move by
    progress: stage.state === 'running' ? (stage.declared === 0 ? 0 : stage.acts.length / stage.declared) : null,
    expandLabel: expandLabelOf(stage),
    detail: detailOf(stage),
  }));
}

/**
 * THE SENTENCE UNDER THE MARKS — the plan is a DECLARED FACT, and this says so
 * out loud so the marks are never read as a promise.
 *
 * Every number in it is counted off the stages; the last clause depends only on
 * whether there is a cursor to move yet.
 */
export function stepperNote(stages: readonly StepperStage[], seekable: boolean): string {
  const count = (n: number): string => n.toLocaleString('en-US');
  const landed = stages.filter((s) => s.state === 'landed').length;
  const refused = stages.filter((s) => s.state === 'refused').length;
  const unavailable = stages.filter((s) => s.state === 'unavailable').length;
  return (
    `${count(stages.length)} stages are DECLARED on this desk; ${count(landed)} landed, ${count(refused)} had an act refused and ${count(unavailable)} ${unavailable === 1 ? 'is' : 'are'} not available here at all. ` +
    `A circle claims nothing about a stage that has not run. ` +
    (seekable
      ? 'Press a landed stage to move the whole desk to it: the rows are re-read at that commit and every picture follows, including the ones that lose their column and say so.'
      : 'The cursor these stages move arrives with the desk, when the last act has landed — so nothing here is clickable yet.')
  );
}
