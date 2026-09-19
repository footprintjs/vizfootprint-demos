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

/**
 * A PLAN-ONLY STEP THIS HOST IS NOT BLOCKED ON, and what it is doing right now
 * — the fix for the sharpest thing on the served page's boot screen.
 *
 * ── THE BUG, in the author's own screenshot ────────────────────────────────
 * During boot, the served page's stepper marked stage 5 **NOT ON THIS BUILD**
 * — on the build that was about to run it. The mark was right about the
 * PUBLISHED build and false about the one drawing it, and it only learned the
 * truth when the ask came back: until then `outcomes` held nothing for a
 * plan-only step, so the fold fell through to {@link planOnly} and printed the
 * plan's blocker.
 *
 * What was missing is a statement only the HOST can make. The served page knows
 * from its first paint that it is not the build the plan's blocker is about —
 * it asked the door before it opened the entry, and it holds a slot for the act
 * (`web/src/protServed.tsx` · `boot`). So it says so, per step, with what that
 * step is doing:
 *
 *   `not-run`   declared, and nothing has been asked yet. The stepper's own
 *               word for PENDING, and a different fact from `blocked`.
 *   `running`   the ask is in flight.
 *
 * An outcome still WINS over both, exactly as it wins over the blocked card:
 * once the run has said what it did, what the host expected is no longer the
 * interesting fact. And a host that says nothing gets today's screen, byte for
 * byte — which is what the PUBLISHED desk does, and what
 * `tests/prot-stepper.test.tsx` pins.
 */
export type AwaitedSteps = Readonly<Record<string, 'not-run' | 'running'>>;

/**
 * WHAT THE HOST KNOWS ABOUT ITS OWN RUN, and the second field is the ONE
 * SPINNER.
 *
 * ── WHY `live` EXISTS, and it is a defect it closes ────────────────────────
 * `running` used to be derived here as *the first declared stage that has not
 * finished, while the run is in flight* — which is right the moment the
 * orchestrator starts and WRONG for everything before it. On the served page's
 * boot screen that meant the SECOND stage's mark spun from the first paint,
 * through six http reads, an ETL and a dashboard build, while its stage had
 * dispatched nothing at all.
 *
 * That is precisely the lie this desk's blocked mark exists to prevent — *a
 * circle that spins forever is a promise; a circle that says why it cannot fill
 * is a fact* — one state along: a spinner on a step nothing is doing.
 *
 * So the HOST says which step is live, because the host is the only thing that
 * knows: it is reading the files, it is building the dashboard, it is asking
 * the model (`web/src/workbench/boot.ts` · `bootNow` is the one owner of that
 * answer, and the centred line under the stepper is its other half). Given a
 * `live`, exactly that step runs and no other; absent, the old derivation
 * stands and the desk is byte-identical.
 */
