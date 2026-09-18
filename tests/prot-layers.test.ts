/**
 * THE FOUR LAYERS ARE APART, AND THIS IS THE PROOF — not a paragraph promising
 * it.
 *
 * The author's ruling for the protein workbench: *design this space as theme
 * separate, components separate, business logic, data logic separate. Don't
 * tangle these — make it reusable.* A boundary nobody checks is a boundary that
 * closes within a release, so this suite READS THE IMPORTS of every module in
 * `web/src/workbench/` and judges each one by which layer it is in.
 *
 * ── WHY THIS IS THE DELIVERABLE AND NOT HOUSEKEEPING ───────────────────────
 * A component that takes only props is a component that can later move into
 * `vizfootprint-ui` and serve every desk. A component that reaches into the
 * session can never move. This desk exists to find what the library must
 * abstract for a third-party chart, so the boundary drawn here IS the finding —
 * and a test is the only way to keep it true.
 *
 * ── THE FOUR RULES ─────────────────────────────────────────────────────────
 *   1. A COMPONENT (an upper-case `.tsx` in the folder) imports `react` and
 *      sibling components, and nothing else. No session, no hook that reads
 *      one, no `fetch`, nothing from `src/prot/`, nothing from `vizfootprint`.
 *   2. BUSINESS LOGIC (a lower-case `.ts`, `tokens.ts` excepted) pulls in no
 *      React at runtime — a `type`-only import is allowed, since a type is not
 *      code — and reaches no data-layer module and no library.
 *   3. THE THEME is the only place a colour lives: no module of the workbench,
 *      and neither of the two composition files, may contain a colour literal.
 *   4. THE THEME'S TypeScript half (`tokens.ts`) imports React and nothing
 *      else: it is where a token's value is resolved for code that cannot use
 *      a stylesheet, and that is its whole job.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WORKBENCH = join(process.cwd(), 'web', 'src', 'workbench');

/** Every module of the folder, by file name. */
const modules = readdirSync(WORKBENCH).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

const read = (file: string): string => readFileSync(join(WORKBENCH, file), 'utf8');

/**
 * EVERY IMPORT SPECIFIER of one module, and whether it was a `type`-only one.
 *
 * A regular expression over the source rather than a parse: these files are
 * hand-written with one import per statement and the shapes are exactly the two
 * below, so a parser would be a dependency for no extra truth.
 */
function importsOf(source: string): readonly { readonly from: string; readonly typeOnly: boolean }[] {
  const found: { from: string; typeOnly: boolean }[] = [];
  const pattern = /^import\s+(type\s+)?[^;]*?from\s+'([^']+)';?$/gm;
  for (const match of source.matchAll(pattern)) found.push({ from: match[2] ?? '', typeOnly: match[1] !== undefined });
  // a bare side-effect import (`import './theme.css';`)
  for (const match of source.matchAll(/^import\s+'([^']+)';?$/gm)) found.push({ from: match[1] ?? '', typeOnly: false });
  return found;
}

/**
 * THE CODE, WITHOUT THE PROSE.
 *
 * Every rule below is about what a module DOES, never about what it explains: a
 * component's doc comment naming `src/prot/def.ts` as the place a prose slot is
 * declared is exactly the pointer this repository asks for, and a test that
 * forbade the sentence would forbid the documentation. So the comments come off
 * before anything is judged.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** A module is a COMPONENT when its name starts with a capital — the folder's one naming rule. */
const isComponent = (file: string): boolean => /^[A-Z]/.test(file);
/** The theme's TypeScript half. Everything else lower-case is business logic. */
const isTheme = (file: string): boolean => file === 'tokens.ts';

describe('the workbench folder holds the layers it says it holds', () => {
  it('has components, business logic and a theme — and this suite knows which is which', () => {
    const components = modules.filter(isComponent);
    const logic = modules.filter((f) => !isComponent(f) && !isTheme(f));
    // the names are asserted so that a module ADDED to the folder cannot slip
    // past the rules below by being classified as something nobody checks
    // `StagePanel.tsx` is GONE, with the prose band it drew: the author's
    // ruling — *no paragraphs below the stepper* — left it with nothing to
    // draw, and its every field moved to the thing it was about
    // (`panel.ts` · the file header has the field-by-field map).
    expect(components.sort()).toEqual(['ChartCard.tsx', 'Chrome.tsx', 'Search.tsx', 'Stepper.tsx']);
    expect(logic.sort()).toEqual(['bands.ts', 'charts.ts', 'panel.ts', 'results.ts', 'steps.ts']);
    expect(modules.filter(isTheme)).toEqual(['tokens.ts']);
  });
});

describe('RULE 1 — a component takes props, and could move into the library tomorrow', () => {
  for (const file of modules.filter(isComponent)) {
    it(`${file} imports only react and its sibling components`, () => {
      for (const { from } of importsOf(read(file))) {
        if (from === 'react') continue;
        // a relative sibling, and it has to be another COMPONENT
        expect(from, `${file} imports "${from}", which is not a sibling component`).toMatch(/^\.\/[A-Z][A-Za-z]*\.js$/);
      }
    });

    it(`${file} names no session, no fetch and nothing from src/prot`, () => {
      const source = code(read(file));
      for (const forbidden of ['src/prot/', 'protRows', 'protProjection', 'protCells', 'protStages', 'protDesk', 'vizfootprint', 'fetch(', 'useSessionView', 'sessionSource']) {
        expect(source.includes(forbidden), `${file} names "${forbidden}" — a component that reaches the data layer can never move into the library`).toBe(false);
      }
    });
  }
});

