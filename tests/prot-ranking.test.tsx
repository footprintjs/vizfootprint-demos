/**
 * STAGE 5 GETS ITS OWN PICTURE — six marks, one per ranked residue, each press
 * one residue.
 *
 * The author, looking at his own desk: *"Why can this chart not render that?
 * When we render all the residues — why can we not render one result, like
 * these six residues, each click each residue highlights?"* Every other stage
 * on this desk had a picture and stage 5 had none, so its stepper press
 * promoted nothing and the page explained WHY instead of simply having one.
 *
 * Four things this file pins, and each of them is a way the picture could be
 * subtly wrong:
 *
 *   1. **THE HEIGHT IS NOT THE RANK.** Rank 1 is the strongest pick and would
 *      be the SHORTEST bar. `hotspot_rank` is declared `role: 'dimension',
 *      scale: 'discrete'` — *rank 6 is not six times rank 1* — so it is the
 *      ORDER and the COLOUR, and the height is `interface_contacts`, a count.
 *   2. **THE VIEW BINDS A STAGE-5 COLUMN**, so the focus intersection is
 *      non-empty and the stepper's press has this picture to promote. It is
 *      also the first picture on this desk drawn from TWO stages' columns, and
 *      the later stage owns it.
 *   3. **THE ABSENCE IS THE FILTER**, and the caption counts both numbers —
 *      never a bare six, because 179 residues were not named.
 *   4. **THE PUBLISHED BUILD IS UNTOUCHED**: the view, its capability, its
 *      surface, its grain and its words are declared only where the act is.
 *
 * Every test is on the SCRIPTED model and the SCRIPTED judge. No key, no
 * network, no model.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { PROT_ENCODINGS, PROT_ENCODINGS_ALL, PROT_VIEWS, RANKING_ENCODING, RANKING_VIEW, RESIDUES_TABLE, RESIDUE_KEY, protDef } from '../src/prot/def.js';
import { INTERFACE_CONTACTS_COLUMN, INTERFACE_SEPARATION_COLUMN, PROT_STAGES, RELATIVE_SASA_COLUMN, SASA_COLUMN, UNIPROT_SITE_COLUMN } from '../src/prot/analyses.js';
import { HOTSPOT_RANK_COLUMN, HOTSPOT_TAG, HOTSPOT_WANT, askHotspots, hotspotLedger, hotspotSlot, scriptedHotspotModel, scriptedJudge } from '../src/prot/hotspots.js';
import { PROT_PLAN, planStepOf } from '../src/prot/plan.js';
import { protTables } from '../src/prot/etl.js';
import { evidenceFromCommitted } from '../src/prot/conservationEvidence.js';
import { loadStructure, loadStructureText, readCommittedFile } from '../src/prot/snapshot.js';
import { landHotspots, openProtSurfaceAsync, residuesAt, type ProtSurface } from '../src/prot/session.js';
import { actColumnsOf, chartsOfStage, stepperStages, type StepperStage } from '../web/src/protStages.js';
import { byPlanStep, splitByFocus, shapeOfView, stageOfChart } from '../web/src/workbench/charts.js';
import { rankPaint, rankedBars, rankedResidues, useProtCells, valueSwatches, type ProtDeskData } from '../web/src/protCells.js';
import type { Row } from '../web/src/derive.js';

const TEXT = loadStructureText();
const TABLES = protTables(TEXT);
const EVIDENCE = await evidenceFromCommitted('1AY7', readCommittedFile);

/** The `tests/prot-cells.test.tsx` stub: nothing selected, every channel at its declared fallback. */
const QUIET: DeskProjection = {
  state: { selections: [], links: [], cleared: [], views: [{ viewId: RANKING_VIEW }] },
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
} as unknown as DeskProjection;

const dataWith = (residues: readonly Row[], over: Partial<ProtDeskData> = {}): ProtDeskData => ({
  residues,
  counts: TABLES.counts,
  skipped: TABLES.skipped,
  structure: loadStructure(),
  run: null,
  refusals: {},
  notes: [],
  ...over,
});

