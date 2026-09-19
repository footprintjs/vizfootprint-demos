// @vitest-environment jsdom
/**
 * THERE IS NO PANEL. Every word it said is on the thing it was about.
 *
 * This file used to hold the prose band under the stepper to 150 visible words.
 * The author's ruling ended the band — *"no paragraphs, nothing similar — I
 * don't want a scrolling dashboard"* — so the file is RE-POINTED rather than
 * deleted, and its job is now the harder one: proving that a band nobody can
 * see any more did not take its sentences with it.
 *
 *   the eyebrow        → the focused card's note lead, and its foot
 *   the quiet line     → the focused card's `Full note`, beside the library's
 *                        own `How to read:`, with `stage 3` in Mono in front of
 *                        it. It was on the card's FACE for three rounds and
 *                        came off with that `How to read:` line: a card's face
 *                        is a title, a picture and one line of figures, because
 *                        *a scientist reading a Ramachandran plot does not care
 *                        about stage 1 or commits*. Neither sentence was
 *                        deleted, which is what this file is for.
 *   the recorder's
 *   sentences          → the same card's `Full note`
 *   the four facts     → the same card's own numbers, in Mono under the picture
 *   a refusal          → the same card, VISIBLE, never behind a press
 *   the "no stage"
 *   sentences          → the chrome, which is the only thing that still speaks
 *                        about the whole screen
 *   the three declared
 *   stages that will
 *   not run            → A CARD EACH, in the grid, with the reason inside it
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
import { CONSERVATION_ACT, CONSERVATION_BASIS_COLUMN, CONSERVATION_COLUMN, PROT_UNAVAILABLE_STAGES, SASA_COLUMN, SURFACE_ACT, CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT, type ConservationOutput } from '../src/prot/analyses.js';
import { SCORE_IS, SCORE_IS_NOT } from '../src/prot/conservation.js';
import { CONSENSUS } from '../src/prot/placement.js';
import { PROT_BLOCKED } from '../src/prot/plan.js';
import { protTables } from '../src/prot/etl.js';
import { PROT_FILES } from '../src/data/files.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { stepperStages } from '../web/src/protStages.js';
import { ChartCard } from '../web/src/workbench/ChartCard.js';
import { BLOCKED_CARDS, NARRATIVE_LINES, firstClause, placementSaid, stageFacts, stageWords } from '../web/src/workbench/panel.js';
import { columnTracks, rowTracks } from '../web/src/workbench/charts.js';

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
 * objects filled in — those are what the card's four facts are read off.
 */
