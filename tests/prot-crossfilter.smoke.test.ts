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
 * A DRAG ACROSS A RUN IS ASSERTED TOO, in the last test, and it now LANDS.
 *
 * ── THE CAUSE WAS RECORDED WRONG HERE TWICE, AND THIS IS THE MEASUREMENT ───
 * For three packets a reader's drag across either run did nothing: the brush
 * drew, the gesture fired, and the refusal ledger climbed once per drag. This
 * file recorded the reason twice and was wrong both times — first *a band line
 * draws no brush* (it does; the live rectangle appears under a real pointer),
 * then *the run positions itself through `epochOf` and emits string DATE keys*
 * (true of a line over a NUMBER axis, and a real defect fixed in the library —
 * but not this chart's, because these two are bands).
 *
 * THE MEASURED CAUSE WAS TWO CAUSES, ONE PER TIER, and neither was visible
 * without reading the session's own refused-requests panel:
 *
 *   1. `src/prot/def.ts` declared `encodings: ['interval']` for both runs. A
 *      line over a BAND emits a MATCH on a drag and a POINT on a tap; an
 *      interval is a voice it never had. So the session refused for the
 *      capability — *view "conservation" does not encode a match selection* —
 *      which the library had already pinned: *a view declaring only point
 *      accepts a match; one declaring only interval refuses it as guard-failed*.
 *   2. With that fixed the clause LANDED and kept NOTHING: a band's slots are
 *      named `String(cell)`, so the match carried the spellings `["27","28",…]`
 *      to `resnum`, which holds numbers. Worse than the dead gesture, because
 *      the record then claimed the question was answered. The library's answer
 *      is `slotValues` — *a slot is a NAME for a value, and a clause carries
 *      the value* — plus a door that refuses a spelling by name
 *      (`unaddressable-value`) rather than landing an empty commit. This page
 *      delivers it by handing the chart `cell` beside each slot name
 *      (`web/src/protCells.tsx` · `surfaceRun`).
 *
 * THE LESSON, worth more than either fix: the page was printing the answer in
 * words the whole time, on its own ledger. Read the refusal off the record
 * before theorising about it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildSiteIfMissing, startProtSite, type SiteHandle } from './protSiteServer.js';
