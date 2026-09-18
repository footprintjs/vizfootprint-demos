// @vitest-environment jsdom
/**
 * THE FOOT OF THE PAGE WEARS THE SAME CLOTHES AS THE TOP — and not one word of
 * it changed.
 *
 * Below the cards sat the page's whole record: four panels in the library's own
 * `VizPanel` chrome, two `<details>` rows drawn a third way, the credit
 * paragraph, and the static-build note in a saturated yellow box — the one
 * un-themed block on a page of glass. The follow-up round took the theme's
 * tokens through all of it.
 *
 * That is a change of CLOTHES, so this file's whole job is to prove it was only
 * clothes:
 *
 *   1. ONE DISCLOSURE SHAPE. Every fold on the desk is the same component with
 *      the same gesture and the same chevron, and it keeps its body out of the
 *      DOM until it is pressed.
 *   2. NOT ONE WORD LOST. The static-build note's two forms — the yellow box
 *      every other desk still wears, and the `bare` one this desk asks for —
 *      are compared TEXT TO TEXT.
 *   3. THE LIST OF OMISSIONS IS WHOLE. `NotHere` lost its own `<details>` and
 *      kept every item.
 *   4. THE SELECTION LINE HAS A HOME, on the tokens, with its own eyebrow.
 *
 * ── ONE NOTE ON THE BUILD ──────────────────────────────────────────────────
 * This is the first test to import `web/site/boot.tsx`, which reads
 * `import.meta.env.BASE_URL`. That is why the root `tsconfig.json` now lists
 * `vite/client` beside `node` in `types`: the root project compiles the test
 * suite, and the suite now reaches one browser module.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { WhatIsMissing } from '../web/site/boot.js';
import { Count, Disclosure, RecordDrawer } from '../web/src/workbench/Chrome.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

/** A rendering's words, tags stripped and the entities static markup escapes put back. */
const textOf = (node: React.ReactNode): string =>
  renderToStaticMarkup(<>{node}</>)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x2014;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();

describe('ONE DISCLOSURE SHAPE, for every fold on the desk', () => {
  it('keeps its body out of the DOM until it is pressed, and says so through aria-expanded', async () => {
    const panel = await mount(
      <Disclosure shape="card" label="the commit log, 4 commits" title="Commit log">
        <p>every commit, and a press on one seeks to it</p>
      </Disclosure>,
    );
    expect(panel.words()).toContain('Commit log');
    expect(panel.words()).not.toContain('every commit, and a press on one seeks to it');
    const button = panel.host.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    await panel.press('the commit log, 4 commits');
    expect(panel.words()).toContain('every commit, and a press on one seeks to it');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    await panel.unmount();
  });

  it('carries the SAME chevron as the cards’ own Full note — the gesture is learned once', async () => {
    const panel = await mount(
      <Disclosure shape="card" label="x" title="x">
        <p>y</p>
      </Disclosure>,
    );
    // the one glyph every fold on this desk shows, and it turns over when open
    expect(panel.host.querySelector('svg path')?.getAttribute('d')).toBe('M2 4l4 4 4-4');
    expect(panel.host.querySelector('svg')?.getAttribute('style') ?? '').not.toContain('rotate(180deg)');
    await panel.press('x');
    expect(panel.host.querySelector('svg')?.getAttribute('style') ?? '').toContain('rotate(180deg)');
    await panel.unmount();
  });

  it('draws the glass card for the tail and nothing at all for a fold inside one', async () => {
    const card = await mount(
      <Disclosure shape="card" label="a" title="a">
        <p>b</p>
      </Disclosure>,
    );
    expect(card.host.querySelector('section')?.getAttribute('style') ?? '').toContain('var(--pw-glass-card)');
    await card.unmount();
    const bare = await mount(
      <Disclosure shape="bare" label="a" title="a">
        <p>b</p>
      </Disclosure>,
    );
    expect(bare.host.querySelector('section')?.getAttribute('style') ?? '').not.toContain('var(--pw-glass-card)');
    await bare.unmount();
  });

  it('spells a count in Mono at full ink, inside a title that is Sans', async () => {
    const panel = await mount(<Count>1,234</Count>);
    const style = panel.host.querySelector('span')?.getAttribute('style') ?? '';
    expect(style).toContain('var(--pw-font-mono)');
    expect(style).toContain('var(--pw-ink)');
    expect(panel.words()).toBe('1,234');
    await panel.unmount();
  });
});

