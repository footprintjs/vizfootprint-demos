// @vitest-environment jsdom
/**
 * THE DESK OPENS ON A QUESTION — the landing, the address, and the line that
 * says what this entry is.
 *
 * Three claims, and each is asserted as the WORDS A READER SEES:
 *
 *   1. ONE RULE DECIDES THE DOOR. Four characters that look like an id open
 *      that entry and ask the archive nothing; anything else is a question, and
 *      what comes back is listed with each entry's own title, method and chain
 *      count. A question that matches nothing says so in the search service's
 *      own answer (204), and an entry this desk will not attempt says so ON THE
 *      LIST, with the ceiling named, before anybody clicks it.
 *   2. THE ADDRESS CARRIES THE ENTRY, so a reader can share what they are
 *      looking at — and an address that asks for something which is not an
 *      entry id is a sentence, never a silent fall back to the example.
 *   3. THE ENTRY'S OWN LINE, beside the credit, prints every note verbatim.
 *      One of those notes also reaches a PICTURE: an entry with a single chain
 *      has no interface, so the interface cell says that sentence instead of
 *      drawing one bar of zero per residue — and every other cell renders
 *      BYTE FOR BYTE what it rendered before the notes existed.
 *
 * Nothing here touches the network: the archive is a function
 * (`tests/protFixture.ts` · `fakeArchive`), and the id path is asserted to call
 * it zero times.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { ATOM_CEILING, EXAMPLE_ENTRY, type ArchiveFetch } from '../src/prot/archive.js';
import { entryNotes, readEntryBytes, type EntryNote } from '../src/prot/entryNotes.js';
import { protTables } from '../src/prot/etl.js';
import { INTERFACE_VIEW, PROT_WORDS, RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { INTERFACE_CONTACTS_COLUMN, SASA_COLUMN } from '../src/prot/analyses.js';
import { PROT_FILES } from '../src/data/files.js';
import { EntryNotes, ProtLanding, entryInUrl, urlForEntry } from '../web/src/protLanding.js';
import { useProtCells, type ProtDeskData } from '../web/src/protCells.js';
import type { Row } from '../web/src/derive.js';
import { SEARCH_BREADTH, SEARCH_RULE } from '../web/src/workbench/results.js';
import { RECORD_1AY7, fakeArchive, noSuchEntry, oneChainOnly, recordWith, searchAnswer } from './protFixture.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The committed entry, read from the PROJECT ROOT rather than through
 * `src/prot/snapshot.ts` — the reason `tests/prot-renderer.test.ts` gives: that
 * door resolves the file against its own module URL, which under the `jsdom`
 * environment this suite needs is an `http://` URL and not a path. The path is
 * still the one owner's (`src/data/files.ts` · `PROT_FILES`).
 */
const TEXT = readFileSync(join(process.cwd(), PROT_FILES.structure), 'utf8');

