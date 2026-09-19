/**
 * THE BOOT, AS RULES — LAYER 3: the fold from what the boot REPORTED to the
 * lines `./BootReport.tsx` draws. Pure; no React, no DOM, no session, no fetch.
 *
 * ── WHY THIS FILE EXISTS, in the author's words ────────────────────────────
 * *"Why is this not live status support instead of this static text?"* — asked
 * while watching the served page boot behind one paragraph
 * (`web/site/boot.tsx` · `Reading`) that says the page *is fetching the
 * committed files and running the same ETL the server runs*. True, and true
 * for the whole of a boot in which the page really performs six http reads, an
 * ETL, a dashboard build, four probe gestures, four stages and a model call.
 * **Every one of those is a fact the page held and threw away.**
 *
 * ── THE LAW, AND IT DECIDES EVERY LINE BELOW ───────────────────────────────
 * **Progress is a REPORT: transient, reaching no commit, never evidence, and
 * nothing computes from it. A stage's STATE is a fact and belongs on screen; a
 * PAYLOAD never does.** So every line here is a count, a declared name, or a
 * sentence somebody else already wrote down (a refusal's own words, verbatim).
 * There is no value of the data in any of them, and stage 5 has its own
 * sharper version of the same rule (`src/prot/streamReports.ts`).
 *
 * ── AND THE TWO DISTINCTIONS THAT ARE EACH A TEST ──────────────────────────
 * 1. **A step that has not happened yet must not read as a step that failed.**
 *    `pending` and `refused` are different facts, and {@link BootStepState}
 *    keeps four words rather than a boolean.
 * 2. **A total is reported only when it is known.** Bytes-so-far is always a
 *    fact a page holds; a percentage usually is not, because `content-length`
 *    is the size of what came over the wire and the bytes counted are decoded
 *    (`src/prot/http.ts` · `FileRead.total` has the measurement). So
 *    {@link bytesSaid} makes *unknown total* a first-class answer instead of a
 *    zero.
 */
import { PROT_STAGES } from '../../../src/prot/analyses.js';
import { PROT_COMMITTED_READS } from '../../../src/prot/http.js';
import type { FileRead } from '../../../src/prot/http.js';
import { planStepOf } from '../../../src/prot/plan.js';
import type { ActOutcome } from '../../../src/prot/orchestrator.js';
import type { HotspotReport } from '../../../src/prot/streamReports.js';
// THE COMPONENT'S OWN PROP TYPES — the `./steps.ts` · `StepView` precedent: the
// fold answers exactly what `./BootReport.tsx` takes, so the composition
// spreads it and the two sides cannot drift.
import type { BootStepState, BootStepView } from './BootReport.js';

/**
 * THE FILE READS, AS A REPORT — what has been asked for and what has come
 * back.
 *
 * `total` is the count of DECLARED files, which is known before the first read
 * because the list is declared (`src/data/files.ts`, counted by
 * `PROT_COMMITTED_READS`) rather than discovered. It is `null` for an entry
 * that is not the committed one: there the archive names the accessions and the
 * accessions name the families, so how many reads a boot will make is not a
 * fact anybody holds at the start — and borrowing the committed entry's number
 * would be a guess wearing a total's clothes.
 */
export interface ReadsReport {
  /** Every file that came back, in read order. */
  readonly done: readonly FileRead[];
  /** The one being read now, or `null` between reads. */
  readonly asking: string | null;
  /** How many files this boot will read, when that is known. */
  readonly total: number | null;
  /** The sentence a read was refused with, verbatim. `null` while none was. */
  readonly refusal: string | null;
}

/** What the boot has reported so far. One object, so a page holds one piece of state for the whole of it. */
export interface BootReport {
  readonly reads: ReadsReport;
  /** The ETL's own counts, once it has run: residues and chains. `null` before. */
  readonly parsed: { readonly residues: number; readonly chains: number } | null;
  /** What the dashboard build said about itself. `null` before. */
  readonly built: { readonly views: number; readonly acts: number; readonly rows: number } | null;
  /** What the probe gestures answered. `null` before. */
  readonly probed: { readonly asked: number; readonly refused: number } | null;
  /** The acts the run has handed back, in dispatch order. */
  readonly outcomes: readonly ActOutcome[];
  /** The latest report from stage 5's ask, per act — `null` for a boot that has not reached it. */
  readonly asking: HotspotReport | null;
  /** Stage 5's own outcome, once it has one. */
  readonly hotspots: ActOutcome | null;
}

