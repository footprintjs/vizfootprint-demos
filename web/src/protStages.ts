/**
 * THE STEPPER'S ARITHMETIC — the DEF's declared stages laid over the RUN's
 * outcomes, and which charts each stage owns. No React in this file; the screen
 * is `./protStepper.tsx`.
 *
 * ── THE RULE THE TRACE PANEL KEPT, AND HOW FAR IT BENDS ─────────────────────
 * `./protTrace.tsx` reads the RUN and never the def, because a greyed box for an
 * act nobody dispatched is a promise. A STEPPER is a different object and the
 * rule bends exactly this far: **the plan is a declared fact, so showing it is
 * honest — as long as an unrun stage looks unrun and a stage that cannot run
 * says why.** Nothing here claims a stage will succeed.
 *
 * That is what the five states are for, and the fifth is what keeps the other
 * four honest:
 *
 *   `not run`       declared, dispatched nothing, claiming nothing;
 *   `running`       its acts are in flight;
 *   `landed`        it landed commits — the state a click can seek to;
 *   `refused`       an act of it was refused, and the sentence rides along
 *                   verbatim (`src/prot/orchestrator.ts` · `landAct` wrote it);
 *   `unavailable`   declared and impossible ON THIS DESK, with the measured
 *                   reason (`src/prot/analyses.ts` · `PROT_UNAVAILABLE_STAGES`).
 *                   A circle left pending forever would be the promise the trace
 *                   panel's rule exists to forbid.
 *
 * ── AND THE JOIN THAT MAKES THE STEPPER A CONTROL ───────────────────────────
 * The stepper is labelled by the FLOWCHART's stages (footprintjs) and acts on
 * the VIZFOOTPRINT cursor, because the pictures are drawn from vizfootprint's
 * rows at vizfootprint's cursor (`./protRows.ts`). The field that joins the two
 * records already exists: `ActOutcome.commit`, the dashboard commit each act
 * landed. One control, two records, one join — and a stepper that moved only the
 * flowchart's own cursor would leave every chart exactly as frozen as it was
 * before this packet.
 */
import { PROT_STAGES, PROT_UNAVAILABLE_STAGES } from '../../src/prot/analyses.js';
import { PROT_RECEIPTS } from '../../src/prot/def.js';
import type { ActOutcome, ProtRun } from '../../src/prot/orchestrator.js';

/** The five states of a stage on the stepper. See the file header. */
export type StageState = 'not-run' | 'running' | 'landed' | 'refused' | 'unavailable';

/** One numbered circle on the stepper, with everything the screen draws from it. */
export interface StepperStage {
  /** Its place in the plan, from 1 — the number in the circle. */
  readonly number: number;
  /** The stage id, as the chart's state keys it (`src/prot/analyses.ts` · `PROT_STAGES`). */
  readonly stage: string;
  /** The stage's declared name. */
  readonly label: string;
  readonly state: StageState;
  /** The one line under the name — what happened, or what cannot. */
  readonly subtitle: string;
  /** The longer reason, when there is one: a refusal's own sentence, or why this desk cannot run the stage. `null` otherwise. */
  readonly detail: string | null;
  /** The acts of this stage that came back, in dispatch order — the stepper's detail rows. */
  readonly acts: readonly ActOutcome[];
  /** How many acts the declaration says this stage dispatches. `0` for a stage no act belongs to. */
  readonly declared: number;
  /** The commit a click on this stage seeks to — the LAST one its acts landed, or `null` when it landed none. */
  readonly commit: string | null;
  /** Every column this stage's acts landed, in landing order — the left side of the focus intersection. */
  readonly materialized: readonly string[];
}

const plural = (n: number, one: string, many: string): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * WHAT A LANDED STAGE PUT ON THE DESK, in one line.
 *
 * The columns it wrote, and — for an act whose answer is a table nobody's clause
 * reaches — that fact, because "landed nothing" would be false about an act that
 * cut 224 rows. Neither is counted here: the columns come off the acts and the
 * receipt comes off the declaration.
 */
function landedSubtitle(acts: readonly ActOutcome[], materialized: readonly string[]): string {
  const receipts = acts.filter((a) => a.commit !== null && a.materialized.length === 0 && PROT_RECEIPTS[a.act] !== undefined).length;
  const parts = [
    materialized.length === 0 ? null : `landed ${plural(materialized.length, 'column', 'columns')} on the residues table — ${materialized.join(', ')}`,
    receipts === 0 ? null : `and cut ${plural(receipts, 'table', 'tables')} into its own answer, which no clause in the data space reaches`,
  ].filter((s): s is string => s !== null);
  // an act can land a commit and write neither a column nor a receipt; say that
  // rather than leaving the line empty
  return parts.length === 0 ? `landed ${plural(acts.filter((a) => a.commit !== null).length, 'commit', 'commits')} and wrote no column into the data space` : parts.join(', ');
}

/**
 * THE STEPPER'S ROWS — the declared plan, with whatever the run has said about
 * each stage so far.
 *
 * `run` is `null` while the stages are still dispatching (the page's `reading`
 * state) and `outcomes` is what has come back by then — the same two arguments
 * the trace panel took, for the same reason: a reader watches the run fill.
 */
