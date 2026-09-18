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
import { CONSERVATION_VIEW, INTERFACE_VIEW, RAMA_VIEW, RESIDUE_KEY, STRUCTURE_VIEW, SURFACE_VIEW, protDef } from '../src/prot/def.js';
import { CONSERVATION_BASIS_COLUMN, CONSERVATION_COLUMN, type ConservationOutput } from '../src/prot/analyses.js';
import { SCORE_IS, SCORE_IS_NOT } from '../src/prot/conservation.js';
import { CONSENSUS } from '../src/prot/placement.js';
import { evidenceFromCommitted } from '../src/prot/conservationEvidence.js';
import { foldConservation } from '../src/prot/conservationFold.js';
import type { ProtRun } from '../src/prot/orchestrator.js';
import { protTables, skippedTotal } from '../src/prot/etl.js';
import { loadStructure, loadStructureText, readCommittedFile } from '../src/prot/snapshot.js';
import { paintOf } from '../web/src/molstarRenderer.js';
import { interfaceBars, ramaDots, surfaceRun, useProtCells, type ProtDeskData } from '../web/src/protCells.js';
import type { Row } from '../web/src/derive.js';

const TEXT = loadStructureText();
const TABLES = protTables(TEXT);
/**
 * The desk's data with NO STAGE RUN — the file's own columns and nothing else.
 *
 * That is the honest default for these tests: they are about the 3D view, the
 * scatter and the shared selection, all of which are read straight off the
 * entry. The two act-fed cells are covered where their evidence is —
 * `tests/prot-progression.test.ts` runs the stages and asserts what each chart
 * does before and after — and `refusals` here carries what a REAL session
 * refused those two charts with, so the cells that print it print the library's
 * sentence rather than a string this file invented.
 */
