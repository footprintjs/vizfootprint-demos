/**
 * THE THEME LAYER'S TYPESCRIPT HALF — the token NAMES, and the one place a
 * token's VALUE is resolved for code that cannot use a stylesheet.
 *
 * `./theme.css` is the owner of every value. This module exists because one
 * consumer of two of those values is not CSS at all: the library's charts take
 * their categorical colours through a FUNCTION.
 *
 * ── WHY THE CHART COLOURS CANNOT JUST BE CSS ────────────────────────────────
 * `vizfootprint-ui`'s bar, line and scatter each accept `colorOf` — a host
 * function from a category (a chain, here) to a colour — and spend its answer
 * as an SVG **presentation attribute** (`stroke=…`, `fill=…`). The library's
 * own default for an unsplit mark is the string `var(--vzf-brand)`, which
 * works only because a modern engine treats a presentation attribute as a CSS
 * declaration. This desk does not want its two chain colours to depend on
 * that: a browser that does not resolve `var()` there would paint the chains
 * in the default ink and nothing would say so. So the value is RESOLVED to a
 * literal here, off the live stylesheet, before it is handed over.
 *
 * ── THE TWO COPIES, and the test that keeps them one ────────────────────────
 * {@link CHAIN_INK} holds the same bytes the stylesheet holds, for the case
 * with no stylesheet at all (a unit test's jsdom, a server render). Two copies
 * of one value is exactly what this repository refuses, so
 * `tests/prot-theme.test.ts` PARSES `./theme.css` and fails when the two
 * disagree — the copy is pinned rather than trusted.
 */
import { useEffect, useState, type RefObject } from 'react';

/** The custom properties this desk reads from TypeScript. Every other token is spent in CSS and never named here. */
export const PW = {
  chainA: '--pw-chain-a',
  chainB: '--pw-chain-b',
  accent: '--pw-accent',
  /**
   * The ground the 3D well is drawn on — and now also the ground Mol* clears
   * its own canvas to (`web/src/molstarViewer.ts`). Two writers, one value.
   */
  viewerBg: '--pw-viewer-bg',
} as const;

/** Which palette the page is wearing. `auto` is not a value — it has already resolved to one of these by the time anything is drawn. */
export type PwMode = 'light' | 'dark';

/**
 * THE SAME BYTES `./theme.css` DECLARES — the fallback for an environment with
 * no stylesheet, and nothing else.
 *
 * Pinned against the stylesheet by `tests/prot-theme.test.ts`. If you change a
 * colour, change it in the stylesheet; the test will tell you to change it
 * here too.
 */
export const CHAIN_INK: Readonly<Record<PwMode, { readonly a: string; readonly b: string }>> = {
  light: { a: '#02648f', b: '#a8551a' },
  dark: { a: '#45a8d4', b: '#d9a05b' },
};

/** The accent, the same way — the ink the unsplit charts' own scale is drawn in. */
export const ACCENT_INK: Readonly<Record<PwMode, string>> = { light: '#02648f', dark: '#45a8d4' };

/**
 * THE 3D WELL'S GROUND, which is the same in both palettes.
 *
 * It is read in TypeScript for the same reason the two chain hues are: the
 * thing that needs it is not CSS. Mol\* clears its canvas to a NUMBER, so the
 * value has to arrive as a literal and be parsed (`web/src/molstarViewer.ts`).
 */
export const VIEWER_BG = '#05080b';

/** The palette a reader is actually seeing, asked of the browser. `light` wherever there is nothing to ask. */
export function currentMode(): PwMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced === 'dark') return 'dark';
  if (forced === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * ONE TOKEN, RESOLVED TO A LITERAL against a live element — or the fallback,
 * when there is no stylesheet to ask.
 *
 * An empty answer is the no-stylesheet case (a unit test, a server render) and
 * is treated as "nothing to ask", not as "the colour is empty".
 */
export function resolveToken(el: Element | null, name: string, fallback: string): string {
  if (el === null || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
  const value = window.getComputedStyle(el).getPropertyValue(name).trim();
  return value === '' ? fallback : value;
}

/** The two chain colours and the accent, as literals — everything a chart's `colorOf` needs. */
export interface WorkbenchInk {
  readonly chainA: string;
  readonly chainB: string;
  readonly accent: string;
  /** The 3D well's ground, as a CSS colour — handed to Mol\* so the canvas and the well are one ground. */
  readonly viewerBg: string;
}

/**
 * THE INK, FOLLOWING THE PALETTE.
 *
 * ```tsx
 * const root = useRef<HTMLDivElement>(null);
 * const ink = useWorkbenchInk(root);
 * <div ref={root} className="vzf pw-scope">…<VizLine colorOf={chainColorOf(chains, ink)} /></div>
 * ```
 *
 * Re-read when the OS palette changes, because the two chain colours differ
 * between the themes and a chart that kept the light pair on a dark ground
 * would be the one thing on the page that did not turn over.
 */
export function useWorkbenchInk(root: RefObject<Element | null>): WorkbenchInk {
  const [ink, setInk] = useState<WorkbenchInk>(() => inkOf(null, currentMode()));
  useEffect(() => {
    /**
     * READ NOW, and again whenever the palette turns over.
     *
     * The first read happens HERE and not during the render because a ref is
     * null until the element is attached: reading in the body would always take
     * the fallback and the stylesheet would never actually be asked. The answer
     * is compared before it is stored, so a read that found the same three
     * values causes no re-render at all.
     */
    const read = (): void => setInk((was) => sameInk(was, inkOf(root.current, currentMode())) ?? was);
    read();
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, [root]);
  return ink;
}

/** The three values, resolved against one element — or the mode's fallbacks where there is no stylesheet. */
function inkOf(el: Element | null, mode: PwMode): WorkbenchInk {
  return {
    chainA: resolveToken(el, PW.chainA, CHAIN_INK[mode].a),
    chainB: resolveToken(el, PW.chainB, CHAIN_INK[mode].b),
    accent: resolveToken(el, PW.accent, ACCENT_INK[mode]),
    viewerBg: resolveToken(el, PW.viewerBg, VIEWER_BG),
  };
}

/** `null` when the two are the same three values — so the held object keeps its identity and nothing downstream re-folds. */
function sameInk(was: WorkbenchInk, now: WorkbenchInk): WorkbenchInk | null {
  return was.chainA === now.chainA && was.chainB === now.chainB && was.accent === now.accent && was.viewerBg === now.viewerBg ? null : now;
}
