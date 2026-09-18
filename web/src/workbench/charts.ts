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

// ── THE BOUNDARY THE READER MOVES, and the floors that keep the layout's promise ──

/**
 * WHY THESE RULES ARE HERE AND NOT IN A FILE OF THEIR OWN.
 *
 * `tests/prot-layers.test.ts` asserts the FOLDER'S MANIFEST by name — the four
 * components and the five rule modules — so that a module added here cannot
 * slip past the four rules by being classified as something nobody checks. A
 * sixth rule module would have meant editing that manifest, and this packet was
 * asked to leave that suite alone. These functions belong to the same job this
 * file already has (`splitByFocus`, `shapeOfView`, `byPlanStep`: WHERE each
 * picture goes), so they landed beside it rather than forcing the edit.
 *
 * ── WHAT A DIVIDER IS, AND WHAT IT IS NOT ──────────────────────────────────
 * The author asked for a corner resize on the focus widget, aspect-locked.
 * What is built is two DIVIDERS instead, and free rectangles:
 *
 *   · the useful gesture is not *make this box bigger*, it is *give the focus
 *     more room and the satellites less*. A corner drag scales one pane and
 *     leaves the grid to cope, which on a viewport-exact layout (`protDesk.tsx`
 *     · the page is `height: 100dvh` and never scrolls) means either dead space
 *     or overflow. Moving the BOUNDARY redistributes the grid's own fractions
 *     and the region stays exactly full.
 *   · and the ratios differ by three to four times across what lands in the
 *     slot — the surface run wants 3.4 : 1, the Ramachandran 1 : 1, off the
 *     design's own artboards (`shapeOfView` above carries the table). One
 *     locked ratio is wrong for most of them, and locking to the CURRENT chart
 *     means the slot changes shape on every stage press, which is the
 *     disorienting thing this page already decided against
 *     (`tests/prot-viewport.smoke.test.ts` pins the focus card's height across
 *     a promotion).
 *
 * ── AND A DRAG MAY NOT BREAK WHAT THE LAYOUT PROMISES ──────────────────────
 * This layout exists so that a selection made in one chart is visible in the
 * others — that is why the page fits the viewport. A drag that shrinks the
 * satellites past the point where they can draw their marks destroys the only
 * thing the layout is for, silently. So every divider has a FLOOR, and not one
 * of the floors is a number anybody picked: each is folded out of a number the
 * library or this page already measured ({@link dividerFloors}).
 */

/**
 * THE INSTRUMENT'S DIVIDER TRACK, in px.
 *
 * It is the ten pixels the grid already spent as `gap: 10` between the focus
 * and its satellites, now spent on a TRACK a reader can grab: `gap: 0` plus a
 * 10px track is the same ten pixels, so the geometry of the page at rest is
 * unchanged to the pixel.
 *
 * It is also the STEP one arrow press moves the boundary — a press moves it by
 * the divider's own width, which is one number rather than two.
 */
export const DIVIDER_TRACK = 10;

/**
 * THE PAGE'S OWN COLUMN CLAMP — `clamp(16rem, 22vw, 22.5rem)` — as the numbers
 * it is made of, and the ONE owner of them.
 *
 * The floors below are folded out of the same two rem values the track string
 * is built from ({@link columnTracks}), so the width at which the column stops
 * shrinking and the width the drag refuses to take it below cannot drift apart.
 * `rootPx` is the document's own root size, which is what a `rem` resolves
 * against here (this desk's `font-size: 13` sits on its own root, not on
 * `html`).
 */
export const COLUMN_CLAMP = { floor: 16, vw: 22, ceiling: 22.5, rootPx: 16 } as const;

/** The page's own row ratio: the bottom strip's `0.34fr` against the focus's `1fr` (`protDesk.tsx` — *the reclaimed height goes to the tiles*). */
export const STRIP_FR = 0.34;

/**
 * A TILE'S OWN CHROME above its picture — its header row, its Mono count line
 * and its padding (`./ChartCard.tsx` · `ChartTile`).
 *
 * MEASURED, not assumed, and the same at both budgets:
 * `tests/prot-viewport.smoke.test.ts` prints every tile's box and the frame
 * inside it — 171px holding a 125px picture at 1280×800, 221px holding 175px at
 * 1440×900, and the strip's 150px holding 104px. 46px, three times.
 * `tests/prot-dividers.smoke.test.ts` pins it: at the strip's floor the tile's
 * frame must still clear {@link markFloor}, which it cannot if this number has
 * drifted.
 */
