// @vitest-environment jsdom
/**
 * THE STEPPER IS A CONTROL, NOT A PICTURE — and now it is the DESIGN's five
 * marks over the code's five states.
 *
 * Three claims, in three layers:
 *
 *   1. THE FIVE MARKS, each as a reader reads it on screen — the mark, the tag
 *      under the name, whether the name is a control, and the one state that
 *      moves. Plus the sixth thing a column can be: the one the cursor is
 *      standing in.
 *   2. PRESSING A LANDED STAGE SEEKS — to the commit its LAST act landed, and
 *      to no other; a refused seek prints the session's own sentence.
 *   3. THE FOLDS ARE DERIVED — which charts a stage owns is an intersection of
 *      what its acts landed with what each view binds, which stage the cursor
 *      is standing in is read off the active path, and the CONNECTORS are a
 *      stated rule rather than a guess. All four are pure functions here.
 *
 * ── WHY THE RUN IS HAND-BUILT ───────────────────────────────────────────────
 * `tests/prot-progression.test.ts` runs the real stages over the real entry and
 * asserts what the acts land; what is under test here is the SCREEN and the
 * folds, so their input is written out — one landed act, one refused act, one
 * act that landed a commit and no column.
 *
 * ── AND THE THREE NAMES THAT ARE A CONTRACT ────────────────────────────────
 * The seek control's accessible name, the expander's and the nav's are asserted
 * through the fold that produces them (`web/src/workbench/steps.ts`), so a
 * rename shows up here as well as in the browser smoke test that finds an act's
 * control by name.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT, PROT_ACT_ORDER, PROT_STAGES, PROT_UNAVAILABLE_STAGES, SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import { INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { ActRow, RunNarrative, landedLine, narrativeTitle } from '../web/src/protTrace.js';
import { StageDetail } from '../web/src/protDesk.js';
import { chartsOfStage, stageAtCursor, stepperStages, type StepperStage } from '../web/src/protStages.js';
import { StageStepper } from '../web/src/workbench/Stepper.js';
import { STEPPER_LABEL, expandLabelOf, seekLabelOf, stepViews, stepperNote } from '../web/src/workbench/steps.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The act rows' own list, by its label — the narrative's sentences are an `<ol>` too, and counting both would count the wrong thing. */
const ROWS = 'ol[aria-label="the acts this stage dispatched, in dispatch order"]';
/** The columns. */
const STEPS = `nav[aria-label="${STEPPER_LABEL}"] > ol > li`;

