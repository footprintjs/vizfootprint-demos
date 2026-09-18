/**
 * THE MODEL'S PICKS AS MARKS IN THE STRUCTURE — and the four things that makes
 * this honest rather than a highlight.
 *
 *   1. **BIND, DO NOT PAINT.** The picks become visible because a DECLARED
 *      channel is bound to a LANDED column, through the reencode door the desk
 *      already has. No new chart kind, no new emission kind, no hand-placed
 *      highlight — and the rebind is a real act on the real session here.
 *   2. **ABSENCE IS THE HARD PART AND IT IS THE POINT.** 179 of 185 residues
 *      carry no rank. The legend says **absent** — never zero, never a rank of
 *      186, never a colour on the ranks' own ramp.
 *   3. **THE REGISTER IS THE HONESTY COST.** Painting a model's opinion onto
 *      measured geometry puts a recommendation in the same visual language as
 *      the crystallography, so the viewer's caption carries the card's words
 *      WHILE the channel is bound to the rank — and must not when it is not.
 *   4. **EVERYTHING STAYS CLICKABLE.** Marking six residues is not narrowing
 *      the gesture to six.
 *
 * Every test is on the scripted model and the scripted judge. No key, no
 * network, no model.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { createSessionView, selectionForView, sessionSource, type RenderRow, type RenderSelection, type RenderState } from 'vizfootprint-ui';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { CONSERVATION_VIEW, INTERFACE_VIEW, RAMA_VIEW, RESIDUES_TABLE, RESIDUE_KEY, STRUCTURE_COLOR_RULE, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { evidenceFromCommitted } from '../src/prot/conservationEvidence.js';
import { protTables } from '../src/prot/etl.js';
import { loadStructure, loadStructureText, readCommittedFile } from '../src/prot/snapshot.js';
import { landHotspots, openProtSurfaceAsync, residuesAt } from '../src/prot/session.js';
import { HOTSPOT_RANK_COLUMN, HOTSPOT_TAG, askHotspots, hotspotLedger, hotspotSlot, scriptedHotspotModel, scriptedJudge } from '../src/prot/hotspots.js';
import { PAINT_COLOR, PAINT_MEANING, PAINT_WORDS, VALUE_PALETTE, paintOf, pointOf, saidOf } from '../web/src/molstarRenderer.js';
import { useProtCells, type ProtDeskData } from '../web/src/protCells.js';
import { emptyFocusSaid, paintLabelOf } from '../web/src/workbench/panel.js';
import { chartsOfStage } from '../web/src/protStages.js';
import type { Row } from '../web/src/derive.js';

const TEXT = loadStructureText();
const TABLES = protTables(TEXT);

/** A desk with nothing selected — the `tests/prot-cells.test.tsx` stub, with the ONE fold this suite moves. */
const quietDesk = (over: Partial<{ bound: (address: string, channel: string, fallback: string) => string }> = {}): DeskProjection =>
  ({
    state: { selections: [], links: [], cleared: [], views: [] },
    view: { emit: () => undefined, reencode: () => undefined },
    bound: over.bound ?? ((_address: string, _channel: string, fallback: string) => fallback),
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
  }) as unknown as DeskProjection;

/**
 * Rows with a rank on three of them and nothing on the rest — the real shape of
 * the landed column.
 *
 * THE THREE ARE RESIDUES WITH BOTH BACKBONE ANGLES, and that is the fixture
 * matching the data rather than dodging a case: `paintOf` paints the file's own
 * no-angle absence AHEAD of the bound column's, and on this entry the four
 * residues with no angle are the four chain termini (A:1, A:96, B:1, B:89) —
 * none of which is in the 18-residue cover the model is ever served, so a
 * ranked residue with no angle cannot arise here. The precedence itself is
 * pinned by its own test below.
 */
