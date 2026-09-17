// @vitest-environment jsdom
/**
 * THE ONE PANEL SAYS THE RUN'S OWN WORDS, AND MOVES WITH THE CURSOR.
 *
 * The redesign replaced a paragraph under every chart with ONE panel about the
 * stage the reader is on. That makes this the file where the packet's law is
 * enforced: *not one sentence, count or figure may be typed into the markup.*
 * So every assertion below compares what is on screen with the RUN'S OWN FIELD
 * rather than with a string a test author liked:
 *
 *   the first sentence   `StepperStage.subtitle`
 *   the next ones        `ProtRun.narrative`, verbatim
 *   the refusal          `ActOutcome.refusal`, verbatim
 *   the four facts       `InteractionCounts` / `SurfaceCounts`, field by field
 *   the footnote         `PROT_UNAVAILABLE_STAGES[].why`
 *
 * ── AND THE TWO FACTS THE DESIGN GOT WRONG ─────────────────────────────────
 * The design's stage panel says the residues with no backbone angle are missing
 * *because their coordinates are incomplete in the deposited file*, and its
 * cross-chain chart claims *11 residues carry the 21 cross-chain contacts*.
 * Neither is what this desk measured. The last block of this file asserts that
 * neither sentence reached the screen.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { PROT_UNAVAILABLE_STAGES, SASA_COLUMN, SURFACE_ACT, CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT } from '../src/prot/analyses.js';
import { protTables } from '../src/prot/etl.js';
import { PROT_FILES } from '../src/data/files.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { stepperStages } from '../web/src/protStages.js';
import { StagePanel } from '../web/src/workbench/StagePanel.js';
import { NARRATIVE_LINES, firstClause, stageFacts, stagePanel } from '../web/src/workbench/panel.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The committed entry, read from the PROJECT ROOT rather than through
 * `src/prot/snapshot.ts` — the reason `tests/prot-landing.test.tsx` gives: that
 * door resolves the file against its own module URL, which under the `jsdom`
 * environment this suite needs is an `http://` URL and not a path. The path is
 * still the one owner's (`src/data/files.ts` · `PROT_FILES`).
 */
const TABLES = protTables(readFileSync(join(process.cwd(), PROT_FILES.structure), 'utf8'));

