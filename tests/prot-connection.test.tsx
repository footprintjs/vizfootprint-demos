// @vitest-environment jsdom
/**
 * EVERY PICTURE SAYS WHAT THE SELECTION DID TO IT — the four states, over a
 * REAL session, in the sentence a reader sees.
 *
 * ── THE COMPLAINT THIS FILE EXISTS FOR ─────────────────────────────────────
 * The author, four times, in their own words: *all the charts have to be
 * connected — that's very critical. Still now I don't see the connection.* And
 * they were right about what they SAW while the machinery underneath was
 * working: measured in a real browser, a pick on one bar takes the focused
 * chart from 185 marks to 1 in 22 ms and dims 180 of 181 in the backbone-angle
 * pane, with nothing scrolled. What no pane ever did was SAY it had been
 * narrowed by something the reader did somewhere else — and **a connection
 * nobody can see is the same as no connection.**
 *
 * ── THE FOUR STATES, and why the second one is the load-bearing one ────────
 *   1. `narrowed`     the clause reached this pane and cut it.
 *   2. `nothing-cut`  the clause reached this pane and cut NOTHING. Said out
 *                     loud, in the library's own words, because SILENCE HERE
 *                     READS AS "not connected" — which is the whole complaint.
 *   3. `unreachable`  the clause cannot be judged here at all, with the reason.
 *   4. (nothing)      nothing selected anywhere: no line, on any pane.
 *
 * ── AND NOT ONE NUMBER BELOW IS A LITERAL ──────────────────────────────────
 * Every count asserted here is folded in the test from the committed entry's
 * own rows, and every NAME from the def's own declared label as the session
 * serves it. A sentence pinned against a hand-typed number would pass while the
 * page lied about the picture beside it, which is the one failure this packet
 * is about. The browser half — the sentences against the marks actually drawn —
 * is `tests/prot-crossfilter.smoke.test.ts`.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildDashboard } from 'vizfootprint';
import { createSessionView, matchEmission, sessionSource, type ChartEmission, type RenderSelection, type SelectionClauseView, type SessionView } from 'vizfootprint-ui';
import { INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, RESIDUE_KEY, STRUCTURE_VIEW, SURFACE_VIEW, protDef } from '../src/prot/def.js';
import { CONTACTS_ACT, INTERFACE_CONTACTS_COLUMN, PAIRS_ACT, SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import { entryCredit, protTables } from '../src/prot/etl.js';
import { PROT_FILES } from '../src/data/files.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { narrowingOf, useProtCells, type NarrowingBasis, type ProtCell, type ProtDeskData } from '../web/src/protCells.js';
import { useProtProjection } from '../web/src/protProjection.js';
import type { Row } from '../web/src/derive.js';
import { ChartCard, ChartTile } from '../web/src/workbench/ChartCard.js';
import { narrowingSaid } from '../web/src/workbench/charts.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = readFileSync(join(process.cwd(), PROT_FILES.structure), 'utf8');
const TABLES = protTables(TEXT);
const CREDIT = entryCredit(TEXT);


// ── the desk's own data, with both acts' columns on the rows ─────────────────

const OUTCOMES: readonly ActOutcome[] = [
  { stage: 'interactions', act: PAIRS_ACT, commit: 'c-pairs', refusal: null, materialized: [] },
  { stage: 'interactions', act: CONTACTS_ACT, commit: 'c-contacts', refusal: null, materialized: [INTERFACE_CONTACTS_COLUMN] },
  { stage: 'surface', act: SURFACE_ACT, commit: 'c-surface', refusal: null, materialized: [SASA_COLUMN, 'relative_sasa'] },
];

/** Three contact rows, shaped the way the act's own answer is shaped — the receipt's rows, which are NOT in the data space. */
const PAIR_ROWS = [
  { interaction_key: 'k1', residue_a: 'A:1', residue_b: 'B:2' },
  { interaction_key: 'k2', residue_a: 'A:3', residue_b: 'B:4' },
  { interaction_key: 'k3', residue_a: 'A:5', residue_b: 'B:6' },
];

