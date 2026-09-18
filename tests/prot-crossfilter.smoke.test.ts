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
import { INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';

const CHROME = process.env['VZF_CHROME'];

/** Every pane's mark count, by the address the cockpit stamps on it. */
const marks = (page: Page): Promise<Readonly<Record<string, number>>> =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-chart]')].map((el) => [el.getAttribute('data-chart') ?? '?', el.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect').length]),
    ),
  );

/**
 * WHAT EACH PANE SAYS about the selection it did not make — the narrowing
 * sentence, read off the page by the one attribute the two slots that can hold
 * it share (`web/src/workbench/ChartCard.tsx`: the card's footer and a tile's
 * figure line). `null` for a pane that says nothing.
 */
const sentences = (page: Page): Promise<Readonly<Record<string, string | null>>> =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-chart]')].map((el) => [el.getAttribute('data-chart') ?? '?', el.querySelector('[data-narrowed="true"]')?.textContent ?? null]),
    ),
  );

/** How many marks a pane draws BRIGHT — the scatter keeps its dots and dims the ones a clause drops, so its in-force count is the un-dimmed one. */
const bright = (page: Page, address: string): Promise<number> =>
  page.evaluate((id) => {
    const pane = document.querySelector(`[data-chart="${id}"]`);
    if (pane === null) return -1;
    const all = pane.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect');
    return [...all].filter((el) => !el.classList.contains('vzf-dim') && el.closest('.vzf-dim') === null).length;
  }, address);

/** The first number in a sentence — what the page CLAIMS is in force, as a number a test can compare with the marks. */
const claimed = (said: string | null): number | null => {
  const found = /^([\d,]+) of ([\d,]+)/.exec(said ?? '');
  return found === null ? null : Number((found[1] ?? '').replace(/,/g, ''));
};

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

  it('SAYS NOTHING AT REST — the resting page carries no narrowing line at all', async () => {
    const said = await sentences(page);
    say(`at rest: ${Object.entries(said).map(([id, line]) => `${id} ${line === null ? '(silent)' : `"${line}"`}`).join(' · ')}`);
    expect(Object.values(said).filter((line) => line !== null)).toEqual([]);
  });

  it('NARROWS EVERY OTHER PANE on a pick made in a TILE — and times the round trip', async () => {
    const before = await marks(page);
    const bars = page.locator(`[data-chart="${INTERFACE_VIEW}"] rect.vzf-barrect`);
    expect(await bars.count()).toBeGreaterThan(100);
    /*
      ── WHAT THE POINTER PRESSES, and why it is no longer the drawn bar ──────
      The library grew a POINTER TARGET per bar — one transparent full-height
      rect over the mark's own slot column (`vizfootprint-ui` · `VizBar`, the
      WCAG 2.2 AA floor of 24px or the slot when the slot is narrower) — which
      is exactly the affordance the last packet reported as missing. So the
      gesture a reader's pointer really lands on is that target, and this is
      what the test drives. The bar underneath still carries the same two
      handlers and the same accessible name; the press is one gesture either
      way.

      AND PRESSING THE DRAWN BAR NOW LANDS NOTHING, measured here and reported
      as a FINDING rather than worked around silently: the same library packet
      draws its *marks are closer together than a pointer can separate* note as
      an SVG `<text>` inside the plot, and that text is painted OVER the marks
      with no `pointer-events: none` — so `document.elementFromPoint` at a
      bar's own centre answers `text.vzf-crowded-note`, the press is swallowed,
      and nothing is selected. A note about a pointer problem that blocks the
      pointer is the sharpest possible version of the bug it describes.

      THE ROUND TRIP, MEASURED — the author asked for the number rather than a
      hunch: eight live panes all repaint on every pick, and if that is slow
      enough to feel broken the payoff is damaged even though it is correct.
      From the click to the focused pane settling at its new mark count.
    */
    const targets = page.locator(`[data-chart="${INTERFACE_VIEW}"] rect.vzf-mark-hit`);
    expect(await targets.count()).toBe(await bars.count());
    const started = Date.now();
    await targets.nth(40).click({ force: true });
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

  /*
    ── THE ASSERTION THIS PACKET IS BOUGHT FOR ────────────────────────────────
    The author's complaint was not that the crossfilter is broken — it works,
    and the test above measures it. It is that **nothing on the page SAYS so**,
    and a connection nobody can see is the same as no connection.

    So: with the clause from the pick above still in force, every pane but the
    one it came from must now carry a sentence, and THE NUMBER IN IT MUST MATCH
    THE MARKS THE PICTURE ACTUALLY DRAWS — bright ones where the chart dims
    (the scatter), drawn ones where it drops them (the line). That is the half a
    unit test cannot buy: it is what stops the page claiming a narrowing its
    picture does not show.
  */
  it('SAYS SO, IN EVERY OTHER PANE — and the number in each sentence is the marks that pane really drew', async () => {
    const said = await sentences(page);
    say(`with the clause in force:${Object.entries(said).map(([id, line]) => `\n    ${id}: ${line === null ? '(silent — it is the source)' : `"${line}"`}`).join('')}`);
    // the pane the clause came FROM is the only silent one; it already shows its own selection
    expect(said[INTERFACE_VIEW]).toBe(null);
    for (const address of [RAMA_VIEW, SURFACE_VIEW, STRUCTURE_VIEW]) expect(said[address], address).not.toBe(null);

    // …and the words agree with the pictures, pane by pane, in the way each chart shows a clause
    const drawn = await marks(page);
    const brightDots = await bright(page, RAMA_VIEW);
    say(`  the scatter draws ${String(drawn[RAMA_VIEW] ?? 0)} dots of which ${String(brightDots)} are bright; the run draws ${String(drawn[SURFACE_VIEW] ?? 0)} marks`);
    expect(claimed(said[RAMA_VIEW] ?? null)).toBe(brightDots);
    expect(claimed(said[SURFACE_VIEW] ?? null)).toBe(drawn[SURFACE_VIEW]);
    // the receipt is the one pane no clause can be judged on, and it says that rather than nothing
    expect(said[PAIRS_VIEW] ?? '').toContain('cannot be judged here');
    // nothing scrolled to say any of it
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
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
    /*
      AND THE SENTENCES GO WITH THE CLAUSE. An absence is absent: a line that
      outlived the selection it was about would be the same lie as a count that
      outlived its picture, and it is the half that would rot silently — every
      pane is back to saying nothing.
    */
    const said = await sentences(page);
    say(`  after the clear:${Object.entries(said).map(([id, line]) => ` ${id} ${line === null ? '(silent)' : `"${line}"`}`).join(' ·')}`);
    expect(Object.values(said).filter((line) => line !== null)).toEqual([]);
  });

  it('threw nothing while doing it', () => {
    expect(pageErrors).toEqual([]);
  });
});
