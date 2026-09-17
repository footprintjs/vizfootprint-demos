/**
 * BOTH THEMES RESOLVE, AND THE TOKEN IS THE ONLY WAY A COLOUR REACHES THE
 * SCREEN.
 *
 * The workbench's theme is one stylesheet of custom properties
 * (`web/src/workbench/theme.css`) in three blocks — the light palette on
 * `:root`, the OS's dark under `@media (prefers-color-scheme: dark)` guarded by
 * `:root:not([data-theme="light"])`, and a host forcing dark on
 * `:root[data-theme="dark"]`. This suite reads that file as TEXT, because a
 * custom property is not a value a `jsdom` can be asked for: vitest stubs CSS
 * imports, so nothing would be loaded to compute. Reading the stylesheet is the
 * honest check and it is also the stronger one — it can say that a token which
 * turned over for the OS did NOT turn over for `data-theme`, which is a page
 * that looks different depending on how it was asked for the same thing.
 *
 * ── AND THE TWO COPIES OF TWO COLOURS ──────────────────────────────────────
 * The library's charts take their categorical colours through a FUNCTION
 * (`colorOf`), so the two chain hues have to exist in TypeScript as well as in
 * CSS (`web/src/workbench/tokens.ts` says why). Two copies of one value is what
 * this repository refuses, so the copy is PINNED here: the stylesheet is the
 * owner and the test fails when the two disagree.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACCENT_INK, CHAIN_INK, PW } from '../web/src/workbench/tokens.js';

const CSS = readFileSync(join(process.cwd(), 'web', 'src', 'workbench', 'theme.css'), 'utf8');

/**
 * THE BLOCK A SELECTOR OPENS, brace-matched from where the selector is found.
 *
 * Brace-matched rather than regular-expression-matched because the dark block
 * is a rule INSIDE an `@media` rule, and a lazy `}` would stop at the inner
 * one.
 */
function blockAfter(selector: string): string {
  // THE COMMENTS COME OFF FIRST. The stylesheet documents its own three-block
  // contract, so `:root` appears in its prose before it appears as a rule, and a
  // search over the raw text would find the sentence.
  const sheet = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const opens = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'm');
  const found = opens.exec(sheet);
  expect(found, `the stylesheet has no "${selector}" block — the three-block contract is broken`).not.toBeNull();
  const open = sheet.indexOf('{', (found?.index ?? 0) + selector.length - 1);
  let depth = 0;
  for (let i = open; i < sheet.length; i += 1) {
    if (sheet[i] === '{') depth += 1;
    else if (sheet[i] === '}') {
      depth -= 1;
      if (depth === 0) return sheet.slice(open + 1, i);
    }
  }
  throw new Error(`the "${selector}" block is never closed`);
}

/** Every `--pw-*` declaration of one block, as a map. Values are normalised on whitespace so a wrapped one still compares. */
function tokensIn(block: string): Readonly<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/(--pw-[a-z0-9-]+):\s*([^;]+);/g)) found[match[1] ?? ''] = (match[2] ?? '').replace(/\s+/g, ' ').trim();
  return found;
}

const LIGHT = tokensIn(blockAfter(':root'));
const OS_DARK = tokensIn(blockAfter("  :root:not([data-theme='light'])"));
const FORCED_DARK = tokensIn(blockAfter(":root[data-theme='dark']"));

