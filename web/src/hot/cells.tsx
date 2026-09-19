/**
 * THE FIFTH DESK'S CELLS — four pictures over the columns its six acts landed.
 *
 * ── THE FOUR LAYERS, KEPT FROM THE FIRST COMMIT ────────────────────────────
 * The protein desk's `web/src/workbench/README.md` states the author's ruling —
 * *theme separate, components separate, business logic, data logic separate* —
 * and this desk obeys it rather than retrofitting it:
 *
 *   1 · THEME      no colour is written here. Every paint is either the
 *                  library's own ink (a chart with no `colorOf`) or the one
 *                  palette this file hands to `colorOf`, which is
 *                  {@link PATCH_PALETTE}, declared in one place and read by
 *                  both the charts that use it. There is not one `#rrggbb` in
 *                  the composition or the page.
 *   2 · COMPONENTS the pictures are `vizfootprint-ui`'s, themed only through
 *                  the hooks the library offers (`colorOf`, `fits`,
 *                  `encoding`). Nothing here reaches inside a `.vzf-*` class.
 *   3 · BUSINESS   everything below `── the folds ──` is a PURE FUNCTION of the
 *                  rows: input is the run, output is the props. Each one is
 *                  exported and tested without a DOM.
 *   4 · DATA       not here. The session is touched by `src/hot/session.ts` and
 *                  by the page's boot, and by nothing in this file: `useHotCells`
 *                  is handed rows that were already read.
 *
 * ── AND THE FOLDS ARE THIS DESK'S OWN, DELIBERATELY ────────────────────────
 * `web/src/protCells.tsx` already has a run fold and a bar fold that would do.
 * Importing them would pull `./molstarRenderer.js` — and through it Mol* — into
 * THIS page's static closure, which is exactly the property `web/site.vite.config.ts`
 * keeps for the protein desk in the other direction. Four small pure folds are
 * cheaper than a shared megabyte. **FINDING, reported rather than worked
 * around:** those folds are not about proteins at all and belong in a shared
 * module (or in `vizfootprint-ui`), and the only thing stopping that today is
 * that they live in a file that also mounts a viewer.
 */
import { useMemo, type ReactNode } from 'react';
import { VizBar, VizLine, VizScatter, keepPredicate, type BarDatum, type LinePoint, type ScatterDatum } from 'vizfootprint-ui';
import type { DeskChart, DeskProjection } from 'vizfootprint-studio/desk';
import { emitIntent, pickedFrom, type Row } from '../derive.js';
import { PATCHES_VIEW, PRIOR_VIEW, RESIDUE_KEY, STRUCTURAL_VIEW, TOGETHER_VIEW, WEIGHTS_SAID } from '../../../src/hot/def.js';
import { PATCH_COLUMN, PRIOR_BASIS_COLUMN, PRIOR_COLUMN, STRUCTURAL_BASIS_COLUMN, STRUCTURAL_COLUMN } from '../../../src/hot/analyses.js';
import { CA_CUTOFF } from '../../../src/hot/extent.js';
import { INTERFACE_FLOOR } from '../../../src/hot/score.js';
import type { Patch } from '../../../src/hot/extent.js';

export { STRUCTURAL_VIEW, PRIOR_VIEW, TOGETHER_VIEW, PATCHES_VIEW };

/**
 * THE HEIGHT AT WHICH A PANE STILL HAS ROOM FOR AXIS CHROME, in px — the twin
 * of `web/src/protCells.tsx` · `AXIS_ROOM`, and its argument is quoted rather
 * than re-derived: *below this height the MARKS stay and the labels go — the
 * marks are what show a selection, the labels are not, and AN ILLEGIBLE LABEL
 * IS NOT A LABEL.*
 *
 * It is DECLARED here rather than imported from that file for the reason this
 * module's header already gives about its folds: importing `protCells.tsx`
 * would pull `molstarRenderer.js`, and through it Mol*, into this page's static
 * closure — the property `tests/hot-site.test.ts` exists to keep.
 *
 * EXPORTED, because the divider floors are folded out of it
 * (`web/src/workbench/charts.ts` · `dividerFloors`, wired in `./desk.tsx`): the
 * honesty floor and the floor of the gesture are the same floor.
 */