/** One mounted surface, and the handles a test needs to read, type into and click it. */
async function mount(element: ReactElement): Promise<{
  readonly host: HTMLElement;
  readonly words: () => string;
  readonly type: (words: string) => Promise<void>;
  readonly submit: () => Promise<void>;
  readonly click: (label: string) => Promise<void>;
  readonly results: () => readonly HTMLElement[];
  readonly unmount: () => Promise<void>;
}> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  const field = (): HTMLInputElement => host.querySelector('input') as HTMLInputElement;
  return {
    host,
    words: () => (host.textContent ?? '').replace(/\s+/g, ' '),
    type: async (words) => {
      await act(async () => {
        const input = field();
        // THE NATIVE SETTER, and not `input.value = …`: React tracks the last
        // value it saw on the element itself, so an assignment through its own
        // patched setter looks like no change at all and `onChange` never fires.
        // This is the workaround every React testing library uses, written out
        // once here.
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter === undefined) throw new Error('this jsdom has no value setter to drive the field with');
        setter.call(input, words);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },
    submit: async () => {
      await act(async () => {
        (host.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
    },
    click: async (label) => {
      const button = [...host.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(label));
      if (button === undefined) throw new Error(`no control says "${label}" — the page says: ${(host.textContent ?? '').replace(/\s+/g, ' ')}`);
      await act(async () => {
        button.click();
      });
    },
    results: () => [...host.querySelectorAll('ol[aria-label="what the archive found"] > li')] as HTMLElement[],
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('the landing says what this is, and offers the example by name', () => {
  it('carries the desk’s own title and caption, the box, the rule and the example', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 200, body: RECORD_1AY7 }));
    const page = await mount(<ProtLanding name={PROT_WORDS.name} claim={PROT_WORDS.title} caption={PROT_WORDS.caption} doors={doors} onOpen={() => undefined} />);
    const said = page.words();
    // THE NAME is the big line; the def's CLAIM about this desk is a sentence
    // below it, and both are on the page
    expect(said).toContain(PROT_WORDS.name);
    expect(said).toContain(PROT_WORDS.title);
    expect(said).toContain(PROT_WORDS.caption.slice(0, 60));
    expect(said).toContain('Four characters that look like an entry id');
    expect(said).toContain(`Open the example, ${EXAMPLE_ENTRY}`);
    expect(said).toContain('calls the archive not at all');
    expect(page.host.querySelector('input')?.getAttribute('aria-label')).toBe('a PDB entry id, or words to search the archive for');
    // nothing has been asked, so nothing has been fetched
    expect(calls).toEqual([]);
    await page.unmount();
  });

  it('opens the example when the box is empty, and when its link is clicked — with no request either way', async () => {
    const opened: string[] = [];
    const { doors, calls } = fakeArchive(() => ({ status: 200, body: RECORD_1AY7 }));
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={doors} onOpen={(entry) => opened.push(entry)} />);
    await page.submit();
    await page.click(`Open the example, ${EXAMPLE_ENTRY}`);
    expect(opened).toEqual([EXAMPLE_ENTRY, EXAMPLE_ENTRY]);
    expect(calls).toEqual([]);
    await page.unmount();
  });
});

describe('an id opens that entry; words ask the archive', () => {
  it('opens a typed id, upper-cased, without asking the archive anything', async () => {
    const opened: string[] = [];
    const { doors, calls } = fakeArchive(() => ({ status: 200, body: RECORD_1AY7 }));
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={doors} onOpen={(entry) => opened.push(entry)} />);
    await page.type('1ay7');
    await page.submit();
    expect(opened).toEqual(['1AY7']);
    expect(calls).toEqual([]);
    await page.unmount();
  });

  it('lists what a word search found, each row with its own title, method and chains, and opens the one clicked', async () => {
    const opened: string[] = [];
    const { doors, calls } = fakeArchive((url) => {
      if (url.includes('/rcsbsearch/')) return { status: 200, body: searchAnswer(['2CX6', '1A19'], 269) };
      if (url.endsWith('1A19')) return { status: 200, body: recordWith({ deposited_polymer_entity_instance_count: 1 }, { struct: { title: 'BARSTAR' }, exptl: [{ method: 'SOLUTION NMR' }] }) };
      return { status: 200, body: RECORD_1AY7 };
    });
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={doors} onOpen={(entry) => opened.push(entry)} />);
    await page.type('barstar');
    await page.submit();
    const said = page.words();
    expect(said).toContain('the archive reports 269 entries whose text matches “barstar”');
    expect(page.results()).toHaveLength(2);
    // THE SAME FACTS, SPLIT THE WAY THE DESIGN SPLITS THEM: the id in Mono, the
    // deposited title on its own line, then the rest of the archive's own line
    // beneath it (`src/prot/archive.ts` · `summaryParts`, one owner with
    // `summaryLine`). Nothing is re-worded — only the rules moved.
    const rows = page.results().map((li) => (li.textContent ?? '').replace(/\s+/g, ' '));
    expect(rows[0]).toContain('2CX6');
    expect(rows[0]).toContain('ribonuclease sa complex with barstar');
    expect(rows[0]).toContain('x-ray diffraction · 2 chains · 1,678 atoms');
    expect(rows[1]).toContain('1A19');
    expect(rows[1]).toContain('barstar');
    expect(rows[1]).toContain('solution nmr · 1 chain · 1,678 atoms');
    // one search and one record per listed id — no batch door nobody verified
    expect(calls.filter((c) => c.includes('/rcsbsearch/'))).toHaveLength(1);
    expect(calls.filter((c) => c.includes('/core/entry/'))).toHaveLength(2);
    await page.click('1A19');
    expect(opened).toEqual(['1A19']);
    await page.unmount();
  });

  it('says so, in the service’s own answer, when a question matches nothing', async () => {
    const { doors } = fakeArchive(() => ({ status: 204, body: '' }));
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={doors} onOpen={() => undefined} />);
    await page.type('zzzqqqxxnotathing');
    await page.submit();
    expect(page.words()).toContain('the archive\'s search answered 204 (no content) for "zzzqqqxxnotathing" — nothing in the PDB\'s full text matches those words');
    expect(page.results()).toHaveLength(0);
    await page.unmount();
  });

  it('lists an entry it will not open, with the ceiling named, and makes it unclickable', async () => {
    const { doors } = fakeArchive((url) => {
      if (url.includes('/rcsbsearch/')) return { status: 200, body: searchAnswer(['4V4A', '9ZZZ']) };
      if (url.endsWith('4V4A')) return { status: 200, body: recordWith({ deposited_atom_count: 200_000 }) };
      return noSuchEntry('9ZZZ');
    });
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={doors} onOpen={() => undefined} />);
    await page.type('ribosome');
    await page.submit();
    const said = page.words();
    expect(said).toContain(`will not attempt more than ${ATOM_CEILING.toLocaleString('en-US')}`);
    expect(said).toContain('Nothing was downloaded.');
    // the row whose record could not be read is still listed, in the archive's words
    expect(said).toContain('No data found for entryId: 9ZZZ');
    expect(page.results()).toHaveLength(2);
    // …and neither row is a control: nothing here can be opened
    expect(page.host.querySelectorAll('ol[aria-label="what the archive found"] button')).toHaveLength(0);
    await page.unmount();
  });

  it('says so on screen when nothing answers at all — an offline browser is a sentence, not a stuck page', async () => {
    const offline: ArchiveFetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={offline} onOpen={() => undefined} />);
    await page.type('barstar');
    await page.submit();
    const said = page.words();
    expect(said).toContain('nothing answered at https://search.rcsb.org/rcsbsearch/v2/query');
    expect(said).toContain('Failed to fetch');
    expect(said).toContain('asks the archive from your browser');
    await page.unmount();
  });

  it('shows the refusal a reader arrived with, verbatim, above the box', async () => {
    const { doors } = fakeArchive(() => ({ status: 200, body: RECORD_1AY7 }));
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={doors} refusal="the archive has no entry “9ZZZ”" onOpen={() => undefined} />);
    expect(page.words()).toContain('the archive has no entry “9ZZZ”');
    await page.unmount();
  });
});

