// @vitest-environment node
/**
 * THE INSTRUMENT FITS THE WINDOW — asserted in a real browser, because every
 * number in this claim is a LAYOUT number and a layout number measured in jsdom
 * is a number about jsdom.
 *
 * ── WHAT WAS WRONG, MEASURED ON THE DEPLOYED PAGE ──────────────────────────
 * ```
 * 1440×900   page 2,622px   viewport 900
 *   header 60 · stepper nav 177 · panel 298 · selection row ~40
 *   focus card 561 · four cards 400 each · tail (record + credit) 556
 * 1280×800   page 2,698px   viewport 800
 * ```
 * The instrument — everything above the record — was about 2,050px in a 900px
 * window, so it did not fit by shrinking: five charts at a fifth of their
 * height are five sparklines. What it needed was FEWER CHARTS, NOT SMALLER
 * ONES: one focused picture that fills the height that is left, everything else
 * a labelled control one press away, and the record behind a bar at the bottom
 * edge instead of below a scroll.
 *
 * ── WHAT THIS ASSERTS ──────────────────────────────────────────────────────
 * At 1440×900 and at 1280×800, on the built page, over the committed entry:
 *
 *   1. THE PAGE DOES NOT SCROLL. `document.documentElement.scrollHeight` is
 *      the viewport height, exactly — the author's ruling taken literally.
 *   2. THE FOCUSED PICTURE FILLS WHAT IS LEFT: its drawn height is what the
 *      window leaves after the chrome, it GROWS when the window grows (the
 *      420px constant it replaced never did), and it still has its marks.
 *   3. EIGHT PANES ARE LIVE AT ONCE — one focus and seven support — and every
 *      one that binds data DRAWS ITS MARKS, because a pane that shows none
 *      cannot show a crossfilter and that is the whole reason for this layout
 *      (`tests/prot-crossfilter.smoke.test.ts` drives that claim).
 *   4. NO DEAD SPACE: the instrument's own region reaches the record's bar, so
 *      the remaining height is CLAIMED and not merely un-overflowed.
 *   5. A PRESS ON A TILE PROMOTES IT into a focus slot of FIXED shape.
 *   6. THE RECORD IS PRESENT WITHOUT A SCROLL: a bar at the bottom edge naming
 *      what is inside it, and one press puts every word of it in the DOM.
 *   7. EVERY COUNT SURVIVES. The counted-facts band was deleted because each
 *      card carries its own numbers; if a card had dropped them too they would
 *      exist nowhere, lost by two cuts each justified by the other place. So
 *      the numbers are counted on the rendered page.
 *
 * Every number it measures, it PRINTS — a green tick that printed nothing is
 * what let a whole release ship with charts that did not follow the cursor
 * (`tests/prot-cursor.smoke.test.ts` is that lesson).
 *
 * ── HOW IT DRIVES THE BROWSER ───────────────────────────────────────────────
 * The same way its sibling does: `playwright-core`, `VZF_CHROME` when it is
 * set, the three ANGLE flags for Mol*'s WebGL context, and the built site
 * served out of `dist/site` by `tests/protSiteServer.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildSiteIfMissing, startProtSite, type SiteHandle } from './protSiteServer.js';
import { EXAMPLE_ENTRY } from '../src/prot/archive.js';
import { RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';

/** An explicit browser, when the environment names one; unset ⇒ playwright-core launches the headless shell it installed. */
const CHROME = process.env['VZF_CHROME'];

/** The two budgets the brief names. 1280×800 is the tighter one and the one the tile size was designed to. */
const SIZES = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
] as const;

/** What one measurement of the page says. */
interface Measured {
  readonly page: number;
  readonly viewport: number;
  readonly header: number | null;
  readonly facts: number | null;
  readonly stepper: number | null;
  readonly bar: number | null;
  readonly focus: { readonly id: string | null; readonly card: number; readonly drawn: number; readonly width: number; readonly marks: number };
  readonly region: { readonly instrument: number; readonly lowestPane: number; readonly barTop: number };
  readonly tiles: readonly { readonly id: string | null; readonly height: number; readonly width: number; readonly drawn: number; readonly marks: number }[];
}

