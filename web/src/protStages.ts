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
 * ── THE PLAN IS A THIRD DECLARATION, AND THE STEPPER IS ITS VIEW ────────────
 * The def declares what it DISPATCHES; `src/prot/plan.ts` declares the pipeline
 * the project publishes — all six steps, in the published order, with a short
 * name beside each declared sentence and, for the three that will not run here,
 * which kind of blocked each one is. This file lays the run's outcomes over
 * THAT, which is why the stepper shows six columns while `PROT_STAGES` still
 * dispatches exactly the stages it always did.
 *
 * That is what the six states are for, and the last two are what keep the other
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
 *   `blocked`       declared in the PLAN, will not run on this build, and says
 *                   which kind of blocked it is (`src/prot/plan.ts` ·
 *                   `Blocker`: the world, this build, or us). SAME MARK as
 *                   `unavailable` — one family, three reasons — because what
 *                   differs between the three is the sentence, not the paint.
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
import { PROT_PLAN, type Blocker, type PlanStep } from '../../src/prot/plan.js';
import { PROT_RECEIPTS } from '../../src/prot/def.js';
import type { ActOutcome, ProtRun } from '../../src/prot/orchestrator.js';

/**
 * THE SIX STATES OF A STAGE ON THE STEPPER. See the file header — and the sixth
 * is the one this packet added.
 *
 * `blocked` is a stage the PLAN declares (`src/prot/plan.ts`), that this build
 * will not run, and that says WHICH KIND of blocked it is. It shares its mark
 * with `unavailable` — one mark family, because the hatched struck-through
 * circle already says *declared and not going to happen here* and what differs
 * between them is the sentence, not the paint. They are two STATES rather than
 * one because they are declared to two different machineries: `unavailable` is
 * declared to the def and measured against it, `blocked` is the plan's own step
 * and the def has never heard of it.
 */
export type StageState = 'not-run' | 'running' | 'landed' | 'refused' | 'unavailable' | 'blocked';