export const TILE_CHROME = 46;

/**
 * THE FOCUSED CARD'S OWN CHROME above its picture — its title row, the
 * library's derived `howToRead` line, the `Full note` control and the Mono
 * footer (`./ChartCard.tsx` · `ChartCard`).
 *
 * Measured the same way and also identical at both budgets: a 441px card
 * holding a 906×278 picture at 1280×800, a 516px card holding 1031×353 at
 * 1440×900. 163px, twice.
 */
export const CARD_CHROME = 163;

/** The library's own fixed margin inside a chart box, in the shape `vizfootprint-ui` · `framePad` returns. */
export interface PaneMargin {
  readonly l: number;
  readonly r: number;
  readonly t: number;
  readonly b: number;
}

/**
 * THE FLOOR OF A PANE THAT MUST STILL DRAW ITS MARKS — one clamp above the
 * library's own, and every pixel of it the library's number.
 *
 * `vizfootprint-ui` · `framePlotBox` CLAMPS: a frame shorter than its own
 * margin draws an empty box rather than an inside-out one, so `pad.t + pad.b`
 * is the height at which the LIBRARY ITSELF says there is no plot left. The
 * measured disaster on this page was five pixels above it — a 67px frame under
 * `VizLine`'s 62px of margin, 185 dots reported and a 5px band nobody could see
 * (`../protCells.tsx` · `AXIS_ROOM` records it). **Reported and invisible reads
 * as broken rather than as small**, which is the impression this desk cannot
 * afford.
 *
 * So the floor asks the marks to get HALF the pane's own margin back as plot:
 * `(pad.t + pad.b) × 1.5`. At the union margin of every chart on this desk —
 * `framePad(['line', 'bar', 'point'])`, 20px above and 48px below — that is
 * **102px of pane for 34px of band**, which
 *
 *   · REFUSES the pane that was broken (67px, and it would have needed 93px
 *     under the line's own 62px margin);
 *   · ACCEPTS both panes this page already measures as honest — the strip's
 *     104px frame drawing 185 bars, and the column's 125px drawing 181 dots
 *     over a 56px band;
 *   · and sits BELOW `AXIS_ROOM` (170), which is the same question asked about
 *     the LABELS instead of the marks. Between the two a pane draws its marks
 *     and drops its labels, which is exactly what ships today.
 *
 * The width arm is the same rule sideways, and on this page it never governs:
 * the column's declared 256px floor is wider than it ({@link dividerFloors}).
 */
export function markFloor(pad: PaneMargin): { readonly height: number; readonly width: number } {
  return { height: Math.round((pad.t + pad.b) * 1.5), width: Math.round((pad.l + pad.r) * 1.5) };
}

/** What the floors are folded OUT of — every one of them a number the library or this page already carries. */
export interface FloorBasis {
  /** The library's own margin, as `vizfootprint-ui` · `framePad` reports it for the kinds this desk draws. */
  readonly pad: PaneMargin;
  /** The height at which a pane can afford its axis chrome (`../protCells.tsx` · `AXIS_ROOM`). */
  readonly axisRoom: number;
}

/** One divider's two stops, in px of the region: the floor of the FOCUS side and the floor of the SATELLITE side. */
export interface Stops {
  /** The least the focus side may be — `near`, because the focus is the near side of both dividers. */
  readonly near: number;
  /** The least the satellite side may be. */
  readonly far: number;
}

/** Both dividers' stops. */
export interface DividerFloors {
  /** The vertical divider, in px of the region's WIDTH: the focus column against the column of satellites. */
  readonly rail: Stops;
  /** The horizontal divider, in px of the region's HEIGHT: the focus row against the strip of satellites. */
  readonly strip: Stops;
}

