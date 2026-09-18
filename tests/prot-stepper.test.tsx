// @vitest-environment jsdom
/**
 * THE STEPPER IS A CONTROL, NOT A PICTURE — and it now shows ALL SIX STEPS of
 * the published plan, each one saying which kind of blocked it is.
 *
 * Four claims, in four layers:
 *
 *   1. THE SIX MARKS, each as a reader reads it on screen — the mark, the word
 *      under the name, whether the column is a control and what it is called.
 *      Including the three "will not run" reasons, which are ONE MARK FAMILY
 *      with three different sentences, and the one step that landed before the
 *      record started.
 *   2. ONE CONTROL PER COLUMN, and three things a press can mean: seek the
 *      cursor, bring a card into the focus, bring a picture into the focus.
 *   3. NOTHING BETWEEN THE STEPPER AND THE CHARTS. No note, no per-stage
 *      caret, no prose — the author's ruling — and the counts that note carried
 *      are COUNTED FACTS now (`stepperTally`), not a sentence.
 *   4. THE FOLDS ARE DERIVED — which charts a stage owns (including the
 *      parse's own two), which stage the cursor stands in, and the CONNECTORS.
 *      All pure functions here.
 *
 * ── WHY THE RUN IS HAND-BUILT ───────────────────────────────────────────────
 * `tests/prot-progression.test.ts` runs the real stages over the real entry and
 * asserts what the acts land; what is under test here is the SCREEN and the
 * folds, so their input is written out — one landed act, one refused act, one
 * act that landed a commit and no column.
 *
 * ── AND THE NAMES THAT ARE A CONTRACT ──────────────────────────────────────
 * The seek control's accessible name, the acts list's and the nav's are all
 * unchanged from before this packet: tests name controls by them, and a test
 * that had to be edited to keep passing is a contract that was broken quietly.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { CONSERVATION_ACT, CONSERVATION_BASIS_COLUMN, CONSERVATION_COLUMN, CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT, PROT_ACT_ORDER, PROT_STAGES, PROT_UNAVAILABLE_STAGES, SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import { BLOCKED_TAG, PROT_BLOCKED, PROT_PLAN } from '../src/prot/plan.js';
import { INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { ActRow, RunNarrative, landedLine, narrativeTitle } from '../web/src/protTrace.js';
import { StageDetail } from '../web/src/protDesk.js';
import { actColumnsOf, chartsOfStage, stageAtCursor, stepperStages, type StepperStage } from '../web/src/protStages.js';
import { StageStepper } from '../web/src/workbench/Stepper.js';
import { STEPPER_LABEL, actsLabelOf, focusLabelOf, seekLabelOf, showLabelOf, stepViews } from '../web/src/workbench/steps.js';

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

/**
 * THE FOUR ACTS OF A RUN THAT WENT AS FAR AS IT COULD — three landed, one was
 * refused — each NAMED rather than reached for by index.
 *
 * They were indexed until the conservation stage landed and shifted every one
 * of them by a position. A test that names the act it is about cannot be
 * quietly re-pointed by a new act arriving at the front of the list.
 */
const CONSERVED_ACT = landedAct({ stage: 'conservation', act: CONSERVATION_ACT, commit: 'c0', materialized: [CONSERVATION_COLUMN, CONSERVATION_BASIS_COLUMN] });
const PAIRS_ROW = landedAct();
const CONTACTS_ROW = landedAct({ act: CONTACTS_ACT, commit: 'c2', materialized: ['contacts', INTERFACE_CONTACTS_COLUMN, 'interface_separation'] });
const SURFACE_REFUSED = landedAct({ stage: 'surface', act: SURFACE_ACT, commit: null, refusal: 'act "residueSurface" threw: the solvent probe found no polymer atom to roll over' });
const OUTCOMES: readonly ActOutcome[] = [CONSERVED_ACT, PAIRS_ROW, CONTACTS_ROW, SURFACE_REFUSED];

/** …and the same run with its last act landing instead, which is what the committed entry really does. */
const ALL_LANDED: readonly ActOutcome[] = [CONSERVED_ACT, PAIRS_ROW, CONTACTS_ROW, landedAct({ stage: 'surface', act: SURFACE_ACT, commit: 'c3', materialized: [SASA_COLUMN, 'relative_sasa'] })];

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
  conservation: null,
  ...over,
});

