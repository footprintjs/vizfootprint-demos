/**
 * THE FIFTH DESK'S STEPPER ARITHMETIC — its six declared stages laid over the
 * run's outcomes. No React in this file; the screen is the workbench's own
 * `web/src/workbench/Stepper.tsx`, unchanged and imported.
 *
 * ── WHY THIS FILE EXISTS RATHER THAN A CALL INTO `protStages.ts` ───────────
 * `web/src/protStages.ts` · `stepperStages` folds `PROT_STAGES` over
 * `PROT_PLAN` — the protein desk's declared pipeline, with its three blocked
 * steps and its one step that lands at the root of the log. THIS desk's plan is
 * a different declaration (`src/hot/analyses.ts` · `HOT_STAGES`): six stages,
 * one act each, every one of them dispatched here, nothing blocked and nothing
 * landing before the record starts. Laying one over the other would have meant
 * teaching the protein desk's fold about a plan it does not have.
 *
 * So the ARITHMETIC is this desk's own — layer 3, the desk's own business logic
 * by the four-layer law (`web/src/workbench/README.md`) — and everything it
 * feeds is the workbench's: `StepperStage` is protStages' own published type,
 * `stepViews` folds these rows into the component's props, and `StageStepper`
 * draws them. Not one component is copied.
 *
 * **FINDING, reported rather than worked around:** `stepperStages` is one
 * argument away from serving both desks — a declared plan in, stepper rows out
 * — and that argument is the same one `src/hot/session.ts` already reports
 * about `runProtStages`. Two desks now want the same fold over two plans, which
 * is the point at which the parameter stops being speculative.
 */
import type { ActOutcome } from '../../../src/prot/orchestrator.js';
import { HOT_STAGES } from '../../../src/hot/analyses.js';
import type { HotRun } from '../../../src/hot/session.js';
import type { StepperStage } from '../protStages.js';

/**
 * THE SHORT NAME UNDER EACH MARK — what six columns across a screen can print
 * without code shortening anything.
 *
 * The declaration carries the SENTENCE (`HOT_STAGES[].label`, which the seek
 * control's accessible name and the focused card both use); a column head wants
 * a word. The protein desk reads its own from `src/prot/plan.ts` · `PROT_PLAN`;
 * this desk has no separate published plan, so the words are declared here,
 * keyed by the stage id the declaration itself gives.
 */
export const HOT_STEP_NAMES: Readonly<Record<string, string>> = {
  interactions: 'Contacts',
  surface: 'Surface',
  annotation: 'Published',
  hydropathy: 'Hydropathy',
  score: 'Two scores',
  extent: 'Patches',
};

/**
 * THIS DESK DECLARES NO RECEIPT VIEW — every one of its six acts lands columns
 * on the residues table, and every picture is drawn from a column.
 *
 * It is stated rather than left to a default because the default is the protein
 * desk's (`web/src/protStages.ts` · `chartsOfStage`), whose acts include two
 * whose whole answer is a table nobody's clause reaches. Handing in an empty
 * map is this desk saying so, not this desk forgetting.
 */
export const HOT_RECEIPTS: Readonly<Record<string, string>> = {};

const plural = (n: number, one: string, many: string): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * THE STEPPER'S ROWS — the six declared stages, with whatever the run has said
 * about each one so far.
 *
 * `run` is `null` while the stages are still dispatching and `outcomes` is what
 * has come back by then, which is the shape `stepperStages` takes for the same
 * reason: a reader watches the run fill.
 *
 * FOUR of the six states are reachable here and two are not, and that is a fact
 * about this desk rather than an omission. `unavailable` and `blocked` are the
 * protein desk's two declared-and-not-happening states; this desk declares
 * nothing it does not dispatch, so no mark of that family can ever be drawn and
 * none is faked.
 */
export function hotStepperStages(outcomes: readonly ActOutcome[], run: HotRun | null): readonly StepperStage[] {
  const inFlight = run === null;
  /** The first declared stage that has not finished is the one in flight — and only while the run is. */
  let runningFound = false;
  return HOT_STAGES.map((declared, index): StepperStage => {
    const acts = outcomes.filter((o) => o.stage === declared.stage);
    const refusals = acts.flatMap((a) => (a.refusal === null ? [] : [a.refusal]));
    const materialized = acts.flatMap((a) => a.materialized);
    const landedCommits = acts.flatMap((a) => (a.commit === null ? [] : [a.commit]));
    const complete = acts.length === declared.acts.length;
    const running = inFlight && !complete && !runningFound;
    if (running) runningFound = true;
    const state = refusals.length > 0 ? 'refused' : complete ? 'landed' : running ? 'running' : acts.length === 0 ? 'not-run' : 'landed';
    const subtitle =
      state === 'refused'
        ? `${plural(refusals.length, 'act', 'acts')} of this stage ${refusals.length === 1 ? 'was' : 'were'} refused`
        : state === 'running'
          ? `running now — ${acts.length.toLocaleString('en-US')} of its ${plural(declared.acts.length, 'act', 'acts')} back`
          : state === 'not-run'
            ? 'declared, and not dispatched on this session — it has landed nothing, so there is nothing here to go back to'
            : materialized.length === 0
              ? `landed ${plural(landedCommits.length, 'commit', 'commits')} and wrote no column into the data space`
              : `landed ${plural(materialized.length, 'column', 'columns')} on the residues table — ${materialized.join(', ')}`;
    return {
      number: index + 1,
      stage: declared.stage,
      label: declared.label,
      name: HOT_STEP_NAMES[declared.stage] ?? declared.stage,
      state,
      // NOTHING IS BLOCKED ON THIS DESK, and nothing lands before the record
      // starts: every column a picture here binds was written by one of these
      // six acts.
      blockedBy: null,
      landsAtRoot: false,
      subtitle,
      // THE REFUSAL SENTENCES, VERBATIM — `src/prot/orchestrator.ts` · `landAct`
      // already wrote them and nothing here re-words them
      detail: refusals.length === 0 ? null : refusals.join(' · '),
      acts,
      declared: declared.acts.length,
      // THE LAST commit: a stage's work is done at its last act, so that is the
      // state a reader asking for "this stage" means
      commit: landedCommits.length === 0 ? null : landedCommits[landedCommits.length - 1]!,
      materialized,
    };
  });
}

/** What the focused card's quiet line says about the stage that landed the picture in it. */
export interface HotCardWords {
  readonly mark: string;
  readonly line: string;
  readonly refusal: string | null;
}

/**
 * THE FOCUSED CARD'S OWN SENTENCE — which stage landed the picture in the focus
 * slot, and what it put there.
 *
 * It names the stage on the line rather than only on the stepper, for the
 * reason `web/src/workbench/ChartCard.tsx` · `CardStage` gives: a picture a
 * reader PROMOTED out of the rail must never read as the standing stage's own.
 */
export function hotCardWords(stage: StepperStage): HotCardWords {
  return { mark: `stage ${String(stage.number)}`, line: stage.subtitle, refusal: stage.detail };
}
