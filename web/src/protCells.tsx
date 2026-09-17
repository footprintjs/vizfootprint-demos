/**
 * THE PROTEIN DESK'S CELLS — a third-party 3D view, three first-party charts and
 * a receipt, over one table.
 *
 * The shell (`vizfootprint-studio/desk`) draws the band, the ✎, the ✕, the time
 * strip, the editor and the sheet; what is here is this demo's own:
 *
 *   `structure`  Mol* — somebody else's viewer — bound through the renderer
 *                contract and nothing else ({@link StructureCell}). A click on
 *                a residue lands a commit; a selection anywhere else repaints
 *                the molecule.
 *   `rama`       the two backbone angles, one dot per residue, drawn by the
 *                library's own `VizScatter`. A drag across the phi axis is an
 *                interval commit, and the 3D view greys what it drops.
 *   `interface`  how many contacts across the two chains each residue is in —
 *                a `VizBar` over a column an ACT lands ({@link interfaceBars}).
 *   `surface`    how much of each residue the solvent can reach — a `VizLine`
 *                over two more ({@link surfaceRun}).
 *   `pairs`      every contact the engine found, as rows: the act's own answer,
 *                which is the one thing on this desk that is not in the data
 *                space at all.
 *
 * ── THE TWO CELLS THAT ARRIVE, and what they draw before they can ───────────
 * `interface` and `surface` are declared over columns no act has landed yet.
 * Until their stage runs there is nothing to draw, and what they draw instead is
 * **the library's own refusal sentence, verbatim** — collected by a real gesture
 * on the real session before the stages
 * (`src/prot/session.ts` · `probeTheUnlandedColumns`) and handed in on
 * {@link ProtDeskData.refusals}. Not a spinner, not an empty axis, not a
 * paraphrase: a picture that cannot be drawn says why, in the words of whatever
 * refused it. Step the time cursor back behind the commit and the same sentence
 * returns, because the rows the cell is built from lost the column again.
 *
 * `interfaceLanded` and `surfaceLanded` are what tell that state apart from a
 * reader's own filter — see them for why the two questions are asked separately.
 *
 * ── The captions carry the silences ─────────────────────────────────────────
 * Four things about this desk are quiet unless somebody says them, so each is
 * COUNTED here, from the rows on screen, and printed under the picture where it
 * happens:
 *
 *   1. the residues with NO backbone angle — the first and last of each chain,
 *      which have no neighbour to measure a torsion against. They are absent
 *      from the scatter entirely and painted in the absence colour in 3D
 *      (counted, both captions);
 *   2. the records the parse did not keep, by class and with the reason — the
 *      waters, the repeated alternate locations, the side-chain atoms (counted
 *      by the ETL, printed under the 3D view);
 *   3. the CAMERA: a reader can orbit the molecule and nothing records it, which
 *      is why the view declares `canPanZoom: false` rather than pretending;
 *   4. the FILE: the bytes the 3D view draws reach it as a factory argument, so
 *      no commit carries their version — the one thing on this desk that is not
 *      on the trace, said under the picture it affects.
 *
 * And three more, for the two new pictures: WHICH interaction providers Mol* was
 * asked for (an absent kind means nobody looked, not that there are none), WHICH
 * parameters the probe rolled at, and the fact that the two chains SHARE the
 * run's axis. All three are read off the acts' own answers and recomputed
 * nowhere.
 *
 * ── And one thing this file may NOT do ──────────────────────────────────────
 * Decide what colour a residue is. That decision is the renderer's
 * ({@link paintOf}, from the rows and the fold), and the legend below reads the
 * SAME constants it paints from — one owner, two readers.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { VizBar, VizLine, VizScatter, VizTable, bindRenderer, keepPredicate, type BarDatum, type BoundRenderer, type ChartEmission, type ContractGap, type LinePoint, type RenderRow, type RenderSelection, type ScatterDatum } from 'vizfootprint-ui';
import type { DeskChart, DeskProjection } from 'vizfootprint-studio/desk';
import { PAINT_COLOR, PAINT_MEANING, PAINT_WORDS, VALUE_PALETTE, molstarRenderer, type PaintWord } from './molstarRenderer.js';
import { INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, RESIDUE_KEY, STRUCTURE_VIEW, SURFACE_VIEW } from '../../src/prot/def.js';
import { INTERACTION_COLUMNS, INTERFACE_CONTACTS_COLUMN, SASA_COLUMN } from '../../src/prot/analyses.js';
import type { ProtCounts, SkippedRecords } from '../../src/prot/etl.js';
import type { ProtRun } from '../../src/prot/orchestrator.js';
import type { StructureArtifact, UnlandedRefusals } from '../../src/prot/session.js';
import { emitIntent, type Row } from './derive.js';

export { STRUCTURE_VIEW, RAMA_VIEW, INTERFACE_VIEW, SURFACE_VIEW, PAIRS_VIEW };

/**
 * The cells the story figure is built from, in the order a reader meets them.
 *
 * The two ACT-FED charts are in it, and deliberately: a story column that
 * skipped them would tell the desk's story without the half that arrives.
 */