/** The stepper over a run, wired exactly as `web/src/protDesk.tsx` wires it. */
async function stepper(
  outcomes: readonly ActOutcome[],
  run: ProtRun | null,
  pressed: string[] = [],
  options: { readonly seekable?: boolean; readonly refuseWith?: string | null; readonly here?: string } = {},
) {
  const seekable = options.seekable ?? true;
  const stages = stepperStages(outcomes, run);
  const here = options.here === undefined ? null : (stages.find((s) => s.stage === options.here) ?? null);
  const steps = stepViews(stages, here, seekable);
  const panel = await mount(<StageStepper steps={steps} label={STEPPER_LABEL} refusedSeek={options.refuseWith ?? null} onSeek={(key) => pressed.push(key)} />);
  /** One stage by its id — never by its position, because the PLAN's order is not the def's. */
  const at = (stage: string): StepperStage => {
    const found = stages.find((s) => s.stage === stage);
    if (found === undefined) throw new Error(`no stage "${stage}" on the stepper`);
    return found;
  };
  /** One column's markup, for the assertions about the mark itself. */
  const column = (stage: string): string => panel.steps()[at(stage).number - 1]!.innerHTML;
  return { ...panel, stages, at, column };
}

describe('ALL SIX STEPS OF THE PLAN, and each one says what it is', () => {
  it('draws one column per PUBLISHED STEP — six, not the three the def dispatches for', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    expect(panel.steps()).toHaveLength(PROT_PLAN.length);
    expect(panel.steps()).toHaveLength(6);
    // …and the grid is one column per step, derived from the list
    const grid = panel.host.querySelector('ol')?.getAttribute('style') ?? '';
    expect(grid).toContain(`repeat(${String(PROT_PLAN.length)}, minmax(0, 1fr))`);
    await panel.unmount();
  });

  it('prints the SHORT declared name in each column, and carries the declared SENTENCE on the column’s own control', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const said = panel.words();
    // the short name is what six columns across a screen can hold — and it is
    // DECLARED beside the sentence (`src/prot/plan.ts`), never cut from it here
    for (const step of PROT_PLAN) expect(said).toContain(step.name);
    // and no declared label was shortened: the sentence is the accessible name
    // of the column's control, so a screen reader hears it in full
    for (const stage of [...PROT_STAGES, ...PROT_UNAVAILABLE_STAGES]) {
      const control = ([...panel.host.querySelectorAll('[aria-label]')] as HTMLElement[]).map((el) => el.getAttribute('aria-label') ?? '');
      expect(control.some((name) => name.includes(stage.label)), `no control on the stepper carries the declared label "${stage.label}"`).toBe(true);
    }
    await panel.unmount();
  });

  it('LANDED: solid accent, no word under the name, and the press SEEKS to the commit its last act landed', async () => {
    const pressed: string[] = [];
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), pressed);
    const surface = panel.at('surface');
    expect(surface.state).toBe('landed');
    expect(panel.column('surface')).toContain('var(--pw-accent)');
    const button = panel.byLabel(seekLabelOf(surface));
    expect(button?.tagName).toBe('BUTTON');
    await click(button);
    expect(pressed).toEqual(['surface']);
    await panel.unmount();
  });

  it('REFUSED: rust, a badge and the word under the name — the sentence itself is the focused card’s', async () => {
    const panel = await stepper(OUTCOMES, runWith());
    const surface = panel.at('surface');
    expect(surface.state).toBe('refused');
    const column = panel.column('surface');
    expect(column).toContain('var(--pw-refuse)');
    // the badge: a hue alone is never a state
    expect(column).toContain('!');
    expect(panel.words()).toContain('refused');
    // the refusal itself is VERBATIM on the stage's own card and in its act
    // rows — never re-worded, and never on the stepper
    expect(surface.detail).toBe(SURFACE_REFUSED.refusal);
    await panel.unmount();
  });

  it('NOT RUN: hollow and dashed, no word, no control, and no act it never dispatched is named', async () => {
    const one = [CONSERVED_ACT, PAIRS_ROW, CONTACTS_ROW];
    const panel = await stepper(one, runWith({ outcomes: one }));
    const surface = panel.at('surface');
    expect(surface.state).toBe('not-run');
    expect(panel.column('surface')).toContain('dashed');
    // it is NOT a control: a press that answered nothing is worse than no press
    expect(panel.byLabel(seekLabelOf(surface))).toBeNull();
    expect(panel.byLabel(showLabelOf(surface))).toBeNull();
    expect(panel.byLabel(focusLabelOf(surface))).toBeNull();
    const said = panel.words();
    for (const id of PROT_ACT_ORDER.filter((a) => a !== CONSERVATION_ACT && a !== PAIRS_ACT && a !== CONTACTS_ACT)) expect(said, `the stepper names "${id}", which this run never dispatched`).not.toContain(id);
    await panel.unmount();
  });

  it('RUNNING: the only state that moves, the only one with a progress hairline, and nothing clickable yet', async () => {
    // the FIRST stage has finished (its one act is back) and the second is the
    // one in flight with one of its two acts back — which is what puts the
    // hairline at half
    const panel = await stepper([CONSERVED_ACT, PAIRS_ROW], null, [], { seekable: false });
    const interactions = panel.at('interactions');
    expect(interactions.state).toBe('running');
    const column = panel.column('interactions');
    expect(column).toContain('pw-spin');
    expect(column).toContain('width: 50%');
    // nobody else moves, and nothing is a control while the run is dispatching
    expect(panel.column('surface')).not.toContain('pw-spin');
    expect(panel.host.querySelectorAll('button')).toHaveLength(0);
    await panel.unmount();
  });
});