export interface HostSteps {
  /** Plan-only steps this host is not blocked on, and what each is doing — see {@link AwaitedSteps}. */
  readonly awaiting?: AwaitedSteps;
  /**
   * THE ONE STEP WHOSE MARK SPINS, as the host names it. `null` means nothing
   * is running; ABSENT means the host is not saying, and the fold derives it as
   * it always did.
   */
  readonly live?: string | null;
}

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
export function stepperStages(outcomes: readonly ActOutcome[], run: ProtRun | null, host: HostSteps = {}): readonly StepperStage[] {
  const inFlight = run === null;
  const awaiting = host.awaiting ?? {};
  /** The host's own answer to *which step is running*, when it gave one — see {@link HostSteps.live}. */
  const said = host.live;
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
    /*
      THE HOST'S WORD WINS. Where it named a live step, exactly that step runs
      and every other unfinished one is simply not run — which is what stops a
      mark spinning over a stage that has dispatched nothing
      ({@link HostSteps.live}). Where it said nothing, this is the derivation
      the desk has always used.
    */
    const running = said === undefined ? inFlight && !complete && !runningFound : said === declared.stage && !complete;
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
   * A STEP THE PLAN DECLARES, THE DEF DOES NOT, AND SOMETHING PERFORMED ANYWAY
   * — stage 5, on a build with a process standing in front of a model.
   *
   * ── WHY THIS ARM EXISTS AT ALL ─────────────────────────────────────────────
   * The plan publishes `hotspots` as *declared, and this build cannot perform
   * it*, and that is TRUE OF THE PUBLISHED BUILD and false of a local one. The
   * plan is not edited for it and must not be: a static page really cannot hold
   * the key, the def really dispatches nothing for it, and the load-time judge
   * that keeps those two honest stays exactly as it is
   * (`src/prot/plan.ts` · `judgeThePlan`).
   *
   * What changes is the RUN's account of itself. An act for a plan-only step in
   * `outcomes` is a host saying *I performed this*, and it can only have got
   * there by dispatching a real act on the real session
   * (`src/prot/session.ts` · `landHotspots`). So the outcome wins over the
   * blocked card, in exactly the way a landed act wins over a not-run circle
   * for every other stage — and a host that performed nothing hands over no
   * outcome and gets today's screen, byte for byte.
   *
   * `declared` is the number of acts that came back rather than a list's
   * length, because nothing declares how many acts this step dispatches: the
   * def has never heard of it.
   */
  const performed = (step: PlanStep, acts: readonly ActOutcome[]): Omit<StepperStage, 'number' | 'name' | 'blockedBy' | 'landsAtRoot'> => {
    const refusals = acts.flatMap((a) => (a.refusal === null ? [] : [a.refusal]));
    const materialized = acts.flatMap((a) => a.materialized);
    const landedCommits = acts.flatMap((a) => (a.commit === null ? [] : [a.commit]));
    /*
      THE LATEST ATTEMPT DECIDES THE MARK, and every earlier one is still on the
      act rows — which is what a RETRY needs.

      A reader can ask stage 5 again (`web/src/protServed.tsx` ·
      `onRetryHotspots`), and each ask lands its own act: the refusal stays on
      the ledger and is never overwritten. So a stage whose first ask was
      refused and whose second answered is LANDED — that is what happened — and
      `detail` still carries every refusal sentence, verbatim, so nothing is
      hidden by the mark moving on. With one act this is byte-identical to the
      reading it replaced.
    */
    const last = acts[acts.length - 1];
    const refusedNow = last !== undefined && last.refusal !== null;
    return {
      stage: step.stage,
      label: step.question ?? step.name,
      state: refusedNow ? 'refused' : 'landed',
      subtitle: refusedNow ? `${plural(refusals.length, 'act', 'acts')} of this step ${refusals.length === 1 ? 'was' : 'were'} refused` : landedSubtitle(acts, materialized),
      // THE REFUSAL SENTENCES, VERBATIM, and NOT the plan's own reason: the
      // plan says this build cannot perform the step, and on a build that just
      // did, printing that paragraph would be the screen contradicting the log
      detail: refusals.length === 0 ? null : refusals.join(' · '),
      acts,
      declared: acts.length,
      commit: landedCommits.length === 0 ? null : landedCommits[landedCommits.length - 1]!,
      materialized,
    };
  };
  /**
   * A STEP THE PLAN DECLARES, THE DEF DOES NOT, AND THIS HOST IS ABOUT TO
   * PERFORM — the boot state of stage 5 on a build with a process behind it.
   *
   * It is the PENDING arm, and the whole of why it exists is that *a step that
   * has not happened yet must not read as a step that failed* — nor as one the
   * build cannot do. The two states it can be in are the stepper's own words
   * for pending and in-flight ({@link AwaitedSteps}), the tag is therefore the
   * state's (which is `null` for both) rather than the plan's blocker, and the
   * DETAIL is the plan's own reason DELIBERATELY OMITTED: that paragraph is
   * about a static page, and quoting it here is the mistake this arm fixes.
   */
  const awaited = (step: PlanStep, state: 'not-run' | 'running'): Omit<StepperStage, 'number' | 'name' | 'blockedBy' | 'landsAtRoot'> => ({
    stage: step.stage,
    label: step.question ?? step.name,
    state,
    subtitle:
      state === 'running'
        ? 'asking now — nothing has landed yet, and no part of an answer is shown until the whole of it is frozen'
        : 'declared, and nothing has been asked yet on this session — it has landed nothing, so there is nothing here to go back to',
    detail: null,
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
  return PROT_PLAN.map((step): StepperStage => {
    /** What this run says it did for a step the def declares nothing for — empty for every other step. */
    const performedActs = folded.has(step.stage) ? [] : outcomes.filter((o) => o.stage === step.stage);
    /** What the HOST says about a plan-only step it is not blocked on — see {@link AwaitedSteps}. An outcome wins over it. */
    /**
     * What the HOST says about a plan-only step it is not blocked on — and the
     * host's `live` wins over its own `awaiting`, because a step it named as
     * running is running whatever it said a moment ago.
     */
    const pending = folded.has(step.stage) || performedActs.length > 0 ? undefined : said === step.stage ? 'running' : awaiting[step.stage];
    return {
      ...(folded.get(step.stage) ?? (performedActs.length > 0 ? performed(step, performedActs) : pending !== undefined ? awaited(step, pending) : planOnly(step))),
      number: step.step,
      name: step.name,
      // A STEP SOMETHING PERFORMED IS NOT BLOCKED, whatever the plan says about
      // the build that publishes it: the blocker is the PUBLISHED build's and
      // the outcome is THIS run's, and a mark that said both would be the
      // stepper holding two ideas of the same fact.
      //
      // NOR IS A STEP THIS HOST IS WAITING ON. That mark used to carry the
      // published build's blocker for the whole of a served boot, on the very
      // build that was about to perform the step — the same two ideas of one
      // fact, one moment earlier.
      blockedBy: performedActs.length > 0 || pending !== undefined ? null : step.blockedBy,
      // the step the def dispatches nothing for and nothing is blocking: the
      // parse, whose answer is true before the record starts
      landsAtRoot: !folded.has(step.stage) && performedActs.length === 0 && pending === undefined && step.blockedBy === null,
    };
  });
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
 *
 * ── AND A PICTURE DRAWN FROM TWO STAGES BELONGS TO THE LATER ONE ────────────
 * Every picture on this desk used to bind at most ONE act's columns, so this
 * question never arose and the answer was *whichever stage matched first*
 * (`./workbench/charts.ts` · `stageOfChart` reads this fold and takes the first
 * hit). Stage 5's own chart is the first picture that binds two: its HEIGHT is
 * `interface_contacts`, which stage 4 landed, and its COLOUR is `hotspot_rank`,
 * which stage 5 did (`src/prot/def.ts` · `RANKING_ENCODING` argues both). Left
 * alone, stage 4 would have owned it — its name on the card, its column in the
 * rail's order, and the stepper's bar moving to STAGE 4 when a reader pressed
 * 5, which is the misattribution this whole fold exists to prevent.
 *
 * So ownership is EXCLUSIVE and it belongs to the last contributor: a stage
 * owns a picture when it landed a column that picture binds AND no stage after
 * it did. That is a fact rather than a tie-break — **a picture is produced when
 * its last ingredient lands**, and at stage 4's cursor this chart has no rank
 * column and therefore no marks at all. `stages` is what makes "after"
 * answerable, and it is the whole list in the PLAN's order because that is the
 * order `stepperStages` returns and the order the screen reads.
 *
 * Every picture that had one owner keeps it, byte for byte: with no overlap
 * there is no later stage to lose to.
 */
export function chartsOfStage(
  stage: StepperStage,
  shown: Readonly<Record<string, Readonly<Record<string, string>>>>,
  actColumns: ReadonlySet<string>,
  stages: readonly StepperStage[],
  /**
   * WHICH ACT'S OWN ANSWER IS DRAWN BY WHICH VIEW — act id → view id, the one
   * arm of this fold nothing on the wire can compute.
   *
   * It defaults to the protein desk's declaration, so every existing caller is
   * byte-identical. A SECOND DESK hands in its own: the measured desk declares
   * no receipt view at all, so it passes an empty map and this arm contributes
   * nothing — which is the true answer for a desk whose every act lands columns
   * on the residues table.
   */
  receipts: Readonly<Record<string, string>> = PROT_RECEIPTS,
): readonly string[] {
  const landed = new Set(stage.materialized);
  /**
   * EVERY COLUMN A STAGE AFTER THIS ONE LANDED — the half that makes ownership
   * exclusive.
   *
   * A stage the list does not hold has nothing after it: the answer is then the
   * intersection this fold always computed, which is what keeps a caller
   * reasoning about one stage (a test, a card) from being told it owns nothing.
   */
  const at = stages.findIndex((s) => s.stage === stage.stage);
  const after = new Set(at < 0 ? [] : stages.slice(at + 1).flatMap((s) => s.materialized));
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
    .filter(([, channels]) => {
      const fields = Object.values(channels);
      // this stage landed one of them — AND no stage after it did, which is
      // what hands a two-stage picture to the stage it could not draw without
      return fields.some((field) => landed.has(field)) && !fields.some((field) => after.has(field));
    })
    .map(([address]) => address);
  const drawn = stage.acts.flatMap((a) => {
    const view = receipts[a.act];
    return view === undefined || a.commit === null ? [] : [view];
  });
  return [...new Set([...byColumn, ...drawn])];
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
