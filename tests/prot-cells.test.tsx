/**
 * THE PROTEIN DESK'S CELLS AND ITS ONE SHARED SELECTION — over the real
 * committed entry and a REAL session.
 *
 * `tests/prot-renderer.test.ts` proves the renderer keeps the contract and what
 * it paints. This proves the hop on either side of it:
 *
 *   - a click in the 3D view lands a COMMIT on the real session, and the
 *     SCATTER's fold holds that residue — the whole point of the desk, asserted
 *     through the session view the page hands the desk (`sessionSource`), never
 *     a stub of the loop;
 *   - a brush on the scatter reaches the 3D VIEW, and the renderer's own paint
 *     decision greys exactly the residues the range drops;
 *   - `why({ kind: 'chart' })` on both views names what shaped each picture —
 *     and says `declared-in-def` before anybody has done anything, because
 *     this desk lands no acts at all;
 *   - the captions carry the counts and the silences, from the rows on screen.
 *
 * The cells themselves are rendered to static markup against a deliberate stub
 * projection, for the reason `tests/exo-cells.test.tsx` gives: the desk builds
 * a `DeskProjection` internally and the studio does not export the hook, so a
 * stub is the only way in from outside, and naming every member is what keeps
 * it honest. Where a fold is involved the stub answers with the LIBRARY's own
 * `selectionForView` over the real session's links, so it cannot disagree with
 * what the desk would be handed.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { buildDashboard } from 'vizfootprint/agent';
import { createSessionView, selectionForView, sessionSource, type RenderSelection, type SessionView, type SessionViewState } from 'vizfootprint-ui';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { RAMA_VIEW, RESIDUE_KEY, STRUCTURE_VIEW, protDef } from '../src/prot/def.js';
import { protTables, skippedTotal } from '../src/prot/etl.js';
import { loadStructure, loadStructureText } from '../src/prot/snapshot.js';
import { paintOf } from '../web/src/molstarRenderer.js';
import { ramaDots, useProtCells, type ProtDeskData } from '../web/src/protCells.js';
import type { Row } from '../web/src/derive.js';

const TEXT = loadStructureText();
const TABLES = protTables(TEXT);
const DATA: ProtDeskData = {
  residues: TABLES.residues as readonly Row[],
  counts: TABLES.counts,
  skipped: TABLES.skipped,
  structure: loadStructure(),
};

/** A desk with nothing selected, nothing said and nothing to say — the quietest true projection. */
const QUIET = {
  state: { selections: [], links: [], cleared: [], views: [] },
  view: { emit: () => undefined, reencode: () => undefined },
  bound: (_address: string, _channel: string, fallback: string) => fallback,
  selFor: () => ({ clauses: new Map(), resolve: 'intersect', selfClauseId: null }),
  fitsOf: () => undefined,
  shown: {},
  columns: [],
  label: (viewId: string) => viewId,
  words: () => null,
  proseOf: () => [],
  altShort: () => undefined,
  readOnly: false,
  say: () => undefined,
  openAside: () => undefined,
  editChart: () => undefined,
  seekBookmark: () => undefined,
  applyPicture: () => undefined,
  savePicture: () => undefined,
  describeCommit: () => undefined,
  // WHY the cast: the same reason the other desks' cell tests give — `DeskProjection`
  // is built by a hook the studio does not export, so a stub is the only way in from
  // outside, and naming every member is what keeps it an honest one.
} as unknown as DeskProjection;