/** One numbered circle on the stepper, with everything the screen draws from it. */
export interface StepperStage {
  /** Its place in the PLAN, from 1 — the number in the circle (`src/prot/plan.ts` · `PROT_PLAN`). */
  readonly number: number;
  /** The stage id, as the chart's state keys it (`src/prot/analyses.ts` · `PROT_STAGES`). */
  readonly stage: string;
  /** The stage's declared name — the SENTENCE, which is what the def declares and what the panel, the card feet and the seek control's own name carry. */
  readonly label: string;
  /** The SHORT declared name the plan carries beside that sentence — what six columns across a screen can print without code shortening anything. */
  readonly name: string;
  readonly state: StageState;
  /** Which kind of blocked, for the two states of the one mark family; `null` for a stage that runs here. */
  readonly blockedBy: Blocker | null;
  /**
   * TRUE for the one step whose answer is already true at the ROOT of the log:
   * the parse.
   *
   * It ran, and it landed the whole residues table — but not through an act, so
   * it has no commit and there is nowhere earlier to go. Two things read this:
   * {@link chartsOfStage}, which gives it the pictures drawn from the columns no
   * act landed, and the foot of those cards, which says so.
   *
   * Derived, not declared: a step the def dispatches nothing for and that
   * nothing is blocking is a step something OTHER than an act performed.
   */
  readonly landsAtRoot: boolean;
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
  /**
   * THE DEF'S OWN STAGES, FOLDED IN DISPATCH ORDER — and that order matters for
   * exactly one field.
   *
   * `running` is *the first stage that has not finished*, which is only true
   * read in the order the orchestrator dispatches. The PLAN publishes the two
   * in the other order (`src/prot/plan.ts` says why), so the fold happens here
   * and the LAYOUT happens below: a reader watching the run fill sees the stage
   * that is really in flight, whichever column it sits in.
   */
  const runnable = PROT_STAGES.map((declared): Omit<StepperStage, 'number' | 'name' | 'blockedBy' | 'landsAtRoot'> => {
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
  /** The one stage declared to the def and measured impossible on it — unchanged, and still its own state. */
  const unavailable = PROT_UNAVAILABLE_STAGES.map(
    (declared): Omit<StepperStage, 'number' | 'name' | 'blockedBy' | 'landsAtRoot'> => ({
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
  /**
   * A STEP THE PLAN DECLARES AND THE DEF HAS NEVER HEARD OF — every word of it
   * declared (`src/prot/plan.ts`), because nothing on this desk can fold one.
   *
   * A step with a blocker is the new mark; a step with none is performed by
   * something that is not an act — the parse, which lands the table before the
   * record starts — so it is LANDED with no commit to seek to, and its own line
   * says which.
   */
  const planOnly = (step: PlanStep): Omit<StepperStage, 'number' | 'name' | 'blockedBy' | 'landsAtRoot'> => ({
    stage: step.stage,
    label: step.question ?? step.name,
    state: step.blockedBy === null ? 'landed' : 'blocked',
    subtitle: step.line ?? step.name,
    detail: step.why,
    acts: [],
    declared: 0,
    commit: null,
    materialized: [],
  });
  /**
   * AND THE LAYOUT: the plan's order, the plan's numbers, the plan's short
   * names.
   *
   * Every declared stage of both of the def's lists is in `PROT_PLAN` — its own
   * load-time judge refuses a plan that forgot one — so nothing can fall
   * through this map and off the screen.
   */
  const folded = new Map([...runnable, ...unavailable].map((stage) => [stage.stage, stage]));
  return PROT_PLAN.map((step): StepperStage => ({
    ...(folded.get(step.stage) ?? planOnly(step)),
    number: step.step,
    name: step.name,
    blockedBy: step.blockedBy,
    // the step the def dispatches nothing for and nothing is blocking: the
    // parse, whose answer is true before the record starts
    landsAtRoot: !folded.has(step.stage) && step.blockedBy === null,
  }));
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
export function chartsOfStage(stage: StepperStage, shown: Readonly<Record<string, Readonly<Record<string, string>>>>, actColumns: ReadonlySet<string>): readonly string[] {
  const landed = new Set(stage.materialized);
  /**
   * THE PARSE'S OWN PICTURES — and they are an intersection like every other
   * stage's, not a special case.
   *
   * A view every one of whose bound columns was landed by NO ACT is a view
   * drawn from what the parse read off the file, which is exactly what step 1
   * landed (see {@link StepperStage.landsAtRoot}). The 3D structure and the
   * backbone-angle scatter bind `chain`, `phi` and `psi` and nothing else, so
   * they are step 1's; the run chart binds `sasa` and the bar binds
   * `interface_contacts`, both landed by acts, so neither is.
   *
   * `actColumns` is every column every act of this run landed
   * ({@link actColumnsOf}), so a re-encode that moves a picture onto a file
   * column hands it to step 1 and the foot follows — which is the same
   * behaviour every other stage's ownership already has. It is a REQUIRED
   * argument and was briefly optional: a caller who forgot it handed the parse
   * every picture on the desk, silently, and a default that can be wrong is
   * worse than one more argument.
   */
  if (stage.landsAtRoot) {
    return Object.entries(shown)
      .filter(([, channels]) => {
        const fields = Object.values(channels);
        return fields.length > 0 && fields.every((field) => !actColumns.has(field));
      })
      .map(([address]) => address);
  }
  const byColumn = Object.entries(shown)
    .filter(([, channels]) => Object.values(channels).some((field) => landed.has(field)))
    .map(([address]) => address);
  const receipts = stage.acts.flatMap((a) => {
    const view = PROT_RECEIPTS[a.act];
    return view === undefined || a.commit === null ? [] : [view];
  });
  return [...new Set([...byColumn, ...receipts])];
}

/** Every column every act of this run landed — the right side of the parse's own intersection. */
export function actColumnsOf(stages: readonly StepperStage[]): ReadonlySet<string> {
  return new Set(stages.flatMap((stage) => stage.materialized));
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
