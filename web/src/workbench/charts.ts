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
 * columns the view binds at the cursor. `null` for a picture no stage produced
 * — the 3D view and the scatter draw the FILE's own columns, and the card says
 * so rather than crediting a stage that did not put them there.
 */
export function stageOfChart(stages: readonly StepperStage[], viewId: string, shown: Readonly<Record<string, Readonly<Record<string, string>>>>): StepperStage | null {
  return stages.find((stage) => chartsOfStage(stage, shown).includes(viewId)) ?? null;
}

/** `Stage 2 · How much of each residue the solvent can reach`, or the words for a picture no stage produced. */
export function ownerLine(stage: StepperStage | null, fromTheFile: string): string {
  return stage === null ? fromTheFile : `Stage ${stage.number.toLocaleString('en-US')} · ${stage.label}`;
}
