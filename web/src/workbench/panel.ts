/**
 * THE STAGE'S OWN WORDS, AS RULES — LAYER 3: a pure fold from the run's own
 * outcomes to what the FOCUSED CARD says about the stage that landed it. No
 * React, no DOM, no session.
 *
 * ── THERE IS NO PANEL ANY MORE, AND THAT IS THIS FILE'S HISTORY ─────────────
 * This fold used to feed a prose BAND under the stepper (342 words, then 136,
 * then none). The author's ruling ended it: *"no paragraphs, nothing similar —
 * I don't want a scrolling dashboard."* Everything under the stepper is the
 * focus-mode layout and nothing else.
 *
 * **Not one word was deleted; every field moved to the thing it is about.**
 *
 *   `mark` + `line`   the focused card's ONE QUIET LINE, beside the library's
 *                     own derived `How to read:` — what the stage that landed
 *                     this picture put on the desk.
 *   `sentences`       the same card's `Full note`, where every other chart's
 *                     prose already lives: the recorder's own sentences about
 *                     this stage, verbatim, and the one derived clause about
 *                     the arrangement.
 *   `facts`           the same card's own numbers, in Mono under the picture.
 *                     They are facts about that picture and they are numbers,
 *                     not prose.
 *   `refusal`         VISIBLE on that card, never behind a press — and the cell
 *                     itself still carries the library's own refusal sentence
 *                     at a cursor where the read is refused, which is a
 *                     different sentence about a different thing.
 *   `where`           the one line for the CHROME, and only when no stage is
 *                     standing: it is about the whole screen rather than about
 *                     a picture, so it rides the strip with the rows note.
 *   the three blocked
 *   stages            {@link STEP_CARDS} — no longer a footnote at all. Each
 *                     one is a CARD in the grid, in its own place in the
 *                     layout, and the card's body is the reason: the first
 *                     clause in the card, the whole paragraph behind the card's
 *                     own `Full note`. The same list carries STEP 1, which has
 *                     no picture for the opposite reason — it landed before the
 *                     record started — so every step of the plan that is not a
 *                     picture is a card that says why.
 *
 * ── WHERE EVERY WORD AND EVERY NUMBER COMES FROM ───────────────────────────
 * Each line still has exactly one source:
 *
 *   the quiet line  `StepperStage.subtitle` — the fold's own line naming what
 *                   the stage put on the desk, built in
 *                   `web/src/protStages.ts` off `ActOutcome.materialized` and
 *                   `src/prot/def.ts` · `PROT_RECEIPTS`.
 *   the note        `ProtRun.narrative` — the footprintjs recorder's OWN
 *                   sentences, the ones that name this stage, verbatim. Not
 *                   re-worded, not summarised, not re-ordered.
 *   the refusal     `StepperStage.detail`, which is `ActOutcome.refusal` as
 *                   `src/prot/orchestrator.ts` · `landAct` wrote it.
 *   the facts       `InteractionCounts` / `SurfaceCounts` — the acts' own
 *                   answers, read field by field (see {@link stageFacts}).
 *   the blocked
 *   cards           `src/prot/plan.ts` · `PROT_BLOCKED` · `why`, one owner per
 *                   stage (the def's own unavailable list for the stage
 *                   declared to it, the plan for its own two), cut to its FIRST
 *                   CLAUSE by {@link firstClause} — at a punctuation boundary,
 *                   re-worded nowhere.
 *
 * Nothing here composes a sentence about a protein. The two sentences the
 * DESIGN wrote about this stage are not reproduced: one of them is wrong about
 * why four residues have no backbone angle (it blames incomplete coordinates;
 * the truth, which this desk measured, is that the first residue of a chain has
 * no previous carbon and the last no next nitrogen), and the caption that says
 * it correctly is `web/src/protCells.tsx`'s and stays.
 *
 * ── WHY THE NARRATIVE IS CAPPED, and why that is not a drop ────────────────
 * {@link NARRATIVE_LINES} of the recorder's sentences reach the card. All of
 * them — every line, in order, not re-worded — are in the record drawer
 * (`web/src/protTrace.tsx` · `RunNarrative`). The card is a place to stand, not
 * the record.
 */