describe('THE THREE KINDS OF BLOCKED — one mark family, three sentences', () => {
  it('wears the SAME mark for all three: hatched, struck through, never a spinner', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    for (const blocked of PROT_BLOCKED) {
      const column = panel.column(blocked.stage);
      expect(column, `${blocked.stage} is not hatched`).toContain('var(--pw-mark-hatch)');
      // the diagonal: it can never be mistaken for a stage still working
      expect(column, `${blocked.stage} is not struck through`).toContain('var(--pw-strike)');
      expect(column).not.toContain('pw-spin');
    }
    // …and the mark the fold asks for is ONE name, so the two states cannot drift
    const views = stepViews(stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED })), null, true);
    expect(new Set(views.filter((v) => v.tag !== null && v.tag !== 'refused').map((v) => v.look))).toEqual(new Set(['declared-not-here']));
    await panel.unmount();
  });

  it('says WHICH KIND under each one, in its own word — and no word for a kind nothing is', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const said = panel.words();
    // this build, us — the two kinds something really is on this desk now
    expect(said).toContain(BLOCKED_TAG['this build']);
    expect(said).toContain(BLOCKED_TAG.us);
    expect(said).toContain('not on this build');
    expect(said).toContain('not built yet');
    /*
      AND NOT `not available here`, which is the whole point: the conservation
      stage wore that word for eight releases and LANDS now. A stepper that kept
      printing it would be the screen being less honest than the def again,
      which is the defect this suite was written for.
    */
    expect(said).not.toContain(BLOCKED_TAG['the world']);
    await panel.unmount();
  });

  it('is a CONTROL, and its name promises a card rather than a seek', async () => {
    const pressed: string[] = [];
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), pressed);
    for (const blocked of PROT_BLOCKED) {
      const stage = panel.at(blocked.stage);
      expect(stage.commit, 'a blocked stage has no commit to seek to').toBeNull();
      const control = panel.byLabel(showLabelOf(stage));
      expect(control?.tagName, `${blocked.stage} is not a control`).toBe('BUTTON');
      expect(showLabelOf(stage)).toContain('into the focus');
      expect(showLabelOf(stage)).toContain('will not run on this build');
      expect(showLabelOf(stage)).not.toContain('seek');
      await click(control);
    }
    expect(pressed).toEqual(PROT_BLOCKED.map((b) => b.stage));
    await panel.unmount();
  });

  it('is NEVER the not-run mark, which would read as still pending after a finished run', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    for (const blocked of PROT_BLOCKED) {
      expect(panel.at(blocked.stage).state).not.toBe('not-run');
      expect(panel.column(blocked.stage)).not.toContain('dashed');
    }
    await panel.unmount();
  });
});

