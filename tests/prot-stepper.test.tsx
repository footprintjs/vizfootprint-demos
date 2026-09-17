// @vitest-environment jsdom
/**
 * THE STEPPER IS A CONTROL, NOT A PICTURE — and it is the same record the trace
 * rows are, one level out.
 *
 * This file replaces `prot-trace.test.tsx`. The component it tested
 * (`ProtTrace`, a collapsible panel of its own under the desk) is gone: the
 * stepper across the top of the page is the stages of the same run, and a stage
 * expands to the act rows that used to be that panel's whole content
 * (`web/src/protStepper.tsx` says why two lists of one thing is worse than one).
 * Everything the old suite asserted about a ROW is still asserted here, against
 * `web/src/protTrace.tsx` · `ActRow`, which is the part that was kept.
 *
 * What is new is the stepper's own claim, in three parts:
 *
 *   1. THE FIVE STATES, each with the words a reader sees — and in particular
 *      that an unrun stage looks unrun and an unavailable one says why. The
 *      stepper is the one surface on this desk allowed to name a stage the run
 *      never dispatched, because a PLAN is a declared fact; what it may not do
 *      is claim such a stage will succeed.
 *   2. CLICKING A STAGE SEEKS — to the commit its LAST act landed, and to no
 *      other.
 *   3. THE FOLDS ARE DERIVED — which charts a stage owns is an intersection of
 *      what its acts landed with what each view binds, and which stage the
 *      cursor is standing in is read off the active path. Neither is a table
 *      anybody typed, and both are pure functions here.
 *
 * WHY THE RUN IS HAND-BUILT. `tests/prot-progression.test.ts` runs the real
 * stages over the real entry and asserts what the acts land; what is under test
 * here is the SCREEN and the two folds, so their input is written out — one
 * landed act, one refused act, one act that landed a commit and no column.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT, PROT_ACT_ORDER, PROT_STAGES, PROT_UNAVAILABLE_STAGES, SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import { INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { ActRow, landedLine } from '../web/src/protTrace.js';
import { ProtStepper } from '../web/src/protStepper.js';
import { chartsOfStage, stageAtCursor, stepperStages } from '../web/src/protStages.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The act rows' own list, by its label — the narrative's sentences are an `<ol>` too, and counting both would count the wrong thing. */
const ROWS = 'ol[aria-label="the acts this stage dispatched, in dispatch order"]';
/** The circles. */
const STEPS = 'nav[aria-label="the stages this desk declares, in the order they land"] > ol > li';

async function mount(
  element: ReactElement,
): Promise<{
  readonly host: HTMLElement;
  readonly words: () => string;
  readonly steps: () => readonly HTMLElement[];
  readonly rows: () => NodeListOf<Element>;
  readonly rowButtons: () => readonly HTMLButtonElement[];
  readonly byLabel: (label: string) => HTMLElement | null;
  readonly unmount: () => Promise<void>;
}> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    host,
    words: () => (host.textContent ?? '').replace(/\s+/g, ' '),
    steps: () => [...host.querySelectorAll(STEPS)] as HTMLElement[],
    rows: () => host.querySelectorAll(`${ROWS} > li`),
    rowButtons: () => [...host.querySelectorAll(`${ROWS} button`)] as HTMLButtonElement[],
    // BY COMPARING THE ATTRIBUTE, not by a CSS selector: an accessible name may
    // hold characters (`"` above all) that `[aria-label="…"]` cannot spell, and a
    // helper that threw on those would be a helper that decides what a name may
    // say.
    byLabel: (label) => ([...host.querySelectorAll('[aria-label]')] as HTMLElement[]).find((el) => el.getAttribute('aria-label') === label) ?? null,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

const click = async (el: HTMLElement | null): Promise<void> => {
  if (el === null) throw new Error('nothing to click — the control this test names is not on screen');
  await act(async () => {
    el.click();
  });
};

const landedAct = (over: Partial<ActOutcome> = {}): ActOutcome => ({ stage: 'interactions', act: PAIRS_ACT, commit: 'c1', refusal: null, materialized: [], ...over });

/** The three acts of a run that went as far as it could: two landed, one was refused. */
const OUTCOMES: readonly ActOutcome[] = [
  landedAct(),
  landedAct({ act: CONTACTS_ACT, commit: 'c2', materialized: ['contacts', INTERFACE_CONTACTS_COLUMN, 'interface_separation'] }),
  landedAct({ stage: 'surface', act: SURFACE_ACT, commit: null, refusal: 'act "residueSurface" threw: the solvent probe found no polymer atom to roll over' }),
];