export const AXIS_ROOM = 170;

/**
 * THE SCALE BOTH SCORES ARE DECLARED ON — a fixed weight budget, never
 * renormalised over the terms that landed (`src/hot/score.ts`).
 *
 * ── WHY IT IS DECLARED RATHER THAN LEFT TO THE CHART ───────────────────────
 * A chart with no declared domain draws against its own data's extent PADDED BY
 * A CONSTANT IN THE COLUMN'S OWN UNITS — 5 on x and 0.5 on y
 * (`vizfootprint/ui` · `VizScatter`, `extentFor(..., padFor(xKind, 5))`). On a
 * column of residue numbers that is breathing room; on a 0…1 SCORE it is a
 * catastrophe, and it was MEASURED as one on the built page: the x domain came
 * out [-4.96, 5.75], so 185 residues spanning 0.044…0.746 were crushed into
 * 63px of a 968px plot and the scatter appeared to show no residue above 0.49
 * while the bar chart beside it drew peaks of 0.75. **Two pictures on one desk
 * disagreeing about one column** — and neither was wrong about the data.
 *
 * The declared domain is not a workaround for that: it is the TRUE statement
 * about these two columns. A dot's position is now the fraction of the declared
 * budget its evidence paid for, which is the only reading of a hot-spot score
 * this desk allows.
 */
export const SCORE_DOMAIN = { x: [0, 1] as const, y: [0, 1] as const };

/**
 * ONE HUE PER PATCH, and the grey for a residue in none.
 *
 * It is a DECLARED list rather than a function of the patch's name, because a
 * patch has to keep its colour between the scatter and the bars — a reader
 * matching a dot to a mark is doing the one thing these two pictures are beside
 * each other for. The last entry is reused by every patch past the list's
 * length, which is honest (a desk with nine patches has more patches than
 * distinguishable hues) and is said in the caption rather than hidden.
 */
export const PATCH_PALETTE: readonly string[] = ['#4c6ef5', '#e8590c', '#2b8a3e', '#862e9c', '#0b7285', '#a61e4d'];
/** A residue that is in no patch at all — not a seventh patch, and never a patch's own colour. */
export const NO_PATCH_COLOR = '#9aa4b1';

/** What colour a patch is: its position in the ordered list of patches, through {@link PATCH_PALETTE}. */
export function patchPaint(patches: readonly Patch[]): (value: string | undefined) => string {
  const at = new Map(patches.map((p, index) => [p.id, index]));
  return (value) => {
    const index = value === undefined ? undefined : at.get(value);
    return index === undefined ? NO_PATCH_COLOR : (PATCH_PALETTE[Math.min(index, PATCH_PALETTE.length - 1)] ?? NO_PATCH_COLOR);
  };
}

// ── the folds — pure, exported, and tested without a DOM ────────────────────

/** A value is a magnitude only when it is a real number; anything else is a track that said nothing. */
const placed = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * THE POINTS OF A RUN — one per residue that HAS the score, in residue-number
 * order.
 *
 * A residue with no score has NO POINT, so the line stops rather than dipping
 * to zero: zero would be a measurement of *not a hot spot* that nothing
 * measured. The `cell` carries the x VALUE and not its spelling, because a band
 * slot is named `String(x)` and a gesture emitting the name would send "63" to
 * a column holding the number 63 — the lesson `web/src/protCells.tsx` ·
 * `surfaceRun` records, kept here rather than re-learnt.
 */
export function scoreRun(residues: readonly Row[], xField: string, yField: string, seriesField: string): readonly LinePoint[] {
  const points = residues.flatMap((r) => {
    const x = r[xField];
    const y = r[yField];
    if (!placed(y) || x === null || x === undefined) return [];
    return [{ x, point: { category: String(x), cell: x, value: y, series: String(r[seriesField]) } }];
  });
  const numeric = points.every((p) => placed(p.x));
  return (numeric ? [...points].sort((a, b) => Number(a.x) - Number(b.x)) : points).map((p) => p.point);
}