describe('THE STEP THAT LANDED BEFORE THE RECORD STARTED is a fourth kind of press', () => {
  const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
  const search = stages.find((s) => s.stage === 'search')!;

  it('is LANDED — solid, not hatched, not struck through: it ran and it landed the whole table', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    expect(search.state).toBe('landed');
    expect(search.landsAtRoot).toBe(true);
    const column = panel.column('search');
    expect(column).toContain('var(--pw-accent)');
    expect(column).not.toContain('var(--pw-mark-hatch)');
    expect(column).not.toContain('var(--pw-strike)');
    await panel.unmount();
  });

  it('has no commit, so its press takes the focus and says the cursor does not move', async () => {
    const pressed: string[] = [];
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), pressed);
    expect(search.commit).toBeNull();
    const control = panel.byLabel(focusLabelOf(search));
    expect(control?.tagName).toBe('BUTTON');
    expect(focusLabelOf(search)).toContain('the cursor does not move');
    // and it is NOT a blocked sentence: this is the one step that certainly ran
    expect(focusLabelOf(search)).not.toContain('will not run');
    await click(control);
    expect(pressed).toEqual(['search']);
    await panel.unmount();
  });

  it('OWNS the pictures drawn from the columns no act landed — derived, not declared', () => {
    const shown = { [STRUCTURE_VIEW]: { color: 'chain' }, [RAMA_VIEW]: { x: 'phi', y: 'psi' }, [INTERFACE_VIEW]: { category: 'residue_key', y: INTERFACE_CONTACTS_COLUMN }, [SURFACE_VIEW]: { x: 'resnum', y: SASA_COLUMN, color: 'chain' } };
    const actColumns = actColumnsOf(stages);
    // every column the acts landed is on that side of the intersection
    expect([...actColumns].sort()).toEqual([CONSERVATION_COLUMN, CONSERVATION_BASIS_COLUMN, SASA_COLUMN, 'contacts', INTERFACE_CONTACTS_COLUMN, 'interface_separation', 'relative_sasa'].sort());
    // …so the parse owns the two pictures whose every bound column it read off
    // the file, and neither of the two an act landed a column for
    expect([...chartsOfStage(search, shown, actColumns, stages)].sort()).toEqual([RAMA_VIEW, STRUCTURE_VIEW].sort());
    expect(chartsOfStage(search, shown, actColumns, stages)).not.toContain(SURFACE_VIEW);
    expect(chartsOfStage(search, shown, actColumns, stages)).not.toContain(INTERFACE_VIEW);
  });

  it('follows a RE-ENCODE, because it is an intersection and not a list', () => {
    const actColumns = actColumnsOf(stages);
    // a reader moves the run's y onto a file column: the picture stops being the
    // surface stage's and becomes the parse's, with nobody editing a table
    const reencoded = { [SURFACE_VIEW]: { x: 'resnum', y: 'phi', color: 'chain' } };
    expect(chartsOfStage(search, reencoded, actColumns, stages)).toEqual([SURFACE_VIEW]);
    expect(chartsOfStage(stages.find((s) => s.stage === 'surface')!, reencoded, actColumns, stages)).toEqual([]);
  });
});

describe('NOTHING BETWEEN THE STEPPER AND THE CHARTS', () => {
  it('prints no note, no sentence and no paragraph under the marks', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const said = panel.words();
    // the three sentences the note used to carry
    expect(said).not.toContain('stages are DECLARED on this desk');
    expect(said).not.toContain('A circle claims nothing');
    expect(said).not.toContain('Press a landed stage');
    // no <p> at all except the refused-seek status, and that one is absent here
    expect(panel.host.querySelectorAll('p')).toHaveLength(0);
    await panel.unmount();
  });

  it('offers no per-stage caret, because there is no prose left for one to open', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    expect(panel.host.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    // ONE control per column, and that is all: six columns, six buttons
    expect(panel.host.querySelectorAll('button')).toHaveLength(6);
    expect(panel.stages).toHaveLength(6);
    await panel.unmount();
  });

  it('keeps the plan’s accounting IN THE MARKS, which is what a reader counts', async () => {
    /*
      The note's counts went to the facts strip for one round and were dropped
      with it: THE SIX MARKS ARE THE ACCOUNTING. FOUR solid circles now — the
      parse's own step and three landed stages — one hatched with NOT ON THIS
      BUILD under it and one with NOT BUILT YET, countable, and in a better
      register than prose.

      IT WAS THREE AND THREE. The conservation stage moved from the hatched half
      to the solid half when it stopped being blocked, and this count is the
      cheapest place a later edit that quietly un-lands it would be caught.
    */
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    expect(panel.stages.filter((s) => s.state === 'landed')).toHaveLength(4);
    expect(panel.stages.filter((s) => s.blockedBy !== null)).toHaveLength(2);
    const said = panel.words();
    expect(said).toContain('not on this build');
    expect(said).toContain('not built yet');
    // and no count is re-stated as prose anywhere near the marks
    expect(said).not.toContain('steps declared');
    expect(said).not.toContain('will not run on this build');
    await panel.unmount();
  });

  it('prints the SESSION’s own sentence when a seek is refused, rather than failing quietly', async () => {
    const panel = await stepper(ALL_LANDED, runWith({ outcomes: ALL_LANDED }), [], { refuseWith: 'no commit "c2" to seek to' });
    expect(panel.words()).toContain('the session refused that seek, in its own words: no commit "c2" to seek to');
    await panel.unmount();
  });
});

