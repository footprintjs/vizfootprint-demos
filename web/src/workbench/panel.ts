/**
 * THE ONE PANEL, AS RULES — LAYER 3: a pure fold from the run's own outcomes to
 * the props `./StagePanel.tsx` takes. No React, no DOM, no session.
 *
 * ── WHERE EVERY WORD AND EVERY NUMBER COMES FROM ───────────────────────────
 * The panel is the only prose on the redesigned workbench, so this is the file
 * the packet's law bites hardest on. Each line has exactly one source:
 *
 *   sentence 1     `StepperStage.subtitle` — the fold's own line naming what
 *                  the stage put on the desk, built in
 *                  `web/src/protStages.ts` off `ActOutcome.materialized` and
 *                  `src/prot/def.ts` · `PROT_RECEIPTS`.
 *   sentences 2…   `ProtRun.narrative` — the footprintjs recorder's OWN
 *                  sentences, the ones that name this stage, verbatim. Not
 *                  re-worded, not summarised, not re-ordered.
 *   the refusal    `StepperStage.detail`, which is `ActOutcome.refusal` as
 *                  `src/prot/orchestrator.ts` · `landAct` wrote it.
 *   the four facts `InteractionCounts` / `SurfaceCounts` — the acts' own
 *                  answers, read field by field (see {@link stageFacts}).
 *   the footnote   `src/prot/analyses.ts` · `PROT_UNAVAILABLE_STAGES` · `why`
 *                  — its FIRST CLAUSE on the visible line ({@link firstClause},
 *                  cut at a punctuation boundary and re-worded nowhere), the
 *                  whole paragraph in the panel's fold.
 *
 * Nothing here composes a sentence about a protein. The two sentences the
 * DESIGN wrote about this stage are not reproduced: one of them is wrong about
 * why four residues have no backbone angle (it blames incomplete coordinates;
 * the truth, which this desk measured, is that the first residue of a chain has
 * no previous carbon and the last no next nitrogen), and the caption that says
 * it correctly is `web/src/protCells.tsx`'s and stays.
 *
 * ── WHY THE NARRATIVE IS CAPPED, and why that is not a drop ────────────────
 * {@link NARRATIVE_LINES} of the recorder's sentences reach the panel. All of
 * them — every line, in order, not re-worded — stay on the page in their own
 * disclosure (`web/src/protTrace.tsx` · `RunNarrative`, which the composition
 * keeps under the stepper). The panel is a place to stand, not the record.
 */
import { CONTACTS_ACT, PAIRS_ACT, PROT_UNAVAILABLE_STAGES, SURFACE_ACT } from '../../../src/prot/analyses.js';
import type { ProtCounts } from '../../../src/prot/etl.js';
import type { ProtRun } from '../../../src/prot/orchestrator.js';
import type { StageState, StepperStage } from '../protStages.js';
import type { PanelFact, UnavailableLine } from './StagePanel.js';

/** How many of the recorder's own sentences reach the panel. The rest are in the run's own disclosure — see the file header. */
export const NARRATIVE_LINES = 3;

const num = (n: number): string => n.toLocaleString('en-US');

/** The word the eyebrow adds for a stage that is not simply landed — the same five words the stepper's tag uses. */
const WORD: Readonly<Record<StageState, string | null>> = {
  'not-run': 'not run',
  running: 'running',
  landed: null,
  refused: 'refused',
  unavailable: 'not available here',
};

/**
 * THE FOUR FACTS OF ONE STAGE — read off that stage's acts' own answers, field
 * by field, and NEVER recomputed here.
 *
 * Which four depends on which stage, because the two stages answer different
 * questions: the interactions stage reports on CONTACTS (what the engine found,
 * what became a row, what crosses a chain boundary, what runs through an atom
 * the table never saw) and the surface stage on AREAS (what it measured, what
 * came out at exactly zero, what it could not compute at all, what has no
 * published maximum to divide by). Each label names one field of
 * `InteractionCounts` or `SurfaceCounts`; each value is that field.
 *
 * An empty answer is honest: a stage whose act has not landed has no counts,
 * and the panel says so rather than showing four dashes.
 */
export function stageFacts(stage: StepperStage, run: ProtRun | null, counts: ProtCounts): readonly PanelFact[] {
  const pairs = run?.pairs?.counts ?? null;
  const surface = run?.surface?.counts ?? null;
  /**
   * WHICH STAGE THIS IS, asked of the ACTS rather than of the stage id: the act
   * ids are the declaration (`src/prot/analyses.ts`), and a stage renamed there
   * keeps its facts without this file being edited.
   */
  const landed = (act: string): boolean => stage.acts.some((a) => a.act === act && a.commit !== null);
  if (pairs !== null && (landed(PAIRS_ACT) || landed(CONTACTS_ACT))) {
    return [
      { id: 'reported', label: 'Contacts the engine reported', value: num(pairs.reported) },
      { id: 'rows', label: 'Contact rows landed', value: num(pairs.rows) },
      { id: 'crossing', label: 'Crossing to another chain', value: num(pairs.crossing) },
      { id: 'altloc', label: 'Through an alternate location', value: num(pairs.throughAlternateLocation) },
    ];
  }
  if (surface !== null && landed(SURFACE_ACT)) {
    return [
      { id: 'landed', label: 'Areas measured', value: `${num(surface.landed)} / ${num(counts.residues)}` },
      { id: 'buried', label: 'Buried at exactly 0 Å²', value: num(surface.buried) },
      { id: 'novalue', label: 'No area computed at all', value: num(surface.noValue) },
      { id: 'noref', label: 'No relative value to divide by', value: num(surface.noReference) },
    ];
  }
  return [];
}