const DATA: ProtDeskData = {
  residues: TABLES.residues as readonly Row[],
  counts: TABLES.counts,
  skipped: TABLES.skipped,
  structure: loadStructure(),
  run: null,
  refusals: { [INTERFACE_VIEW]: 'no column "interface_contacts" in table "residues"', [SURFACE_VIEW]: 'no column "sasa" in table "residues"', [CONSERVATION_VIEW]: 'no column "conservation" in table "residues"' },
  // NOTHING TO REPORT about this entry, and that is the true answer for it: one
  // model, two protein chains, no insertion code (`src/prot/entryNotes.ts` ·
  // `entryNotes` answers an empty list, which `tests/prot-notes.test.ts`
  // asserts against these very bytes).
  notes: [],
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
  const session = buildDashboard(protDef(TABLES, TEXT)).createSession({ as: 'user' });
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

describe('the two folds the act-fed cells draw through', () => {
  /** Four rows with the columns an act would have landed, and one without — the shape both folds are judged on. */
  const LANDED: readonly Row[] = [
    { residue_key: 'A:1', chain: 'A', resnum: 1, interface_contacts: 2, sasa: 10 },
    { residue_key: 'A:2', chain: 'A', resnum: 2, interface_contacts: 0, sasa: 20 },
    { residue_key: 'B:1', chain: 'B', resnum: 1, interface_contacts: 3, sasa: 30 },
    { residue_key: 'B:10', chain: 'B', resnum: 10, interface_contacts: 1, sasa: 40 },
  ];

  it('makes no bar at all from a row with no column, and a bar of ZERO from a real count of none', () => {
    // BEFORE THE ACT: the column is absent from every row, so there is nothing to
    // draw — which is what lets the cell print the library's refusal instead of an
    // empty axis
    expect(interfaceBars(DATA.residues, RESIDUE_KEY, 'interface_contacts')).toEqual([]);
    // AFTER IT: four bars, and the residue that touches no other chain has a bar
    // of height zero, because zero contacts is a measurement
    const bars = interfaceBars(LANDED, RESIDUE_KEY, 'interface_contacts');
    expect(bars).toEqual([
      { category: 'A:1', count: 2 },
      { category: 'A:2', count: 0 },
      { category: 'B:1', count: 3 },
      { category: 'B:10', count: 1 },
    ]);
  });

  it('SUMS per category, so a re-encode to a coarser column reads as a total rather than a pile of bars', () => {
    // the category is whatever the fold binds, and a reader can move it: bound to
    // `chain` the two slots carry their chains' own totals, not 4 overlapping bars
    expect(interfaceBars(LANDED, 'chain', 'interface_contacts')).toEqual([
      { category: 'A', count: 2 },
      { category: 'B', count: 4 },
    ]);
  });

  it('orders the run’s band NUMERICALLY when its axis is a number, and leaves a category axis in the table’s order', () => {
    expect(surfaceRun(DATA.residues, 'resnum', 'sasa', 'chain')).toEqual([]);
    // both chains share the residue numbering, so slot "1" holds one point of each
    // — and "10" comes after "2", which is exactly what an appearance-ordered band
    // would get wrong
    const run = surfaceRun(LANDED, 'resnum', 'sasa', 'chain');
    // AND `cell` RIDES BESIDE THE SLOT NAME, which is what makes a drag on this
    // run answerable: the slot is named "1" and the clause carries the NUMBER 1,
    // because `resnum` holds numbers and a spelling addresses no row of it.
    expect(run).toEqual([
      { category: '1', cell: 1, value: 10, series: 'A' },
      { category: '1', cell: 1, value: 30, series: 'B' },
      { category: '2', cell: 2, value: 20, series: 'A' },
      { category: '10', cell: 10, value: 40, series: 'B' },
    ]);
    // …and on a STRING axis the cell IS the name, so a band over `chain` is
    // byte-identical to what it was before the value rode along
    expect(surfaceRun(LANDED, 'chain', 'sasa', 'chain')).toEqual([
      { category: 'A', cell: 'A', value: 10, series: 'A' },
      { category: 'A', cell: 'A', value: 20, series: 'A' },
      { category: 'B', cell: 'B', value: 30, series: 'B' },
      { category: 'B', cell: 'B', value: 40, series: 'B' },
    ]);
    // a STRING axis is a legal band for a line (the library's own requirement
    // widens x to a string) and nothing here knows a better order for one, so the
    // table's own order is kept
    expect(surfaceRun(LANDED, 'chain', 'sasa', 'chain').map((p) => ('category' in p ? p.category : ''))).toEqual(['A', 'A', 'B', 'B']);
  });
});

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
    /*
      THE AXES ARE THE WHOLE OF TORSION SPACE NOW, not the extent of these
      residues — because a residue at 107° drawn hard against the right edge
      reads as the edge of torsion space when it is nowhere near it
      (`web/src/protCells.tsx` · `TORSION_RANGE`). The caption follows the
      picture, and it keeps the shortfall it always named: the range is a PROP,
      the frame's own vocabulary is words, so nothing in the record says why the
      axes are wider than the marks.
    */
    expect(caption).toContain('both axes are drawn over the whole -180 to 180 degrees a backbone torsion can take');
    expect(caption).toContain('nothing in the record says why the axes are wider than the marks');
    // …and the crosshair beside it, which the view DOES declare
    expect(caption).toContain('the zero guide the view DECLARES');
  });

  it('reads its axes off the fold at the view’s address, never a literal', () => {
    // a desk whose fold says something else moves BOTH the marks and the axis label
    const rebound = { ...QUIET, bound: (_a: string, channel: string) => (channel === 'x' ? 'psi' : 'phi') } as unknown as DeskProjection;
    const scatter = propsOf<ReactElement<{ xField: string; yField: string; xLabel: string; data: readonly unknown[] }>>(RAMA_VIEW, rebound);
    expect([scatter.props.xField, scatter.props.yField]).toEqual(['psi', 'phi']);
    expect(scatter.props.xLabel).toBe('psi (degrees)');
  });
});

// ── the conservation cell, and the fact its face may not drop ──────────────

/**
 * THE CONSERVATION STAGE'S ANSWER AND ITS TWO COLUMNS — folded from the
 * committed evidence, exactly as the act folds them.
 *
 * The FOLD is used rather than a run of the orchestrator because the act's
 * whole computation is this fold: running the chart would add three headless
 * Mol* parses to a suite that is about words on a card. What the cell reads is
 * the rows and `run.conservation`, and both are the fold's own output here — so
 * no number in the assertions below was typed.
 */
const FOLD = foldConservation(await evidenceFromCommitted('1AY7', readCommittedFile), TABLES.residues.map((r) => r.residue_key));