async function mount(element: ReactElement): Promise<{
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
 */
const runWith = (over: Partial<ProtRun> = {}): ProtRun => ({
  outcomes: OUTCOMES,
  narrative: ['Stage "Every non-covalent contact in the entry" started.', 'Stage "How much of each residue the solvent can reach" finished.'],
  pairs: { counts: { rows: 224, crossing: 21, byKind: [{ kind: 'hydrogen-bond', contacts: 120 }, { kind: 'hydrophobic', contacts: 104 }] } } as unknown as ProtRun['pairs'],
  contacts: null,
  surface: null,
  ...over,
});

/** The stepper over a run, wired exactly as `web/src/protDesk.tsx` wires it. */
async function stepper(
  outcomes: readonly ActOutcome[],
  run: ProtRun | null,
  asked: string[] = [],
  options: { readonly seekable?: boolean; readonly refuseWith?: string | null; readonly here?: string } = {},
) {
  const seekable = options.seekable ?? true;
  const stages = stepperStages(outcomes, run);
  const here = options.here === undefined ? null : (stages.find((s) => s.stage === options.here) ?? null);
  let said: string | null = null;
  const seek = (commitId: string): Promise<string | null> => {
    asked.push(commitId);
    return Promise.resolve(options.refuseWith ?? null);
  };
  const steps = stepViews(stages, here, seekable, (stage: StepperStage) => <StageDetail stage={stage} run={run} onSeek={seek} say={(s) => (said = s)} />);
  const panel = await mount(<StageStepper steps={steps} label={STEPPER_LABEL} note={stepperNote(stages, seekable)} refusedSeek={options.refuseWith ?? null} onSeek={(key) => void seek(stages.find((s) => s.stage === key)?.commit ?? '')} />);
  return { ...panel, stages, said: () => said };
}

/** One column's markup, for the assertions about the mark itself. */
const markOf = (step: HTMLElement): string => step.innerHTML;

describe('the five marks, as a reader reads them', () => {
  it('draws one column per DECLARED stage — the two that run and the one this desk cannot', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    expect(panel.steps()).toHaveLength(PROT_STAGES.length + PROT_UNAVAILABLE_STAGES.length);
    const said = panel.words();
    for (const stage of PROT_STAGES) expect(said).toContain(stage.label);
    for (const stage of PROT_UNAVAILABLE_STAGES) expect(said).toContain(stage.label);
    // the plan is declared, and the stepper says that rather than leaving the
    // marks to be read as a promise
    expect(said).toContain('stages are DECLARED on this desk');
    expect(said).toContain('A circle claims nothing about a stage that has not run.');
    // …and the grid is one column per declared stage, derived from the list
    const grid = panel.host.querySelector('ol')?.getAttribute('style') ?? '';
    expect(grid).toContain(`repeat(${String(PROT_STAGES.length + PROT_UNAVAILABLE_STAGES.length)}, minmax(0, 1fr))`);
    await panel.unmount();
  });

  it('LANDED: the name is a REAL button, underlined, and what the stage put on the desk is one press away', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const stage = panel.stages[0]!;
    const button = panel.byLabel(seekLabelOf(stage));
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('style') ?? '').toContain('text-decoration: underline');
    // the mark is solid accent with the lifted shadow, and carries no tag
    expect(markOf(panel.steps()[0]!)).toContain('var(--pw-accent)');
    expect(panel.words()).not.toContain('landed —');
    // and what it landed IS on the page, behind its own expander
    await click(panel.byLabel(expandLabelOf(stage)));
    expect(panel.words()).toContain(`landed 3 columns on the residues table — contacts, ${INTERFACE_CONTACTS_COLUMN}, interface_separation`);
    expect(panel.words()).toContain('and cut 1 table into its own answer, which no clause in the data space reaches');
    await panel.unmount();
  });

  it('REFUSED: rust, a badge, the word under the name — and the sentence itself, verbatim, one press away', async () => {
    const panel = await stepper(OUTCOMES, runWith());
    const surface = panel.stages[1]!;
    expect(surface.state).toBe('refused');
    const column = markOf(panel.steps()[1]!);
    expect(column).toContain('var(--pw-refuse)');
    // the badge: a hue alone is never a state
    expect(column).toContain('!');
    expect(panel.words()).toContain('refused');
    await click(panel.byLabel(expandLabelOf(surface)));
    expect(panel.words()).toContain('1 act of this stage was refused');
    expect(panel.words()).toContain('act "residueSurface" threw: the solvent probe found no polymer atom to roll over');
    await panel.unmount();
  });

  it('NOT RUN: hollow and dashed, no tag, no control, and nothing to go back to', async () => {
    const one = [OUTCOMES[0]!, OUTCOMES[1]!];
    const panel = await stepper(one, runWith({ outcomes: one }));
    const surface = panel.stages[1]!;
    expect(surface.state).toBe('not-run');
    expect(markOf(panel.steps()[1]!)).toContain('dashed');
    // it is NOT a button
    expect(panel.byLabel(seekLabelOf(surface))).toBeNull();
    // and no act it never dispatched is named anywhere on screen
    const said = panel.words();
    for (const id of PROT_ACT_ORDER.filter((a) => a !== PAIRS_ACT && a !== CONTACTS_ACT)) expect(said, `the stepper names "${id}", which this run never dispatched`).not.toContain(id);
    // what it means is one press away, in the fold's own words
    await click(panel.byLabel(expandLabelOf(surface)));
    expect(panel.words()).toContain('declared, and not dispatched on this session — it has landed nothing, so there is nothing here to go back to');
    await panel.unmount();
  });

  it('RUNNING: the only state that moves, the only one with a progress hairline, and nothing clickable yet', async () => {
    const panel = await stepper([OUTCOMES[0]!], null, [], { seekable: false });
    const interactions = panel.stages[0]!;
    expect(interactions.state).toBe('running');
    const column = markOf(panel.steps()[0]!);
    // the animated arc, and the hairline at the share of its acts that are back
    expect(column).toContain('pw-spin');
    expect(column).toContain('width: 50%');
    // nobody else moves
    expect(markOf(panel.steps()[1]!)).not.toContain('pw-spin');
    expect(panel.words()).toContain('The cursor these stages move arrives with the desk, when the last act has landed — so nothing here is clickable yet.');
    expect(panel.byLabel(seekLabelOf(interactions))).toBeNull();
    await click(panel.byLabel(expandLabelOf(interactions)));
    expect(panel.words()).toContain('running now — 1 of its 2 acts back');
    await panel.unmount();
  });

  it('NOT AVAILABLE HERE: hatched, struck through, tagged, never a button — and the reason is MEASURED', async () => {
    const declared = PROT_UNAVAILABLE_STAGES[0]!;
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const stage = panel.stages[2]!;
    expect(stage.state).toBe('unavailable');
    const column = markOf(panel.steps()[2]!);
    expect(column).toContain('var(--pw-mark-hatch)');
    // the diagonal: it can never be mistaken for a stage that is still working
    expect(column).toContain('var(--pw-strike)');
    expect(panel.words()).toContain('not available here');
    expect(panel.byLabel(seekLabelOf(stage))).toBeNull();
    await click(panel.byLabel(expandLabelOf(stage)));
    expect(panel.words()).toContain(declared.why);
    expect(panel.words()).toContain('access-control-allow-origin');
    expect(panel.words()).toContain('this stage dispatched nothing because it cannot run here at all');
    await panel.unmount();
  });

  it('CURRENT: the column the cursor stands in carries aria-current, a heavier name and the accent bar', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), [], { here: 'surface' });
    const [interactions, surface] = panel.steps();
    expect(surface?.getAttribute('aria-current')).toBe('step');
    expect(interactions?.getAttribute('aria-current')).toBeNull();
    // the name is the control, and it is the one carrying the step
    const button = panel.byLabel(seekLabelOf(panel.stages[1]!));
    expect(button?.getAttribute('aria-current')).toBe('step');
    expect(button?.getAttribute('style') ?? '').toContain('font-weight: 600');
    // the 3px bar across the bottom of its column, and only its column
    expect(markOf(surface!)).toContain('height: 3px');
    expect(markOf(interactions!)).not.toContain('bottom: 0px');
    await panel.unmount();
  });
});