const PLACED: readonly Row[] = TABLES.residues.filter((row) => row.phi !== null && row.psi !== null) as readonly Row[];
const RANKED_KEYS: readonly string[] = PLACED.slice(0, 3).map((row) => String(row[RESIDUE_KEY]));
const RANKED_ROWS: readonly Row[] = TABLES.residues.map((row) => {
  const at = RANKED_KEYS.indexOf(String(row[RESIDUE_KEY]));
  return at < 0 ? row : { ...row, [HOTSPOT_RANK_COLUMN]: at + 1 };
}) as readonly Row[];

const dataWith = (residues: readonly Row[]): ProtDeskData => ({
  residues,
  counts: TABLES.counts,
  skipped: TABLES.skipped,
  structure: loadStructure(),
  run: null,
  refusals: { [INTERFACE_VIEW]: 'no column "interface_contacts"', [SURFACE_VIEW]: 'no column "sasa"', [CONSERVATION_VIEW]: 'no column "conservation"' },
  notes: [],
});

/** The cells, built the way the desk builds them. */
function cellsOf(desk: DeskProjection, data: ProtDeskData): ReturnType<typeof useProtCells> {
  let built: ReturnType<typeof useProtCells> = [];
  function Probe(): null {
    built = useProtCells(desk, data);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

const textOf = (node: unknown): string =>
  renderToStaticMarkup(<>{node as ReactElement}</>)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x2014;/g, '—')
    .replace(/\s+/g, ' ');

const NOTHING: RenderSelection = { clauses: new Map(), resolve: 'intersect', selfClauseId: null };

/** A render state for the 3D view over rows, with the colour channel bound where the caller says. */
const stateWith = (rows: readonly RenderRow[], color: string): RenderState =>
  ({ rows, encodings: { color }, selection: NOTHING, hover: null, theme: {}, size: { width: 400, height: 300 }, layers: [], frame: null }) as unknown as RenderState;

// ── 1 · bind, do not paint ──────────────────────────────────────────────────

describe('the rank is BOUND to a declared channel, never painted', () => {
  it('the 3D view’s colour channel ACCEPTS the landed rank — on a real session, as a real act with a commit', async () => {
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, evidence, hotspotSlot());
    const before = await residuesAt(surface.session, surface.tables);
    const answer = await askHotspots({ provider: scriptedHotspotModel({ want: 3 }), judge: scriptedJudge(), model: 'a-test-model', ledger: hotspotLedger(surface.run, before.rows, before.cursor) });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    const landed = await landHotspots(surface, answer);
    expect(landed.materialized).toContain(HOTSPOT_RANK_COLUMN);
    /*
      THROUGH THE VIEW, which is the one cursor the charts are folded at — the
      same law the picks-as-a-selection gesture had to learn in a real browser.
    */
    const view = createSessionView(sessionSource(surface.session), { as: 'user' });
    await view.reencode(STRUCTURE_VIEW, 'color', HOTSPOT_RANK_COLUMN);
    const over = await surface.session.overview();
    const encodings = over.encodings as Readonly<Record<string, Readonly<Record<string, string>>>> | undefined;
    expect(encodings?.[STRUCTURE_VIEW]?.['color']).toBe(HOTSPOT_RANK_COLUMN);
    // AND IT IS AN ACT ON THE LOG: a rebind is a commit like every other
    // gesture on this desk, not a flag the page keeps
    expect(surface.session.cursor()).not.toBe(landed.commit);
    // and back again, so the control's other direction is a real act too
    await view.reencode(STRUCTURE_VIEW, 'color', 'chain');
    const back = await surface.session.overview();
    expect((back.encodings as Readonly<Record<string, Readonly<Record<string, string>>>>)[STRUCTURE_VIEW]?.['color']).toBe('chain');
  });

  it('and it was REFUSED until the column was declared — the sentence the declaration answers', async () => {
    /*
      THE MEASUREMENT BEHIND `src/prot/def.ts` · `RANK_DECLARED`.

      The structure view's colour takes a column with distinct values, and the
      engine reads a landed `int` as a magnitude. Undeclared, the rebind was
      refused BY NAME — *hotspot_rank is not one* — which is why the fix is a
      declaration of what the column IS and never a widened house rule. This
      asserts the rule is still the one in force, and that the declared rank is
      the thing that satisfies it.
    */
    expect(STRUCTURE_COLOR_RULE).toContain('takes a column with distinct values');
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, evidence, hotspotSlot());
    // A COLUMN NO ACT HAS LANDED IS NOT BINDABLE EITHER — the same door, one
    // step earlier, and the page's own control is only offered with a ranking
    const early = await surface.session.dispatch({
      verb: 'reencode',
      viewId: STRUCTURE_VIEW,
      channel: 'color',
      field: HOTSPOT_RANK_COLUMN,
      cause: { requestedBy: 'user', computedBy: 'system', intent: 'bind the rank before the stage that lands it has run' },
    } as never);
    expect(early.ok).toBe(false);
  });

  it('the control is named for the BINDING and counts the absence, both ways', () => {
    const on = paintLabelOf(false, 6, 179);
    expect(on).toContain('colour the 3D structure by the model’s rank');
    expect(on).toContain('6 ranked');
    // NEVER "the other 179 are ranked last"
    expect(on).toContain('179 shown as absent rather than as a rank of their own');
    expect(paintLabelOf(true, 6, 179)).toContain('by chain again');
  });
});