/** A boot that has reported nothing — what a page starts from. */
export const NOTHING_REPORTED: BootReport = {
  reads: { done: [], asking: null, total: null, refusal: null },
  parsed: null,
  built: null,
  probed: null,
  outcomes: [],
  asking: null,
  hotspots: null,
};

const count = (n: number): string => n.toLocaleString('en-US');

/**
 * HOW MANY BYTES, AND OUT OF HOW MANY WHEN THAT IS KNOWN — the *unknown total*
 * answer, written down once.
 *
 * `total === null` is the ordinary case and it is not a failure: a served page
 * reads its files through whatever compression the server chose, so
 * `content-length` is the compressed size while the bytes counted are decoded,
 * and a percentage of one against the other runs past 100 and then stops.
 * Saying *no total* is the honest report; a zero would be a number, and a
 * number is a claim.
 */
export function bytesSaid(bytes: number, total: number | null): string {
  return total === null ? `${count(bytes)} bytes read, no total — the response's own content-length is the size of what came over the wire, and these are the decoded bytes` : `${count(bytes)} of ${count(total)} bytes`;
}

/**
 * WHAT THE READS ARE DOING, in one line — which file, and how many of how
 * many.
 *
 * The count is *files that came back* out of *files this boot will read*, and
 * the second half is simply absent where it is not known ({@link ReadsReport.total}).
 */
export function readsSaid(reads: ReadsReport): string {
  const bytes = reads.done.reduce((n, read) => n + read.bytes, 0);
  const totals = reads.done.map((read) => read.total);
  /** The whole boot's total is known only when EVERY read's was — one unknown makes the sum a guess. */
  const total = reads.done.length > 0 && totals.every((one): one is number => one !== null) ? totals.reduce((n, one) => n + one, 0) : null;
  const of = reads.total === null ? `${count(reads.done.length)} ${reads.done.length === 1 ? 'file' : 'files'}, and how many there are in total is not known for an entry read from the archive` : `file ${count(Math.min(reads.done.length + (reads.asking === null ? 0 : 1), reads.total))} of ${count(reads.total)}`;
  if (reads.asking !== null) return `${of} — reading ${reads.asking}; ${bytesSaid(bytes, total)} so far`;
  if (reads.done.length === 0) return 'nothing has been asked for yet';
  return `${of} — ${bytesSaid(bytes, total)}`;
}

/**
 * WHAT THE READS ARE DOING, as one of the four states — and `landed` means
 * ALL of them, not *the last one came back*.
 *
 * Between two reads nothing is in flight for an instant, and a state read off
 * `asking !== null` alone would flash `landed` five times during a boot of six
 * files. Where the total is known the answer is simple: the reads have landed
 * when as many have come back as there are. Where it is not (an entry from the
 * archive), *in flight* is the honest answer for as long as any read has
 * happened and the boot has not moved on — and `moved on` is read off the
 * report rather than guessed: the dashboard is built AFTER the last read
 * (`web/src/protServed.tsx` · `boot` is the order), so a build that has
 * happened is a read step that is over whatever its total was.
 */
function readsState(reads: ReadsReport, built: boolean): BootStepState {
  if (reads.refusal !== null) return 'refused';
  if (reads.done.length === 0) return reads.asking === null ? 'pending' : 'doing';
  if (built) return 'landed';
  if (reads.total === null) return 'doing';
  return reads.done.length >= reads.total ? 'landed' : 'doing';
}

/** What one stage's own act said — landed with its columns, or refused with its own sentence. */
function stageLine(acts: readonly ActOutcome[]): string {
  const columns = acts.flatMap((act) => act.materialized);
  const commits = acts.filter((act) => act.commit !== null).length;
  if (columns.length > 0) return `landed ${count(columns.length)} ${columns.length === 1 ? 'column' : 'columns'} — ${columns.join(', ')}`;
  return `landed ${count(commits)} ${commits === 1 ? 'commit' : 'commits'} and wrote no column into the data space`;
}

