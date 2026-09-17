/**
 * MOL* AS A CONFORMED RENDERER — the first third-party chart this repository
 * has hosted, bound through the renderer contract (RP-1, protocol 1.9) and
 * nothing else.
 *
 * `vizfootprint-ui`'s contract is one small surface: `mount(el, handshake)`
 * answers a hello, the host pushes a `RenderState` per frame, and the renderer
 * talks back through exactly four callbacks. This file implements that surface
 * over Mol*, a real molecular viewer this project did not write. What it
 * deliberately does NOT do is compute: the host owns every row, every fold and
 * every selection, and Mol* is handed nothing but colours and a file.
 *
 * ── THE SEAM, and why there is one ──────────────────────────────────────────
 * Mol* needs WebGL, a canvas and about a second of asynchronous start-up.
 * Everything ABOVE it — the hello, the paint decision, the click-to-point
 * translation, the queue that holds a frame until the viewer is ready — is
 * ordinary logic that must be provable. So this module is the PROTOCOL half
 * and it talks to the viewer through {@link StructureViewerPort}, our own
 * shape; `./molstarViewer.ts` is the one adapter that speaks Mol*, and it is
 * reached by a DYNAMIC IMPORT inside `mount` so the other three desks never
 * carry a byte of it.
 *
 * A test can therefore hand this renderer a viewer double and prove the
 * protocol — which is exactly what `tests/prot-renderer.test.ts` does with the
 * library's own conformance kit, and the report for this packet says which
 * steps that can and cannot honestly cover.
 *
 * ── WHAT THE HELLO PROMISES, and what it refuses to ─────────────────────────
 * Law 1 of the contract: a capability is true only when `update()` on THIS
 * mount visibly delivers it.
 *
 *   `canPointSelect: true`  — a click on a residue emits a `point` on the
 *                             residue key, through `handshake.callbacks`.
 *   `canHighlight: true`    — `update()` greys every residue another view's
 *                             clause drops ({@link paintOf}); that is the 3D
 *                             equivalent of a row chart's dimming.
 *   `canPanZoom: false`     — the camera is MOL*'s own. A reader can orbit it
 *                             with the mouse and nothing in this contract
 *                             hears about it; no `navigate` call moves it. So
 *                             the flag is false, and a host asking to navigate
 *                             gets the typed `navigate-unsupported` gap rather
 *                             than a silent nothing.
 *   `canBrush: false`       — there is no brush in three dimensions here.
 *   `canReencode: false`    — the renderer surfaces no re-encode affordance;
 *                             the desk's own ✎ owns the picker, and the
 *                             `reencodeRequest` verb is never called.
 *   `emissionKinds: ['point']` — one kind, because one kind is implemented.
 *                             (The DEF projects the view's voice as
 *                             `['point','match']`: the library's own law that a
 *                             set is a point's plural. Both are true at their
 *                             own tier — see `src/prot/def.ts`.)
 *
 * `transforms` is absent: the renderer declares no internal data transform,
 * which is what `bindRenderer` checks before it will bind at all.
 */
import { RENDERER_PROTOCOL_VERSION, boundField, keepPredicate } from 'vizfootprint-ui';
import type { ChartEmission, HostHandshake, MountedRenderer, RenderRow, RenderState, Renderer, RendererHello } from 'vizfootprint-ui';

// ── the port: what this renderer needs from a 3D viewer, in OUR shape ────────

/** One residue, as a viewer addresses it: the chain label and the residue number the file gives. */
export interface ResidueAddress {
  readonly chain: string;
  readonly resnum: number;
}

/**
 * What a residue's colour MEANS. Four words, and the picture is painted in
 * exactly these — so a legend can be built from the same constant the paint is
 * (see {@link PAINT_COLOR}).
 */
export type PaintWord = 'lit' | 'dropped' | 'no-angle' | 'kept';

/** The four words, in the order a reader meets them in the legend. */
export const PAINT_WORDS: readonly PaintWord[] = ['lit', 'kept', 'dropped', 'no-angle'];

/**
 * One instruction: paint these residues this colour, because of this word.
 *
 * `value` rides only on the `kept` word — the residues nothing is said about,
 * which are coloured by the column the `color` channel is BOUND to, one bucket
 * per distinct value. That is how a rebind in the desk's picker reaches a 3D
 * view: the fold changes, the buckets change, the molecule is repainted.
 */