/**
 * A HANDFUL OF WORDS OUT OF A PARAGRAPH — the first clause of a measured
 * reason, verbatim.
 *
 * Cut at the first colon, or at the first full stop when there is no colon, and
 * never at a word count: a sentence chopped mid-clause is a sentence this code
 * has edited. Whatever is cut is in the panel's fold, whole.
 */
export function firstClause(sentence: string): string {
  const at = sentence.indexOf(':');
  const stop = sentence.indexOf('. ');
  const cut = at >= 0 ? at : stop >= 0 ? stop + 1 : -1;
  return cut < 0 ? sentence : sentence.slice(0, cut).trim();
}

/** Everything the panel draws, as plain data. */
export interface PanelWords {
  readonly label: string;
  readonly eyebrow: string;
  readonly sentences: readonly string[];
  readonly refusal: string | null;
  readonly facts: readonly PanelFact[];
  readonly noFacts: string;
  /** The SHORT visible line per declared-and-impossible stage. */
  readonly unavailable: readonly UnavailableLine[];
  /** The same stages with their MEASURED paragraph, for the panel's fold. Never dropped, only moved. */
  readonly unavailableWhy: readonly { readonly id: string; readonly name: string; readonly why: string }[];
}

/** What the panel is told about where the cursor is standing. */
export interface PanelInput {
  /** The stage the cursor is standing in — `web/src/protStages.ts` · `stageAtCursor`. */
  readonly here: StepperStage | null;
  readonly run: ProtRun | null;
  readonly counts: ProtCounts;
  /** The session's cursor, so "no stage" can tell the root of the log from a fork. */
  readonly cursor: string | null;
  /** Whether that cursor is on this desk's active path at all. */
  readonly onPath: boolean;
  /** The names of the charts the standing stage produced — the arrangement, said in one clause. */
  readonly focused: readonly string[];
}

/**
 * THE STAGES THIS DESK DECLARES AND CANNOT PERFORM — a fact about the desk, not
 * about the cursor, so both forms are the same on every panel.
 *
 * `UNAVAILABLE` is the short visible line; `UNAVAILABLE_WHY` is the measured
 * paragraph the fold carries. The short one is the long one's own first clause,
 * so nothing on screen is a paraphrase of anything.
 */
const UNAVAILABLE: readonly UnavailableLine[] = PROT_UNAVAILABLE_STAGES.map((stage) => ({ id: stage.stage, name: stage.label, short: firstClause(stage.why) }));
const UNAVAILABLE_WHY = PROT_UNAVAILABLE_STAGES.map((stage) => ({ id: stage.stage, name: stage.label, why: stage.why }));

/**
 * THE PANEL, FOLDED.
 *
 * ```ts
 * const words = stagePanel({ here, run, counts, cursor: state.cursor, onPath, focused: hero.map(desk.label) });
 * <StagePanel {...words} />
 * ```
 */
export function stagePanel(input: PanelInput): PanelWords {
  const { here, run, counts, cursor, onPath, focused } = input;
  if (here === null) {
    return {
      label: 'where the cursor is standing',
      eyebrow: 'No stage · the cursor is not standing in one',
      sentences: [
        cursor === null
          ? 'The cursor is at the root of this log, so no stage has landed yet and nothing below is singled out.'
          : onPath
            ? 'The cursor is behind every stage’s own commit, so no stage had landed by the time it points at, and nothing below is singled out.'
            : 'The cursor is not on this desk’s active path, so this page cannot say which stage you are standing in — it draws no branch map, and guessing would be worse than saying so.',
      ],
      refusal: null,
      facts: [],
      noFacts: 'no stage is standing, so there are no counts to read',
      unavailable: UNAVAILABLE,
      unavailableWhy: UNAVAILABLE_WHY,
    };
  }
  const word = WORD[here.state];
  const narrative = (run?.narrative ?? []).filter((line) => line.includes(here.label)).slice(0, NARRATIVE_LINES);
  const arrangement =
    focused.length === 0
      ? 'No chart on this desk is drawn from what this stage landed, so nothing below is singled out.'
      : `The ${focused.length === 1 ? 'chart' : `${num(focused.length)} charts`} this stage produced ${focused.length === 1 ? 'is' : 'are'} the focus below: ${focused.join(', ')}. Which charts a stage owns is an intersection of the columns its acts landed with the columns each view binds — nobody typed that list.`;
  return {
    label: `what stage ${num(here.number)} did`,
    eyebrow: `Stage ${num(here.number)} · ${here.label}${word === null ? '' : ` · ${word}`}`,
    // sentence 1 is the fold's own line; then the recorder's, verbatim; then
    // the one derived clause about the arrangement, which is about the SCREEN
    // and not about the protein
    sentences: [here.subtitle, ...narrative, arrangement],
    refusal: here.detail,
    facts: stageFacts(here, run, counts),
    noFacts: 'this stage has landed no counts to read',
    unavailable: UNAVAILABLE,
    unavailableWhy: UNAVAILABLE_WHY,
  };
}