export const PROT_STORY_FIGURE = [STRUCTURE_VIEW, RAMA_VIEW, INTERFACE_VIEW, SURFACE_VIEW] as const;

// ── what the page hands in ───────────────────────────────────────────────────

export interface ProtDeskData {
  readonly residues: readonly Row[];
  /** What the parse counted — never recomputed here. */
  readonly counts: ProtCounts;
  /** Every coordinate record the parse did not keep, with its reason. */
  readonly skipped: readonly SkippedRecords[];
  /** The file the 3D view draws, as the host holds it (no version — see `src/prot/session.ts`). */
  readonly structure: StructureArtifact;
  /**
   * What the two stages landed, and the pair table they cut — `null` on a
   * surface whose stages were never run. The two act-fed cells read their
   * counts from here and RECOMPUTE none of them.
   */
  readonly run: ProtRun | null;
  /**
   * The sentences the library refused each unlanded chart with, before the
   * stages ran (`src/prot/session.ts` · `probeTheUnlandedColumns`). A cell whose
   * column is not on its rows prints the one for its own view — verbatim,
   * never paraphrased, and never a spinner.
   */
  readonly refusals: UnlandedRefusals;
}

const count = (n: number): string => n.toLocaleString('en-US');
const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** A colour is a number in the paint and a string on the page — converted in exactly one place. */
export const swatchOf = (word: PaintWord): string => hex(PAINT_COLOR[word]);

/** The first hues a residue's own VALUE can take — the legend's stand-in for a word with no single colour. */
export const valueSwatches = (howMany = 3): readonly string[] => VALUE_PALETTE.slice(0, howMany).map(hex);

// ── the 3D cell: a bound renderer inside a React cell ────────────────────────

export interface StructureCellProps {
  readonly viewId: string;
  /** The rows, exactly as the contract wants them — the host's, already folded. */
  readonly rows: readonly RenderRow[];
  readonly selection: RenderSelection;
  /** The channel→field fold at the cursor: the renderer reads `color` off it. */
  readonly encodings: Readonly<Record<string, string>>;
  readonly structure: StructureArtifact;
  readonly width: number;
  readonly height: number;
  onEmit(emission: ChartEmission): void;
  /** A contract gap — shown, never swallowed: a refused bind is a real fault. */
  onGap(gap: ContractGap): void;
}

/**
 * MOL*, MOUNTED — the whole integration surface, and it is the contract's:
 * `bindRenderer` once, `update` per frame, `unmount` on the way out. This
 * component knows nothing about Mol*; it does not import it and could not.
 *
 * Two details are the contract's rather than React's. The bind happens ONCE
 * (the effect's only dependencies are the view and the file) because a mount is
 * expensive and a remount would lose the camera; the emit callback is therefore
 * read through a ref, the way the library's own gallery cell does it. And
 * `theme` is pushed as `{}` — the desk resolves its tokens as inline CSS
 * properties and hands a cell no resolved `--vzf-*` map, and this renderer
 * needs numbers rather than CSS colours anyway (`molstarRenderer.ts` ·
 * `PAINT_COLOR`). An empty map is the honest thing to push when the host has
 * nothing to say.
 */