// ── 2 · absence ─────────────────────────────────────────────────────────────

describe('ABSENCE IS THE POINT — the legend says the word, and it is never a rank', () => {
  it('a residue with no value in the bound column gets its OWN bucket, and not a palette hue', () => {
    const rows = RANKED_ROWS as readonly RenderRow[];
    const buckets = paintOf(stateWith(rows, HOTSPOT_RANK_COLUMN));
    const absent = buckets.find((bucket) => bucket.word === 'absent');
    expect(absent).toBeDefined();
    /*
      THE DEFECT THIS FIXES, measured: the fold read the bound value as
      `String(row[field])`, so a row with no value landed in a bucket named
      `"undefined"` with a palette hue of its own — beside the real ranks and
      indistinguishable from one.
    */
    expect(buckets.map((bucket) => bucket.value)).not.toContain('undefined');
    expect(buckets.map((bucket) => bucket.value)).not.toContain('null');
    // and the ranks themselves are three buckets of one residue each
    const ranks = buckets.filter((bucket) => bucket.word === 'kept');
    expect(ranks.map((bucket) => bucket.value).sort()).toEqual(['1', '2', '3']);
    expect(ranks.every((bucket) => bucket.residues.length === 1)).toBe(true);
    // every residue is in exactly one bucket, and the absent one holds the rest
    // (four residues have no backbone angle, which wins — see `paintOf`)
    const painted = buckets.reduce((n, bucket) => n + bucket.residues.length, 0);
    expect(painted).toBe(rows.length);
    expect(absent!.residues.length).toBe(rows.length - 3 - buckets.find((bucket) => bucket.word === 'no-angle')!.residues.length);
  });

  it('the absence colour is NOT on the ranks’ own palette — so it can never read as "ranked last"', () => {
    expect(VALUE_PALETTE).not.toContain(PAINT_COLOR.absent);
    // nor is it either of the other two greys, which mean different things
    expect(PAINT_COLOR.absent).not.toBe(PAINT_COLOR.dropped);
    expect(PAINT_COLOR.absent).not.toBe(PAINT_COLOR.kept);
  });

  it('the WORD is `absent`, and the meaning says what it is not', () => {
    expect(PAINT_WORDS).toContain('absent');
    expect(PAINT_MEANING.absent).toContain('absent in the bound column');
    expect(PAINT_MEANING.absent).toContain('not a zero and not a last place');
  });

  it('the viewer’s own status line COUNTS the absence, so it is said even where a brush has painted it something else', () => {
    const said = saidOf(paintOf(stateWith(RANKED_ROWS as readonly RenderRow[], HOTSPOT_RANK_COLUMN)), 'drawing');
    expect(said).toContain('absent in the bound column');
    expect(said).toMatch(/\d+ absent in the bound column/);
  });

  it('the legend beside the picture names it, out of the SAME constants the paint uses', () => {
    const structure = cellsOf(quietDesk({ bound: (_a, channel, fallback) => (channel === 'color' ? HOTSPOT_RANK_COLUMN : fallback) }), dataWith(RANKED_ROWS)).find((cell) => cell.id === STRUCTURE_VIEW)!;
    const caption = textOf(structure.caption);
    expect(caption).toContain(PAINT_MEANING.absent);
  });

  it('and the legend DROPS the word where the picture has no absence — a legend may not name a colour the picture does not contain', () => {
    // bound to `chain`, which every residue has
    const byChain = cellsOf(quietDesk(), dataWith(RANKED_ROWS)).find((cell) => cell.id === STRUCTURE_VIEW)!;
    expect(textOf(byChain.caption)).not.toContain(PAINT_MEANING.absent);
    // and bound to the rank over rows where every residue HAS one
    const allRanked = TABLES.residues.map((row, at) => ({ ...row, [HOTSPOT_RANK_COLUMN]: at + 1 })) as readonly Row[];
    const full = cellsOf(quietDesk({ bound: (_a, channel, fallback) => (channel === 'color' ? HOTSPOT_RANK_COLUMN : fallback) }), dataWith(allRanked)).find((cell) => cell.id === STRUCTURE_VIEW)!;
    expect(textOf(full.caption)).not.toContain(PAINT_MEANING.absent);
    // the other four words are named in both, because the picture can contain them
    for (const said of [PAINT_MEANING.lit, PAINT_MEANING.dropped, PAINT_MEANING['no-angle']]) expect(textOf(byChain.caption)).toContain(said);
  });

  /**
   * NAMED, NOT FIXED, AND MEASURED — the file's own no-angle absence is painted
   * AHEAD of the bound column's.
   *
   * `no-angle` is a standing annotation rather than a statement about the
   * colour channel: those residues are absent from the Ramachandran plot
   * entirely, so the 3D view is the only place a reader can see them
   * (`web/src/protCells.tsx`, silence one). Keeping it first means a residue
   * that is both ranked and missing an angle would be painted for the angle.
   *
   * On the committed entry that cannot happen, and the number is why it is left
   * alone: the four residues with no angle are the four CHAIN TERMINI and not
   * one of them is in the 18-residue cover the model is ever served, so no
   * ranked residue has a missing angle. Both captions count both absences
   * either way.
   */
  it('the file’s own no-angle absence is painted ahead of the bound column’s — and on this entry no ranked residue has one', () => {
    const noAngle = TABLES.residues.filter((row) => row.phi === null || row.psi === null);
    expect(noAngle.map((row) => row.residue_key)).toEqual(['A:1', 'A:96', 'B:1', 'B:89']);
    // the cover the model is served, off the column the interaction act lands ABSENT
    expect(noAngle.every((row) => !RANKED_KEYS.includes(row.residue_key))).toBe(true);
    // and the precedence, pinned: a residue with a rank AND no angle is painted
    // for the angle
    const both: readonly RenderRow[] = [{ residue_key: 'A:1', chain: 'A', resnum: 1, phi: null, psi: null, [HOTSPOT_RANK_COLUMN]: 1 }] as unknown as readonly RenderRow[];
    expect(paintOf(stateWith(both, HOTSPOT_RANK_COLUMN)).find((bucket) => bucket.residues.length > 0)!.word).toBe('no-angle');
  });

  it('and NOTHING CHANGES for a frame whose bound column has no absence — the bucket is simply empty', () => {
    const buckets = paintOf(stateWith(TABLES.residues as readonly RenderRow[], 'chain'));
    expect(buckets.find((bucket) => bucket.word === 'absent')!.residues).toEqual([]);
    // the chains are still the two buckets they were
    expect(buckets.filter((bucket) => bucket.word === 'kept').map((bucket) => bucket.value).sort()).toEqual(['A', 'B']);
    // and the status line does not mention an absence that is not there
    expect(saidOf(buckets, 'drawing')).not.toContain('absent in the bound column');
  });
});