export interface PaintBucket {
  readonly word: PaintWord;
  /** A packed `0xRRGGBB` — a NUMBER, because that is what a 3D viewer takes. */
  readonly color: number;
  readonly residues: readonly ResidueAddress[];
  /** The bound column's value this bucket stands for (`kept` only). */
  readonly value?: string;
}

/**
 * THE VIEWER PORT — every call this renderer makes into somebody else's 3D
 * code, and no more than that.
 *
 * It is deliberately tiny and deliberately about RESIDUES rather than about
 * atoms, scenes or representations: the contract hands this renderer rows, and
 * a row here is a residue. An adapter translates (`./molstarViewer.ts`).
 */
export interface StructureViewerPort {
  /** Draw the structure file. Called once, with the text the host holds. */
  load(text: string): Promise<void>;
  /** Paint the residues named in each bucket. Buckets not named keep whatever they had. */
  paint(buckets: readonly PaintBucket[]): Promise<void>;
  /** Report a reader's click: the residue they hit, or `null` when they hit nothing. */
  onPick(listener: (residue: ResidueAddress | null) => void): void;
  /** The box changed size. */
  resize(): void;
  /** Tear down everything the viewer made. */
  dispose(): void;
}

// ── the colours, named once ──────────────────────────────────────────────────

/**
 * THE FOUR COLOURS, and why they are constants here rather than read from the
 * theme the contract pushes.
 *
 * `RenderState.theme` is a resolved `--vzf-*` token map — CSS colour STRINGS,
 * in whatever syntax the stylesheet wrote (`#rrggbb`, `rgb(…)`, a colour
 * function). A 3D viewer takes a packed number, and parsing an arbitrary CSS
 * colour in order to hand it over would be this file inventing a colour
 * pipeline. So the four words carry four numbers, this module owns them, and
 * the cell's legend reads the SAME constant — one owner, two readers. The
 * report for this packet names it as what it is: a renderer that draws outside
 * the DOM cannot use the theme channel as it stands.
 */
export const PAINT_COLOR: Readonly<Record<PaintWord, number>> = {
  // the reader's own pick — the one colour that must never be missed
  lit: 0x2f7d5b,
  // in view, nothing said about it. NO residue is painted in this on a real
  // frame — a `kept` residue takes its own value's hue from {@link VALUE_PALETTE},
  // and the index into that list wraps, so there is always one. It stands here
  // as the type's fallback and as the word's name in a legend
  // (`protCells.tsx` · `valueSwatches` shows the palette instead, because a
  // legend may not name a colour the picture does not contain).
  kept: 0x6b7f99,
  // another view's clause dropped this residue: the 3D equivalent of a dimmed row
  dropped: 0xd9dde3,
  // the file gives this residue no backbone angle. NOT the colour of zero —
  // zero degrees is a real conformation and this is the absence of one.
  'no-angle': 0xa83a3a,
};

/**
 * The hues a `kept` residue's own VALUE gets, assigned by the value's place in
 * the sorted list of distinct values on screen.
 *
 * Sorted-and-indexed rather than hashed, so the same value is the same colour
 * on every frame and two values are never the same colour while there are
 * colours left. Twenty of them, which is exactly the number of amino acids
 * `resname` can hold; past that the list cycles and the legend beside the
 * picture still names every value, so a repeat is visible rather than hidden.
 */
export const VALUE_PALETTE: readonly number[] = [
  0x4c6ef5, 0xe8590c, 0x2b8a3e, 0x862e9c, 0xc92a2a, 0x0b7285, 0xe67700, 0x5f3dc4, 0x087f5b, 0xa61e4d, 0x364fc7, 0xd9480f, 0x66a80f, 0x9c36b5, 0xf03e3e, 0x1098ad, 0xf59f00, 0x7048e8, 0x0ca678, 0xc2255c,
];

/** What each colour means, in the words the desk prints beside the picture. */
export const PAINT_MEANING: Readonly<Record<PaintWord, string>> = {
  lit: 'selected here or by another view',
  kept: 'in view, coloured by the bound column',
  dropped: 'dropped by another view’s selection',
  'no-angle': 'no backbone angle in the file — the absence, not a value',
};

// ── the fields this renderer must be told about ──────────────────────────────

/**
 * The row fields the paint reads. Every one of them is a FACTORY OPTION, and
 * that is the library's own convention rather than this demo's invention:
 * `scatterRenderer({ idField })` and `mapRenderer({ geo, nameProperty,
 * valueField })` are told their fields the same way, because `RenderState`
 * names visual CHANNELS (`encodings`) and never the identity column a
 * selection is phrased in.
 */