describe('the connectors are a stated rule, not a guess', () => {
  it('is solid between two stages that have run, dashed near up to the last one that ran, and dashed far past it', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const views = stepViews(stages, null, true, () => null);
    // interactions (ran) → surface (ran): solid
    expect(views[0]!.linkAfter).toBe('run');
    expect(views[1]!.linkBefore).toBe('run');
    // surface (ran) → conservation (never runs): the last stage that ran is
    // `surface` at index 1, so the boundary at index 2 is past it
    expect(views[1]!.linkAfter).toBe('far');
    expect(views[2]!.linkBefore).toBe('far');
    // the ends have no connector at all
    expect(views[0]!.linkBefore).toBeNull();
    expect(views[2]!.linkAfter).toBeNull();
  });

  it('dashes NEAR across a stage that did not run but sits before one that did', () => {
    // the interactions stage never ran, the surface stage did — so both
    // boundaries around the gap are "near", because the run reached past it
    const surfaceOnly = [landedAct({ stage: 'surface', act: SURFACE_ACT, commit: 'c3', materialized: [SASA_COLUMN] })];
    const stages = stepperStages(surfaceOnly, runWith({ outcomes: surfaceOnly }));
    const views = stepViews(stages, null, true, () => null);
    expect(stages[0]!.state).toBe('not-run');
    expect(views[0]!.linkAfter).toBe('near');
    expect(views[1]!.linkBefore).toBe('near');
  });
});

describe('pressing a landed stage is the point', () => {
  it('seeks to the commit the stage’s LAST act landed, and to no other', async () => {
    const asked: string[] = [];
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), asked);
    await click(panel.byLabel(seekLabelOf(panel.stages[0]!)));
    // the interactions stage dispatched c1 then c2: its state is c2
    expect(asked).toEqual(['c2']);
    await click(panel.byLabel(seekLabelOf(panel.stages[1]!)));
    expect(asked).toEqual(['c2', 'c3']);
    expect(panel.words()).not.toContain('the session refused that seek');
    await panel.unmount();
  });

  it('prints the SESSION’s sentence when a seek is refused, rather than failing quietly', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), [], { refuseWith: 'no commit "c2" to seek to' });
    expect(panel.words()).toContain('the session refused that seek, in its own words: no commit "c2" to seek to');
    await panel.unmount();
  });
});