/**
 * WHAT STAGE 5'S ASK IS DOING, in ONE SHORT LINE — the report, as the words
 * that go under the stepper and on the card.
 *
 * ── THE REGISTER, and it is the author's own ruling ────────────────────────
 * These used to be written like log entries: a fact, an em-dash, an
 * explanation. *Under a stepper, centred, one line, that register is wrong —
 * the explanation belongs in the record and the line belongs to the act.* So
 * present tense, short, no explanatory clause, and a number only where the
 * number is the point. The explanations are not lost: they are
 * {@link askingLogged}'s, in the record drawer.
 *
 * The one line that keeps its clause is the RE-ASK, because *the answer did not
 * parse* and *asking once more* are two halves of one fact and a reader needs
 * both — and because that row is the whole reason this channel exists.
 *
 * EVERY LINE IS A COUNT OR A DECLARED WORD. There is no arm of this switch that
 * renders text a model produced, because there is no field on the report that
 * carries any — which is what makes *show the act, never the answer* a property
 * of the type rather than of this function's discipline.
 */
export function askingSaid(report: HotspotReport): string {
  switch (report.act) {
    case 'asking':
      return `asking ${report.model} \u00b7 ${count(report.facts)} facts about ${count(report.residues)} residues`;
    case 'reading-evidence':
      return 'the model is reading this run\u2019s evidence';
    case 'read-evidence':
      return `it read ${count(report.served)} facts, one per id`;
    case 'answering':
      return `answering \u00b7 ${count(report.tokens)} ${report.tokens === 1 ? 'token' : 'tokens'}`;
    case 'thinking':
      return `thinking \u00b7 ${count(report.chunks)} ${report.chunks === 1 ? 'block' : 'blocks'}`;
    case 're-asking':
      return `the answer did not ${report.why === 'json-parse' ? 'parse' : 'fit the declared shape'} \u2014 asking once more`;
    case 'retrying':
      return `the call failed \u2014 asking again, attempt ${count(report.attempt)}`;
    case 'scoring':
      return 'scoring against the ledger';
  }
}

/**
 * THE SAME REPORT, FOR THE RECORD — with the explanation the centred line
 * cannot carry.
 *
 * This is where *a count of the act, and no part of what it says is shown until
 * the whole answer is frozen* belongs: a reader who opens the record wants to
 * know why a token count is all they were given, and a reader watching a boot
 * wants to know what is happening. Two registers, two sentences, one report.
 */
export function askingLogged(report: HotspotReport): string {
  switch (report.act) {
    case 'asking':
      return `asking ${report.model} \u2014 ${count(report.facts)} facts about ${count(report.residues)} residues served, both known before the call`;
    case 'reading-evidence':
      return 'the model called the evidence tool \u2014 the one tool it has, and the only way it sees this run\u2019s ledger';
    case 'read-evidence':
      return `it read the evidence: ${count(report.served)} facts, one per id`;
    case 'answering':
      return `answering\u2026 ${count(report.tokens)} ${report.tokens === 1 ? 'token' : 'tokens'} \u2014 a count of the act, and no part of what it says is shown until the whole answer is frozen`;
    case 'thinking':
      return `thinking\u2026 ${count(report.chunks)} ${report.chunks === 1 ? 'block' : 'blocks'} of reasoning, counted and not shown`;
    case 're-asking':
      return `the answer did not ${report.why === 'json-parse' ? 'parse' : 'fit the declared shape'} \u2014 asking once more with the library\u2019s own validator quoted back, attempt ${count(report.attempt)}, ${count(report.remaining)} ${report.remaining === 1 ? 'correction' : 'corrections'} left`;
    case 'retrying':
      return `the call failed and was retried \u2014 attempt ${count(report.attempt)}`;
    case 'scoring':
      return 'scoring against the ledger \u2014 the standing judge reading the same evidence as a second source';
  }
}

/**
 * WHERE THE BOOT IS, AND WHAT IT IS DOING — ONE fact with two faces, answered
 * once so the two faces cannot disagree.
 *
 * ── WHY IT IS ONE FUNCTION ─────────────────────────────────────────────────
 * The author's ruling reshaped this screen: **the stepper carries the progress,
 * one centred line sits under it, and the list stops being the status display.**
 * That is this desk's own law rather than taste — *the stage stepper IS the
 * cursor* — and a vertical list narrating the same progression beside it is a
 * SECOND ANSWER to one question.
 *
 * Which means the spinner and the line are both answers to *what is happening
 * now*, and two owners of that question will eventually disagree. So one
 * function answers it: {@link BootNow.stage} is the mark that spins and
 * {@link BootNow.line} is the sentence under it, and neither is derived
 * anywhere else.
 *
 * ── AND WHY THE MARK IS A PLAN STEP RATHER THAN A PHASE ────────────────────
 * The stepper's columns are the PLAN's six steps. The reads, the ETL, the
 * dashboard build and the probe gestures all happen over STEP 1's own result —
 * the residues table is what step 1 lands (`src/prot/plan.ts` · step 1: *its
 * result is the residues table*) — so step 1 is the mark that spins through all
 * four, and the LINE is what says which of them is happening. The three
 * dispatched stages and stage 5 spin on their own marks.
 */