// ── 3 · the register ────────────────────────────────────────────────────────

describe('THE REGISTER — the viewer’s caption carries the card’s words while the rank is bound, and not otherwise', () => {
  /** The caption, with the colour channel bound where the caller says. */
  const captionWith = (color: string, rows: readonly Row[] = RANKED_ROWS): string => {
    const desk = quietDesk({ bound: (_address, channel, fallback) => (channel === 'color' ? color : fallback) });
    return textOf(cellsOf(desk, dataWith(rows)).find((cell) => cell.id === STRUCTURE_VIEW)!.caption);
  };

  it('says it IS a recommendation, in the words the card uses, while the channel carries the rank', () => {
    const said = captionWith(HOTSPOT_RANK_COLUMN);
    // THE CARD'S OWN WORDS, from the one module that owns them
    expect(said.toLowerCase()).toContain(HOTSPOT_TAG.toLowerCase());
    expect(said).toContain(HOTSPOT_RANK_COLUMN);
    // and it counts the residues the column says nothing about, in the same breath
    expect(said).toContain('carry NO rank at all and are painted in the absence colour');
    expect(said).toContain('which is not a low rank and not a last place');
  });

  it('and says NOTHING of the kind when the channel is bound to the file’s own label', () => {
    const said = captionWith('chain');
    expect(said.toLowerCase()).not.toContain(HOTSPOT_TAG.toLowerCase());
    expect(said).not.toContain('came from a model');
    // the rest of the caption is unchanged — the counts, the silences, the file
    expect(said).toContain('residues in 2 chains');
    expect(said).toContain('the absence colour');
  });

  it('the rule follows the RECORD and not a press: the caption is right for a bound channel over rows with no rank at all', () => {
    // a cursor behind the ranking's own commit: the channel is still bound, and
    // every residue is absent in it
    const said = captionWith(HOTSPOT_RANK_COLUMN, TABLES.residues as readonly Row[]);
    expect(said.toLowerCase()).toContain(HOTSPOT_TAG.toLowerCase());
    expect(said).toContain(`${TABLES.residues.length.toLocaleString('en-US')} of the residues drawn here carry NO rank`);
  });
});