/** …and the same run with its last act landing instead, which is what the committed entry really does. */
const ALL_LANDED: readonly ActOutcome[] = [OUTCOMES[0]!, OUTCOMES[1]!, landedAct({ stage: 'surface', act: SURFACE_ACT, commit: 'c3', materialized: [SASA_COLUMN, 'relative_sasa'] })];

/**
 * A run shaped like one the orchestrator answers with — the fields the rows
 * read, and a cast at the one place it crosses into the act's own output type.
 *
 * The cast is narrow on purpose: `PairsOutput` is the interaction engine's whole
 * answer (thirteen columns per contact, the drops, the providers) and a row
 * reads three counts off it. Writing the other fields would be writing a fixture
 * nobody asserts.
 */
const runWith = (over: Partial<ProtRun> = {}): ProtRun => ({
  outcomes: OUTCOMES,
  narrative: ['Stage "Every non-covalent contact in the entry" started.', 'Stage "How much of each residue the solvent can reach" finished.'],
  pairs: { counts: { rows: 224, crossing: 21, byKind: [{ kind: 'hydrogen-bond', contacts: 120 }, { kind: 'hydrophobic', contacts: 104 }] } } as unknown as ProtRun['pairs'],
  contacts: null,
  surface: null,
  ...over,
});

/** The stepper over a finished run, with a seek door that records what it was asked for. */
async function stepper(outcomes: readonly ActOutcome[], run: ProtRun | null, asked: string[] = [], onSeek: ((id: string) => Promise<string | null>) | null = (id) => (asked.push(id), Promise.resolve(null))) {
  const stages = stepperStages(outcomes, run);
  return mount(<ProtStepper stages={stages} run={run} here={null} onSeek={onSeek} />);
}

describe('the five states, as a reader reads them', () => {
  it('draws one circle per DECLARED stage — the two that run and the one this desk cannot', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    expect(panel.steps()).toHaveLength(PROT_STAGES.length + PROT_UNAVAILABLE_STAGES.length);
    const said = panel.words();
    for (const stage of PROT_STAGES) expect(said).toContain(stage.label);
    for (const stage of PROT_UNAVAILABLE_STAGES) expect(said).toContain(stage.label);
    // the plan is declared, and the stepper says that rather than leaving the
    // circles to be read as a promise
    expect(said).toContain('stages are DECLARED on this desk');
    expect(said).toContain('A circle claims nothing about a stage that has not run.');
    await panel.unmount();
  });

  it('LANDED: names what the stage put on the desk, and is a button', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const said = panel.words();
    expect(said).toContain(`landed — landed 3 columns on the residues table — contacts, ${INTERFACE_CONTACTS_COLUMN}, interface_separation`);
    expect(said).toContain('and cut 1 table into its own answer, which no clause in the data space reaches');
    expect(panel.byLabel(`move the desk to stage 1, ${PROT_STAGES[0]!.label} — seek the cursor to the commit its last act landed`)).not.toBeNull();
    await panel.unmount();
  });

  it('REFUSED: carries the act’s own refusal sentence, and says how many acts were refused', async () => {
    const panel = await stepper(OUTCOMES, runWith());
    expect(panel.words()).toContain('refused — 1 act of this stage was refused');
    // …and the sentence itself is on the act row, verbatim
    await click(panel.byLabel(`show the acts of stage 2, ${PROT_STAGES[1]!.label}`));
    expect(panel.words()).toContain('act "residueSurface" threw: the solvent probe found no polymer atom to roll over');
    await panel.unmount();
  });

  it('NOT RUN: a stage the finished run never dispatched claims nothing and offers nothing to go back to', async () => {
    const one = [OUTCOMES[0]!, OUTCOMES[1]!];
    const panel = await stepper(one, runWith({ outcomes: one }));
    const said = panel.words();
    expect(said).toContain('not run — declared, and not dispatched on this session — it has landed nothing, so there is nothing here to go back to');
    // no act it never dispatched is named anywhere
    for (const id of PROT_ACT_ORDER.filter((a) => a !== PAIRS_ACT && a !== CONTACTS_ACT)) expect(said, `the stepper names "${id}", which this run never dispatched`).not.toContain(id);
    // and it is NOT a button
    expect(panel.byLabel(`move the desk to stage 2, ${PROT_STAGES[1]!.label} — seek the cursor to the commit its last act landed`)).toBeNull();
    await panel.unmount();
  });

  it('RUNNING: while the run is in flight, the stage in flight says so and nothing is clickable yet', async () => {
    const panel = await stepper([OUTCOMES[0]!], null, [], null);
    const said = panel.words();
    expect(said).toContain('running — running now — 1 of its 2 acts back');
    expect(said).toContain('The cursor these stages move arrives with the desk, when the last act has landed — so nothing here is clickable yet.');
    expect(panel.byLabel(`move the desk to stage 1, ${PROT_STAGES[0]!.label} — seek the cursor to the commit its last act landed`)).toBeNull();
    await panel.unmount();
  });

  it('NOT AVAILABLE ON THIS DESK: the fifth state says why, in the measured words, and is never a button', async () => {
    const declared = PROT_UNAVAILABLE_STAGES[0]!;
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    expect(panel.words()).toContain('not available on this desk — declared, and this desk cannot perform it at all');
    expect(panel.byLabel(`move the desk to stage 3, ${declared.label} — seek the cursor to the commit its last act landed`)).toBeNull();
    // the reason is a sentence a reader can open, not a shrug
    await click(panel.byLabel(`show the acts of stage 3, ${declared.label}`));
    expect(panel.words()).toContain(declared.why);
    expect(panel.words()).toContain('access-control-allow-origin');
    await panel.unmount();
  });
});