const RUN: ProtRun = {
  outcomes: ALL_LANDED,
  conservation: null,
  annotation: null,
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
const at = (stage: string) => STAGES.find((s) => s.stage === stage)!;
const interactions = at('interactions');
const surface = at('surface');

const wordsFor = (here: typeof interactions | null, run: ProtRun | null = RUN, over: Partial<Parameters<typeof stageWords>[0]> = {}) =>
  stageWords({ here, run, counts: TABLES.counts, cursor: here === null ? null : (here.commit ?? null), onPath: true, focused: [], inFocus: null, promoted: null, ...over });

/** What the focused card's own fold is called on screen and for a screen reader. */
const NOTE = 'Full note';
const NOTE_ARIA = 'the full note for How much of each residue the solvent can reach';

/**
 * THE FOCUSED CARD AS THE COMPOSITION MOUNTS IT — the stage block and the note.
 *
 * `web/src/protDesk.tsx` builds the note out of the stage's own lead, its
 * account when it has one, the recorder's sentences and then the picture's own
 * caption. The test builds the same, so that what it presses is what a reader
 * presses.
 */
const cardFor = (words: ReturnType<typeof stageWords>, caption = 'the picture’s own long caption') => (
  <ChartCard
    id="surface"
    label="How much of each residue the solvent can reach"
    focused
    howToRead="a line with resnum on x, sasa on y"
    legend={[]}
    stage={{ mark: words.mark, line: words.line, facts: words.facts, refusal: words.refusal }}
    footLeft="185 residues plotted"
    // NULL, the way the desk wires it now: the stage attribution came off every
    // footer when the stepper's bar began following the FOCUS — one owner per
    // question (`web/src/workbench/charts.ts`, the note where `ownerLine` was)
    footRight={null}
    note={
      <>
        <p>{words.eyebrow}</p>
        {words.account === null ? null : <p>{words.account}</p>}
        {words.sentences.map((sentence) => (
          <p key={sentence.slice(0, 40)}>{sentence}</p>
        ))}
        <p>{caption}</p>
      </>
    }
    noteLabel={NOTE}
    noteAria={NOTE_ARIA}
    clear={null}
    height={200}
  >
    <div>the picture</div>
  </ChartCard>
);

describe('the focused card carries what the band used to say about the stage', () => {
  it('keeps the stage’s quiet line and the derived how-to-read line OFF the face, and both behind the one press', async () => {
    const words = wordsFor(surface);
    expect(words.line).toBe(surface.subtitle);
    expect(words.mark).toBe(`stage ${String(surface.number)}`);
    const panel = await mount(cardFor(words));
    /*
      A CARD'S FACE IS A TITLE, A PICTURE AND ONE LINE OF FIGURES. Engine
      vocabulary is not a reading of a picture — *a scientist reading a
      Ramachandran plot does not care about stage 1 or commits* — and the
      derived `How to read:` line describes an ENCODING the axis labels already
      show. So neither is above the picture.
    */
    expect(panel.words()).not.toContain(surface.subtitle);
    expect(panel.words()).not.toContain('How to read:');
    // …AND NEITHER IS DELETED: one press brings both back, with the Mono
    // prefix that stops a promoted picture being read as this stage's own
    await panel.press(NOTE_ARIA);
    const opened = panel.words();
    expect(opened).toContain(surface.subtitle);
    expect(opened).toContain(`stage ${String(surface.number)}`);
    expect(opened).toContain('How to read:');
    await panel.unmount();
  });

  it('names the stage by NUMBER and DECLARED SENTENCE in the note’s lead', () => {
    expect(wordsFor(surface).eyebrow).toBe(`Stage ${String(surface.number)} · ${surface.label}`);
    expect(wordsFor(interactions).eyebrow).toBe(`Stage ${String(interactions.number)} · ${interactions.label}`);
  });

  it('quotes the RECORDER’s own sentences in the note — the ones that name this stage, verbatim and in order', async () => {
    const words = wordsFor(interactions);
    const mine = RUN.narrative.filter((line) => line.includes(interactions.label));
    expect(mine.length).toBeGreaterThan(NARRATIVE_LINES);
    expect(words.sentences.slice(0, NARRATIVE_LINES)).toEqual(mine.slice(0, NARRATIVE_LINES));
    for (const line of RUN.narrative.filter((l) => !l.includes(interactions.label))) expect(words.sentences).not.toContain(line);
    // they are BEHIND the press, and every one of them comes back on it
    const panel = await mount(cardFor(words));
    expect(panel.words()).not.toContain(mine[0]!);
    await panel.press(NOTE_ARIA);
    for (const line of mine.slice(0, NARRATIVE_LINES)) expect(panel.words()).toContain(line);
    await panel.unmount();
  });

  it('ends the note with the one derived clause, which is about the SCREEN and not about the protein', () => {
    const one = wordsFor(surface, RUN, { focused: ['How much of each residue the solvent can reach'], inFocus: 'How much of each residue the solvent can reach' });
    expect(one.sentences.at(-1)).toContain('is in the focus because this stage produced it');
    expect(one.sentences.at(-1)).toContain('nobody typed that list');
    // a stage that produced TWO says which one is in the focus and where the other is
    const two = wordsFor(interactions, RUN, { focused: ['Contacts across the interface', 'Every contact the engine found'], inFocus: 'Contacts across the interface' });
    expect(two.sentences.at(-1)).toContain('Contacts across the interface is in the focus');
    expect(two.sentences.at(-1)).toContain('Every contact the engine found — a press away in the rail');
    // and a promotion says so instead, because the derived focus is not what a
    // reader is looking at then
    const promoted = wordsFor(surface, RUN, { focused: ['How much of each residue the solvent can reach'], inFocus: 'The complex, in three dimensions', promoted: 'The complex, in three dimensions' });
    expect(promoted.sentences.at(-1)).toContain('You promoted The complex, in three dimensions out of the rail');
    expect(promoted.sentences.at(-1)).toContain('Moving the cursor hands the focus back to the stage');
    // a stage with no picture at all says that rather than naming charts
    expect(wordsFor(surface, RUN, { focused: [] }).sentences.at(-1)).toContain('No chart on this desk is drawn from what this stage landed');
  });

  it('puts the four facts UNDER THE PICTURE, in Mono, as the stage’s own numbers', async () => {
    const words = wordsFor(surface);
    expect(words.facts).toHaveLength(4);
    const panel = await mount(cardFor(words));
    const said = panel.words();
    for (const fact of words.facts) {
      expect(said).toContain(fact.label);
      expect(said).toContain(fact.value);
    }
    // they are VISIBLE — the band's `<dl>` was never behind a press and neither is this
    await panel.unmount();
  });

  it('reads those facts off the acts’ own answers, field by field', () => {
    const counts = RUN.pairs!.counts;
    expect(stageFacts(interactions, RUN, TABLES.counts).map((f) => f.value)).toEqual([counts.reported.toLocaleString('en-US'), counts.rows.toLocaleString('en-US'), counts.crossing.toLocaleString('en-US'), counts.throughAlternateLocation.toLocaleString('en-US')]);
    const areas = RUN.surface!.counts;
    const facts = stageFacts(surface, RUN, TABLES.counts);
    expect(facts[0]!.value).toBe(`${areas.landed.toLocaleString('en-US')} / ${TABLES.counts.residues.toLocaleString('en-US')}`);
    expect(facts[1]!.value).toBe(areas.buried.toLocaleString('en-US'));
    expect(facts[2]!.value).toBe(areas.noValue.toLocaleString('en-US'));
    expect(facts[3]!.value).toBe(areas.noReference.toLocaleString('en-US'));
  });

  it('draws NO ROW AT ALL for a stage that landed no counts — an absence is absent', async () => {
    const stages = stepperStages([], null);
    const words = stageWords({ here: stages.find((s) => s.stage === 'interactions')!, run: null, counts: TABLES.counts, cursor: null, onPath: true, focused: [], inFocus: null, promoted: null });
    expect(words.facts).toEqual([]);
    const panel = await mount(cardFor(words));
    // *this stage has landed no counts to read* took a whole row under a
    // drawing to say nothing. Step 1 lands no counts because its answer IS the
    // table, and the card says that by having no row.
    expect(panel.words()).not.toContain('no counts to read');
    await panel.unmount();
  });

  it('keeps a REFUSAL visible and in its own element — never behind a press', async () => {
    const stages = stepperStages(REFUSED, { ...RUN, outcomes: REFUSED });
    const words = stageWords({ here: stages.find((s) => s.stage === 'surface')!, run: { ...RUN, outcomes: REFUSED }, counts: TABLES.counts, cursor: 'c2', onPath: true, focused: [], inFocus: null, promoted: null });
    expect(words.refusal).toBe(REFUSED[2]!.refusal);
    const panel = await mount(cardFor(words));
    expect(panel.words()).toContain(REFUSED[2]!.refusal!);
    expect(panel.host.querySelector('[role="status"]')?.textContent).toBe(REFUSED[2]!.refusal);
    await panel.unmount();
  });

  it('tells a REFUSAL from a step’s own ACCOUNT of itself — one is rust and visible, the other is prose for the note', () => {
    // the parse's step carries a paragraph about what it landed, and it is NOT a refusal
    const search = wordsFor(at('search'));
    expect(search.refusal).toBeNull();
    expect(search.account).toBe(at('search').detail);
    expect(search.account).toContain('the archive answers a browser directly');
    // a refused stage carries the sentence and no account
    const stages = stepperStages(REFUSED, { ...RUN, outcomes: REFUSED });
    const refused = stageWords({ here: stages.find((s) => s.stage === 'surface')!, run: { ...RUN, outcomes: REFUSED }, counts: TABLES.counts, cursor: 'c2', onPath: true, focused: [], inFocus: null, promoted: null });
    expect(refused.account).toBeNull();
    expect(refused.refusal).not.toBeNull();
  });
});

describe('“no stage” is three different sentences, and the CHROME carries them', () => {
  it('says the root of the log when there is no cursor at all', () => {
    const words = stageWords({ here: null, run: RUN, counts: TABLES.counts, cursor: null, onPath: false, focused: [], inFocus: null, promoted: null });
    expect(words.where).toContain('at the root of this log');
    expect(words.line).toBe(words.where);
  });

  it('says BEHIND every stage when the cursor is on the path but before them all', () => {
    expect(stageWords({ here: null, run: RUN, counts: TABLES.counts, cursor: 'c0', onPath: true, focused: [], inFocus: null, promoted: null }).where).toContain('behind every stage’s own commit');
  });

  it('refuses to guess when the cursor is off the active path — it draws no branch map and says so', () => {
    expect(stageWords({ here: null, run: RUN, counts: TABLES.counts, cursor: 'somewhere-else', onPath: false, focused: [], inFocus: null, promoted: null }).where).toContain('draws no branch map, and guessing would be worse than saying so');
  });

  it('is `null` when a stage IS standing, because the card says it then', () => {
    expect(wordsFor(surface).where).toBeNull();
  });
});

describe('THE CONSERVATION STAGE SAYS WHICH METHOD PLACED ITS NUMBERS — on its own line, not only in its note', () => {
  /** The conservation stage's acts and its own answer — the shape the orchestrator hands over. */
  const CONSERVED_ACT = landedAct({ stage: 'conservation', act: CONSERVATION_ACT, commit: 'c0', materialized: [CONSERVATION_COLUMN, CONSERVATION_BASIS_COLUMN] });
  const COUNTS = {
    residues: 185,
    scored: 162,
    absent: 23,
    method: 'consensus' as const,
    weaker: true,
    overlaps: 0,
    chains: [
      { chain: 'A', cited: 'PF00545.26', family: 'PF00545', familyName: 'ribonuclease', sequences: 283, declaredSequences: 283, positions: 100, domain: [5, 92] as const, domainResidues: 88, placed: 82, identities: 33, score: 79, residues: 96, scored: 82, absent: 14, method: 'consensus' as const, refusal: null },
      { chain: 'B', cited: 'PF01337.25', family: 'PF01337', familyName: 'Barstar', sequences: 69, declaredSequences: 69, positions: 97, domain: [1, 81] as const, domainResidues: 80, placed: 80, identities: 30, score: 99, residues: 89, scored: 80, absent: 9, method: 'consensus' as const, refusal: null },
    ],
  };
  const CONSERVED_RUN = { ...RUN, outcomes: [CONSERVED_ACT], conservation: { as: 'columns', table: 'residues', columns: {}, counts: COUNTS, refusals: [] } as unknown as ConservationOutput } as unknown as ProtRun;
  const stage = stepperStages([CONSERVED_ACT], CONSERVED_RUN).find((s) => s.stage === 'conservation')!;

  it('reads four facts off the act’s own answer: what was scored, what has no column, which alignments, and which method', () => {
    expect(stageFacts(stage, CONSERVED_RUN, TABLES.counts)).toEqual([
      { id: 'scored', label: 'Residues scored', value: '162 / 185' },
      { id: 'absent', label: 'No column, so no score', value: '23' },
      { id: 'cited', label: 'Alignments cited', value: 'PF00545.26 + PF01337.25 · 352 sequences' },
      { id: 'placed', label: 'Placed by', value: 'consensus — the weaker method' },
    ]);
  });

  it('puts the method ON THE STAGE’S OWN QUIET LINE, with the alignments it was placed against', () => {
    const said = placementSaid(stage, CONSERVED_RUN)!;
    expect(said.clause).toBe(`${CONSENSUS.said}, over PF00545.26 and PF01337.25`);
    const words = wordsFor(stage, CONSERVED_RUN);
    expect(words.line).toContain(said.clause);
    // the fold's own line is still there, and the clause is APPENDED to it
    expect(words.line.startsWith(stage.subtitle)).toBe(true);
  });

  it('leads the note with whose data it is, what the score is, what it is NOT, and the whole placement argument', () => {
    const words = wordsFor(stage, CONSERVED_RUN);
    expect(words.sentences[0]).toContain('THE ALIGNMENT IS CITED, NOT BUILT: PF00545.26 and PF01337.25');
    expect(words.sentences[1]).toContain(SCORE_IS);
    expect(words.sentences[1]).toContain(SCORE_IS_NOT);
    expect(words.sentences[2]).toBe(CONSENSUS.why);
  });

  it('says NOTHING of the kind for any other stage — an absence is absent', () => {
    expect(placementSaid(surface, RUN)).toBeNull();
    expect(placementSaid(interactions, RUN)).toBeNull();
    expect(wordsFor(surface).line).toBe(surface.subtitle);
  });

  it('carries every refusal the act reported, even when the act LANDED — the state that would otherwise be silent', () => {
    const oneChain = { ...CONSERVED_RUN, conservation: { as: 'columns', table: 'residues', columns: {}, counts: COUNTS, refusals: ['chain B (P11540) is in no Pfam family, so there is no curated alignment to score its residues against and no residue of chain B is scored. Every other chain\'s score stands.'] } as unknown as ConservationOutput } as unknown as ProtRun;
    expect(placementSaid(stage, oneChain)!.note).toContain("chain B (P11540) is in no Pfam family, so there is no curated alignment to score its residues against and no residue of chain B is scored. Every other chain's score stands.");
  });
});

describe('A STAGE THAT WILL NOT RUN HERE GETS A CARD, and the reason is inside it', () => {
  it('is one card per declared stage that will not run — ONE now, and the count is the story', () => {
    /*
      IT WAS THREE, THEN TWO, AND IT IS ONE. The conservation stage was one of
      them, declared to the def as unavailable on a measured reason that turned
      out to answer the wrong question; the annotation stage was another,
      blocked by US with nothing external in the way, and it was built. Both are
      landed stages with pictures now (`src/prot/analyses.ts` ·
      `PROT_UNAVAILABLE_STAGES` and `src/prot/plan.ts` · step 6 record the two
      reversals). The card list is folded from `PROT_BLOCKED`, so it followed
      without this file being edited for anything but the count.
    */
    expect(BLOCKED_CARDS.map((c) => c.id)).toEqual(PROT_BLOCKED.map((s) => s.stage));
    expect(BLOCKED_CARDS).toHaveLength(1);
    expect(BLOCKED_CARDS.map((c) => c.tag)).toEqual(['not on this build']);
    expect(PROT_UNAVAILABLE_STAGES).toEqual([]);
  });

  it('says WHERE THE PICTURE WOULD BE the reason’s own first clause, and never a paraphrase', () => {
    for (const card of BLOCKED_CARDS) {
      expect(card.short).toBe(firstClause(card.why));
      expect(card.why).toContain(card.short.replace(/\.$/, ''));
      expect(card.short.split(/\s+/).length, `${card.id}'s visible line is a paragraph, not a handful of words`).toBeLessThan(20);
    }
    // and each card's paragraph is the PLAN's own, which is the one owner of
    // those two sentences now that the def's unavailable list is empty
    for (const card of BLOCKED_CARDS) expect(card.why).toBe(PROT_BLOCKED.find((s) => s.stage === card.id)!.why);
  });

  it('cuts that first clause at a punctuation boundary and never at a word count', () => {
    expect(firstClause('one thing, and another: the rest of it')).toBe('one thing, and another');
    expect(firstClause('one sentence. a second one')).toBe('one sentence.');
    expect(firstClause('nothing to cut')).toBe('nothing to cut');
    // and over a real declared paragraph — the plan's own, cut at its first colon
    expect(firstClause(BLOCKED_CARDS[0]!.why)).toBe('this stage needs a model, and a static page cannot hold the key that would call one');
  });

  it('draws the card with the words where the marks would be — and NO chart, no axis, no frame pretending to be one', async () => {
    const card = BLOCKED_CARDS[0]!;
    const panel = await mount(
      <ChartCard
        id={`stage:${card.id}`}
        label={`${card.name} — ${card.tag}`}
        focused
        howToRead={null}
        legend={[]}
        footLeft={card.tag}
        footRight={null}
        note={
          <>
            <p>{card.label}</p>
            <p>{card.why}</p>
          </>
        }
        noteLabel={NOTE}
        noteAria={`the whole reason ${card.name} will not run on this build`}
        clear={null}
        height={200}
      >
        <div>
          <p>{card.short}</p>
          <p>{card.label}</p>
        </div>
      </ChartCard>,
    );
    const said = panel.words();
    // the short reason and the kind of blocked are IN the card
    expect(said).toContain(card.short);
    expect(said).toContain(card.tag);
    expect(said).toContain(card.name);
    // and what the step would answer, so the card is not only a refusal
    expect(said).toContain(card.label);
    // nothing in it is a picture: no svg, no canvas, no chart frame
    expect(panel.host.querySelector('svg:not([aria-hidden])')).toBeNull();
    expect(panel.host.querySelector('canvas')).toBeNull();
    expect(panel.host.querySelector('.vzf-chart-frame')).toBeNull();
    // the whole measured paragraph is one press away, on the same affordance
    expect(said).not.toContain(card.why);
    await panel.press(`the whole reason ${card.name} will not run on this build`);
    expect(panel.words()).toContain(card.why);
    await panel.unmount();
  });

  it('gives all three their whole reason behind that one press — folded is never lost', async () => {
    for (const card of BLOCKED_CARDS) {
      const panel = await mount(
        <ChartCard id={`stage:${card.id}`} label={card.name} focused howToRead={null} legend={[]} footLeft={card.tag} footRight={null} note={<p>{card.why}</p>} noteLabel={NOTE} noteAria={`the reason for ${card.name}`} clear={null} height={100}>
          <p>{card.short}</p>
        </ChartCard>,
      );
      await panel.press(`the reason for ${card.name}`);
      expect(panel.words(), `${card.id} lost its reason`).toContain(card.why);
      await panel.unmount();
    }
  });
});

describe('THE BAND IS GONE FROM THE COMPOSITION, and nothing prose-shaped replaced it', () => {
  /** The code, without the prose — the same reason `tests/prot-layers.test.ts` strips comments: these files EXPLAIN what they replaced. */
  const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const desk = code(readFileSync(join(process.cwd(), 'web', 'src', 'protDesk.tsx'), 'utf8'));

  it('renders no StagePanel and imports none — the component is deleted', () => {
    expect(desk).not.toContain('StagePanel');
    expect(() => readFileSync(join(process.cwd(), 'web', 'src', 'workbench', 'StagePanel.tsx'), 'utf8')).toThrow();
  });

  it('hands the stage’s words to the focused CARD instead', () => {
    expect(desk).toContain('stageWords({');
    expect(desk).toContain('stage={withStage ?');
  });

  it('draws the six steps, the focus, the rail and the drawer between the stepper and the foot — and no prose band', () => {
    // the marks of the L: one focus slot, a bottom strip, a right column whose
    // width scales between a floor and the width the design drew — and not one
    // fixed pixel height anywhere in the instrument
    /*
      THE TWO TRACK EXPRESSIONS MOVED TO THE RULES LAYER when the dividers
      landed: the reader may now move either boundary, so the DEFAULT has to be
      spelled from the same numbers the floors are folded from, and
      `workbench/charts.ts` · `COLUMN_CLAMP` is the one owner of `16rem`,
      `22vw` and `22.5rem` (`STRIP_FR` of `0.34`). The composition names the
      folds; the folds still produce the same expression this used to read
      literally, plus the divider's own 10px track — which is the ten pixels the
      grid's `gap` used to be, so the page at rest is unchanged to the pixel.
      `tests/prot-dividers.test.tsx` pins both strings exactly.
    */
    expect(desk).toContain('gridTemplateColumns: columnTracks(railHeld.share)');
    expect(desk).toContain('gridTemplateRows: rowTracks(stripHeld.share)');
    expect(columnTracks(null)).toBe('minmax(0, 1fr) 10px clamp(16rem, 22vw, 22.5rem)');
    expect(rowTracks(null)).toBe('minmax(0, 1fr) 10px minmax(0, 0.34fr)');
    // THE RIGHT COLUMN'S ROWS ARE NOT EQUAL: the panes that DRAW get `1fr`
    // each; the pane that says it instead, and the one card of blocked steps,
    // take their content's height and no more.
    //
    // THE FOLD MOVED WITH THE SLOTS. The column used to be split by each pane's
    // own shape (`drawnTall` / `saidTall`), which is exactly what made a focus
    // change reflow the whole desk — so the column now renders the panes the
    // SLOTS put in it, in slot order, and asks each one which track it wants
    // (`protDesk.tsx` · `columnTrack`). The resting expression is unchanged:
    // `minmax(0, 1fr) minmax(0, 1fr) auto auto`.
    expect(desk).toContain('tall.map(columnTrack)');
    expect(desk).toContain("c.id === STRUCTURE_VIEW ? 'auto' : 'minmax(0, 1fr)'");
    expect(desk).toContain("waiting.length === 0 ? '' : 'auto'");
    // AND THE ONE THING THAT MAY NOT COME BACK: a paragraph between the
    // stepper and the charts. The slice is exactly that stretch of the
    // composition — from the stepper to the line that opens the L.
    // the LAST one: the first is the `reading` phase's stepper, which is a
    // different composition (`RunStepper`) with the same component in it
    const from = desk.lastIndexOf('<StageStepper');
    // …up to the record drawer, which is written next and DRAWN at the bottom
    // edge: what is between the two is the whole of what a reader meets under
    // the marks, and it is markup for the L and nothing else
    const to = desk.indexOf('<RecordDrawer', from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const between = desk.slice(from, to);
    expect(between).not.toContain('<p');
    expect(between).not.toContain('font-serif');
    // and nothing but the stepper's own element is in it
    expect(between.replace(/\{\}/g, '').trim().endsWith('/>')).toBe(true);
  });
});

describe('the two facts the DESIGN got wrong are not on this screen', () => {
  it('never blames incomplete coordinates for a residue with no backbone angle', async () => {
    const panel = await mount(
      <>
        {cardFor(wordsFor(interactions))}
        {cardFor(wordsFor(surface))}
      </>,
    );
    const said = panel.words().toLowerCase();
    expect(said).not.toContain('coordinates are incomplete');
    expect(said).not.toContain('incomplete in the deposited file');
    await panel.unmount();
  });

  it('never claims a count of residues carrying the cross-chain contacts — it reads the counts the acts landed and no other', () => {
    const facts = stageFacts(interactions, RUN, TABLES.counts);
    expect(facts.map((f) => f.label)).toContain('Crossing to another chain');
    expect(facts.map((f) => f.value)).toContain(RUN.pairs!.counts.crossing.toLocaleString('en-US'));
    expect(facts.map((f) => f.label).join(' ')).not.toContain('residues that carry');
  });
});