// ── 4 · everything stays clickable ──────────────────────────────────────────

describe('EVERYTHING IN THE VIEWER STAYS CLICKABLE — the picks are marked, and the structure stays a structure', () => {
  it('the caption says so where a reader would expect the opposite', () => {
    const desk = quietDesk({ bound: (_a, channel, fallback) => (channel === 'color' ? HOTSPOT_RANK_COLUMN : fallback) });
    const said = textOf(cellsOf(desk, dataWith(RANKED_ROWS)).find((cell) => cell.id === STRUCTURE_VIEW)!.caption);
    expect(said).toContain('every residue in this picture is still clickable, ranked or not');
    expect(said).toContain('the model did NOT pick');
  });

  it('a click on an UNRANKED residue emits the same point as a click on a ranked one — the gesture is not narrowed', () => {
    const ranked = RANKED_ROWS[0]!;
    const unranked = RANKED_ROWS[100]!;
    expect(unranked[HOTSPOT_RANK_COLUMN]).toBe(undefined);
    const a = pointOf({ chain: String(ranked['chain']), resnum: Number(ranked['resnum']) }, RESIDUE_KEY);
    const b = pointOf({ chain: String(unranked['chain']), resnum: Number(unranked['resnum']) }, RESIDUE_KEY);
    // the same SHAPE of emission, at the same field: what differs is the value
    expect(b.encoding).toEqual(a.encoding);
    expect(b.rawValue).not.toEqual(a.rawValue);
    expect(b.rawValue).toBe(`${String(unranked['chain'])}:${String(unranked['resnum'])}`);
  });

  it('and an unranked residue really does narrow the rest of the desk — on a real session, through the view', async () => {
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, evidence, hotspotSlot());
    const before = await residuesAt(surface.session, surface.tables);
    const answer = await askHotspots({ provider: scriptedHotspotModel({ want: 3 }), judge: scriptedJudge(), model: 'a-test-model', ledger: hotspotLedger(surface.run, before.rows, before.cursor) });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    await landHotspots(surface, answer);
    const after = await residuesAt(surface.session, surface.tables);
    const unranked = after.rows.find((row) => row[HOTSPOT_RANK_COLUMN] === null || row[HOTSPOT_RANK_COLUMN] === undefined)!;
    const key = String(unranked[RESIDUE_KEY]);
    expect(answer.picks.map((pick) => pick.residue)).not.toContain(key);
    const view = createSessionView(sessionSource(surface.session), { as: 'user' });
    await view.emit(STRUCTURE_VIEW, { rawValue: key, encoding: { kind: 'point', field: RESIDUE_KEY } }, `pick the residue at ${key}, which the model did not rank`);
    const elsewhere = await surface.session.viewQuery({ table: RESIDUES_TABLE, viewId: RAMA_VIEW, limit: 500 });
    expect(elsewhere.ok).toBe(true);
    if (!elsewhere.ok) return;
    expect(elsewhere.rows.map((row) => String(row[RESIDUE_KEY]))).toEqual([key]);
  });
});