describe('screen one, in its three states — the design’s clothes over the same behaviour', () => {
  it('EMPTY: one centred column, the serif title, one field, one accent button, the example and the rule', async () => {
    const { doors } = fakeArchive(() => ({ status: 200, body: RECORD_1AY7 }));
    const page = await mount(<ProtLanding name={PROT_WORDS.name} claim={PROT_WORDS.title} caption={PROT_WORDS.caption} doors={doors} onOpen={() => undefined} />);
    // the title is the DEF's, in the serif, as an h1
    const heading = page.host.querySelector('h1');
    // the NAME, not the claim: a product's name is what the design reserves
    // the big serif line for
    expect(heading?.textContent).toBe(PROT_WORDS.name);
    expect(heading?.textContent).not.toBe(PROT_WORDS.title);
    expect(heading?.getAttribute('style') ?? '').toContain('var(--pw-font-serif)');
    // exactly one field and one submit, and the field carries the accessible name
    expect(page.host.querySelectorAll('input')).toHaveLength(1);
    expect(page.host.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    expect(page.host.querySelector('input')?.getAttribute('aria-label')).toBe('a PDB entry id, or words to search the archive for');
    // no results column and no header band: nobody has asked yet
    expect(page.host.querySelector('ol[aria-label="what the archive found"]')).toBeNull();
    expect(page.words()).toContain(SEARCH_RULE.slice(0, 60));
    await page.unmount();
  });

  it('RESULTS: the header form, one row per entry, and the row is the control', async () => {
    const { doors } = fakeArchive((url) => {
      if (url.includes('/rcsbsearch/')) return { status: 200, body: searchAnswer(['2CX6'], 1) };
      return { status: 200, body: RECORD_1AY7 };
    });
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={doors} onOpen={() => undefined} />);
    await page.type('barstar');
    await page.submit();
    // the title moved into a header band beside the form, so there is no h1 any more
    expect(page.host.querySelector('h1')).toBeNull();
    expect(page.host.querySelector('h2')?.textContent).toContain('Entries matching');
    expect(page.results()).toHaveLength(1);
    // the WHOLE row is the control — the design has no separate "open" button
    expect(page.host.querySelectorAll('ol[aria-label="what the archive found"] button')).toHaveLength(1);
    await page.unmount();
  });

  it('NOTHING MATCHED: the serif apology, the service’s own sentence, the two real facts, then the example', async () => {
    const { doors } = fakeArchive(() => ({ status: 204, body: '' }));
    const page = await mount(<ProtLanding name="t" claim="c" caption="c" doors={doors} onOpen={() => undefined} />);
    await page.type('rnase sa hot spot map');
    await page.submit();
    const heading = page.host.querySelector('h2');
    expect(heading?.textContent).toBe('Nothing matched “rnase sa hot spot map”.');
    expect(heading?.getAttribute('style') ?? '').toContain('var(--pw-font-serif)');
    const said = page.words();
    // the archive's own answer, then the two facts, then the example — in that order
    expect(said).toContain('the archive\'s search answered 204 (no content)');
    expect(said.indexOf(SEARCH_RULE.slice(0, 40))).toBeGreaterThan(said.indexOf('204 (no content)'));
    expect(said).toContain(SEARCH_BREADTH);
    expect(said.indexOf('Open the example')).toBeGreaterThan(said.indexOf(SEARCH_BREADTH));
    // no rows at all: a placeholder row would be a claim about an entry
    expect(page.results()).toHaveLength(0);
    await page.unmount();
  });
});

