/**
 * THE FIFTH DESK WEARS THE FOURTH'S CLOTHES, AND THE FOUR LAYERS ARE APART —
 * the proof, not a paragraph promising it.
 *
 * ── WHY THIS SUITE EXISTS ──────────────────────────────────────────────────
 * This page was built once with the library's packaged `Desk` while the desk it
 * is meant to be READ BESIDE — the protein workbench, one link away, on the same
 * entry — is `web/src/workbench/`. The author's ruling: *"I expected you to use
 * exactly this same UI/UX for this, because both are same purpose."* Two desks
 * built to be compared must wear the same clothes, or a reader cannot tell
 * whether a difference on screen is the SCORING or the SCREEN.
 *
 * A screenshot proves it once. THIS proves it every run: the assertions below
 * are about IMPORTS, so a later change that quietly swaps one desk back onto a
 * bespoke component, or forks a copy of `ChartCard` into a `hot/`-local file,
 * fails here rather than in somebody's eyes six months from now.
 *
 * `tests/prot-layers.test.ts` is the precedent and is deliberately untouched:
 * it judges the workbench folder itself. This one judges the SECOND consumer of
 * it, which is the first proof that folder's liftability claim was true.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.cwd();
const HOT = join(REPO, 'web', 'src', 'hot');
const ENTRY = join(REPO, 'web', 'site', 'hot', 'entry.tsx');

const read = (path: string): string => readFileSync(path, 'utf8');

/** Every import specifier of one module, and whether it was a `type`-only one — `tests/prot-layers.test.ts`'s own reader. */
function importsOf(source: string): readonly { readonly from: string; readonly typeOnly: boolean }[] {
  const found: { from: string; typeOnly: boolean }[] = [];
  for (const match of source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)';?$/gm)) found.push({ from: match[2] ?? '', typeOnly: match[1] !== undefined });
  for (const match of source.matchAll(/^import\s+'([^']+)';?$/gm)) found.push({ from: match[1] ?? '', typeOnly: false });
  return found;
}

/** The code, without the prose — a doc comment naming a module is the pointer this repository asks for, never a violation. */
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const desk = read(join(HOT, 'desk.tsx'));
const cells = read(join(HOT, 'cells.tsx'));
const stages = read(join(HOT, 'stages.ts'));
const entry = read(ENTRY);
const protDesk = read(join(REPO, 'web', 'src', 'protDesk.tsx'));

describe('the desk folder holds the layers it says it holds', () => {
  it('has exactly three modules — the composition, the cells and the rules', () => {
    // a module ADDED here cannot slip past the rules below by being classified
    // as something nobody checks
    expect(readdirSync(HOT).sort()).toEqual(['cells.tsx', 'desk.tsx', 'stages.ts']);
  });

  it('stages.ts is RULES: no React at runtime, no library, no session', () => {
    const source = code(stages);
    for (const { from, typeOnly } of importsOf(source)) {
      if (from === 'react') expect(typeOnly, 'the rules layer renders nothing').toBe(true);
      expect(from, `stages.ts imports "${from}", which is not a declaration or a sibling`).toMatch(/^(\.\.?\/|\.\.\/\.\.\/\.\.\/src\/)/);
    }
    for (const forbidden of ['vizfootprint', 'useState', 'useMemo', 'document.', 'window.']) {
      expect(source.includes(forbidden), `stages.ts names "${forbidden}" — the rules layer has no React, no DOM and no session`).toBe(false);
    }
  });

  it('cells.tsx is the PICTURES and touches no session: it is handed rows that were already read', () => {
    const source = code(cells);
    for (const forbidden of ['useSessionView', 'sessionSource', 'createSessionView', 'fetch(', 'session.']) {
      expect(source.includes(forbidden), `cells.tsx names "${forbidden}" — the cells are handed rows, they do not read them`).toBe(false);
    }
  });

  it('desk.tsx is the composition — the only file here that knows all four layers exist', () => {
    // LAYER 4 — the data
    expect(desk).toContain("from '../protProjection.js'");
    expect(desk).toContain("from '../protRows.js'");
    expect(desk).toContain("from 'vizfootprint-ui'");
    // LAYER 3 — the folds, the workbench's and this desk's own
    for (const fold of ['../workbench/charts.js', '../workbench/steps.js', '../workbench/arrangement.js', '../workbench/bands.js', './stages.js']) {
      expect(desk, `the composition does not reach ${fold}`).toContain(`from '${fold}'`);
    }
    // LAYER 2 — the components
    for (const part of ['../workbench/Chrome.js', '../workbench/ChartCard.js', '../workbench/Stepper.js']) {
      expect(desk, `the composition does not reach ${part}`).toContain(`from '${part}'`);
    }
  });
});