export interface StructureFields {
  /** The identity column — what a click emits and what every clause on this desk is phrased in. Default `'residue_key'`. */
  readonly keyField?: string;
  /** The chain label, as the viewer addresses it. Default `'chain'`. */
  readonly chainField?: string;
  /** The residue number, as the viewer addresses it. Default `'resnum'`. */
  readonly resnumField?: string;
  /** The columns whose absence earns the absence colour. Default `['phi', 'psi']`. */
  readonly absentWhenNull?: readonly string[];
}

export interface MolstarRendererOptions extends StructureFields {
  /**
   * THE BULK ARTIFACT: the structure file's text.
   *
   * It arrives here and not on `RenderState` because the protocol has no
   * channel for a file — `rows`, `encodings`, `selection`, `hover`, `theme`,
   * `size`, `layers`, `frame` and nothing else. The library's own
   * `mapRenderer` takes its GeoJSON exactly this way ("geometry is host data,
   * not chart data"), so this is the shape the library has, not a hole this
   * demo dug. What the shape costs is in the report: bytes that reach the
   * screen through a factory argument are on no commit, in no
   * `overview().sources`, and invisible to time travel.
   */
  readonly structure: { readonly text: string; readonly at?: string };
  /**
   * How to get a viewer for a mounted element. The default dynamically imports
   * the Mol* adapter, so nothing of Mol* is loaded until a mount happens; a
   * test passes a double and proves the protocol without a GPU.
   */
  readonly viewer?: (el: HTMLElement) => Promise<StructureViewerPort>;
}

const DEFAULTS = { keyField: 'residue_key', chainField: 'chain', resnumField: 'resnum', absentWhenNull: ['phi', 'psi'] } as const;

/** The fields in force — the caller's, else the defaults, resolved once per mount. */
function fieldsOf(options: StructureFields): Required<StructureFields> {
  return {
    keyField: options.keyField ?? DEFAULTS.keyField,
    chainField: options.chainField ?? DEFAULTS.chainField,
    resnumField: options.resnumField ?? DEFAULTS.resnumField,
    absentWhenNull: options.absentWhenNull ?? DEFAULTS.absentWhenNull,
  };
}

// ── the paint decision: pure, and the whole reason this half is separable ────

/**
 * WHAT COLOUR EVERY RESIDUE IS, from the rows and the fold and nothing else.
 *
 * The precedence is a decision, not an accident, and it is this:
 *
 *   1. `lit`      — this view's OWN clause keeps the row. Read with the
 *                   clause's own `predicate`, so a point, a set or an interval
 *                   all light up by the same rule the session judges them by,
 *                   and this file has no per-kind switch to drift.
 *   2. `dropped`  — some OTHER view's clause drops it (`keepPredicate`, which
 *                   excludes the self clause by contract). The selection wins
 *                   over the absence BECAUSE it is what the reader just did: a
 *                   residue outside the brush must read as outside the brush,
 *                   whatever else is true of it.
 *   3. `no-angle` — the file gives no phi or no psi. An absence, painted as
 *                   one; never the colour a zero would get.
 *   4. `kept`     — in view, nothing said. THESE are coloured by the column
 *                   the `color` channel is bound to, read through the library's
 *                   own `boundField` off `state.encodings` — so re-encoding the
 *                   view in the desk's picker repaints the molecule, exactly as
 *                   it re-colours a first-party chart. One bucket per distinct
 *                   value, hue by {@link VALUE_PALETTE}.
 *
 * The count of each word is reported in words beside the picture
 * ({@link saidOf}), so the residues with no angle are named even in a frame
 * where a brush has painted them `dropped`.
 *
 * NOTHING IS COMPUTED HERE beyond that classification: no binning, no
 * aggregation, no geometry. The rows arrive folded (the transform-ownership
 * rule) and this reads them.
 */
