/**
 * THE PROGRESSION — the screen un-builds because the log does.
 *
 * This is the packet's whole claim, walked once over a real session:
 *
 *   1. build the surface with its stages UNRUN. Two charts are declared, and
 *      the library refuses a gesture at each of them IN ITS OWN WORDS, naming
 *      the column it cannot read. The cell prints that sentence and draws
 *      nothing.
 *   2. run the orchestrator. Stage one lands two commits and the interface bar
 *      draws; stage two lands one more and the surface run draws. The commit
 *      count goes up by exactly what each stage dispatched — and the acts are
 *      in the order the stages are, which is the chart's guarantee rather than
 *      a convention.
 *   3. SEEK THE CURSOR BACK one commit and the surface chart is refused again —
 *      in the same words, which is the assertion this whole packet exists for.
 *      Seek back past stage one as well and the bar goes with it.
 *
 * Nothing here stubs the loop. The refusals are the session's own (the same
 * `needs-column` gap rows its ledger holds), the commits are the ones
 * `declareAnalysis` landed, and the cells are the real ones, rendered to static
 * markup against the stub projection `tests/prot-cells.test.tsx` establishes —
 * so what is asserted about a caption is what a reader would see.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { createSessionView, sessionSource } from 'vizfootprint-ui';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { CONSERVATION_VIEW, INTERFACE_VIEW, PAIRS_VIEW, RESIDUE_KEY, SURFACE_VIEW } from '../src/prot/def.js';
import { CONSERVATION_ACT, CONSERVATION_BASIS_COLUMN, CONSERVATION_COLUMN, CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT, PROT_ACT_ORDER, PROT_STAGES, RELATIVE_SASA_COLUMN, SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import { openProtSurfaceAsync, openProtSurfaceUnrun, probeTheUnlandedColumns, protSurfaceProblems, residuesAt, type ProtSurface } from '../src/prot/session.js';
import { runProtStages } from '../src/prot/orchestrator.js';
import { loadStructure, readCommittedFile } from '../src/prot/snapshot.js';
import { evidenceFromCommitted } from '../src/prot/conservationEvidence.js';
import { useProtCells, type ProtDeskData } from '../web/src/protCells.js';
import type { Row } from '../web/src/derive.js';

const ARTIFACT = loadStructure();

/**
 * THE CONSERVATION STAGE'S OWN EVIDENCE, off the files this repository
 * committed — read ONCE for the whole suite.
 *
 * It is handed to every door below because a surface opened without it declares
 * the act and lands its refusal, which is honest and is not what the committed
 * example does. The read touches no service at all
 * (`tests/prot-conservation.test.ts` counts the calls and asserts zero); it is
 * five committed files, exactly as the structure file above is one.
 */
const EVIDENCE = await evidenceFromCommitted('1AY7', readCommittedFile);

/** The gesture the bar chart's actor meta advertises: a click on one bar. */
const pickOneContact = (surface: ProtSurface) =>
  surface.session.dispatch({
    verb: 'select',
    viewId: INTERFACE_VIEW,
    field: INTERFACE_CONTACTS_COLUMN,
    value: 1,
    cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick the residues with one contact across the interface' },
  });

/**
 * The gesture the surface run can make — a POINT, which is what it declares.
 *
 * It used to be an INTERVAL here, and that was wrong in a way this suite could
 * not see: a line over a BAND lands slots (a match) or one slot (a point),
 * never a range, so the session refused these for the CAPABILITY and the
 * missing column the gesture exists to name never reached the sentence.
 */
const keepTheBuried = (surface: ProtSurface) =>
  surface.session.dispatch({
    verb: 'select',
    viewId: SURFACE_VIEW,
    field: SASA_COLUMN,
    value: 0,
    cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick the residues the solvent cannot reach at all' },
  });

/** The same, at the conservation run: the columns its family never varies. */
const keepTheConserved = (surface: ProtSurface) =>
  surface.session.dispatch({
    verb: 'select',
    viewId: CONSERVATION_VIEW,
    field: CONSERVATION_COLUMN,
    value: 1,
    cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick the residues their family never varies' },
  });

/** The sentence a dispatch was refused with, or `null` when it landed. */
const refusalOf = (answer: Awaited<ReturnType<typeof pickOneContact>>): string | null => (answer.ok ? null : answer.rejection.detail);