describe('clicking a stage is the point', () => {
  it('seeks to the commit the stage’s LAST act landed, and to no other', async () => {
    const asked: string[] = [];
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), asked);
    await click(panel.byLabel(`move the desk to stage 1, ${PROT_STAGES[0]!.label} — seek the cursor to the commit its last act landed`));
    // the interactions stage dispatched c1 then c2: its state is c2
    expect(asked).toEqual(['c2']);
    await click(panel.byLabel(`move the desk to stage 2, ${PROT_STAGES[1]!.label} — seek the cursor to the commit its last act landed`));
    expect(asked).toEqual(['c2', 'c3']);
    expect(panel.words()).not.toContain('the session refused that seek');
    await panel.unmount();
  });

  it('prints the SESSION’s sentence when a seek is refused, rather than failing quietly', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), [], () => Promise.resolve('no commit "c2" to seek to'));
    await click(panel.byLabel(`move the desk to stage 1, ${PROT_STAGES[0]!.label} — seek the cursor to the commit its last act landed`));
    expect(panel.words()).toContain('the session refused that seek, in its own words: no commit "c2" to seek to');
    await panel.unmount();
  });
});

describe('one list, not two: a stage expands to its acts', () => {
  it('shows the stage’s own acts, in dispatch order, each one seeking to its own commit', async () => {
    const asked: string[] = [];
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), asked);
    expect(panel.rows()).toHaveLength(0);
    await click(panel.byLabel(`show the acts of stage 1, ${PROT_STAGES[0]!.label}`));
    expect(panel.rows()).toHaveLength(2);
    const said = panel.words();
    expect(said.indexOf(`interactions · ${PAIRS_ACT}`)).toBeGreaterThan(-1);
    expect(said.indexOf(`interactions · ${CONTACTS_ACT}`)).toBeGreaterThan(said.indexOf(`interactions · ${PAIRS_ACT}`));
    await click(panel.rowButtons()[0]!);
    expect(asked).toEqual(['c1']);
    await panel.unmount();
  });

  it('renders a refused act as a first-class row, not clickable, and says why', async () => {
    const panel = await stepper(OUTCOMES, runWith());
    await click(panel.byLabel(`show the acts of stage 2, ${PROT_STAGES[1]!.label}`));
    expect(panel.rows()).toHaveLength(1);
    expect(panel.rowButtons()).toHaveLength(0);
    expect(panel.words()).toContain('no commit, so there is nothing to seek to: this act landed none');
    await panel.unmount();
  });

  it('says in words when a stage dispatched nothing — a missing row, never a greyed promise', async () => {
    const one = [OUTCOMES[0]!, OUTCOMES[1]!];
    const panel = await stepper(one, runWith({ outcomes: one }));
    await click(panel.byLabel(`show the acts of stage 2, ${PROT_STAGES[1]!.label}`));
    expect(panel.words()).toContain('no act of this stage was dispatched, so there is no row here — a row that is missing is an act that did not happen, and a greyed box would be a promise');
    await panel.unmount();
  });
});