export function paintOf(state: RenderState, options: StructureFields = {}): readonly PaintBucket[] {
  const fields = fieldsOf(options);
  const keep = keepPredicate(state.selection);
  const selfId = state.selection.selfClauseId;
  const own = selfId === null ? undefined : state.selection.clauses.get(selfId);
  // the bound column, through the library's own reader; with no binding the
  // renderer colours by chain, which is the coarsest true thing it can say
  const colorField = boundField(state.encodings, 'color', fields.chainField);
  const byWord = new Map<PaintWord, ResidueAddress[]>(PAINT_WORDS.filter((w) => w !== 'kept').map((word) => [word, []]));
  const byValue = new Map<string, ResidueAddress[]>();
  for (const row of state.rows) {
    const address = addressOf(row, fields);
    if (address === null) continue; // a row with no addressable residue is not a mark this viewer can paint
    const word = wordFor(row, fields, own?.predicate, keep);
    if (word !== 'kept') {
      byWord.get(word)!.push(address);
      continue;
    }
    const value = String(row[colorField]);
    byValue.set(value, [...(byValue.get(value) ?? []), address]);
  }
  const words = PAINT_WORDS.filter((w) => w !== 'kept').map((word) => ({ word, color: PAINT_COLOR[word], residues: byWord.get(word)! }));
  const values = [...byValue.keys()].sort().map((value, i) => ({ word: 'kept' as const, color: VALUE_PALETTE[i % VALUE_PALETTE.length] ?? PAINT_COLOR.kept, residues: byValue.get(value)!, value }));
  return [...words, ...values];
}

/** One row's word, under the precedence {@link paintOf} documents. */
function wordFor(row: RenderRow, fields: Required<StructureFields>, isOwn: ((row: RenderRow) => boolean) | undefined, keep: (row: RenderRow) => boolean): PaintWord {
  if (isOwn !== undefined && isOwn(row)) return 'lit';
  if (!keep(row)) return 'dropped';
  if (fields.absentWhenNull.some((field) => row[field] === null || row[field] === undefined)) return 'no-angle';
  return 'kept';
}

/** A row's residue address, or `null` when the row does not carry one. */
function addressOf(row: RenderRow, fields: Required<StructureFields>): ResidueAddress | null {
  const chain = row[fields.chainField];
  const resnum = row[fields.resnumField];
  if (typeof chain !== 'string' || typeof resnum !== 'number') return null;
  return { chain, resnum };
}

/**
 * THE SENTENCE UNDER THE PICTURE — what this mount is showing, in words.
 *
 * A WebGL canvas is opaque to a screen reader and to a test alike, so the mount
 * keeps one `role="status"` line beside it and writes this into it at every
 * update. It is not decoration: it is how the absence gets said when the
 * picture has painted it as something else (see {@link paintOf}), and how a
 * reader learns the viewer is still starting rather than broken.
 */
export function saidOf(buckets: readonly PaintBucket[], stage: 'starting' | 'drawing' | { readonly broken: string }): string {
  const total = buckets.reduce((n, b) => n + b.residues.length, 0);
  // every word with residues in it, in the legend's order, and for `kept` one
  // entry per VALUE — the same sub-division the picture is painted in
  const counted = PAINT_WORDS.flatMap((word) =>
    buckets
      .filter((b) => b.word === word && b.residues.length > 0)
      .map((b) => `${String(b.residues.length)} ${b.value === undefined ? PAINT_MEANING[word] : `in view, ${b.value}`}`),
  ).join(' · ');
  if (typeof stage === 'object') return `The 3D viewer could not start: ${stage.broken} — the ${String(total)} residues are still on this desk, in the scatter and in the sheet; this one picture is not.`;
  if (stage === 'starting') return `The 3D viewer is starting. ${String(total)} residues will be drawn from the structure file.`;
  return `Mol* is drawing ${String(total)} residues: ${counted}.`;
}

// ── the renderer ─────────────────────────────────────────────────────────────

/** The hello — computed at the factory, so a declaration cannot drift from the wiring (contract Law 1). */
export function molstarHello(): RendererHello {
  return {
    protocolVersion: RENDERER_PROTOCOL_VERSION,
    capabilities: {
      canBrush: false,
      canPointSelect: true,
      canHighlight: true,
      canReencode: false,
      // the camera is Mol*'s own and no contract call moves it
      canPanZoom: false,
      emissionKinds: ['point'],
    },
  };
}

/**
 * The renderer.
 *
 * ```ts
 * const bound = bindRenderer(molstarRenderer({ structure: { text } }), el, { viewId: 'structure', callbacks });
 * bound.view.update(state);   // paints from the rows and the fold
 * ```
 *
 * ── ASYNC INIT, and how the synchronous contract survives it ────────────────
 * `mount` must return a hello NOW; Mol* is ready in about a second. So mount
 * does three things synchronously — builds the DOM, answers the hello, and
 * starts the viewer — and then QUEUES: every `update` stores its state and
 * writes the status line, and the last state stored is painted the moment the
 * viewer reports ready. A frame pushed during start-up is therefore never
 * lost, and never painted twice.
 *
 * Three edge cases are handled rather than hoped about: an `unmount` during
 * start-up (the viewer is disposed as soon as it arrives, and nothing is
 * painted), a viewer that never starts (the status line says so and the desk
 * keeps working), and a paint that throws (the same line, the same way).
 * The protocol has no channel for any of this — see the report.
 */