/** The desk's data WITH the conservation stage landed — the rows carrying its two columns. */
const CONSERVED: ProtDeskData = {
  ...DATA,
  residues: TABLES.residues.map((row, at) => ({ ...row, [CONSERVATION_COLUMN]: FOLD.conservation[at], [CONSERVATION_BASIS_COLUMN]: FOLD.conservation_basis[at] })) as readonly Row[],
  run: { outcomes: [], narrative: [], pairs: null, contacts: null, surface: null, conservation: { as: 'columns', table: 'residues', columns: {}, counts: FOLD.counts, refusals: FOLD.refusals } as unknown as ConservationOutput } as unknown as ProtRun,
};

/** The cells over the landed data — the same door `cellsOf` uses, with the other run. */
function conservedCells(): ReturnType<typeof useProtCells> {
  let built: ReturnType<typeof useProtCells> = [];
  function Probe(): null {
    built = useProtCells(QUIET, CONSERVED);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

const conservedCell = () => conservedCells().find((c) => c.id === CONSERVATION_VIEW)!;

describe('the conservation cell says WHOSE data it is and WHICH METHOD placed it', () => {
  it('prints the library’s own refusal, verbatim, before its stage has landed', () => {
    const cell = cellsOf().find((c) => c.id === CONSERVATION_VIEW)!;
    expect(cell.foot).toBeNull();
    expect(cell.narrowing).toBeNull();
    expect(textOf(cell.caption)).toContain('no column "conservation" in table "residues"');
    expect(textOf(cell.render({ width: 400, height: 300 }))).toContain('no column "conservation" in table "residues"');
  });

  it('CARRIES THE METHOD ON ITS FACE, after the counts and the citation — never only behind the note', () => {
    /*
      THE ONE ASSERTION THIS CELL EXISTS FOR. The face law on this desk is a
      title, a picture and one line of figures, and the figures' left half is
      the only surviving copy of itself — so a reader who reads nothing else
      still learns that these numbers were placed by the WEAKER of the two
      methods. A fact that lived only behind `Full note` is a fact most readers
      would not have.
    */
    expect(conservedCell().foot).toBe('162 of 185 residues scored · PF00545.26 + PF01337.25 · consensus-placed — the weaker method');
  });

  it('says in its note what the score IS, what it is NOT, and the whole argument about the placement', () => {
    const said = textOf(conservedCell().caption);
    expect(said).toContain('THE ALIGNMENT IS CITED, NOT BUILT');
    expect(said).toContain('chain A against PF00545.26 (ribonuclease), 283 curated sequences, 100 family positions');
    expect(said).toContain('chain B against PF01337.25 (Barstar (barnase inhibitor)), 69 curated sequences, 97 family positions');
    expect(said).toContain('THESE LINES ARE NOT ONE SCALE');
    expect(said).toContain(SCORE_IS);
    expect(said).toContain(SCORE_IS_NOT);
    expect(said).toContain(CONSENSUS.said);
    expect(said).toContain(CONSENSUS.why);
    // the four hops, and the one that is NOT the identity on this entry
    expect(said).toContain('THE FOUR HOPS, each READ rather than assumed');
    expect(said).toContain('chain B begins at UniProt position 2');
    // ABSENT AND COUNTED — the 23 residues with no column, and where they are
    expect(said).toContain('23 of the 185 residues have NO score — absent, never zero');
    expect(said).toContain('the family covers positions 5–92 of chain A');
    expect(said).toContain('the placement put 82 of those on a family position');
  });

  it('hands the chart the bound column and names the method on its own axis label', () => {
    const run = conservedCell().render({ width: 800, height: 600 }) as ReactElement<{ valueField: string; dateField: string; yLabel: string; data: readonly unknown[] }>;
    expect([run.props.dateField, run.props.valueField]).toEqual(['resnum', CONSERVATION_COLUMN]);
    expect(run.props.yLabel).toBe('conservation (0…1, entropy over the cited alignment — consensus-placed)');
    // one point per SCORED residue, and none for a residue with no column
    expect(run.props.data).toHaveLength(FOLD.counts.scored);
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
    const session = buildDashboard(protDef(TABLES, TEXT)).createSession({ as: 'user' });
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
    const session = buildDashboard(protDef(TABLES, TEXT)).createSession({ as: 'user' });
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