export interface BootNow {
  /** The one centred line, present tense — the act happening now. */
  readonly line: string;
  /**
   * The PLAN STEP whose mark spins. `null` when nothing is running, which is
   * the state a finished boot is in — and a spinner on a step nothing is doing
   * is exactly the promise this desk's fifth stepper state exists to prevent.
   */
  readonly stage: string | null;
}

/**
 * WHAT THE BOOT IS DOING NOW, read off the FRONTIER of an append-only report.
 *
 * The order of the checks is the order the boot reports in reverse — the newest
 * thing reported is what is happening — and it is the boot's real order
 * (`web/src/protServed.tsx` · `boot`): the structure file, the parse, the
 * conservation files, the build, the probes, the four stages, the ask.
 *
 * ── THE TWO RULES ON THE WORDING, and both are the author's ────────────────
 * **A number appears only where it is the point.** *6 of 6* is the point;
 * 335,217 bytes is the record's business and lives in the log
 * ({@link bootSteps}), because a centred line under a stepper is not a log
 * entry and the register of *a fact, an em-dash, an explanation* is wrong
 * there.
 *
 * **A step that produced a refusal says so in the line** rather than reading as
 * success — and *3 gestures, 3 refused* is this step SUCCEEDING, which is why
 * it says the numbers rather than a verdict.
 */
export function bootNow(report: BootReport): BootNow {
  const rows = report.parsed?.residues ?? report.built?.rows ?? 0;
  /** The stage the RUN is walking, in dispatch order — the same reading the log's rows take. */
  const walking = DISPATCHED_ORDER.find((stage) => !report.outcomes.some((one) => one.stage === stage)) ?? null;
  if (report.hotspots !== null) return { line: report.hotspots.refusal === null ? 'the desk is ready' : 'stage 5 landed no ranking', stage: null };
  if (report.asking !== null) return { line: askingSaid(report.asking), stage: HOTSPOTS_STEP };
  /*
    THE PROBES ARE BACK, SO THE RUN HAS BEGUN — and that is the code's own
    order rather than a guess: `src/prot/session.ts · openProtSurfaceAsync`
    makes the three gestures and then dispatches the stages, with nothing
    between them. So the line names the stage that is RUNNING, never *3
    gestures, 3 refused* — which would be a status line reporting a result
    while something else was happening.

    That count is not lost: it is the probe step's own line in the record
    (`bootSteps`, drawn by `./BootReport.tsx · BootLog`), which is where a
    result belongs.
  */
  if (report.probed !== null) {
    if (walking === null) return { line: 'asking a model which residues it would call hot spots', stage: HOTSPOTS_STEP };
    return { line: stageDoing(walking, rows), stage: walking };
  }
  if (report.built !== null) return { line: 'asking each chart whose column has not landed', stage: PARSE_STEP };
  if (report.reads.refusal !== null) return { line: 'a committed file could not be read', stage: PARSE_STEP };
  if (report.reads.asking !== null || report.parsed === null) return { line: readingLine(report.reads), stage: PARSE_STEP };
  // the parse is back and nothing newer is: either more declared files are
  // still to come, or they are all in and the build is what is happening
  const allIn = report.reads.total !== null && report.reads.done.length >= report.reads.total;
  return {
    line: allIn ? `building the dashboard over ${count(rows)} rows` : `parsing ${count(report.parsed.residues)} residues in ${count(report.parsed.chains)} ${report.parsed.chains === 1 ? 'chain' : 'chains'}`,
    stage: PARSE_STEP,
  };
}

/** The plan step the reads, the parse, the build and the probes all happen over — see {@link BootNow}. */
const PARSE_STEP = 'search';
const HOTSPOTS_STEP = 'hotspots';

/** WHICH FILE, AND HOW MANY OF HOW MANY — the one place a count is the point. */
function readingLine(reads: ReadsReport): string {
  if (reads.total === null) return reads.done.length === 0 ? 'reading the committed files' : `reading the committed files · ${count(reads.done.length)} so far`;
  const at = Math.min(reads.done.length + (reads.asking === null ? 0 : 1), reads.total);
  return reads.done.length === 0 && reads.asking === null ? 'reading the committed files' : `reading the committed files · ${count(at)} of ${count(reads.total)}`;
}

