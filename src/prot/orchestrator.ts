/**
 * THE ORCHESTRATOR — one footprintjs chart with a stage per declared stage,
 * landing them in order, and whose recorder keeps the account of it.
 *
 * ```
 *   stage "interactions"  →  declareAnalysis(interactionPairs)     → a commit
 *                            declareAnalysis(residueContacts)      → a commit
 *   stage "surface"       →  declareAnalysis(residueSurface)       → a commit
 *   stage "conservation"  →  declareAnalysis(residueConservation)  → a commit
 * ```
 *
 * ── WHY A CHART AND NOT A LOOP ──────────────────────────────────────────────
 * Two reasons, and neither is decoration.
 *
 * **The ordering is the chart's, not a comment's.** A stage function that
 * `await`s every act it dispatches, followed by a stage that does the same, IS
 * the guarantee that the surface picture cannot land before the interaction
 * picture. There is no queue, no promise race and no "await these in
 * sequence" convention for a later edit to break: the second stage does not
 * start until the first has returned.
 *
 * **The account is a recorder's, not a caption's.** The run carries a
 * `narrative()` and the sentences come back on {@link ProtRun.narrative} — a
 * per-stage record of what was dispatched and what came back. That is the
 * evidence a later packet can hand a language model, and it is collected
 * during the traversal rather than reconstructed from the result: the
 * footprintjs law this whole family is built on.
 *
 * ── WHAT THE CHART'S OWN STATE HOLDS, and what it deliberately does not ─────
 * A stage writes its stage's SUMMARY — the act ids, the commit each one landed,
 * the refusal if there was one, and the act's own counts. It does NOT write the
 * 224 interaction rows, and that is a decision rather than an oversight: those
 * rows are already evidence on the dashboard's own log (the act that cut them
 * landed a commit there), and a second copy on a second log would leave the
 * desk with two answers to "where did this table come from". They come back on
 * {@link ProtRun} for `./session.ts` to hold beside the session, exactly where
 * the structure bytes are held and for the same reason.
 *
 * ── THE SESSION IS CLOSED OVER, NEVER PASSED IN ─────────────────────────────
 * A footprintjs stage's arguments must survive `structuredClone`, and a live
 * `InteractionSession` — with its providers, its engines and its gap ledger —
 * survives nothing of the kind. So {@link runProtStages} takes the session as
 * a FACTORY argument and the chart's input carries only the declarative facts:
 * the act ids and how many of them each stage will dispatch. That is also what
 * makes the narrative readable — a sentence about `interactionPairs` rather
 * than about an object nobody can print.
 */
import { flowChart } from 'footprintjs';
import type { InteractionSession } from 'vizfootprint/agent';
import type { Cause } from 'vizfootprint/cause';
import { CONSERVATION_ACT, CONTACTS_ACT, PAIRS_ACT, PROT_STAGES, SURFACE_ACT, type ConservationOutput, type ContactsOutput, type PairsOutput, type SurfaceOutput } from './analyses.js';

/** What one act did — the row the narrative renders and the desk's captions read. */
export interface ActOutcome {
  /** The stage that dispatched it (`interactions`, `surface`). */
  readonly stage: string;
  /** The analysis id. */
  readonly act: string;
  /** The dashboard commit this act landed, or `null` when it landed none. */
  readonly commit: string | null;
  /** The sentence it was refused with, or `null` when it landed. */
  readonly refusal: string | null;
  /** The columns it wrote back into the data space — empty for the table channel, which writes none (see `./analyses.ts`). */
  readonly materialized: readonly string[];
}

/** Everything one run of the orchestrator produced. */
export interface ProtRun {
  /** One row per act, in the order the stages dispatched them. */
  readonly outcomes: readonly ActOutcome[];
  /** The recorder's own sentences, one per line — what the run looked like from inside. */
  readonly narrative: readonly string[];
  /** The pair table the first act cut, as it came back in the act's answer. `null` when that act was refused. */
  readonly pairs: PairsOutput | null;
  /** What the residue-grain fold landed, and its counts. */
  readonly contacts: ContactsOutput | null;
  /** What the surface act landed, and the parameters it ran at. */
  readonly surface: SurfaceOutput | null;
  /**
   * What the conservation act landed: which alignment each chain was cited
   * against, how many residues got a column, and every refusal.
   *
   * IT CAN BE PRESENT AND STILL CARRY REFUSALS, which no other act's answer
   * does: a chain in no family scores nothing while the other chain's score
   * stands, so the act LANDS and has something to say. `./session.ts` hands
   * these sentences to the desk beside the act's own outcome.
   */
  readonly conservation: ConservationOutput | null;
}

