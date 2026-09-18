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
 *   the facts       `InteractionCounts` / `SurfaceCounts` /
 *                   `ConservationCounts` — the acts' own answers, read field by
 *                   field (see {@link stageFacts}).
 *   which method
 *   placed a score   `src/prot/placement.ts` · `PlacementStrategy.said`, for
 *                   the one stage whose numbers depend on a choice between two
 *                   methods (see {@link placementSaid}). It rides the quiet
 *                   line as well as the note, because a reader must not be able
 *                   to take a consensus-placed score for an HMM-placed one.
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
import { CONSERVATION_ACT, CONTACTS_ACT, PAIRS_ACT, SURFACE_ACT } from '../../../src/prot/analyses.js';
import { SCORE_IS, SCORE_IS_NOT } from '../../../src/prot/conservation.js';
import { PLACEMENT_HERE, PLACEMENT_STRATEGIES } from '../../../src/prot/placement.js';
import { PROT_BLOCKED, type Blocker } from '../../../src/prot/plan.js';
import { HOTSPOTS_STAGE, HOTSPOT_TAG, retryable, type HotspotOutcome } from '../../../src/prot/hotspots.js';
import type { HotspotReport } from '../../../src/prot/streamReports.js';
// THE IN-FLIGHT LINE HAS ONE OWNER and it is the boot's fold: the card's fourth
// state and the boot report's stage-5 row are the same moment, so they are the
// same sentence.
import { askingSaid } from './boot.js';
import type { ProtCounts } from '../../../src/prot/etl.js';
import type { ProtRun } from '../../../src/prot/orchestrator.js';
import type { StageState, StepperStage } from '../protStages.js';
import type { CardFact, RecommendationRow, RecommendationVerdict } from './ChartCard.js';

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
 * Which four depends on which stage, because the three stages answer different
 * questions: the interactions stage reports on CONTACTS (what the engine found,
 * what became a row, what crosses a chain boundary, what runs through an atom
 * the table never saw), the surface stage on AREAS (what it measured, what came
 * out at exactly zero, what it could not compute at all, what has no published
 * maximum to divide by), and the conservation stage on a CITATION and a
 * PLACEMENT (which alignments, over how many curated sequences, how many
 * residues got a column — and which of two methods placed them). Each label
 * names one field of `InteractionCounts`, `SurfaceCounts` or
 * `ConservationCounts`; each value is that field.
 *
 * An empty answer is honest: a stage whose act has not landed has no counts,
 * and the card says so rather than showing four dashes.
 */