/**
 * WHAT ONE DISPATCHED STAGE IS DOING, in its own words — declared beside the
 * step rather than composed at the call site, which is the author's own rule:
 * *write them as data beside each step, so the one line and the stepper cannot
 * disagree about which stage is live*.
 */
const STAGE_DOING: Readonly<Record<string, (rows: number) => string>> = {
  conservation: (rows) => `placing ${count(rows)} residues in their family’s alignment`,
  surface: (rows) => `rolling a solvent probe over ${count(rows)} residues`,
  interactions: () => 'finding every contact across the interface',
  // STAGE 6 is the second stage dispatched and the sixth step published, and
  // the line says what it DOES rather than what it is called — which is the
  // rule the three above it keep.
  // LOOKING UP and not *asking*: the model's own line starts with `asking`
  // (`askingSaid`), and two steps whose lines open with one verb are two steps a
  // reader — and a test — cannot tell apart at a glance.
  annotation: () => 'looking up what is already known about these sequences',
};

const stageDoing = (stage: string, rows: number): string => STAGE_DOING[stage]?.(rows) ?? `running ${nameOf(stage)}`;

/**
 * THE BOOT'S OWN STEPS — the declared list, laid over what has been reported.
 *
 * It is the `../protStages.ts` · `stepperStages` shape one tier down and for
 * the same reason: the list of steps is a DECLARED fact, so showing it is
 * honest, as long as a step that has not happened looks like one and a step
 * that was refused says so in the words of whatever refused it.
 *
 * The four stage steps are named by the PLAN (`src/prot/plan.ts`), so the boot
 * report and the stepper above it cannot call one stage two things.
 */
export function bootSteps(report: BootReport): readonly BootStepView[] {
  const step = (key: string, name: string, state: BootStepState, line: string, refusal: string | null = null): BootStepView => ({ key, name, state, line, refusal });
  const reads: BootStepView = step('reads', 'the committed files, over http', readsState(report.reads, report.built !== null), readsSaid(report.reads), report.reads.refusal);
  /**
   * THE ETL IS THE PLAN'S STEP 1, and the row is named by the plan like every
   * other stage's — the parse is what that step's result IS (`src/prot/plan.ts`
   * · step 1: *its result is the residues table*), and giving it a name of this
   * file's own would be a second spelling of a declared label.
   */
  const parsed: BootStepView = step(
    'search',
    nameOf('search'),
    report.parsed === null ? 'pending' : 'landed',
    report.parsed === null ? '' : `the parse read ${count(report.parsed.residues)} residues in ${count(report.parsed.chains)} ${report.parsed.chains === 1 ? 'chain' : 'chains'} off the file’s own coordinate records — one row each, and no commit of its own`,
  );
  const built: BootStepView = step(
    'build',
    'the dashboard, through the firewall',
    report.built === null ? 'pending' : 'landed',
    report.built === null ? '' : `${count(report.built.views)} views and ${count(report.built.acts)} declared acts over ${count(report.built.rows)} rows`,
  );
  const probed: BootStepView = step(
    'probe',
    'one gesture at each chart with no column yet',
    report.probed === null ? 'pending' : 'landed',
    report.probed === null
      ? ''
      : `${count(report.probed.asked)} gestures made, ${count(report.probed.refused)} refused by the library — and a refusal is the answer this step wants, because the columns those charts read have not landed`,
  );
  /**
   * THE THREE DISPATCHED STAGES, in the order the plan publishes them, each
   * with whatever its own acts have said.
   *
   * ── WHICH ONE IS *DOING*, AND WHY IT IS NOT ALL OF THEM ────────────────────
   * Exactly ONE stage is in flight at a time — the orchestrator awaits each
   * stage before the next starts — so the honest answer is *the first stage
   * that has not answered, read in DISPATCH order*. That is the same rule
   * `../protStages.ts` · `stepperStages` keeps for the stepper's moving mark,
   * and it has to be read in the dispatch order because the plan publishes
   * these in a different one (`src/prot/plan.ts` says why).
   *
   * Every other unanswered stage is `pending`, and before the session exists
   * they all are: nothing has been dispatched at all. Neither of them is
   * `refused`.
   */
  const waiting = report.built === null ? null : (DISPATCHED_ORDER.find((stage) => !report.outcomes.some((one) => one.stage === stage)) ?? null);
  const stages = DISPATCHED_STEPS.map((stage): BootStepView => {
    const acts = report.outcomes.filter((one) => one.stage === stage);
    const refusals = acts.flatMap((act) => (act.refusal === null ? [] : [act.refusal]));
    if (refusals.length > 0) return step(stage, nameOf(stage), 'refused', `${count(refusals.length)} of its acts ${refusals.length === 1 ? 'was' : 'were'} refused`, refusals.join(' · '));
    if (acts.length === 0) return step(stage, nameOf(stage), stage === waiting ? 'doing' : 'pending', stage === waiting ? 'running now — its acts are in flight' : 'declared, and not dispatched yet');
    return step(stage, nameOf(stage), 'landed', stageLine(acts));
  });
  /*
    THE MODEL'S ROW SITS AT ITS OWN PLAN STEP, not at the end.

    It used to be appended last, which was the same thing while stage 5 was the
    last step of the pipeline. Stage 6 is dispatched too now, and appending
    would have put step 6 BEFORE step 5 in a list whose whole claim is that it
    is the reader's order. So the rows are laid out by the plan's own step
    number (`src/prot/plan.ts` · `planStepOf`), which is the one declaration of
    where each step belongs.
  */
  const asked = hotspotStep(report, step);
  const ordered = [...stages, asked].sort((a, b) => (planStepOf(a.key)?.step ?? 0) - (planStepOf(b.key)?.step ?? 0));
  return [reads, parsed, built, probed, ...ordered];
}