import { CONTACTS_ACT, PAIRS_ACT, SURFACE_ACT } from '../../../src/prot/analyses.js';
import { PROT_BLOCKED, type Blocker } from '../../../src/prot/plan.js';
import type { ProtCounts } from '../../../src/prot/etl.js';
import type { ProtRun } from '../../../src/prot/orchestrator.js';
import type { StageState, StepperStage } from '../protStages.js';
import type { CardFact } from './ChartCard.js';

/** How many of the recorder's own sentences reach the card. The rest are in the record drawer — see the file header. */
export const NARRATIVE_LINES = 3;

const num = (n: number): string => n.toLocaleString('en-US');

/**
 * The word the lead adds for a stage that is not simply landed — the same words
 * the stepper's tag uses.
 *
 * The two states of the declared-and-not-happening family are absent on
 * purpose: their word depends on which KIND of blocked the step is and is
 * declared once, in `src/prot/plan.ts` · `BLOCKED_TAG`. No cursor can stand in
 * one of them anyway (they land no commit), so this map is never asked.
 */
const WORD: Readonly<Record<StageState, string | null>> = {
  'not-run': 'not run',
  running: 'running',
  landed: null,
  refused: 'refused',
  unavailable: null,
  blocked: null,
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
 * and the card says so rather than showing four dashes.
 */
export function stageFacts(stage: StepperStage, run: ProtRun | null, counts: ProtCounts): readonly CardFact[] {
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
 * A HANDFUL OF WORDS OUT OF A PARAGRAPH — the first clause of a declared
 * reason, verbatim.
 *
 * Cut at the first colon, or at the first full stop when there is no colon, and
 * never at a word count: a sentence chopped mid-clause is a sentence this code
 * has edited. Whatever is cut is behind the card's own `Full note`, whole.
 */
export function firstClause(sentence: string): string {
  const at = sentence.indexOf(':');
  const stop = sentence.indexOf('. ');
  const cut = at >= 0 ? at : stop >= 0 ? stop + 1 : -1;
  return cut < 0 ? sentence : sentence.slice(0, cut).trim();
}

/**
 * A DECLARED STEP THAT WILL NOT RUN HERE, AS A CARD.
 *
 * It has a card because the author asked for one: *"for not-available, show the
 * widget and tell inside it a text to tell why it's not there."* So the reason
 * is read at the size and in the position of the thing it is about, instead of
 * as a footnote somewhere else — the same law the cells already keep for a
 * refused read, extended to a stage that never ran at all.
 *
 * Stages 5 and 6 declare no views, so their card has NO CHART: where the
 * picture would be, the page says why there is no picture. There is no
 * placeholder chart, no greyed axis and no dashed box pretending to be one — an
 * empty frame that looks like a chart is the lie this desk exists to avoid.
 */
export interface BlockedCard {
  readonly id: string;
  /** The short declared name — the card's heading. */
  readonly name: string;
  /** The declared sentence: what the step would answer. */
  readonly label: string;
  /** `not available here`, `not on this build`, `not built yet` — the three kinds, distinguishable IN the card and not only on the mark. */
  readonly tag: string;
  readonly blockedBy: Blocker;
  /** What the card says where a picture would be: the reason's own first clause. */
  readonly short: string;
  /** The whole reason, behind the card's own `Full note`. */
  readonly why: string;
}

/**
 * THE THREE OF THEM — a fact about the desk and not about the cursor, so the
 * cards are the same wherever a reader is standing.
 *
 * THE OTHER THREE STEPS ARE PICTURES and are not in here, step 1 included: the
 * parse's own columns are its landed columns, so the 3D view and the
 * backbone-angle scatter are its evidence (`web/src/protStages.ts` ·
 * `chartsOfStage`). A step with a picture does not also get a card of words.
 */
export const BLOCKED_CARDS: readonly BlockedCard[] = PROT_BLOCKED.map((stage) => ({
  id: stage.stage,
  name: stage.name,
  label: stage.label,
  tag: stage.tag,
  blockedBy: stage.blockedBy,
  short: firstClause(stage.why),
  why: stage.why,
}));

/**
 * WHEN THE FOCUS AND THE CURSOR PART COMPANY, THE PAGE SAYS SO — one line, on
 * the focused card, where the reader is looking.
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 * The stepper's bar and `aria-current` mark the FOCUSED stage
 * (`./Stepper.tsx` · `StepView.focused`), because the stepper is this page's
 * navigation and a control that does not visibly respond to being pressed is
 * broken. But three of the six columns move the focus and NOT the cursor — the
 * step that landed at the root has no commit to seek to, and the three that
 * will not run here landed none — so after such a press the reader is focused
 * on a stage the cursor is not standing in. That is a real state, and this desk
 * announces a real state rather than leaving it to be inferred.
 *
 * ── IT IS DERIVED FROM THE TWO FACTS, NEVER FROM A PRESS ───────────────────
 * Both arguments are folds the page already holds: `focused` is the stage whose
 * thing is in the focus slot (`web/src/protDesk.tsx` · `focusedStage`) and
 * `cursor` is `web/src/protStages.ts` · `stageAtCursor`. So the line is right
 * after a window resize, after a reload, after a seek from the record drawer
 * and after a rail tile is promoted — every route into the disagreeing state,
 * not just the stepper. Nothing here knows a button exists.
 *
 * `null` when they agree, which is the landing state and the state every landed
 * press leaves behind: an absence is absent.
 */
export function focusVsCursor(focused: StepperStage | null, cursor: StepperStage | null): string | null {
  if (focused === null) return null;
  if (cursor !== null && cursor.stage === focused.stage) return null;
  // the cursor's half, and the two arms are two different facts rather than one
  // with a hole in it: a cursor standing in ANOTHER stage, and a cursor
  // standing in none at all (the root of the log, a commit behind every stage's
  // own, or a fork this page draws no map of — `stageWords`' `where` says which)
  const standing =
    cursor === null
      ? 'the cursor is not standing in any stage'
      : `the cursor is standing in stage ${num(cursor.number)}, ${cursor.name}`;
  return `You are looking at stage ${num(focused.number)}, ${focused.name} — ${standing}, and every picture here is drawn where the cursor is.`;
}

/** Everything the focused card says about the stage that landed it, as plain data. */
export interface StageWords {
  /** `Stage 3 · How much of each residue the solvent can reach` — the lead of the note. */
  readonly eyebrow: string;
  /** `stage 3` — the Mono prefix on the card's own quiet line, so a promoted foreign picture can never be read as this stage's. */
  readonly mark: string;
  /** THE ONE QUIET LINE: what this stage put on the desk. */
  readonly line: string;
  /** The recorder's own sentences, then the one derived clause about the arrangement — the card's `Full note`. */
  readonly sentences: readonly string[];
  readonly refusal: string | null;
  /**
   * THE STEP'S OWN ACCOUNT OF ITSELF, for the note — the declared paragraph a
   * step carries when nothing about it can be folded off an act.
   *
   * Step 1's is the only one a reader meets: it landed the whole residues table
   * through the parse rather than through an act, and that is a thing to say
   * rather than a refusal to print in rust.
   */
  readonly account: string | null;
  /**
   * Its own numbers. EMPTY is the honest answer for a stage that landed none —
   * step 1's answer IS the table — and the card then draws no row at all: an
   * absence is absent, where *this stage has landed no counts to read* took a
   * whole row under a drawing to say nothing.
   */
  readonly facts: readonly CardFact[];
  /** The line for the CHROME when no stage is standing at all. `null` when one is. */
  readonly where: string | null;
}

/** What the fold is told about where the cursor is standing. */
export interface PanelInput {
  /** The stage the cursor is standing in — `web/src/protStages.ts` · `stageAtCursor`. */
  readonly here: StepperStage | null;
  readonly run: ProtRun | null;
  readonly counts: ProtCounts;
  /** The session's cursor, so "no stage" can tell the root of the log from a fork. */
  readonly cursor: string | null;
  /** Whether that cursor is on this desk's active path at all. */
  readonly onPath: boolean;
  /** The names of the charts THIS STAGE PRODUCED — the left half of the arrangement clause. */
  readonly focused: readonly string[];
  /** The name of the one picture actually IN the focus slot. `null` when a step's own card is there instead. */
  readonly inFocus: string | null;
  /**
   * The name of the chart the READER promoted out of the rail, when they have
   * promoted one.
   *
   * The focus is DERIVED — the charts the standing stage produced — and a
   * reader may override it by promoting a tile. The clause below has to say
   * which of the two a reader is looking at, because "the charts this stage
   * produced are the focus" is false the moment they have chosen something
   * else.
   */
  readonly promoted: string | null;
}

/**
 * THE STAGE'S WORDS, FOLDED.
 *
 * ```ts
 * const words = stageWords({ here, run, counts, cursor: state.cursor, onPath, focused, promoted });
 * <ChartCard stage={{ mark: words.mark, line: words.line, facts: words.facts, … }} note={…words.sentences…} />
 * ```
 */
export function stageWords(input: PanelInput): StageWords {
  const { here, run, counts, cursor, onPath, focused, inFocus, promoted } = input;
  /** What the stage itself produced, minus whatever is in the focus right now — what is WAITING in the rail. */
  const waiting = focused.filter((name) => name !== inFocus);
  /**
   * THE ONE DERIVED CLAUSE, and it is about the SCREEN rather than about the
   * protein: what is in the focus, why, and what of this stage's own waits a
   * press away.
   *
   * THE FOCUS SLOT HOLDS ONE PICTURE. A stage that produced two (the contacts
   * stage produced the bar and the pair table) puts the first in the focus and
   * the other in the rail — halving the slot would make two cramped pictures
   * out of one readable one, which is the opposite of what focus mode is for.
   */
  const arrangement =
    promoted !== null
      ? `You promoted ${promoted} out of the rail, so it is in the focus rather than ${focused.length === 0 ? 'anything this stage produced — it produced none' : `the ${focused.length === 1 ? 'one' : num(focused.length)} this stage produced (${focused.join(', ')})`}. Moving the cursor hands the focus back to the stage.`
      : focused.length === 0
        ? 'No chart on this desk is drawn from what this stage landed, so nothing is singled out and the focus is the first picture on the desk.'
        : `${inFocus ?? 'Nothing'} is in the focus because this stage produced it${waiting.length === 0 ? '' : `, and so ${waiting.length === 1 ? 'is' : 'are'} ${waiting.join(', ')} — a press away in the rail`}. Which charts a stage owns is an intersection of the columns its acts landed with the columns each view binds — nobody typed that list.`;
  if (here === null) {
    const where =
      cursor === null
        ? 'The cursor is at the root of this log, so no stage has landed yet and nothing is singled out.'
        : onPath
          ? 'The cursor is behind every stage’s own commit, so no stage had landed by the time it points at, and nothing is singled out.'
          : 'The cursor is not on this desk’s active path, so this page cannot say which stage you are standing in — it draws no branch map, and guessing would be worse than saying so.';
    return {
      eyebrow: 'No stage · the cursor is not standing in one',
      mark: 'no stage',
      line: where,
      sentences: [arrangement],
      refusal: null,
      account: null,
      facts: [],
      where,
    };
  }
  const word = WORD[here.state];
  const narrative = (run?.narrative ?? []).filter((line) => line.includes(here.label)).slice(0, NARRATIVE_LINES);
  return {
    eyebrow: `Stage ${num(here.number)} · ${here.label}${word === null ? '' : ` · ${word}`}`,
    mark: `stage ${num(here.number)}`,
    // the fold's own line; then the recorder's, verbatim; then the one derived
    // clause about the arrangement, which is about the SCREEN and not about the
    // protein
    line: here.subtitle,
    sentences: [...narrative, arrangement],
    // A REFUSED ACT'S SENTENCE and a step's own ACCOUNT of itself are both
    // `detail`, and they are not the same kind of thing: one is rust and
    // visible, the other is prose for the note. Only a refused stage has a
    // refusal.
    refusal: here.state === 'refused' ? here.detail : null,
    account: here.state === 'refused' ? null : here.detail,
    facts: stageFacts(here, run, counts),
    where: null,
  };
}