describe('the address carries the entry', () => {
  it('round-trips an entry through the query string, upper-cased and case-insensitive', () => {
    const at = urlForEntry('1ay7', 'https://example.github.io/vizfootprint-demo/prot/?layout=grid');
    expect(at).toContain('entry=1AY7');
    expect(at).toContain('layout=grid'); // the rest of the address survives
    expect(entryInUrl(new URL(at).search)).toEqual({ kind: 'entry', entry: '1AY7' });
    expect(entryInUrl('?entry=4hhb')).toEqual({ kind: 'entry', entry: '4HHB' });
  });

  it('reads no entry as nobody having asked yet', () => {
    expect(entryInUrl('')).toEqual({ kind: 'none' });
    expect(entryInUrl('?layout=grid')).toEqual({ kind: 'none' });
    expect(entryInUrl('?entry=')).toEqual({ kind: 'none' });
    // and dropping it is the way back to the landing
    expect(urlForEntry(null, 'https://example.github.io/vizfootprint-demo/prot/?entry=1AY7')).toBe('https://example.github.io/vizfootprint-demo/prot/');
  });

  it('refuses an address that asks for something which is not an entry id, rather than showing the example', () => {
    const asked = entryInUrl('?entry=ribonuclease');
    expect(asked.kind).toBe('refused');
    expect(asked.kind === 'refused' && asked.sentence).toContain('the address carries an entry this desk cannot open');
    expect(asked.kind === 'refused' && asked.sentence).toContain('"ribonuclease" is not a PDB entry id');
    expect(asked.kind === 'refused' && asked.sentence).toContain('Nothing was fetched.');
  });
});

describe('the entry’s own line, beside the credit', () => {
  it('names the entry, the address that carries it, the cost, and every note verbatim', async () => {
    const notes = entryNotes(readEntryBytes('at', oneChainOnly(TEXT, 'A')), protTables(oneChainOnly(TEXT, 'A')));
    let again = 0;
    const page = await mount(<EntryNotes entry="1AY7" notes={notes} cost="1AY7 deposits 1,678 atoms" onSearchAgain={() => (again += 1)} />);
    const said = page.words();
    expect(said).toContain('Showing entry 1AY7');
    expect(said).toContain('?entry=1AY7');
    expect(said).toContain('What it cost: 1AY7 deposits 1,678 atoms');
    for (const note of notes) expect(said).toContain(note.sentence);
    expect(said).toContain('one-chain');
    await page.click('Open another entry');
    expect(again).toBe(1);
    await page.unmount();
  });

  it('says nothing about an entry with nothing to report, and shows no cost for the example', async () => {
    const page = await mount(<EntryNotes entry={EXAMPLE_ENTRY} notes={[]} cost={null} onSearchAgain={() => undefined} />);
    expect(page.words()).not.toContain('What it cost');
    expect(page.host.querySelector('ul')).toBeNull();
    await page.unmount();
  });
});

// ── the one note that reaches a picture ─────────────────────────────────────

/** A desk with nothing selected and nothing said — the same stub the other prot suites use. */
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