describe('RULE 2 — business logic is pure functions over plain data', () => {
  for (const file of modules.filter((f) => !isComponent(f) && !isTheme(f))) {
    it(`${file} pulls in no React at runtime and reaches no data-layer module`, () => {
      const source = code(read(file));
      for (const { from, typeOnly } of importsOf(source)) {
        if (from === 'react') {
          expect(typeOnly, `${file} imports React as code — the rules layer renders nothing`).toBe(true);
          continue;
        }
        expect(from, `${file} imports "${from}", which is not a declaration, a sibling or the run's own types`).toMatch(/^(\.\.?\/|\.\.\/\.\.\/\.\.\/src\/prot\/)/);
      }
      // the rules may read the run's own declarations; they may NOT read the
      // session, the hooks over it, or the library
      for (const forbidden of ['protRows', 'protProjection', 'protCells.js', 'protDesk', 'vizfootprint', 'useState', 'useMemo', 'document.', 'window.']) {
        expect(source.includes(forbidden), `${file} names "${forbidden}" — the rules layer has no React, no DOM and no session`).toBe(false);
      }
    });
  }
});

describe('RULE 3 — the theme is the only place a colour lives', () => {
  /** A colour literal in any of its four spellings. `#fff`, `#02648f`, `rgb(`, `rgba(`, `hsl(`. */
  const COLOUR = /(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/;

  /** Every file that draws part of this desk and is NOT the stylesheet. */
  const drawn = [
    ...modules.map((f) => ({ name: `web/src/workbench/${f}`, source: code(read(f)) })),
    { name: 'web/src/protDesk.tsx', source: code(readFileSync(join(process.cwd(), 'web', 'src', 'protDesk.tsx'), 'utf8')) },
    { name: 'web/src/protLanding.tsx', source: code(readFileSync(join(process.cwd(), 'web', 'src', 'protLanding.tsx'), 'utf8')) },
    { name: 'web/src/protTrace.tsx', source: code(readFileSync(join(process.cwd(), 'web', 'src', 'protTrace.tsx'), 'utf8')) },
    // the page's own foot is styled here too since the follow-up round, so it
    // is judged by the same rule as everything else that draws
    { name: 'web/site/prot/entry.tsx', source: code(readFileSync(join(process.cwd(), 'web', 'site', 'prot', 'entry.tsx'), 'utf8')) },
  ];

  for (const { name, source } of drawn) {
    it(`${name} contains no colour literal`, () => {
      const offending = source
        .split('\n')
        .map((line, index) => ({ line, at: index + 1 }))
        // `tokens.ts` is the theme's own TypeScript half and holds the ONE
        // documented copy of the three colours code has to read rather than
        // spend in CSS — the two chain hues and the 3D well's ground — each
        // pinned to the stylesheet by `tests/prot-theme.test.ts`
        .filter(({ line }) => COLOUR.test(line) && !(name.endsWith('tokens.ts') && /CHAIN_INK|ACCENT_INK|VIEWER_BG|light:|dark:/.test(line)))
        .map(({ line, at }) => `${name}:${String(at)} ${line.trim()}`);
      expect(offending).toEqual([]);
    });
  }
});

describe('RULE 4 — the theme’s TypeScript half names the tokens and nothing more', () => {
  it('tokens.ts imports react and nothing else', () => {
    for (const { from } of importsOf(read('tokens.ts'))) expect(from).toBe('react');
  });
});

describe('and the composition is the only file that knows all four exist', () => {
  const composition = readFileSync(join(process.cwd(), 'web', 'src', 'protDesk.tsx'), 'utf8');

  it('protDesk.tsx wires 4 → 3 → 2: the data hooks, the folds and the components', () => {
    // LAYER 4 — the only code on this page that touches the session
    expect(composition).toContain("from './protProjection.js'");
    expect(composition).toContain("from 'vizfootprint-ui'");
    // LAYER 3 — the folds
    for (const fold of ['./workbench/bands.js', './workbench/charts.js', './workbench/panel.js', './workbench/steps.js']) expect(composition).toContain(`from '${fold}'`);
    // LAYER 2 — the components
    for (const part of ['./workbench/Chrome.js', './workbench/ChartCard.js', './workbench/Stepper.js']) expect(composition).toContain(`from '${part}'`);
  });

  it('does its own counting nowhere: every number on the two top bands comes from a fold', () => {
    // the header's method line is folded, never assembled here — and the facts
    // STRIP is gone with its fold, because every line of it was a second copy
    // of a count the card it belonged to already carried
    expect(composition).toContain('methodLine(credit)');
    expect(composition).not.toContain('factsStrip(');
    // and the STAGE's words likewise — folded, never assembled here, even now
    // that they are read on the focused card instead of in a band
    expect(composition).toContain('stageWords({');
  });
});