/**
 * THE DOTS OF THE SCATTER — one per residue that has BOTH scores.
 *
 * A residue missing either one has no dot, which is the honest answer for a
 * point that would need a coordinate nothing measured. `category` is the patch
 * the residue is in, so the colour joins this picture to the bars beside it,
 * and a residue in no patch carries the word that says so rather than an empty
 * string.
 */
export const NOT_IN_A_PATCH = 'in no patch';

export function togetherDots(residues: readonly Row[], xField: string, yField: string): readonly ScatterDatum[] {
  return residues.flatMap((r) => {
    const x = r[xField];
    const y = r[yField];
    if (!placed(x) || !placed(y)) return [];
    const patch = r[PATCH_COLUMN];
    return [{ id: String(r[RESIDUE_KEY]), x, y, category: typeof patch === 'string' && patch.length > 0 ? patch : NOT_IN_A_PATCH, row: r }];
  });
}

/**
 * THE BARS OF THE PATCH CHART — one per residue that is IN a patch, tallest
 * first.
 *
 * Only patched residues: a bar chart of every residue with the patched ones
 * somewhere in it would be a picture of the table rather than of the answer,
 * and the runs beside it already draw the table. The order is the structural
 * score descending, because a band takes its slot order from the order the
 * marks arrive in, and the thing a reader wants at the left is the peak.
 */
export function patchBars(residues: readonly Row[], categoryField: string, valueField: string): readonly BarDatum[] {
  return residues
    .filter((r) => typeof r[PATCH_COLUMN] === 'string' && placed(r[valueField]))
    .sort((a, b) => Number(b[valueField]) - Number(a[valueField]))
    // `count` is the library's name for a bar's HEIGHT, and `cell` carries the
    // category as the ROW holds it, so a press lands the column's own value and
    // not the spelling of it.
    .map((r) => ({ category: String(r[categoryField]), count: Number(r[valueField]), cell: r[categoryField] }));
}

/**
 * WHAT THE PATCH CAPTION SAYS ABOUT ONE PATCH — and the load-bearing half is
 * {@link Patch.widestSequenceGap}.
 *
 * A patch whose widest in-chain jump is above 1, or which spans two chains, is
 * a patch NO SLIDING WINDOW COULD HAVE FOUND: a window over the sequence would
 * have had to swallow every residue in between, which is where the "produce a
 * bad range and then repair it" defect comes from. So the sentence says it out
 * loud, with the number, rather than leaving a reader to notice.
 */
export function patchSaid(patch: Patch): string {
  const many = patch.members.length === 1 ? 'residue' : 'residues';
  const where = patch.chains.length > 1 ? `spans chains ${patch.chains.join(' and ')}` : `inside chain ${patch.chains[0] ?? '?'}`;
  // BOTH FACTS, never one instead of the other: a cross-chain patch is beyond a
  // window entirely AND may also jump inside a chain, and the jump is the
  // number a reader can check against the members. Reporting only the first
  // would hide the measurement.
  const clauses: string[] = [];
  if (patch.chains.length > 1) clauses.push('no sequence window could express it at all, because its residues are in two different chains');
  if (patch.widestSequenceGap > 1) clauses.push(`a sequence window over one chain would have had to swallow ${String(patch.widestSequenceGap)} residues that are NOT in it, which is where a range that then needs repairing comes from`);
  if (clauses.length === 0) clauses.push('a contiguous run, which a window would also have found');
  return `${patch.id}: ${String(patch.members.length)} ${many}, ${where}, peak ${patch.peak.residue_key} at ${patch.peak.score.toFixed(2)} — ${clauses.join('; and ')}`;
}

/** How many residues carry a score at all, and how many of those rest on every one of its terms — the absence, counted from the rows on screen. */
export function basisCounts(residues: readonly Row[], scoreField: string, basisField: string): { readonly scored: number; readonly complete: number; readonly absent: number } {
  const scored = residues.filter((r) => placed(r[scoreField]));
  const complete = scored.filter((r) => !String(r[basisField] ?? '').includes('absent')).length;
  return { scored: scored.length, complete, absent: residues.length - scored.length };
}

// ── what the page hands in ───────────────────────────────────────────────────