/**
 * STAGE 5's OWN LINE, and it is the one step whose pending state is a whole
 * packet's worth of argument.
 *
 * While the ask is in flight the line is {@link askingSaid}'s — the ACT, and
 * never the answer. When it comes back the line is the act's own: the columns
 * it landed, or the refusal's own sentence, verbatim.
 */
function hotspotStep(report: BootReport, step: (key: string, name: string, state: BootStepState, line: string, refusal?: string | null) => BootStepView): BootStepView {
  const name = nameOf('hotspots');
  const landed = report.hotspots;
  if (landed !== null) {
    return landed.refusal !== null ? step('hotspots', name, 'refused', 'the stage ran and landed no ranking', landed.refusal) : step('hotspots', name, 'landed', stageLine([landed]));
  }
  if (report.asking !== null) return step('hotspots', name, 'doing', askingLogged(report.asking));
  return step('hotspots', name, 'pending', 'declared, and nothing has been asked yet');
}

/**
 * THE FOUR STAGES THE RUN DISPATCHES, in the PLAN's published order — spelled
 * here rather than read off `PROT_STAGES`, because the plan's order and the
 * orchestrator's differ (`src/prot/plan.ts` says why: the def dispatches
 * contacts before surface, and it dispatches the annotation stage SECOND while
 * the pipeline publishes it sixth).
 *
 * The boot report is a reader's list, so it is the reader's order. With the
 * parse above them and stage 5 among them, these are steps 2, 3, 4 and 6 of the
 * six the plan publishes.
 */
const DISPATCHED_STEPS: readonly string[] = ['conservation', 'surface', 'interactions', 'annotation'];

/**
 * THE SAME THREE, IN THE ORDER THE ORCHESTRATOR DISPATCHES THEM — read off the
 * declaration rather than spelled, because *which stage is in flight* is only
 * true in that order and nothing else here needs it.
 *
 * Two orders for one list is the thing this repository normally refuses; here
 * they are two DIFFERENT facts about one list (the pipeline publishes one, the
 * chart runs the other), which is exactly the split `src/prot/plan.ts`
 * documents — so the layout reads the plan's and this one line reads the def's.
 */
const DISPATCHED_ORDER: readonly string[] = PROT_STAGES.map((stage) => stage.stage);

/**
 * A STEP'S NAME, from the one list that declares it — and a LOUD fallback
 * rather than a quiet one.
 *
 * A plan that stopped naming a step this file reports would be a boot report
 * with a stage id where a name should be, which is exactly the kind of drift
 * the plan's own load-time judge exists to refuse. Printing the id says so
 * instead of hiding it (`src/prot/plan.ts` · `judgeThePlan`).
 */
const nameOf = (stage: string): string => planStepOf(stage)?.name ?? stage;