describe('NOT ONE WORD LOST — the static-build note, both ways', () => {
  it('says exactly the same thing bare as it does in its box', () => {
    const extra = <> And one thing that is missing on every build of this desk: a version for the structure file.</>;
    expect(textOf(<WhatIsMissing bare extra={extra} />)).toBe(textOf(<WhatIsMissing extra={extra} />));
  });

  it('keeps every clause of it, including the one about the Sheet', () => {
    const said = textOf(<WhatIsMissing bare />);
    for (const clause of [
      'This is the static build.',
      'There is no server behind it',
      'commit log lives in this tab',
      'the served desk keeps one session per process',
      'Sources tab cannot refresh',
      'the files are what the repository committed',
      're-reading them would answer the same bytes',
      'every selection, every act, undo, named paths, bookmarks, compare, the Sheet',
      'is the same library doing the same work, here in the browser',
    ]) {
      expect(said, `the static-build note lost "${clause}"`).toContain(clause);
    }
  });

  it('drops the yellow box and ONLY the box — every other desk still wears it', () => {
    // the boxed form is what the CDC, grid and exoplanet pages render, and it is
    // byte-identical to what it rendered before the `bare` prop existed
    expect(renderToStaticMarkup(<WhatIsMissing />)).toContain('#fffbe9');
    // the protein desk supplies its own shell, so the words arrive with none
    expect(renderToStaticMarkup(<WhatIsMissing bare />)).not.toContain('#fffbe9');
    expect(renderToStaticMarkup(<WhatIsMissing bare />)).not.toContain('<div');
  });
});

describe('THE SELECTION LINE APPEARS ONLY WHEN THERE IS A SELECTION', () => {
  /**
   * It had a glass row of its own, then a second row inside the counted-facts
   * band, and now it has neither: between the stepper and the charts there is
   * NOTHING in the resting state. *"no selection — click a mark, shift-click to
   * add, drag across bars for a run"* is an INSTRUCTION, not a fact, and an
   * instruction in that gap is the paragraph this desk has spent four rounds
   * removing. A live clause IS information, so the row returns the moment there
   * is one — in the library's own words, unchanged.
   *
   * Dropping the prompt drops a discoverable affordance, so the page NAMES it
   * in its own list of what it does without. That is the mechanism for exactly
   * this, and using it is what makes the cut a choice rather than a loss.
   */
  const code = readFileSync(join(process.cwd(), 'web', 'src', 'protDesk.tsx'), 'utf8');

  it('renders nothing at all until the session has a selection or a saved picture', () => {
    expect(code).toContain('state.selections.length === 0 && state.saved.length === 0 ? null : (');
    // and the library's own two parts are what it renders then — never this
    // desk's re-wording of a clause
    expect(code).toContain('<SelectionChips');
    expect(code).toContain('<SavedSelections');
  });

  it('names the affordance it stopped announcing, in the page’s own list of omissions', () => {
    expect(code).toContain('that the marks are clickable');
    expect(code).toContain('shift-click to add');
    expect(code).toContain('lands a real commit on the record below');
    // and the title of that list counts it
    expect(code).toContain('one affordance it no longer announces');
  });
});