/** The cells, built the way the desk builds them. */
function cellsOf(desk: DeskProjection, data: ProtDeskData): ReturnType<typeof useProtCells> {
  let built: ReturnType<typeof useProtCells> = [];
  function Probe(): null {
    built = useProtCells(desk, data);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return built;
}

const textOf = (node: unknown): string =>
  renderToStaticMarkup(createElement('span', null, node as ReactElement))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x2014;/g, '—')
    .replace(/\s+/g, ' ');

/** One rank on a residue, the shape the act lands: `null` everywhere it did not name. */
const withRanks = (ranks: ReadonlyMap<string, number>): readonly Row[] =>
  TABLES.residues.map((row) => {
    const rank = ranks.get(String(row[RESIDUE_KEY]));
    return rank === undefined ? row : { ...row, [HOTSPOT_RANK_COLUMN]: rank };
  }) as readonly Row[];

/**
 * SIX RESIDUES THAT TOUCH ANOTHER CHAIN, with a contact count on each — the
 * shape stage 4 lands, because the height is stage 4's column and a fixture
 * without it would be testing a chart nobody can draw.
 *
 * The counts are DELIBERATELY NOT in rank order (6, 1, 4, 2, 5, 3): a fixture
 * whose height happened to fall with the rank could not tell a picture ordered
 * by rank from one ordered by height.
 */
const HEIGHTS = [6, 1, 4, 2, 5, 3];
const KEYS: readonly string[] = TABLES.residues.slice(30, 36).map((row) => String(row[RESIDUE_KEY]));
const RANKED: readonly Row[] = withRanks(new Map(KEYS.map((key, i) => [key, i + 1]))).map((row) => {
  const at = KEYS.indexOf(String(row[RESIDUE_KEY]));
  return at < 0 ? row : { ...row, [INTERFACE_CONTACTS_COLUMN]: HEIGHTS[at]! };
});

// ── 1 · the cell builder ────────────────────────────────────────────────────

describe('the marks are the rows carrying a rank, in rank order', () => {
  it('six ranked residues become six marks, sorted by rank and NOT by height', () => {
    const bars = rankedBars(RANKED, RESIDUE_KEY, INTERFACE_CONTACTS_COLUMN, HOTSPOT_RANK_COLUMN);
    expect(bars.map((b) => b.category)).toEqual([...KEYS]);
    // the heights arrive in the ORDER OF THE RANK, which is the whole point: the
    // fixture's counts are shuffled, so a fold that sorted by height would put
    // them in a different order and this would fail
    expect(bars.map((b) => b.count)).toEqual(HEIGHTS);
    expect(bars.map((b) => b.count)).not.toEqual([...HEIGHTS].sort((a, b) => a - b));
  });

  it('a band takes its slot order from the marks, so rank 1 is the FIRST slot however the rows arrive', () => {
    // the rows in reverse table order — the fold sorts, so the answer is the same
    const reversed = rankedBars([...RANKED].reverse(), RESIDUE_KEY, INTERFACE_CONTACTS_COLUMN, HOTSPOT_RANK_COLUMN);
    expect(reversed.map((b) => b.category)).toEqual([...KEYS]);
  });

  it('EMPTY when nothing is ranked — never a chart of nothing pretending to be a chart of something', () => {
    expect(rankedBars(TABLES.residues as readonly Row[], RESIDUE_KEY, INTERFACE_CONTACTS_COLUMN, HOTSPOT_RANK_COLUMN)).toEqual([]);
    expect(rankedResidues(TABLES.residues as readonly Row[], HOTSPOT_RANK_COLUMN)).toEqual([]);
  });

  it('THE ABSENCE IS THE FILTER: 179 of the 185 residues carry no rank, so they have no mark', () => {
    const ranked = rankedResidues(RANKED, HOTSPOT_RANK_COLUMN);
    expect(ranked).toHaveLength(6);
    expect(TABLES.counts.residues - ranked.length).toBe(179);
    // and it is an ABSENCE and not a zero — the act writes `null`, never a last
    // place, so nothing here can be mistaken for rank 186
    expect(RANKED.filter((row) => row[HOTSPOT_RANK_COLUMN] === 0)).toEqual([]);
  });

  it('a ranked residue with no HEIGHT gets no mark either — the height is another stage’s column', () => {
    // stage 5 named it; stage 4 landed no count for it (an entry with one chain,
    // or a residue the interactions act said nothing about)
    const holed = RANKED.map((row) => (String(row[RESIDUE_KEY]) === KEYS[2] ? { ...row, [INTERFACE_CONTACTS_COLUMN]: null } : row));
    const bars = rankedBars(holed, RESIDUE_KEY, INTERFACE_CONTACTS_COLUMN, HOTSPOT_RANK_COLUMN);
    expect(bars).toHaveLength(5);
    expect(bars.map((b) => b.category)).not.toContain(KEYS[2]);
    // …and it is counted rather than lost: the ranked rows still hold six
    expect(rankedResidues(holed, HOTSPOT_RANK_COLUMN)).toHaveLength(6);
  });

  it('the colour of a mark is the RANK, in the palette the 3D view paints a bound value with', () => {
    const paint = rankPaint(RANKED, RESIDUE_KEY, HOTSPOT_RANK_COLUMN);
    const hues = KEYS.map((key) => paint(key));
    // six ranks, six distinct hues, in the palette's own order — the same index
    // `molstarRenderer.ts` · `paintOf` gives the same value, so rank 1 is one
    // colour in both pictures
    expect(new Set(hues).size).toBe(6);
    expect(hues).toEqual([...valueSwatches(6)]);
    // a category this fold has no rank for is NOT given some rank's colour
    expect(paint('A:1')).not.toBe(hues[0]);
  });
});

