/**
 * THE CARDS, AS RULES — LAYER 3: which card is the hero, which stage owns each
 * picture, and what colour a chain is. Pure functions; no React, no DOM, no
 * session.
 *
 * ── THE COLOUR IS THE INTERESTING ONE ──────────────────────────────────────
 * The design is specific about two hues: chain A in the accent blue, chain B in
 * a burnt orange, with a lighter pair in the dark theme. Our charts are the
 * library's and must stay the library's, so the two colours reach them through
 * the ONE hook `vizfootprint-ui` offers for a categorical scale: every chart
 * (`VizLine`, `VizBar`, `VizScatter`) accepts `colorOf`, a host function from a
 * category to a colour, and keeps its answer.
 *
 * WHICH chain gets which hue is DERIVED, not declared: the order is the order
 * the file first mentions each chain (`ProtCounts.chains`, which the ETL builds
 * in that order), so a two-chain entry gets the design's pair and a chain
 * beyond the second takes the accent rather than a colour nobody chose. An
 * entry whose chains are named `X` and `Y` works without this file knowing the
 * letters.
 *
 * What this does NOT do is put the colour on the record. `colorOf` is a prop,
 * so the hue is not in any commit, no saved picture carries it and nothing on
 * the log says why a line is orange — which is a finding about the library, not
 * a licence to hand-draw a mark.
 */
import { PROT_ENCODINGS } from '../../../src/prot/def.js';
import type { ProtCounts } from '../../../src/prot/etl.js';
import type { StepperStage } from '../protStages.js';
import { chartsOfStage } from '../protStages.js';
import type { LegendChip } from './ChartCard.js';
import type { WorkbenchInk } from './tokens.js';

/** The chains, in the order the file first mentions them, paired with the ink each one is drawn in. */
export function chainInk(counts: ProtCounts, ink: WorkbenchInk): readonly { readonly chain: string; readonly color: string }[] {
  const hues = [ink.chainA, ink.chainB];
  return counts.chains.map((chain, index) => ({ chain: chain.chain, color: hues[index] ?? ink.accent }));
}

/**
 * THE FUNCTION THE LIBRARY'S CHARTS TAKE — category in, colour out.
 *
 * A category the entry has no chain for (a re-encode has moved `color` onto
 * another column, or the series is the unsplit `undefined`) gets the accent:
 * the chart is then not split by chain at all, and painting it in chain A's
 * blue would be naming a chain the picture is not about.
 */
export function chainColorOf(counts: ProtCounts, ink: WorkbenchInk): (category: string | undefined) => string {
  const byChain = new Map(chainInk(counts, ink).map((c) => [c.chain, c.color]));
  return (category) => (category === undefined ? ink.accent : (byChain.get(category) ?? ink.accent));
}

/** The chain chips — the swatch and the chain's own name, for the viewer well and for a card whose chart draws no legend of its own. */
export function chainChips(counts: ProtCounts, ink: WorkbenchInk): readonly LegendChip[] {
  return chainInk(counts, ink).map(({ chain, color }) => ({ id: chain, name: `chain ${chain}`, color }));
}

// ── the arrangement ──────────────────────────────────────────────────────────

/** The hero band and the band that recedes. */
export interface Split<T> {
  readonly hero: readonly T[];
  readonly rest: readonly T[];
}

/**
 * WHICH CARD IS BIG — derived from the focus set and never hard-coded, so
 * moving the stepper moves the hero.
 *
 * A cell is in focus when the set names its own id or the address its marks
 * select under (`DeskChart.clauseId`), which is the same pair the desk's ✕
 * follows.
 */
export function splitByFocus<T extends { readonly id: string; readonly clauseId?: string }>(cells: readonly T[], focus: ReadonlySet<string>): Split<T> {
  const hero = cells.filter((c) => focus.has(c.clauseId ?? c.id) || focus.has(c.id));
  return { hero, rest: cells.filter((c) => !hero.includes(c)) };
}

/**
 * WHICH STAGE OWNS A PICTURE — the inverse of the focus fold, for the line in
 * the corner of every card.
 *
 * Asked the same way round: a stage owns a chart when `chartsOfStage` names it,
 * which is the intersection of the columns that stage's acts landed with the
 * columns the view binds at the cursor — and, for the step that landed at the
 * ROOT, the columns NO act landed, which is why the 3D view and the
 * backbone-angle scatter are step 1's and not nobody's. `actColumns` is what
 * makes that side of the intersection real; without it the parse's step owns
 * every picture, so callers hand it in (`web/src/protStages.ts` ·
 * `actColumnsOf`).
 *
 * `null` is left for a picture that binds nothing and is nobody's receipt.
 */
export function stageOfChart(stages: readonly StepperStage[], viewId: string, shown: Readonly<Record<string, Readonly<Record<string, string>>>>, actColumns: ReadonlySet<string>): StepperStage | null {
  return stages.find((stage) => chartsOfStage(stage, shown, actColumns).includes(viewId)) ?? null;
}

/**
 * `Stage 3 · How much of each residue the solvent can reach` — who put this
 * picture's columns on the desk.
 *
 * FOR THE STEP THAT LANDED AT THE ROOT it adds three words, because the foot
 * used to say *"from the file's own columns — no act landed these"* and that
 * was a half-truth: it reads as an absence, as though nobody were responsible
 * for those columns, when in fact the parse is — and the parse is step 1. So
 * the line credits the step and states the one fact a reader needs when the
 * number they pressed does not move the cursor. Derived from
 * `StepperStage.landsAtRoot`, never typed per view.
 *
 * `fromTheFile` is left for a picture that binds nothing and is nobody's
 * receipt — no view on this desk is that today.
 */