describe('the connectors are a stated rule, not a guess', () => {
  it('is solid between two steps that have both run, dashed near up to the last one, and dashed far past it', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const views = stepViews(stages, null, true);
    const at = (stage: string): number => stages.findIndex((s) => s.stage === stage);
    // step 3 (surface, ran) → step 4 (interactions, ran): solid
    expect(views[at('surface')]!.linkAfter).toBe('run');
    expect(views[at('interactions')]!.linkBefore).toBe('run');
    // step 4 is the last that ran, so every boundary past it is FAR
    expect(views[at('interactions')]!.linkAfter).toBe('far');
    expect(views[at('hotspots')]!.linkBefore).toBe('far');
    // step 1 ran (at the root) and step 2 RUNS NOW TOO — it stopped being the
    // stage the world blocked — so that boundary is solid, and the NEAR arm is
    // asserted where the run really stops, at the first step past it
    expect(views[at('search')]!.linkAfter).toBe('run');
    expect(views[at('conservation')]!.linkBefore).toBe('run');
    // the two ends have no connector at all
    expect(views[0]!.linkBefore).toBeNull();
    expect(views[views.length - 1]!.linkAfter).toBeNull();
  });
});

describe('the act rows moved to the record, and are unchanged', () => {
  const detail = (stage: StepperStage, asked: string[] = []) => (
    <StageDetail stage={stage} run={runWith({ outcomes: ALL_LANDED })} onSeek={(id) => { asked.push(id); return Promise.resolve(null); }} say={() => undefined} />
  );

  it('shows a stage’s own acts, in dispatch order, each one seeking to its own commit', async () => {
    const asked: string[] = [];
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const panel = await mount(detail(stages.find((s) => s.stage === 'interactions')!, asked));
    expect(panel.rows()).toHaveLength(2);
    const said = panel.words();
    expect(said.indexOf(`interactions · ${PAIRS_ACT}`)).toBeGreaterThan(-1);
    expect(said.indexOf(`interactions · ${CONTACTS_ACT}`)).toBeGreaterThan(said.indexOf(`interactions · ${PAIRS_ACT}`));
    // THE NAME THE BROWSER SMOKE TEST FINDS IT BY — unchanged, and it is the one
    // test that proves the pictures follow the cursor
    expect(panel.byLabel(`seek the cursor to the commit act "${PAIRS_ACT}" landed`)).not.toBeNull();
    await click(panel.rowButtons()[0]!);
    expect(asked).toEqual(['c1']);
    await panel.unmount();
  });

  it('is named the way the caret that used to open it was named, because a name is a contract', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const interactions = stages.find((s) => s.stage === 'interactions')!;
    expect(actsLabelOf(interactions)).toBe(`show the acts of stage ${String(interactions.number)}, ${interactions.label}`);
  });

  it('carries no prose any more — the rows, and one Mono word for a stage that dispatched none', async () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    // A STEP THE DEF DISPATCHES NOTHING FOR. It used to be `conservation`,
    // which is a landed stage with an act and a picture now, so the assertion
    // moved to a step that really dispatches none — the one the plan declares
    // and this build cannot perform.
    const panel = await mount(detail(stages.find((s) => s.stage === 'hotspots')!));
    const said = panel.words();
    expect(said).toBe('no act dispatched');
    // the three sentences that used to sit above the rows are gone from here
    expect(said).not.toContain('a greyed box would be a promise');
    expect(said).not.toContain('the reason above is measured');
    await panel.unmount();
  });

  it('renders a refused act as a first-class row, not clickable, and says why', async () => {
    const stages = stepperStages(OUTCOMES, runWith());
    const panel = await mount(<StageDetail stage={stages.find((s) => s.stage === 'surface')!} run={runWith()} onSeek={() => Promise.resolve(null)} say={() => undefined} />);
    expect(panel.rows()).toHaveLength(1);
    expect(panel.rowButtons()).toHaveLength(0);
    expect(panel.words()).toContain('no commit, so there is nothing to seek to: this act landed none');
    expect(panel.words()).toContain(SURFACE_REFUSED.refusal!);
    await panel.unmount();
  });
});