describe('one list, not two: a stage expands to its acts', () => {
  it('shows the stage’s own acts, in dispatch order, each one seeking to its own commit', async () => {
    const asked: string[] = [];
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), asked);
    expect(panel.rows()).toHaveLength(0);
    await click(panel.byLabel(expandLabelOf(panel.stages[0]!)));
    expect(panel.rows()).toHaveLength(2);
    const said = panel.words();
    expect(said.indexOf(`interactions · ${PAIRS_ACT}`)).toBeGreaterThan(-1);
    expect(said.indexOf(`interactions · ${CONTACTS_ACT}`)).toBeGreaterThan(said.indexOf(`interactions · ${PAIRS_ACT}`));
    // AND THE NAME THE BROWSER SMOKE TEST FINDS IT BY — unchanged
    expect(panel.byLabel(`seek the cursor to the commit act "${PAIRS_ACT}" landed`)).not.toBeNull();
    await click(panel.rowButtons()[0]!);
    expect(asked).toEqual(['c1']);
    await panel.unmount();
  });

  it('opens one stage at a time, and says so through aria-expanded', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    expect([...panel.host.querySelectorAll('[aria-expanded="false"]')]).toHaveLength(3);
    await click(panel.byLabel(expandLabelOf(panel.stages[0]!)));
    expect(panel.byLabel(expandLabelOf(panel.stages[0]!))?.getAttribute('aria-expanded')).toBe('true');
    await click(panel.byLabel(expandLabelOf(panel.stages[1]!)));
    expect(panel.byLabel(expandLabelOf(panel.stages[0]!))?.getAttribute('aria-expanded')).toBe('false');
    expect(panel.byLabel(expandLabelOf(panel.stages[1]!))?.getAttribute('aria-expanded')).toBe('true');
    await panel.unmount();
  });

  it('renders a refused act as a first-class row, not clickable, and says why', async () => {
    const panel = await stepper(OUTCOMES, runWith());
    await click(panel.byLabel(expandLabelOf(panel.stages[1]!)));
    expect(panel.rows()).toHaveLength(1);
    expect(panel.rowButtons()).toHaveLength(0);
    expect(panel.words()).toContain('no commit, so there is nothing to seek to: this act landed none');
    await panel.unmount();
  });

  it('says in words when a stage dispatched nothing — a missing row, never a greyed promise', async () => {
    const one = [OUTCOMES[0]!, OUTCOMES[1]!];
    const panel = await stepper(one, runWith({ outcomes: one }));
    await click(panel.byLabel(expandLabelOf(panel.stages[1]!)));
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

describe('the recorder’s own account stays whole', () => {
  it('prints every sentence, in order, once for the whole run', async () => {
    const run = runWith({ outcomes: ALL_LANDED });
    const panel = await mount(<RunNarrative run={run} />);
    const said = panel.words();
    for (const line of run.narrative) expect(said).toContain(line);
    expect(said.indexOf(run.narrative[0]!)).toBeLessThan(said.indexOf(run.narrative[1]!));
    await panel.unmount();
  });

  it('hands its TITLE over separately, counted off the recorder, so one disclosure shape can carry it', () => {
    // the list used to draw its own `<details>`; the desk now folds everything
    // through `workbench/Chrome.tsx` · `Disclosure`, so this file supplies the
    // words and the composition supplies the box
    expect(narrativeTitle(runWith({ outcomes: ALL_LANDED }))).toBe('What the run looked like from inside — the recorder’s own 2 sentences, in order and not re-worded here');
  });

  it('shows nothing at all, and offers no control, when the recorder said nothing', async () => {
    expect(narrativeTitle(runWith({ narrative: [] }))).toBeNull();
    expect(narrativeTitle(null)).toBeNull();
    const panel = await mount(<div>{RunNarrative({ run: runWith({ narrative: [] }) })}</div>);
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
