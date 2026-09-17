/**
 * THE ORCHESTRATOR — one footprintjs chart whose two stages land the desk's two
 * stages, in order, and whose recorder keeps the account of it.
 *
 * ```
 *   stage "interactions"  →  declareAnalysis(interactionPairs)     → a commit
 *                            declareAnalysis(residueContacts)      → a commit
 *   stage "surface"       →  declareAnalysis(residueSurface)       → a commit
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
import { CONTACTS_ACT, PAIRS_ACT, PROT_STAGES, SURFACE_ACT, type ContactsOutput, type PairsOutput, type SurfaceOutput } from './analyses.js';

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
 */
async function landAct(session: InteractionSession, act: string, intent: string): Promise<{ readonly commit: string | null; readonly refusal: string | null; readonly materialized: readonly string[]; readonly output: unknown }> {
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

/** What one stage of the chart writes into its own state — the summary, never the rows. See the file header. */
interface StageSummary {
  readonly stage: string;
  readonly acts: readonly ActOutcome[];
}

/**
 * THE TWO STAGES, RUN — build the chart over this session and execute it once.
 *
 * ```ts
 * const run = await runProtStages(surface.session);
 * run.outcomes.map((o) => `${o.stage}/${o.act} → ${o.commit ?? o.refusal}`);
 * run.pairs?.counts.crossing;   // 21 — the contacts across the interface
 * run.narrative.length;         // the recorder's sentences, one per line
 * ```
 *
 * The chart is built per call rather than once at module load, because it
 * closes over the session: one executor runs one chart at a time, and a chart
 * shared between two sessions would be a chart pointing at the wrong one.
 */
export async function runProtStages(session: InteractionSession): Promise<ProtRun> {
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
    }
    scope.$setValue(stage.stage, { stage: stage.stage, acts } satisfies StageSummary);
  };

  // TWO STAGES, and the list they come from is the same one the def's captions
  // name their stage from (`./analyses.ts` · PROT_STAGES) — so a third stage is
  // a row in that list plus a line here, and never a caption that disagrees
  // with the chart. The shape is hard-coded rather than folded because
  // `flowChart(...).addFunction(...)` is a fluent builder: a loop over the list
  // would need a reduce whose type nobody can read, to save two lines.
  const [first, second] = PROT_STAGES;
  if (first === undefined || second === undefined || PROT_STAGES.length !== 2) {
    throw new Error(`this orchestrator is written for the two stages src/prot/analyses.ts declares, and the list now holds ${String(PROT_STAGES.length)} — add the stage to the chart below rather than letting it run without one`);
  }
  const chart = flowChart<Record<string, StageSummary>>(first.label, stageOf(0), first.stage).addFunction(second.label, stageOf(1), second.stage).build();

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
  };
}
