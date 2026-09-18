// @vitest-environment jsdom
/**
 * THE MOL* RENDERER, AGAINST THE LIBRARY'S OWN CONFORMANCE KIT — and an honest
 * account of what the kit can and cannot reach in a 3D view.
 *
 * `runConformance` (`vizfootprint-ui`) mounts a renderer against a REAL
 * scripted session and walks the whole loop: version guard, transform
 * ownership, handshake, renders, gesture, commit, crossfilter, the optional
 * arms, navigate, unmount. Every first-party renderer passes it. This suite
 * runs it over `molstarRenderer`.
 *
 * ── WHAT IS REAL HERE, AND WHAT IS A DOUBLE ─────────────────────────────────
 * The session is real (a live `InteractionSession` behind a `SessionView` over
 * the committed 185-residue entry). The renderer is the real one — its hello,
 * its queue, its paint decision, its click translation. **The viewer is a
 * double**, and it has to be, for two reasons that are the same reason twice:
 *
 *   1. Mol* needs a WebGL context, and jsdom has none. `initViewerAsync` would
 *      answer false and the renderer would report a broken viewer — honestly,
 *      but with nothing left to test.
 *   2. The kit drives its gestures as DOM events on the mount (`plan.gesture(el)`).
 *      A pick in a 3D view is a GPU ray-cast against geometry, not a DOM event
 *      on an element; there is no `fireEvent` that can select residue A:50.
 *
 * So the double stands where the GPU would, and the pick is raised through the
 * same `onPick` channel the real adapter raises it through
 * (`web/src/molstarViewer.ts` · `behaviors.interaction.click`). What that
 * proves is everything ABOVE the port — which is the whole protocol — and what
 * it does not prove is that Mol* draws the right molecule. The report for this
 * packet names that as a gap in the KIT (there is no seam for a renderer whose
 * marks are not DOM), not as a gap in this desk.
 *
 * The double also lets the tests below check the thing a 3D renderer is really
 * for: WHAT IT PAINTS. Every paint instruction is recorded, so the precedence
 * (lit over dropped over absent), the absence colour and the colour-by-bound-
 * column are asserted against the real fold rather than described.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDashboard } from 'vizfootprint/agent';
import { RENDERER_PROTOCOL_VERSION, createSessionView, selectionForView, sessionSource, speaksSameMajor, type SessionView, type SessionViewState } from 'vizfootprint-ui';
import { runConformance, type ConformanceReport, type RenderState } from 'vizfootprint-ui';
import { PAINT_COLOR, VALUE_PALETTE, molstarHello, molstarRenderer, paintOf, pointOf, saidOf, type PaintBucket, type ResidueAddress, type StructureViewerPort } from '../web/src/molstarRenderer.js';
import { RAMA_VIEW, RESIDUE_KEY, STRUCTURE_VIEW, protDef } from '../src/prot/def.js';
import { protTables } from '../src/prot/etl.js';
import { PROT_FILES } from '../src/data/files.js';

/**
 * The committed entry, read from the PROJECT ROOT rather than through
 * `src/prot/snapshot.ts`.
 *
 * That door resolves the file against its own module URL, which under the
 * `jsdom` environment this suite needs is an `http://` URL and not a path — so
 * `readFileSync` refuses it. The environment quirk is handled here, in the one
 * test that needs a DOM, rather than by weakening the node door every other
 * caller uses. The path is the same one the site build copies
 * (`src/data/files.ts` · `PROT_FILES`), so there is still one owner of it.
 */
const TEXT = readFileSync(join(process.cwd(), PROT_FILES.structure), 'utf8');
const TABLES = protTables(TEXT);
const ROWS: readonly Record<string, unknown>[] = TABLES.residues;

/** The residue the tests pick: a glycine in the middle of chain A, with both angles. */
const PICKED: ResidueAddress = { chain: 'A', resnum: 50 };
const PICKED_KEY = 'A:50';

// ── the viewer double ────────────────────────────────────────────────────────

/**
 * A viewer that records instead of drawing. It is the PORT and nothing else —
 * no Mol*, no canvas, no WebGL — so what it stands in for is exactly the
 * boundary `molstarRenderer` was split at.
 *
 * `whenListening()` is the one piece of choreography a test needs: the
 * renderer's `mount` returns synchronously and finishes wiring the pick
 * asynchronously, so a test that raised a pick immediately would be testing
 * its own race.
 */