/** The cells, built the way the desk builds them: once, from a component body. */
function cellsOf(desk: DeskProjection = QUIET): ReturnType<typeof useProtCells> {
  let built: ReturnType<typeof useProtCells> = [];
  function Probe(): null {
    built = useProtCells(desk, DATA);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

/** A caption as a reader sees it. */
const textOf = (node: unknown): string => renderToStaticMarkup(<>{node as ReactElement}</>).replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&#x2014;/g, '—').replace(/\s+/g, ' ');

/** One cell's rendered element, so a test can read the props the cell handed its chart. */
function propsOf<T>(id: string, desk: DeskProjection = QUIET): T {
  const cell = cellsOf(desk).find((c) => c.id === id);
  if (cell === undefined) throw new Error(`no cell "${id}"`);
  return cell.render({ width: 800, height: 600 }) as unknown as T;
}

/** A real session view over the real entry — the one the static page hands the desk. */
async function realView(): Promise<SessionView> {
  const session = buildDashboard(protDef(TABLES)).createSession({ as: 'user' });
  const view = createSessionView(sessionSource(session), { as: 'user' });
  await view.refresh();
  return view;
}

/** A projection whose folds are the LIBRARY's own answer over the real session's state. */
function deskOver(state: SessionViewState): DeskProjection {
  return {
    ...QUIET,
    state: { ...state },
    selFor: (self: string | null) => selectionForView(state.selections, self, 'intersect', state.links, state.cleared),
  } as unknown as DeskProjection;
}

describe('the two cells the desk draws', () => {
  it('draws 181 dots — one per residue with BOTH angles — and none for the four without', () => {
    const dots = ramaDots(DATA.residues, 'phi', 'psi');
    expect(dots).toHaveLength(181);
    expect(dots).toHaveLength(TABLES.counts.bothPresent);
    expect(dots.map((d) => d.id)).not.toContain('A:1');
    expect(dots.map((d) => d.id)).not.toContain('B:89');
    // the dot carries the minted key, which is what a pick anywhere else is phrased in
    expect(dots[0]?.id).toBe('A:2');
  });

  it('the 3D cell’s caption counts the residues, the chains, every skipped record and the absence', () => {
    const caption = textOf(cellsOf().find((c) => c.id === STRUCTURE_VIEW)?.caption);
    expect(caption).toContain('185 residues in 2 chains (A: 96, B: 89)');
    expect(caption).toContain('4 of them are painted in the absence colour');
    // the parse's own report, class by class — 190 + 0 + 22 + 911
    expect(caption).toContain('190 water-or-hetero, 0 insertion-code, 22 alternate-location, 911 not-a-backbone-atom');
    expect(skippedTotal(DATA.skipped)).toBe(1123);
    // the two things the picture cannot promise, said under the picture
    expect(caption).toContain('the camera is Mol*’s own');
    expect(caption).toContain('reach the viewer as an argument, not as a declared table');
    expect(caption).toContain('169371 characters of 1ay7.pdb'.replace('169371', (169371).toLocaleString('en-US')));
  });

  it('the scatter’s caption counts the dots it drew and the dots it could not', () => {
    const caption = textOf(cellsOf().find((c) => c.id === RAMA_VIEW)?.caption);
    expect(caption).toContain('181 of 185 residues');
    expect(caption).toContain('the other 4 have no dot at all: 2 have no phi');
    expect(caption).toContain('2 no psi');
    expect(caption).toContain('an absent angle is not an angle of zero, so there is no dot in the middle');
    // the honest limit of the frame: the axes are the data's extent, not the torsion space
    expect(caption).toContain('not the whole −180 to 180 a torsion can take');
  });

  it('reads its axes off the fold at the view’s address, never a literal', () => {
    // a desk whose fold says something else moves BOTH the marks and the axis label
    const rebound = { ...QUIET, bound: (_a: string, channel: string) => (channel === 'x' ? 'psi' : 'phi') } as unknown as DeskProjection;
    const scatter = propsOf<ReactElement<{ xField: string; yField: string; xLabel: string; data: readonly unknown[] }>>(RAMA_VIEW, rebound);
    expect([scatter.props.xField, scatter.props.yField]).toEqual(['psi', 'phi']);
    expect(scatter.props.xLabel).toBe('psi (degrees)');
  });
});

describe('one selection, two pictures — through a real session', () => {
  it('a click in the 3D view lands ONE commit, and the SCATTER’s fold holds that residue', async () => {
    const view = await realView();
    expect(view.getState().commits).toHaveLength(0); // this desk lands no acts: the log starts empty
    await view.emit(STRUCTURE_VIEW, { rawValue: 'A:50', encoding: { kind: 'point', field: RESIDUE_KEY } }, 'pick the glycine at A:50');
    await view.refresh();
    const state = view.getState();

    // ONE commit, under the 3D view's own address, and it says what it is
    expect(state.commits).toHaveLength(1);
    expect(state.commits[0]?.viewId).toBe(STRUCTURE_VIEW);
    expect(state.commits[0]?.kind).toBe('point');
    expect(state.commits[0]?.field).toBe(RESIDUE_KEY);
    expect(state.commits[0]?.value).toBe('A:50');
    expect(state.selections.map((s) => s.viewId)).toEqual([STRUCTURE_VIEW]);

    // THE SCATTER'S FOLD: the clause reached `rama` through the crossfilter
    // default — no edge is declared anywhere in this def — and it is the 3D
    // view's own, so the scatter dims every dot but the picked one
    const desk = deskOver(state);
    const scatter = propsOf<ReactElement<{ selection: RenderSelection; data: readonly { id: string }[] }>>(RAMA_VIEW, desk);
    const reached = scatter.props.selection.clauses.get(STRUCTURE_VIEW);
    expect(reached?.kind).toBe('point');
    expect(reached?.field).toBe(RESIDUE_KEY);
    expect(reached?.value).toBe('A:50');
    // …and the fold's own predicate keeps exactly that residue of the 181 drawn
    expect(scatter.props.data.filter((d) => reached!.predicate(TABLES.residues.find((r) => r.residue_key === d.id) as unknown as Record<string, unknown>)).map((d) => d.id)).toEqual(['A:50']);
    // the scatter does NOT drop the other dots: a crossfilter dims, and the cell
    // hands the chart every dot with the fold beside it
    expect(scatter.props.data).toHaveLength(181);
  });

  it('a brush on the scatter reaches the 3D view, and the renderer greys exactly what the range drops', async () => {
    const view = await realView();
    // the brush `VizScatter` really emits: an interval on the x field, in data space
    await view.emit(RAMA_VIEW, { rawValue: [-90, -60], encoding: { kind: 'interval', field: 'phi' } }, 'keep the backbone angles between −90° and −60°');
    await view.refresh();
    const state = view.getState();
    expect(state.commits.map((c) => `${c.viewId}:${String(c.kind)}`)).toEqual([`${RAMA_VIEW}:interval`]);

    // THE 3D VIEW'S FOLD, at its own address — the cell hands this to the renderer
    const desk = deskOver(state);
    const structure = propsOf<ReactElement<{ selection: RenderSelection; rows: readonly Record<string, unknown>[] }>>(STRUCTURE_VIEW, desk);
    expect(structure.props.selection.clauses.get(RAMA_VIEW)?.kind).toBe('interval');
    expect(structure.props.selection.selfClauseId).toBe(STRUCTURE_VIEW);

    // …and the renderer's own decision over that fold: everything outside the
    // range is greyed, counted here from the rows by hand
    const inRange = TABLES.residues.filter((r) => typeof r.phi === 'number' && r.phi >= -90 && r.phi <= -60);
    expect(inRange.length).toBeGreaterThan(0);
    const buckets = paintOf({ rows: structure.props.rows, encodings: { color: 'chain' }, selection: structure.props.selection, hover: null, theme: {}, size: { width: 1, height: 1 } }, { keyField: RESIDUE_KEY });
    const greyed = buckets.find((b) => b.word === 'dropped')?.residues ?? [];
    expect(greyed).toHaveLength(185 - inRange.length);
    expect(buckets.filter((b) => b.word === 'kept').reduce((n, b) => n + b.residues.length, 0)).toBe(inRange.length);
  });

  it('why({kind:"chart"}) says “the definition’s own” before anybody acts — this desk lands no acts', async () => {
    const view = await realView();
    const session = buildDashboard(protDef(TABLES)).createSession({ as: 'user' });
    for (const viewId of [STRUCTURE_VIEW, RAMA_VIEW]) {
      const answer = session.why({ kind: 'chart', viewId });
      expect(answer.ok).toBe(false);
      if (!answer.ok) {
        // `declared-in-def`, not `no-such-target`: the view is real, the picture is
        // the declaration's, and nothing has shaped it — which is the true state of
        // a desk whose whole story is a selection nobody has made yet
        expect(answer.missing).toBe('declared-in-def');
        expect(answer.reached).toBeUndefined();
      }
    }
    expect(view.getState().commits).toHaveLength(0);
  });

  it('after the click, why() names the SAME commit for both pictures — the 3D view’s own input, the scatter’s reaching clause', async () => {
    const session = buildDashboard(protDef(TABLES)).createSession({ as: 'user' });
    const landed = await session.dispatch({
      verb: 'select',
      viewId: STRUCTURE_VIEW,
      field: RESIDUE_KEY,
      value: 'A:50',
      cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick the glycine at A:50' },
    });
    expect(landed.ok).toBe(true);

    const structure = session.why({ kind: 'chart', viewId: STRUCTURE_VIEW });
    const rama = session.why({ kind: 'chart', viewId: RAMA_VIEW });
    expect([structure.ok, rama.ok]).toEqual([true, true]);
    if (!structure.ok || !rama.ok) return;
    // ONE commit, named by both answers: the picture the reader clicked and the
    // picture that answered are the same act's consequences
    expect(structure.viz.commitId).toBe(rama.viz.commitId);
    // Each answer reports that commit ONCE, in the role it played there (the
    // library's own rule — the anchor row wins, so `declaring` is the kind on
    // both). What tells the two apart is the QUALIFIER: the scatter's row carries
    // `response: 'filter'`, because the clause reached it through a filter edge
    // the crossfilter default materialised; the 3D view's carries none, because
    // the act was its own and reached nothing to get there.
    expect(structure.commits).toEqual([{ tier: 'viz', id: structure.viz.commitId, kind: 'declaring' }]);
    expect(rama.commits).toEqual([{ tier: 'viz', id: rama.viz.commitId, kind: 'declaring', response: 'filter' }]);
    // and both are honest about the tiers this desk has no story in
    expect(structure.misses.map((m) => m.tier).sort()).toEqual(['agent', 'kernel']);
    expect(rama.misses.map((m) => m.missing).sort()).toEqual(['no-agent-tier', 'no-kernel-snapshot']);
  });
});