// ── 2 · the channels, and the one law ───────────────────────────────────────

describe('the height is interface_contacts and the rank is the colour — never the other way round', () => {
  it('declares the three channels the picture draws', () => {
    expect(RANKING_ENCODING).toMatchObject({
      viewId: RANKING_VIEW,
      chartKind: 'bar',
      channels: ['category', 'y', 'color'],
      initial: { category: RESIDUE_KEY, y: INTERFACE_CONTACTS_COLUMN, color: HOTSPOT_RANK_COLUMN },
    });
  });

  it('the RANK IS NOT ON A MAGNITUDE CHANNEL, and the declaration is why', () => {
    const rankDef = protDef(TABLES, TEXT, EVIDENCE, hotspotSlot().analysis).data[RESIDUES_TABLE]?.columns?.[HOTSPOT_RANK_COLUMN];
    // the def's own ruling, made twice: a rank is a PLACE, so it is a discrete
    // dimension — the same argument that keeps `resnum` off a bar's height
    expect(rankDef).toMatchObject({ role: 'dimension', scale: 'discrete' });
    expect(RANKING_ENCODING.initial?.['y']).not.toBe(HOTSPOT_RANK_COLUMN);
    expect(RANKING_ENCODING.initial?.['color']).toBe(HOTSPOT_RANK_COLUMN);
  });

  /**
   * WHAT RULES THE TWO ALTERNATIVES OUT — MEASURED, and the measurement
   * corrected the packet's own brief.
   *
   * The brief ruled `relative_sasa` out because it *would leave gaps a reader
   * cannot account for*, being absent where a residue's type has no published
   * maximum. That is true OF THE COLUMN and FALSE OF THIS ENTRY: every one of
   * the 185 residues of `1AY7` has a maximum to divide by, so the gap count is
   * ZERO and a bar of it would have no holes at all. The reason recorded in the
   * def is therefore the one that survives a measurement rather than the one
   * that was argued: **both alternatives point the wrong way.**
   *
   * `interface_separation` is a DISTANCE where smaller is tighter, and
   * `relative_sasa` at an interface is an EXPOSURE where smaller means more
   * buried by the partner chain (`src/prot/analyses.ts` computes the area with
   * the neighbouring chain in place, which is what makes the two pictures one
   * story). So on either of them the residue that makes the MOST contacts
   * across the interface — the most involved one on this desk's own subject —
   * is drawn as a BELOW-MEDIAN bar, which is the rank-as-height error in
   * another costume.
   */
  it('and the two alternatives are ruled out by a MEASUREMENT — both point the wrong way', async () => {
    const { surface, answer } = await ranked();
    const rows = (await residuesAt(surface.session, surface.tables)).rows as readonly Row[];
    const picks = rankedResidues(rows, HOTSPOT_RANK_COLUMN);
    expect(picks).toHaveLength(answer.picks.length);
    // EVERY PICK CARRIES THE HEIGHT, because the picks come from the residues
    // that carry an `interface_separation` — so the bar has no gaps
    expect(picks.every((row) => typeof row[INTERFACE_CONTACTS_COLUMN] === 'number')).toBe(true);
    expect(picks.every((row) => row[INTERFACE_SEPARATION_COLUMN] !== null && row[INTERFACE_SEPARATION_COLUMN] !== undefined)).toBe(true);
    // THE BRIEF'S GAP ARGUMENT DOES NOT HOLD ON THIS ENTRY, and this is the
    // assertion that says so: `relative_sasa` is absent on NONE of the 185
    // residues, so it would leave no holes here
    expect(rows.filter((row) => row[RELATIVE_SASA_COLUMN] === null || row[RELATIVE_SASA_COLUMN] === undefined)).toEqual([]);
    /*
      WHAT DOES RULE THEM OUT: the most involved residue would be a SHORT bar.
      Measured on the picks, once per candidate column — the height that is
      right puts it at the top, and both alternatives put it below the middle.
    */
    const most = [...picks].sort((a, b) => Number(b[INTERFACE_CONTACTS_COLUMN]) - Number(a[INTERFACE_CONTACTS_COLUMN]))[0]!;
    const median = (column: string): number => {
      const sorted = picks.map((row) => Number(row[column])).sort((a, b) => a - b);
      return (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.ceil((sorted.length - 1) / 2)]!) / 2;
    };
    expect(Number(most[INTERFACE_CONTACTS_COLUMN])).toBe(Math.max(...picks.map((row) => Number(row[INTERFACE_CONTACTS_COLUMN]))));
    expect(Number(most[INTERFACE_SEPARATION_COLUMN])).toBeLessThan(median(INTERFACE_SEPARATION_COLUMN));
    expect(Number(most[RELATIVE_SASA_COLUMN])).toBeLessThan(median(RELATIVE_SASA_COLUMN));
  });
});

