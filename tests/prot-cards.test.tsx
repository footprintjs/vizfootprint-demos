// @vitest-environment jsdom
/**
 * ONE VISIBLE LINE PER CARD, AND THE LONG NOTE ONE PRESS AWAY — the
 * omit-never-deny law, tested.
 *
 * The author's ruling was *less words*: one panel about the stage the reader is
 * on, and each chart reduced to its title plus a quiet `How to read:` line. The
 * constraint on that ruling is not negotiable: **nothing may be silently
 * dropped.** Today's captions are long because they are true — they say that 17
 * zeros mean the probe could not reach those residues, that a kind absent from
 * the list may be a kind nobody asked for, and that 15 contacts run through an
 * alternate location. So each one moved BEHIND a disclosure, and this file
 * asserts three things about that move:
 *
 *   1. before the press, the card shows exactly one line beside its title;
 *   2. the long note is NOT in the DOM;
 *   3. after the press it is — with those three sentences in it, word for word
 *      as `web/src/protCells.tsx` writes them.
 *
 * It also pins the two top bands and the chain colours, because those are the
 * other places a number or a hue could be typed rather than read.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT, SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import { CONSERVATION_VIEW, INTERFACE_VIEW, KNOWN_VIEW, PAIRS_VIEW, PROT_ENCODINGS, RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { entryCredit, protTables } from '../src/prot/etl.js';
import { ARCHIVE_LICENCE } from '../src/prot/archive.js';
import { PROT_FILES } from '../src/data/files.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { useProtCells, type ProtCell, type ProtDeskData } from '../web/src/protCells.js';
import type { Row } from '../web/src/derive.js';
import { actColumnsOf, stepperStages } from '../web/src/protStages.js';
import { ChartCard, ChartTile, ViewerBox } from '../web/src/workbench/ChartCard.js';
import { WorkbenchHeader } from '../web/src/workbench/Chrome.js';
import { methodLine } from '../web/src/workbench/bands.js';
import { byPlanStep, chainChips, chainColorOf, chainInk, promoteChartLabel, shapeOfView, splitByFocus, stageOfChart } from '../web/src/workbench/charts.js';
import { stageWords } from '../web/src/workbench/panel.js';
import { CHAIN_INK, VIEWER_BG } from '../web/src/workbench/tokens.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The committed entry, read from the project root — `tests/prot-landing.test.tsx` says why not through `snapshot.ts` under jsdom. */
const TEXT = readFileSync(join(process.cwd(), PROT_FILES.structure), 'utf8');
const TABLES = protTables(TEXT);
const CREDIT = entryCredit(TEXT);