export function StructureCell(props: StructureCellProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const boundRef = useRef<BoundRenderer | null>(null);
  const onEmitRef = useRef(props.onEmit);
  onEmitRef.current = props.onEmit;
  const onGapRef = useRef(props.onGap);
  onGapRef.current = props.onGap;
  const { viewId, structure } = props;

  useEffect(() => {
    const el = hostRef.current;
    if (el === null) return;
    const res = bindRenderer(molstarRenderer({ structure: { text: structure.text, at: structure.at }, keyField: RESIDUE_KEY }), el, {
      viewId,
      callbacks: {
        emit: (emission) => onEmitRef.current(emission),
        // the three verbs this renderer never speaks: it has no hover concept,
        // no re-encode affordance of its own, and a camera the contract cannot move
        hover: () => {},
        reencodeRequest: () => {},
        navigate: () => {},
      },
      onGap: (gap) => onGapRef.current(gap),
    });
    if (!res.ok) return;
    boundRef.current = res.view;
    return () => {
      res.view.unmount();
      boundRef.current = null;
    };
  }, [viewId, structure]);

  useEffect(() => {
    if (props.width < 1 || props.height < 1) return;
    const outcome = boundRef.current?.update({
      rows: props.rows,
      encodings: props.encodings,
      selection: props.selection,
      hover: null,
      theme: {},
      size: { width: props.width, height: props.height },
    });
    // a refused push is a typed gap and never silent (there is one today:
    // `layers-unsupported`, which this desk cannot reach — it pushes no layers)
    if (outcome !== undefined && !outcome.ok) onGapRef.current(outcome.gap);
  }, [props.rows, props.selection, props.encodings, props.width, props.height]);

  return <div ref={hostRef} className="prot-molstar" style={{ width: '100%', height: '100%' }} />;
}

// ── the cells ────────────────────────────────────────────────────────────────

/** A coordinate, or an angle, is a number only when it really is one. */
const placed = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * WHAT EACH CHAIN IS NUMBERED, folded from the rows on screen — the twin of
 * `src/prot/def.ts` · `numberedRanges`, and it exists for the reason every
 * count in this file does: the caption and the picture are built from the same
 * rows, so neither can outrun the other.
 *
 * From `resnum` and never from the residue COUNT: a chain of 96 residues
 * numbered 1–96 is a coincidence of this entry, and a caption built from the
 * count would be quietly wrong about its own axis on a chain with a gap.
 */
function numberedRanges(residues: readonly Row[], counts: ProtCounts): string {
  return counts.chains
    .map(({ chain }) => {
      const numbers = residues.filter((r) => r['chain'] === chain).map((r) => Number(r['resnum'])).filter((n) => Number.isFinite(n));
      return numbers.length === 0 ? `${chain} has no numbered residue on screen` : `${chain} is numbered ${count(Math.min(...numbers))}–${count(Math.max(...numbers))}`;
    })
    .join(' and ');
}

/**
 * THE RECEIPT'S COLUMNS, in the order the act declares them — read off
 * {@link INTERACTION_COLUMNS} and never listed again here.
 *
 * All thirteen, because this table IS the receipt: a contact whose atoms and
 * feature words were hidden could not be checked against the file, and checking
 * it against the file is what `tests/prot-interactions.test.ts` does with three
 * of these rows. The headers are the field names, which are the names the def's
 * meanings are written about.
 */
export const PAIR_TABLE_COLUMNS: readonly string[] = INTERACTION_COLUMNS.map((c) => c.name);

/**
 * The dots of the Ramachandran scatter: one per residue that has BOTH angles.
 *
 * A residue with one angle and not the other has no place on this plane — an
 * absent phi is not a phi of zero — so it is left out and COUNTED in the
 * caption. That is the same treatment the 3D view gives it in colour, from the
 * same rows.
 */
export function ramaDots(residues: readonly Row[], xField: string, yField: string): readonly ScatterDatum[] {
  return residues.flatMap((r) => {
    const x = r[xField];
    const y = r[yField];
    if (!placed(x) || !placed(y)) return [];
    return [{ id: String(r[RESIDUE_KEY]), x, y, row: r }];
  });
}