describe('the three blocks the contract asks for', () => {
  it('declares the light palette on :root, and it is the complete vocabulary', () => {
    // enough tokens that this is a palette and not a sketch, and the ones every
    // band of the design needs are all there
    expect(Object.keys(LIGHT).length).toBeGreaterThan(60);
    for (const needed of [
      'pw-ground',
      'pw-ground-image',
      'pw-ink',
      'pw-prose',
      'pw-mid',
      'pw-soft',
      'pw-accent',
      'pw-accent-bright',
      'pw-on-accent',
      'pw-refuse',
      'pw-refuse-ink',
      'pw-chain-a',
      'pw-chain-b',
      'pw-glass-header',
      'pw-glass-panel',
      'pw-glass-hero',
      'pw-glass-card',
      'pw-mark-hatch',
      'pw-dash-near',
      'pw-dash-far',
      'pw-r-hero',
      'pw-r-card',
      'pw-font-sans',
      'pw-font-serif',
      'pw-font-mono',
      'pw-viewer-bg',
    ]) {
      expect(LIGHT, `:root declares no --${needed}`).toHaveProperty(`--${needed}`);
    }
  });

  it('guards the OS’s dark block so a host that forced LIGHT keeps light', () => {
    // the guard is the whole point: `@media (prefers-color-scheme: dark)` alone
    // would overrule a host that asked for light
    expect(CSS).toContain('@media (prefers-color-scheme: dark)');
    expect(CSS).toContain(":root:not([data-theme='light'])");
    expect(CSS).toContain(":root[data-theme='dark']");
  });

  it('redefines the SAME tokens in both dark blocks, with the same values', () => {
    expect(Object.keys(OS_DARK).sort()).toEqual(Object.keys(FORCED_DARK).sort());
    for (const [name, value] of Object.entries(OS_DARK)) expect(FORCED_DARK[name], `--${name} turns over for the OS but not for data-theme="dark"`).toBe(value);
  });

  it('turns over only tokens the light palette declares — a dark-only token would resolve to nothing in light', () => {
    for (const name of Object.keys(OS_DARK)) expect(LIGHT, `--${name} exists only in the dark`).toHaveProperty(name);
  });

  it('really turns over: every dark token differs from its light value', () => {
    const same = Object.entries(OS_DARK).filter(([name, value]) => LIGHT[name] === value);
    expect(same, 'a token restated in the dark block with the light value is a token that did not need restating').toEqual([]);
  });
});

describe('the charts are themed through the library’s own hook, and never reached into', () => {
  it('spends this desk’s tokens on the library’s --vzf-* names, on the .vzf root itself', () => {
    const bridge = blockAfter('.vzf.pw-scope');
    // the bridge must set the library's own names, from OUR tokens
    for (const name of ['--vzf-brand', '--vzf-ink', '--vzf-line', '--vzf-font-mono']) expect(bridge).toContain(name);
    for (const line of bridge.split('\n').filter((l) => l.includes('--vzf-'))) {
      expect(line, `the bridge sets ${line.trim()} to something that is not one of this desk's tokens`).toMatch(/var\(--pw-[a-z0-9-]+\)|transparent/);
    }
  });

  it('holds NO descendant selector under a chart’s own class — a chart’s internals are the library’s', () => {
    const offending = CSS.split('\n').filter((line) => /\.vzf-[a-z-]+\s+[.#a-z\[]/.test(line) || /\.vzf-chart\s/.test(line));
    expect(offending, 'a descendant selector under a .vzf-* class is a host restyling a picture it did not draw').toEqual([]);
  });
});

describe('the two copies of the chain colours are pinned to the stylesheet', () => {
  it('names the tokens the charts read', () => {
    expect(PW.chainA).toBe('--pw-chain-a');
    expect(PW.chainB).toBe('--pw-chain-b');
    expect(PW.accent).toBe('--pw-accent');
  });

  it('carries the SAME bytes the stylesheet carries, in both palettes', () => {
    expect(CHAIN_INK.light.a).toBe(LIGHT['--pw-chain-a']);
    expect(CHAIN_INK.light.b).toBe(LIGHT['--pw-chain-b']);
    expect(CHAIN_INK.dark.a).toBe(OS_DARK['--pw-chain-a']);
    expect(CHAIN_INK.dark.b).toBe(OS_DARK['--pw-chain-b']);
    expect(ACCENT_INK.light).toBe(LIGHT['--pw-accent']);
    expect(ACCENT_INK.dark).toBe(OS_DARK['--pw-accent']);
  });

  it('is the design’s own pair: chain A in the accent, chain B in the burnt orange, and a lighter pair in the dark', () => {
    // the one place these four values are written in a test, so a change to the
    // design has to come through here on purpose
    expect([CHAIN_INK.light.a, CHAIN_INK.light.b]).toEqual(['#02648f', '#a8551a']);
    expect([CHAIN_INK.dark.a, CHAIN_INK.dark.b]).toEqual(['#45a8d4', '#d9a05b']);
  });
});

describe('the one thing on this desk that moves', () => {
  it('declares the spin as a keyframe and stops it for a reader who asked for less motion', () => {
    expect(CSS).toContain('@keyframes pw-spin');
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