describe('THE RECORD IS A DRAWER AT THE BOTTOM EDGE — present without a scroll, open on a press', () => {
  /**
   * The author's ruling, taken literally: *I don't want a scrolling
   * dashboard.* So the record material is not below a fold at all — it is
   * behind a bar at the bottom edge of the instrument, which NAMES what is
   * inside it while it is shut. Nothing of it is deleted, its presence is
   * visible without scrolling anything, and reaching it is one deliberate act.
   */
  const TITLE = (
    <>
      <Count>4</Count> commits · <Count>2</Count> refused requests · the residues table at the cursor · the credit
    </>
  );

  it('names what is inside it while it is shut, and keeps the record out of the DOM until it is pressed', async () => {
    const drawer = await mount(
      <RecordDrawer label="open the record: 4 commits, 2 refused requests, the residues table at the cursor, the credit" title={TITLE}>
        <p>every commit, every refusal, the sheet, the recorder’s account and the credit</p>
      </RecordDrawer>,
    );
    const shut = drawer.words();
    // the presence is announced: the counts and the names are on the bar
    expect(shut).toContain('the record');
    expect(shut).toContain('4 commits');
    expect(shut).toContain('2 refused requests');
    expect(shut).toContain('the credit');
    // and the record itself is not rendered yet
    expect(shut).not.toContain('every commit, every refusal');
    const button = drawer.host.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    await drawer.press('open the record: 4 commits, 2 refused requests, the residues table at the cursor, the credit');
    expect(drawer.words()).toContain('every commit, every refusal, the sheet, the recorder’s account and the credit');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    await drawer.unmount();
  });

  it('opens OVER the instrument and scrolls itself — the page never scrolls to operate the desk', async () => {
    const drawer = await mount(
      <RecordDrawer label="open the record" title={TITLE}>
        <p>the record</p>
      </RecordDrawer>,
    );
    // absolutely positioned at the bottom edge of the instrument, so the charts
    // do not re-lay-out under a reader who only wanted to read a commit
    const shell = drawer.host.querySelector('div')?.getAttribute('style') ?? '';
    expect(shell).toContain('position: absolute');
    expect(shell).toContain('bottom: 0');
    await drawer.press('open the record');
    const panel = ([...drawer.host.querySelectorAll('div')] as HTMLElement[]).map((el) => el.getAttribute('style') ?? '').find((style) => style.includes('overflow-y')) ?? '';
    expect(panel).toContain('overflow-y: auto');
    expect(panel).toContain('max-height: 74vh');
    await drawer.unmount();
  });

  it('carries the SAME chevron as every other fold on this desk — the gesture is learned once', async () => {
    const drawer = await mount(
      <RecordDrawer label="open the record" title={TITLE}>
        <p>the record</p>
      </RecordDrawer>,
    );
    expect(drawer.host.querySelector('svg path')?.getAttribute('d')).toBe('M2 4l4 4 4-4');
    await drawer.unmount();
  });
});

describe('the composition really wires the tail that way', () => {
  /**
   * THE CODE, WITHOUT THE PROSE — the same reason `tests/prot-layers.test.ts`
   * strips comments: these files EXPLAIN what they replaced, and a test that
   * forbade the sentence would forbid the explanation.
   */
  const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const desk = code(readFileSync(join(process.cwd(), 'web', 'src', 'protDesk.tsx'), 'utf8'));
  const entry = code(readFileSync(join(process.cwd(), 'web', 'site', 'prot', 'entry.tsx'), 'utf8'));

  it('folds every piece of the record through the ONE shape, inside the drawer', () => {
    // `VizPanel` drew its own chrome a different way; nothing imports it now
    expect(desk).not.toContain('VizPanel');
    // the acts of each stage that dispatched any, the four record panels, the
    // recorder's account, the dashboard's own words and the omissions — and no
    // panel of its own for the band that no longer exists
    expect((desk.match(/<Disclosure/g) ?? []).length).toBe(8);
    expect(desk).toContain('<RecordDrawer');
  });

  it('takes the PAGE’s own foot as a prop and puts it in the same drawer', () => {
    // it used to be rendered after the desk, which meant the page scrolled to
    // reach it; now it is the last thing inside the record
    expect(desk).toContain('{record}');
    expect(entry).toContain('record={<PageFoot');
    expect(entry).not.toContain('</ProtDesk>');
  });

  it('reaches this desk’s tokens INSIDE the three library parts that re-root .vzf', () => {
    // the library's own `className` door, never a selector into its markup:
    // `SelectionChips`, `SavedSelections` and `Sheet` each render `class="vzf …"`
    // on themselves, which re-declares the library's defaults there
    expect((desk.match(/className="pw-scope"/g) ?? []).length).toBe(3);
  });

  it('asks for the static-build note BARE and wraps the foot in this desk’s own card', () => {
    expect(entry).toContain('bare');
    expect(entry).toContain('var(--pw-glass-card)');
    expect(entry).toContain('var(--pw-shadow-card)');
  });

  it('puts the NAME in the header and the def’s CLAIM in the record, with the dashboard’s own summary', () => {
    expect(desk).toContain('<WorkbenchHeader');
    expect(desk).toContain('title={name}');
    // and the commit line rides that same band, because it answers the same
    // question — *what am I looking at* — about time rather than about the entry
    expect(desk).toContain('at={');
    expect(desk).toContain('{rowsNote.line}');
    expect(desk).toContain('{claim}');
    // the two sentences the removed band folded away: they are prose about the
    // desk rather than about a picture, so they went where the prose went
    expect(desk).toContain('ABOUT_TITLE');
    expect(entry).toContain('name={PROT_WORDS.name}');
    expect(entry).toContain('claim={PROT_WORDS.title}');
  });
});