describe('THE SHELL IS THE PROTEIN WORKBENCH’S OWN, by import and not by resemblance', () => {
  /** Which workbench COMPONENT modules a composition imports — the upper-case siblings. */
  const componentsOf = (source: string): readonly string[] =>
    [...new Set(importsOf(source).flatMap(({ from }) => [...from.matchAll(/workbench\/([A-Z][A-Za-z]*)\.js$/g)].map((m) => m[1]!)))].sort();

  it('every component of the fifth desk’s shell is one the FOURTH desk draws itself with', () => {
    const mine = componentsOf(desk);
    const theirs = componentsOf(protDesk);
    expect(mine.length, 'the fifth desk imports no workbench component at all').toBeGreaterThan(0);
    for (const part of mine) expect(theirs, `${part} is not a component the protein desk uses — the two shells have parted`).toContain(part);
    // and the three that carry the whole look: the header and the record
    // drawer, the cards and tiles, the stepper
    expect(mine).toEqual(expect.arrayContaining(['ChartCard', 'Chrome', 'Stepper']));
  });

  it('draws its cards, tiles, homes and dividers with the workbench’s own exports', () => {
    for (const symbol of ['ChartCard', 'ChartTile', 'PaneHome', 'RegionDivider', 'RecordDrawer', 'WorkbenchHeader', 'StageStepper', 'Disclosure', 'Count']) {
      expect(desk, `the fifth desk does not use ${symbol}`).toContain(symbol);
    }
  });

  it('forks NO copy of a workbench component into this folder', () => {
    // the two-copies drift this project has refused everywhere else: a
    // `hot/`-local module that declared one of these would be a second owner
    for (const source of [desk, cells, stages]) {
      for (const forked of ['export function ChartCard', 'export function ChartTile', 'export function PaneHome', 'export function WorkbenchHeader', 'export function StageStepper', 'export function RecordDrawer']) {
        expect(source.includes(forked), `a workbench component is re-declared in web/src/hot/ — "${forked}"`).toBe(false);
      }
    }
  });

  it('does NOT reach for the library’s packaged cockpit — that was the defect', () => {
    // `DeskChart`/`DeskProjection` are the cells' own contract and are types;
    // the packaged `Desk` COMPONENT is the thing this page stopped rendering.
    expect(desk.includes('{ Desk }'), 'the composition renders the packaged Desk again').toBe(false);
    expect(entry.includes('{ Desk }'), 'the page renders the packaged Desk again').toBe(false);
    expect(entry.includes('<Desk'), 'the page renders the packaged Desk again').toBe(false);
  });

  it('loads the workbench THEME and puts its ground on the body, exactly as the protein page does', () => {
    for (const page of [entry, read(join(REPO, 'web', 'site', 'prot', 'entry.tsx'))]) {
      expect(page).toContain("import '../../src/workbench/theme.css';");
      expect(page).toContain("document.body.classList.add('pw-body')");
    }
  });
});

describe('RULE 3 — the theme is the only place a colour lives', () => {
  const COLOUR = /(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/;

  for (const [name, source] of [
    ['web/src/hot/desk.tsx', desk],
    ['web/site/hot/entry.tsx', entry],
  ] as const) {
    it(`${name} contains no colour literal`, () => {
      const offending = code(source)
        .split('\n')
        .map((line, index) => ({ line, at: index + 1 }))
        .filter(({ line }) => COLOUR.test(line))
        .map(({ line, at }) => `${name}:${String(at)} ${line.trim()}`);
      expect(offending).toEqual([]);
    });
  }

  it('the ONE declared palette on this desk is the patch palette, and it is in the cells where the charts read it', () => {
    /*
      NOT AN EXEMPTION GRANTED TO GET GREEN. `web/src/hot/cells.tsx` declares
      the hues a patch is painted with, and they are DATA rather than chrome:
      a patch has to keep its colour between the scatter and the bars, which is
      the one thing those two pictures are beside each other for, and the
      library takes them through its own `colorOf` door. The file's own header
      states it. What this assertion pins is that the exception is exactly those
      two declarations and has not spread.
     */
    const offending = code(cells)
      .split('\n')
      .filter((line) => COLOUR.test(line) && !/PATCH_PALETTE|NO_PATCH_COLOR/.test(line));
    expect(offending).toEqual([]);
  });
});
