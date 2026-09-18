// @vitest-environment jsdom
/**
 * THE BAR MEANS FOCUS, AND WHEN THE FOCUS AND THE CURSOR PART COMPANY THE PAGE
 * SAYS SO.
 *
 * ── THE DEFECT THIS FILE EXISTS FOR ────────────────────────────────────────
 * Measured in a real browser at 1280×800: pressing *Hot Spot Prediction* moved
 * the focused pane to `stage:hotspots` and left `aria-current` and the 3px
 * accent bar on stage 3. The press worked and the screen changed, and the page
 * held two ideas of *where you are* that disagreed — because the mark followed
 * the CURSOR, which a blocked stage deliberately does not move.
 *
 * The ruling: **the bar means focus, `aria-current` means focus**, for all six
 * columns. **The cursor is a different fact and keeps its own voice** (the
 * chrome's commit line). **And when the two disagree the page says so**, on the
 * focused card, DERIVED from the two facts and never from which control was
 * pressed.
 *
 * ── WHAT IS ASSERTED HERE, and what is asserted in a browser ───────────────
 * Here: the folds and the markup, for every one of the six kinds — including
 * all three kinds of blocked and the step that landed at the root — plus the
 * reach fold behind defect 2 and the zero-guide declaration.
 * `tests/prot-focus.smoke.test.ts` presses all six on the built page, reaches
 * the disagreeing state a SECOND way (a seek from the record drawer) and
 * presses a mark in a rail tile with a real pointer.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { framePad } from 'vizfootprint-ui';
import { PROT_ENCODINGS, RAMA_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { PROT_PLAN } from '../src/prot/plan.js';
import { CONSERVATION_ACT, CONSERVATION_BASIS_COLUMN, CONSERVATION_COLUMN, CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT, SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { stepperStages, type StepperStage } from '../web/src/protStages.js';
import { StageStepper } from '../web/src/workbench/Stepper.js';
import { STEPPER_LABEL, stepViews } from '../web/src/workbench/steps.js';
import { focusVsCursor } from '../web/src/workbench/panel.js';
import { POINTER_TARGET, markPitch, reachClause, zeroGuideOf } from '../web/src/workbench/charts.js';
import { ChartCard, ChartTile } from '../web/src/workbench/ChartCard.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The FOUR acts of a finished run, as the stepper's fold takes them.
 *
 * All four LAND, which is what makes every one of the six columns a control:
 * three stages landed, the step that landed at the root is a control of its own
 * and the two blocked steps are controls that open their card. A stage that had
 * not been dispatched at all would be a `<div>` — a control that answered
 * nothing is worse than no control — and the assertion below would be about a
 * half-finished run rather than about the mark.
 */
const OUTCOMES: readonly ActOutcome[] = [
  { stage: 'conservation', act: CONSERVATION_ACT, commit: 'c-conservation', refusal: null, materialized: [CONSERVATION_COLUMN, CONSERVATION_BASIS_COLUMN] },
  { stage: 'interactions', act: PAIRS_ACT, commit: 'c-pairs', refusal: null, materialized: [] },
  { stage: 'interactions', act: CONTACTS_ACT, commit: 'c-contacts', refusal: null, materialized: [INTERFACE_CONTACTS_COLUMN] },
  { stage: 'surface', act: SURFACE_ACT, commit: 'c-surface', refusal: null, materialized: [SASA_COLUMN, 'relative_sasa'] },
];

const RUN: ProtRun = { outcomes: OUTCOMES, narrative: [], pairs: null, surface: null } as unknown as ProtRun;

const STAGES = stepperStages(OUTCOMES, RUN);
const at = (stage: string): StepperStage => STAGES.find((s) => s.stage === stage)!;

/** Mount, read, press, unmount — the same four the other card suites use. */
async function mount(element: ReactElement): Promise<{ readonly host: HTMLElement; words(): string; unmount(): Promise<void> }> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    host,
    words: () => (host.textContent ?? '').replace(/\s+/g, ' '),
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

/** The stepper as the desk mounts it, with one stage FOCUSED. */
const stepper = (focused: StepperStage | null): ReactElement => (
  <StageStepper steps={stepViews(STAGES, focused, true)} label={STEPPER_LABEL} refusedSeek={null} onSeek={() => undefined} />
);

/** Which column carries `aria-current="step"`, 1-based — on the list item AND on its control. */
const currentOf = (host: HTMLElement): { readonly items: readonly number[]; readonly controls: readonly number[]; readonly bars: readonly number[] } => {
  const items = [...host.querySelectorAll('nav ol li')];
  return {
    items: items.flatMap((li, i) => (li.getAttribute('aria-current') === 'step' ? [i + 1] : [])),
    controls: items.flatMap((li, i) => (li.querySelector('button[aria-current="step"]') !== null ? [i + 1] : [])),
    // THE 3px ACCENT BAR — the last aria-hidden span of the column, which is
    // the mark the author measured and the one the eye reads
    bars: items.flatMap((li, i) => {
      const spans = [...li.children].filter((el) => el.getAttribute('aria-hidden') !== null);
      const last = spans.at(-1);
      return last !== undefined && (last as HTMLElement).style.height === '3px' ? [i + 1] : [];
    }),
  };
};