import { EXAMPLE_ENTRY } from '../src/prot/archive.js';
import { CONSERVATION_VIEW, INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';

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
    // THE CONSERVATION RUN IS ON THE GRAMMAR TOO, and its count is the honest
    // one: 162 of the entry's 185 residues have a column in their family's
    // alignment, and the other 23 have none, so the line stops rather than
    // dipping to zero
    expect(before[CONSERVATION_VIEW]).toBe(162);
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
    for (const address of [RAMA_VIEW, SURFACE_VIEW, STRUCTURE_VIEW, CONSERVATION_VIEW]) expect(said[address], address).not.toBe(null);

    // …and the words agree with the pictures, pane by pane, in the way each chart shows a clause
    const drawn = await marks(page);
    const brightDots = await bright(page, RAMA_VIEW);
    say(`  the scatter draws ${String(drawn[RAMA_VIEW] ?? 0)} dots of which ${String(brightDots)} are bright; the run draws ${String(drawn[SURFACE_VIEW] ?? 0)} marks`);
    expect(claimed(said[RAMA_VIEW] ?? null)).toBe(brightDots);
    expect(claimed(said[SURFACE_VIEW] ?? null)).toBe(drawn[SURFACE_VIEW]);
    // the conservation run drops its marks the same way the surface run does,
    // so its sentence counts the marks it really drew
    expect(claimed(said[CONSERVATION_VIEW] ?? null)).toBe(drawn[CONSERVATION_VIEW]);
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

  /*
    ── AND THE ONE GESTURE NEITHER RUN CAN COMPLETE, MEASURED ────────────────
    Both line panes declare an INTERVAL and both captions invite the drag. The
    drag is TAKEN — a real pointer at the marks' own coordinates draws the
    library's own live brush rectangle — and the release lands NOTHING: the
    session refuses the clause and files one more gap.

    The file header has the cause (the library's line snaps a run's interval to
    the string KEYS of its own x positions, and these runs' x is a residue
    NUMBER). The fix is a packet on both sides. What this test buys is that the
    state cannot rot in either direction: if the library starts delivering it,
    this fails and the finding comes out of the header; if somebody "fixes" the
    caption instead of the declaration, the declaration is still here.

    IT IS ASSERTED ON BOTH RUNS, because the finding is about the CHART KIND and
    not about the new column: the conservation run inherited it by being a line
    over a number, exactly as the surface run has been since it landed.
  */
  it('AND A DRAG ON EITHER RUN NOW LANDS ITS CLAUSE AND NARROWS THE DESK — nothing refused', async () => {
    /** How many requests the session has refused, read off the record drawer's own count. */
    const gapsSoFar = async (): Promise<number> => {
      for (let tries = 0; tries < 5; tries += 1) {
        const closed = page.locator('[aria-expanded="false"]');
        if ((await closed.count()) === 0) break;
        await closed.first().click();
        await page.waitForTimeout(250);
      }
      const said = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      const found = /Every request the session refused (\d+)/.exec(said);
      return found === null ? -1 : Number(found[1]);
    };
    const shut = async (): Promise<void> => {
      const bar = page.locator('button[aria-label^="open the record"], button[aria-label^="shut the record"]');
      if ((await bar.count()) > 0) await bar.first().click();
      await page.waitForTimeout(400);
    };

    const atBoot = await gapsSoFar();
    await shut();
    // THREE AT BOOT: the desk makes one refused gesture at each of the three
    // charts declared over a column no act has landed yet
    // (`src/prot/session.ts` · `probeTheUnlandedColumns`)
    say(`  the session has refused ${String(atBoot)} requests at boot`);
    expect(atBoot).toBe(3);

    let refused = atBoot;
    for (const view of [CONSERVATION_VIEW, SURFACE_VIEW]) {
      const before = await marks(page);
      const drag = await page.evaluate((id) => {
        // SORTED BY X, because the run draws one series per chain and the DOM
        // order is the series' — dot number twenty is not twenty per cent of
        // the way across the axis, and a backwards drag is a gesture nobody
        // makes
        const dots = [...document.querySelectorAll(`[data-chart="${id}"] circle.vzf-line-dot`)].map((el) => el.getBoundingClientRect()).sort((a, b) => a.x - b.x);
        if (dots.length < 10) return null;
        const from = dots[Math.floor(dots.length * 0.1)]!;
        const to = dots[Math.floor(dots.length * 0.7)]!;
        return { x1: from.x + from.width / 2, x2: to.x + to.width / 2, y: from.y + from.height / 2, dots: dots.length };
      }, view);
      expect(drag, `${view} drew too few marks to drag between`).not.toBeNull();
      await page.mouse.move(drag!.x1, drag!.y);
      await page.mouse.down();
      await page.mouse.move(drag!.x1 + 12, drag!.y);
      await page.mouse.move(drag!.x2, drag!.y, { steps: 20 });
      // THE GESTURE IS TAKEN: the library's own live rectangle is on screen
      // mid-drag, which is what says the refusal below is not a lost pointer
      const drawn = await page.evaluate((id) => document.querySelectorAll(`[data-chart="${id}"] rect.vzf-brush`).length, view);
      expect(drawn, `${view} drew no brush rectangle under the drag`).toBeGreaterThan(0);
      await page.mouse.up();
      await page.waitForTimeout(1200);

      // …AND THE CLAUSE LANDED: there is something to clear, and the OTHER pane
      // narrowed. The bar is the witness rather than the dragged run itself —
      // a run keeps drawing every slot of its own band and shows its selection
      // as an outline, so its mark count is the wrong question to ask it.
      expect(await page.locator('button[aria-label^="clear the"]').count(), `${view} landed no clause`).toBeGreaterThan(0);
      const after = await marks(page);
      expect(after[INTERFACE_VIEW], `the bar did not narrow after a drag on ${view}`).toBeLessThan(before[INTERFACE_VIEW]!);
      expect(after[INTERFACE_VIEW]).toBeGreaterThan(0);
      // AND NOTHING WAS REFUSED — the ledger stands exactly where boot left it.
      // This is the assertion that matters: it stood at +1 per drag for three
      // packets, and the reason recorded here was wrong twice (a band draws no
      // brush; then a date-shaped interval). The measured cause was TWO, one
      // per tier — the view declared `interval` while a line over a band emits
      // a match and a point, and then the band emitted its slot NAMES against a
      // column of numbers. Both are fixed at their own tier, and a spelling on
      // the wire now refuses by name (`unaddressable-value`) instead of landing
      // a commit that keeps nothing.
      const now = await gapsSoFar();
      say(`  the drag across ${view} (${String(drag!.dots)} marks, ${String(Math.round(drag!.x1))}→${String(Math.round(drag!.x2))}) landed its clause — the bar went ${String(before[INTERFACE_VIEW])}→${String(after[INTERFACE_VIEW])} bars, the refusal ledger is still at ${String(now)}`);
      expect(now, `${view}'s drag was refused`).toBe(refused);
      await shut();
      // give the next run a clean desk, so its own narrowing is its own
      const clear = page.locator('button[aria-label^="clear the"]');
      if ((await clear.count()) > 0) await clear.first().click();
      await page.waitForTimeout(900);
    }
  }, 180_000);

  it('threw nothing while doing it', () => {
    expect(pageErrors).toEqual([]);
  });
});