/**
 * The bars of the interface chart: one per DISTINCT value of the category field,
 * as tall as the SUM of the column the `residueContacts` act landed.
 *
 * A row with no such column contributes NO BAR — not a bar of zero — and that is
 * the distinction this whole cell is about: before the act the column is not
 * there and the chart draws nothing at all, while after it a residue that
 * touches no other chain has a real count of 0 and gets a bar of height zero.
 * `placed` tells the two apart, because `undefined` is a missing column and `0`
 * is a count.
 *
 * WHY A SUM AND NOT ONE DATUM PER ROW. The category is whatever the encoding
 * fold binds, and a reader can move it: bound to the residue key it is unique,
 * so each bar is one residue's own value and the sum is a sum of one. Bound to
 * `chain` it is not, and a datum per row would hand `VizBar` 185 bars in two
 * slots. Summing makes that re-encode read as what it says — the contacts of a
 * whole chain — instead of as a pile of overlapping bars, and it is the
 * treatment the other desks' bars already give a category.
 */
export function interfaceBars(residues: readonly Row[], categoryField: string, valueField: string): readonly BarDatum[] {
  const totals = new Map<string, number>();
  for (const row of residues) {
    const value = row[valueField];
    if (!placed(value)) continue;
    const category = String(row[categoryField]);
    totals.set(category, (totals.get(category) ?? 0) + value);
  }
  return [...totals.entries()].map(([category, count]) => ({ category, count }));
}

/**
 * The points of the surface run: one per residue, on the BAND of residue
 * numbers, split into one series per chain.
 *
 * `category` and not `date`, and the reason is the library's: `VizLine` places
 * a point on a run of dates or in a band slot, and a residue number is neither
 * a date nor a magnitude (`src/prot/def.ts` declares it `scale: 'discrete'` —
 * residue 88 is not eleven times residue 8). So the slots are the numbers, both
 * chains share them, and the caption says so.
 *
 * The points are sorted by that number, which is what fixes the band's ORDER: a
 * band takes its slot order from the order the points arrive in, so handing
 * them over in row order would put chain A's 1–96 first and then silently
 * append any number chain B has that chain A lacks. Sorting is one line and it
 * makes the axis mean what a reader reads off it.
 */
export function surfaceRun(residues: readonly Row[], xField: string, yField: string, seriesField: string): readonly LinePoint[] {
  const points = residues.flatMap((r) => {
    const x = r[xField];
    const y = r[yField];
    // a y that is not a number is not a magnitude, and an x that is nothing at
    // all is not a slot — but an x that is a STRING is a perfectly good band
    // label, because the encoding plane lets a line's x be one and a reader can
    // move that binding to `chain` or `resname`
    if (y === null || y === undefined || !placed(y) || x === null || x === undefined) return [];
    return [{ x, point: { category: String(x), value: y, series: String(r[seriesField]) } }];
  });
  // SORT ONLY WHEN THE AXIS IS A NUMBER. The band takes its slot order from the
  // order the points arrive in, so a numeric axis is sorted numerically — which
  // is what makes residue 10 sit after residue 9 rather than after residue 1 —
  // and a category axis is left in the table's own order, because nothing here
  // knows a better one for it.
  const numeric = points.every((p) => placed(p.x));
  return (numeric ? [...points].sort((a, b) => Number(a.x) - Number(b.x)) : points).map((p) => p.point);
}

/**
 * The cells, over the desk's projection.
 *
 * Called once, from the desk's own body, so the memos below are real hooks and
 * behave like hooks — the rule `vizfootprint-studio/desk` · `DeskCharts`
 * states, and the reason the other three desks' cells are written the same way.
 */