export function stageFacts(stage: StepperStage, run: ProtRun | null, counts: ProtCounts): readonly CardFact[] {
  const pairs = run?.pairs?.counts ?? null;
  const surface = run?.surface?.counts ?? null;
  const conservation = run?.conservation?.counts ?? null;
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
  /*
    AND THE CONSERVATION STAGE'S FOUR, which answer a third question again: it
    reports on a CITATION and a PLACEMENT rather than on anything measured off
    this file. So the facts are which alignments were cited (with their
    versions), how many curated sequences the score was taken over, how many
    residues ended with a column — and, the one a reader most needs, WHICH
    METHOD placed them, which is a fact and not a caption.
  */
  if (conservation !== null && landed(CONSERVATION_ACT)) {
    const cited = conservation.chains.flatMap((chain) => (chain.cited === null ? [] : [chain.cited]));
    const sequences = conservation.chains.reduce((total, chain) => total + (chain.sequences ?? 0), 0);
    return [
      { id: 'scored', label: 'Residues scored', value: `${num(conservation.scored)} / ${num(conservation.residues)}` },
      { id: 'absent', label: 'No column, so no score', value: num(conservation.absent) },
      { id: 'cited', label: cited.length === 1 ? 'Alignment cited' : 'Alignments cited', value: cited.length === 0 ? '—' : `${cited.join(' + ')} · ${num(sequences)} sequences` },
      { id: 'placed', label: 'Placed by', value: `${conservation.method}${conservation.weaker ? ' — the weaker method' : ''}` },
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
  /** Which kind of blocked, or `null` for the ONE card that is not blocked at all — see {@link RecommendationView}. */
  readonly blockedBy: Blocker | null;
  /** What the card says where a picture would be: the reason's own first clause. */
  readonly short: string;
  /** The whole reason, behind the card's own `Full note`. */
  readonly why: string;
  /**
   * PRESENT ON EXACTLY ONE CARD, and only where something performed stage 5:
   * what a model said, in the register this page keeps for that. A card with
   * this is not a blocked card any more — it is a card of words where a
   * blocked card used to be, which is why it arrives through the same slot
   * rather than through a fifth band of its own.
   */
  readonly recommendation?: RecommendationView;
}

/**
 * WHAT A MODEL SAID, folded for the screen — and every field of it is READ off
 * the answer rather than composed about a protein.
 *
 * ── THE ONE THING THIS SHAPE IS FOR ───────────────────────────────────────
 * A rank is not a measurement, and the page may not let it read as one. So the
 * tag rides ON the view (never a literal in a component), every row carries
 * THE FACT IDS IT CITED, and the judge's own sentence and its disagreements
 * are fields rather than decisions: a disagreement is shown, resolved by
 * nobody.
 *
 * `rows` is EMPTY on a stage that ran and did not answer, and `said` is then
 * the sentence — one of {@link HotspotOutcome}'s, verbatim, so a reader learns
 * whether the stage did not run, ran and refused, or ran and answered.
 */
/**
 * Typed against `./ChartCard.tsx`'s OWN props (the {@link CardFact}
 * precedent), so what this fold answers IS what the component takes and the
 * composition spreads it. `HotspotPick` and `HotspotVerdict` are structurally
 * those rows, which is how the two sides stay one shape with no import across
 * the boundary that would pin the component to this desk.
 */
export interface RecommendationView {
  /** `a recommendation, not a measurement` — the one owner is `src/prot/hotspots.ts`. */
  readonly tag: string;
  /** The model that was asked, in the caller's own words. `null` where nothing was. */
  readonly model: string | null;
  /** One line of figures: how many ranked, how many facts served, how many rankings refused. */
  readonly figures: string;
  /** The ranked residues, in the model's own order. */
  readonly rows: readonly RecommendationRow[];
  /** Every refusal, verbatim and by name — the hallucination door's record, shown and never counted away. */
  readonly refused: readonly string[];
  /** What the judge is, and whether it is the weaker of the two. */
  readonly judge: string;
  readonly verdicts: readonly RecommendationVerdict[];
  /** Where the judge and the model disagreed. Empty is an absence and is absent. */
  readonly disagreements: readonly string[];
  /** The sentence, when there is no ranking to show. `null` when there is one. */
  readonly said: string | null;
  /**
   * WHICH KIND OF *no ranking* this is, in the stage's own declared word —
   * `timeout`, `malformed`, `no-key`, `stream-died` (`src/prot/hotspots.ts` ·
   * `HotspotFailure`). `null` for a ranking and for a stage in flight.
   *
   * It rides BESIDE {@link said} rather than instead of it: the sentence is
   * what a reader reads, and the word is what tells a reader scanning the card
   * that the stepper's REFUSED mark and this card are about the same thing.
   * The author asked for exactly that — *I like that it says refused, can we
   * add the reason for the refusal in the hot spot widget* — and before it the
   * stepper said refused while the card's own corner was the only place the
   * reason was.
   */
  readonly kind: string | null;
  /**
   * Could asking the same question again honestly answer differently? Decided
   * by the KIND, in one table (`src/prot/hotspots.ts` · `RETRYABLE`), so the
   * card never works out its own eligibility — and `false` means the control
   * is ABSENT rather than present and dead.
   */
  readonly retryable: boolean;
  /**
   * HOW MANY TIMES THE STAGE HAS BEEN ASKED IN THIS RUN — a fact the reader is
   * owed once they have pressed retry.
   *
   * It is deliberately NOT the library's own corrective re-ask count: *the
   * library judged 2 answers against the declared shape and paid for 1
   * corrective re-ask* is a different fact from *a reader pressed retry twice*,
   * and one number answering two questions is one of them lost.
   */
  readonly asked: number;
  /**
   * WHICH CURSOR THIS ANSWER IS ABOUT — one line, always present when there is
   * a ranking.
   *
   * Every other picture on this desk is drawn at the cursor. Stage 5 cannot be:
   * it reads what stages 1 to 4 LANDED, so it is asked once, from the rows at
   * the end of the run (`src/prot/hotspots.ts` · `notTheEndOfTheRun` refuses
   * any other read). That makes this line load-bearing rather than decoration —
   * the card DECLARES its own basis instead of letting a reader take it for a
   * picture of wherever they are standing.
   */
  readonly where: string | null;
}

/** What the page hands the fold: the stage's own answer, what the door said about the judge behind it, and the two commits the answer sits between. */
export interface HotspotCardInput {
  /**
   * The answer, or `null` WHILE THE ASK IS STILL IN FLIGHT — the card's fourth
   * state, beside a ranking, the stage's own failure sentence and no key.
   *
   * It is `null` rather than a fourth `kind` on {@link HotspotOutcome} because
   * *in flight* is not an outcome: nothing has happened yet, and a failure
   * vocabulary that could spell *still going* would let a screen draw a pending
   * stage as a refused one.
   */
  readonly outcome: HotspotOutcome | null;
  /**
   * WHAT THE ASK IS DOING, while it is doing it — the report, never the answer
   * (`src/prot/streamReports.ts` carries the law and the measurement behind
   * it). `null` for a card whose stage is not in flight.
   *
   * An OUTCOME WINS over it: once the answer is frozen, what the stage was
   * doing a moment ago is no longer the interesting fact.
   */
  readonly asking?: HotspotReport | null;
  /** The door's own sentence about which judge ran (`server/prot-doors.ts` · `ProtStateWire.judge`). */
  readonly judge: string;
  /** The commit the evidence was read AT — the end of the run, by construction (`src/prot/hotspots.ts` · `notTheEndOfTheRun`). */
  readonly at: string | null;
  /** The commit the ranking itself landed as, or `null` where nothing landed. */
  readonly landed: string | null;
  /** How many times the stage has been asked in this run, counting the boot's own ask. Default 1. */
  readonly asked?: number;
}

/**
 * STAGE 5'S CARD, where its blocked card used to be.
 *
 * It keeps the blocked card's SHAPE — a name, a tag, one line where a picture
 * would be, the whole story behind `Full note` — because the shape is right: a
 * step with no chart says what it has to say at the size and in the position
 * of the thing it is about (`./README.md`), and nothing about that changes
 * when the thing it has to say is a ranking.
 *
 * What changes is the TAG. A blocked card's corner carries which kind of
 * blocked; this one carries *a recommendation, not a measurement*, and that is
 * the whole of how the page says what register this is in.
 */
export function hotspotCard(step: { readonly name: string; readonly label: string }, input: HotspotCardInput): BlockedCard {
  const view = recommendationOf(input);
  return {
    id: HOTSPOTS_STAGE,
    name: step.name,
    label: step.label,
    tag: view.tag,
    blockedBy: null,
    // THE COMPACT ROW'S LINE, and it is CUT AT A PUNCTUATION BOUNDARY exactly
    // as a blocked card's is ({@link firstClause}): a failure sentence names
    // its reason in full and the rail's row is one line of ten-pixel text, so
    // the whole sentence goes where the whole reason always goes — the card,
    // one press away, and the `Full note` under it. Never re-worded, never cut
    // mid-word, and never the only copy.
    short: view.said === null ? view.figures : firstClause(view.said),
    why: input.outcome === null ? IN_FLIGHT_NOTE(view.said ?? '') : whyOf(view),
    recommendation: view,
  };
}

/**
 * THE `Full note` OF A CARD WHOSE STAGE IS STILL RUNNING — and it is its own
 * paragraph rather than the answered one with the tenses bent.
 *
 * The answered note explains what was refused, what the judge read and what
 * every rank cites. NONE of that has happened yet, and a note that said it in
 * the past tense over a stage in flight would be the card claiming a record it
 * does not have. So this one says what is true: the ask is out, and no part of
 * the answer will be shown until the whole of it is frozen and checked.
 */
const IN_FLIGHT_NOTE = (line: string): string =>
  `THE STAGE IS RUNNING. ${line} ` +
  'NOTHING OF THE ANSWER IS SHOWN YET, and that is a decision rather than a delay: the ranking is frozen as a commit before anything checks it, and every ranking then goes through the hallucination door — ' +
  'a residue this run\'s table has no row for is refused BY NAME, and so is a citation naming a fact the findings ledger does not hold. ' +
  'A partial ranking on this card would put residues on screen before that door had refused any of them, and when a residue absent from the run\'s table was planted in the evidence the model ranked it FIRST: the record would have stayed correct and this card would have lied. ' +
  'So what is above is a count of the ACT and never a word of the answer.';

/** The answered card's own note — the paragraph this card has carried since stage 5 first landed. */
function whyOf(view: RecommendationView): string {
  return (
    `A MODEL WAS ASKED, and what it said is a recommendation rather than a measurement. ${view.model === null ? '' : `The model asked was ${view.model}. `}` +
      `${view.said === null ? '' : `WHAT HAPPENED ON THIS RUN: ${view.said} `}` +
      `Every rank below cites the ids of the facts its reason rests on — facts this run's own stages established, served to the model one per id, never computed a second time for its benefit. ` +
      `A residue it named that this run's residue table has no row for was refused by name, and so was a citation naming a fact the ledger does not hold. ` +
      `${view.verdicts.length === 0 ? 'No second source read the evidence on this run.' : `A standing judge read the evidence as a second source: ${view.judge}`} ` +
      `${view.disagreements.length === 0 ? 'It agreed with the model about what the evidence was worth.' : `IT DID NOT AGREE WITH THE MODEL, and both readings are on the record: ${view.disagreements.join(' · ')}`} ` +
      `${view.refused.length === 0 ? 'Nothing it said was refused.' : `${num(view.refused.length)} of the things it said were refused: ${view.refused.join(' · ')}`}`
  );
}

/** The answer, folded — one function, so the card and the record drawer cannot say it two ways. */
export function recommendationOf({ outcome, asking = null, judge, at, landed, asked = 1 }: HotspotCardInput): RecommendationView {
  /**
   * IN FLIGHT — the fourth state, and every word of it is the ACT.
   *
   * `rows` is empty, `said` is the status line, and there is nothing else: no
   * partial ranking, no residue, no reason, no fragment of anything the model
   * has said. That is not this function being careful — it is the only shape
   * the input allows, because {@link HotspotReport} has no field a model wrote.
   *
   * The line comes from `./boot.ts` · `askingSaid`, which is also what the boot
   * screen's stage-5 row prints: ONE OWNER, so the card and the boot cannot
   * describe the same moment two ways.
   */
  if (outcome === null) {
    return {
      tag: HOTSPOT_TAG,
      model: null,
      figures: 'in flight',
      rows: [],
      refused: [],
      judge,
      verdicts: [],
      disagreements: [],
      said: asking === null ? 'the stage is running and has not reported anything yet' : askingSaid(asking),
      where: null,
      kind: null,
      retryable: false,
      asked,
    };
  }
  if (!outcome.ok) {
    return {
      tag: HOTSPOT_TAG,
      model: null,
      figures: 'nothing ranked',
      rows: [],
      refused: [],
      judge,
      verdicts: outcome.verdicts,
      disagreements: [],
      said: outcome.sentence,
      where: null,
      // THE REASON, IN THE CARD: the declared word beside the sentence, and
      // whether a second ask could differ — both off the KIND, neither guessed
      kind: outcome.kind,
      retryable: retryable(outcome.kind),
      asked,
    };
  }
  return {
    tag: HOTSPOT_TAG,
    model: outcome.model,
    figures: [
      `${num(outcome.picks.length)} ${outcome.picks.length === 1 ? 'residue' : 'residues'} ranked`,
      `${num(outcome.served)} ${outcome.served === 1 ? 'fact' : 'facts'} served`,
      outcome.refused.length === 0 ? null : `${num(outcome.refused.length)} refused`,
      outcome.disagreements.length === 0 ? null : `${num(outcome.disagreements.length)} judge ${outcome.disagreements.length === 1 ? 'disagreement' : 'disagreements'}`,
    ]
      .filter((part): part is string => part !== null)
      .join(' · '),
    rows: outcome.picks,
    refused: outcome.refused,
    judge,
    verdicts: outcome.verdicts,
    disagreements: outcome.disagreements,
    said: null,
    kind: null,
    retryable: false,
    asked,
    // BOTH COMMITS, because they are two different facts: the one the evidence
    // was read at, and the one the ranking itself landed as. Either can be
    // absent — a run that landed nothing to read from, or an answer nothing
    // could land — and an absent commit is said rather than left blank.
    where:
      `asked once, from the rows at ${at === null ? 'the root of this log' : `commit ${at}`} — the end of what stages 1 to 4 landed — and ` +
      (landed === null ? 'the ranking landed no commit of its own' : `the ranking landed as commit ${landed}`),
  };
}

/**
 * THE READER HAS STEPPED BEHIND THE RANKING — one line, on the card, derived
 * from the two facts and from no press.
 *
 * The columns stage 5 landed are resolved AT THE CURSOR like every other
 * stage's, so behind that commit the rows carry no rank and a chart bound to
 * one is refused by name. The card still holds the answer as it was given, and
 * without this line a reader would be looking at a ranking the rows underneath
 * it do not have — the same disagreement `focusVsCursor` exists for, one fact
 * further along.
 *
 * `null` when the cursor is at or after the commit, and `null` when the cursor
 * is not on the active path at all: this page draws no branch map, so it cannot
 * say where such a cursor sits and does not pretend to.
 */
export function rankingVsCursor(landed: string | null, activePathIds: readonly string[], cursor: string | null): string | null {
  if (landed === null || cursor === null) return null;
  const standing = activePathIds.indexOf(cursor);
  const ranked = activePathIds.indexOf(landed);
  if (standing < 0 || ranked < 0 || standing >= ranked) return null;
  return `The cursor is standing behind commit ${landed}, which is where this ranking landed — so the rows on this desk carry no rank at all, and what is below is the answer as it was given rather than anything these rows hold.`;
}

/**
 * WHAT A PRESS ON A LANDED STAGE THAT OWNS NO PICTURE SAYS — and it names the
 * real reason rather than apologising.
 *
 * ── WHY THIS SENTENCE EXISTS ───────────────────────────────────────────────
 * Which pictures a stage owns is an INTERSECTION of the columns its acts landed
 * with the columns each view binds (`../protStages.ts` · `chartsOfStage`), and
 * that intersection has no fallback on purpose: the layout follows it, and a
 * card hard-coded as the big one is what it exists to prevent. So a stage that
 * landed columns NO CHART IS DRAWN FROM owns nothing — a true answer, and until
 * now a silent one. The author found it: *clicking on the cursor stage nothing
 * happens.*
 *
 * What a reader learns from this line is a FACT: these columns exist on the
 * rows, and no picture on this desk reads them. That is worth knowing — it is
 * how a reader discovers that stage 5's rank is in the data space before
 * anything has bound it — and it is not an apology for a missing feature.
 *
 * `null` where the stage does own a picture, because then the press answered by
 * moving the layout and there is nothing to say.
 */
export function emptyFocusSaid(stage: { readonly number: number; readonly name: string; readonly materialized: readonly string[] }, owns: readonly string[]): string | null {
  if (owns.length > 0) return null;
  if (stage.materialized.length === 0) {
    return `the cursor moved to stage ${num(stage.number)}, ${stage.name} — which landed no column into the data space, so no picture on this desk is drawn from it and the layout did not change`;
  }
  return (
    `the cursor moved to stage ${num(stage.number)}, ${stage.name} — it landed ${stage.materialized.join(', ')} onto the rows, and no picture on this desk is bound to any of them, ` +
    `so there is nothing for the layout to promote. The columns are in the data space all the same: the Sheet shows them, and a chart bound to one would become this stage's picture.`
  );
}

/**
 * WHAT THE RETRY CONTROL IS CALLED — and the name is what stops a reader
 * expecting the wrong thing from it.
 *
 * ── THE ONE FACT THE NAME HAS TO CARRY ─────────────────────────────────────
 * **The record survives the retry.** A reload would re-run stages 1 to 4 and
 * mint a fresh log, which destroys the record the ranking is pre-registered
 * against — *you cannot retry your way to a cleaner history*, and that
 * discipline is the whole reason stage 5 lands a commit before anything checks
 * it. So this re-asks on the LIVE session, lands its own act, and the earlier
 * refusal stays on the ledger: two asks, two entries, neither overwriting the
 * other.
 *
 * The name says so, because a control named *retry* alone invites the reading
 * where the page starts over.
 */
export const retryLabelOf = (busy: boolean): string =>
  busy ? 'asking again…' : 'ask the model again — on this same run, keeping this refusal on the record';

/**
 * WHAT THE CARD'S SECOND CONTROL IS CALLED — the one that binds the 3D view's
 * colour channel to the column the ranking landed, and unbinds it again.
 *
 * ── THE NAME SAYS *BIND*, BECAUSE THAT IS THE ACT ──────────────────────────
 * The picks become visible in the molecule because a DECLARED CHANNEL is bound
 * to a LANDED COLUMN, through the reencode door every other picture on this
 * desk already has. Nothing is painted, nothing is highlighted by hand, and
 * there is no new chart kind and no new emission kind — so the control is named
 * for the binding rather than for the colours, and a reader pressing it learns
 * which of the desk's own machinery it is about to use.
 *
 * ── AND IT NAMES THE ABSENCE, BOTH WAYS ────────────────────────────────────
 * `absent` is the hard half of the column: most residues carry no rank, and
 * the only honest thing the legend, the caption and this label can all say is
 * the word. So the label counts the ranked residues and says what the rest are
 * — never *the other 179 are ranked last*, which is what a colour ramp would
 * have implied all on its own.
 */
export function paintLabelOf(bound: boolean, ranked: number, absent: number): string {
  return bound
    ? 'colour the 3D structure by chain again — back to a label read off the file'
    : `colour the 3D structure by the model’s rank — ${num(ranked)} ranked, and the other ${num(absent)} shown as absent rather than as a rank of their own`;
}

/**
 * THE CARDS OF WORDS IN THE RAIL — the blocked ones, with stage 5's REPLACED
 * by its recommendation where something performed it.
 *
 * Replaced rather than added: two cards for one step would be two answers to
 * *what happened at stage 5*, and the published build's answer is the one that
 * is wrong on a build that just ran it. `null` gives back
 * {@link BLOCKED_CARDS} exactly.
 */
export function railCards(input: HotspotCardInput | null): readonly BlockedCard[] {
  if (input === null) return BLOCKED_CARDS;
  return BLOCKED_CARDS.map((card) => (card.id === HOTSPOTS_STAGE ? hotspotCard(card, input) : card));
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

/**
 * THE ONE STAGE THAT HAS TO SAY WHICH METHOD PLACED ITS NUMBERS — the clause
 * for its panel line and the sentences for its note.
 *
 * ── WHY THIS STAGE AND NOT THE OTHERS ──────────────────────────────────────
 * The other three stages MEASURE something off the entry's own coordinates:
 * there is one way to count a contact and one way to roll a probe, so a
 * reader cannot mistake one implementation's number for another's. This one
 * cites a curated alignment somebody else published and computes only WHERE
 * OUR RESIDUES SIT IN IT — and that placement has a better method (the
 * family's own profile HMM) and a worse one (pairwise alignment to a consensus
 * folded from the columns). This build ships the worse one.
 *
 * So the method rides the stage's own quiet line, where a reader who reads
 * nothing else still meets it, AND leads its note. The card's face carries it
 * too (`web/src/protCells.tsx`, the conservation cell's `foot`) — three places
 * because the fact is load-bearing, and ONE OWNER for the words
 * (`src/prot/placement.ts` · `PlacementStrategy.said`), so the three cannot
 * spell it differently.
 *
 * `null` for every other stage — an absence is absent.
 */
export function placementSaid(here: StepperStage, run: ProtRun | null): { readonly clause: string; readonly note: readonly string[] } | null {
  if (!here.acts.some((a) => a.act === CONSERVATION_ACT)) return null;
  const strategy = PLACEMENT_STRATEGIES[PLACEMENT_HERE];
  const counts = run?.conservation?.counts ?? null;
  const cited = (counts?.chains ?? []).flatMap((chain) => (chain.cited === null ? [] : [chain.cited]));
  return {
    clause: `${strategy.said}${cited.length === 0 ? '' : `, over ${cited.join(' and ')}`}`,
    note: [
      `THE ALIGNMENT IS CITED, NOT BUILT${cited.length === 0 ? '' : `: ${cited.join(' and ')}`} — somebody else's published, versioned work, named by the accession AND the version read out of the alignment's own header.`,
      `WHAT THE SCORE IS: ${SCORE_IS} ${SCORE_IS_NOT}`,
      strategy.why,
      ...(run?.conservation?.refusals ?? []),
    ],
  };
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
  const placed = placementSaid(here, run);
  return {
    eyebrow: `Stage ${num(here.number)} · ${here.label}${word === null ? '' : ` · ${word}`}`,
    mark: `stage ${num(here.number)}`,
    // the fold's own line; then the recorder's, verbatim; then the one derived
    // clause about the arrangement, which is about the SCREEN and not about the
    // protein
    //
    // AND, FOR THE ONE STAGE WHOSE NUMBERS COULD BE MISTAKEN FOR SOMEBODY
    // ELSE'S, which method placed them — on the LINE and not only in the note.
    // See {@link placementSaid}.
    line: placed === null ? here.subtitle : `${here.subtitle} — ${placed.clause}`,
    sentences: [...(placed === null ? [] : placed.note), ...narrative, arrangement],
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