// ── 5 · the stepper's own press, which the binding is what makes work ───────

/**
 * CLICKING STAGE 5 IN THE STEPPER FOCUSED NOTHING, and the cause is one
 * intersection.
 *
 * `web/src/protStages.ts · chartsOfStage` derives which pictures a stage owns
 * by intersecting WHAT ITS ACTS LANDED with WHAT EACH VIEW BINDS, and it has no
 * fallback by design: the layout follows it, and a card hard-coded as the big
 * one is what it exists to prevent. Stage 5 lands three columns, NO VIEW bound
 * any of them, and stage 5 is nobody's receipt — so the intersection was empty,
 * the layout had nothing to promote, and the press died quietly. The author's
 * words: *"clicking on the cursor stage nothing happens."*
 *
 * **Binding the rank is what fixes it**, and that is worth pinning here rather
 * than only where the colours are: one binding, two symptoms.
 */
describe('a press on stage 5 promotes the view bound to the rank — one binding, two symptoms', () => {
  const stageFive = (materialized: readonly string[]): Parameters<typeof chartsOfStage>[0] => ({
    number: 5,
    stage: 'hotspots',
    label: 'Which residues a model would call hot',
    name: 'Hot Spot Prediction',
    state: 'landed',
    blockedBy: null,
    landsAtRoot: false,
    subtitle: 'landed',
    detail: null,
    acts: [{ stage: 'hotspots', act: 'residueHotspots', commit: 's5', refusal: null, materialized }],
    declared: 1,
    commit: 's5',
    materialized,
  });
  const LANDED = [HOTSPOT_RANK_COLUMN, 'hotspot_cites', 'hotspot_reason'];
  /** Every column every act landed — the right side of the parse's own intersection. */
  const ACT_COLUMNS = new Set([...LANDED, 'sasa', 'conservation', 'interface_contacts']);

  it('with the rank BOUND, the press has the 3D view to promote', () => {
    const shown = { [STRUCTURE_VIEW]: { color: HOTSPOT_RANK_COLUMN }, [RAMA_VIEW]: { x: 'phi', y: 'psi' } };
    expect(chartsOfStage(stageFive(LANDED), shown, ACT_COLUMNS, [stageFive(LANDED)])).toEqual([STRUCTURE_VIEW]);
  });

  it('with it UNBOUND the answer is EMPTY — which is a true answer and used to be a silent one', () => {
    const shown = { [STRUCTURE_VIEW]: { color: 'chain' }, [RAMA_VIEW]: { x: 'phi', y: 'psi' } };
    expect(chartsOfStage(stageFive(LANDED), shown, ACT_COLUMNS, [stageFive(LANDED)])).toEqual([]);
    /*
      AND THE PRESS SAYS SO, naming the real reason: which columns the stage
      landed, and that no picture here reads them. A reader learns a FACT — the
      rank is in the data space and nothing is drawn from it — rather than
      meeting an apology, and never a fallback view: promoting an arbitrary card
      because the honest answer is *none* would be the layout guessing.
    */
    const said = emptyFocusSaid(stageFive(LANDED), []);
    expect(said).toContain('the cursor moved to stage 5, Hot Spot Prediction');
    expect(said).toContain(HOTSPOT_RANK_COLUMN);
    expect(said).toContain('no picture on this desk is bound to any of them');
    expect(said).toContain('the Sheet shows them');
  });

  it('and it says NOTHING where the stage does own a picture — a press that moved the layout has nothing to explain', () => {
    expect(emptyFocusSaid(stageFive(LANDED), [STRUCTURE_VIEW])).toBe(null);
  });

  it('a stage that landed NO COLUMN AT ALL is a different fact, and says a different thing', () => {
    /*
      `stage.commit` being null is handled one branch earlier (the press moves
      the FOCUS and not the cursor). This is the third case: a stage that landed
      a commit and no column — the cursor moved, and there was never a column
      for a picture to bind. Two facts, two sentences, and a reader can tell
      them apart.
    */
    const said = emptyFocusSaid(stageFive([]), []);
    expect(said).toContain('landed no column into the data space');
    expect(said).not.toContain(HOTSPOT_RANK_COLUMN);
  });
});

