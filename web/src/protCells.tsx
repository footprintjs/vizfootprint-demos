/**
 * THE PROTEIN DESK'S CELLS — a third-party 3D view and a first-party scatter,
 * over one table.
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
 * ── And one thing this file may NOT do ──────────────────────────────────────
 * Decide what colour a residue is. That decision is the renderer's
 * ({@link paintOf}, from the rows and the fold), and the legend below reads the
 * SAME constants it paints from — one owner, two readers.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { VizScatter, bindRenderer, type BoundRenderer, type ChartEmission, type ContractGap, type RenderRow, type RenderSelection, type ScatterDatum } from 'vizfootprint-ui';
import type { DeskChart, DeskProjection } from 'vizfootprint-studio/desk';
import { PAINT_COLOR, PAINT_MEANING, PAINT_WORDS, VALUE_PALETTE, molstarRenderer, type PaintWord } from './molstarRenderer.js';
import { RAMA_VIEW, RESIDUE_KEY, STRUCTURE_VIEW } from '../../src/prot/def.js';
import type { ProtCounts, SkippedRecords } from '../../src/prot/etl.js';
import type { StructureArtifact } from '../../src/prot/session.js';
import { emitIntent, type Row } from './derive.js';

export { STRUCTURE_VIEW, RAMA_VIEW };

/** The cells the story figure is built from, in the order a reader meets them. */
export const PROT_STORY_FIGURE = [STRUCTURE_VIEW, RAMA_VIEW] as const;

// ── what the page hands in ───────────────────────────────────────────────────

export interface ProtDeskData {
  readonly residues: readonly Row[];
  /** What the parse counted — never recomputed here. */
  readonly counts: ProtCounts;
  /** Every coordinate record the parse did not keep, with its reason. */
  readonly skipped: readonly SkippedRecords[];
  /** The file the 3D view draws, as the host holds it (no version — see `src/prot/session.ts`). */
  readonly structure: StructureArtifact;
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
 * The cells, over the desk's projection.
 *
 * Called once, from the desk's own body, so the memos below are real hooks and
 * behave like hooks — the rule `vizfootprint-studio/desk` · `DeskCharts`
 * states, and the reason the other three desks' cells are written the same way.
 */
export function useProtCells(desk: DeskProjection, data: ProtDeskData): readonly DeskChart[] {
  const { residues, counts, skipped, structure } = data;
  const { state, view, columns, shown } = desk;
  const selFor = desk.selFor;

  /** WHICH FIELD A CHANNEL ENCODES — the session's answer at the cursor, never a constant written here. */
  const phiField = desk.bound(RAMA_VIEW, 'x', 'phi');
  const psiField = desk.bound(RAMA_VIEW, 'y', 'psi');

  const sel = [state.selections, state.links, state.cleared] as const;

  const dots = useMemo(() => ramaDots(residues, phiField, psiField), [residues, phiField, psiField]);

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
  ];
}