export interface HotDeskData {
  readonly residues: readonly Row[];
  /** The patches, as the extent act found them — never recomputed here. */
  readonly patches: readonly Patch[];
  /** The library's own sentence for the gesture this page made before any act landed. */
  readonly refusalBeforeTheAct: string | null;
}

// ── the cells ────────────────────────────────────────────────────────────────

const count = (n: number): string => n.toLocaleString('en-US');

export function useHotCells(desk: DeskProjection, data: HotDeskData): readonly DeskChart[] {
  const { residues, patches } = data;
  const { state, view, columns, shown } = desk;
  const selFor = desk.selFor;
  const bound = (viewId: string, channel: string, fallback: string): string => desk.bound(viewId, channel, fallback);

  const structuralX = bound(STRUCTURAL_VIEW, 'x', 'resnum');
  const structuralY = bound(STRUCTURAL_VIEW, 'y', STRUCTURAL_COLUMN);
  const structuralSeries = bound(STRUCTURAL_VIEW, 'color', 'chain');
  const priorX = bound(PRIOR_VIEW, 'x', 'resnum');
  const priorY = bound(PRIOR_VIEW, 'y', PRIOR_COLUMN);
  const priorSeries = bound(PRIOR_VIEW, 'color', 'chain');
  const togetherX = bound(TOGETHER_VIEW, 'x', STRUCTURAL_COLUMN);
  const togetherY = bound(TOGETHER_VIEW, 'y', PRIOR_COLUMN);
  const patchCategory = bound(PATCHES_VIEW, 'category', RESIDUE_KEY);
  const patchValue = bound(PATCHES_VIEW, 'y', STRUCTURAL_COLUMN);

  const sel = [state.selections, state.links, state.cleared] as const;

  /**
   * THE ROWS IN FORCE AT ONE ADDRESS — the library's own fold, with that
   * address's OWN clause excluded by contract.
   *
   * `VizLine` and `VizBar` take no dimming arm: the library's law is that the
   * HOST owns all aggregation, so a run handed the whole table is a run that
   * CANNOT show a clause from anywhere else, and the desk's claim to be
   * crossfiltered would be false on three of its four pictures. (`VizScatter`
   * is the exception — it dims under everyone's brush but its own — so the
   * dots are handed over whole and the library does it.)
   */
  const inForce = (viewId: string): readonly Row[] => residues.filter(keepPredicate(selFor(viewId)) as (row: Row) => boolean);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  const structuralPoints = useMemo(() => scoreRun(inForce(STRUCTURAL_VIEW), structuralX, structuralY, structuralSeries), [residues, structuralX, structuralY, structuralSeries, ...sel]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  const priorPoints = useMemo(() => scoreRun(inForce(PRIOR_VIEW), priorX, priorY, priorSeries), [residues, priorX, priorY, priorSeries, ...sel]);
  const dots = useMemo(() => togetherDots(residues, togetherX, togetherY), [residues, togetherX, togetherY]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  const bars = useMemo(() => patchBars(inForce(PATCHES_VIEW), patchCategory, patchValue), [residues, patchCategory, patchValue, ...sel]);
  const paint = useMemo(() => patchPaint(patches), [patches]);
  const structuralBasis = useMemo(() => basisCounts(residues, STRUCTURAL_COLUMN, STRUCTURAL_BASIS_COLUMN), [residues]);
  const priorBasis = useMemo(() => basisCounts(residues, PRIOR_COLUMN, PRIOR_BASIS_COLUMN), [residues]);

  /** Which residue a view is showing, read through the link graph like every other consumer. */
  const residueFor = (viewId: string): string => pickedFrom(selFor(viewId), viewId, RESIDUE_KEY, 'every residue in view');
  const emit = (viewId: string, verb: string) => (e: Parameters<typeof view.emit>[1]) => void view.emit(viewId, e, emitIntent(verb, e));
  const reencode = (v: string, c: string, f: string): void => void view.reencode(v, c, f);
  /** A picture whose column no act has landed says WHY, in the words of whatever refused it — never a spinner and never an empty axis. */
  const nothingYet = (): ReactNode => (
    <div role="status" style={{ padding: 12, opacity: 0.75 }}>
      {data.refusalBeforeTheAct ?? 'the act that lands this column has not run on this session, so there is nothing to draw'}
    </div>
  );

  return [
    {
      id: STRUCTURAL_VIEW,
      weight: 4,
      caption: (
        <>
          {[
            `${count(structuralBasis.scored)} of ${count(residues.length)} residues carry a structural score — what THIS molecule shows (${WEIGHTS_SAID.split(' · ')[0] ?? ''})`,
            `${count(structuralBasis.complete)} of them rest on all four terms; the rest are missing at least one, and the ${STRUCTURAL_BASIS_COLUMN} column beside each score names which`,
            'the line STOPS where a residue has no score rather than dipping to zero — zero would be a measurement of "not a hot spot" that nothing measured',
            `press a position to keep that residue (showing: ${residueFor(STRUCTURAL_VIEW)})`,
          ].join(' · ')}
          {desk.words(STRUCTURAL_VIEW)}
        </>
      ),
      render: ({ width, height }) =>
        structuralPoints.length === 0 ? (
          nothingYet()
        ) : (
          <VizLine
            viewId={STRUCTURAL_VIEW}
            data={structuralPoints}
            dateField={structuralX}
            valueField={structuralY}
            xLabel={`${structuralX} (residue number, every chain)`}
            yLabel={`${structuralY} (0…1, from this molecule)`}
            ariaLabel={desk.altShort(STRUCTURAL_VIEW)}
            columns={columns}
            fits={desk.fitsOf(STRUCTURAL_VIEW)}
            encoding={shown[STRUCTURAL_VIEW] ?? {}}
            width={width}
            height={height}
            // THE MARKS STAY AND THE LABELS GO below {@link AXIS_ROOM}. Measured
            // on the built page at 1440x900: in a 160px strip tile this chart's
            // rotated y label ran outside the tile and its crowding note printed
            // across the data.
            axes={height >= AXIS_ROOM}
            onEmit={emit(STRUCTURAL_VIEW, 'select')}
            onReencode={reencode}
          />
        ),
    },
    {
      id: PRIOR_VIEW,
      weight: 4,
      caption: (
        <>
          {[
            `${count(priorBasis.scored)} of ${count(residues.length)} residues carry a prior score — what somebody has ALREADY PUBLISHED (${WEIGHTS_SAID.split(' · ')[1] ?? ''})`,
            priorBasis.complete === 0
              ? `NOT ONE of them rests on both terms: the epitope source was asked about this entry, answered, and named nothing — so the ${PRIOR_COLUMN} column here is the domain term alone, and every ${PRIOR_BASIS_COLUMN} value says so`
              : `${count(priorBasis.complete)} of them rest on both terms`,
            `the other ${count(priorBasis.absent)} residues have NO prior score at all — no published source names them, and that is absent rather than zero`,
            'this is NOT the run beside it on a different scale: it is a different question, and the two are never added together',
          ].join(' · ')}
          {desk.words(PRIOR_VIEW)}
        </>
      ),
      render: ({ width, height }) =>
        priorPoints.length === 0 ? (
          nothingYet()
        ) : (
          <VizLine
            viewId={PRIOR_VIEW}
            data={priorPoints}
            dateField={priorX}
            valueField={priorY}
            xLabel={`${priorX} (residue number, every chain)`}
            yLabel={`${priorY} (0…1, from published work)`}
            ariaLabel={desk.altShort(PRIOR_VIEW)}
            columns={columns}
            fits={desk.fitsOf(PRIOR_VIEW)}
            encoding={shown[PRIOR_VIEW] ?? {}}
            width={width}
            height={height}
            axes={height >= AXIS_ROOM}
            onEmit={emit(PRIOR_VIEW, 'select')}
            onReencode={reencode}
          />
        ),
    },
    {
      id: TOGETHER_VIEW,
      weight: 5,
      caption: (
        <>
          {[
            `${count(dots.length)} residues carry BOTH scores and have a dot; the structural score is across and the prior score is up`,
            'THIS IS WHY THERE IS NO SINGLE NUMBER: the top right is high on both, the bottom right is "this molecule says so and nobody has written it down", the top left is "somebody wrote it down and this molecule does not show it" — one weighted sum cannot tell those three apart',
            'the colour is the spatial patch, the same hue the bars beside it use',
            'drag across the structural axis to keep a range of it',
          ].join(' · ')}
          {desk.words(TOGETHER_VIEW)}
        </>
      ),
      render: ({ width, height }) =>
        dots.length === 0 ? (
          nothingYet()
        ) : (
          <VizScatter
            viewId={TOGETHER_VIEW}
            data={dots}
            xField={togetherX}
            yField={togetherY}
            xLabel={`${togetherX} — what this molecule shows`}
            yLabel={`${togetherY} — what is already published`}
            colorOf={paint}
            ariaLabel={desk.altShort(TOGETHER_VIEW)}
            selection={selFor(TOGETHER_VIEW)}
            columns={columns}
            fits={desk.fitsOf(TOGETHER_VIEW)}
            encoding={shown[TOGETHER_VIEW] ?? {}}
            width={width}
            height={height}
            // THE DECLARED BUDGET, NOT THE DATA'S PADDED EXTENT — see
            // {@link SCORE_DOMAIN} for the measurement that made this a defect
            // rather than a preference.
            domain={SCORE_DOMAIN}
            /*
              ── THE X AXIS IS NOT DRAWN, AND THAT IS THE HONESTY FLOOR ───────
              `vizfootprint/ui` · `VizScatter` labels an x tick `Math.round(v)`
              — integers — while its own siblings `VizLine` and `VizBar` both
              label theirs `Math.round(v * 10) / 10`. On a 0…1 column the five
              ticks at 0, .25, .5, .75, 1 therefore read `0 0 1 1 1`: three of
              the five name a value that is not under them.

              There is NO host door for it. `xLabel` is the axis TITLE, the tick
              text takes no formatter, and the only lever a caller has is which
              axes are drawn. So the desk takes the law {@link AXIS_ROOM}
              already states — *an illegible label is not a label* — and applies
              it to a label made illegible by its VALUES rather than by its
              size: `'y'` draws this chart's own y axis (whose ticks the library
              prints unrounded, and which therefore reads 0, 0.25, 0.5, 0.75, 1)
              and leaves the x axis undrawn rather than wrong.

              THE COST, NAMED: the x axis title is also this pane's x encoding
              picker, so x cannot be re-encoded from the picture while this
              stands. It is named again on the page itself
              (`web/site/hot/entry.tsx` · `PageFoot`), with the one-line change
              the library needs to take it back.
            */
            axes={height >= AXIS_ROOM ? 'y' : false}
            onEmit={emit(TOGETHER_VIEW, 'filter')}
            onReencode={reencode}
          />
        ),
    },
    {
      id: PATCHES_VIEW,
      weight: 5,
      caption: (
        <>
          {[
            patches.length === 0
              ? `no residue scores above ${String(INTERFACE_FLOOR)}, so there is no patch — and that floor is not a number anybody tuned: it is the most a residue can score with NO interface evidence at all, folded from the weights`
              : `${count(patches.length)} ${patches.length === 1 ? 'patch' : 'patches'}, from the residues scoring above ${String(INTERFACE_FLOOR)} grouped by connected components under ${String(CA_CUTOFF)} Å between alpha carbons`,
            ...patches.map(patchSaid),
            'a patch is a SET of residues and never a range, so nothing here is ever clamped',
            `press a bar to keep that residue (showing: ${residueFor(PATCHES_VIEW)})`,
          ].join(' · ')}
          {desk.words(PATCHES_VIEW)}
        </>
      ),
      render: ({ width, height }) =>
        bars.length === 0 ? (
          nothingYet()
        ) : (
          <VizBar
            viewId={PATCHES_VIEW}
            data={bars}
            field={patchCategory}
            colorOf={(category) => paint(String(residues.find((r) => String(r[patchCategory]) === category)?.[PATCH_COLUMN] ?? ''))}
            selection={selFor(PATCHES_VIEW)}
            columns={columns}
            fits={desk.fitsOf(PATCHES_VIEW)}
            encoding={shown[PATCHES_VIEW] ?? {}}
            width={width}
            height={height}
            axes={height >= AXIS_ROOM}
            onEmit={emit(PATCHES_VIEW, 'select')}
            onReencode={reencode}
          />
        ),
    },
  ];
}
