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
 *      themselves;
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

  it('prints the library’s own refusal for the gesture it made before any act landed', async () => {
    const said = await page.evaluate(() => document.body.textContent ?? '');
    expect(said).toContain(`no column "${STRUCTURAL_COLUMN}" in table "residues"`);
  });

  it('says of its largest patch that no sequence window could have found it', async () => {
    const said = await page.evaluate(() => document.body.textContent ?? '');
    expect(said).toContain('spans chains A and B');
    expect(said).toContain('swallow 23 residues that are NOT in it');
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