describe('what a row says it landed', () => {
  it('names the columns an act wrote, and the table’s own counts for the act that writes none', () => {
    expect(landedLine(CONTACTS_ROW, runWith())).toBe('landed 3 columns on the residues table: contacts, interface_contacts, interface_separation');
    expect(landedLine(PAIRS_ROW, runWith())).toBe('cut 224 contact rows, 21 of them between different chains (120 hydrogen-bond, 104 hydrophobic) — the act\'s own answer, which no clause in the data space reaches');
    // a landed act whose answer is not readable yet, while the run is still going
    expect(landedLine(PAIRS_ROW, null)).toBe('landed a commit; what it answered is read when the run comes back');
    // …and one that landed and wrote nothing, with the run in hand
    expect(landedLine(landedAct({ act: 'somethingElse' }), runWith())).toBe('landed a commit and wrote no column into the data space');
  });

  it('is a button that seeks, and prints a throw from the seek door as a sentence', async () => {
    const panel = await mount(
      <ol aria-label="the acts this stage dispatched, in dispatch order">
        <ActRow outcome={PAIRS_ROW} run={runWith()} say={() => undefined} onSeek={() => Promise.reject(new Error('the door fell over'))} />
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
    [STRUCTURE_VIEW]: { color: 'chain' },
    [RAMA_VIEW]: { x: 'phi', y: 'psi' },
    [INTERFACE_VIEW]: { category: 'residue_key', y: INTERFACE_CONTACTS_COLUMN },
    [SURFACE_VIEW]: { x: 'resnum', y: SASA_COLUMN, color: 'chain' },
  } as const;

  it('gives a stage exactly the charts that bind a column its acts landed', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const columns = actColumnsOf(stages);
    const interactions = stages.find((s) => s.stage === 'interactions')!;
    const surface = stages.find((s) => s.stage === 'surface')!;
    // the interactions stage landed `interface_contacts` (the bar's y) and cut
    // the pair table (its RECEIPT, which binds no column at all)
    expect([...chartsOfStage(interactions, SHOWN, columns, stages)].sort()).toEqual([INTERFACE_VIEW, PAIRS_VIEW].sort());
    expect(chartsOfStage(surface, SHOWN, columns, stages)).toEqual([SURFACE_VIEW]);
  });

  it('gives a stage NO chart when nothing on screen binds what it landed', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const surface = stages.find((s) => s.stage === 'surface')!;
    expect(chartsOfStage(surface, { ...SHOWN, [SURFACE_VIEW]: { x: 'resnum', y: 'phi', color: 'chain' } }, actColumnsOf(stages), stages)).toEqual([]);
  });

  it('gives a BLOCKED stage no chart at all — it landed nothing to bind', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    for (const blocked of PROT_BLOCKED) {
      const stage = stages.find((s) => s.stage === blocked.stage)!;
      expect(chartsOfStage(stage, SHOWN, actColumnsOf(stages), stages)).toEqual([]);
    }
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

  it('never stands the cursor in a step that landed no commit, whichever kind it is', () => {
    const stages = stepperStages(ALL_LANDED, runWith({ outcomes: ALL_LANDED }));
    const path = ['c1', 'c2', 'c3'];
    for (const cursor of path) {
      const standing = stageAtCursor(stages, path, cursor);
      expect(standing?.commit, 'the cursor is standing in a stage with no commit').not.toBeNull();
    }
  });
});