describe('the bar and aria-current follow the FOCUSED stage, for every one of the six', () => {
  /*
    ALL SIX KINDS, by the state each column really is in this run: the step that
    landed at the ROOT (1), three LANDED stages (2, 3, 4), the stage THIS BUILD
    blocks (5) and the stage WE have not built (6). Three of them land no commit
    at all, which is the whole defect.
  */
  for (const step of PROT_PLAN) {
    it(`marks column ${String(step.step)} (${step.name}) when that stage is the focused one, and marks no other`, async () => {
      const panel = await mount(stepper(at(step.stage)));
      const marked = currentOf(panel.host);
      expect(marked.items).toEqual([step.step]);
      expect(marked.bars).toEqual([step.step]);
      /*
        AND ON THE CONTROL TOO, when the column has one. Five of the six do; a
        stage that is merely un-run is a `<div>` — a control that answered
        nothing is worse than no control — so `aria-current` rides the list item
        alone there. Every column in THIS run is a control.
      */
      expect(marked.controls).toEqual([step.step]);
      await panel.unmount();
    });
  }

  it('marks NOTHING when nothing is focused — an absence is absent, never column one by default', async () => {
    const panel = await mount(stepper(null));
    expect(currentOf(panel.host)).toEqual({ items: [], controls: [], bars: [] });
    await panel.unmount();
  });

  it('does NOT follow the cursor: a fold given the blocked stage marks the blocked stage, whatever landed', async () => {
    // the regression, stated as a test: the old fold was handed `stageAtCursor`
    // and a blocked press could not move it, so the bar stayed on stage 3
    expect(stepViews(STAGES, at('hotspots'), true).filter((v) => v.focused).map((v) => v.number)).toEqual([5]);
    expect(stepViews(STAGES, at('surface'), true).filter((v) => v.focused).map((v) => v.number)).toEqual([3]);
  });
});

describe('the disagreement line is DERIVED from the two facts, and absent when they agree', () => {
  it('says nothing at all when the focused stage IS the stage the cursor stands in', () => {
    expect(focusVsCursor(at('surface'), at('surface'))).toBeNull();
    expect(focusVsCursor(at('interactions'), at('interactions'))).toBeNull();
  });

  it('names BOTH stages when they differ — the one you are looking at, and the one the cursor stands in', () => {
    const said = focusVsCursor(at('hotspots'), at('surface'));
    expect(said).toContain('You are looking at stage 5, Hot Spot Prediction');
    expect(said).toContain('the cursor is standing in stage 3, Structure Analysis');
    // …and the consequence, which is the reason the line exists: the bar moved
    // and the pictures did not
    expect(said).toContain('every picture here is drawn where the cursor is');
  });

  it('says it for the step that landed at the ROOT too — it ran, and it has no commit to seek to', () => {
    expect(focusVsCursor(at('search'), at('surface'))).toContain('You are looking at stage 1, Structure Search');
  });

  it('says the cursor is in NO stage when it is in none — the root of the log, or behind every stage’s own commit', () => {
    const said = focusVsCursor(at('search'), null);
    expect(said).toContain('the cursor is not standing in any stage');
    expect(said).not.toContain('stage 0');
  });

  it('says nothing when there is no focused stage to be looking at', () => {
    expect(focusVsCursor(null, at('surface'))).toBeNull();
    expect(focusVsCursor(null, null)).toBeNull();
  });

  it('KNOWS NOTHING ABOUT A BUTTON — the same two stages give the same sentence however the desk got there', () => {
    // a stepper press, a promoted rail tile, a reload and a seek from the record
    // drawer are four routes into one state, and the fold is a function of the
    // state: two calls with the same pair are the same sentence
    expect(focusVsCursor(at('conservation'), at('interactions'))).toBe(focusVsCursor(at('conservation'), at('interactions')));
  });
});

describe('the focused card carries that line BELOW the picture, with the figures and the refusal', () => {
  const card = (cursorElsewhere: string | null): ReactElement => (
    <ChartCard
      id={SURFACE_VIEW}
      label="How much of each residue the solvent can reach"
      focused
      howToRead="higher is more exposed to solvent"
      legend={[]}
      footLeft="185 residues plotted"
      footRight={null}
      note={null}
      noteLabel="Full note"
      noteAria="the note"
      clear={null}
      cursorElsewhere={cursorElsewhere}
      height={200}
    >
      <div>the picture</div>
    </ChartCard>
  );

  it('draws it as a status, so a screen reader hears the state change and not only a sighted reader', async () => {
    const said = focusVsCursor(at('hotspots'), at('surface'))!;
    const panel = await mount(card(said));
    const status = [...panel.host.querySelectorAll('p[role="status"]')].map((p) => p.textContent);
    expect(status).toContain(said);
    await panel.unmount();
  });

  it('draws NO ROW AT ALL when the two agree', async () => {
    const panel = await mount(card(null));
    expect(panel.host.querySelectorAll('p[role="status"]')).toHaveLength(0);
    expect(panel.words()).not.toContain('You are looking at');
    await panel.unmount();
  });
});