/**
 * THE FOUR FLOORS, AND WHERE EACH ONE COMES FROM — the whole of this packet's
 * law, in one fold.
 *
 * | stop | px at the library's own numbers | folded from |
 * |---|---|---|
 * | the satellite COLUMN's width | 256 | the page's own `clamp(16rem, …)` — *the width at which a scatter still reads as a shape* — never below {@link markFloor}'s width arm (105) |
 * | the focus COLUMN's width | 360 | the same clamp's CEILING, `22.5rem`: the widest a satellite tile can ever be, and **a focus the size of a tile is not a focus** |
 * | the satellite STRIP's height | 148 | {@link markFloor} (102) plus the tile's own chrome (46) — the height at which its bars stop being a band |
 * | the focus ROW's height | 333 | `AXIS_ROOM` (170) plus the card's own chrome (163): the focus is the one pane that KEEPS its axis labels, and the labels are also the encoding pickers (`../protCells.tsx`), so a focus that dropped them would take this page's only re-encode control off the screen |
 *
 * Not one of them is a number chosen for this packet, which is the point: the
 * drag stops where a pane would stop being able to do the job the layout is
 * bought for.
 */
export function dividerFloors(basis: FloorBasis): DividerFloors {
  const marks = markFloor(basis.pad);
  return {
    rail: {
      near: COLUMN_CLAMP.ceiling * COLUMN_CLAMP.rootPx,
      far: Math.max(COLUMN_CLAMP.floor * COLUMN_CLAMP.rootPx, marks.width),
    },
    strip: {
      near: basis.axisRoom + CARD_CHROME,
      far: marks.height + TILE_CHROME,
    },
  };
}

/**
 * THE TWO FRACTIONS A READER CAN MOVE, each the SATELLITE side's share of its
 * own axis — the right column's of the region's width, the bottom strip's of
 * its height.
 *
 * `null` means *where the page put it*: the reader has not moved this boundary,
 * and the grid gets the page's own track expression rather than a fraction.
 * That is what keeps the layout at rest byte-identical to the one the viewport
 * smoke test measures — a default expressed as a fraction would have had to
 * re-derive `22vw` and would have been a second, drifting copy of it.
 */
export interface RegionSplit {
  readonly rail: number | null;
  readonly strip: number | null;
}

/** Where the page puts both boundaries: nowhere of the reader's choosing. */
export const SPLIT_DEFAULT: RegionSplit = { rail: null, strip: null };

/** Which stop a value was held at, if it was held at all. `'window'` = the window is too small to give both sides their floor. */
export type SplitStop = 'focus' | 'satellites' | 'window' | null;

/** A share after the rule has been applied to it, with the verdict that produced it. */
export interface Clamped {
  /** The share to lay out with. `null` = use the page's own expression, either because the reader has not moved this boundary or because the window cannot honour both floors. */
  readonly share: number | null;
  readonly stop: SplitStop;
}

/**
 * THE CLAMP — the one rule, in the one place it is spelled, and a pure
 * function of numbers so it can be tested without a DOM.
 *
 * `share` is the SATELLITE side's share of the room (the region minus the
 * divider's own track). It is asked on every render, which means it is asked of
 * a value read back out of storage as well as of one a drag just produced: **a
 * value stored at one window size can never reproduce the broken state at
 * another**, because it is the CURRENT region the floors are measured against.
 *
 * A region too small to give both sides their floor hands back `null` — the
 * page's own arrangement, which degrades the way it always did
 * (`protDesk.tsx`: below about 700px of window the instrument is cramped and
 * deliberately does not reflow) rather than a reader's preference honoured at
 * one end and broken at the other.
 */
export function clampShare(share: number | null, region: number, stops: Stops, track: number = DIVIDER_TRACK): Clamped {
  if (share === null || !Number.isFinite(share)) return { share: null, stop: null };
  const room = region - track;
  // the region has not been measured yet: there is nothing to clamp against,
  // and the first layout pass asks again with a real number
  if (room <= 0) return { share, stop: null };
  if (stops.near + stops.far > room) return { share: null, stop: 'window' };
  const low = stops.far / room;
  const high = 1 - stops.near / room;
  if (share < low) return { share: low, stop: 'satellites' };
  if (share > high) return { share: high, stop: 'focus' };
  return { share, stop: null };
}

