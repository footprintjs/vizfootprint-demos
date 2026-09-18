// @vitest-environment node
/**
 * A SELECTION IN ONE PANE IS VISIBLE IN ANOTHER — which is the REASON focus
 * mode exists, and therefore the claim the whole layout is bought for.
 *
 * ── WHY THIS IS NOT A LAYOUT TEST ──────────────────────────────────────────
 * The author's words: *focus means once a stage is chosen it gets bigger and
 * the rest stay small, so that a selection in one chart is visible in another —
 * otherwise there is no use.* This dashboard's views are crossfiltered
 * (`src/prot/def.ts` · `links.default: 'crossfilter'`): a pick in one narrows
 * the others. If a pane is off-screen when the pick is made, the effect is
 * unobservable — and an effect nobody can see might as well not have happened.
 *
 * So "one big, the rest small, all on screen at once, every one of them
 * drawing" is the only arrangement in which the library's interaction grammar
 * is usable, and this file is the test that the arrangement delivers it. It is
 * the same shape as `tests/prot-cursor.smoke.test.ts`, which proved the
 * pictures follow the cursor: drive the control a reader drives, then COUNT THE
 * MARKS.
 *
 * ── WHICH GESTURE, AND WHY THAT ONE ────────────────────────────────────────
 * The pick is a CLICK ON A BAR in the cross-chain tile — a real reader's
 * gesture, in a support pane and not in the focus, which also answers the
 * question of whether a reader can select FROM a tile: they can, and this is
 * the proof.
 *
 * It is NOT a drag across the focused surface chart, and that is the library's
 * own law rather than a gap here: that chart's x is a BAND of residue numbers
 * (the two chains share the axis), and `vizfootprint-ui` · `VizLine` says *a
 * band line draws no brush — an interval has no meaning on a band*. So the
 * chart in the focus slot is not the one that can start a selection on this
 * entry, which is exactly why every other pane has to be on screen and live.
 *
 * ── AND A DECLARED CAPABILITY THE RENDERER DOES NOT DELIVER (recorded here so
 * it is not lost; its fix is its own packet on both sides) ─────────────────
 * `src/prot/def.ts` · `capabilities` declares
 * `{ viewId: SURFACE_VIEW, canProbe: true, encodings: ['interval'] }`, and the
 * renderer draws no brush for that view's band x — so the page DECLARES a
 * gesture it cannot perform, and the surface caption faithfully repeats the
 * claim (*drag across the axis to keep a range of residue numbers*). That is
 * capability law 1 broken at the declaration, not at the caption: a true
 * caption over a false declaration is still a false declaration. Fixing the
 * caption alone is expressly not the answer.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildSiteIfMissing, startProtSite, type SiteHandle } from './protSiteServer.js';
import { EXAMPLE_ENTRY } from '../src/prot/archive.js';
import { INTERFACE_VIEW, RAMA_VIEW, SURFACE_VIEW } from '../src/prot/def.js';

const CHROME = process.env['VZF_CHROME'];

/** Every pane's mark count, by the address the cockpit stamps on it. */
const marks = (page: Page): Promise<Readonly<Record<string, number>>> =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-chart]')].map((el) => [el.getAttribute('data-chart') ?? '?', el.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect').length]),
    ),
  );

describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('a pick in one pane narrows the others, and it is on screen while it happens (real headless Chromium)', () => {
  let site: SiteHandle;
  let browser: Browser;
  let page: Page;
  const pageErrors: string[] = [];
  const say = (line: string): void => console.log(line);

  beforeAll(async () => {
    say(`the built site: ${await buildSiteIfMissing()}`);
    site = await startProtSite();
    browser = await chromium.launch({
      ...(CHROME !== undefined ? { executablePath: CHROME } : {}),
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    // THE TIGHTER BUDGET, on purpose: if the payoff is observable at 1280×800
    // it is observable everywhere.
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(`${site.protUrl}?entry=${EXAMPLE_ENTRY}`);
    await page.waitForSelector('[data-chart][data-focused="true"] circle.vzf-line-dot', { timeout: 120_000 });
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await site?.close();
  });

  it('draws every pane BEFORE the pick, so there is something to narrow', async () => {
    const before = await marks(page);
    say(`before the pick: ${Object.entries(before).map(([id, n]) => `${id} ${String(n)}`).join(' · ')}`);
    expect(before[SURFACE_VIEW]).toBeGreaterThan(100);
    expect(before[INTERFACE_VIEW]).toBeGreaterThan(100);
    expect(before[RAMA_VIEW]).toBeGreaterThan(100);
    // and none of it needed a scroll to be there
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
  });

  it('NARROWS EVERY OTHER PANE on a pick made in a TILE — and times the round trip', async () => {
    const before = await marks(page);
    const bars = page.locator(`[data-chart="${INTERFACE_VIEW}"] rect.vzf-barrect`);
    expect(await bars.count()).toBeGreaterThan(100);
    /*
      THE ROUND TRIP, MEASURED — the author asked for the number rather than a
      hunch: eight live panes all repaint on every pick, and if that is slow
      enough to feel broken the payoff is damaged even though it is correct.
      From the click to the focused pane settling at its new mark count.
    */
    const started = Date.now();
    await bars.nth(40).click({ force: true });
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length < 100, `[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 15_000 });
    const roundTrip = Date.now() - started;
    const after = await marks(page);
    say(`after a pick in the cross-chain tile: ${Object.entries(after).map(([id, n]) => `${id} ${String(n)}`).join(' · ')} — round trip ${String(roundTrip)} ms with eight panes live`);
    // THE CLAIM: the pick happened in a support pane and the FOCUS changed
    expect(after[SURFACE_VIEW]!).toBeLessThan(before[SURFACE_VIEW]!);
    /*
      AND EVERY OTHER PANE SHOWS IT, each in the way its own chart shows a
      clause — which is the library's law and not this desk's choice:
        · the LINE drops the marks outside the clause;
        · the SCATTER keeps its marks and DIMS the ones outside it
          (`vizfootprint-ui` · `VizScatter`: *dim under everyone's brush but my
          own*), so its count is the wrong thing to watch and its dimmed count
          is the right one;
        · the BAR that holds the clause is the self clause and does not dim
          itself, which is the same law seen from the other side.
      A test that demanded a falling COUNT everywhere would have demanded the
      library behave differently, which is not what this packet is about.
    */
    const dimmed = await page.evaluate(
      (ids) => ({ rama: document.querySelectorAll(`[data-chart="${ids.rama}"] .vzf-dim`).length, self: document.querySelectorAll(`[data-chart="${ids.bar}"] .vzf-dim`).length }),
      { rama: RAMA_VIEW, bar: INTERFACE_VIEW },
    );
    say(`  the backbone-angle pane dims ${String(dimmed.rama)} of its ${String(after[RAMA_VIEW] ?? 0)} marks; the pane the clause came from dims ${String(dimmed.self)} of its own`);
    expect(dimmed.rama).toBeGreaterThan(100);
    expect(dimmed.self).toBe(0);
    // …and the page never scrolled to show it
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
    // the number, for the record. 2,000 ms is the ceiling at which a reader
    // reads the desk as broken rather than busy; the measurement is in the
    // packet's report and this is the floor under it.
    expect(roundTrip).toBeLessThan(2_000);
  });

  it('says which pane holds the clause, and offers the one control that clears it', async () => {
    // the selection row appears only when there IS a selection — an empty strip
    // is an instruction, not a fact — and the library's own chips are what it
    // renders
    const said = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(said.toLowerCase()).toContain('selection');
    const clear = page.locator('button[aria-label^="clear the"]');
    expect(await clear.count()).toBe(1);
    say(`  the clause can be cleared by: ${(await clear.first().getAttribute('aria-label')) ?? '?'}`);
  });

  it('GIVES THE MARKS BACK when the clause is cleared — the half that would rot silently', async () => {
    const narrowed = await marks(page);
    const started = Date.now();
    await page.locator('button[aria-label^="clear the"]').first().click();
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 100, `[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 15_000 });
    const back = await marks(page);
    say(`cleared in ${String(Date.now() - started)} ms: ${Object.entries(back).map(([id, n]) => `${id} ${String(n)}`).join(' · ')}`);
    expect(back[SURFACE_VIEW]!).toBeGreaterThan(narrowed[SURFACE_VIEW]!);
    expect(back[INTERFACE_VIEW]!).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
  });

  it('threw nothing while doing it', () => {
    expect(pageErrors).toEqual([]);
  });
});