export function molstarRenderer(options: MolstarRendererOptions): Renderer {
  const fields = fieldsOf(options);
  return {
    mount(el: Element, handshake: HostHandshake): MountedRenderer {
      const host = el as HTMLElement;
      // the canvas's home and the line that says what is in it — both made
      // synchronously, so the mount is never empty even before WebGL exists
      const stage = host.ownerDocument.createElement('div');
      stage.className = 'prot-molstar-stage';
      stage.style.cssText = 'position:relative;width:100%;height:calc(100% - 1.6rem);min-height:120px';
      const said = host.ownerDocument.createElement('div');
      said.className = 'prot-molstar-said';
      said.setAttribute('role', 'status');
      // THE INK IS THE THEME'S, not this file's: the line sits inside the dark
      // well the desk frames this viewer with (`web/src/workbench/ChartCard.tsx`
      // · `ViewerBox`), and a mid-grey meant for paper is nearly unreadable on
      // it. `--pw-viewer-ink` is that well's own ink, with a paper fallback for
      // any host that mounts this renderer without the workbench's stylesheet.
      said.style.cssText = 'font:11px/1.45 var(--pw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);color:var(--pw-viewer-ink, #5a6572);padding:.2rem .6rem';
      host.append(stage, said);

      let viewer: StructureViewerPort | null = null;
      let latest: RenderState | null = null;
      let gone = false;
      let broken: string | null = null;

      /** Write the line, from whatever is known right now. */
      const say = (): void => {
        const buckets = latest === null ? [] : paintOf(latest, fields);
        said.textContent = saidOf(buckets, broken !== null ? { broken } : viewer !== null ? 'drawing' : 'starting');
      };

      /** Paint the last state pushed — the one call that reaches the viewer with colours. */
      const paint = (): void => {
        if (viewer === null || latest === null) return;
        void viewer.paint(paintOf(latest, fields)).catch((err: unknown) => {
          broken = sentenceOf(err);
          say();
        });
      };

      say();
      void (async () => {
        try {
          const open = options.viewer ?? defaultViewer;
          const port = await open(stage);
          if (gone) {
            // the host unmounted while Mol* was starting: dispose what arrived
            // and paint nothing — a viewer nobody is holding is a leak
            port.dispose();
            return;
          }
          await port.load(options.structure.text);
          port.onPick((residue) => {
            if (gone) return;
            handshake.callbacks.emit(pointOf(residue, fields.keyField));
          });
          viewer = port;
          say();
          paint();
        } catch (err: unknown) {
          broken = sentenceOf(err);
          say();
        }
      })();

      return {
        hello: molstarHello(),
        update(state: RenderState): void {
          latest = state;
          say();
          paint();
          viewer?.resize();
        },
        unmount(): void {
          gone = true;
          viewer?.dispose();
          viewer = null;
          stage.remove();
          said.remove();
        },
      };
    },
  };
}

/**
 * A click, as the contract's `point` emission — the residue key, or `null` when
 * the reader clicked past the molecule.
 *
 * `null` is the contract's one spelling of CLEARED (`rawValue: null`), so
 * clicking the background releases the selection exactly as clicking the
 * selected residue again would. The renderer builds no clause: it says which
 * value on which field, and the session decides everything else.
 */
export function pointOf(residue: ResidueAddress | null, keyField: string): ChartEmission {
  return { rawValue: residue === null ? null : `${residue.chain}:${String(residue.resnum)}`, encoding: { kind: 'point', field: keyField } };
}

/** A thrown thing as a sentence — shown, never swallowed. */
function sentenceOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The default viewer: Mol*, loaded on first mount.
 *
 * The import is dynamic so that the 30 MB of a molecular viewer is a chunk of
 * its own — the CDC, grid and exoplanet desks are built from the same sources
 * and must not carry one byte of it.
 */
async function defaultViewer(el: HTMLElement): Promise<StructureViewerPort> {
  const { molstarViewer } = await import('./molstarViewer.js');
  return molstarViewer(el);
}