/** The region a divider divides: where its content box starts on the axis, and how long that box is. */
export interface RegionAxis {
  readonly start: number;
  readonly extent: number;
}

/**
 * WHERE A POINTER PUTS THE BOUNDARY — the satellite side's share, from the
 * pointer's own client coordinate, with the divider's track centred under it.
 *
 * Unclamped on purpose: {@link clampShare} is the only place a floor is
 * applied, so there is exactly one rule and the drag and the stored value go
 * through it alike.
 */
export function shareAtPointer(pointer: number, axis: RegionAxis, track: number = DIVIDER_TRACK): number {
  const room = axis.extent - track;
  if (room <= 0) return 0;
  return (axis.start + axis.extent - pointer - track / 2) / room;
}

/**
 * THE BOUNDARY MOVED BY `px` TOWARDS THE FOCUS GROWING — what one arrow press
 * means, in shares.
 *
 * Positive `px` gives the focus room and takes it from the satellites, which is
 * `ArrowRight` on the vertical divider and `ArrowDown` on the horizontal one:
 * the boundary moves the way the key points.
 */
export function shareAfterStep(share: number, region: number, px: number, track: number = DIVIDER_TRACK): number {
  const room = region - track;
  return room <= 0 ? share : share - px / room;
}

/**
 * THE SEPARATOR'S OWN NUMBERS, about the FOCUS side and in whole percents —
 * `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
 *
 * The focus side rather than the satellites' because that is the pane a reader
 * is moving the boundary FOR, and because it makes `Home` the small end and
 * `End` the large one, which is the direction a slider's two ends are read in.
 */
export function dividerValues(share: number, region: number, stops: Stops, track: number = DIVIDER_TRACK): { readonly now: number; readonly min: number; readonly max: number } {
  const room = region - track;
  if (room <= 0) return { now: 0, min: 0, max: 100 };
  const pct = (px: number): number => Math.round((px / room) * 100);
  return { now: Math.round((1 - share) * 100), min: pct(stops.near), max: 100 - pct(stops.far) };
}

/** A whole-number percentage of the room, as a share — what `Home` and `End` hand back. */
export function shareAtEdge(stops: Stops, region: number, to: 'min' | 'max', track: number = DIVIDER_TRACK): number {
  const room = region - track;
  if (room <= 0) return 0;
  return to === 'min' ? 1 - stops.near / room : stops.far / room;
}

/**
 * THE INSTRUMENT'S COLUMN TRACKS — the page's own clamp until the reader moves
 * the boundary, a share of the region after it.
 *
 * The divider is a real 10px track between them, and the grid's `gap` is 0: the
 * ten pixels are the same ten pixels, so nothing about the page at rest moved.
 */
export function columnTracks(rail: number | null): string {
  const divider = `${String(DIVIDER_TRACK)}px`;
  return rail === null
    ? `minmax(0, 1fr) ${divider} clamp(${String(COLUMN_CLAMP.floor)}rem, ${String(COLUMN_CLAMP.vw)}vw, ${String(COLUMN_CLAMP.ceiling)}rem)`
    : `minmax(0, ${(1 - rail).toFixed(4)}fr) ${divider} minmax(0, ${rail.toFixed(4)}fr)`;
}

/** The instrument's row tracks, the same way: the page's own `0.34fr` until the reader moves the boundary. */
export function rowTracks(strip: number | null): string {
  const divider = `${String(DIVIDER_TRACK)}px`;
  return strip === null
    ? `minmax(0, 1fr) ${divider} minmax(0, ${String(STRIP_FR)}fr)`
    : `minmax(0, ${(1 - strip).toFixed(4)}fr) ${divider} minmax(0, ${strip.toFixed(4)}fr)`;
}

/**
 * THE USED TRACK SIZES a browser resolved, off a computed
 * `grid-template-columns` / `grid-template-rows` — `"940px 10px 282px"`.
 *
 * Read rather than re-derived, so the separator's `aria-valuenow` is the truth
 * about the layout whether the track is the page's own `clamp(…)` or a
 * reader's fraction. A value that cannot be parsed yields nothing, and the
 * caller keeps what it had.
 */
export function trackPx(used: string): readonly number[] {
  const found = used
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))
    .filter((n) => Number.isFinite(n));
  return found.length === 3 ? found : [];
}