export function useProtCells(desk: DeskProjection, data: ProtDeskData): readonly DeskChart[] {
  const { residues, counts, skipped, structure, run, refusals } = data;
  const { state, view, columns, shown } = desk;
  const selFor = desk.selFor;

  /** WHICH FIELD A CHANNEL ENCODES — the session's answer at the cursor, never a constant written here. */
  const phiField = desk.bound(RAMA_VIEW, 'x', 'phi');
  const psiField = desk.bound(RAMA_VIEW, 'y', 'psi');
  const barCategory = desk.bound(INTERFACE_VIEW, 'category', RESIDUE_KEY);
  const barValue = desk.bound(INTERFACE_VIEW, 'y', INTERFACE_CONTACTS_COLUMN);
  const runX = desk.bound(SURFACE_VIEW, 'x', 'resnum');
  const runY = desk.bound(SURFACE_VIEW, 'y', SASA_COLUMN);
  const runSeries = desk.bound(SURFACE_VIEW, 'color', 'chain');

  const sel = [state.selections, state.links, state.cleared] as const;

  const dots = useMemo(() => ramaDots(residues, phiField, psiField), [residues, phiField, psiField]);
  const bars = useMemo(() => interfaceBars(residues, barCategory, barValue), [residues, barCategory, barValue]);
  /** How many residues touch the other chain AT ALL — counted from the bars on screen, so the caption cannot outrun the picture. */
  const interfaceTouching = useMemo(() => bars.filter((b) => b.count > 0).length, [bars]);
  /**
   * HAS THE STAGE LANDED? — asked of the WHOLE table, once per act-fed chart,
   * and asked separately from "are there marks to draw".
   *
   * The two are not the same question and conflating them would print a refusal
   * about the log when the truth was a reader's own filter: the run below
   * narrows its points under every other view's clause, so an empty picture can
   * mean "nobody has landed this column" OR "your selection keeps nothing".
   * These flags answer only the first, off the unfiltered rows, so each cell's
   * empty state says the true thing.
   */
  const interfaceLanded = useMemo(() => residues.some((r) => placed(r[barValue])), [residues, barValue]);
  const surfaceLanded = useMemo(() => residues.some((r) => placed(r[runY])), [residues, runY]);
  /**
   * The contact rows the act handed back, exactly as it handed them back.
   *
   * NOT read from the session, and that is the whole point of the receipt cell:
   * these rows are not in the data space, so there is no `viewQuery` that would
   * answer with them and no clause that could narrow them
   * (`src/prot/analyses.ts`). They come off {@link ProtDeskData.run}, which is
   * the act's own answer, held beside the session.
   */
  const pairRows = useMemo(() => (run?.pairs?.rows ?? []) as readonly Row[], [run]);

  /** The rows the 3D view is handed: every residue, as the contract's plain records. */
  const structureRows = useMemo<readonly RenderRow[]>(() => residues as readonly RenderRow[], [residues]);

  /** The fold at the 3D view's address — its own clause kept, everyone else's applied. */
  const structureSelection = useMemo(
    () => selFor(STRUCTURE_VIEW),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
    [...sel],
  );
  const ramaSelection = useMemo(
    () => selFor(RAMA_VIEW),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
    [...sel],
  );
  const interfaceSelection = useMemo(
    () => selFor(INTERFACE_VIEW),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
    [...sel],
  );
  const surfaceSelection = useMemo(
    () => selFor(SURFACE_VIEW),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
    [...sel],
  );

  /**
   * The run's points, NARROWED BY EVERY OTHER VIEW'S CLAUSE — the one cell on
   * this desk that filters its own data instead of dimming it, because
   * `VizLine` takes no selection: the library's own line is "controlled like its
   * siblings: the consumer passes the (already crossfiltered) raw points". So
   * the consumer does, with `keepPredicate`, which excludes this view's own
   * clause by contract — otherwise a drag on this axis would move its own
   * target.
   */
  const runPoints = useMemo(
    () => surfaceRun(residues.filter(keepPredicate(surfaceSelection) as (row: Row) => boolean), runX, runY, runSeries),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- surfaceSelection is memoised on the same slices
    [residues, runX, runY, runSeries, surfaceSelection],
  );

  /** How many residues the file gives no angle for: the absence, counted from the rows the desk holds. */
  const noAngle = useMemo(() => residues.filter((r) => !placed(r[phiField]) || !placed(r[psiField])).length, [residues, phiField, psiField]);

  const emit = (viewId: string, verb: string) => (e: ChartEmission) => void view.emit(viewId, e, emitIntent(verb, e));
  const reencode = (v: string, c: string, f: string): void => void view.reencode(v, c, f);

  /**
   * The legend — the same constants the paint uses, in the same order.
   *
   * `kept` is the one word with no single colour: those residues are painted
   * from the VALUE palette, one hue per distinct value of the bound column, so
   * its entry shows the first three of those hues rather than a swatch nothing
   * on screen is painted in. A legend that showed one would be naming a colour
   * the picture does not contain.
   */
  const legend = (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '.6rem', verticalAlign: 'middle' }}>
      {PAINT_WORDS.map((word) => (
        <span key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}>
          {(word === 'kept' ? valueSwatches() : [swatchOf(word)]).map((color) => (
            <span key={color} aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />
          ))}
          {PAINT_MEANING[word]}
        </span>
      ))}
    </span>
  );

  return [
    {
      id: STRUCTURE_VIEW,
      weight: 5,
      caption: (
        <>
          {[
            `${count(counts.residues)} residues in ${count(counts.chains.length)} chains (${counts.chains.map((c) => `${c.chain}: ${count(c.residues)}`).join(', ')}), drawn by Mol* — a molecular viewer this project did not write, bound through the renderer contract and given nothing but rows, colours and the file`,
            // SILENCE ONE, where it happens
            noAngle === 0 ? null : `${count(noAngle)} of them are painted in the absence colour: the file gives no backbone angle for the first or the last residue of a chain, and an angle nobody can measure is absent rather than zero`,
            // SILENCE TWO — the parse's own report, in the ETL's words
            `the picture is the whole file; the TABLE is narrower, and here is every record the parse did not keep — ${skipped.map((s) => `${count(s.records)} ${s.reason}`).join(', ')}`,
            // SILENCE THREE
            'you can orbit this molecule with the mouse and nothing here records it: the camera is Mol*’s own, no call in this contract moves it, and the view declares that (`canPanZoom: false`) rather than pretending a viewport is on the trace',
            // SILENCE FOUR — the finding, in front of the reader
            `the bytes this picture is drawn from (${count(structure.characters)} characters of ${structure.at.split('/').pop() ?? 'the structure file'}) reach the viewer as an argument, not as a declared table: the library's source port carries rows, CSV and JSON, and a structure file is none of them — so every other number on this desk is stamped with the version it was true of, and this picture is not`,
            'click a residue to select it: one commit, on the log, with its cause — and the scatter and the sheet answer',
          ]
            .filter((s): s is string => s !== null)
            .join(' · ')}{' '}
          {legend}
          {desk.words(STRUCTURE_VIEW)}
        </>
      ),
      render: ({ width, height }) => (
        <StructureCell
          viewId={STRUCTURE_VIEW}
          rows={structureRows}
          selection={structureSelection}
          // the encoding fold at the cursor: a rebind of `color` in the desk's ✎ repaints the molecule
          encodings={shown[STRUCTURE_VIEW] ?? {}}
          structure={structure}
          width={width}
          height={height}
          onEmit={emit(STRUCTURE_VIEW, 'select')}
          onGap={(gap) => desk.say(`the 3D view's contract refused a request (${gap.code}): ${gap.detail}`)}
        />
      ),
    },
    {
      id: RAMA_VIEW,
      weight: 4,
      caption: (
        <>
          {[
            `${count(dots.length)} of ${count(counts.residues)} residues, at the two torsion angles that describe each backbone — ${phiField} across, ${psiField} up, both in degrees, both read off the coordinates in the file`,
            // SILENCE ONE again, at the picture it removes marks from
            noAngle === 0
              ? null
              : `the other ${count(noAngle)} have no dot at all: ${count(counts.phiAbsent)} have no ${phiField} (the first residue of a chain has no previous carbon to measure from) and ${count(counts.psiAbsent)} no ${psiField} (the last has no next nitrogen) — an absent angle is not an angle of zero, so there is no dot in the middle`,
            'both axes are the extent of the residues in this entry, not the whole −180 to 180 a torsion can take: a frame’s domain is folded from the rows, and there is no way to declare the wider one',
            'drag across the horizontal axis to keep a range of angles — the 3D view greys every residue the range drops',
          ]
            .filter((s): s is string => s !== null)
            .join(' · ')}
          {desk.words(RAMA_VIEW)}
        </>
      ),
      render: ({ width, height }) => (
        <VizScatter
          viewId={RAMA_VIEW}
          data={dots}
          xField={phiField}
          yField={psiField}
          xLabel={`${phiField} (degrees)`}
          yLabel={`${psiField} (degrees)`}
          ariaLabel={desk.altShort(RAMA_VIEW)}
          selection={ramaSelection}
          columns={columns}
          fits={desk.fitsOf(RAMA_VIEW)}
          encoding={shown[RAMA_VIEW] ?? {}}
          width={width}
          height={height}
          onEmit={emit(RAMA_VIEW, 'filter')}
          onReencode={reencode}
        />
      ),
    },
    {
      id: INTERFACE_VIEW,
      weight: 4,
      caption: (
        <>
          {[
            !interfaceLanded
              ? // THE REFUSAL, VERBATIM — the library's own sentence, collected by a
                // real gesture on this session before the stage ran
                // (`src/prot/session.ts` · probeTheUnlandedColumns). Not a
                // paraphrase and not a spinner: this picture has nothing to draw
                // and the reason is a fact about the log, so the reason is what is
                // printed.
                `nothing to draw yet — the library refused a click on this chart in its own words: “${refusals[INTERFACE_VIEW] ?? `no column "${barValue}" in table "residues"`}”. The column arrives when the interactions stage lands its second act, and steps back out of the table the moment the time cursor moves behind that commit`
              : `${count(bars.length)} residues, each bar as tall as the number of contacts that residue makes with the OTHER chain — ${count(interfaceTouching)} of them touch it at all, and the rest are a real count of zero`,
            run?.pairs?.counts === undefined
              ? null
              : `${count(run.pairs.counts.crossing)} of the ${count(run.pairs.counts.rows)} contacts in the entry cross the two chains; the kinds present are ${run.pairs.counts.byKind.map((k) => `${count(k.contacts)} ${k.kind}`).join(', ')}`,
            run?.pairs?.counts === undefined
              ? null
              : // WHICH KINDS COULD EVER APPEAR — read off the engine, never chosen
                // here. An absent word means nobody asked for it, which is a
                // different statement from "there are none", and only this line
                // can tell a reader which one they are looking at.
                `Mol* was asked for ${run.pairs.counts.providersOn.join(', ')} and NOT for ${run.pairs.counts.providersOff.join(', ')} — those are the engine's own defaults, read rather than set, so a kind missing from the list above may simply be a kind nobody looked for`,
            run?.pairs?.dropped === undefined
              ? null
              : `and every contact the table does NOT carry is counted with its reason — ${run.pairs.dropped.map((d) => `${count(d.contacts)} ${d.reason}`).join(', ')}`,
            !interfaceLanded ? null : 'click a bar to select that residue: the 3D view lights it, the scatter keeps its dot and the sheet narrows to it',
          ]
            .filter((s): s is string => s !== null)
            .join(' · ')}
          {desk.words(INTERFACE_VIEW)}
        </>
      ),
      render: ({ width, height }) =>
        !interfaceLanded ? (
          <div role="status" style={{ padding: 12, opacity: 0.7 }}>
            {refusals[INTERFACE_VIEW] ?? `no column "${barValue}" in table "residues"`}
          </div>
        ) : (
          <VizBar
            viewId={INTERFACE_VIEW}
            data={bars}
            field={barCategory}
            label={`contacts across the interface, per ${barCategory}`}
            ariaLabel={desk.altShort(INTERFACE_VIEW)}
            selection={interfaceSelection}
            columns={columns}
            fits={desk.fitsOf(INTERFACE_VIEW)}
            encoding={shown[INTERFACE_VIEW] ?? {}}
            width={width}
            height={height}
            onEmit={emit(INTERFACE_VIEW, 'select')}
            onReencode={reencode}
          />
        ),
    },
    {
      id: SURFACE_VIEW,
      weight: 4,
      caption: (
        <>
          {[
            !surfaceLanded
              ? `nothing to draw yet — the library refused a drag across this chart in its own words: “${refusals[SURFACE_VIEW] ?? `no column "${runY}" in table "residues"`}”. The column arrives when the surface stage lands, one commit after the interactions stage`
              : `${count(runPoints.length)} residues, each one's solvent-accessible surface area in square ångström against the number the depositors gave it, one line per chain`,
            !surfaceLanded
              ? null
              : // THE AXIS, said out loud: both chains are numbered from 1, so the
                // slots are shared and the colour is the only thing telling the two
                // lines apart. The library refuses an identifier on a line's x by
                // name, which is why the axis is the number and this sentence exists.
                `BOTH CHAINS SHARE THE AXIS — ${numberedRanges(residues, counts)} — so a slot holds one residue of each and the colour, not the position, says which chain you are reading`,
            run?.surface?.counts === undefined
              ? null
              : `Shrake–Rupley as Mol* implements it, at the engine's own defaults: a ${String(run.surface.counts.probeSize)} Å probe sampled at ${count(run.surface.counts.spherePoints)} points per atom, with non-polymer atoms ${run.surface.counts.nonPolymer ? 'occluding' : 'NOT occluding'} — so the deposited waters are taken away and a residue is small here because the other chain is in the way`,
            run?.surface?.counts === undefined
              ? null
              : `${count(run.surface.counts.buried)} of the ${count(run.surface.counts.landed)} residues have an area of exactly zero — the probe cannot touch them anywhere — and ${count(run.surface.counts.noValue)} have no value at all; the relative value beside it is ABSENT rather than zero for ${count(run.surface.counts.noReference)} residues, the ones whose type has no published maximum to divide by`,
            !surfaceLanded ? null : `drag across the axis to keep a range of residue numbers — every other picture narrows with it, and this one narrows too: ${count(runPoints.length)} of the ${count(counts.residues)} residues are drawn under the selections in force`,
          ]
            .filter((s): s is string => s !== null)
            .join(' · ')}
          {desk.words(SURFACE_VIEW)}
        </>
      ),
      render: ({ width, height }) =>
        !surfaceLanded ? (
          <div role="status" style={{ padding: 12, opacity: 0.7 }}>
            {refusals[SURFACE_VIEW] ?? `no column "${runY}" in table "residues"`}
          </div>
        ) : (
          <VizLine
            viewId={SURFACE_VIEW}
            data={runPoints}
            dateField={runX}
            valueField={runY}
            xLabel={`${runX} (residue number, both chains)`}
            yLabel={`${runY} (Å²)`}
            ariaLabel={desk.altShort(SURFACE_VIEW)}
            columns={columns}
            fits={desk.fitsOf(SURFACE_VIEW)}
            encoding={shown[SURFACE_VIEW] ?? {}}
            width={width}
            height={height}
            onEmit={emit(SURFACE_VIEW, 'filter')}
            onReencode={reencode}
          />
        ),
    },
    {
      id: PAIRS_VIEW,
      weight: 3,
      caption: (
        <>
          {[
            pairRows.length === 0
              ? 'the interactions stage has not landed on this session — no act has cut a contact table, so there is nothing here and no refusal to quote either: this picture reads the act’s own answer rather than a column of a table'
              : `${count(pairRows.length)} contacts, as the engine reported them: the two residues, the two atoms, what the engine calls each end, its word for the contact and how far apart the two features' centres are`,
            // THE FINDING, in front of the reader, at the picture it shapes.
            'THIS TABLE IS NOT IN THE DATA SPACE. The library lands a computed table into the dashboard only when the act is a declared aggregate — the group columns, the key and the relation back to the parent all come from that declaration — and a contact table found by somebody else’s interaction engine is an aggregate of nothing the derive grammar can spell. So these rows ride on the act’s own answer: the commit that cut them is on the log, but no clause reaches them, no selection narrows them, and a click here would be a gesture about nothing, which is why this view declares it cannot probe',
            pairRows.length === 0 || run?.pairs?.counts === undefined
              ? null
              : run.pairs.counts.throughAlternateLocation === 0
                ? null
                : `${count(run.pairs.counts.throughAlternateLocation)} of these contacts run through an ALTERNATE LOCATION of one of their atoms — an atom the residues table's own parse did not keep (it keeps the first location and counts the rest). The residue still has a row, so nothing is orphaned; the two parses simply disagree about how many atoms that residue has, and this is the count of where`,
          ]
            .filter((s): s is string => s !== null)
            .join(' · ')}
          {desk.words(PAIRS_VIEW)}
        </>
      ),
      render: ({ width, height }) =>
        pairRows.length === 0 ? (
          <div role="status" style={{ padding: 12, opacity: 0.7 }}>
            the interactions stage has not landed on this session — no contact table has been cut
          </div>
        ) : (
          <VizTable
            viewId={PAIRS_VIEW}
            data={pairRows}
            columns={PAIR_TABLE_COLUMNS}
            idField="interaction_key"
            ariaLabel={desk.altShort(PAIRS_VIEW)}
            width={width}
            height={height}
          />
        ),
    },
  ];
}
