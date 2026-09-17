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
import { INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { entryCredit, protTables } from '../src/prot/etl.js';
import { ARCHIVE_LICENCE } from '../src/prot/archive.js';
import { PROT_FILES } from '../src/data/files.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { useProtCells, type ProtCell, type ProtDeskData } from '../web/src/protCells.js';
import type { Row } from '../web/src/derive.js';
import { stepperStages } from '../web/src/protStages.js';
import { ChartCard, ViewerBox } from '../web/src/workbench/ChartCard.js';
import { FactsStrip, WorkbenchHeader } from '../web/src/workbench/Chrome.js';
import { factsStrip, methodLine } from '../web/src/workbench/bands.js';
import { chainChips, chainColorOf, chainInk, ownerLine, splitByFocus, stageOfChart } from '../web/src/workbench/charts.js';
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
    footRight={ownerLine(stageOfChart(stepperStages(OUTCOMES, RUN), cell.id, { [INTERFACE_VIEW]: { y: INTERFACE_CONTACTS_COLUMN }, [SURFACE_VIEW]: { y: SASA_COLUMN } }), 'from the file’s own columns — no act landed these')}
    note={cell.caption ?? null}
    noteLabel="Full note"
    noteAria={`the full note for ${cell.id}`}
    clear={null}
    height={200}
  >
    <div />
  </ChartCard>
);

describe('a card shows one line, and the long note is one press away', () => {
  it('shows the title and exactly ONE quiet line before anything is pressed', async () => {
    const panel = await mount(card(cellOf(SURFACE_VIEW)));
    const said = panel.words();
    expect(said).toContain(SURFACE_VIEW);
    expect(said).toContain('How to read: higher is more exposed to solvent');
    // exactly one `How to read` line, and the card's own paragraph count is one
    expect((said.match(/How to read:/g) ?? [])).toHaveLength(1);
    expect(panel.host.querySelectorAll('article > div > div > p')).toHaveLength(1);
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

  it('draws no how-to-read line at all for a view the library derived none for', async () => {
    const panel = await mount(card(cellOf(PAIRS_VIEW), null));
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

describe('the footer names what was plotted and which stage owns it', () => {
  it('counts from the rows on screen, on the cell that drew them', () => {
    expect(cellOf(SURFACE_VIEW).foot).toContain(`${ROWS.length.toLocaleString('en-US')} residues plotted`);
    expect(cellOf(SURFACE_VIEW).foot).toContain(`${String(RUN.surface!.counts.buried)} at exactly 0 Å²`);
    expect(cellOf(PAIRS_VIEW).foot).toContain(`${String(RUN.pairs!.counts.crossing)} cross-chain`);
  });

  it('credits the stage whose acts landed the column the view binds — and the FILE where no act did', () => {
    const stages = stepperStages(OUTCOMES, RUN);
    const shown = { [INTERFACE_VIEW]: { y: INTERFACE_CONTACTS_COLUMN }, [SURFACE_VIEW]: { y: SASA_COLUMN } };
    expect(stageOfChart(stages, SURFACE_VIEW, shown)?.stage).toBe('surface');
    expect(stageOfChart(stages, INTERFACE_VIEW, shown)?.stage).toBe('interactions');
    // the 3D view and the scatter draw the file's own columns: no stage put them there
    expect(stageOfChart(stages, STRUCTURE_VIEW, shown)).toBeNull();
    expect(ownerLine(stageOfChart(stages, SURFACE_VIEW, shown), 'from the file')).toBe(`Stage 2 · ${stages[1]!.label}`);
    expect(ownerLine(null, 'from the file')).toBe('from the file');
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

describe('the two top bands are read off the run, never typed', () => {
  it('the facts strip counts residues and chains off the PARSE, and contacts off the ACT', () => {
    const items = factsStrip(TABLES.counts, RUN);
    expect(items.map((i) => i.id)).toEqual(['residues', 'chains', 'contacts', 'kinds']);
    expect(items[0]!.parts[0]!.value).toBe(TABLES.counts.residues.toLocaleString('en-US'));
    expect(items[1]!.parts[0]!.value).toBe(String(TABLES.counts.chains.length));
    // one part per chain, each carrying that chain's own count
    expect(items[1]!.parts.slice(1).map((p) => p.value)).toEqual(TABLES.counts.chains.map((c) => c.residues.toLocaleString('en-US')));
    expect(items[2]!.parts.map((p) => p.value)).toEqual([RUN.pairs!.counts.rows.toLocaleString('en-US'), RUN.pairs!.counts.crossing.toLocaleString('en-US')]);
    expect(items[3]!.parts.map((p) => p.after)).toEqual(RUN.pairs!.counts.byKind.map((k) => k.kind));
  });

  it('shows NO contact fact at all before the interactions act has landed — absent, never a zero', () => {
    const items = factsStrip(TABLES.counts, null);
    expect(items.map((i) => i.id)).toEqual(['residues', 'chains']);
  });

  it('puts every one of those numbers on screen', async () => {
    const panel = await mount(<FactsStrip label="what this entry is, counted" items={factsStrip(TABLES.counts, RUN)} />);
    const said = panel.words();
    for (const value of [TABLES.counts.residues, RUN.pairs!.counts.rows, RUN.pairs!.counts.crossing]) expect(said).toContain(value.toLocaleString('en-US'));
    for (const chain of TABLES.counts.chains) expect(said).toContain(`${chain.chain} ${chain.residues.toLocaleString('en-US')}`);
    await panel.unmount();
  });

  it('the header’s method line is the FILE’s own records plus the one licence constant', async () => {
    const line = methodLine(CREDIT);
    expect(line).toBe(`${CREDIT.experiment.toLowerCase()} · ${CREDIT.resolution!} Å · ${ARCHIVE_LICENCE.split(' ')[0]!}`);
    // the resolution is the file's own digits, not a rounded copy
    expect(CREDIT.resolution).toBe('1.70');
    const panel = await mount(<WorkbenchHeader title="t" entry={CREDIT.entry} entryTitle={CREDIT.title.toLowerCase()} method={line} searchAgain="New search" onSearchAgain={() => undefined} />);
    const said = panel.words();
    expect(said).toContain(CREDIT.entry);
    expect(said).toContain(CREDIT.title.toLowerCase());
    expect(said).toContain(line!);
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
