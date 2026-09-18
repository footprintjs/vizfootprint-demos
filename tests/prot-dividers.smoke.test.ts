// @vitest-environment node
/**
 * THE DIVIDER IS PUSHED TO ITS STOP AND THE LAYOUT STILL KEEPS ITS PROMISE —
 * measured in a real browser, because every number in that claim is a layout
 * number and a layout number measured in jsdom is a number about jsdom.
 *
 * ── WHY A BROWSER TEST AND NOT ONLY THE PURE ONE ───────────────────────────
 * `tests/prot-dividers.test.tsx` proves the RULE: where the floors come from,
 * that a share past one is held at it, and that a value read out of storage is
 * clamped against the window it is read INTO. None of that can say whether a
 * pane at the floor still draws, and **a layout test alone would not catch the
 * loss of the thing the floor exists to protect.**
 *
 * This layout exists so that a selection made in one chart is visible in the
 * others (`src/prot/def.ts` · `links.default: 'crossfilter'`). So the assertion
 * that matters most here is the last one: with the divider pushed all the way
 * to its stop, **a pick in a tile still takes the focus's marks down.** A
 * satellite column that had quietly become too narrow to show a selection would
 * pass every size assertion above it and fail that one.
 *
 * ── WHAT IT DRIVES, AT 1280×800 — the tighter of the two budgets ───────────
 *   1. two real `role="separator"` controls, with their values, on the page;
 *   2. the vertical divider dragged to the SATELLITES' stop: the column holds
 *      at 256px, every pane that drew still draws its marks over a real band,
 *      the page height is still exactly the viewport, and the page says WHY it
 *      stopped in its own voice;
 *   3. the same divider dragged the other way to the FOCUS's stop, and the same
 *      four things;
 *   4. THE CROSSFILTER AT THE STOP: a pick in the cross-chain tile, the focus's
 *      marks down, the clause cleared, the marks back;
 *   5. the horizontal divider's two stops, the same way;
 *   6. the keyboard: an arrow, `Home`, `End` and the way back;
 *   7. the boundary REMEMBERED across a reload, and the page's own arrangement
 *      back when the stored value is cleared;
 *   8. and that a drag lands NOTHING ON THE RECORD — the commit count on the
 *      record's own bar is the same before and after.
 *
 * Every number it measures, it PRINTS. A green tick that printed nothing is
 * what let a whole release ship with charts that did not follow the cursor
 * (`tests/prot-cursor.smoke.test.ts` is that lesson).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildSiteIfMissing, startProtSite, type SiteHandle } from './protSiteServer.js';
import { EXAMPLE_ENTRY } from '../src/prot/archive.js';
import { framePad } from 'vizfootprint-ui';
import { INTERFACE_VIEW, RAMA_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { AXIS_ROOM } from '../web/src/protCells.js';
import { CARD_CHROME, COLUMN_CLAMP, SPLIT_STORAGE_KEY, TILE_CHROME, markFloor } from '../web/src/workbench/charts.js';

const CHROME = process.env['VZF_CHROME'];

/** The library's OWN margin for the kinds this desk draws — the same union the page folds its floors from. */
const PAD = framePad(['line', 'bar', 'point']);

/** The four stops, in px, spelled here from the same sources the page folds them from — so this file states what it is measuring against. */
const STOPS = {
  railFar: COLUMN_CLAMP.floor * COLUMN_CLAMP.rootPx,
  railNear: COLUMN_CLAMP.ceiling * COLUMN_CLAMP.rootPx,
  stripFar: markFloor(PAD).height + TILE_CHROME,
  stripNear: AXIS_ROOM + CARD_CHROME,
} as const;