async function mount(element: ReactElement): Promise<{ readonly host: HTMLElement; readonly words: () => string; readonly press: (label: string) => Promise<void>; readonly unmount: () => Promise<void> }> {
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
      if (button === undefined) throw new Error(`no control is called "${label}" — the page says: ${(host.textContent ?? '').slice(0, 300)}`);
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

// ── the cells, built the way the desk builds them ────────────────────────────

/** A desk with nothing selected and nothing said, plus the encoding fold the real def declares. */
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

const landedAct = (over: Partial<ActOutcome> = {}): ActOutcome => ({ stage: 'interactions', act: PAIRS_ACT, commit: 'c1', refusal: null, materialized: [], ...over });

const OUTCOMES: readonly ActOutcome[] = [
  landedAct(),
  landedAct({ act: CONTACTS_ACT, commit: 'c2', materialized: ['contacts', INTERFACE_CONTACTS_COLUMN, 'interface_separation'] }),
  landedAct({ stage: 'surface', act: SURFACE_ACT, commit: 'c3', materialized: [SASA_COLUMN, 'relative_sasa'] }),
];

/**
 * A run whose count objects carry the three facts this file is about: the
 * buried residues, the providers the engine was NOT asked for, and the contacts
 * that run through an alternate location.
 */
const RUN: ProtRun = {
  outcomes: OUTCOMES,
  narrative: [],
  // this file is about the two interaction/surface stages' counts, so the
  // conservation act's answer is absent — which is what a run with no family
  // evidence really carries
  conservation: null,
  annotation: null,
  pairs: {
    rows: [{ interaction_key: 'k1' }],
    counts: {
      reported: 231,
      rows: 224,
      crossing: 21,
      byKind: [{ kind: 'hydrogen-bond', contacts: 220 }, { kind: 'pi-stacking', contacts: 3 }, { kind: 'cation-pi', contacts: 1 }],
      providersOn: ['hydrogen-bonds', 'hydrophobic'],
      providersOff: ['metal-coordination', 'halogen-bonds'],
      throughAlternateLocation: 15,
    },
    dropped: [{ reason: 'contacts with an end the residues table has no row for', contacts: 7, why: 'why' }],
  } as unknown as ProtRun['pairs'],
  contacts: null,
  surface: { counts: { probeSize: 1.4, spherePoints: 960, nonPolymer: false, traceOnly: false, engineTotal: 1, landed: 185, noValue: 0, noReference: 3, buried: 17 } } as unknown as ProtRun['surface'],
};

/** The rows as they stand once both stages have landed: every column the acts wrote, on every residue. */
const ROWS: readonly Row[] = TABLES.residues.map((row, index) => ({ ...row, [INTERFACE_CONTACTS_COLUMN]: index % 4, [SASA_COLUMN]: 10 + index, relative_sasa: 0.1 })) as readonly Row[];

const DATA: ProtDeskData = {
  residues: ROWS,
  counts: TABLES.counts,
  skipped: TABLES.skipped,
  structure: { at: 'data/prot/1ay7.pdb', text: TEXT, characters: TEXT.length },
  run: RUN,
  refusals: {},
  notes: [],
};

/** The cells, built once from a component body the way the desk builds them. */
function cells(): readonly ProtCell[] {
  let built: readonly ProtCell[] = [];
  function Probe(): null {
    built = useProtCells(QUIET, DATA);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

const cellOf = (id: string): ProtCell => cells().find((c) => c.id === id)!;

/** A caption's words, tags stripped — so an assertion can quote the sentence a reader sees. */
const textOf = (node: React.ReactNode): string =>
  renderToStaticMarkup(<>{node}</>)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x2014;/g, '—')
    .replace(/\s+/g, ' ');

/** One card, wired the way `web/src/protDesk.tsx` wires it. */
const card = (cell: ProtCell, howToRead: string | null = 'higher is more exposed to solvent'): ReactElement => (
  <ChartCard
    id={cell.id}
    label={cell.id}
    focused
    howToRead={howToRead}
    legend={[]}
    footLeft={cell.foot}
    // NULL EVERYWHERE, the way the desk wires it now: the stage attribution
    // came off every footer when the stepper's bar began following the focus
    // (`web/src/workbench/charts.ts`, the note where `ownerLine` was)
    footRight={null}
    note={cell.caption ?? null}
    noteLabel="Full note"
    noteAria={`the full note for ${cell.id}`}
    clear={null}
    height={200}
  >
    <div />
  </ChartCard>
);

describe('a card shows a title, a picture and one line of figures — and the words are one press away', () => {
  it('puts NO PROSE ABOVE THE PICTURE: not the derived how-to-read line, not the stage\u2019s own', async () => {
    const panel = await mount(card(cellOf(SURFACE_VIEW)));
    const said = panel.words();
    expect(said).toContain(SURFACE_VIEW);
    /*
      THE AUTHOR'S RULING: *a scientist reading a Ramachandran plot does not
      care about stage 1 or commits*, and the derived `How to read:` line
      describes an ENCODING a reader can read off the axis labels. So the face
      is a title, a picture and the Mono footer — and the header block holds no
      paragraph at all.
    */
    expect(said).not.toContain('How to read:');
    expect(panel.host.querySelectorAll('article > div > div > p')).toHaveLength(0);
    await panel.unmount();
  });

  it('holds BOTH of those sentences behind Full note, whole — nothing was deleted', async () => {
    const panel = await mount(card(cellOf(SURFACE_VIEW)));
    await panel.press(`the full note for ${SURFACE_VIEW}`);
    const opened = panel.words();
    expect(opened).toContain('How to read: higher is more exposed to solvent');
    expect((opened.match(/How to read:/g) ?? [])).toHaveLength(1);
    await panel.unmount();
  });

  it('gives a card whose picture has NO long caption a Full note all the same, so the move off the face is never a deletion', async () => {
    const panel = await mount(
      <ChartCard id={SURFACE_VIEW} label="the run" focused howToRead="higher is more exposed to solvent" legend={[]} footLeft={null} footRight={null} note={null} noteLabel="Full note" noteAria="the note" clear={null} height={200}>
        <div />
      </ChartCard>,
    );
    expect(panel.words()).not.toContain('How to read:');
    await panel.press('the note');
    expect(panel.words()).toContain('How to read: higher is more exposed to solvent');
    await panel.unmount();
  });

  it('keeps the long note OUT of the DOM until the disclosure is opened — and then puts every word of it in', async () => {
    const cell = cellOf(SURFACE_VIEW);
    const note = textOf(cell.caption);
    // the sentence that is the whole reason this note may not be deleted
    expect(note).toContain('have an area of exactly zero');
    const panel = await mount(card(cell));
    expect(panel.words()).not.toContain('have an area of exactly zero');
    await panel.press(`the full note for ${SURFACE_VIEW}`);
    const opened = panel.words();
    expect(opened).toContain('17 of the 185 residues have an area of exactly zero');
    expect(opened).toContain('THE CHAINS SHARE THE AXIS');
    await panel.unmount();
  });

  it('says aria-expanded on the disclosure, so a reader and a test can both tell', async () => {
    const panel = await mount(card(cellOf(RAMA_VIEW)));
    const button = ([...panel.host.querySelectorAll('[aria-label]')] as HTMLElement[]).find((el) => el.getAttribute('aria-label') === `the full note for ${RAMA_VIEW}`);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    await panel.press(`the full note for ${RAMA_VIEW}`);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    await panel.unmount();
  });

  it('carries the cell’s address as data-chart — the one attribute the browser smoke test names a picture by', async () => {
    const panel = await mount(card(cellOf(SURFACE_VIEW)));
    expect(panel.host.querySelector(`[data-chart="${SURFACE_VIEW}"]`)).not.toBeNull();
    await panel.unmount();
  });

  it('says nothing about how to read a view the library derived no line for — not on the face and not in the note', async () => {
    const panel = await mount(card(cellOf(PAIRS_VIEW), null));
    expect(panel.words()).not.toContain('How to read');
    await panel.press(`the full note for ${PAIRS_VIEW}`);
    expect(panel.words()).not.toContain('How to read');
    await panel.unmount();
  });
});

describe('the three sentences that had to stay reachable, and where they are now', () => {
  const behind = (id: string): string => textOf(cellOf(id).caption);

  it('the 17 zeros mean the probe could not reach those residues — in the surface card’s note', () => {
    expect(behind(SURFACE_VIEW)).toContain(`${String(RUN.surface!.counts.buried)} of the ${String(RUN.surface!.counts.landed)} residues have an area of exactly zero`);
    expect(behind(SURFACE_VIEW)).toContain('the probe cannot touch them anywhere');
  });

  it('a kind absent from the list may be a kind nobody asked for — in the interface card’s note', () => {
    expect(behind(INTERFACE_VIEW)).toContain('a kind missing from the list above may simply be a kind nobody looked for');
    for (const provider of RUN.pairs!.counts.providersOff) expect(behind(INTERFACE_VIEW)).toContain(provider);
  });

  it('15 contacts run through an alternate location — in the receipt card’s note', () => {
    expect(behind(PAIRS_VIEW)).toContain(`${String(RUN.pairs!.counts.throughAlternateLocation)} of these contacts run through an ALTERNATE LOCATION`);
  });

  it('and the one this desk has to keep VISIBLE: a picture that cannot be drawn says why, in the library’s own words', () => {
    // the refusal is the cell's BODY, not its caption — so it is on screen
    // whatever the disclosure is doing, which is the only honest place for it
    const refused: ProtDeskData = { ...DATA, residues: TABLES.residues as readonly Row[], run: null, refusals: { [SURFACE_VIEW]: `no column "${SASA_COLUMN}" in table "residues"` } };
    let built: readonly ProtCell[] = [];
    function Probe(): null {
      built = useProtCells(QUIET, refused);
      return null;
    }
    renderToStaticMarkup(<Probe />);
    const body = renderToStaticMarkup(built.find((c) => c.id === SURFACE_VIEW)!.render({ width: 400, height: 200 }) as ReactElement);
    expect(body).toContain('role="status"');
    expect(body).toContain(`no column &quot;${SASA_COLUMN}&quot; in table &quot;residues&quot;`);
  });
});

describe('the footer is the counts, and the stage is the STEPPER\u2019s answer now', () => {
  it('counts from the rows on screen, on the cell that drew them', () => {
    expect(cellOf(SURFACE_VIEW).foot).toContain(`${ROWS.length.toLocaleString('en-US')} residues plotted`);
    expect(cellOf(SURFACE_VIEW).foot).toContain(`${String(RUN.surface!.counts.buried)} at exactly 0 Å²`);
    expect(cellOf(PAIRS_VIEW).foot).toContain(`${String(RUN.pairs!.counts.crossing)} cross-chain`);
  });

  it('still knows which stage owns each picture — the fold stayed, only the printing went', () => {
    const stages = stepperStages(OUTCOMES, RUN);
    const shown = { [INTERFACE_VIEW]: { y: INTERFACE_CONTACTS_COLUMN }, [SURFACE_VIEW]: { y: SASA_COLUMN }, [STRUCTURE_VIEW]: { color: 'chain' } };
    const columns = actColumnsOf(stages);
    expect(stageOfChart(stages, SURFACE_VIEW, shown, columns)?.stage).toBe('surface');
    expect(stageOfChart(stages, INTERFACE_VIEW, shown, columns)?.stage).toBe('interactions');
    /*
      THE 3D VIEW IS STEP 1'S, and this is the half-truth an earlier packet
      fixed: the foot used to say *"from the file's own columns — no act landed
      these"*, which reads as an absence, as though nobody were responsible for
      those columns. The parse is — and the parse is step 1 of the published
      plan.
    */
    expect(stageOfChart(stages, STRUCTURE_VIEW, shown, columns)?.stage).toBe('search');
  });

  it('NO LONGER PRINTS IT ON THE CARD — `ownerLine` is gone, and this is where the fact is instead', async () => {
    /*
      ONE OWNER PER QUESTION. The question is *which stage produced the picture
      I am looking at*, and the stepper answers it now that its bar and
      `aria-current` follow the FOCUS (`web/src/workbench/steps.ts` ·
      `stepViews`): press any tile and the bar moves to its stage. The fact was
      being printed on eight cards at once.

      THE CHECK THAT HAD TO COME FIRST: it is not the last copy of anything.
      The stage is on the stepper, and at the lead of the card's own note.
    */
    const stages = stepperStages(OUTCOMES, RUN);
    const surface = stages.find((s) => s.stage === 'surface')!;
    expect(stageWords({ here: surface, run: RUN, counts: TABLES.counts, cursor: null, onPath: false, focused: [], inFocus: null, promoted: null }).eyebrow).toBe(
      `Stage ${String(surface.number)} · ${surface.label}`,
    );
    // and the card's own face says nothing about a stage at all
    const panel = await mount(card(cellOf(SURFACE_VIEW)));
    expect(panel.words()).not.toContain(`Stage ${String(surface.number)}`);
    await panel.unmount();
  });

  it('draws no footer count for a picture with nothing to count yet', () => {
    const nothing: ProtDeskData = { ...DATA, residues: TABLES.residues as readonly Row[], run: null };
    let built: readonly ProtCell[] = [];
    function Probe(): null {
      built = useProtCells(QUIET, nothing);
      return null;
    }
    renderToStaticMarkup(<Probe />);
    expect(built.find((c) => c.id === SURFACE_VIEW)!.foot).toBeNull();
    expect(built.find((c) => c.id === PAIRS_VIEW)!.foot).toBeNull();
  });
});

describe('WHICH CARD IS BIG is derived, so moving the stepper moves the hero', () => {
  it('puts the focused view in the hero band and everything else in the one that recedes', () => {
    const all = cells();
    const { hero, rest } = splitByFocus(all, new Set([SURFACE_VIEW]));
    expect(hero.map((c) => c.id)).toEqual([SURFACE_VIEW]);
    expect(rest.map((c) => c.id)).not.toContain(SURFACE_VIEW);
    expect(hero.length + rest.length).toBe(all.length);
    // nothing focused: no hero band at all, which is what the composition draws
    expect(splitByFocus(all, new Set()).hero).toEqual([]);
  });
});

describe('THE COUNTED-FACTS BAND IS GONE, because every line of it was a second copy', () => {
  /**
   * `factsStrip` folded the entry's counts into a band under the header and
   * `FactsStrip` drew it. Both are deleted, and the reason is not the height
   * budget: EVERY LINE OF IT WAS ALREADY ON THE CARD IT BELONGED TO, and a
   * count stated twice is a count that can disagree with itself. This block is
   * the proof that dropping the band dropped no number.
   */
  it('has no fold and no component left to draw one', () => {
    const chrome = readFileSync(join(process.cwd(), 'web', 'src', 'workbench', 'Chrome.tsx'), 'utf8');
    const bands = readFileSync(join(process.cwd(), 'web', 'src', 'workbench', 'bands.ts'), 'utf8');
    expect(chrome).not.toContain('export function FactsStrip');
    expect(bands).not.toContain('export function factsStrip');
    // and the composition draws no band between the stepper and the charts
    expect(readFileSync(join(process.cwd(), 'web', 'src', 'protDesk.tsx'), 'utf8')).not.toContain('<FactsStrip');
  });

  it('keeps the residue and chain counts on the STRUCTURE card’s own foot', () => {
    const foot = cellOf(STRUCTURE_VIEW).foot ?? '';
    expect(foot).toContain(TABLES.counts.residues.toLocaleString('en-US'));
    expect(foot).toContain(`${String(TABLES.counts.chains.length)} chains drawn`);
  });

  it('keeps the contact counts on the PAIR TABLE’s foot, and the kinds in the interface card’s note', () => {
    // the foot counts THE ROWS THIS CELL DREW (the fixture hands it one) and the
    // act's own crossing count beside them — never a number typed twice
    expect(cellOf(PAIRS_VIEW).foot ?? '').toContain('rows');
    expect(cellOf(PAIRS_VIEW).foot ?? '').toContain(`${RUN.pairs!.counts.crossing.toLocaleString('en-US')} cross-chain`);
    // the kinds, with the engine's own words and counts
    const note = renderToStaticMarkup(<>{cellOf(INTERFACE_VIEW).caption}</>).replace(/<[^>]+>/g, ' ');
    for (const kind of RUN.pairs!.counts.byKind) expect(note).toContain(`${kind.contacts.toLocaleString('en-US')} ${kind.kind}`);
  });
});

describe('the header band is read off the run, never typed', () => {
  it('the header’s method line is the FILE’s own records plus the one licence constant', async () => {
    const line = methodLine(CREDIT);
    expect(line).toBe(`${CREDIT.experiment.toLowerCase()} · ${CREDIT.resolution!} Å · ${ARCHIVE_LICENCE.split(' ')[0]!}`);
    // the resolution is the file's own digits, not a rounded copy
    expect(CREDIT.resolution).toBe('1.70');
    const panel = await mount(
      <WorkbenchHeader
        title="t"
        entry={CREDIT.entry}
        entryTitle={CREDIT.title.toLowerCase()}
        method={line}
        at={<span role="status">every picture below is drawn from the 185 residue rows as they stand at commit s4</span>}
        searchAgain="New search"
        onSearchAgain={() => undefined}
      />,
    );
    const said = panel.words();
    expect(said).toContain(CREDIT.entry);
    expect(said).toContain(CREDIT.title.toLowerCase());
    expect(said).toContain(line!);
    /*
      AND WHICH POINT IN THE RUN the pictures come from. It is the only thing on
      screen that says so and the stepper exists to move it, so it sits in the
      band that answers *what am I looking at* — the same question about time.
    */
    expect(said).toContain('as they stand at commit s4');
    expect(panel.host.querySelector('[role="status"]')).not.toBeNull();
    await panel.unmount();
  });

  it('draws no method line for an entry whose records state none of it', () => {
    expect(methodLine({ ...CREDIT, experiment: '', resolution: null })).toBe('CC0');
  });
});

describe('the chain colours come from the theme and are told to the library, never painted by hand', () => {
  it('pairs the chains with the design’s two hues, in the order the FILE first mentions them', () => {
    const ink = { chainA: CHAIN_INK.light.a, chainB: CHAIN_INK.light.b, accent: CHAIN_INK.light.a, viewerBg: VIEWER_BG };
    expect(chainInk(TABLES.counts, ink)).toEqual([
      { chain: TABLES.counts.chains[0]!.chain, color: CHAIN_INK.light.a },
      { chain: TABLES.counts.chains[1]!.chain, color: CHAIN_INK.light.b },
    ]);
  });

  it('answers a category the entry has no chain for with the accent — never with a chain’s own colour', () => {
    const ink = { chainA: CHAIN_INK.dark.a, chainB: CHAIN_INK.dark.b, accent: '#ffffff', viewerBg: VIEWER_BG };
    const colorOf = chainColorOf(TABLES.counts, ink);
    expect(colorOf(TABLES.counts.chains[0]!.chain)).toBe(CHAIN_INK.dark.a);
    expect(colorOf(TABLES.counts.chains[1]!.chain)).toBe(CHAIN_INK.dark.b);
    // a re-encode has moved `color` onto another column, or the series is unsplit
    expect(colorOf('not-a-chain')).toBe('#ffffff');
    expect(colorOf(undefined)).toBe('#ffffff');
  });

  it('hands the viewer well one chip per chain, with the chain’s own name', async () => {
    const ink = { chainA: CHAIN_INK.light.a, chainB: CHAIN_INK.light.b, accent: CHAIN_INK.light.a, viewerBg: VIEWER_BG };
    const chips = chainChips(TABLES.counts, ink);
    expect(chips.map((c) => c.name)).toEqual(TABLES.counts.chains.map((c) => `chain ${c.chain}`));
    const panel = await mount(
      <ViewerBox chips={chips}>
        <div />
      </ViewerBox>,
    );
    for (const chip of chips) expect(panel.words()).toContain(chip.name);
    await panel.unmount();
  });
});

describe('THE L: a focus that fills its slot, a strip of wide tiles, a column of square ones', () => {
  /**
   * The layout is ASPECT RATIO and nothing else — the design's own artboards:
   * the surface run at 3.4 : 1 and the cross-chain bars at 3.9 : 1 want width,
   * the Ramachandran at 1 : 1 and the molecule want a square, and the contact
   * table wants height and scrolls itself. Which is which is read off the DEF's
   * declared `chartKind`, so a new view lands in the right place without this
   * desk being told about it.
   */
  it('reads the shape each picture wants off the def’s own declared chart kind', () => {
    expect(shapeOfView(SURFACE_VIEW)).toBe('wide');
    expect(shapeOfView(INTERFACE_VIEW)).toBe('wide');
    expect(shapeOfView(RAMA_VIEW)).toBe('square');
    expect(shapeOfView(STRUCTURE_VIEW)).toBe('square');
    // a view the def gives no encoding surface shows ROWS, and rows want height
    expect(shapeOfView(PAIRS_VIEW)).toBe('tall');
    // …and it is the DEF's own `chartKind` that decides it, which is why a view
    // the def gives no encoding surface falls to `tall` rather than to a guess
    // TWO LINES NOW: the surface run and the conservation run, both plotted
    // against sequence position and both unreadable narrow
    expect(shapeOfView(CONSERVATION_VIEW)).toBe('wide');
    // AND TWO BARS: the interface counts and stage 6's named residues, which is
    // declared on every build because every build performs that stage
    expect(shapeOfView(KNOWN_VIEW)).toBe('wide');
    expect(PROT_ENCODINGS.map((e) => e.chartKind).sort()).toEqual(['bar', 'bar', 'line', 'line', 'scatter', 'structure']);
  });

  it('orders what waits by the PLAN’s own steps, with a picture no step produced last', () => {
    const stages = stepperStages(OUTCOMES, RUN);
    const step = (id: string): number | null => stages.find((s) => s.stage === id)?.number ?? null;
    const ordered = byPlanStep([
      { step: step('interactions'), item: 'the contacts stage’s' },
      { step: null, item: 'nobody’s' },
      { step: step('surface'), item: 'the surface stage’s' },
      { step: step('search'), item: 'the parse’s' },
    ]);
    expect(ordered).toEqual(['the parse’s', 'the surface stage’s', 'the contacts stage’s', 'nobody’s']);
  });

  it('gives the focused card a DEFINITE box and lets the picture fill it', () => {
    /*
      READ OFF THE STATIC MARKUP rather than the mounted DOM: jsdom's CSSOM
      does not serialise the `flex` shorthand at all, so a mounted card's own
      `style` attribute cannot be asked about the one declaration that matters
      here. The markup React writes is what a browser parses.
    */
    const html = renderToStaticMarkup(
      <ChartCard id={SURFACE_VIEW} label="the run" focused howToRead={null} legend={[]} footLeft={null} footRight={null} note={null} noteLabel="Full note" noteAria="the note" clear={null} height="fill">
        <div>the picture</div>
      </ChartCard>,
    );
    // the card takes the whole height its slot gives it…
    expect(html).toContain('height:100%;min-height:0;overflow:hidden');
    // …and the box the library's frame measures is `flex: 1 1 0` inside it,
    // which is the definite height `ChartFrame`'s ResizeObserver needs before
    // it can hand a size to the chart
    expect(html).toContain('flex:1 1 0;min-height:0');
    // a card given a NUMBER keeps the old fixed box, which is what a card in a
    // scrolling band wants
    const fixed = renderToStaticMarkup(
      <ChartCard id={SURFACE_VIEW} label="the run" focused howToRead={null} legend={[]} footLeft={null} footRight={null} note={null} noteLabel="Full note" noteAria="the note" clear={null} height={280}>
        <div>the picture</div>
      </ChartCard>,
    );
    expect(fixed).toContain('height:280px');
    expect(fixed).not.toContain('flex:1 1 0');
  });

  it('draws a TILE as a name, a count and ITS OWN MARKS — because a card cannot show a selection', async () => {
    let promoted: string | null = null;
    const panel = await mount(
      <ChartTile
        id={SURFACE_VIEW}
        label="How much of each residue the solvent can reach"
        said="185 residues plotted · 17 at exactly 0 Å²"
        promote={{ label: promoteChartLabel('How much of each residue the solvent can reach'), onPress: () => (promoted = SURFACE_VIEW) }}
      >
        <svg aria-hidden="true">
          <circle className="vzf-line-dot" />
        </svg>
      </ChartTile>,
    );
    const said = panel.words();
    expect(said).toContain('How much of each residue the solvent can reach');
    expect(said).toContain('185 residues plotted');
    /*
      IT DRAWS. For one round a tile was words only, on the ground that a
      library chart at 150px is a texture rather than a reading — and what
      overturned that is the REASON focus mode exists: these views are
      crossfiltered, so a pick in one narrows the others, and a tile that shows
      no marks cannot show that. 185 marks dropping to 12 is perfectly legible
      at tile size, because it is a change in DENSITY and not a value read off
      an axis.
    */
    expect(panel.host.querySelector('circle.vzf-line-dot')).not.toBeNull();
    // THE HEADER IS THE CONTROL, not the whole tile: the picture inside is the
    // library's and is LIVE, and a button may not contain its axis controls —
    // nor swallow the gesture that makes the tile worth drawing.
    const buttons = [...panel.host.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute('aria-label')).toBe(promoteChartLabel('How much of each residue the solvent can reach'));
    expect(panel.host.querySelector('[data-chart]')?.getAttribute('data-chart')).toBe(SURFACE_VIEW);
    await act(async () => {
      buttons[0]?.click();
    });
    expect(promoted).toBe(SURFACE_VIEW);
    await panel.unmount();
  });

  it('draws NO picture for a step that will not run here — it has nothing to filter', async () => {
    const panel = await mount(<ChartTile id="stage:hotspots" label="Hot Spot Prediction — not on this build" said="this stage needs a model, and a static page cannot hold the key that would call one" promote={{ label: 'bring it into the focus', onPress: () => undefined }} />);
    expect(panel.words()).toContain('not on this build');
    expect(panel.host.querySelector('svg:not([aria-hidden])')).toBeNull();
    expect(panel.host.querySelector('.vzf-chart-frame')).toBeNull();
    await panel.unmount();
  });

  it('says what comes WITH the picture when it is promoted, because the tile carries none of it', () => {
    const label = promoteChartLabel('the run');
    expect(label).toContain('into the focus');
    expect(label).toContain('its full note');
    expect(label).toContain('its own numbers');
    expect(label).toContain('the stage that landed it');
  });

  it('puts the LIBRARY’S OWN refusal in the tile when there is nothing to draw at this cursor', async () => {
    // a cell whose column no act has landed counts nothing, and at that cursor
    // the refusal is the truth about that picture — it needs no marks to say
    const panel = await mount(
      <ChartTile id={SURFACE_VIEW} label="the run" said={`no column "${SASA_COLUMN}" in table "residues"`} promote={{ label: 'bring the run into the focus', onPress: () => undefined }} />,
    );
    expect(panel.words()).toContain(`no column "${SASA_COLUMN}" in table "residues"`);
    await panel.unmount();
  });
});