const RUN: ProtRun = { outcomes: OUTCOMES, narrative: [], pairs: { rows: PAIR_ROWS } as unknown as ProtRun['pairs'], contacts: null, surface: null } as unknown as ProtRun;

/** The rows as they stand once both stages have landed — the parse's own, with the columns the two acts write. */
const ROWS: readonly Row[] = TABLES.residues.map((row, index) => ({ ...row, [INTERFACE_CONTACTS_COLUMN]: index % 4, [SASA_COLUMN]: 10 + index, relative_sasa: 0.1 })) as readonly Row[];

const DATA: ProtDeskData = {
  residues: ROWS,
  counts: TABLES.counts,
  skipped: TABLES.skipped,
  structure: { at: PROT_FILES.structure, text: TEXT, characters: TEXT.length },
  run: RUN,
  refusals: {},
  notes: [],
};

// ── the numbers, folded from those same rows (never typed) ───────────────────

const placed = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
/** How many dots the backbone-angle plot has at rest: one per residue with BOTH angles. */
const DOTS = ROWS.filter((r) => placed(r['phi']) && placed(r['psi'])).length;
/** How many bars the cross-chain chart has at rest: one per distinct residue key with the act's column on it. */
const BARS = new Set(ROWS.filter((r) => placed(r[INTERFACE_CONTACTS_COLUMN])).map((r) => String(r[RESIDUE_KEY]))).size;
/** How many points the surface run has at rest. */
const POINTS = ROWS.filter((r) => placed(r[SASA_COLUMN])).length;
const RESIDUES = ROWS.length;
const RESNUMS = ROWS.map((r) => Number(r['resnum'])).filter((n) => Number.isFinite(n));

/**
 * EVERY residue number on the table, as the run's own gesture spells it.
 *
 * NOT an interval: both runs are drawn over a BAND, so a drag on one lands the
 * SLOTS it covered — a match — and a tap lands one slot. An interval was a
 * voice these two never had, and declaring it (`../src/prot/def.ts` ·
 * `capabilities`) is what made a real reader's drag refuse for three packets.
 * A match over every number is the same claim this suite always made — *keep
 * every residue number* — in the kind the picture can actually make.
 */
const EVERY_RESNUM = [...new Set(RESNUMS)];

/** A residue that HAS both angles, so a pick on it leaves the scatter one dot rather than none. */
const PICKED = String(ROWS.find((r) => placed(r['phi']) && placed(r['psi']))![RESIDUE_KEY]);

// ── the real session, and the cells over it ──────────────────────────────────

let view: SessionView;