/** A real session that ran every stage and landed a ranking — the scripted model, the scripted judge. */
async function ranked(want = HOTSPOT_WANT): Promise<{ readonly surface: ProtSurface; readonly answer: Extract<Awaited<ReturnType<typeof askHotspots>>, { ok: true }>; readonly commit: string | null }> {
  const surface = await openProtSurfaceAsync(loadStructure(), undefined, EVIDENCE, hotspotSlot());
  const before = await residuesAt(surface.session, surface.tables);
  const answer = await askHotspots({ provider: scriptedHotspotModel({ want }), judge: scriptedJudge(), model: 'a-test-model', ledger: hotspotLedger(surface.run, before.rows, before.cursor) });
  expect(answer.ok).toBe(true);
  if (!answer.ok) throw new Error(answer.sentence);
  const landed = await landHotspots(surface, answer);
  expect(landed.materialized).toContain(HOTSPOT_RANK_COLUMN);
  return { surface, answer, commit: landed.commit };
}

// ── 3 · refused before the stage, drawing after ─────────────────────────────

describe('the library refuses this chart BY NAME before stage 5, and it draws after', () => {
  it('the boot’s own gesture at this chart is refused, naming the column stage 5 lands', async () => {
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, EVIDENCE, hotspotSlot());
    expect(surface.refusals[RANKING_VIEW]).toBe(`no column "${HOTSPOT_RANK_COLUMN}" in table "residues"`);
    // the refusal names the RANK and not the bar's height: the height is stage
    // 4's column and is on the rows long before this picture can draw
    expect(surface.refusals[RANKING_VIEW]).not.toContain(INTERFACE_CONTACTS_COLUMN);
    // and it left NOTHING on the log — a refused dispatch makes no commit
    expect(surface.session.gaps().some((g) => g.detail === `no column "${HOTSPOT_RANK_COLUMN}" in table "residues"`)).toBe(true);
  });

  it('a build that cannot ask a model makes NO gesture there at all — there is no address to gesture at', async () => {
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, EVIDENCE, null);
    expect(Object.keys(surface.refusals)).not.toContain(RANKING_VIEW);
    expect(surface.session.gaps().some((g) => g.detail.includes(HOTSPOT_RANK_COLUMN))).toBe(false);
  });

  it('the CELL prints that sentence verbatim and draws no axis, then draws six marks once the rank is on the rows', async () => {
    const before = cellsOf(QUIET, dataWith(TABLES.residues as readonly Row[], { refusals: { [RANKING_VIEW]: `no column "${HOTSPOT_RANK_COLUMN}" in table "residues"` } })).find((c) => c.id === RANKING_VIEW)!;
    const empty = renderToStaticMarkup(before.render({ width: 600, height: 300 }) as ReactElement);
    expect(empty).toContain(`no column &quot;${HOTSPOT_RANK_COLUMN}&quot; in table &quot;residues&quot;`);
    expect(empty).not.toContain('<svg');
    expect(textOf(before.caption)).toContain('nothing to draw yet');
    // and there is no count on the foot of a picture with nothing to count
    expect(before.foot).toBe(null);
    expect(before.marks).toBeUndefined();

    const after = cellsOf(QUIET, dataWith(RANKED)).find((c) => c.id === RANKING_VIEW)!;
    const drawn = renderToStaticMarkup(after.render({ width: 600, height: 300 }) as ReactElement);
    expect(drawn).toContain('<svg');
    expect(after.marks).toBe(6);
  });

  it('the cell is ABSENT on a build that declares no such view — the record says which, not a flag', () => {
    const published = cellsOf({ ...QUIET, state: { ...(QUIET.state as object), views: [] } } as unknown as DeskProjection, dataWith(RANKED));
    expect(published.map((c) => c.id)).not.toContain(RANKING_VIEW);
    // …and every other picture is still there, byte for byte
    expect(published.map((c) => c.id)).toEqual(cellsOf(QUIET, dataWith(RANKED)).map((c) => c.id).filter((id) => id !== RANKING_VIEW));
  });
});