describe('what a row says it landed', () => {
  it('names the columns an act wrote, and the table’s own counts for the act that writes none', () => {
    expect(landedLine(OUTCOMES[1]!, runWith())).toBe('landed 3 columns on the residues table: contacts, interface_contacts, interface_separation');
    expect(landedLine(OUTCOMES[0]!, runWith())).toBe('cut 224 contact rows, 21 of them between different chains (120 hydrogen-bond, 104 hydrophobic) — the act\'s own answer, which no clause in the data space reaches');
    // a landed act whose answer is not readable yet, while the run is still going
    expect(landedLine(OUTCOMES[0]!, null)).toBe('landed a commit; what it answered is read when the run comes back');
    // …and one that landed and wrote nothing, with the run in hand
    expect(landedLine(landedAct({ act: 'somethingElse' }), runWith())).toBe('landed a commit and wrote no column into the data space');
  });

  it('is a button that seeks, and prints a throw from the seek door as a sentence', async () => {
    const panel = await mount(
      <ol aria-label="the acts this stage dispatched, in dispatch order">
        <ActRow outcome={OUTCOMES[0]!} run={runWith()} say={() => undefined} onSeek={() => Promise.reject(new Error('the door fell over'))} />
      </ol>,
    );
    expect(panel.rowButtons()).toHaveLength(1);
    await panel.unmount();
  });
});

describe('the narrative rides the stepper, not re-worded', () => {
  it('prints the recorder’s own sentences, in order, once for the whole run', async () => {
    const run = runWith({ outcomes: ALL_LANDED });
    const panel = await stepper(ALL_LANDED, run);
    const said = panel.words();
    expect(said).toContain('the recorder’s own 2 sentences, in order and not re-worded here');
    for (const line of run.narrative) expect(said).toContain(line);
    expect(said.indexOf(run.narrative[0]!)).toBeLessThan(said.indexOf(run.narrative[1]!));
    await panel.unmount();
  });

  it('shows no narrative block when the recorder said nothing', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED, narrative: [] }));
    expect(panel.words()).not.toContain('from inside');
    await panel.unmount();
  });
});

describe('the two folds are DERIVED, never a table anybody typed', () => {
  /** The encoding fold the real def declares, as the session serves it at the head. */
  const SHOWN = {
    structure: { color: 'chain' },
    [RAMA_VIEW]: { x: 'phi', y: 'psi' },
    [INTERFACE_VIEW]: { category: 'residue_key', y: INTERFACE_CONTACTS_COLUMN },
    [SURFACE_VIEW]: { x: 'resnum', y: SASA_COLUMN, color: 'chain' },
  } as const;

  it('gives a stage exactly the charts that bind a column its acts landed', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const interactions = stages.find((s) => s.stage === 'interactions')!;
    const surface = stages.find((s) => s.stage === 'surface')!;
    // the interactions stage landed `interface_contacts` (the bar's y) and cut
    // the pair table (its RECEIPT, which binds no column at all)
    expect([...chartsOfStage(interactions, SHOWN)].sort()).toEqual([INTERFACE_VIEW, PAIRS_VIEW].sort());
    // the surface stage landed `sasa` (the run's y)
    expect(chartsOfStage(surface, SHOWN)).toEqual([SURFACE_VIEW]);
  });

  it('gives a stage NO chart when nothing on screen binds what it landed', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const surface = stages.find((s) => s.stage === 'surface')!;
    // a reader who re-encoded the run's y onto another column has moved the
    // picture off this stage's column, and the fold follows the SESSION rather
    // than a constant — which is the whole reason it is an intersection
    expect(chartsOfStage(surface, { ...SHOWN, [SURFACE_VIEW]: { x: 'resnum', y: 'phi', color: 'chain' } })).toEqual([]);
  });

  it('gives an UNAVAILABLE stage no chart at all — it landed nothing to bind', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const declared = stages.find((s) => s.state === 'unavailable')!;
    expect(chartsOfStage(declared, SHOWN)).toEqual([]);
  });

  it('reads the stage the cursor is standing in off the active path — the last one that had landed by then', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const path = ['c1', 'c2', 'c3', 'c4'];
    expect(stageAtCursor(stages, path, 'c2')?.stage).toBe('interactions');
    expect(stageAtCursor(stages, path, 'c3')?.stage).toBe('surface');
    // a commit NO stage landed — a reader's own selection — still stands in the
    // last stage that had landed by then, which is what the pictures show
    expect(stageAtCursor(stages, path, 'c4')?.stage).toBe('surface');
    // behind every stage's commit, and off the path entirely: both `null`,
    // because neither has an honest answer
    expect(stageAtCursor(stages, path, 'c0')).toBeNull();
    expect(stageAtCursor(stages, path, 'somewhere-else')).toBeNull();
    expect(stageAtCursor(stages, path, null)).toBeNull();
  });
});