/** What one reading of the page says. */
interface Measured {
  readonly page: number;
  readonly viewport: number;
  readonly focus: { readonly id: string | null; readonly w: number; readonly h: number; readonly drawn: number; readonly drawnW: number; readonly marks: number };
  readonly panes: readonly { readonly id: string; readonly w: number; readonly h: number; readonly drawn: number; readonly marks: number; readonly band: number }[];
  readonly values: readonly { readonly axis: string | null; readonly now: string | null; readonly min: string | null; readonly max: string | null }[];
  readonly stop: string | null;
  readonly stored: string | null;
}

const measure = (page: Page): Promise<Measured> =>
  page.evaluate(
    ({ ids, key }) => {
      const marksIn = (el: Element | null): number => (el === null ? 0 : el.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect').length);
      /** THE MARKS' OWN BAND, not their count: measured before this desk's honesty floor, a 67px pane reported 185 dots and drew them in a 5px band. */
      const bandIn = (el: Element | null): number => {
        const marks = [...(el?.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect') ?? [])];
        if (marks.length < 2) return 0;
        const tops = marks.map((m) => m.getBoundingClientRect().top);
        return Math.round(Math.max(...tops) - Math.min(...tops));
      };
      const paneOf = (id: string) => {
        const el = document.querySelector(`[data-tile="true"][data-chart="${id}"]`) ?? document.querySelector(`[data-chart="${id}"]`);
        const box = el?.getBoundingClientRect();
        const frame = el?.querySelector('.vzf-chart-frame')?.getBoundingClientRect();
        return { id, w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0), drawn: Math.round(frame?.height ?? 0), marks: marksIn(el ?? null), band: bandIn(el ?? null) };
      };
      const hero = document.querySelector('[data-chart][data-focused="true"]');
      const heroFrame = hero?.querySelector('.vzf-chart-frame')?.getBoundingClientRect();
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(key);
      } catch {
        stored = null;
      }
      return {
        page: document.documentElement.scrollHeight,
        viewport: window.innerHeight,
        focus: {
          id: hero?.getAttribute('data-chart') ?? null,
          w: Math.round(hero?.getBoundingClientRect().width ?? 0),
          h: Math.round(hero?.getBoundingClientRect().height ?? 0),
          drawn: Math.round(heroFrame?.height ?? 0),
          drawnW: Math.round(heroFrame?.width ?? 0),
          marks: marksIn(hero),
        },
        panes: ids.map(paneOf),
        values: [...document.querySelectorAll('[role="separator"]')].map((el) => ({
          axis: el.getAttribute('aria-orientation'),
          now: el.getAttribute('aria-valuenow'),
          min: el.getAttribute('aria-valuemin'),
          max: el.getAttribute('aria-valuemax'),
        })),
        // THE DIVIDER'S OWN, by its own mark: the page has another `role="status"` — the line that says which commit the pictures are drawn at
        stop: document.querySelector('[role="status"][data-divider-stop="true"]')?.textContent ?? null,
        stored,
      };
    },
    { ids: [INTERFACE_VIEW, RAMA_VIEW], key: SPLIT_STORAGE_KEY },
  );

describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('the reader moves the boundary, and the layout keeps its promise at the stop (real headless Chromium)', () => {
  let site: SiteHandle;
  let browser: Browser;
  let page: Page;
  const pageErrors: string[] = [];
  const say = (line: string): void => console.log(line);

  /** The two panes that DRAW in the satellites — the ones a floor exists for. */
  const drawing = (m: Measured): readonly Measured['panes'][number][] => m.panes.filter((p) => p.drawn > 0);

  /**
   * THE MARKS ARE REALLY THERE — two checks, and it takes both.
   *
   * The pane clears the MARK FLOOR, so the plot the library leaves it is at
   * least 34px; and the marks are spread over essentially the whole of that
   * plot, so they are drawn rather than merely counted. Either alone would
   * pass the pane this floor exists because of: the 67px frame had a 5px plot
   * and its 185 dots filled all five of them.
   *
   * THE BAND IS ASKED AGAINST THE FLOOR'S OWN BAND, not against a share of
   * whatever plot the pane happens to have. The mark floor guarantees `102 −
   * 68 = 34px` of plot, so 34px is the band a pane at the floor is promised and
   * the number every honest pane on this desk clears — and it is the one that
   * refuses the 5px band this floor exists because of. A SHARE of the plot
   * would be the wrong question: a scatter's dots fill their plot's height, a
   * BAR's tops span only as far as its own tallest value (185 bars in a 212px
   * frame read a 104px band of a 144px plot), and both of those are honest.
   */
  const marksReallyThere = (pane: Measured['panes'][number]): void => {
    const plot = pane.drawn - (PAD.t + PAD.b);
    const promised = markFloor(PAD).height - (PAD.t + PAD.b);
    expect(pane.marks, `the ${pane.id} pane lost its marks`).toBeGreaterThan(100);
    expect(pane.drawn, `the ${pane.id} pane is ${String(pane.drawn)}px, under the ${String(markFloor(PAD).height)}px mark floor`).toBeGreaterThanOrEqual(markFloor(PAD).height);
    expect(pane.band, `the ${pane.id} pane draws ${String(pane.marks)} marks in a ${String(pane.band)}px band of a ${String(plot)}px plot, under the ${String(promised)}px the floor promises`).toBeGreaterThanOrEqual(promised);
  };

  beforeAll(async () => {
    say(`the built site: ${await buildSiteIfMissing()}`);
    say(`the stops this suite measures against: the satellite column ${String(STOPS.railFar)}px · the focus column ${String(STOPS.railNear)}px · the satellite strip ${String(STOPS.stripFar)}px · the focus row ${String(STOPS.stripNear)}px`);
    site = await startProtSite();
    browser = await chromium.launch({
      ...(CHROME !== undefined ? { executablePath: CHROME } : {}),
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    // THE TIGHTER BUDGET, on purpose: a floor that holds at 1280×800 holds
    // everywhere, and it is the budget the tile size was designed to.
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(`${site.protUrl}?entry=${EXAMPLE_ENTRY}`);
    await page.waitForSelector('[data-chart][data-focused="true"] circle.vzf-line-dot', { timeout: 120_000 });
    await settle();
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await site?.close();
  });

  /**
   * WAIT FOR THE PANES TO STOP MOVING before measuring one to the pixel.
   *
   * `ChartFrame` re-measures on a ResizeObserver callback and the webfont
   * arrives after first paint, so the first arrangement is not the last — and
   * this file measures the page at rest EXACTLY. Measured: the settled focus
   * frame is 322.375px tall (a 441.125px card, 118.75px of chrome), and a
   * reading taken a frame or two early reports 321. It is the same wobble
   * `web/src/workbench/README.md` names in the right column, and the same
   * answer: wait for the invariant, and fail loudly if it never arrives.
   */
  const settle = async (): Promise<void> => {
    let last = -1;
    for (let tries = 0; tries < 40; tries += 1) {
      const now = await page.evaluate(() => Math.round(document.querySelector('[data-chart][data-focused="true"] .vzf-chart-frame')?.getBoundingClientRect().height ?? 0));
      if (now > 0 && now === last) return;
      last = now;
      await page.waitForTimeout(150);
    }
    throw new Error(`the focus pane never settled to a height — the last two readings were ${String(last)}px apart from each other`);
  };

  /** Drag one divider to a coordinate on its own axis — in steps, because a single jump is not a drag and would not exercise the pointer capture. */
  const drag = async (orientation: 'vertical' | 'horizontal', to: number): Promise<void> => {
    const bar = page.locator(`[role="separator"][aria-orientation="${orientation}"]`);
    const box = await bar.boundingBox();
    if (box === null) throw new Error(`the ${orientation} divider has no box on screen`);
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const target = orientation === 'vertical' ? { x: to, y: from.y } : { x: from.x, y: to };
    for (const at of [0.34, 0.67, 1]) await page.mouse.move(from.x + (target.x - from.x) * at, from.y + (target.y - from.y) * at);
    await page.mouse.up();
    // the grid re-lays-out and every `ChartFrame`'s ResizeObserver re-measures;
    // both are a frame or two, not a promise this test can await
    await page.waitForTimeout(600);
  };

  /** Press a key on one divider, with it focused. */
  const press = async (orientation: 'vertical' | 'horizontal', key: string): Promise<void> => {
    const bar = page.locator(`[role="separator"][aria-orientation="${orientation}"]`);
    await bar.focus();
    await bar.press(key);
    await page.waitForTimeout(400);
  };

  /** Back to where the page had both boundaries, with nothing of the reader's left behind. */
  const forget = async (): Promise<void> => {
    await page.evaluate((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* a private window: there was nothing to remove */
      }
    }, SPLIT_STORAGE_KEY);
    await page.reload();
    await page.waitForSelector('[data-chart][data-focused="true"] circle.vzf-line-dot', { timeout: 120_000 });
    await page.waitForTimeout(400);
    await settle();
  };

  it('puts TWO REAL SEPARATORS on the page, each with its own axis and values', async () => {
    const bars = page.locator('[role="separator"]');
    expect(await bars.count()).toBe(2);
    const m = await measure(page);
    for (const v of m.values) {
      say(`  a ${v.axis ?? '?'} separator: the focus has ${v.now ?? '?'}% of that axis, and may have between ${v.min ?? '?'}% and ${v.max ?? '?'}%`);
      expect(Number(v.now)).toBeGreaterThanOrEqual(Number(v.min));
      expect(Number(v.now)).toBeLessThanOrEqual(Number(v.max));
    }
    expect(m.values.map((v) => v.axis).sort()).toEqual(['horizontal', 'vertical']);
    // …and each names the two regions it divides
    for (const orientation of ['vertical', 'horizontal'] as const) {
      const name = (await page.locator(`[role="separator"][aria-orientation="${orientation}"]`).getAttribute('aria-label')) ?? '';
      expect(name).toContain('the boundary between the focus and');
      say(`  the ${orientation} one is called: ${name}`);
    }
    // nothing of the reader's yet, and nothing said
    expect(m.stored).toBeNull();
    expect(m.stop).toBeNull();
  });

  it('leaves the page at rest exactly where it was — the divider track is the gap it replaced', async () => {
    const m = await measure(page);
    say(`at rest: the page is ${String(m.page)}px in a ${String(m.viewport)}px window; the focus is ${String(m.focus.drawnW)}×${String(m.focus.drawn)} with ${String(m.focus.marks)} marks; ${drawing(m).map((p) => `${p.id} ${String(p.w)}×${String(p.drawn)} (${String(p.marks)} marks over ${String(p.band)}px)`).join(', ')}`);
    expect(m.page).toBe(m.viewport);
    /*
      THE NUMBERS `tests/prot-viewport.smoke.test.ts` MEASURES — and the height
      moved once, on purpose. Clearing the card's FACE (the derived
      `How to read:` line and the stage's own quiet line, both now behind
      `Full note`) handed 44px straight to the picture: 906×278 became 906×322,
      and `CARD_CHROME` went from 163 to 119 with it — which is why the focus
      row's floor followed, from 333 to 289, without anybody choosing a number.
    */
    expect(m.focus.drawnW).toBe(906);
    expect(m.focus.drawn).toBe(322);
    expect(m.panes.find((p) => p.id === RAMA_VIEW)?.w).toBe(282);
  });

  it('DRAGS THE VERTICAL DIVIDER TO THE SATELLITES’ STOP — the column holds at its floor and every pane still draws', async () => {
    // all the way to the right edge of the window: the clamp is what decides
    // where it lands, which is the point
    await drag('vertical', 1279);
    const m = await measure(page);
    say(`pushed right as far as it goes: the satellite column is ${String(m.panes.find((p) => p.id === RAMA_VIEW)?.w ?? 0)}px (its floor is ${String(STOPS.railFar)}px) and the page is ${String(m.page)}px in a ${String(m.viewport)}px window`);
    say(`  the panes at the stop: focus ${String(m.focus.drawnW)}×${String(m.focus.drawn)} (${String(m.focus.marks)} marks); ${drawing(m).map((p) => `${p.id} ${String(p.w)}×${String(p.drawn)} (${String(p.marks)} marks over a ${String(p.band)}px band of a ${String(p.drawn - PAD.t - PAD.b)}px plot)`).join(', ')}`);
    // THE FLOOR HELD — the column is at it and not past it
    expect(m.panes.find((p) => p.id === RAMA_VIEW)?.w).toBe(STOPS.railFar);
    // …AND EVERY PANE THAT DREW STILL DRAWS, over the plot it was given
    expect(m.focus.marks).toBeGreaterThan(100);
    for (const pane of drawing(m)) marksReallyThere(pane);
    // …and the page is still exactly the window
    expect(m.page).toBe(m.viewport);
  });

  it('SAYS WHY IT STOPPED, in its own voice and not as an error', async () => {
    const m = await measure(page);
    say(`  the page says: ${m.stop ?? 'nothing'}`);
    expect(m.stop).not.toBeNull();
    expect(m.stop).toContain('still reads as a shape');
    expect(m.stop).toContain('show a selection');
    // a reason, at a stop — never an alert, never a refusal
    expect(await page.locator('[role="alert"]').count()).toBe(0);
    expect((m.stop ?? '').toLowerCase()).not.toContain('error');
  });

  it('AND THE CROSSFILTER STILL WORKS AT THE STOP — which is the property the floor exists to protect', async () => {
    const before = await measure(page);
    const bars = page.locator(`[data-chart="${INTERFACE_VIEW}"] rect.vzf-barrect`);
    expect(await bars.count()).toBeGreaterThan(100);
    /*
      THE PRESS IS ON THE LIBRARY'S OWN POINTER TARGET — one transparent
      full-height rect per bar over its slot column (`vizfootprint-ui` ·
      `VizBar`, the WCAG 2.2 AA floor or the slot when the slot is narrower),
      which is the affordance this desk reported as missing and the thing a
      reader's pointer really lands on. Same handlers, same clause, same
      accessible name on the bar underneath.

      Pressing the DRAWN bar lands nothing any more, and the reason is a
      FINDING rather than a workaround: the same library packet draws its
      crowded-marks note as an SVG `<text>` over the plot with no
      `pointer-events: none`, so `elementFromPoint` at a bar's own centre
      answers `text.vzf-crowded-note` and the press is swallowed
      (`tests/prot-crossfilter.smoke.test.ts` carries the measurement).
    */
    const targets = page.locator(`[data-chart="${INTERFACE_VIEW}"] rect.vzf-mark-hit`);
    expect(await targets.count()).toBe(await bars.count());
    const started = Date.now();
    await targets.nth(40).click({ force: true });
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length < 100, `[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 15_000 });
    const narrowed = await measure(page);
    const dimmed = await page.evaluate((id) => document.querySelectorAll(`[data-chart="${id}"] .vzf-dim`).length, RAMA_VIEW);
    say(
      `with the divider at its stop, a pick in the cross-chain tile took the focus from ${String(before.focus.marks)} marks to ${String(narrowed.focus.marks)} in ${String(Date.now() - started)} ms, and the backbone-angle pane dims ${String(dimmed)} of its ${String(narrowed.panes.find((p) => p.id === RAMA_VIEW)?.marks ?? 0)}`,
    );
    // THE CLAIM: the pick was made in a 256px-wide neighbourhood of the screen
    // and the focus changed, which a layout assertion could never have said
    expect(narrowed.focus.marks).toBeLessThan(before.focus.marks);
    // …and the scatter shows it the way its own chart shows a clause: it keeps
    // its marks and DIMS the ones outside it (`vizfootprint-ui` · `VizScatter`)
    expect(dimmed).toBeGreaterThan(100);
    expect(narrowed.page).toBe(narrowed.viewport);

    // AND GIVES THEM BACK — the half that would rot silently
    await page.locator('button[aria-label^="clear the"]').first().click();
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 100, `[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 15_000 });
    const back = await measure(page);
    say(`  cleared: the focus is back to ${String(back.focus.marks)} marks, with the column still at ${String(back.panes.find((p) => p.id === RAMA_VIEW)?.w ?? 0)}px`);
    expect(back.focus.marks).toBeGreaterThan(100);
    expect(back.panes.find((p) => p.id === RAMA_VIEW)?.w).toBe(STOPS.railFar);
    expect(back.page).toBe(back.viewport);
  });

  it('REMEMBERS IT ACROSS A RELOAD, in this browser and nowhere else', async () => {
    const before = await measure(page);
    expect(before.stored, 'the boundary was moved and nothing was remembered').not.toBeNull();
    say(`  this browser remembers: ${SPLIT_STORAGE_KEY} = ${before.stored ?? 'nothing'}`);
    await page.reload();
    await page.waitForSelector('[data-chart][data-focused="true"] circle.vzf-line-dot', { timeout: 120_000 });
    await page.waitForTimeout(500);
    const after = await measure(page);
    say(`  after a reload the satellite column is ${String(after.panes.find((p) => p.id === RAMA_VIEW)?.w ?? 0)}px and the page is ${String(after.page)}px`);
    expect(after.panes.find((p) => p.id === RAMA_VIEW)?.w).toBe(STOPS.railFar);
    expect(after.page).toBe(after.viewport);
    expect(after.focus.marks).toBeGreaterThan(100);
  });

  it('GIVES THE PAGE’S OWN ARRANGEMENT BACK when the stored value is cleared', async () => {
    await forget();
    const m = await measure(page);
    say(`  with nothing remembered the satellite column is ${String(m.panes.find((p) => p.id === RAMA_VIEW)?.w ?? 0)}px again — the page's own clamp(${String(COLUMN_CLAMP.floor)}rem, ${String(COLUMN_CLAMP.vw)}vw, ${String(COLUMN_CLAMP.ceiling)}rem)`);
    expect(m.panes.find((p) => p.id === RAMA_VIEW)?.w).toBe(282);
    expect(m.stored).toBeNull();
    expect(m.page).toBe(m.viewport);
  });

  it('DRAGS IT THE OTHER WAY TO THE FOCUS’S STOP — a focus no narrower than the widest tile, and every pane still drawing', async () => {
    await drag('vertical', 1);
    const m = await measure(page);
    say(`pushed left as far as it goes: the focus card is ${String(m.focus.w)}px wide (its floor is ${String(STOPS.railNear)}px), the satellite column is ${String(m.panes.find((p) => p.id === RAMA_VIEW)?.w ?? 0)}px, and the page is ${String(m.page)}px`);
    say(`  the panes at that stop: focus ${String(m.focus.drawnW)}×${String(m.focus.drawn)} (${String(m.focus.marks)} marks); ${drawing(m).map((p) => `${p.id} ${String(p.w)}×${String(p.drawn)} (${String(p.marks)} marks over a ${String(p.band)}px band of a ${String(p.drawn - PAD.t - PAD.b)}px plot)`).join(', ')}`);
    expect(m.focus.w).toBe(STOPS.railNear);
    expect(m.stop).toContain('not a focus');
    expect(m.focus.marks).toBeGreaterThan(100);
    for (const pane of drawing(m)) marksReallyThere(pane);
    expect(m.page).toBe(m.viewport);
  });

  it('holds the HORIZONTAL divider at both of ITS stops, and the strip keeps its bars', async () => {
    await forget();
    // up, until the focus would lose its own axis labels
    await drag('horizontal', 1);
    const up = await measure(page);
    const strip = up.panes.find((p) => p.id === INTERFACE_VIEW);
    say(`pushed up as far as it goes: the focus card is ${String(up.focus.h)}px tall (its floor is ${String(STOPS.stripNear)}px, which is AXIS_ROOM ${String(AXIS_ROOM)} plus ${String(CARD_CHROME)} of card chrome), the strip is ${String(strip?.h ?? 0)}px with a ${String(strip?.drawn ?? 0)}px picture, and the page is ${String(up.page)}px`);
    say(`  the page says: ${up.stop ?? 'nothing'}`);
    expect(up.focus.h).toBe(STOPS.stripNear);
    // THE FOCUS KEPT ITS AXES, which is the whole reason for that floor: the
    // labels are also this page's only encoding pickers
    expect(up.focus.drawn).toBeGreaterThanOrEqual(AXIS_ROOM);
    expect(await page.locator('[data-chart][data-focused="true"] svg text').count()).toBeGreaterThan(0);
    expect(up.stop).toContain('encoding pickers');
    expect(strip?.marks).toBeGreaterThan(100);
    expect(up.page).toBe(up.viewport);

    // …and down, until the strip's bars stop being a band
    await drag('horizontal', 799);
    const down = await measure(page);
    const shrunk = down.panes.find((p) => p.id === INTERFACE_VIEW);
    say(`pushed down as far as it goes: the strip is ${String(shrunk?.h ?? 0)}px (its floor is ${String(STOPS.stripFar)}px) with a ${String(shrunk?.drawn ?? 0)}px picture drawing ${String(shrunk?.marks ?? 0)} bars, and the page is ${String(down.page)}px`);
    say(`  the page says: ${down.stop ?? 'nothing'}`);
    expect(shrunk?.h).toBe(STOPS.stripFar);
    if (shrunk !== undefined) marksReallyThere(shrunk);
    expect(down.stop).toContain('band rather than a line');
    expect(down.page).toBe(down.viewport);
  });

  it('holds BOTH boundaries at once, and the satellites still show a selection with the region squeezed from two sides', async () => {
    await forget();
    await drag('vertical', 1);
    await drag('horizontal', 1);
    const m = await measure(page);
    say(`both stops at once: the focus card is ${String(m.focus.w)}×${String(m.focus.h)} with a ${String(m.focus.drawnW)}×${String(m.focus.drawn)} picture (${String(m.focus.marks)} marks), so its own words take ${String(m.focus.h - m.focus.drawn)}px of it`);
    say(`  the satellites: ${drawing(m).map((p) => `${p.id} ${String(p.w)}×${String(p.drawn)} (${String(p.marks)} marks over a ${String(p.band)}px band of a ${String(p.drawn - PAD.t - PAD.b)}px plot)`).join(', ')}`);
    expect(m.focus.w).toBe(STOPS.railNear);
    expect(m.focus.h).toBe(STOPS.stripNear);
    // WHAT THE LAW PROMISES, at both stops together: every satellite that drew
    // still draws over the plot it was given, the page is still exactly the
    // window, and a pick still carries
    for (const pane of drawing(m)) marksReallyThere(pane);
    expect(m.page).toBe(m.viewport);
    const bars = page.locator(`[data-chart="${INTERFACE_VIEW}"] rect.vzf-barrect`);
    await bars.nth(40).click({ force: true });
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length < 100, `[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 15_000 });
    const narrowed = await measure(page);
    say(`  a pick still carries with both boundaries at their stops: the focus went from ${String(m.focus.marks)} marks to ${String(narrowed.focus.marks)}`);
    expect(narrowed.focus.marks).toBeLessThan(m.focus.marks);
    await page.locator('button[aria-label^="clear the"]').first().click();
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 100, `[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 15_000 });
    /*
      AND THE ONE THING THE FLOORS DO NOT COVER, measured rather than assumed:
      the FOCUS card's own chrome — its title, the `Full note` control and the
      Mono footer — takes MORE of its height when the card is narrow, because
      those lines wrap. `CARD_CHROME` (119px, since the face was cleared) is
      measured at the width the page ships, so with BOTH boundaries
      at their stops the focus's own picture is smaller than the mark floor
      would ask of a satellite. Named here with its number rather than hidden:
      the law this packet is about is the SATELLITES' (asserted above, and they
      hold), and the focus at that point is still larger than any tile, which
      is what its own stop promises.
    */
    say(`  NAMED: at both stops the focus's own picture is ${String(m.focus.drawnW)}×${String(m.focus.drawn)} — ${String(m.focus.h - m.focus.drawn)}px of the card is its own words at ${String(m.focus.w)}px wide, against the ${String(CARD_CHROME)}px the row's floor is folded from`);
    // the focus is still LARGER THAN ANY TILE, which is what its own stop
    // promises — the satellites are what the floors are for, and they held
    for (const pane of drawing(m)) expect(m.focus.w * m.focus.h).toBeGreaterThan(pane.w * pane.h * 0.5);
  });

  it('IS A CONTROL AND NOT A DRAG HANDLE — an arrow moves it, Home and End are its stops, Enter is the way back', async () => {
    await forget();
    const rest = await measure(page);
    const railOf = (m: Measured): number => m.panes.find((p) => p.id === RAMA_VIEW)?.w ?? 0;

    await press('vertical', 'ArrowRight');
    const nudged = await measure(page);
    say(`  one ArrowRight: the satellite column went from ${String(railOf(rest))}px to ${String(railOf(nudged))}px`);
    expect(railOf(nudged)).toBeLessThan(railOf(rest));

    await press('vertical', 'Home');
    const home = await measure(page);
    say(`  Home: the focus is ${String(home.focus.w)}px, its own floor — and the page says: ${home.stop ?? 'nothing'}`);
    expect(home.focus.w).toBe(STOPS.railNear);
    // A READER WHO ASKED FOR THE STOP IS OWED THE REASON TOO: `Home` lands
    // exactly ON a floor, which the clamp reads as *not past it*, so the
    // sentence is set by the gesture rather than by the clamp
    expect(home.stop).toContain('not a focus');

    await press('vertical', 'End');
    const end = await measure(page);
    say(`  End: the satellite column is ${String(railOf(end))}px, its own floor — and the page says: ${end.stop ?? 'nothing'}`);
    expect(railOf(end)).toBe(STOPS.railFar);
    expect(end.stop).toContain('still reads as a shape');

    await press('vertical', 'Enter');
    const reset = await measure(page);
    say(`  Enter: the satellite column is ${String(railOf(reset))}px again, and this browser remembers ${reset.stored ?? 'nothing'}`);
    expect(railOf(reset)).toBe(282);
    expect(reset.stored).toBeNull();
    // …and the reason goes with the stop it was about
    expect(reset.stop).toBeNull();
    expect(reset.page).toBe(reset.viewport);
    // …and it really had focus while all of that happened
    expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('separator');
  });

  it('LANDS NOTHING ON THE RECORD — a drag is a layout preference and not an analytical act', async () => {
    await forget();
    const bar = page.locator('button[aria-label^="open the record"]');
    const before = (await bar.innerText()).replace(/\s+/g, ' ');
    await drag('vertical', 1279);
    await drag('horizontal', 1);
    await press('vertical', 'Home');
    const after = (await bar.innerText()).replace(/\s+/g, ' ');
    say(`  the record's bar before three gestures: ${before}`);
    say(`  and after them:                        ${after}`);
    // the same counts — no commit, no refusal, nothing on the log
    expect(after).toBe(before);
    await forget();
  });

  it('threw nothing while doing any of it', () => {
    expect(pageErrors).toEqual([]);
  });
});