// ── 4 · the caption counts BOTH numbers ─────────────────────────────────────

describe('the caption names both numbers — never a bare six', () => {
  const cell = () => cellsOf(QUIET, dataWith(RANKED)).find((c) => c.id === RANKING_VIEW)!;

  it('says how many were ranked OUT OF how many residues there are, in the register the scatter already uses', () => {
    expect(cell().foot).toBe('6 of 185 residues ranked');
    const said = textOf(cell().caption);
    expect(said).toContain('6 of 185 residues ranked');
    // a reader must be able to see that 179 residues were not named, because
    // that is most of them
    expect(said).toContain('the other 179 residues carry NO rank at all and so have no mark');
    expect(said).toContain('not a low rank and not a last place');
  });

  it('says the height is NOT the rank, and why', () => {
    const said = textOf(cell().caption);
    expect(said).toContain('THE HEIGHT IS NOT THE RANK');
    expect(said).toContain(INTERFACE_CONTACTS_COLUMN);
    expect(said).toContain('rank 1 is the strongest pick and would be the SHORTEST bar');
  });

  it('carries the register — the same words the card and the viewer carry, from the one module that owns them', () => {
    expect(textOf(cell().caption)).toContain(HOTSPOT_TAG.toUpperCase());
  });

  it('names the press, and names the OTHER stage-5 gesture so the two are not taken for one', () => {
    const said = textOf(cell().caption);
    expect(said).toContain('press one and that residue is selected');
    expect(said).toContain('a press here is one residue');
  });

  it('counts a ranked residue with no height rather than losing it', () => {
    const holed = RANKED.map((row) => (String(row[RESIDUE_KEY]) === KEYS[2] ? { ...row, [INTERFACE_CONTACTS_COLUMN]: null } : row));
    const said = textOf(cellsOf(QUIET, dataWith(holed)).find((c) => c.id === RANKING_VIEW)!.caption);
    expect(said).toContain(`1 of the ranked residues carry no ${INTERFACE_CONTACTS_COLUMN}`);
    // …and the clause is ABSENT when every mark has its height
    expect(textOf(cell().caption)).not.toContain('carry no interface_contacts');
  });
});