// ── the words, because a stop is a reason and not an error ───────────────────

/** Which boundary a sentence is about. */
export type DividerId = 'rail' | 'strip';

/** What each separator DIVIDES — its accessible name, and nothing about how it is worked. */
export const DIVIDER_LABEL: Readonly<Record<DividerId, string>> = {
  rail: 'the boundary between the focus and the column of satellite panes on the right',
  strip: 'the boundary between the focus and the strip of satellite panes below it',
};

/** How it is worked — the tooltip, and the half a mouse reader would otherwise never meet. */
export const DIVIDER_HINT: Readonly<Record<DividerId, string>> = {
  rail: 'drag it, or press the left and right arrow keys; Home and End go to its two stops and Enter puts it back where the page had it',
  strip: 'drag it, or press the up and down arrow keys; Home and End go to its two stops and Enter puts it back where the page had it',
};

/**
 * WHAT THE PAGE SAYS WHEN THE BOUNDARY REACHES A STOP — a reason, in the
 * register the rest of the desk uses, and never an error.
 *
 * The reader pushed until the satellites would stop showing their marks, or
 * until the focus would stop being one, and the sentence says which and why.
 * `null` at rest: a line that was always there would be an instruction, and
 * this desk has spent four rounds clearing instructions from between the
 * stepper and the charts.
 */
export function stopSentence(which: DividerId, stop: SplitStop): string | null {
  if (stop === null) return null;
  if (stop === 'window') return 'This window is too small to give both sides their floor, so the boundary is back where the page put it.';
  if (which === 'rail') {
    return stop === 'satellites'
      ? 'That is as far as it goes. The panes on the right are at the width where a scatter still reads as a shape, and narrower they would stop being able to show a selection — which is what this layout is for.'
      : 'That is as far as it goes. The focus is down to the width of the widest tile, and a focus the size of a tile is not a focus.';
  }
  return stop === 'satellites'
    ? 'That is as far as it goes. The strip is at the height where its bars are still a band rather than a line, and the library’s own margin takes the rest.'
    : 'That is as far as it goes. The focus is down to the height where it would lose its axis labels — and the labels are also the encoding pickers, so that is this page’s only way to re-encode a chart.';
}

// ── remembering it, per reader, and nowhere near the record ──────────────────

/**
 * WHERE A READER'S OWN BOUNDARIES ARE REMEMBERED — one `localStorage` key, in
 * this browser only.
 *
 * A drag is a LAYOUT PREFERENCE AND NOT AN ANALYTICAL ACT: it lands no commit,
 * appears on no log, and nothing in `why()` mentions it. That is why it is not
 * on the session at all — a saved picture that carried a pane's size would be
 * claiming a reader's furniture was part of their finding. It is named in
 * `protDesk.tsx` · `NotHere` for the same reason every other omission is.
 */
export const SPLIT_STORAGE_KEY = 'pw.prot.dividers.v1';

/**
 * A STORED VALUE, READ SAFELY — `null` in, nonsense in, a private window's
 * throw already caught by the caller: every one of them lands on the page's own
 * arrangement.
 *
 * It refuses a share outside `(0, 1)` here, which is the part of the rule that
 * needs no region; the part that does — the floors — is applied on every render
 * by {@link clampShare}, so a value stored at one window size is clamped
 * against the window it is READ into and not the one it was written at.
 */
export function parseSplit(raw: string | null): RegionSplit {
  if (raw === null || raw === '') return SPLIT_DEFAULT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return SPLIT_DEFAULT;
  }
  if (typeof parsed !== 'object' || parsed === null) return SPLIT_DEFAULT;
  const held = parsed as Readonly<Record<string, unknown>>;
  const share = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1 ? value : null);
  return { rail: share(held['rail']), strip: share(held['strip']) };
}

/** The same value on its way out. A split nobody has moved is not written at all — the caller removes the key instead, so a reader who resets leaves nothing behind. */
export function serialiseSplit(split: RegionSplit): string | null {
  return split.rail === null && split.strip === null ? null : JSON.stringify({ ...(split.rail === null ? {} : { rail: split.rail }), ...(split.strip === null ? {} : { strip: split.strip }) });
}