/** The cause every act of a run carries: the system asked and the system computed, with the act's own declared intent. */
const causeFor = (intent: string): Cause => ({ requestedBy: 'system', computedBy: 'system', intent });

/**
 * ONE ACT, DISPATCHED — the refusal sentence or the commit, never a throw.
 *
 * Three ways an act can fail to land, and they are not the same thing, so each
 * gets its own sentence (the exo surface's `land` makes the same three-way
 * distinction, for the same reason):
 *
 *   - the session REFUSED it (a gap): the gap's own detail, verbatim;
 *   - it ran and the result was not `ok`: degenerate, or the rows could not be
 *     read at all, which carries the engine's own rejection;
 *   - the stage function THREW — which is how `./molstar.ts` reports a text
 *     Mol* cannot read, and how `./interactions.ts` reports a structure whose
 *     symmetry mates the minted key cannot tell apart. A throw out of an act is
 *     information, and losing it would leave an operator with an empty chart
 *     and no sentence.
 *
 * EXPORTED, because stage 5 dispatches an act this chart does not run: its
 * answer arrives after the run (`./hotspots.ts` — a model has to be asked
 * first), so `./session.ts` · `landHotspots` dispatches it later and through
 * THIS function, so the three-way distinction above is made in one place for
 * every act on this desk rather than twice with two vocabularies.
 */
export async function landAct(session: InteractionSession, act: string, intent: string): Promise<{ readonly commit: string | null; readonly refusal: string | null; readonly materialized: readonly string[]; readonly output: unknown }> {
  try {
    const answer = await session.declareAnalysis(act, { cause: causeFor(intent) });
    const materialized = answer.materialized ?? [];
    if (!answer.result.ok) {
      const why = answer.result.reason === 'unavailable' ? `the rows could not be read: ${answer.result.rejection.detail ?? answer.result.rejection.reason}` : `${answer.result.reason} at ${String(answer.result.n)} rows`;
      return { commit: answer.commit?.id ?? null, refusal: `act "${act}" landed nothing — ${why}`, materialized, output: null };
    }
    // A LANDED RESULT CAN STILL CARRY A GAP, and this is the one place that
    // matters: the columns channel writes each column on its own, so an act can
    // land its commit and still report that one column did not reach the table.
    // Reported rather than swallowed — an operator with a bar chart and a
    // missing column needs the library's sentence, not a shrug.
    if (answer.gap !== undefined) return { commit: answer.commit?.id ?? null, refusal: `act "${act}" ran and reported a gap (${answer.gap.code}): ${answer.gap.detail}`, materialized, output: answer.result.output };
    return { commit: answer.commit?.id ?? null, refusal: null, materialized, output: answer.result.output };
  } catch (error) {
    return { commit: null, refusal: `act "${act}" threw: ${error instanceof Error ? error.message : String(error)}`, materialized: [], output: null };
  }
}

/**
 * SOMEBODY WATCHING THE RUN GO BY — the one thing a promise cannot give a
 * reader.
 *
 * `runProtStages` answers once, at the end, which is the right shape for the
 * data and the wrong shape for the SCREEN: the desk's trace panel is expanded
 * while the run is in flight so a reader watches it fill, and a panel handed
 * only the finished run has nothing to fill with. So an act's outcome is
 * offered the moment it comes back, in dispatch order, and the same rows arrive
 * again on {@link ProtRun.outcomes} when the run ends — one owner, twice
 * delivered, never two accounts.
 *
 * It is the HOST'S OWN CALLBACK, running inside the stage that dispatched the
 * act: a watcher that throws fails that stage, the way any other line of a
 * stage function would. The library's isolation law is about RECORDERS
 * (footprintjs: "recorder errors never abort traversal"), and this is not one —
 * saying so is cheaper than pretending an exception here is harmless.
 */
export interface ProtRunWatch {
  onOutcome?(outcome: ActOutcome): void;
}

/** What one stage of the chart writes into its own state — the summary, never the rows. See the file header. */
interface StageSummary {
  readonly stage: string;
  readonly acts: readonly ActOutcome[];
}