describe('whether a mark can be pressed by hand — the fold behind defect 2', () => {
  const PAD = framePad(['line', 'bar', 'point']);

  it('takes its floor from WCAG 2.2 and its plot from the library’s own margin, not from numbers of ours', () => {
    // 2.5.8 Target Size (Minimum) — 24 by 24 CSS px
    expect(POINTER_TARGET).toBe(24);
    // the plot is the pane minus `framePad`'s own left and right
    expect(markPitch(1000, 10, PAD)).toBeCloseTo((1000 - PAD.l - PAD.r) / 10, 6);
  });

  it('REFUSES the cross-chain bars: 185 marks in the whole instrument is nowhere near a pointer target', () => {
    // 1,232px is the instrument's own width at 1280×800 — an UPPER bound on any
    // pane inside it, so a sentence here means no pane on this page could do it
    const pitch = markPitch(1232, 185, PAD);
    expect(pitch).toBeLessThan(POINTER_TARGET);
    const said = reachClause(1232, 185, PAD);
    expect(said).toContain('185 marks in this width');
    expect(said).toContain('too thin to press');
    // the REMEDY the page can honestly offer, and it is not "press it to pick
    // in the focus": at 185 marks the focus slot is under the floor too
    expect(said).toContain('Tab picks one');
    expect(reachClause(906, 185, PAD)).not.toBeNull();
  });

  it('GOES SILENT the moment a crossfilter narrows the marks enough — derived, with nothing to clean up', () => {
    expect(markPitch(1232, 12, PAD)).toBeGreaterThan(POINTER_TARGET);
    expect(reachClause(1232, 12, PAD)).toBeNull();
  });

  it('says nothing about a picture with no marks, and nothing about a pane with no room', () => {
    expect(reachClause(1232, 0, PAD)).toBeNull();
    expect(reachClause(0, 185, PAD)).toBeNull();
  });

  it('rides a tile’s own line of figures, after them — the numbers never shorten, the clause does', async () => {
    const said = reachClause(1232, 185, PAD)!;
    const panel = await mount(
      <ChartTile id="interface" label="Contacts across the interface" said="185 bars · 18 touch another chain" reach={said} promote={{ label: 'bring it here', onPress: () => undefined }} wide>
        <div>the picture</div>
      </ChartTile>,
    );
    const words = panel.words();
    expect(words).toContain('185 bars · 18 touch another chain');
    expect(words).toContain(said);
    expect(words.indexOf('185 bars')).toBeLessThan(words.indexOf('too thin to press'));
    await panel.unmount();
  });

  it('draws no such clause on a tile that was handed none', async () => {
    const panel = await mount(
      <ChartTile id="rama" label="Backbone angles" said="181 of 185 residues plotted" promote={{ label: 'bring it here', onPress: () => undefined }}>
        <div>the picture</div>
      </ChartTile>,
    );
    expect(panel.words()).not.toContain('too thin to press');
    await panel.unmount();
  });
});

describe('the Ramachandran’s crosshair is DECLARED, and the declaration is what the picture answers to', () => {
  /*
    THE FOLD IS THE INPUT NOW, and that is the whole change here: this page used
    to read the declaration from the def it shares with the session, because the
    reader-side mapper dropped a layerless view's frame. The library has fixed
    the mapper, the tripwire left for that day fired, and `zeroGuideOf` takes
    the RECORD's own frame. So what is asserted here is the SHAPE fold — one
    boolean per axis, out of whatever the record carries — and the assertions
    are fed the def's own declared frames, which `tests/prot-def.test.ts` pins
    byte for byte against what the session serves and what the reader receives.
  */
  const frameOf = (viewId: string): Readonly<Record<string, { readonly zeroGuide?: boolean }>> | undefined =>
    PROT_ENCODINGS.find((encoding) => encoding.viewId === viewId)?.frame;

  it('turns both declared axes into the prop the chart takes — never a prop typed at a call site', () => {
    expect(frameOf(RAMA_VIEW)).toEqual({ x: { zeroGuide: true }, y: { zeroGuide: true } });
    expect(zeroGuideOf(frameOf(RAMA_VIEW))).toEqual({ x: true, y: true });
  });

  it('asks it of no other view, so every other picture is byte-identical to before the key existed', () => {
    for (const viewId of [SURFACE_VIEW, 'interface', 'pairs']) {
      expect(frameOf(viewId), viewId).toBeUndefined();
      expect(zeroGuideOf(frameOf(viewId)), viewId).toBeUndefined();
    }
  });

  it('draws no line at all where the record says nothing — an absent declaration is never a guessed one', () => {
    expect(zeroGuideOf(undefined)).toBeUndefined();
    expect(zeroGuideOf({})).toBeUndefined();
    expect(zeroGuideOf({ x: {} })).toBeUndefined();
    // one axis asked and one not: only the one that asked gets a line
    expect(zeroGuideOf({ x: { zeroGuide: true } })).toEqual({ x: true });
  });
});
