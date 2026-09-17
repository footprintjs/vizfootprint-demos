// @vitest-environment node
/**
 * THE PICTURES FOLLOW THE CURSOR — asserted in a real browser, because a unit
 * test already asserted it and the screen did not keep the claim.
 *
 * ── WHY THIS FILE EXISTS, and it is the lesson not the feature ──────────────
 * `tests/prot-progression.test.ts` proves, green, that seeking behind the
 * surface act makes the library refuse the read again in its own words and the
 * cell print that sentence. Measured on the built page, clicking a trace row
 * changed NOTHING: 565 marks before the seek, 565 after. The test drove the
 * LIBRARY and passed; the page drove a SNAPSHOT it had read once at boot, so the
 * two were never talking about the same thing. A claim about what a reader sees
 * has to be made where the reader is.
 *
 * ── WHAT IT ASSERTS ─────────────────────────────────────────────────────────
 * On the built protein page, over the committed example entry, with the two
 * stages landed:
 *
 *   1. the surface chart has marks — the run finished and the column is there;
 *   2. seeking to the FIRST act's commit (the pair table, which lands no column
 *      on `residues` at all) removes every one of those marks and puts the
 *      library's own sentence in their place — `no column "sasa" in table
 *      "residues"`, the words `src/prot/session.ts` · `probeTheUnlandedColumns`
 *      collected from this very session before the stages ran;
 *   3. seeking forward to the surface act's own commit brings the marks back.
 *
 * ── HOW IT DRIVES THE BROWSER ───────────────────────────────────────────────
 * The library's own smoke pattern (`vizfootprint` · `ui/gallery/*.smoke.test.ts`):
 * `playwright-core`, `VZF_CHROME` when it is set and otherwise the headless
 * shell playwright-core installed, and the three ANGLE flags — Mol* asks for a
 * WebGL context on mount and a headless shell without them has none to give.
 * The page is served by `tests/protSiteServer.ts` out of the same `dist/site`
 * that `tests/prot-site.test.ts` walks as files.
 *
 * Nothing here evaluates the page's own JavaScript to move the cursor. Every
 * seek is a CLICK on the control a reader clicks, found by its accessible name,
 * so what passes is the desk and not a back door into it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildSiteIfMissing, startProtSite, type SiteHandle } from './protSiteServer.js';
import { EXAMPLE_ENTRY } from '../src/prot/archive.js';
import { PAIRS_ACT, SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import { SURFACE_VIEW } from '../src/prot/def.js';

/** An explicit browser, when the environment names one; unset ⇒ playwright-core launches the headless shell it installed. */
const CHROME = process.env['VZF_CHROME'];

/** The surface cell, by the id the cockpit stamps on every chart cell (`data-chart`). */
const SURFACE = `[data-chart="${SURFACE_VIEW}"]`;
/** Its marks: one dot per residue on the run (`vizfootprint-ui` · `VizLine`). */
const MARKS = `${SURFACE} circle.vzf-line-dot`;
/** The sentence the library refuses a read of the unlanded column with — assembled from the same constants the page uses, never typed twice. */
const REFUSAL = `no column "${SASA_COLUMN}" in table "residues"`;

/** What one act's seek control is called on screen (`web/src/protTrace.tsx` · `ActRow`). */
const seekLabel = (act: string): string => `seek the cursor to the commit act "${act}" landed`;

/**
 * OPEN WHATEVER IS CLOSED OVER THE ACT ROWS.
 *
 * A stage on the stepper holds its acts until a reader opens it, and only one
 * stage is open at a time. Both facts are carried by `aria-expanded`, so one
 * gesture — press the first thing that is closed, look again — reaches any
 * act's row without this test knowing the stepper's markup.
 */
async function openTheActs(page: Page, act: string): Promise<void> {
  // BY ITS ACCESSIBLE NAME, not by a CSS attribute selector: the name carries
  // the act id in double quotes, which is not spellable inside `[aria-label="…"]`
  const target = page.getByLabel(seekLabel(act), { exact: true });
  for (let tries = 0; tries < 6; tries += 1) {
    if ((await target.count()) > 0) return;
    const closed = page.locator('[aria-expanded="false"]');
    if ((await closed.count()) === 0) break;
    await closed.first().click();
  }
  if ((await target.count()) === 0) throw new Error(`no control on the page is called "${seekLabel(act)}" — the acts are not reachable, so nothing about the cursor can be asserted`);
}

/** Click one act's seek control and let the re-read settle. */
async function seekTo(page: Page, act: string): Promise<void> {
  await openTheActs(page, act);
  await page.getByLabel(seekLabel(act), { exact: true }).first().click();
}

describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('the protein desk’s pictures follow the cursor (real headless Chromium)', () => {
  let site: SiteHandle;
  let browser: Browser;
  let page: Page;
  const pageErrors: string[] = [];
  /**
   * WHAT EACH STEP MEASURED, printed as it is measured.
   *
   * A passing run says the numbers out loud — "185 marks, then 0, then 185" is
   * the whole claim, and a green tick that printed nothing is what let this bug
   * live for a release.
   */
  const say = (line: string): void => console.log(line);

  beforeAll(async () => {
    console.log(`the built site: ${await buildSiteIfMissing()}`);
    site = await startProtSite();
    browser = await chromium.launch({
      ...(CHROME !== undefined ? { executablePath: CHROME } : {}),
      headless: true,
      // Mol* mounts a WebGL context; a headless shell with no GPU needs these
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(`${site.protUrl}?entry=${EXAMPLE_ENTRY}`);
    // the run has to finish before there is a cursor to move: the surface act is
    // the last of the three, and its marks are what say it landed
    await page.waitForSelector(MARKS, { timeout: 120_000 });
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await site?.close();
  });

  it('draws the surface run at the head — the marks are there to lose', async () => {
    const marks = await page.locator(MARKS).count();
    say(`at the head: ${String(marks)} marks on the surface chart`);
    expect(marks).toBeGreaterThan(100);
    expect(await page.locator(SURFACE).innerText()).not.toContain(REFUSAL);
  });

  it('SEEKS TO THE FIRST ACT’S COMMIT and the surface chart loses every mark and prints the library’s own sentence', async () => {
    await seekTo(page, PAIRS_ACT);
    // the re-read is a promise: wait for the marks to GO, and fail loudly if
    // they never do — which is exactly what this page did before this packet
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 0, MARKS, { timeout: 30_000 });
    const marks = await page.locator(MARKS).count();
    const said = await page.locator(SURFACE).innerText();
    // the LINE that carries the refusal, not the cell's first line — the first
    // line of a cell is its own title, and a report that quoted it would be
    // quoting the chrome instead of the answer
    say(`after seeking to the ${PAIRS_ACT} commit: ${String(marks)} marks, and the cell says "${said.split('\n').find((line) => line.includes(REFUSAL)) ?? said}"`);
    expect(marks).toBe(0);
    expect(said).toContain(REFUSAL);
  });

  it('SEEKS FORWARD to the surface act’s commit and the marks come back', async () => {
    await seekTo(page, SURFACE_ACT);
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 0, MARKS, { timeout: 30_000 });
    const marks = await page.locator(MARKS).count();
    say(`after seeking forward to the ${SURFACE_ACT} commit: ${String(marks)} marks`);
    expect(marks).toBeGreaterThan(100);
    expect(await page.locator(SURFACE).innerText()).not.toContain(REFUSAL);
  });

  it('threw nothing while doing it', () => {
    expect(pageErrors).toEqual([]);
  });
});