/**
 * THE TWO STAGES, RUN — build the chart over this session and execute it once.
 *
 * ```ts
 * const run = await runProtStages(surface.session, { onOutcome: (o) => rows.push(o) });
 * run.outcomes.map((o) => `${o.stage}/${o.act} → ${o.commit ?? o.refusal}`);
 * run.pairs?.counts.crossing;   // 21 — the contacts across the interface
 * run.narrative.length;         // the recorder's sentences, one per line
 * ```
 *
 * The chart is built per call rather than once at module load, because it
 * closes over the session: one executor runs one chart at a time, and a chart
 * shared between two sessions would be a chart pointing at the wrong one.
 */
export async function runProtStages(session: InteractionSession, watch?: ProtRunWatch): Promise<ProtRun> {
  const { narrative } = await import('footprintjs/recorders');
  /**
   * What the stages produced, gathered OUTSIDE the chart's state — see the file
   * header: the summaries go on the trace, the rows come back to the caller. A
   * closure rather than a return value because a stage function's own return is
   * not what a footprintjs chart carries forward; its state is, and these are
   * the two things state deliberately does not hold.
   */
  const outputs = new Map<string, unknown>();
  const outcomes: ActOutcome[] = [];

  /** One stage of the desk: dispatch its acts in order, await each, and summarise. */
  const stageOf = (index: number) => async (scope: { $setValue(key: string, value: unknown): void }): Promise<void> => {
    const stage = PROT_STAGES[index]!;
    const acts: ActOutcome[] = [];
    for (const act of stage.acts) {
      const landed = await landAct(session, act.id, act.intent);
      if (landed.output !== null) outputs.set(act.id, landed.output);
      const outcome: ActOutcome = { stage: stage.stage, act: act.id, commit: landed.commit, refusal: landed.refusal, materialized: landed.materialized };
      acts.push(outcome);
      outcomes.push(outcome);
      // the screen's copy, offered as it happens — see {@link ProtRunWatch}
      watch?.onOutcome?.(outcome);
    }
    scope.$setValue(stage.stage, { stage: stage.stage, acts } satisfies StageSummary);
  };

  // ONE STAGE FUNCTION PER DECLARED STAGE, folded off the list the def's
  // captions name their stage from (`./analyses.ts` · PROT_STAGES) — so a new
  // stage is a ROW IN THAT LIST and nothing here, and never a caption that
  // disagrees with the chart.
  //
  // IT WAS HARD-CODED FOR TWO, and the note where this stands said a fold
  // "would need a reduce whose type nobody can read, to save two lines". Two
  // lines was right while there were two stages; the conservation stage made it
  // three and would have made it a third hand-written line plus a guard nobody
  // can forget to update. The reduce is readable because the fluent builder
  // answers its own type: `addFunction` gives back the builder it was called
  // on, so the accumulator is whatever `flowChart` returned and nothing is
  // annotated.
  //
  // The ORDER is still the chart's and not a comment's: each stage function
  // awaits every act it dispatches, and the next stage does not start until it
  // has returned.
  const [first, ...rest] = PROT_STAGES;
  if (first === undefined) {
    throw new Error('src/prot/analyses.ts declares no stage at all, so this orchestrator has nothing to run — a desk that lands nothing should say so rather than run an empty chart');
  }
  const chart = rest
    .reduce((built, stage, at) => built.addFunction(stage.label, stageOf(at + 1), stage.stage), flowChart<Record<string, StageSummary>>(first.label, stageOf(0), first.stage))
    .build();

  const trace = narrative();
  // The INPUT is the declaration, not the work: which stages will run and which
  // acts each one will dispatch. It is on the run's args so the trace says what
  // was ASKED for beside what happened — and it is the only thing about this run
  // that `structuredClone` has to carry.
  await chart.recorder(trace).run({ input: { stages: PROT_STAGES.map((s) => ({ stage: s.stage, acts: s.acts.map((a) => a.id) })) } });

  return {
    outcomes,
    narrative: trace.getEntries().map((entry) => entry.text),
    pairs: (outputs.get(PAIRS_ACT) as PairsOutput | undefined) ?? null,
    contacts: (outputs.get(CONTACTS_ACT) as ContactsOutput | undefined) ?? null,
    surface: (outputs.get(SURFACE_ACT) as SurfaceOutput | undefined) ?? null,
    conservation: (outputs.get(CONSERVATION_ACT) as ConservationOutput | undefined) ?? null,
  };
}
