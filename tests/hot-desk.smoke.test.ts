// @vitest-environment node
/**
 * THE FIFTH DESK IN A REAL BROWSER — every picture draws its marks, and a pick
 * in one of them narrows the others.
 *
 * The four assertions this desk needs a browser for, and cannot get anywhere
 * else:
 *
 *   1. THE PICTURES DRAW. A score that lands as a column and never reaches a
 *      mark is a column nobody can read;
 *   2. THE COUNTS ARE THE ABSENCE. The structural run draws every residue and
 *      the prior run draws fewer, because seventeen residues have no prior
 *      score at all — so the DIFFERENCE between two mark counts is the absence,
 *      visible on screen rather than only in a caption;
 *   3. THE REFUSAL IS ON THE PAGE. The gesture this page made before any act
 *      landed was refused by name, and the sentence is printed verbatim,
 *      because a visitor arrives after the acts and can never reach it
 *      themselves. IT IS ONE PRESS AWAY NOW rather than above the desk: the
 *      page wears the protein workbench's shell (`web/src/hot/desk.tsx`), whose
 *      record lives in a drawer at the bottom edge because *"I don't want a
 *      scrolling dashboard"*. The assertion is unchanged — the same sentence,
 *      verbatim — and the press is what proves it is REACHABLE rather than
 *      merely present in a string;
 *   4. EVERY COMPONENT NARROWS THE DESK ON A PRESS — the law the protein desk's
 *      picks kept, and the reason the two scores are worth landing as columns
 *      at all.
 *
 * It builds the site when the checkout has none, for the reason
 * `tests/protSiteServer.ts` gives: a browser assertion that skipped itself is
 * exactly the green-that-proves-nothing this repository refuses.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildSiteIfMissing, startProtSite, type SiteHandle } from './protSiteServer.js';
import { PATCHES_VIEW, PRIOR_VIEW, STRUCTURAL_VIEW, TOGETHER_VIEW } from '../src/hot/def.js';
import { NO_PATCH_COLOR, PATCH_PALETTE } from '../web/src/hot/cells.js';
import { STRUCTURAL_COLUMN } from '../src/hot/analyses.js';

const CHROME = process.env['VZF_CHROME'];

/** Every pane's mark count, by the address the cockpit stamps on it. */
const marks = (page: Page): Promise<Readonly<Record<string, number>>> =>
  page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('[data-chart]')].map((el) => [el.getAttribute('data-chart') ?? '?', el.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect').length])),
  );

/** How many marks a pane draws BRIGHT — a chart that dims rather than drops says its in-force count that way. */
const bright = (page: Page, address: string): Promise<number> =>
  page.evaluate((id) => {
    const pane = document.querySelector(`[data-chart="${id}"]`);
    if (pane === null) return -1;
    return [...pane.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect')].filter((el) => !el.classList.contains('vzf-dim') && el.closest('.vzf-dim') === null).length;
  }, address);

describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('the fifth desk, in real headless Chromium', () => {
  let site: SiteHandle;
  let browser: Browser;
  let page: Page;
  const pageErrors: string[] = [];

  beforeAll(async () => {
    console.log(`the built site: ${await buildSiteIfMissing()}`);
    site = await startProtSite();
    browser = await chromium.launch({ ...(CHROME !== undefined ? { executablePath: CHROME } : {}), headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(`${site.url}${site.base}hot/`);
    // the desk is ready when the structural run has its marks — the picture
    // that cannot draw until the score has landed
    await page.waitForSelector(`[data-chart="${STRUCTURAL_VIEW}"] circle.vzf-line-dot`, { timeout: 120_000 });
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await site?.close();
  });

  it('threw nothing on the way in', () => {
    expect(pageErrors).toEqual([]);
  });

  it('draws every picture, and the difference between two of them IS the absence', async () => {
    const drawn = await marks(page);
    console.log(`marks: ${Object.entries(drawn).map(([id, n]) => `${id} ${String(n)}`).join(' · ')}`);
    // every residue carries a structural score …
    expect(drawn[STRUCTURAL_VIEW]).toBe(185);
    // … and seventeen carry no prior score at all, so the prior run is shorter
    // by exactly those seventeen. Absent, never zero — a line that dipped would
    // draw 185 here.
    expect(drawn[PRIOR_VIEW]).toBe(168);
    expect(drawn[TOGETHER_VIEW]).toBe(168);
    // and the bars are the patched residues only
    expect(drawn[PATCHES_VIEW]).toBe(15);
  });

  it('prints the library’s own refusal for the gesture it made before any act landed — one press into the record', async () => {
    // THE RECORD DRAWER, at the bottom edge of the instrument: its shut bar
    // NAMES what is inside without scrolling anything, and one press opens it
    // (`web/src/workbench/Chrome.tsx` · `RecordDrawer`). The page's own foot —
    // what this build cannot do, and this refusal — rides it, exactly as the
    // protein desk's foot does.
    const bar = page.locator('button[aria-label^="open the record"]');
    expect(await bar.count()).toBe(1);
    await bar.click();
    const said = await page.evaluate(() => document.body.textContent ?? '');
    expect(said).toContain(`no column "${STRUCTURAL_COLUMN}" in table "residues"`);
    // and shut again, so the presses below are not reaching through it
    await bar.click();
  });

  it('says of its largest patch that no sequence window could have found it — in that picture’s own full note', async () => {
    /*
      ONE PRESS, AND WHERE IT LANDS IS THE SHELL'S OWN LAW.

      A long caption is read on the CARD, and the card is whatever the cursor's
      stage produced (`web/src/hot/desk.tsx` — the focus is derived, never
      hard-wired). At rest this desk's cursor stands at its last commit, which
      is the stage that made the patches, so this picture is ALREADY the focus
      and its note is one press. A rail tile has no note at all — it is a
      picture and a name — so a picture that is NOT the focus is promoted first,
      which is the same walk one press longer. Asserted rather than assumed: the
      promote control is pressed only when it is there.
    */
    const promote = page.locator(`[data-chart="${PATCHES_VIEW}"] button[aria-label^="bring "]`);
    if ((await promote.count()) > 0) {
      await promote.first().click();
      await page.waitForSelector(`[data-chart="${PATCHES_VIEW}"] [data-focus-mark="true"]`, { timeout: 30_000 });
    }
    expect(await page.locator(`[data-chart="${PATCHES_VIEW}"] [data-focus-mark="true"]`).count(), 'the patch bars are not in the focus, so they have no note to open').toBe(1);
    await page.locator(`[data-chart="${PATCHES_VIEW}"] button[aria-label^="the full note for"]`).first().click();
    const said = await page.evaluate(() => document.body.textContent ?? '');
    expect(said).toContain('spans chains A and B');
    expect(said).toContain('swallow 23 residues that are NOT in it');
  });

  /**
   * THE TWO PICTURES OF ONE COLUMN MUST AGREE — the regression guard for a real
   * defect, caught in a browser before anything was pushed.
   *
   * The scatter and the bar chart both draw `hotspot_structural`. The scatter
   * was drawing every one of its 168 dots inside 63px of a 968px plot — an
   * apparent ceiling of 0.49 — while the bars beside it drew peaks of 0.75 and
   * the extent rule selected the 15 residues above 0.5. Neither picture was
   * wrong about the DATA (measured: all 15 high-structural residues carry a
   * prior score and are in the scatter, max 0.7457). The chart was drawing
   * against its own data extent PADDED BY 5 IN THE COLUMN'S OWN UNITS, so the
   * domain was [-4.96, 5.75] and a 0…1 score occupied 6.6% of its axis
   * (`vizfootprint/ui` · `VizScatter`, `padFor(xKind, 5)`).
   *
   * The fix is a DECLARED domain — the fixed weight budget both scores are
   * scored on (`web/src/hot/cells.tsx` · `SCORE_DOMAIN`) — and these are the
   * three things a browser can check about it.
   */
  it('DRAWS BOTH SCORES ON THEIR DECLARED 0…1 BUDGET — the scatter and the bars agree about one column', async () => {
    const seen = await page.evaluate((id) => {
      const pane = document.querySelector(`[data-chart="${id}"]`);
      if (pane === null) return null;
      const svg = [...pane.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
      if (svg === undefined) return null;
      const box = svg.getBoundingClientRect();
      const dots = [...pane.querySelectorAll('circle.vzf-dot')].map((d) => {
        const r = d.getBoundingClientRect();
        return { cx: r.left + r.width / 2, fill: (d.getAttribute('fill') ?? window.getComputedStyle(d).fill).toLowerCase() };
      });
      const cx = dots.map((d) => d.cx);
      return {
        dots: dots.length,
        spreadOfSvg: (Math.max(...cx) - Math.min(...cx)) / box.width,
        ticks: [...pane.querySelectorAll('text.vzf-tick')].map((t) => t.textContent),
        // the 15 rightmost dots — the residues with the highest structural score
        rightmostFills: [...dots].sort((a, b) => b.cx - a.cx).slice(0, 15).map((d) => d.fill),
        // …and the 15 leftmost, so the test can prove it can TELL the two apart
        leftmostFills: [...dots].sort((a, b) => a.cx - b.cx).slice(0, 15).map((d) => d.fill),
      };
    }, TOGETHER_VIEW);
    expect(seen).not.toBeNull();
    console.log(`the scatter: ${String(seen!.dots)} dots spanning ${(seen!.spreadOfSvg * 100).toFixed(1)}% of its box; ticks ${seen!.ticks.join(' ')}`);

    // 1 · THE MARKS USE THE AXIS. 63px of 1,150 was 5.5%; anything under 40%
    // means a domain far wider than the budget has come back.
    expect(seen!.spreadOfSvg).toBeGreaterThan(0.4);

    // 2 · THE DECLARED BUDGET IS ON SCREEN. Before the fix these read
    // `0 0 0 0 0`, because an undeclared domain sent the tick VALUES through a
    // ceil/floor that collapsed them.
    expect(seen!.ticks).toEqual(['0', '0.25', '0.5', '0.75', '1']);

    // 3 · AND NO X TICK IS DRAWN, which is a refusal rather than an omission:
    // this library labels a scatter's x ticks `Math.round(v)`, so on a 0…1
    // column they would read `0 0 1 1 1` — three of five naming a value that is
    // not under them (`web/src/hot/cells.tsx` argues it in full). Five labels,
    // and they are the y axis's.
    expect(seen!.ticks).toHaveLength(5);

    // 4 · THE TWO PICTURES AGREE. The bar chart draws exactly the residues
    // scoring above the extent floor; on a 0…1 axis those are the rightmost
    // dots, and every one of them carries a PATCH's hue rather than the grey
    // this desk paints a residue in no patch. No pixel arithmetic needed — if
    // the axis were crushed again the rightmost dots would be arbitrary.
    /** A fill as the DOM gave it back, in one spelling — an attribute is the hex we handed over, a computed style is `rgb(r, g, b)`. */
    const rgb = (fill: string): string => {
      const hex = /^#([0-9a-f]{6})$/.exec(fill.trim());
      if (hex === null) return fill.replace(/\s+/g, '');
      const n = Number.parseInt(hex[1]!, 16);
      return `rgb(${String((n >> 16) & 255)},${String((n >> 8) & 255)},${String(n & 255)})`;
    };
    const patchHues = new Set(PATCH_PALETTE.map(rgb));
    const grey = rgb(NO_PATCH_COLOR);
    // every one of the rightmost dots is a PATCH's hue …
    expect(seen!.rightmostFills.map(rgb).filter((fill) => !patchHues.has(fill))).toEqual([]);
    // … and the test can tell the two apart, which is what stops the line above
    // passing because nothing matched anything
    expect(seen!.leftmostFills.map(rgb)).toContain(grey);
  });

  it('NARROWS THE DESK on a press in the patch bars — the law every pick on this family of desks keeps', async () => {
    const before = await marks(page);
    // THE POINTER TARGET, not the drawn bar — the library draws one transparent
    // full-height rect per slot so a narrow mark is still reachable, and a press
    // on the mark itself can be swallowed by the crowding note painted over it
    // (measured and reported by `tests/prot-crossfilter.smoke.test.ts`).
    const targets = page.locator(`[data-chart="${PATCHES_VIEW}"] rect.vzf-mark-hit`);
    expect(await targets.count()).toBeGreaterThan(0);
    await targets.first().click({ force: true });
    await page.waitForFunction(
      ([id, was]) => {
        const pane = document.querySelector(`[data-chart="${id as string}"]`);
        if (pane === null) return false;
        const lit = [...pane.querySelectorAll('circle.vzf-line-dot')].filter((el) => !el.classList.contains('vzf-dim') && el.closest('.vzf-dim') === null).length;
        return lit < (was as number);
      },
      [STRUCTURAL_VIEW, before[STRUCTURAL_VIEW] ?? 0] as const,
      { timeout: 30_000 },
    );
    const after = await bright(page, STRUCTURAL_VIEW);
    console.log(`the structural run: ${String(before[STRUCTURAL_VIEW])} marks before the press, ${String(after)} in force after it`);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before[STRUCTURAL_VIEW] ?? 0);
  });
});