/** Read it off the page, in the page. */
const measure = (page: Page): Promise<Measured> =>
  page.evaluate(() => {
    const height = (selector: string): number | null => {
      const el = document.querySelector(selector);
      return el === null ? null : Math.round(el.getBoundingClientRect().height);
    };
    const hero = document.querySelector('[data-chart][data-focused="true"]');
    const frame = hero?.querySelector('.vzf-chart-frame') ?? null;
    const marksIn = (el: Element | null): number => (el === null ? 0 : el.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect').length);
    return {
      page: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
      header: height('header'),
      facts: height('div[aria-label="what this entry is, counted"]'),
      stepper: height('nav'),
      // the record's own bar is the last control on the page
      bar: height('button[aria-label^="open the record"]'),
      // the instrument's own region, and the gap between its foot and the
      // record's bar — which is the DEAD SPACE, and must be none
      region: (() => {
        const instrument = document.querySelector('[data-chart][data-focused="true"]')?.closest('div[style*="grid-template-rows"]')?.parentElement ?? null;
        const barTop = document.querySelector('button[aria-label^="open the record"]')?.getBoundingClientRect().top ?? window.innerHeight;
        const strip = [...document.querySelectorAll('[data-tile="true"]')].map((el) => el.getBoundingClientRect().bottom);
        return { instrument: instrument === null ? 0 : Math.round(instrument.getBoundingClientRect().height), lowestPane: Math.round(Math.max(...strip, 0)), barTop: Math.round(barTop) };
      })(),
      focus: {
        id: hero?.getAttribute('data-chart') ?? null,
        card: hero === null ? 0 : Math.round(hero.getBoundingClientRect().height),
        drawn: frame === null ? 0 : Math.round(frame.getBoundingClientRect().height),
        width: frame === null ? 0 : Math.round(frame.getBoundingClientRect().width),
        marks: marksIn(hero),
      },
      tiles: [...document.querySelectorAll('[data-tile="true"]')].map((el) => ({
        id: el.getAttribute('data-chart'),
        height: Math.round(el.getBoundingClientRect().height),
        width: Math.round(el.getBoundingClientRect().width),
        drawn: Math.round(el.querySelector('.vzf-chart-frame')?.getBoundingClientRect().height ?? 0),
        marks: marksIn(el),
      })),
    };
  });

describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('the protein desk fits the window (real headless Chromium)', () => {
  let site: SiteHandle;
  let browser: Browser;
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
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await site?.close();
  });

  /** One page, opened at one size, with the run finished. */
  const open = async (size: { readonly width: number; readonly height: number }): Promise<Page> => {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    page.on('pageerror', (e) => pageErrors.push(`${String(size.width)}×${String(size.height)}: ${String(e)}`));
    await page.goto(`${site.protUrl}?entry=${EXAMPLE_ENTRY}`);
    // the focused picture is the surface run once the last act has landed
    await page.waitForSelector('[data-chart][data-focused="true"] circle.vzf-line-dot', { timeout: 120_000 });
    return page;
  };

  for (const size of SIZES) {
    describe(`at ${String(size.width)}×${String(size.height)}`, () => {
      let page: Page;
      let m: Measured;

      beforeAll(async () => {
        page = await open(size);
        m = await measure(page);
        say(
          `${String(size.width)}×${String(size.height)}: page ${String(m.page)}px in a ${String(m.viewport)}px window — header ${String(m.header ?? 0)} · chrome ${String(m.facts ?? 0)} · stepper ${String(m.stepper ?? 0)} · record bar ${String(m.bar ?? 0)} · focus card ${String(m.focus.card)} with a ${String(m.focus.width)}×${String(m.focus.drawn)} picture (${String(m.focus.marks)} marks) · ${String(m.tiles.length)} tiles at ${m.tiles.map((t) => String(t.height)).join('/')}px`,
        );
      }, 300_000);

      afterAll(async () => {
        await page?.close();
      });

      it('DOES NOT SCROLL — the page is exactly the window', () => {
        expect(m.page).toBe(m.viewport);
      });

      it('spends the window on the pictures: the chrome is a fifth of it and the focus takes most of the rest', () => {
        const chrome = (m.header ?? 0) + (m.facts ?? 0) + (m.stepper ?? 0);
        const region = m.viewport - chrome - (m.bar ?? 0);
        say(`  chrome ${String(chrome)}px of ${String(m.viewport)} (${String(Math.round((chrome / m.viewport) * 100))}%) — header ${String(m.header ?? 0)} + stepper ${String(m.stepper ?? 0)}${m.facts === null ? ' and no facts band at all' : ` + facts ${String(m.facts)}`}; the instrument gets ${String(region)}px and the focus card is ${String(m.focus.card)}px of it`);
        // the bands that used to be 60 + 177 (stepper) + 298 (panel) + 40
        // (selection) = 575px of chrome before a picture was drawn
        expect(chrome).toBeLessThan(240);
        // THERE IS NO FACTS BAND: every count in it was a second copy
        expect(m.facts).toBeNull();
        // …and the focus takes most of what is left, with the rest going to the
        // seven support panes rather than to empty space
        expect(m.focus.card).toBeGreaterThan(region * 0.5);
      });

      it('DRAWS THE FOCUSED PICTURE at the aspect its design asks for, with its marks', () => {
        expect(m.focus.id).toBe(SURFACE_VIEW);
        expect(m.focus.drawn).toBeGreaterThan(200);
        expect(m.focus.marks).toBeGreaterThan(100);
        // the design drew the surface run at 1296 × 380 — 3.4 : 1. The focus slot
        // is a FIXED shape for now (the author's decision), so this records what
        // that costs: the ratio the wide charts actually get.
        say(`  the focused picture is ${String(m.focus.width)}×${String(m.focus.drawn)} — ${(m.focus.width / m.focus.drawn).toFixed(1)} : 1, where the design drew it at 3.4 : 1`);
        expect(m.focus.width / m.focus.drawn).toBeLessThan(6);
      });

      it('LEAVES NO DEAD SPACE: the instrument’s region reaches the record’s bar', () => {
        say(`  the lowest pane ends at ${String(m.region.lowestPane)}px and the record's bar starts at ${String(m.region.barTop)}px`);
        // the remaining height is CLAIMED, not merely un-overflowed: a third of
        // the window sat empty under the bottom strip for one round, which is
        // the `1fr` / `min-height: 0` trap in its most expensive form
        expect(m.region.barTop - m.region.lowestPane).toBeLessThan(24);
        expect(m.region.lowestPane).toBeGreaterThan(m.viewport - 90);
      });

      it('runs EIGHT LIVE PANES — one focus, seven support — and every one that binds data draws its marks', () => {
        /*
          SEVEN support panes, and the split between them has moved twice: SIX
          pictures now (the conservation run arrived with its stage, and stage
          6's own chart with its) and a card for the ONE declared step that will
          not run here. It was four pictures and three cards; the TOTAL has
          never changed, because each time a step crossed from the half that
          says to the half that draws, its card went with it.
        */
        expect(m.tiles).toHaveLength(7);
        const drawing = m.tiles.filter((t) => t.drawn > 0);
        const said = m.tiles.filter((t) => t.drawn === 0);
        say(`  panes: focus ${String(m.focus.width)}×${String(m.focus.drawn)}; ${drawing.map((t) => `${t.id ?? '?'} ${String(t.width)}×${String(t.drawn)} (${String(t.marks)} marks)`).join(', ')}; and ${String(said.length)} cards of words at ${said.map((t) => String(t.height)).join('/')}px`);
        /*
          WHICH PANES SAY IT RATHER THAN DRAWING IT, and each for its own reason:
            · the one step that will not run here has nothing to filter;
            · the 3D VIEW, because its content is a WebGL canvas rather than
              marks — measured at 282×114 it was an empty black box, it cannot
              show a crossfilter by density (it recolours, invisibly at that
              size) and a camera cannot be fitted to a box of that aspect. It
              says so and a press puts it in the focus, where it is 906×253.
          Everything else DRAWS, because a pane that shows no marks cannot show
          a crossfilter and that is what this layout is bought for.
        */
        expect(said.map((t) => t.id).sort()).toEqual([STRUCTURE_VIEW, 'stage:hotspots'].sort());
        expect(drawing).toHaveLength(5);
        expect(m.tiles.find((t) => t.id === RAMA_VIEW)?.marks).toBeGreaterThan(100);
        expect(m.tiles.find((t) => t.id === 'interface')?.marks).toBeGreaterThan(100);
        // AND THE NEW RUN DRAWS TOO, which is the whole point of landing a
        // column rather than a caption: 162 of the 185 residues have a score
        // and the other 23 have no column at all, so the line simply stops
        expect(m.tiles.find((t) => t.id === 'conservation')?.marks).toBe(162);
        // AND STAGE 6'S CHART DRAWS ITS FOUR, which is the whole entry's named
        // residues: two active sites and the two ENDS of one disulfide bond.
        // The absence is the filter, so 181 residues have no mark at all.
        expect(m.tiles.find((t) => t.id === 'known')?.marks).toBe(4);
        // no pane is too small to be a picture at the tighter budget
        for (const tile of drawing) expect(tile.drawn, `the ${tile.id ?? '?'} pane is ${String(tile.drawn)}px tall`).toBeGreaterThan(95);
      });

      it('drops the AXIS CHROME where it will not fit, and keeps the marks', async () => {
        /*
          `vizfootprint-ui`'s charts take `axes?: boolean | 'y'`, so a host can
          turn the ticks and the axis labels off — what it cannot move is `PAD`,
          a module constant, so 62px of any box is margin whatever is in it.
          `protCells.tsx · AXIS_ROOM` (170px) is the threshold, and it is asked
          of the height the pane REALLY gets, per pane and per window.
        */
        /*
          WAIT FOR IT TO SETTLE, and the reason is a measurement rather than a
          convenience.

          The right column's panes land anywhere between about 120px and 175px
          at this width, because the blocked card's three clauses wrap
          differently as the webfont arrives — which straddles the threshold.
          When the pane shrinks across it, the chart is briefly still the one
          drawn for the taller box: `ChartFrame` re-measures on a ResizeObserver
          callback, so there is a frame or two in which a 125px pane still holds
          the 175px rendering. That is the library's documented behaviour (its
          own header records a regression where a STALE height letterboxed a
          drawing), and the rule this test is about is the SETTLED state.
          So it waits for the invariant to hold and fails loudly if it never
          does — rather than reading the font's timing and calling it the rule.
        */
        await page.waitForFunction(
          (id) => {
            const el = document.querySelector(`[data-chart="${id}"]`);
            const drawn = Math.round(el?.querySelector('.vzf-chart-frame')?.getBoundingClientRect().height ?? 0);
            const texts = el?.querySelectorAll('svg text').length ?? 0;
            return drawn > 0 && (drawn < 170 ? texts === 0 : texts > 0);
          },
          RAMA_VIEW,
          { timeout: 20_000 },
        );
        const now = await page.evaluate((id) => {
          const el = document.querySelector(`[data-chart="${id}"]`);
          const frame = el?.querySelector('.vzf-chart-frame');
          const dots = [...(el?.querySelectorAll('circle.vzf-dot') ?? [])];
          const tops = dots.map((d) => d.getBoundingClientRect().top);
          return {
            drawn: Math.round(frame?.getBoundingClientRect().height ?? 0),
            texts: el?.querySelectorAll('svg text').length ?? 0,
            marks: dots.length,
            band: dots.length < 2 ? 0 : Math.round(Math.max(...tops) - Math.min(...tops)),
          };
        }, RAMA_VIEW);
        const texts = now.texts;
        const pane = { drawn: now.drawn };
        /*
          AND THE MARKS ARE REALLY THERE, not merely counted. Measured before
          this round: a 67px pane reported 185 dots and drew them in a 5px band
          under 62px of the library's fixed padding — reported and INVISIBLE,
          which reads as broken rather than as small.
        */
        say(`  the backbone-angle pane is ${String(now.drawn)}px tall, draws ${String(texts)} pieces of axis text, and spreads its ${String(now.marks)} marks over a ${String(now.band)}px band`);
        // THE MARKS ARE REALLY THERE, not merely counted: measured before this
        // round, a 67px pane reported 185 dots and drew them in a 5px band
        // under 62px of the library's fixed padding — reported and invisible.
        expect(now.marks).toBeGreaterThan(100);
        expect(now.band).toBeGreaterThan(40);
        // at 1280 the pane is under the threshold and draws none; at 1440 it is
        // over it and draws its own axes — the same rule, two answers
        if (pane.drawn < 170) expect(texts).toBe(0);
        else expect(texts).toBeGreaterThan(0);
      });

      it('KEEPS EVERY COUNT the deleted facts band used to carry, on the cards themselves', async () => {
        const words = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
        /*
          THE BAND WENT because each card carries its own numbers. If a card had
          dropped them too, they would exist NOWHERE — lost by two cuts each
          justified by the other place, which is the silent omission this desk
          is built against. So they are counted here, on the rendered page.
        */
        for (const count of ['185 residues', '2 chains drawn', 'residues plotted', 'cross-chain']) {
          expect(words, `the page no longer states "${count}" anywhere`).toContain(count);
        }
        say(`  the counts are on the cards: ${['185 residues', '2 chains drawn', 'residues plotted', 'cross-chain'].filter((c) => words.includes(c)).join(' · ')}`);
      });

      it('puts NO PROSE under a drawing — the footer is Mono counts, on one line', async () => {
        const feet = await page.locator('[data-chart] > div:last-child').allInnerTexts();
        for (const foot of feet) {
          // a sentence under a drawing is what four rounds of this packet
          // cleared; a count is not a sentence
          expect(foot, `a footer reads as prose: ${foot}`).not.toContain('so no act and no commit');
          expect(foot).not.toContain('no counts to read');
        }
        /*
          AND THE OWNING STAGE IS NO LONGER IN IT — a CONTRACT CHANGE, made on
          the author's instruction and only after the stepper's bar began
          following the FOCUS. One owner per question: *which stage produced the
          picture I am looking at* is the stepper's answer, and pressing any
          tile moves the bar to its stage. It was being printed on eight cards
          at once.

          The check that had to come first is the one this file exists for: it
          is not the last copy of anything. The stage is on the stepper and at
          the lead of each card's own note, and what a reader loses AT A GLANCE
          is named in `web/src/protDesk.tsx` · `NotHere`.
        */
        const words = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
        expect(words).not.toContain('Stage 3 · Structure Analysis');
        // the STEPPER carries it instead, with the short declared name under
        // the mark it marks
        expect(await page.locator('nav ol li[aria-current="step"]').count()).toBe(1);
        expect(await page.locator('nav ol li[aria-current="step"]').innerText()).toContain('Structure Analysis');
      });

      it('names the record at the bottom edge, and holds every word of it until it is pressed', async () => {
        const bar = page.locator('button[aria-label^="open the record"]');
        expect(await bar.count()).toBe(1);
        const label = (await bar.getAttribute('aria-label')) ?? '';
        say(`  the record bar says: ${label}`);
        for (const named of ['commits', 'refused requests', 'data checks', 'the residues table at the cursor', 'the recorder', 'what this page does without', 'credit']) {
          expect(label, `the shut bar does not name "${named}"`).toContain(named);
        }
        // the counts are on the bar itself, visible without scrolling anything
        expect(await bar.innerText()).toContain('commits');
        // and the record is not in the DOM yet
        expect(await page.locator('text=This is the static build.').count()).toBe(0);
        await bar.click();
        await page.waitForTimeout(250);
        // every block of it, in the same four disclosures it always had
        for (const named of ['Commit log', 'Every request the session refused', 'What the data checks said', 'The residues table at the cursor', 'About this dashboard']) {
          expect(await page.locator(`text=${named}`).first().count(), `the record lost "${named}"`).toBeGreaterThan(0);
        }
        // the page STILL does not scroll: the drawer scrolls, not the document
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(m.viewport);
        say(`  with the record open the page is still ${String(m.viewport)}px`);
        await bar.click();
        await page.waitForTimeout(150);
      });

      it('PROMOTES A TILE ON A PRESS — the picture is drawn at focus size, with its marks', async () => {
        const before = await measure(page);
        const tile = page.locator(`[data-tile="true"][data-chart="${RAMA_VIEW}"]`);
        expect(await tile.count()).toBe(1);
        // THE HEADER IS THE CONTROL, not the whole tile: the picture inside is
        // live, and a press on it is a selection rather than a promotion —
        // which is the trade a drawing tile makes and the reason its title row
        // carries the accessible name.
        await tile.locator('button').first().click();
        await page.waitForSelector(`[data-chart="${RAMA_VIEW}"][data-focused="true"] .vzf-chart-frame`, { timeout: 30_000 });
        await page.waitForTimeout(400);
        const after = await measure(page);
        say(`  promoted the backbone angles: ${String(before.focus.id ?? '?')} ${String(before.focus.drawn)}px → ${String(after.focus.id ?? '?')} ${String(after.focus.drawn)}px with ${String(after.focus.marks)} marks; the card it displaced is a ${String(after.tiles.find((t) => t.id === SURFACE_VIEW)?.width ?? 0)}×${String(after.tiles.find((t) => t.id === SURFACE_VIEW)?.drawn ?? 0)} pane`);
        expect(after.focus.id).toBe(RAMA_VIEW);
        // THE FOCUS SLOT IS A FIXED SHAPE — the author's decision, so that the
        // area does not move under every press. The CARD is the same height
        // whatever is in it; the drawing inside differs by that card's own
        // chrome, which is what the report measures.
        expect(after.focus.card).toBe(before.focus.card);
        expect(after.focus.marks).toBeGreaterThan(100);
        // …and the picture it displaced is a pane that still draws
        expect(after.tiles.find((t) => t.id === SURFACE_VIEW)?.marks).toBeGreaterThan(100);

        // the page still does not scroll
        expect(after.page).toBe(after.viewport);
      });

      it('promotes the CARD of a stage that will not run here, and the card says why at full size', async () => {
        const control = page.getByLabel(/^bring stage 5,/, { exact: false }).first();
        await control.click();
        await page.waitForTimeout(300);
        const card = page.locator('[data-chart="stage:hotspots"][data-focused="true"]');
        expect(await card.count()).toBe(1);
        const said = await card.innerText();
        say(`  stage 5's card says: ${said.replace(/\s+/g, ' ').slice(0, 160)}`);
        expect(said).toContain('not on this build');
        expect(said).toContain('a static page cannot hold the key');
        // NO PICTURE IN IT, and nothing pretending to be one
        expect(await card.locator('.vzf-chart-frame').count()).toBe(0);
        expect(await card.locator('svg:not([aria-hidden="true"])').count()).toBe(0);
        // and the cursor did not move: the rows note still says the same commit
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(m.viewport);
      });

      it('PUTS THE FOCUS BACK when the cursor moves, and the page still fits', async () => {
        await page.getByLabel(/^move the desk to stage 3,/, { exact: false }).first().click();
        await page.waitForSelector(`[data-chart="${SURFACE_VIEW}"][data-focused="true"] circle.vzf-line-dot`, { timeout: 30_000 });
        const back = await measure(page);
        say(`  the cursor moved to stage 3 and the focus is ${String(back.focus.id ?? '?')} again, ${String(back.focus.drawn)}px`);
        expect(back.focus.id).toBe(SURFACE_VIEW);
        expect(back.page).toBe(back.viewport);
      });
    });
  }

  describe('EVERY PANE REFLOWS ON A WINDOW DRAG, and nothing overflows', () => {
    it('is resized by the library’s own frame, with no size arithmetic of ours', async () => {
      const page = await open({ width: 1440, height: 900 });
      const wide = await measure(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      // the grid re-lays-out and every `ChartFrame`'s ResizeObserver
      // re-measures; both are a frame or two, not a promise this test can await
      await page.waitForTimeout(700);
      const narrow = await measure(page);
      console.log(
        `resized 1440×900 → 1280×800: focus ${String(wide.focus.width)}×${String(wide.focus.drawn)} → ${String(narrow.focus.width)}×${String(narrow.focus.drawn)}; panes ${wide.tiles.filter((t) => t.drawn > 0).map((t) => `${String(t.width)}×${String(t.drawn)}`).join(' ')} → ${narrow.tiles.filter((t) => t.drawn > 0).map((t) => `${String(t.width)}×${String(t.drawn)}`).join(' ')}`,
      );
      expect(narrow.page).toBe(800);
      expect(narrow.focus.width).toBeLessThan(wide.focus.width);
      expect(narrow.focus.marks).toBeGreaterThan(100);
      // every pane that drew before still draws, at its new size
      for (const tile of narrow.tiles.filter((t) => t.drawn > 0)) expect(tile.drawn, `the ${tile.id ?? '?'} pane lost its box`).toBeGreaterThan(40);
      expect(narrow.tiles.find((t) => t.id === RAMA_VIEW)?.marks).toBeGreaterThan(100);
      // …and the right column stopped at its floor rather than shrinking on
      expect(narrow.tiles.find((t) => t.id === RAMA_VIEW)?.width).toBeGreaterThan(255);
      await page.close();
    }, 300_000);
  });

  describe('the focused picture grows with the window, which a 420px constant never did', () => {
    it('is taller in a taller window, and the page still does not scroll', async () => {
      const page = await open({ width: 1440, height: 900 });
      const short = await measure(page);
      await page.setViewportSize({ width: 1440, height: 1200 });
      // the grid re-lays-out and the frame's ResizeObserver re-measures; both
      // are a frame or two, not a promise this test can await
      await page.waitForTimeout(600);
      const tall = await measure(page);
      console.log(`the focused picture: ${String(short.focus.drawn)}px in a 900px window, ${String(tall.focus.drawn)}px in a 1200px one (the old build drew it at a constant 420px in a 2,622px page)`);
      expect(tall.focus.drawn).toBeGreaterThan(short.focus.drawn + 200);
      expect(tall.focus.drawn).toBeGreaterThan(420);
      expect(tall.page).toBe(tall.viewport);
      expect(tall.focus.marks).toBeGreaterThan(100);
      await page.close();
    }, 300_000);
  });

  it('threw nothing while doing any of it', () => {
    expect(pageErrors).toEqual([]);
  });

  it('FITS THE MOL* CAMERA to the structure, in the pane it is given', async () => {
    /*
      The molecule used to sit tiny in the middle of a large well: the preset
      builds the representation and leaves the camera where the plugin
      initialised it, which frames a default volume rather than THIS structure.
      `plugin.managers.camera.reset()` — Mol*'s own call, in the adapter and not
      through the renderer protocol, because where a camera stands is the port's
      business (`web/src/molstarViewer.ts`).
      What a headless test can assert is that the canvas is painted at the size
      of its pane and that the viewer really mounted; whether the molecule fills
      the frame is a GPU fact, and the number this prints is the canvas.
    */
    const page = await open({ width: 1280, height: 800 });
    await page.locator(`[data-tile="true"][data-chart="${STRUCTURE_VIEW}"] button`).first().click();
    await page.waitForSelector(`[data-chart="${STRUCTURE_VIEW}"][data-focused="true"] canvas`, { timeout: 60_000 });
    await page.waitForTimeout(1500);
    const canvas = await page.evaluate(() => {
      const el = document.querySelector('[data-focused="true"] canvas');
      const box = el?.getBoundingClientRect();
      return { w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0), said: document.querySelector('[data-focused="true"] [role="status"]')?.textContent?.slice(0, 90) ?? null };
    });
    console.log(`the 3D pane's canvas is ${String(canvas.w)}×${String(canvas.h)}; the renderer says: ${canvas.said ?? 'nothing'}`);
    expect(canvas.w).toBeGreaterThan(400);
    expect(canvas.h).toBeGreaterThan(150);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
    await page.close();
  }, 300_000);
});