const ONE_CHAIN = protTables(oneChainOnly(TEXT, 'A'));
/**
 * The rows the two stages leave on a one-chain entry: a real count of zero
 * crossing contacts for every residue, and a surface area for each one.
 *
 * Both columns are put there by hand because what is under test is the CELL:
 * `tests/prot-progression.test.ts` runs the real acts over the real entry, and
 * a one-chain entry's own run would prove the same zero twice.
 */
const ZERO_CONTACTS: readonly Row[] = ONE_CHAIN.residues.map((row, index) => ({ ...row, [INTERFACE_CONTACTS_COLUMN]: 0, [SASA_COLUMN]: 10 + index })) as readonly Row[];
const ONE_CHAIN_NOTES = entryNotes(readEntryBytes('at', oneChainOnly(TEXT, 'A')), ONE_CHAIN);

/** One cell of the desk, as markup — the caption and the body, for a byte comparison. */
function cellMarkup(viewId: string, notes: readonly EntryNote[]): string {
  const data: ProtDeskData = {
    residues: ZERO_CONTACTS,
    counts: ONE_CHAIN.counts,
    skipped: ONE_CHAIN.skipped,
    structure: { at: 'at', text: oneChainOnly(TEXT, 'A'), characters: oneChainOnly(TEXT, 'A').length },
    run: null,
    refusals: { [INTERFACE_VIEW]: 'no column "interface_contacts" in table "residues"', [SURFACE_VIEW]: 'no column "sasa" in table "residues"' },
    notes,
  };
  let built: ReturnType<typeof useProtCells> = [];
  function Probe(): null {
    built = useProtCells(QUIET, data);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  const cell = built.find((c) => c.id === viewId);
  if (cell === undefined) throw new Error(`no cell "${viewId}"`);
  const caption = typeof cell.caption === 'string' ? cell.caption : renderToStaticMarkup(cell.caption as ReactElement);
  return `${caption}\n${renderToStaticMarkup(cell.render({ width: 600, height: 300 }) as ReactElement)}`;
}

const readable = (markup: string): string => markup.replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&#x2014;/g, '—').replace(/\s+/g, ' ');

describe('an entry with one chain: the interface picture says so instead of drawing zeros', () => {
  it('prints the note’s own sentence, and draws no bar chart at all', () => {
    const markup = cellMarkup(INTERFACE_VIEW, ONE_CHAIN_NOTES);
    const said = readable(markup);
    expect(said).toContain('the residues table holds ONE chain (A, 96 residues)');
    expect(said).toContain('instead of drawing 96 bars of zero');
    // the body is a status line, not a chart: no svg, and no invitation to click a bar
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('<svg');
    expect(said).not.toContain('click a bar to select that residue');
  });

  it('would otherwise have drawn one bar of zero per residue — which is what the note replaces', () => {
    // WITHOUT the note the column really is there and really is zero: 96 bars,
    // every one of them zero. That is the picture the sentence exists to refuse.
    const markup = cellMarkup(INTERFACE_VIEW, []);
    expect(readable(markup)).toContain('96 residues, each bar as tall as the number of contacts');
    expect(markup).toContain('<svg');
  });

  it('words the shared axis for ONE chain, because nothing is shared then', () => {
    const said = readable(cellMarkup(SURFACE_VIEW, ONE_CHAIN_NOTES));
    expect(said).toContain("the axis is this entry's one chain's own numbering — A is numbered 1–96 — so a slot holds exactly one residue");
    expect(said).not.toContain('THE CHAINS SHARE THE AXIS');
  });

  it('changes NO other cell, byte for byte', () => {
    for (const viewId of [STRUCTURE_VIEW, RAMA_VIEW, SURFACE_VIEW]) {
      expect(cellMarkup(viewId, ONE_CHAIN_NOTES), `the notes changed the "${viewId}" cell`).toBe(cellMarkup(viewId, []));
    }
  });

  it('is the ONLY note a cell reads: a note about models or chains leaves every cell byte-identical', () => {
    const others = ONE_CHAIN_NOTES.filter((note) => note.code !== 'one-chain');
    const notModels: readonly EntryNote[] = [{ code: 'models', sentence: 'the archive’s file for this entry holds 116 models', blocking: false }, ...others];
    for (const viewId of [STRUCTURE_VIEW, RAMA_VIEW, INTERFACE_VIEW, SURFACE_VIEW]) {
      expect(cellMarkup(viewId, notModels), `a note the cells do not read changed the "${viewId}" cell`).toBe(cellMarkup(viewId, []));
    }
  });
});