/** The cells, built through the REAL projection over the REAL session — the desk's own two hooks, in one probe. */
function cells(): readonly ProtCell[] {
  let built: readonly ProtCell[] = [];
  function Probe(): null {
    const { desk } = useProtProjection(view, view.getState());
    built = useProtCells(desk, DATA);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

const cellOf = (id: string): ProtCell => cells().find((c) => c.id === id)!;
/** The sentence a pane says in the focus slot, and the short form it says in the rail. */
const focusLine = (id: string): string | null => narrowingSaid(cellOf(id).narrowing, 'focus');
const tileLine = (id: string): string | null => narrowingSaid(cellOf(id).narrowing, 'tile');
/** An address's DECLARED name, as the session serves it — never spelled in this file. */
const nameOf = (id: string): string => view.getState().views.find((v) => v.viewId === id)?.label ?? id;

const clearAll = async (): Promise<void> => {
  await view.clearAll('clear every selection');
  await view.refresh();
  expect(view.getState().selections.filter((s) => s.value !== null)).toEqual([]);
};

/** One gesture, through the same door the charts use — and the assertion that it LANDED, since `emit` answers nothing. */
const pick = async (viewId: string, emission: ChartEmission, intent: string): Promise<void> => {
  await view.emit(viewId, emission, intent);
  await view.refresh();
  const live = view.getState().selections.filter((s) => s.value !== null);
  expect(live.map((s) => s.viewId), `the gesture on ${viewId} landed nothing`).toEqual([viewId]);
};

beforeAll(async () => {
  const session = buildDashboard(protDef(TABLES, TEXT)).createSession({ as: 'user' });
  view = createSessionView(sessionSource(session), { as: 'user' });
  await view.refresh();
  // a credit is read once so the fixture fails loudly if the committed entry ever changes shape
  expect(CREDIT.entry.length).toBeGreaterThan(0);
});

describe('STATE 4 — nothing selected: no pane says anything', () => {
  it('leaves every pane with no narrowing at all, so the resting page is clean', async () => {
    await clearAll();
    for (const id of [STRUCTURE_VIEW, RAMA_VIEW, INTERFACE_VIEW, SURFACE_VIEW, PAIRS_VIEW]) {
      expect(cellOf(id).narrowing, id).toBe(null);
      expect(focusLine(id), id).toBe(null);
      expect(tileLine(id), id).toBe(null);
    }
  });
});

describe('STATE 1 — a pick in one pane, and every OTHER pane says what it lost', () => {
  beforeAll(async () => {
    await clearAll();
    await pick(INTERFACE_VIEW, { rawValue: PICKED, encoding: { kind: 'point', field: RESIDUE_KEY } }, 'pick one residue');
  });

  it('says the survivors, the total and the SOURCE BY ITS DECLARED NAME on the focused card', () => {
    const source = nameOf(INTERFACE_VIEW);
    expect(focusLine(SURFACE_VIEW)).toBe(`1 of ${String(POINTS)} residues in force — narrowed by ${source}`);
    expect(focusLine(RAMA_VIEW)).toBe(`1 of ${String(DOTS)} dots in force — narrowed by ${source}`);
    expect(focusLine(STRUCTURE_VIEW)).toBe(`1 of ${String(RESIDUES)} residues in force — narrowed by ${source}`);
  });

  it('says the SHORT FORM in a tile, where the figures already have the room — the count, and that the cause is another pane', () => {
    expect(tileLine(RAMA_VIEW)).toBe(`1 of ${String(DOTS)} dots in force — narrowed from another pane`);
    expect(tileLine(SURFACE_VIEW)).toBe(`1 of ${String(POINTS)} residues in force — narrowed from another pane`);
  });

  it('KEEPS THE SOURCE PANE OUT OF IT — the pane the clause came from already shows its own selection', () => {
    expect(cellOf(INTERFACE_VIEW).narrowing).toBe(null);
    expect(focusLine(INTERFACE_VIEW)).toBe(null);
    expect(tileLine(INTERFACE_VIEW)).toBe(null);
  });

  it('counts what the PICTURE draws and not what the table holds: the bars are the rows in force', () => {
    // the pick was made HERE, so this pane keeps all its bars (self-exclusion)
    expect(cellOf(INTERFACE_VIEW).marks).toBe(BARS);
    // …while a pick made ELSEWHERE takes them down, which is what makes the
    // sentence on this pane true: `VizBar` has no dim arm, so the host sums the
    // rows in force or the pane shows nothing at all
    expect(cellOf(SURFACE_VIEW).narrowing?.inForce).toBe(1);
  });

  it('is the same fact in the card the reader sees — the sentence is in the footer, beside the counts and never above the picture', async () => {
    const cell = cellOf(RAMA_VIEW);
    const panel = await mount(card(cell));
    const said = panel.words();
    expect(said).toContain(focusLine(RAMA_VIEW)!);
    // the FIGURES keep their place, and the narrowing rides the same line
    expect(said).toContain(cell.foot!);
    const footer = [...panel.host.querySelectorAll('[data-narrowed="true"]')];
    expect(footer).toHaveLength(1);
    expect(footer[0]?.textContent).toBe(focusLine(RAMA_VIEW));
    await panel.unmount();
  });

  it('and in the tile the reader sees, on the figures own line', async () => {
    const cell = cellOf(SURFACE_VIEW);
    const panel = await mount(tile(cell));
    const line = [...panel.host.querySelectorAll('[data-narrowed="true"]')];
    expect(line).toHaveLength(1);
    expect(line[0]?.textContent).toBe(tileLine(SURFACE_VIEW));
    expect(panel.words()).toContain(cell.foot!);
    await panel.unmount();
  });
});

describe('STATE 2 — a clause that reached a pane and cut NOTHING says so, because silence reads as "not connected"', () => {
  beforeAll(async () => {
    await clearAll();
    // the whole range of residue numbers: every row is inside it, so this
    // clause filters nothing anywhere — the state that used to be silent
    await pick(SURFACE_VIEW, matchEmission('resnum', EVERY_RESNUM), 'keep every residue number');
  });

  it('quotes the library own words — *filtered nothing here* — and keeps the count in front of them', () => {
    const source = nameOf(SURFACE_VIEW);
    expect(focusLine(RAMA_VIEW)).toBe(`${String(DOTS)} of ${String(DOTS)} dots in force — the selection in ${source} filtered nothing here`);
    expect(focusLine(STRUCTURE_VIEW)).toBe(`${String(RESIDUES)} of ${String(RESIDUES)} residues in force — the selection in ${source} filtered nothing here`);
    expect(focusLine(INTERFACE_VIEW)).toBe(`${String(BARS)} of ${String(BARS)} bars in force — the selection in ${source} filtered nothing here`);
  });

  it('says it in a tile too, without the source name the line cannot hold', () => {
    expect(tileLine(RAMA_VIEW)).toBe(`${String(DOTS)} of ${String(DOTS)} dots in force — filtered nothing here`);
  });

  it('is NOT silence and NOT a claim of narrowing: the kind is its own, and nothing was lost', () => {
    expect(cellOf(RAMA_VIEW).narrowing?.kind).toBe('nothing-cut');
    expect(cellOf(RAMA_VIEW).narrowing?.inForce).toBe(DOTS);
    expect(focusLine(RAMA_VIEW)).not.toContain('narrowed');
  });
});

describe('STATE 3 — a pane no clause can be judged on says THAT, and why', () => {
  beforeAll(async () => {
    await clearAll();
    await pick(INTERFACE_VIEW, { rawValue: PICKED, encoding: { kind: 'point', field: RESIDUE_KEY } }, 'pick one residue');
  });

  it('the receipt keeps every row, says the clause cannot be judged here, and names the column its rows do not carry', () => {
    const said = focusLine(PAIRS_VIEW);
    expect(cellOf(PAIRS_VIEW).narrowing?.kind).toBe('unreachable');
    expect(said).toContain(`${String(PAIR_ROWS.length)} of ${String(PAIR_ROWS.length)} rows still drawn`);
    expect(said).toContain('cannot be judged here');
    // the REASON is read off the record — the clause's own field, or the
    // library's sentence where the library has one — never a sentence typed here
    const reason = cellOf(PAIRS_VIEW).narrowing?.reason;
    expect(reason).toBeDefined();
    expect(said).toContain(reason!);
  });

  it('and in the rail it says the short form rather than nothing', () => {
    expect(tileLine(PAIRS_VIEW)).toBe(`${String(PAIR_ROWS.length)} of ${String(PAIR_ROWS.length)} rows still drawn — the selection elsewhere cannot be judged here`);
  });
});

describe('EVERY PANE BUT THE SOURCE SPEAKS — and each one about its own marks', () => {
  it('prints the five sentences under a pick and under a clause that cuts nothing, and asserts nobody is silent', async () => {
    const say = (line: string): void => console.log(line);
    const panes = [STRUCTURE_VIEW, RAMA_VIEW, INTERFACE_VIEW, SURFACE_VIEW, PAIRS_VIEW];
    await clearAll();
    await pick(INTERFACE_VIEW, { rawValue: PICKED, encoding: { kind: 'point', field: RESIDUE_KEY } }, 'pick one residue');
    say(`the graph: default=${String(view.getState().links?.default)} · ${String(view.getState().links?.edges.length)} edges · declined ${JSON.stringify((view.getState().links?.declined ?? []).map((d) => d.id))}`);
    for (const id of panes) say(`  a pick in the bars → ${id}: ${String(focusLine(id))}`);
    /*
      THE CLAIM: of five panes, exactly ONE is silent — the one the clause came
      from — and every other one says a sentence carrying its own count. A pane
      that said nothing here is the defect this packet exists to remove.
    */
    expect(panes.filter((id) => focusLine(id) === null)).toEqual([INTERFACE_VIEW]);
    for (const id of panes.filter((x) => x !== INTERFACE_VIEW)) {
      const narrowing = cellOf(id).narrowing!;
      expect(focusLine(id), id).toContain(`of ${narrowing.total.toLocaleString('en-US')} ${narrowing.unit}`);
    }
    await clearAll();
    await pick(SURFACE_VIEW, matchEmission('resnum', EVERY_RESNUM), 'keep every residue number');
    for (const id of panes) say(`  a drag over every residue number → ${id}: ${String(focusLine(id))}`);
    expect(panes.filter((id) => focusLine(id) === null)).toEqual([SURFACE_VIEW]);
    say(`  the marks each pane has at rest: ${String(RESIDUES)} residues · ${String(DOTS)} dots · ${String(BARS)} bars · ${String(POINTS)} points · ${String(PAIR_ROWS.length)} receipt rows`);
  });
});

describe('CLEARING gives every pane its silence back', () => {
  it('takes the line off all five panes, and off the markup', async () => {
    await clearAll();
    for (const id of [STRUCTURE_VIEW, RAMA_VIEW, INTERFACE_VIEW, SURFACE_VIEW, PAIRS_VIEW]) expect(focusLine(id), id).toBe(null);
    const panel = await mount(card(cellOf(RAMA_VIEW)));
    expect(panel.host.querySelectorAll('[data-narrowed="true"]')).toHaveLength(0);
    await panel.unmount();
    const rail = await mount(tile(cellOf(SURFACE_VIEW)));
    expect(rail.host.querySelectorAll('[data-narrowed="true"]')).toHaveLength(0);
    await rail.unmount();
  });
});

// ── the two components, wired the way `web/src/protDesk.tsx` wires them ──────

const card = (cell: ProtCell): ReactElement => (
  <ChartCard
    id={cell.id}
    label={cell.id}
    focused
    howToRead={null}
    legend={[]}
    footLeft={cell.foot}
    footRight={narrowingSaid(cell.narrowing, 'focus')}
    note={cell.caption ?? null}
    noteLabel="Full note"
    noteAria={`the full note for ${cell.id}`}
    clear={null}
    height={200}
  >
    <div />
  </ChartCard>
);

const tile = (cell: ProtCell): ReactElement => (
  <ChartTile id={cell.id} label={cell.id} said={cell.foot} narrowed={narrowingSaid(cell.narrowing, 'tile')} promote={{ label: `promote ${cell.id}`, onPress: () => undefined }}>
    <div />
  </ChartTile>
);

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

// ── THE FOLD ITSELF, asked the things this def cannot produce ───────────────

/**
 * Three states the shipped def cannot reach on its own and that a reader will
 * meet the day it declares a relation or a link edit: a session that SAYS a
 * clause could not be judged (`narrowedFor`), a default edge the reach law
 * DECLINED, and an edge whose response is `highlight` or `mirror` rather than
 * `filter`. The fold is asked directly, with the library's own shapes.
 */
const clause = (over: Partial<SelectionClauseView> = {}): SelectionClauseView => ({ kind: 'point', field: 'residue_key', value: 'A:1', predicate: () => true, ...over });

const fold = (clauses: readonly (readonly [string, SelectionClauseView])[], self: string | null): RenderSelection => ({ clauses: new Map(clauses), resolve: 'intersect', selfClauseId: self });

const basis = (over: Partial<NarrowingBasis>): NarrowingBasis => ({
  selection: fold([], 'here'),
  live: [],
  rows: [{ residue_key: 'A:1' }],
  total: 10,
  inForce: 10,
  unit: 'dots',
  label: (viewId) => `the ${viewId} chart`,
  declined: [],
  ...over,
});

describe('the fold, on the three shapes this def cannot produce yet', () => {
  it('quotes the SESSION when the session says a clause could not be judged here — never the page’s own sentence', () => {
    const said = 'the table these rows come from has no column "radius"';
    const narrowing = narrowingOf(
      basis({ selection: fold([['bars', clause({ field: 'radius', narrowed: { column: 'radius', reason: said } })]], 'here'), live: ['bars'] }),
    );
    expect(narrowing?.kind).toBe('unreachable');
    expect(narrowing?.reason).toBe(said);
    expect(narrowingSaid(narrowing, 'focus')).toBe(`10 of 10 dots still drawn — the selection in the bars chart cannot be judged here: ${said}`);
  });

  it('quotes the MAP when no clause arrived at all and the graph declined the edge — the refusal that is recorded rather than silent', () => {
    const said = 'view "bars" draws table "contacts" and view "here" draws table "residues" — no relation joins those tables and they share no column, so nothing this edge carries could be judged there';
    const narrowing = narrowingOf(basis({ live: ['bars'], declined: [{ id: 'bars:point→here', source: 'bars', kind: 'point', target: 'here', reason: said }] }));
    expect(narrowing?.kind).toBe('unreachable');
    expect(narrowing?.reason).toBe(said);
    // …and it names the source it never heard from, by the DECLARED name
    expect(narrowing?.from).toEqual(['the bars chart']);
  });

  it('says the state even when nothing at all can be said about WHY: a live clause elsewhere and no clause here is not silence', () => {
    const narrowing = narrowingOf(basis({ live: ['bars'] }));
    expect(narrowing?.kind).toBe('unreachable');
    expect(narrowing?.reason).toBeUndefined();
    expect(narrowingSaid(narrowing, 'focus')).toBe('10 of 10 dots still drawn — the selection in the bars chart cannot be judged here');
  });

  it('counts a HIGHLIGHT clause as one that reached (the dim arm is still an effect), and ignores a mirror or a navigate', () => {
    const highlight = narrowingOf(basis({ selection: fold([['bars', clause({ response: 'highlight' })]], 'here'), live: ['bars'], inForce: 4 }));
    expect(highlight?.kind).toBe('narrowed');
    expect(highlight?.inForce).toBe(4);
    const mirrored = narrowingOf(basis({ selection: fold([['bars', clause({ response: 'mirror' })]], 'here'), live: ['bars'], inForce: 4 }));
    /*
      A MIRROR OUTLINES A VALUE AND NARROWS NOTHING, so it is not counted — and
      the state this pane then reports is the shipped fold's NAMED LIMITATION,
      pinned here rather than left to be discovered: it says *cannot be judged
      here* where the honest words would be *reached this picture and does not
      filter it*. This def declares no mirror edge (`src/prot/def.ts` ·
      `protLinks` is empty, and the crossfilter default mints `filter`
      everywhere), so the case is out of contract today;
      `web/src/protCells.tsx` · `reachingClauses` carries the note, and the day
      an edge is declared or edited to `mirror` the fold owes it a verdict of
      its own. What it must NEVER do is claim a cut it did not make, and it
      does not: the count stays whole.
    */
    expect(mirrored?.kind).toBe('unreachable');
    expect(mirrored?.inForce).toBe(basis({}).total);
  });

  it('keeps the SOURCE out of it, and says nothing when the only live clause is this pane’s own', () => {
    expect(narrowingOf(basis({ selection: fold([['here', clause()]], 'here'), live: ['here'] }))).toBe(null);
  });

  it('needs BOTH columns of a two-column clause before it will judge one', () => {
    const cell = clause({ kind: 'cell', field: 'phi × psi', fields: ['phi', 'psi'] });
    const half = narrowingOf(basis({ selection: fold([['bars', cell]], 'here'), live: ['bars'], rows: [{ phi: 1 }], inForce: 4 }));
    expect(half?.kind).toBe('unreachable');
    const both = narrowingOf(basis({ selection: fold([['bars', cell]], 'here'), live: ['bars'], rows: [{ phi: 1, psi: 2 }], inForce: 4 }));
    expect(both?.kind).toBe('narrowed');
  });

  it('names EVERY source when two panes hold clauses, in the order the fold met them', () => {
    const two = narrowingOf(basis({ selection: fold([['bars', clause()], ['run', clause({ field: 'resnum' })]], 'here'), live: ['bars', 'run'], rows: [{ residue_key: 'A:1', resnum: 1 }], inForce: 2 }));
    expect(two?.from).toEqual(['the bars chart', 'the run chart']);
    expect(narrowingSaid(two, 'focus')).toBe('2 of 10 dots in force — narrowed by the bars chart and the run chart');
  });
});