export function ownerLine(stage: StepperStage | null, fromTheFile: string): string {
  if (stage === null) return fromTheFile;
  // THE SHORT DECLARED NAME, not the sentence: a footer is a Mono line of
  // counts and an owner, and the sentence wrapped it to two lines — which is
  // the register this desk has spent four rounds clearing from under a drawing.
  // The declared sentence is in the card's own note, at its lead.
  const who = `Stage ${stage.number.toLocaleString('en-US')} · ${stage.name}`;
  // …and the one fact a reader needs when the number they pressed does not move
  // the cursor, in three words rather than a clause. The whole account is
  // behind `Full note` (`web/src/workbench/panel.ts` · `StageWords.account`).
  return stage.landsAtRoot ? `${who} · no act, no commit` : who;
}

// ── the rail, and the order the plan puts it in ──────────────────────────────

/** One thing waiting in the rail, with the plan step that owns it. `null` for a picture no step produced. */
export interface RailSlot<T> {
  readonly step: number | null;
  readonly item: T;
}

/**
 * THE RAIL IS ORDERED BY THE PLAN — a tile's place is its stage's step.
 *
 * So the rail reads the way the stepper above it reads: sequence analysis,
 * structure analysis, interaction mapping, hot spot prediction, functional
 * annotation, each one's card at its own step. A picture NO step produced — the
 * 3D view and the Ramachandran scatter, which draw the file's own columns —
 * comes after all six, because no stage put those columns there and pretending
 * one did is exactly what `stageOfChart` refuses to do.
 *
 * Stable within a step: two pictures of one stage keep the dashboard's own
 * order, which is the order the def declares its views in.
 */
export function byPlanStep<T>(slots: readonly RailSlot<T>[]): readonly T[] {
  return slots
    .map((slot, at) => ({ slot, at }))
    .sort((a, b) => (a.slot.step ?? Number.POSITIVE_INFINITY) - (b.slot.step ?? Number.POSITIVE_INFINITY) || a.at - b.at)
    .map(({ slot }) => slot.item);
}

// ── the L, and the shape each picture wants ─────────────────────────────────

/**
 * WHAT ASPECT A PICTURE WANTS — `wide`, `square` or `tall`.
 *
 * The layout is an L because of ASPECT RATIO, and the ratios are the design's
 * own artboards rather than anybody's taste:
 *
 *   | the design drew it                        | it wants |
 *   |-------------------------------------------|----------|
 *   | surface area per residue `1296 × 380`     | 3.4 : 1  |
 *   | cross-chain contacts     `590 × 150`      | 3.9 : 1  |
 *   | Ramachandran             `200 × 200`      | 1 : 1    |
 *   | the 3D structure         roughly square   | 1 : 1    |
 *   | the contacts table       rows             | height   |
 *
 * So the bottom strip takes what wants WIDTH and the right column takes what
 * wants a SQUARE or height. Which is which is read off the def's own
 * `chartKind` (`src/prot/def.ts` · `PROT_ENCODINGS`) — a declared fact about
 * the view, not a typed list of where each chart goes: a `line` and a `bar` are
 * plotted against an axis of residues and are unreadable narrow; a `scatter` of
 * two angles and a molecule are unreadable wide; a view with no declared
 * encoding surface shows ROWS, and rows want height and scroll themselves.
 *
 * It reads the DEF and not the session because the wire does not carry it: the
 * served `ViewView` has `chartKind` only for a LAYER, so a plain view's
 * declared kind never reaches the reader's side (reported as a finding).
 */
export type TileShape = 'wide' | 'square' | 'tall';

const SHAPE_OF_KIND: Readonly<Record<string, TileShape>> = { line: 'wide', bar: 'wide', scatter: 'square', point: 'square', structure: 'square' };

/** The shape one view's picture wants. A view the def gives no encoding surface draws rows, which want height. */
export function shapeOfView(viewId: string): TileShape {
  const declared = PROT_ENCODINGS.find((encoding) => encoding.viewId === viewId);
  return declared === undefined ? 'tall' : (SHAPE_OF_KIND[declared.chartKind] ?? 'square');
}

/**
 * WHAT A RAIL TILE'S CONTROL IS CALLED — and it names what comes WITH the
 * picture, because that is the honest half.
 *
 * A tile is a NAME, a KIND and a COUNT — deliberately not a picture (see
 * `./ChartCard.tsx` · `ChartTile` for why a 150px chart would be a lie). The
 * picture itself, the how-to-read line, the stage that landed it and the FULL
 * NOTE all belong to the focused card, and a press brings all of them. Nothing
 * is deleted; the press is the path, and the name says so rather than leaving a
 * reader to discover it.
 */
export const promoteChartLabel = (label: string): string => `bring ${label} into the focus — the picture, its full note, its own numbers and the stage that landed it`;

/** What the control on the tile of a stage that will not run here is called. There is no picture to promote: what opens is the reason, at the size of the thing it is about. */
export const promoteCardLabel = (name: string): string => `bring ${name} into the focus — it will not run on this build, and its card says why`;
