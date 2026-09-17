// @vitest-environment jsdom
/**
 * THE TRACE IS A CONTROL, NOT A PICTURE.
 *
 * The panel's whole claim is that clicking a row moves the record's cursor, so
 * these tests CLICK: the component is mounted into jsdom (the environment
 * `tests/prot-renderer.test.ts` already establishes for this repository), a row
 * is clicked, and what the panel asked for is asserted — the commit id, and the
 * session's own sentence when the seek is refused.
 *
 * The other half is what the panel must NOT do: name an act nobody dispatched.
 * A greyed box for a declared-but-unrun act is a promise, and the assertion
 * below is that the panel's words hold no act id that is not in `outcomes`.
 *
 * WHY THE RUN IS HAND-BUILT HERE. `tests/prot-progression.test.ts` runs the real
 * stages over the real entry and asserts what the acts land; what is under test
 * here is the PANEL, so its input is written out — one landed act, one refused
 * act, one act that landed a commit and no column — which is a shape a real run
 * can produce and a real run would take seconds to produce three times over.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { CONTACTS_ACT, PAIRS_ACT, PROT_ACT_ORDER, SURFACE_ACT } from '../src/prot/analyses.js';
import type { ActOutcome, ProtRun } from '../src/prot/orchestrator.js';
import { ProtTrace, landedLine } from '../web/src/protTrace.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** One mounted panel, and the handles a test needs to read and click it. */
/** The rows' own list, by its label — the narrative's sentences are an `<ol>` too, and counting both would count the wrong thing. */
const ROWS = 'ol[aria-label="the acts this run dispatched, in dispatch order"]';