// ── 5 · the press promotes it, and the LATER stage owns it ──────────────────

/**
 * WHAT A STEPPER PRESS DOES — the desk's own fold, replayed.
 *
 * `web/src/protDesk.tsx` presses a stage, seeks to its commit, takes
 * `chartsOfStage` as the FOCUS and hands `splitByFocus(...).hero[0]` to the
 * focus slot. So these three assertions together are the press.
 */
describe('a press on stage 5 promotes this picture — and stage 4 does not own it', () => {
  const OUTCOMES = [
    { stage: 'conservation', act: 'residueConservation', commit: 'c-cons', refusal: null, materialized: ['conservation', 'conservation_basis'] },
    { stage: 'interactions', act: 'interactionPairs', commit: 'c-pairs', refusal: null, materialized: [] },
    { stage: 'interactions', act: 'residueContacts', commit: 'c-contacts', refusal: null, materialized: ['contacts', INTERFACE_CONTACTS_COLUMN, INTERFACE_SEPARATION_COLUMN] },
    // STAGE 6'S ACT IS IN THIS RUN because a real run lands it — and its
    // absence would have handed stage 6's picture to the interactions stage,
    // whose `contacts` column is its HEIGHT. A fixture missing a stage is a
    // fixture that answers the ownership question for the wrong desk.
    { stage: 'annotation', act: 'residueAnnotation', commit: 'c-annotation', refusal: null, materialized: [UNIPROT_SITE_COLUMN, 'uniprot_note', 'pfam_domain'] },
    { stage: 'surface', act: 'residueSurface', commit: 'c-surface', refusal: null, materialized: [SASA_COLUMN, RELATIVE_SASA_COLUMN] },
    { stage: 'hotspots', act: 'residueHotspots', commit: 'c-hotspots', refusal: null, materialized: [HOTSPOT_RANK_COLUMN, 'hotspot_cites', 'hotspot_reason'] },
  ];
  const STAGES = stepperStages(OUTCOMES, { outcomes: OUTCOMES, narrative: [] } as never);
  const COLUMNS = actColumnsOf(STAGES);
  const at = (stage: string): StepperStage => STAGES.find((s) => s.stage === stage)!;
  /** What the session shows at the cursor, with every view at its declared binding. */
  const SHOWN = Object.fromEntries(PROT_ENCODINGS_ALL.map((e) => [e.viewId, e.initial ?? {}]));

  it('gives stage 5 its own chart — the intersection is non-empty because the view binds the rank', () => {
    expect(chartsOfStage(at('hotspots'), SHOWN, COLUMNS, STAGES)).toEqual([RANKING_VIEW]);
  });

  it('does NOT give it to stage 4, whose column is its HEIGHT — a picture belongs to the stage it could not draw without', () => {
    // the interactions stage keeps the two pictures it always had
    expect([...chartsOfStage(at('interactions'), SHOWN, COLUMNS, STAGES)].sort()).toEqual(['interface', 'pairs']);
    expect(chartsOfStage(at('interactions'), SHOWN, COLUMNS, STAGES)).not.toContain(RANKING_VIEW);
    // …and ONE stage owns it, which is what the stepper's bar and the card's
    // lead both read
    expect(stageOfChart(STAGES, RANKING_VIEW, SHOWN, COLUMNS)?.stage).toBe('hotspots');
  });

  it('and every picture that had one owner keeps it, byte for byte', () => {
    expect(stageOfChart(STAGES, 'interface', SHOWN, COLUMNS)?.stage).toBe('interactions');
    expect(stageOfChart(STAGES, 'surface', SHOWN, COLUMNS)?.stage).toBe('surface');
    expect(stageOfChart(STAGES, 'conservation', SHOWN, COLUMNS)?.stage).toBe('conservation');
    // and stage 6's, which borrows its height from stage 4 exactly as stage 5's
    // borrows from it — the later stage owns both
    expect(stageOfChart(STAGES, 'known', SHOWN, COLUMNS)?.stage).toBe('annotation');
    // the two drawn from the file's own columns are still the parse's
    expect(stageOfChart(STAGES, 'structure', SHOWN, COLUMNS)?.stage).toBe('search');
    expect(stageOfChart(STAGES, 'rama', SHOWN, COLUMNS)?.stage).toBe('search');
  });

  it('THE PRESS PROMOTES IT: the hero of stage 5’s focus is this picture and no other', () => {
    const cells = cellsOf(QUIET, dataWith(RANKED));
    const pictures = byPlanStep(cells.map((c) => ({ step: stageOfChart(STAGES, c.id, SHOWN, COLUMNS)?.number ?? null, item: c })));
    const focus = new Set(chartsOfStage(at('hotspots'), SHOWN, COLUMNS, STAGES));
    const produced = splitByFocus(pictures, focus).hero;
    expect(produced.map((c) => c.id)).toEqual([RANKING_VIEW]);
    // …and the rail is ordered by the plan, so this tile sits at step 5
    expect(stageOfChart(STAGES, RANKING_VIEW, SHOWN, COLUMNS)?.number).toBe(5);
  });

  it('a reader who UNBINDS the rank gives the picture back to stage 4 — the intersection follows a re-encode', () => {
    const rebound = { ...SHOWN, [RANKING_VIEW]: { category: RESIDUE_KEY, y: INTERFACE_CONTACTS_COLUMN, color: 'chain' } };
    expect(chartsOfStage(at('hotspots'), rebound, COLUMNS, STAGES)).toEqual([]);
    expect(chartsOfStage(at('interactions'), rebound, COLUMNS, STAGES)).toContain(RANKING_VIEW);
  });

  it('the layout knows its shape — a bar wants WIDTH, read off the declared kind', () => {
    expect(shapeOfView(RANKING_VIEW)).toBe(shapeOfView('interface'));
  });
});