// ── 6 · the retry, on a real session ───────────────────────────────────────

/**
 * THE RECORD MUST SURVIVE THE RETRY — the one law the whole control is built
 * around.
 *
 * A page reload re-runs stages 1 to 4 and mints a fresh log, which destroys the
 * record the ranking is pre-registered against: **you cannot retry your way to
 * a cleaner history**, and that discipline is the whole reason stage 5 lands a
 * commit before anything checks it. So a retry re-asks on the LIVE session,
 * lands its own act, and the earlier attempt stays readable.
 */
describe('a retry re-asks on the live session and keeps the first attempt on the record', () => {
  it('two asks, two acts, two commits — and the first is still on the log after the second', async () => {
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    const surface = await openProtSurfaceAsync(loadStructure(), undefined, evidence, hotspotSlot());
    const rows = await residuesAt(surface.session, surface.tables);
    /*
      THE SAME LEDGER, ASKED TWICE. That is the point of keeping it on the page:
      stage 5 is asked once from the rows at the END OF THE RUN, and re-folding
      it after a retry would be a different question — a reader's own selection
      has moved the cursor by then (`src/prot/hotspots.ts` ·
      `notTheEndOfTheRun`).
    */
    const ledger = hotspotLedger(surface.run, rows.rows, rows.cursor);
    const first = await askHotspots({ provider: scriptedHotspotModel({ want: 2 }), judge: scriptedJudge(), model: 'a-test-model', ledger });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const one = await landHotspots(surface, first);
    expect(one.commit).not.toBe(null);

    const second = await askHotspots({ provider: scriptedHotspotModel({ want: 3 }), judge: scriptedJudge(), model: 'a-test-model', ledger });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const two = await landHotspots(surface, second);
    expect(two.commit).not.toBe(null);
    // TWO ENTRIES, NEITHER OVERWRITING THE OTHER
    expect(two.commit).not.toBe(one.commit);
    // THE SESSION'S OWN DOOR for the log, `'anywhere'` scope — the same one the
    // desk's record drawer is fed from (`vizfootprint-ui` · `sessionSource`)
    const commits = surface.session.commits('anywhere').map((commit) => commit.id);
    expect(commits, 'the first attempt\u2019s commit is gone from the log').toContain(one.commit);
    expect(commits).toContain(two.commit);
  });
});