async function mount(
  element: ReactElement,
): Promise<{ readonly host: HTMLElement; readonly words: () => string; readonly buttons: () => readonly HTMLButtonElement[]; readonly rows: () => NodeListOf<Element>; readonly unmount: () => Promise<void> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    host,
    words: () => (host.textContent ?? '').replace(/\s+/g, ' '),
    buttons: () => [...host.querySelectorAll(`${ROWS} button`)] as HTMLButtonElement[],
    rows: () => host.querySelectorAll(`${ROWS} > li`),
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

const click = async (button: HTMLButtonElement): Promise<void> => {
  await act(async () => {
    button.click();
  });
};

const landedAct = (over: Partial<ActOutcome> = {}): ActOutcome => ({ stage: 'interactions', act: PAIRS_ACT, commit: 'c1', refusal: null, materialized: [], ...over });

const OUTCOMES: readonly ActOutcome[] = [
  landedAct(),
  landedAct({ act: CONTACTS_ACT, commit: 'c2', materialized: ['contacts', 'interface_contacts', 'interface_separation'] }),
  landedAct({ stage: 'surface', act: SURFACE_ACT, commit: null, refusal: 'act "residueSurface" threw: the solvent probe found no polymer atom to roll over' }),
];

/**
 * A run shaped like one the orchestrator answers with — the fields the panel
 * reads, and a cast at the one place it crosses into the act's own output type.
 *
 * The cast is narrow on purpose: `PairsOutput` is the interaction engine's whole
 * answer (thirteen columns per contact, the drops, the providers) and the panel
 * reads three counts off it. Writing the other fields would be writing a
 * fixture nobody asserts.
 */
const runWith = (over: Partial<ProtRun> = {}): ProtRun => ({
  outcomes: OUTCOMES,
  narrative: ['Stage "Every non-covalent contact in the entry" started.', 'Stage "How much of each residue the solvent can reach" finished.'],
  pairs: { counts: { rows: 224, crossing: 21, byKind: [{ kind: 'hydrogen-bond', contacts: 120 }, { kind: 'hydrophobic', contacts: 104 }] } } as unknown as ProtRun['pairs'],
  contacts: null,
  surface: null,
  ...over,
});

describe('one row per act the run dispatched, in dispatch order', () => {
  it('renders every outcome, in order, and nothing else', async () => {
    const panel = await mount(<ProtTrace run={runWith()} outcomes={OUTCOMES} onSeek={() => Promise.resolve(null)} />);
    // collapsed once the run is done — the rows arrive when a reader opens it
    expect(panel.words()).toContain('3 acts dispatched, 2 landed a commit, 1 was refused');
    const toggle = panel.host.querySelector('button');
    await click(toggle as HTMLButtonElement);
    const said = panel.words();
    expect(said.indexOf(`interactions · ${PAIRS_ACT}`)).toBeGreaterThan(-1);
    expect(said.indexOf(`interactions · ${CONTACTS_ACT}`)).toBeGreaterThan(said.indexOf(`interactions · ${PAIRS_ACT}`));
    expect(said.indexOf(`surface · ${SURFACE_ACT}`)).toBeGreaterThan(said.indexOf(`interactions · ${CONTACTS_ACT}`));
    expect(panel.rows()).toHaveLength(3);
    await panel.unmount();
  });

  it('names NO act that was not dispatched — a missing row, never a greyed promise', async () => {
    const one = [OUTCOMES[0]!];
    const panel = await mount(<ProtTrace run={runWith({ outcomes: one })} outcomes={one} onSeek={() => Promise.resolve(null)} />);
    await click(panel.host.querySelector('button') as HTMLButtonElement);
    const said = panel.words();
    expect(panel.rows()).toHaveLength(1);
    for (const act of PROT_ACT_ORDER.filter((id) => id !== PAIRS_ACT)) expect(said, `the panel names "${act}", which this run never dispatched`).not.toContain(act);
    expect(said).toContain('not the stages the definition declares');
    await panel.unmount();
  });

  it('says so in words when a run dispatched nothing at all', async () => {
    const panel = await mount(<ProtTrace run={runWith({ outcomes: [] })} outcomes={[]} onSeek={() => Promise.resolve(null)} />);
    await click(panel.host.querySelector('button') as HTMLButtonElement);
    expect(panel.words()).toContain('no stage has run on this session, so no act has been dispatched and there is nothing on this trace');
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

  it('renders a refused act as a first-class row, in the refusal’s own words, and not clickable', async () => {
    const panel = await mount(<ProtTrace run={runWith()} outcomes={OUTCOMES} onSeek={() => Promise.resolve(null)} />);
    await click(panel.host.querySelector('button') as HTMLButtonElement);
    expect(panel.words()).toContain('act "residueSurface" threw: the solvent probe found no polymer atom to roll over');
    // two rows are buttons; the refused one is not, and says why
    expect(panel.buttons()).toHaveLength(2);
    expect(panel.words()).toContain('no commit, so there is nothing to seek to: this act landed none');
    await panel.unmount();
  });
});

describe('clicking a row is the point', () => {
  it('seeks to the commit that row landed, and to no other', async () => {
    const asked: string[] = [];
    const panel = await mount(
      <ProtTrace
        run={runWith()}
        outcomes={OUTCOMES}
        onSeek={(commitId) => {
          asked.push(commitId);
          return Promise.resolve(null);
        }}
      />,
    );
    await click(panel.host.querySelector('button') as HTMLButtonElement);
    await click(panel.buttons()[1]!);
    expect(asked).toEqual(['c2']);
    await click(panel.buttons()[0]!);
    expect(asked).toEqual(['c2', 'c1']);
    // a seek that landed says nothing: the cursor moved, and the desk shows it
    expect(panel.words()).not.toContain('the session refused that seek');
    await panel.unmount();
  });

  it('prints the SESSION’s sentence when a seek is refused, rather than failing quietly', async () => {
    const panel = await mount(<ProtTrace run={runWith()} outcomes={OUTCOMES} onSeek={() => Promise.resolve('no commit "c2" to seek to')} />);
    await click(panel.host.querySelector('button') as HTMLButtonElement);
    await click(panel.buttons()[1]!);
    expect(panel.words()).toContain('the session refused that seek, in its own words: no commit "c2" to seek to');
    await panel.unmount();
  });
});

describe('open while it runs, closed when it is done', () => {
  it('is expanded with no run in hand and collapsed once there is one', async () => {
    const running = await mount(<ProtTrace run={null} outcomes={[OUTCOMES[0]!]} onSeek={() => Promise.resolve(null)} />);
    expect(running.host.querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
    expect(running.words()).toContain('The run, as it happens');
    expect(running.words()).toContain('1 act dispatched, 1 landed a commit, 0 were refused so far');
    expect(running.rows()).toHaveLength(1);
    await running.unmount();

    const done = await mount(<ProtTrace run={runWith()} outcomes={OUTCOMES} onSeek={() => Promise.resolve(null)} />);
    expect(done.host.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
    expect(done.words()).toContain('The run, act by act');
    expect(done.rows()).toHaveLength(0);
    await done.unmount();
  });

  it('lets the reader own it once they have said: a panel closed by hand stays closed', async () => {
    const panel = await mount(<ProtTrace run={null} outcomes={[OUTCOMES[0]!]} onSeek={() => Promise.resolve(null)} />);
    await click(panel.host.querySelector('button') as HTMLButtonElement);
    expect(panel.host.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
    await panel.unmount();
  });

  it('says the cursor cannot move yet while the run is still going', async () => {
    const panel = await mount(<ProtTrace run={null} outcomes={[OUTCOMES[0]!]} onSeek={() => Promise.resolve('the run is still going, so there is no cursor to move yet — the desk arrives with the last act')} />);
    await click(panel.buttons()[0]!);
    expect(panel.words()).toContain('the run is still going, so there is no cursor to move yet');
    await panel.unmount();
  });
});

describe('the narrative rides the panel, not re-worded', () => {
  it('prints the recorder’s own sentences, in order', async () => {
    const run = runWith();
    const panel = await mount(<ProtTrace run={run} outcomes={OUTCOMES} onSeek={() => Promise.resolve(null)} />);
    await click(panel.host.querySelector('button') as HTMLButtonElement);
    const said = panel.words();
    expect(said).toContain('the recorder’s own 2 sentences, in order and not re-worded here');
    for (const line of run.narrative) expect(said).toContain(line);
    expect(said.indexOf(run.narrative[0]!)).toBeLessThan(said.indexOf(run.narrative[1]!));
    await panel.unmount();
  });

  it('shows no narrative block when the recorder said nothing', async () => {
    const panel = await mount(<ProtTrace run={runWith({ narrative: [] })} outcomes={OUTCOMES} onSeek={() => Promise.resolve(null)} />);
    await click(panel.host.querySelector('button') as HTMLButtonElement);
    expect(panel.words()).not.toContain('from inside');
    await panel.unmount();
  });
});