export function stepperStages(outcomes: readonly ActOutcome[], run: ProtRun | null): readonly StepperStage[] {
  const inFlight = run === null;
  /** The first declared stage that has not finished is the one in flight — and only while the run is. */
  let runningFound = false;
  const runnable = PROT_STAGES.map((declared, index): StepperStage => {
    const acts = outcomes.filter((o) => o.stage === declared.stage);
    const refusals = acts.flatMap((a) => (a.refusal === null ? [] : [a.refusal]));
    const materialized = acts.flatMap((a) => a.materialized);
    const landedCommits = acts.flatMap((a) => (a.commit === null ? [] : [a.commit]));
    const complete = acts.length === declared.acts.length;
    const running = inFlight && !complete && !runningFound;
    if (running) runningFound = true;
    const state: StageState = refusals.length > 0 ? 'refused' : complete ? 'landed' : running ? 'running' : acts.length === 0 ? 'not-run' : 'landed';
    const subtitle =
      state === 'refused'
        ? `${plural(refusals.length, 'act', 'acts')} of this stage ${refusals.length === 1 ? 'was' : 'were'} refused`
        : state === 'running'
          ? `running now — ${acts.length.toLocaleString('en-US')} of its ${plural(declared.acts.length, 'act', 'acts')} back`
          : state === 'not-run'
            ? `declared, and not dispatched on this session — it has landed nothing, so there is nothing here to go back to`
            : landedSubtitle(acts, materialized);
    return {
      number: index + 1,
      stage: declared.stage,
      label: declared.label,
      state,
      subtitle,
      // THE REFUSAL SENTENCES, VERBATIM — `landAct` already wrote them and
      // nothing here re-words them
      detail: refusals.length === 0 ? null : refusals.join(' · '),
      acts,
      declared: declared.acts.length,
      // THE LAST commit: a stage's work is done at its last act, so that is the
      // state a reader asking for "this stage" means
      commit: landedCommits.length === 0 ? null : landedCommits[landedCommits.length - 1]!,
      materialized,
    };
  });
  const unavailable = PROT_UNAVAILABLE_STAGES.map(
    (declared, index): StepperStage => ({
      number: runnable.length + index + 1,
      stage: declared.stage,
      label: declared.label,
      state: 'unavailable',
      subtitle: 'declared, and this desk cannot perform it at all',
      detail: declared.why,
      acts: [],
      declared: 0,
      commit: null,
      materialized: [],
    }),
  );
  return [...runnable, ...unavailable];
}

/**
 * WHICH CHARTS A STAGE OWNS — derived, never hand-wired.
 *
 * Each act says which columns it landed (`ActOutcome.materialized`, gathered onto
 * `StepperStage.materialized`) and each view says which columns it binds — the
 * encoding fold at its address, `SessionViewState.effectiveEncodings` laid over
 * `encodings`, which is exactly what the cells read to draw themselves
 * (`./protCells.tsx` · `desk.bound`). So "which pictures did this stage produce"
 * is an INTERSECTION of two things the session already carries.
 *
 * The one exception is declared rather than computed, because nothing on the
 * wire could compute it: a RECEIPT view draws an act's own answer and binds no
 * column at all (`src/prot/def.ts` · `PROT_RECEIPTS` has the whole argument).
 *
 * A view that binds nothing and is nobody's receipt belongs to no stage, which is
 * the true answer for the 3D structure and the scatter: they draw the FILE's own
 * columns, and no act on this desk landed those.
 */
export function chartsOfStage(stage: StepperStage, shown: Readonly<Record<string, Readonly<Record<string, string>>>>): readonly string[] {
  const landed = new Set(stage.materialized);
  const byColumn = Object.entries(shown)
    .filter(([, channels]) => Object.values(channels).some((field) => landed.has(field)))
    .map(([address]) => address);
  const receipts = stage.acts.flatMap((a) => {
    const view = PROT_RECEIPTS[a.act];
    return view === undefined || a.commit === null ? [] : [view];
  });
  return [...new Set([...byColumn, ...receipts])];
}

/**
 * WHICH STAGE THE CURSOR IS STANDING IN — the last stage whose commit is at or
 * behind the cursor on the active path.
 *
 * "At or behind", not "equal to", and that is the point: a reader who selects a
 * residue lands a commit of their own, and the cursor then sits on a commit no
 * stage landed. The stage in action is still the last one that had landed by
 * then — which is what the pictures are showing, because the columns on the rows
 * at that cursor are the ones its acts put there.
 *
 * `null` when the cursor is not on the active path at all (a fork), which is
 * honest rather than a guess: this page draws no branch map, so it has no way to
 * say where such a cursor sits and does not pretend to.
 */
export function stageAtCursor(stages: readonly StepperStage[], activePathIds: readonly string[], cursor: string | null): StepperStage | null {
  if (cursor === null) return null;
  const here = activePathIds.indexOf(cursor);
  if (here < 0) return null;
  let found: StepperStage | null = null;
  let best = -1;
  for (const stage of stages) {
    if (stage.commit === null) continue;
    const at = activePathIds.indexOf(stage.commit);
    if (at >= 0 && at <= here && at > best) {
      best = at;
      found = stage;
    }
  }
  return found;
}