// ── 6 · the published build is byte-identical ───────────────────────────────

describe('the view is declared ONLY where the act is, so the published definition is unchanged', () => {
  const PUBLISHED = protDef(TABLES, TEXT, EVIDENCE, null);
  const SERVED = protDef(TABLES, TEXT, EVIDENCE, hotspotSlot().analysis);

  it('the published def declares seven views and NOTHING about stage 5’s chart', () => {
    expect(Object.keys(PUBLISHED.actors)).toEqual([...PROT_VIEWS]);
    expect(PUBLISHED.encodings).toEqual(PROT_ENCODINGS);
    expect(PUBLISHED.encodings?.some((e) => e.viewId === RANKING_VIEW)).toBe(false);
    expect(PUBLISHED.capabilities?.some((c) => c.viewId === RANKING_VIEW)).toBe(false);
    expect(PUBLISHED.grains?.some((g) => g.viewId === RANKING_VIEW)).toBe(false);
    expect(PUBLISHED.prose?.some((p) => p.viewId === RANKING_VIEW)).toBe(false);
    // and no column for the answer it cannot have
    expect(Object.keys(PUBLISHED.data[RESIDUES_TABLE]?.columns ?? {})).not.toContain(HOTSPOT_RANK_COLUMN);
  });

  it('…and the whole of it is byte-identical to a def built with no evidence of stage 5 anywhere in it', () => {
    // the serialisable half, compared whole: a later edit that leaks one field of
    // stage 5's declaration into the published def fails HERE rather than on the
    // published page
    const shape = (def: typeof PUBLISHED) => JSON.stringify({ actors: def.actors, encodings: def.encodings, grains: def.grains, capabilities: def.capabilities, columns: def.data[RESIDUES_TABLE]?.columns });
    expect(shape(PUBLISHED)).not.toContain(RANKING_VIEW);
    expect(shape(PUBLISHED)).not.toContain(HOTSPOT_RANK_COLUMN);
    expect(shape(PUBLISHED)).toBe(shape(protDef(TABLES, TEXT, EVIDENCE)));
  });

  it('the served def declares stage 5’s view, its capability, its grain and its words — and the published list untouched around it', () => {
    /*
      THE PUBLISHED LIST IS `PROT_VIEWS` and this assertion is about where
      stage 5's view is SPLICED INTO it, which is the only thing about the
      registry this stage owns. It used to be a literal of seven names plus
      `ranking`; stage 6 then added a view every build declares, and a literal
      would have made a stage-6 fact fail a stage-5 test. So the published order
      comes from the constant and what is asserted is the splice: after the
      surface stage's pictures, before the receipt.
    */
    const published = [...PROT_VIEWS];
    const at = published.indexOf('pairs');
    expect(Object.keys(SERVED.actors)).toEqual([...published.slice(0, at), RANKING_VIEW, ...published.slice(at)]);
    expect(SERVED.encodings).toEqual(PROT_ENCODINGS_ALL);
    // A POINT and nothing else — a bar chart has no brush, and one bar is one
    // residue
    expect(SERVED.capabilities?.find((c) => c.viewId === RANKING_VIEW)).toEqual({ viewId: RANKING_VIEW, canProbe: true, encodings: ['point'] });
    // one mark per ROW, like every other picture here
    expect(SERVED.grains?.find((g) => g.viewId === RANKING_VIEW)).toEqual({ viewId: RANKING_VIEW, keys: [] });
    const prose = SERVED.prose?.find((p) => p.viewId === RANKING_VIEW);
    expect(prose?.slots['title']?.text).toContain('ranked as hot spots');
    // the long words say the height is not the rank, and count NOTHING about the
    // answer — the def is built before the answer can exist
    expect(prose?.slots['altLong']?.text).toContain('THE HEIGHT IS NOT THE RANK');
    expect(prose?.slots['altLong']?.text).toContain(`at most ${String(HOTSPOT_WANT)}`);
  });

  it('and the PLAN’s sentence about step 5 is untouched — a static page still cannot hold the key', () => {
    const five = planStepOf('hotspots')!;
    expect(five.blockedBy).toBe('this build');
    expect(five.why).toContain('a static page cannot hold the key that would call one');
    // the plan is not edited for this packet and must not be: the def a static
    // build returns really does dispatch nothing for stage 5
    expect(Object.keys(PUBLISHED.analyses ?? {})).not.toContain('residueHotspots');
    expect(PROT_STAGES.map((s) => s.stage)).not.toContain('hotspots');
    expect(PROT_PLAN.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ── 7 · the key reaches nothing this picture draws ──────────────────────────

describe('no key reaches this picture, its words or its refusal', () => {
  it('the cell module reads no environment variable at all', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('../web/src/protCells.tsx', import.meta.url), 'utf8'));
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('import.meta.env');
  });

  it('a ranking asked with a secret-carrying model leaks nothing into the marks, the caption or the foot', async () => {
    const SECRET = 'sk-ant-not-a-real-key-000111222';
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, EVIDENCE, hotspotSlot());
    const before = await residuesAt(surface.session, surface.tables);
    // the provider is the only thing holding it — the scripted model, with the
    // secret in its own name
    const answer = await askHotspots({
      provider: scriptedHotspotModel({ want: 3 }),
      judge: scriptedJudge(),
      model: `a-test-model-${SECRET.slice(0, 3)}`,
      ledger: hotspotLedger(surface.run, before.rows, before.cursor),
    });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    await landHotspots(surface, answer);
    const rows = (await residuesAt(surface.session, surface.tables)).rows as readonly Row[];
    const cell = cellsOf(QUIET, dataWith(rows)).find((c) => c.id === RANKING_VIEW)!;
    const everything = `${String(cell.foot)}\n${textOf(cell.caption)}\n${renderToStaticMarkup(cell.render({ width: 600, height: 300 }) as ReactElement)}\n${JSON.stringify(rankedBars(rows, RESIDUE_KEY, INTERFACE_CONTACTS_COLUMN, HOTSPOT_RANK_COLUMN))}`;
    expect(everything).not.toContain(SECRET);
    expect(everything).not.toContain('sk-ant');
    // and the picture really drew: the assertion above would pass on an empty one
    expect(cell.marks).toBe(3);
  });
});