async function mount(element: ReactElement): Promise<{ readonly words: () => string; readonly press: (label: string) => Promise<void>; readonly unmount: () => Promise<void>; readonly host: HTMLElement }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    host,
    words: () => (host.textContent ?? '').replace(/\s+/g, ' '),
    press: async (label) => {
      const button = ([...host.querySelectorAll('[aria-label]')] as HTMLElement[]).find((el) => el.getAttribute('aria-label') === label);
      if (button === undefined) throw new Error(`no control is called "${label}"`);
      await act(async () => {
        button.click();
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

const landedAct = (over: Partial<ActOutcome> = {}): ActOutcome => ({ stage: 'interactions', act: PAIRS_ACT, commit: 'c1', refusal: null, materialized: [], ...over });

const ALL_LANDED: readonly ActOutcome[] = [
  landedAct(),
  landedAct({ act: CONTACTS_ACT, commit: 'c2', materialized: ['contacts', INTERFACE_CONTACTS_COLUMN, 'interface_separation'] }),
  landedAct({ stage: 'surface', act: SURFACE_ACT, commit: 'c3', materialized: [SASA_COLUMN, 'relative_sasa'] }),
];

const REFUSED: readonly ActOutcome[] = [ALL_LANDED[0]!, ALL_LANDED[1]!, landedAct({ stage: 'surface', act: SURFACE_ACT, commit: null, refusal: 'act "residueSurface" threw: the solvent probe found no polymer atom to roll over' })];

/**
 * A run shaped like the orchestrator's answer, with the two acts' own count
 * objects filled in — those are what the panel's four facts are read off.
 */
const RUN: ProtRun = {
  outcomes: ALL_LANDED,
  narrative: [
    'Stage "Every non-covalent contact in the entry" started.',
    'Stage "Every non-covalent contact in the entry" wrote 3 columns.',
    'Stage "Every non-covalent contact in the entry" finished.',
    'Stage "Every non-covalent contact in the entry" was the second of two.',
    'Stage "How much of each residue the solvent can reach" finished.',
  ],
  pairs: { counts: { reported: 231, rows: 224, crossing: 21, byKind: [{ kind: 'hydrogen-bond', contacts: 220 }], providersOn: [], providersOff: [], throughAlternateLocation: 15 }, rows: [], dropped: [] } as unknown as ProtRun['pairs'],
  contacts: null,
  surface: { counts: { probeSize: 1.4, spherePoints: 960, nonPolymer: false, traceOnly: false, engineTotal: 1, landed: 185, noValue: 0, noReference: 3, buried: 17 } } as unknown as ProtRun['surface'],
};

const STAGES = stepperStages(ALL_LANDED, RUN);
const interactions = STAGES[0]!;
const surface = STAGES[1]!;

const panelFor = (here: typeof interactions | null, run: ProtRun | null = RUN, focused: readonly string[] = []) =>
  stagePanel({ here, run, counts: TABLES.counts, cursor: here === null ? null : (here.commit ?? null), onPath: true, focused });

/** What the fold is called on screen and for a screen reader — the composition's own two strings. */
const FOLD = 'More about where you are standing';
const FOLD_ARIA = 'more about where you are standing';

/**
 * THE PANEL AS THE COMPOSITION MOUNTS IT — the fold included.
 *
 * `web/src/protDesk.tsx` builds the fold's children out of four things: the
 * quiet rows note, the dashboard's declared summary, the desk's own claim, and
 * the MEASURED paragraph behind each short unavailable line. The test builds the
 * same four so that what it presses is what a reader presses.
 */
const panelProps = (words: ReturnType<typeof stagePanel>) => ({
  ...words,
  fold: {
    label: FOLD,
    aria: FOLD_ARIA,
    children: (
      <>
        <p>{ROWS_NOTE}</p>
        <p>{SUMMARY}</p>
        <p>{CLAIM}</p>
        {words.unavailableWhy.map((stage) => (
          <p key={stage.id}>
            {stage.name} — {stage.why}
          </p>
        ))}
      </>
    ),
  },
});

/** The three long things the follow-up round moved into the fold, in the words the page uses. */
const ROWS_NOTE = 'every picture below is drawn from the 185 residue rows as they stand at commit s4';
const SUMMARY = 'A protein structure as its depositors solved it: 185 residues in 2 chains (A: 96, B: 89)';
const CLAIM = 'One residue, four pictures — and two of them arrive';

describe('the panel is about the stage the cursor is standing in', () => {
  it('names it by its NUMBER and its DECLARED label, in the eyebrow', () => {
    expect(panelFor(surface).eyebrow).toBe(`Stage ${String(surface.number)} · ${surface.label}`);
    expect(panelFor(interactions).eyebrow).toBe(`Stage ${String(interactions.number)} · ${interactions.label}`);
  });

  it('opens with the FOLD’s own line — what the stage put on the desk, never re-worded here', () => {
    expect(panelFor(surface).sentences[0]).toBe(surface.subtitle);
    expect(panelFor(interactions).sentences[0]).toBe(interactions.subtitle);
  });

  it('then quotes the RECORDER’s own sentences — the ones that name this stage, verbatim and in order', () => {
    const said = panelFor(interactions).sentences;
    const mine = RUN.narrative.filter((line) => line.includes(interactions.label));
    expect(mine.length).toBeGreaterThan(NARRATIVE_LINES);
    // the first NARRATIVE_LINES of them, in the recorder's order, unchanged
    expect(said.slice(1, 1 + NARRATIVE_LINES)).toEqual(mine.slice(0, NARRATIVE_LINES));
    // and not one sentence about a DIFFERENT stage
    for (const line of RUN.narrative.filter((l) => !l.includes(interactions.label))) expect(said).not.toContain(line);
  });

  it('ends with the one derived clause, which is about the SCREEN and not about the protein', () => {
    const said = panelFor(surface, RUN, ['How much of each residue the solvent can reach']).sentences;
    expect(said[said.length - 1]).toContain('is the focus below');
    expect(said[said.length - 1]).toContain('nobody typed that list');
    // and with nothing focused it says that instead of naming charts
    expect(panelFor(surface, RUN, []).sentences.at(-1)).toContain('No chart on this desk is drawn from what this stage landed');
  });

  it('switches when the cursor moves — a different stage is a different panel', async () => {
    const first = await mount(<StagePanel {...panelProps(panelFor(interactions))} />);
    expect(first.words()).toContain(interactions.label);
    expect(first.words()).toContain(interactions.subtitle);
    expect(first.words()).not.toContain(surface.subtitle);
    await first.unmount();
    const second = await mount(<StagePanel {...panelProps(panelFor(surface))} />);
    expect(second.words()).toContain(surface.subtitle);
    expect(second.words()).not.toContain(interactions.subtitle);
    await second.unmount();
  });
});

describe('the four facts are the acts’ own counts, read field by field', () => {
  it('reads the interactions stage off InteractionCounts', () => {
    const facts = stageFacts(interactions, RUN, TABLES.counts);
    const counts = RUN.pairs!.counts;
    expect(facts).toHaveLength(4);
    expect(facts.map((f) => f.value)).toEqual([
      counts.reported.toLocaleString('en-US'),
      counts.rows.toLocaleString('en-US'),
      counts.crossing.toLocaleString('en-US'),
      counts.throughAlternateLocation.toLocaleString('en-US'),
    ]);
  });

  it('reads the surface stage off SurfaceCounts, and the denominator off the PARSE’s own residue count', () => {
    const facts = stageFacts(surface, RUN, TABLES.counts);
    const counts = RUN.surface!.counts;
    expect(facts).toHaveLength(4);
    expect(facts[0]!.value).toBe(`${counts.landed.toLocaleString('en-US')} / ${TABLES.counts.residues.toLocaleString('en-US')}`);
    expect(facts[1]!.value).toBe(counts.buried.toLocaleString('en-US'));
    expect(facts[2]!.value).toBe(counts.noValue.toLocaleString('en-US'));
    expect(facts[3]!.value).toBe(counts.noReference.toLocaleString('en-US'));
  });

  it('has NO facts at all for a stage whose acts have not come back — and the panel says so instead of showing dashes', async () => {
    const stages = stepperStages([], null);
    const words = stagePanel({ here: stages[0]!, run: null, counts: TABLES.counts, cursor: null, onPath: true, focused: [] });
    expect(words.facts).toEqual([]);
    const panel = await mount(<StagePanel {...panelProps(words)} />);
    expect(panel.words()).toContain('this stage has landed no counts to read');
    await panel.unmount();
  });

  it('puts every value in the DOM, in Mono at full ink, beside the name of the field it came from', async () => {
    const panel = await mount(<StagePanel {...panelProps(panelFor(surface))} />);
    const said = panel.words();
    for (const fact of stageFacts(surface, RUN, TABLES.counts)) {
      expect(said).toContain(fact.label);
      expect(said).toContain(fact.value);
    }
    expect(panel.host.querySelectorAll('dl > div')).toHaveLength(4);
    await panel.unmount();
  });
});

describe('a refusal and an impossibility are two different sentences, and both are verbatim', () => {
  it('carries the act’s own refusal sentence, unchanged, in its own element', async () => {
    const stages = stepperStages(REFUSED, { ...RUN, outcomes: REFUSED });
    const refused = stages[1]!;
    expect(refused.state).toBe('refused');
    const words = stagePanel({ here: refused, run: { ...RUN, outcomes: REFUSED }, counts: TABLES.counts, cursor: 'c2', onPath: true, focused: [] });
    expect(words.refusal).toBe(REFUSED[2]!.refusal);
    const panel = await mount(<StagePanel {...panelProps(words)} />);
    expect(panel.words()).toContain(REFUSED[2]!.refusal!);
    // a refusal is a STATUS, not prose folded into the paragraph above it
    expect(panel.host.querySelector('[role="status"]')?.textContent).toBe(REFUSED[2]!.refusal);
    await panel.unmount();
  });

  it('announces the declared-and-impossible stage wherever the cursor is — in a handful of words', async () => {
    const declared = PROT_UNAVAILABLE_STAGES[0]!;
    // the announcement is a fact about the DESK, so it is there for every position
    for (const here of [interactions, surface, null]) {
      expect(panelFor(here).unavailable).toEqual([{ id: declared.stage, name: declared.label, short: firstClause(declared.why) }]);
    }
    const panel = await mount(<StagePanel {...panelProps(panelFor(surface))} />);
    const said = panel.words();
    // the SHORT line is visible, and it is the measured reason's own first
    // clause — not a paraphrase of it
    expect(said).toContain('not available here');
    expect(said).toContain(declared.label);
    expect(said).toContain(firstClause(declared.why));
    expect(firstClause(declared.why).split(/\s+/).length, 'the visible line is a handful of words, not a paragraph').toBeLessThan(20);
    // …and the PARAGRAPH is not on screen until the fold is pressed
    expect(said).not.toContain('access-control-allow-origin');
    await panel.press(FOLD_ARIA);
    expect(panel.words()).toContain(declared.why);
    expect(panel.words()).toContain('access-control-allow-origin');
    await panel.unmount();
  });

  it('cuts that first clause at a punctuation boundary and never at a word count', () => {
    expect(firstClause('one thing, and another: the rest of it')).toBe('one thing, and another');
    expect(firstClause('one sentence. a second one')).toBe('one sentence.');
    expect(firstClause('nothing to cut')).toBe('nothing to cut');
    // the real one, and it stops where the measured reason's own colon is
    expect(firstClause(PROT_UNAVAILABLE_STAGES[0]!.why)).toBe('this stage needs a sequence-database search, and a static page cannot make one');
  });
});

describe('“no stage” is three different sentences, and never a guess', () => {
  it('says the root of the log when there is no cursor at all', () => {
    const words = stagePanel({ here: null, run: RUN, counts: TABLES.counts, cursor: null, onPath: false, focused: [] });
    expect(words.sentences[0]).toContain('at the root of this log');
  });

  it('says BEHIND every stage when the cursor is on the path but before them all', () => {
    const words = stagePanel({ here: null, run: RUN, counts: TABLES.counts, cursor: 'c0', onPath: true, focused: [] });
    expect(words.sentences[0]).toContain('behind every stage’s own commit');
  });

  it('refuses to guess when the cursor is off the active path — it draws no branch map and says so', () => {
    const words = stagePanel({ here: null, run: RUN, counts: TABLES.counts, cursor: 'somewhere-else', onPath: false, focused: [] });
    expect(words.sentences[0]).toContain('draws no branch map, and guessing would be worse than saying so');
  });
});

describe('LESS WORDS SHOWN — the panel is short, and what it folds is one press away', () => {
  it('shows the eyebrow, the sentences, the facts and the short line — and NOT the long prose', async () => {
    const panel = await mount(<StagePanel {...panelProps(panelFor(surface))} />);
    const said = panel.words();
    // the three things the follow-up round folded are absent from the DOM
    expect(said).not.toContain(SUMMARY);
    expect(said).not.toContain(CLAIM);
    expect(said).not.toContain(ROWS_NOTE);
    expect(said).not.toContain('access-control-allow-origin');
    // what stays is what the design draws
    expect(said).toContain(surface.subtitle);
    for (const fact of stageFacts(surface, RUN, TABLES.counts)) expect(said).toContain(fact.label);
    await panel.unmount();
  });

  it('counts fewer than 150 visible words, where the same panel used to run past 300', async () => {
    const panel = await mount(<StagePanel {...panelProps(panelFor(surface, RUN, ['How much of each residue the solvent can reach']))} />);
    const shown = panel.words().trim().split(/\s+/).filter((w) => w.length > 0).length;
    // measured on the built page before the follow-up round: 342 visible words.
    // The budget here is the CEILING, not the measurement — the measurement is
    // in the packet's report, taken in a real browser.
    expect(shown, `the panel shows ${String(shown)} words; the design's panel is three or four sentences and a <dl>`).toBeLessThan(150);
    await panel.unmount();
  });

  it('gives every folded word back on one press — folded is not lost', async () => {
    const panel = await mount(<StagePanel {...panelProps(panelFor(surface))} />);
    await panel.press(FOLD_ARIA);
    const said = panel.words();
    for (const folded of [SUMMARY, CLAIM, ROWS_NOTE, PROT_UNAVAILABLE_STAGES[0]!.why]) expect(said).toContain(folded);
    await panel.unmount();
  });

  it('uses the SAME affordance the cards use, and says so through aria-expanded', async () => {
    const panel = await mount(<StagePanel {...panelProps(panelFor(surface))} />);
    const button = ([...panel.host.querySelectorAll('[aria-label]')] as HTMLElement[]).find((el) => el.getAttribute('aria-label') === FOLD_ARIA);
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    await panel.press(FOLD_ARIA);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    await panel.unmount();
  });

  it('keeps a REFUSAL and a loud rows note visible — a refusal is never behind a press', async () => {
    const stages = stepperStages(REFUSED, { ...RUN, outcomes: REFUSED });
    const words = stagePanel({ here: stages[1]!, run: { ...RUN, outcomes: REFUSED }, counts: TABLES.counts, cursor: 'c2', onPath: true, focused: [] });
    const panel = await mount(
      <StagePanel {...panelProps(words)}>
        <p role="status">the rows at this commit were refused, in the library’s own words</p>
      </StagePanel>,
    );
    const said = panel.words();
    expect(said).toContain(REFUSED[2]!.refusal!);
    expect(said).toContain('the rows at this commit were refused');
    await panel.unmount();
  });
});

describe('the two facts the DESIGN got wrong are not on this screen', () => {
  it('never blames incomplete coordinates for a residue with no backbone angle', async () => {
    const panel = await mount(
      <>
        <StagePanel {...panelProps(panelFor(interactions))} />
        <StagePanel {...panelProps(panelFor(surface))} />
        <StagePanel {...panelProps(panelFor(null))} />
      </>,
    );
    const said = panel.words().toLowerCase();
    expect(said).not.toContain('coordinates are incomplete');
    expect(said).not.toContain('incomplete in the deposited file');
    await panel.unmount();
  });

  it('never claims a count of residues carrying the cross-chain contacts — the panel reads the counts the acts landed and no other', () => {
    const facts = stageFacts(interactions, RUN, TABLES.counts);
    // the design's "11 residues" is not a field of `InteractionCounts` at all;
    // what the act answers is how many CONTACTS cross, which is what is shown
    expect(facts.map((f) => f.label)).toContain('Crossing to another chain');
    expect(facts.map((f) => f.value)).toContain(RUN.pairs!.counts.crossing.toLocaleString('en-US'));
    expect(facts.map((f) => f.label).join(' ')).not.toContain('residues that carry');
  });
});