class ViewerDouble implements StructureViewerPort {
  loaded: string | null = null;
  readonly paints: PaintBucket[][] = [];
  disposed = 0;
  resizes = 0;
  private listener: ((residue: ResidueAddress | null) => void) | null = null;
  private waiting: (() => void)[] = [];

  async load(text: string): Promise<void> {
    this.loaded = text;
  }

  async paint(buckets: readonly PaintBucket[]): Promise<void> {
    this.paints.push([...buckets]);
  }

  onPick(listener: (residue: ResidueAddress | null) => void): void {
    this.listener = listener;
    for (const resolve of this.waiting) resolve();
    this.waiting = [];
  }

  resize(): void {
    this.resizes += 1;
  }

  dispose(): void {
    this.disposed += 1;
  }

  /** Resolves once the renderer has wired its pick listener. */
  async whenListening(): Promise<void> {
    if (this.listener !== null) return;
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  /** Raise a pick, the way a GPU ray-cast raises one. */
  raise(residue: ResidueAddress | null): void {
    if (this.listener === null) throw new Error('the renderer has not wired its pick listener yet');
    this.listener(residue);
  }

  /** The last paint, or an empty list when nothing has been painted. */
  last(): readonly PaintBucket[] {
    return this.paints[this.paints.length - 1] ?? [];
  }

  residuesOf(word: string, value?: string): readonly ResidueAddress[] {
    return this.last().find((b) => b.word === word && (value === undefined || b.value === value))?.residues ?? [];
  }
}

// ── the session ──────────────────────────────────────────────────────────────

async function realView(): Promise<SessionView> {
  const session = buildDashboard(protDef(TABLES, TEXT)).createSession({ as: 'user' });
  const view = createSessionView(sessionSource(session), { as: 'user' });
  await view.refresh();
  return view;
}

/** The host's own state shaping, as the desk does it: all the rows, the fold at this address, the encoding fold at the cursor. */
function buildState(state: SessionViewState, viewId: string, size = { width: 800, height: 600 }): RenderState {
  return {
    rows: ROWS,
    encodings: state.views.find((v) => v.viewId === viewId)?.encoding ?? {},
    selection: selectionForView(state.selections, viewId, 'intersect', state.links, state.cleared),
    hover: null,
    theme: {},
    size,
  };
}

describe('the conformance kit over the Mol* renderer', () => {
  let report: ConformanceReport;
  let double: ViewerDouble;

  it('walks the whole loop, and every step is reported by name', async () => {
    const view = await realView();
    const el = document.createElement('div');
    document.body.append(el);
    double = new ViewerDouble();
    report = await runConformance({
      renderer: molstarRenderer({ structure: { text: TEXT }, keyField: RESIDUE_KEY, viewer: async () => double }),
      viewId: STRUCTURE_VIEW,
      el,
      view,
      buildState: (state) => buildState(state, STRUCTURE_VIEW),
      // THE PICK. Not a DOM event: a 3D pick is a ray-cast, so it is raised
      // through the port the way the real adapter raises Mol*'s own click
      gesture: async () => {
        await double.whenListening();
        double.raise(PICKED);
      },
      // the strongest honest proof that the loop returned: the renderer's own
      // status line says ONE residue is selected, which it can only know from
      // the clause the session handed back
      verifyUpdate: (mount) => (mount.textContent ?? '').includes('1 selected here or by another view'),
    });

    // EVERY STEP, in order, with its verdict — the report is the deliverable
    expect(report.steps.map((s) => `${s.step}: ${s.ok ? 'ok' : 'FAILED'}`)).toEqual([
      'version-guard: ok',
      'transform-ownership: ok',
      'handshake: ok',
      'renders: ok',
      'gesture-emits: ok',
      'commit-lands: ok',
      'crossfilter-returns: ok',
      'cell: ok',
      'match: ok',
      'neighbourhood: ok',
      'layers: ok',
      // LAW 13, and the kit grew it rather than this demo: every emission kind
      // the renderer DECLARED in its handshake has to be delivered by the end
      // of the run (`vizfootprint-ui` · `contract/conformance.ts`). Mol* here
      // declares `point` alone and lands one, so it passes as it stands.
      'declared-delivered: ok',
      'navigate: ok',
      'unmount: ok',
    ]);
    expect(report.ok).toBe(true);
  });

  it('skips the four arms this view has no voice for, and says so rather than passing silently', () => {
    const detail = (step: string): string => report.steps.find((s) => s.step === step)?.detail ?? '';
    expect(detail('cell')).toContain('declares no cell emissions — the cell arm is honestly skipped');
    expect(detail('match')).toContain('declares no match emissions');
    expect(detail('neighbourhood')).toContain('declares no neighbourhood emissions');
    expect(detail('layers')).toContain('declares no canLayer');
    // the NAVIGATE arm is the one that runs BECAUSE the flag is false: the camera
    // is Mol*'s own, so a host-driven navigate must be refused out loud
    expect(detail('navigate')).toBe('a host-driven navigate on this non-capable view landed the typed navigate-unsupported gap and recorded nothing');
    expect(report.gaps.map((g) => g.code)).toEqual(['navigate-unsupported']);
  });

  it('the gesture emitted ONE point on the residue key, and the commit landed under the view’s own address', () => {
    expect(report.emissions).toEqual([{ rawValue: PICKED_KEY, encoding: { kind: 'point', field: RESIDUE_KEY } }]);
    expect(report.steps.find((s) => s.step === 'commit-lands')?.detail).toContain(`${STRUCTURE_VIEW} · user · conformance: ${STRUCTURE_VIEW} gesture`);
    // the renderer never hovers and never asks for a re-encode — the two channels
    // it declares nothing on stay silent
    expect(report.hovers).toEqual([]);
    expect(report.reencodeRequests).toEqual([]);
  });

  it('the file reached the viewer — and the kit MOUNTED this renderer three times', () => {
    expect(double.loaded).toBe(TEXT);
    // THREE disposals for one conformance run, and they are all honest: the kit's
    // `version-guard` and `transform-ownership` steps each mount the renderer on a
    // throwaway element to read its hello, and unmount it again, before the real
    // bind in `handshake`. For a first-party SVG chart that is free. For a renderer
    // whose mount starts a WebGL context and parses a 169 KB file it is three
    // start-ups to ask two questions about a declaration — recorded here because
    // the number is the finding, not the failure.
    expect(double.disposed).toBe(3);
  });
});

describe('the hello is what the mount really delivers', () => {
  it('declares one emission kind, no transforms, and a camera it cannot move', () => {
    const hello = molstarHello();
    expect(hello.capabilities).toEqual({
      canBrush: false,
      canPointSelect: true,
      canHighlight: true,
      canReencode: false,
      canPanZoom: false,
      emissionKinds: ['point'],
    });
    // `transforms` is absent, not empty: the renderer computes nothing, and
    // `bindRenderer` refuses a renderer that declares otherwise
    expect(hello.transforms).toBeUndefined();
    // THE VERSION IS NOT PINNED HERE, and that is deliberate: pinning the exact
    // protocol number is the LIBRARY's job (it has its own tests for what is and
    // is not in a version), and a literal in a demo test breaks on every additive
    // minor the contract gains. What matters to this desk is that the renderer it
    // ships and the library it binds through still SPEAK — the same major, which
    // is the rule `bindRenderer` itself applies before it will bind at all.
    expect(speaksSameMajor(hello.protocolVersion, RENDERER_PROTOCOL_VERSION)).toBe(true);
  });

  it('a click past the molecule is the contract’s CLEARED point, not a selection of nothing', () => {
    expect(pointOf(PICKED, RESIDUE_KEY)).toEqual({ rawValue: PICKED_KEY, encoding: { kind: 'point', field: RESIDUE_KEY } });
    expect(pointOf(null, RESIDUE_KEY)).toEqual({ rawValue: null, encoding: { kind: 'point', field: RESIDUE_KEY } });
  });
});

describe('what the renderer paints, from the rows and the fold', () => {
  /** The renderer, mounted over a double, with one state pushed. */
  async function painted(state: RenderState): Promise<ViewerDouble> {
    const el = document.createElement('div');
    document.body.append(el);
    const double = new ViewerDouble();
    const mounted = molstarRenderer({ structure: { text: TEXT }, keyField: RESIDUE_KEY, viewer: async () => double }).mount(el, {
      protocolVersion: RENDERER_PROTOCOL_VERSION,
      viewId: STRUCTURE_VIEW,
      callbacks: { emit: () => {}, hover: () => {}, reencodeRequest: () => {}, navigate: () => {} },
    });
    await double.whenListening();
    mounted.update(state);
    return double;
  }

  const quiet = (encodings: Record<string, string> = { color: 'chain' }): RenderState => ({
    rows: ROWS,
    encodings,
    selection: { clauses: new Map(), resolve: 'intersect', selfClauseId: STRUCTURE_VIEW },
    hover: null,
    theme: {},
    size: { width: 400, height: 300 },
  });

  it('with nothing selected: four residues in the absence colour, the rest coloured by the bound column', async () => {
    const double = await painted(quiet());
    // the ABSENCE, and it is the file's silence and not a value: the first and the
    // last residue of each chain (hand-counted in tests/prot-etl.test.ts)
    expect(double.residuesOf('no-angle').map((r) => `${r.chain}:${String(r.resnum)}`)).toEqual(['A:1', 'A:96', 'B:1', 'B:89']);
    expect(double.last().find((b) => b.word === 'no-angle')?.color).toBe(PAINT_COLOR['no-angle']);
    // the rest are coloured by `chain`: one bucket per distinct value, hue by the palette
    const kept = double.last().filter((b) => b.word === 'kept');
    expect(kept.map((b) => b.value)).toEqual(['A', 'B']);
    expect(kept.map((b) => b.residues.length)).toEqual([94, 87]);
    expect(kept.map((b) => b.color)).toEqual([VALUE_PALETTE[0], VALUE_PALETTE[1]]);
    // 94 + 87 + 4 = 185: every row is painted exactly once
    expect(double.last().reduce((n, b) => n + b.residues.length, 0)).toBe(TABLES.counts.residues);
    // nothing is `lit` and nothing is `dropped` — no clause exists
    expect(double.residuesOf('lit')).toEqual([]);
    expect(double.residuesOf('dropped')).toEqual([]);
  });

  it('a REBIND of the colour repaints the molecule — the same rows, different buckets', async () => {
    const double = await painted(quiet({ color: 'resname' }));
    const kept = double.last().filter((b) => b.word === 'kept');
    // twenty amino acids in this entry, so twenty buckets, sorted by their own name
    expect(kept.length).toBe(new Set(TABLES.residues.filter((r) => r.phi !== null && r.psi !== null).map((r) => r.resname)).size);
    expect(kept.map((b) => b.value)).toEqual([...kept.map((b) => b.value)].sort());
    expect(kept[0]?.value).toBe('ALA');
  });

  it('the view’s OWN clause is lit, and beats the absence — a reader’s pick is never invisible', async () => {
    const view = await realView();
    // pick a residue that HAS no psi: A:96, the last of chain A
    await view.emit(STRUCTURE_VIEW, { rawValue: 'A:96', encoding: { kind: 'point', field: RESIDUE_KEY } }, 'pick the last residue of chain A');
    await view.refresh();
    const double = await painted(buildState(view.getState(), STRUCTURE_VIEW));
    expect(double.residuesOf('lit').map((r) => `${r.chain}:${String(r.resnum)}`)).toEqual(['A:96']);
    // …and it is no longer in the absence bucket, though the file still gives it no psi
    expect(double.residuesOf('no-angle').map((r) => `${r.chain}:${String(r.resnum)}`)).toEqual(['A:1', 'B:1', 'B:89']);
  });

  it('ANOTHER view’s clause greys what it drops, and that beats the absence colour too', async () => {
    const view = await realView();
    // a brush on the scatter: phi between −90 and −60, which is an interval on the
    // rama view and reaches the 3D view through the crossfilter default
    await view.emit(RAMA_VIEW, { rawValue: [-90, -60], encoding: { kind: 'interval', field: 'phi' } }, 'keep a range of backbone angles');
    await view.refresh();
    const double = await painted(buildState(view.getState(), STRUCTURE_VIEW));
    const inRange = TABLES.residues.filter((r) => typeof r.phi === 'number' && r.phi >= -90 && r.phi <= -60);
    const dropped = double.residuesOf('dropped');
    // every residue the brush drops is greyed — including the four with no angle,
    // because the SELECTION is what the reader just did (the documented precedence)
    expect(dropped.length).toBe(TABLES.counts.residues - inRange.length);
    expect(double.residuesOf('no-angle')).toEqual([]);
    // and the ones it keeps are still coloured by the bound column
    expect(double.last().filter((b) => b.word === 'kept').reduce((n, b) => n + b.residues.length, 0)).toBe(inRange.length);
  });

  it('a row with no addressable residue is painted by nobody, and no bucket invents one', () => {
    const state: RenderState = { ...quiet(), rows: [{ residue_key: 'X:1', chain: 'X' }, { residue_key: 'Y:2', resnum: 2 }] };
    // one row has no number, the other no chain: a viewer cannot address either
    expect(paintOf(state, { keyField: RESIDUE_KEY }).reduce((n, b) => n + b.residues.length, 0)).toBe(0);
  });
});

describe('the words under the picture', () => {
  it('say what the viewer is doing, in all three states', () => {
    const buckets = paintOf({
      rows: ROWS,
      encodings: { color: 'chain' },
      selection: { clauses: new Map(), resolve: 'intersect', selfClauseId: STRUCTURE_VIEW },
      hover: null,
      theme: {},
      size: { width: 1, height: 1 },
    });
    expect(saidOf(buckets, 'starting')).toBe('The 3D viewer is starting. 185 residues will be drawn from the structure file.');
    // the legend's order — lit, kept (one entry per bound value), dropped, no-angle
    expect(saidOf(buckets, 'drawing')).toBe('Mol* is drawing 185 residues: 94 in view, A · 87 in view, B · 4 no backbone angle in the file — the absence, not a value.');
    // a broken viewer says so, and says what a reader still has
    expect(saidOf(buckets, { broken: 'this browser gave Mol* no WebGL context' })).toContain('The 3D viewer could not start: this browser gave Mol* no WebGL context');
    expect(saidOf(buckets, { broken: 'x' })).toContain('the 185 residues are still on this desk, in the scatter and in the sheet; this one picture is not');
  });
});

describe('the async mount, and the three ways it can go', () => {
  it('a frame pushed BEFORE the viewer is ready is not lost — it is painted once, on arrival', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const double = new ViewerDouble();
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mounted = molstarRenderer({
      structure: { text: TEXT },
      keyField: RESIDUE_KEY,
      viewer: async () => {
        await held;
        return double;
      },
    }).mount(el, { protocolVersion: RENDERER_PROTOCOL_VERSION, viewId: STRUCTURE_VIEW, callbacks: { emit: () => {}, hover: () => {}, reencodeRequest: () => {}, navigate: () => {} } });

    // the mount is NOT empty while the viewer starts, and it says which state it is in
    expect(el.childElementCount).toBe(2);
    expect(el.textContent).toContain('The 3D viewer is starting');
    mounted.update({
      rows: ROWS,
      encodings: { color: 'chain' },
      selection: { clauses: new Map(), resolve: 'intersect', selfClauseId: STRUCTURE_VIEW },
      hover: null,
      theme: {},
      size: { width: 100, height: 100 },
    });
    expect(double.paints).toHaveLength(0); // nothing to paint on yet
    release?.();
    await double.whenListening();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // the held frame was painted exactly once when the viewer arrived
    expect(double.paints).toHaveLength(1);
    expect(el.textContent).toContain('Mol* is drawing 185 residues');
    mounted.unmount();
    expect(el.childElementCount).toBe(0);
  });

  it('an unmount DURING start-up disposes the viewer that arrives and paints nothing', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const double = new ViewerDouble();
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mounted = molstarRenderer({
      structure: { text: TEXT },
      viewer: async () => {
        await held;
        return double;
      },
    }).mount(el, { protocolVersion: RENDERER_PROTOCOL_VERSION, viewId: STRUCTURE_VIEW, callbacks: { emit: () => {}, hover: () => {}, reencodeRequest: () => {}, navigate: () => {} } });
    mounted.unmount();
    expect(el.childElementCount).toBe(0);
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(double.disposed).toBe(1);
    expect(double.loaded).toBeNull();
    expect(double.paints).toHaveLength(0);
  });

  it('a viewer that never starts is SAID, and the desk keeps its rows', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const mounted = molstarRenderer({
      structure: { text: TEXT },
      viewer: async () => {
        throw new Error('this browser gave Mol* no WebGL context');
      },
    }).mount(el, { protocolVersion: RENDERER_PROTOCOL_VERSION, viewId: STRUCTURE_VIEW, callbacks: { emit: () => {}, hover: () => {}, reencodeRequest: () => {}, navigate: () => {} } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(el.textContent).toContain('The 3D viewer could not start: this browser gave Mol* no WebGL context');
    // the hello still promised what it promised: a capability is about the mount,
    // and a broken viewer is a run-time fact the words carry, not a lie in the hello
    expect(mounted.hello.capabilities.canPointSelect).toBe(true);
    mounted.unmount();
  });
});