/**
 * A desk with nothing selected and nothing said — the same stub shape
 * `tests/prot-cells.test.tsx` uses, and the only way in from outside: the studio
 * builds its `DeskProjection` internally and exports no hook.
 */
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
  say: () => undefined,
} as unknown as DeskProjection;

/**
 * What one cell of the desk renders to, over a surface's own rows — the caption
 * AND the body.
 *
 * The cells are built from inside a component body, because `useProtCells` uses
 * real hooks: the rule `vizfootprint-studio/desk` · `DeskCharts` states, and the
 * shape `tests/prot-cells.test.tsx` · `cellsOf` established.
 */
function cellMarkup(surface: ProtSurface, viewId: string): string {
  const data: ProtDeskData = {
    residues: (surface.residues.refused === null ? surface.residues.rows : surface.tables.residues) as readonly Row[],
    counts: surface.tables.counts,
    skipped: surface.tables.skipped,
    structure: surface.structure,
    run: surface.run,
    refusals: surface.refusals,
    // the committed entry has nothing to report — see `tests/prot-notes.test.ts`
    notes: [],
  };
  let built: ReturnType<typeof useProtCells> = [];
  function Probe(): null {
    built = useProtCells(QUIET, data);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  const cell = built.find((c) => c.id === viewId);
  expect(cell, `the desk should have a cell for "${viewId}"`).toBeDefined();
  const caption = typeof cell?.caption === 'string' ? cell.caption : renderToStaticMarkup(cell?.caption as ReactElement);
  return `${caption}\n${renderToStaticMarkup(cell!.render({ width: 600, height: 300 }) as ReactElement)}`;
}

describe('before either stage: two declared charts, and the library’s own refusal at each', () => {
  it('refuses a gesture at both charts, naming the column no act has landed', async () => {
    const surface = await openProtSurfaceUnrun(ARTIFACT, EVIDENCE);
    // the session has nothing on it at all — a refused dispatch lands no commit,
    // and nothing else has been dispatched
    expect(surface.session.commits('path')).toHaveLength(0);
    expect(refusalOf(await pickOneContact(surface))).toBe(`no column "${INTERFACE_CONTACTS_COLUMN}" in table "residues"`);
    expect(refusalOf(await keepTheBuried(surface))).toBe(`no column "${SASA_COLUMN}" in table "residues"`);
    // STILL NOTHING ON THE LOG, which is exactly the trace a refusal should
    // leave: the only record of it is the gap ledger
    expect(surface.session.commits('path')).toHaveLength(0);
    expect(surface.session.gaps().map((g) => [g.code, g.detail])).toEqual([
      ['needs-column', `no column "${INTERFACE_CONTACTS_COLUMN}" in table "residues"`],
      ['needs-column', `no column "${SASA_COLUMN}" in table "residues"`],
    ]);
  });

  it('and the two cells PRINT that sentence, verbatim, instead of drawing an empty axis', async () => {
    const surface = await openProtSurfaceUnrun(ARTIFACT, EVIDENCE);
    const refusals = await probeTheUnlandedColumns(surface.session);
    const collected: ProtSurface = { ...surface, refusals };
    for (const [viewId, column] of [
      [INTERFACE_VIEW, INTERFACE_CONTACTS_COLUMN],
      [SURFACE_VIEW, SASA_COLUMN],
    ] as const) {
      const markup = cellMarkup(collected, viewId);
      expect(markup).toContain(`no column &quot;${column}&quot; in table &quot;residues&quot;`);
      expect(markup).toContain('nothing to draw yet');
      // no chart element at all — the cell renders the sentence and no axis
      expect(markup).not.toContain('<svg');
    }
    // and the receipt says the other true thing: its rows are not a column of a
    // table, so there is no refusal to quote — the act simply has not run
    expect(cellMarkup(collected, PAIRS_VIEW)).toContain('the interactions stage has not landed on this session');
  });

  it('a gesture ACCEPTED here would be a fault, and the surface says so rather than swallowing it', async () => {
    const surface = await openProtSurfaceUnrun(ARTIFACT, EVIDENCE);
    const refusals = await probeTheUnlandedColumns(surface.session);
    // both refused, so both sentences are kept
    expect(Object.values(refusals).every((s) => s !== null)).toBe(true);
    // AND THE READING IS TWO-WAY: on a surface whose stages have run, a gesture
    // that came back accepted (`null`) is reported as a problem, because it would
    // mean the column existed before its act
    const pretend: ProtSurface = { ...surface, refusals: { [INTERFACE_VIEW]: null, [SURFACE_VIEW]: refusals[SURFACE_VIEW] ?? null }, run: { outcomes: [], narrative: [], pairs: null, contacts: null, surface: null, conservation: null } };
    expect(protSurfaceProblems(pretend)).toEqual([`the gesture at "${INTERFACE_VIEW}" was ACCEPTED before its stage ran — the column it reads was already there, so this desk's account of its own pipeline is wrong`]);
  });
});

describe('the two stages, landing one at a time', () => {
  it('lands its acts in the stages’ order — two commits for the first stage, one for the second', async () => {
    const surface = await openProtSurfaceUnrun(ARTIFACT, EVIDENCE);
    expect(surface.session.commits('path')).toHaveLength(0);
    // the boot's own order: collect the two refusals, THEN run the stages — so
    // `protSurfaceProblems` can judge both halves (an act refused is a fault, and
    // a gesture accepted before its act is also a fault)
    const refusals = await probeTheUnlandedColumns(surface.session);
    const run = await runProtStages(surface.session);
    expect(protSurfaceProblems({ ...surface, refusals, run })).toEqual([]);
    // ONE COMMIT PER ACT, in the order the three stages dispatch them —
    // conservation first, because the plan publishes it as step 2 and it is the
    // one act that parses no headless structure
    expect(run.outcomes.map((o) => [o.stage, o.act])).toEqual([
      ['conservation', CONSERVATION_ACT],
      ['interactions', PAIRS_ACT],
      ['interactions', CONTACTS_ACT],
      ['surface', SURFACE_ACT],
    ]);
    expect(run.outcomes.map((o) => o.refusal)).toEqual([null, null, null, null]);
    expect(surface.session.commits('path')).toHaveLength(4);
    expect(surface.session.commits('path').map((c) => c.viewId)).toEqual(PROT_ACT_ORDER.map((act) => `analysis:${act}`));
    // THE COUNT PER STAGE, which is what "the screen gains a picture when a stage
    // ends" comes down to: +1, then +2, then +1. The middle one is two rather
    // than one because the pair table cannot carry a chart, so the same evidence
    // has to land again at the residue grain (src/prot/analyses.ts).
    expect(PROT_STAGES.map((s) => s.acts.length)).toEqual([1, 2, 1]);
    // and every act's cause carries the intent the def wrote down — the ledger's
    // sentence and the declaration cannot drift
    for (const [index, commit] of surface.session.commits('path').entries()) {
      expect(commit.cause.intent).toBe(PROT_STAGES.flatMap((s) => s.acts)[index]?.intent);
      expect(commit.cause.computedBy).toBe('system');
    }
  });

  it('lands two columns from the first stage, three from the second and two from the third — and not the pair table, which no act can land', async () => {
    const surface = await openProtSurfaceUnrun(ARTIFACT, EVIDENCE);
    const run = await runProtStages(surface.session);
    expect(run.outcomes.map((o) => [o.act, [...o.materialized]])).toEqual([
      [CONSERVATION_ACT, [CONSERVATION_COLUMN, CONSERVATION_BASIS_COLUMN]],
      // THE TABLE CHANNEL MATERIALIZES NOTHING, and that is the finding: the rows
      // came back in the act's own answer and the data space never saw them
      [PAIRS_ACT, []],
      [CONTACTS_ACT, ['contacts', INTERFACE_CONTACTS_COLUMN, 'interface_separation']],
      [SURFACE_ACT, [SASA_COLUMN, RELATIVE_SASA_COLUMN]],
    ]);
    // the pair rows really are there, in the answer
    expect(run.pairs?.rows).toHaveLength(224);
    expect(run.pairs?.name).toBe('interactions');
    // …and the session still refuses to read that name, at this cursor and at
    // every other: a read of it is not the progression's evidence and cannot be
    const read = await surface.session.viewQuery({ table: 'interactions', limit: 5 });
    expect(read.ok).toBe(false);
    expect(read.ok ? '' : read.rejected).toContain('no table "interactions" here');
    // while the five columns ARE on the residues table now
    const residues = await residuesAt(surface.session, surface.tables);
    expect(residues.refused).toBeNull();
    const row = residues.rows.find((r) => r['residue_key'] === 'A:40');
    expect(row).toMatchObject({ contacts: 6, interface_contacts: 6 });
    expect(typeof row?.[SASA_COLUMN]).toBe('number');
  });

  it('and `why` on each new chart reaches the act that made its column', async () => {
    const surface = await openProtSurfaceAsync(ARTIFACT, undefined, EVIDENCE);
    const path = surface.session.commits('path');
    for (const [viewId, act] of [
      [INTERFACE_VIEW, CONTACTS_ACT],
      [SURFACE_VIEW, SURFACE_ACT],
    ] as const) {
      const why = surface.session.why({ kind: 'chart', viewId });
      const reached = (why as { readonly reached?: readonly { readonly id: string; readonly kind: string }[] }).reached ?? [];
      // the chart's evidence is a DERIVED COLUMN, and the commit it names is the
      // one the act landed — so a reader who asks "where did this picture come
      // from" is answered with the act rather than with the cell that drew it
      const landed = path.find((c) => c.viewId === `analysis:${act}`);
      expect(reached.map((r) => [r.id, r.kind])).toContainEqual([landed?.id, 'derived-column']);
    }
  });

  it('keeps an account of the run in a recorder, one entry per stage', async () => {
    const surface = await openProtSurfaceUnrun(ARTIFACT, EVIDENCE);
    const run = await runProtStages(surface.session);
    // The narrative is the footprintjs recorder's own, collected during the
    // traversal: it names each stage by the label the def gave it, in order. It is
    // the run's account rather than the data's — the rows live on the dashboard's
    // log, and this says what happened.
    const text = run.narrative.join('\n');
    for (const stage of PROT_STAGES) expect(text).toContain(stage.label);
    expect(run.narrative.length).toBeGreaterThanOrEqual(PROT_STAGES.length);
    expect(text.indexOf(PROT_STAGES[0]!.label)).toBeLessThan(text.indexOf(PROT_STAGES[1]!.label));
  });
});

describe('after both stages: the pictures draw, and the cursor takes them away again', () => {
  it('draws both charts, with their counts read off the acts’ own answers', async () => {
    const surface = await openProtSurfaceAsync(ARTIFACT, undefined, EVIDENCE);
    const bar = cellMarkup(surface, INTERFACE_VIEW);
    expect(bar).not.toContain('nothing to draw yet');
    expect(bar).toContain('<svg');
    // the caption's numbers are the act's, never recomputed in the cell
    expect(bar).toContain('21 of the 224 contacts in the entry cross from one chain to another');
    expect(bar).toContain('220 hydrogen bond');
    expect(bar).toContain('317 water-or-hetero-end');
    // WHICH PROVIDERS RAN is on the page, because an absent kind means "nobody
    // asked" and only this line can say so
    expect(bar).toContain('Mol* was asked for cation-pi, halogen-bonds, hydrogen-bonds, metal-coordination, pi-stacking and NOT for hydrophobic, ionic, weak-hydrogen-bonds');

    const run = cellMarkup(surface, SURFACE_VIEW);
    expect(run).not.toContain('nothing to draw yet');
    expect(run).toContain('<svg');
    expect(run).toContain('1.4 Å probe sampled at 92 points per atom');
    expect(run).toContain('17 of the 185 residues have an area of exactly zero');
    // THE CHAINS SHARE THE AXIS, said out loud under the picture it affects —
    // and worded for however many chains the entry has, because this desk now
    // opens any of them (`src/prot/entryNotes.ts`)
    expect(run).toContain('THE CHAINS SHARE THE AXIS — A is numbered 1–96 and B is numbered 1–89');

    // and the receipt draws the pairs, with the finding under it
    const pairs = cellMarkup(surface, PAIRS_VIEW);
    expect(pairs).toContain('224 contacts, as the engine reported them');
    expect(pairs).toContain('THIS TABLE IS NOT IN THE DATA SPACE');
    expect(pairs).toContain('15 of these contacts run through an ALTERNATE LOCATION');
  });

  it('accepts at the head the very gestures it refused before — the same two, word for word', async () => {
    const surface = await openProtSurfaceAsync(ARTIFACT, undefined, EVIDENCE);
    // the sentences the boot collected BEFORE the stages, kept
    expect(surface.refusals[INTERFACE_VIEW]).toBe(`no column "${INTERFACE_CONTACTS_COLUMN}" in table "residues"`);
    expect(surface.refusals[SURFACE_VIEW]).toBe(`no column "${SASA_COLUMN}" in table "residues"`);
    // …and now they land
    expect(refusalOf(await pickOneContact(surface))).toBeNull();
    expect(refusalOf(await keepTheBuried(surface))).toBeNull();
  });

  it('SEEKS BACK ONE COMMIT and the surface chart is refused again, in the same words', async () => {
    const surface = await openProtSurfaceAsync(ARTIFACT, undefined, EVIDENCE);
    const path = surface.session.commits('path');
    expect(path).toHaveLength(4);
    // the cursor moves to the commit the CONTACTS act landed — one before the
    // surface act, named from the END of the path so a new act arriving at the
    // FRONT of the dispatch order cannot silently re-point this assertion.
    // Seeking is navigation, not mutation: the head does not move.
    const back = surface.session.seek(path.at(-2)!.id);
    expect(back.ok).toBe(true);
    expect(surface.session.cursor()).toBe(path.at(-2)!.id);
    expect(surface.session.head).toBe(path.at(-1)!.id);

    // THE ASSERTION THIS PACKET EXISTS FOR: the same gesture, the same sentence.
    expect(refusalOf(await keepTheBuried(surface))).toBe(surface.refusals[SURFACE_VIEW]);
    // …while the stage that HAS landed on this path still answers
    expect(refusalOf(await pickOneContact(surface))).toBeNull();

    // and the table itself has un-built: the surface act's two columns are gone
    // from it and the contacts act's three are not — named from the end of the
    // path for the same reason the seek above is
    surface.session.seek(path.at(-2)!.id);
    const there = await residuesAt(surface.session, surface.tables);
    const columns = Object.keys(there.rows[0] ?? {});
    expect(columns).toContain(INTERFACE_CONTACTS_COLUMN);
    expect(columns).not.toContain(SASA_COLUMN);
    expect(columns).not.toContain(RELATIVE_SASA_COLUMN);

    // AND THE CELL PRINTS THE REFUSAL AGAIN, because the picture is built from
    // those rows: the screen un-builds because the log did.
    const there2: ProtSurface = { ...surface, residues: there };
    expect(cellMarkup(there2, SURFACE_VIEW)).toContain('nothing to draw yet');
    expect(cellMarkup(there2, INTERFACE_VIEW)).not.toContain('nothing to draw yet');
  });

  it('SEEKS BACK TO THE VERY FIRST COMMIT and the two later stages’ charts go with it, while the first stage’s stays', async () => {
    /*
      THE FIRST COMMIT IS THE CONSERVATION ACT'S now, so this cursor is the
      sharpest statement the desk can make: the columns of the stage that HAD
      landed by then are on the table and the columns of the two that had not
      are gone — one cursor, three pictures, and each one drawn or refused by
      what the log really said at that point.
    */
    const surface = await openProtSurfaceAsync(ARTIFACT, undefined, EVIDENCE);
    const path = surface.session.commits('path');
    surface.session.seek(path[0]!.id);
    const there = await residuesAt(surface.session, surface.tables);
    const columns = Object.keys(there.rows[0] ?? {});
    for (const landed of ['contacts', INTERFACE_CONTACTS_COLUMN, 'interface_separation', SASA_COLUMN, RELATIVE_SASA_COLUMN]) expect(columns).not.toContain(landed);
    expect(columns).toEqual([RESIDUE_KEY, 'chain', 'resnum', 'resname', 'ca_x', 'ca_y', 'ca_z', 'phi', 'psi', CONSERVATION_COLUMN, CONSERVATION_BASIS_COLUMN]);
    // both of the LATER stages' gestures refused again, each in its own words
    expect(refusalOf(await pickOneContact(surface))).toBe(surface.refusals[INTERFACE_VIEW]);
    expect(refusalOf(await keepTheBuried(surface))).toBe(surface.refusals[SURFACE_VIEW]);
    // …and the conservation gesture, which was refused at the boot, LANDS here
    expect(refusalOf(await keepTheConserved(surface))).toBeNull();
    // and both of the later cells print their sentence while the first one draws
    const there2: ProtSurface = { ...surface, residues: there };
    for (const viewId of [INTERFACE_VIEW, SURFACE_VIEW]) expect(cellMarkup(there2, viewId)).toContain('nothing to draw yet');
    expect(cellMarkup(there2, CONSERVATION_VIEW)).not.toContain('nothing to draw yet');
  });
});

/**
 * THE SCREEN WATCHES THE RUN FILL — the trace panel is expanded while the
 * stages dispatch, so the outcomes have to arrive DURING the run and not only
 * with it (`src/prot/orchestrator.ts` · `ProtRunWatch`).
 *
 * The session here is a double, and it stands in for exactly one method: the
 * orchestrator calls `declareAnalysis` and nothing else. That is what lets this
 * test assert the INTERLEAVING — dispatch, outcome, dispatch, outcome — which a
 * real run proves too slowly to prove three times and does not show as an
 * order.
 */
describe('the run, as it happens', () => {
  it('offers each act’s outcome the moment it comes back, in dispatch order, before the run answers', async () => {
    const happened: string[] = [];
    let landed = 0;
    const session = {
      declareAnalysis: (act: string) => {
        happened.push(`dispatched ${act}`);
        landed += 1;
        return Promise.resolve({ commit: { id: `c${String(landed)}` }, materialized: ['a-column'], result: { ok: true, output: null } });
      },
      // THE CAST, and its whole justification: `InteractionSession` is the
      // library's live object (providers, engines, a gap ledger) and the
      // orchestrator touches ONE method of it. Standing in for that one method
      // is what makes the interleaving above assertable.
    } as unknown as Parameters<typeof runProtStages>[0];

    const run = await runProtStages(session, { onOutcome: (outcome) => happened.push(`watched ${outcome.act} → ${outcome.commit ?? 'nothing'}`) });

    expect(happened).toEqual([
      `dispatched ${CONSERVATION_ACT}`,
      `watched ${CONSERVATION_ACT} → c1`,
      `dispatched ${PAIRS_ACT}`,
      `watched ${PAIRS_ACT} → c2`,
      `dispatched ${CONTACTS_ACT}`,
      `watched ${CONTACTS_ACT} → c3`,
      `dispatched ${SURFACE_ACT}`,
      `watched ${SURFACE_ACT} → c4`,
    ]);
    // the same rows arrive again on the finished run — one owner, twice delivered
    expect(run.outcomes.map((o) => o.act)).toEqual([...PROT_ACT_ORDER]);
    expect(run.outcomes.map((o) => o.commit)).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('answers exactly today’s run when nobody is watching', async () => {
    const dispatched: string[] = [];
    const session = {
      declareAnalysis: (act: string) => {
        dispatched.push(act);
        return Promise.resolve({ commit: { id: act }, materialized: [], result: { ok: true, output: null } });
      },
    } as unknown as Parameters<typeof runProtStages>[0];
    const run = await runProtStages(session);
    expect(dispatched).toEqual([...PROT_ACT_ORDER]);
    expect(run.outcomes.every((o) => o.refusal === null)).toBe(true);
  });
});

/**
 * THE STEPPER IS A CONTROL FOR THE RECORD — and the cursor it moves is the one
 * the desk reads.
 *
 * `tests/prot-stepper.test.tsx` clicks the stages and the act rows and asserts
 * which commit id each asked for; `tests/prot-cursor.smoke.test.ts` proves in a
 * real browser that the pictures then follow. This is the middle half, without a
 * browser: the page hands the stepper and the charts ONE session view
 * (`web/site/prot/entry.tsx` · `StaticProtDesk`), so a seek through it moves the
 * cursor every picture on this desk is folded at — and a commit that is not on
 * the log comes back as the SESSION's own sentence, which is what the stepper
 * prints.
 */
describe('a row’s seek reaches the cursor the desk is folded at', () => {
  it('moves it to that act’s commit, and refuses an unknown one in the session’s words', async () => {
    const surface = await openProtSurfaceAsync(ARTIFACT, undefined, EVIDENCE);
    const view = createSessionView(sessionSource(surface.session), { as: 'user' });
    await view.refresh();

    const landed = surface.run?.outcomes[0]?.commit ?? null;
    expect(landed).not.toBeNull();
    // the page's own handler, in one line: `view.seek(id)` → `{ ok }` or a sentence
    expect(await view.seek(landed!)).toEqual({ ok: true });
    expect(view.getState().cursor).toBe(landed);

    const refused = await view.seek('no-such-commit');
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.sentence).toContain('no-such-commit');
    // …and NOTHING moved: a refused seek is a sentence, not a jump
    expect(view.getState().cursor).toBe(landed);
  });
});
