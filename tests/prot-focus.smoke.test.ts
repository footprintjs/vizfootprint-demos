// @vitest-environment node
/**
 * THE STEPPER RESPONDS TO BEING PRESSED, AND A MARK CAN BE PRESSED — the two
 * defects, asserted where a reader is.
 *
 * ── WHY IN A BROWSER, and it is the lesson rather than the feature ─────────
 * Both defects were invisible to a green suite. `tests/prot-stepper.test.tsx`
 * proved every fold, and on the built page pressing *Hot Spot Prediction* moved
 * the focused pane while `aria-current` and the accent bar stayed on stage 3.
 * And the interaction grammar was declared, tested and unreachable: the
 * cross-chain bar tile's marks are a few pixels wide, and Playwright REFUSED to
 * click one — a claim about what a reader can do has to be made where the
 * reader is.
 *
 * ── WHAT IT ASSERTS ─────────────────────────────────────────────────────────
 *   1. PRESS EVERY ONE OF THE SIX COLUMNS — the landed pair, the step that
 *      landed at the root and all three kinds of blocked — and `aria-current`
 *      plus the 3px bar land on the column that was pressed, every time.
 *   2. THE DISAGREEMENT LINE: on the focused card after a blocked press and
 *      after a stage-1 press, absent after a landed one.
 *   3. AND IT IS DERIVED, proved by reaching the same state a SECOND WAY — a
 *      seek from the record drawer, which is not a stepper press at all — and
 *      finding the same sentence.
 *   4. A MARK IN A RAIL TILE, PRESSED BY HAND, lands a selection. This is the
 *      assertion the suite could not make, and the reason the tile now says in
 *      its own voice how hard that press is.
 *   5. A CARD'S FACE IS A TITLE, A PICTURE AND ONE LINE OF FIGURES — no
 *      `How to read:` and no stage line above the picture, and both of them
 *      back on one press.
 *   6. THE RAMACHANDRAN'S DECLARED CROSSHAIR is drawn, over the whole of
 *      torsion space.
 *
 * ── HOW IT DRIVES THE BROWSER ───────────────────────────────────────────────
 * The library's own smoke pattern, as the other three prot smokes use it:
 * `playwright-core`, `VZF_CHROME` when it is set, the three ANGLE flags for the
 * WebGL context Mol* asks for on mount, and `tests/protSiteServer.ts` serving
 * the same `dist/site` the site test walks as files. Every gesture is the
 * gesture a reader makes — a press on a control found by its accessible name,
 * or a real pointer at a mark's own coordinates.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildSiteIfMissing, startProtSite, type SiteHandle } from './protSiteServer.js';
import { EXAMPLE_ENTRY } from '../src/prot/archive.js';
import { INTERFACE_VIEW, RAMA_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { PAIRS_ACT } from '../src/prot/analyses.js';
import { PROT_PLAN } from '../src/prot/plan.js';

/** An explicit browser, when the environment names one; unset ⇒ playwright-core launches the headless shell it installed. */
const CHROME = process.env['VZF_CHROME'];

/** The tighter of the two budgets the brief names — the one the author measured both defects at. */
const SIZE = { width: 1280, height: 800 } as const;

/** The opening of the sentence the page says when the focus and the cursor part company (`web/src/workbench/panel.ts` · `focusVsCursor`). */
const ELSEWHERE = 'You are looking at stage';

/** What one act's seek control is called in the record drawer (`web/src/protTrace.tsx` · `ActRow`). */
const seekLabel = (act: string): string => `seek the cursor to the commit act "${act}" landed`;

/** WHERE THE PAGE SAYS YOU ARE: the column carrying `aria-current`, the column carrying the 3px bar, and what is in the focus slot. */
const whereAmI = (page: Page): Promise<{ readonly current: readonly number[]; readonly bars: readonly number[]; readonly focus: string | null; readonly elsewhere: readonly string[] }> =>
  page.evaluate(() => {
    const items = [...document.querySelectorAll('nav ol li')];
    return {
      current: items.flatMap((li, i) => (li.getAttribute('aria-current') === 'step' ? [i + 1] : [])),
      // the accent bar is the column's own last aria-hidden span, 3px tall
      bars: items.flatMap((li, i) => {
        const last = [...li.children].filter((el) => el.getAttribute('aria-hidden') !== null).at(-1);
        return last !== undefined && (last as HTMLElement).style.height === '3px' ? [i + 1] : [];
      }),
      focus: document.querySelector('[data-chart][data-focused="true"]')?.getAttribute('data-chart') ?? null,
      elsewhere: [...document.querySelectorAll('[data-focused="true"] p[role="status"]')].map((p) => (p.textContent ?? '').trim()).filter((t) => t.startsWith('You are looking at stage')),
    };
  });

/**
 * SHUT THE RECORD DRAWER IF IT IS OPEN.
 *
 * It opens OVER the charts so the instrument does not re-lay-out under a reader
 * (`web/src/workbench/README.md`), which means an open drawer intercepts every
 * press on the desk behind it. The test that reaches an act's own seek control
 * has to open it, so every test after that one starts by shutting it — a real
 * reader's own gesture, the same control, and the drawer's `aria-expanded` is
 * what says whether it is needed.
 */
async function closeTheRecord(page: Page): Promise<void> {
  const bar = page.locator('button[aria-label^="open the record"]');
  if ((await bar.count()) === 0) return;
  if ((await bar.first().getAttribute('aria-expanded')) !== 'true') return;
  await bar.first().click();
  await page.waitForTimeout(400);
}

/** The commit line in the chrome — where the CURSOR is, which is a different fact and keeps its own voice. */
const commitLine = (page: Page): Promise<string> => page.evaluate(() => (document.querySelector('header')?.textContent ?? '').replace(/\s+/g, ' '));

describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('the stepper responds to being pressed, and a mark can be pressed (real headless Chromium)', () => {
  let site: SiteHandle;
  let browser: Browser;
  let page: Page;
  const pageErrors: string[] = [];
  /** Say every number out loud: a green tick that printed nothing is what let both of these live. */
  const say = (line: string): void => console.log(line);

  beforeAll(async () => {
    say(`the built site: ${await buildSiteIfMissing()}`);
    site = await startProtSite();
    browser = await chromium.launch({
      ...(CHROME !== undefined ? { executablePath: CHROME } : {}),
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    page = await browser.newPage({ viewport: { width: SIZE.width, height: SIZE.height } });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(`${site.protUrl}?entry=${EXAMPLE_ENTRY}`);
    // the run has to finish before there is a focus or a cursor to move
    await page.waitForSelector(`[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 120_000 });
    // …and the panes have to settle: `ChartFrame` re-measures on a
    // ResizeObserver callback, so the first arrangement is not the last
    await page.waitForTimeout(2500);
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await site?.close();
  });

  describe('DEFECT 1 — the bar and aria-current follow the stage you pressed, all six of them', () => {
    it('lands both marks on the column at rest, which is the stage the cursor stands in and the stage in the focus', async () => {
      const now = await whereAmI(page);
      say(`at rest: aria-current on ${now.current.join(',')} · bar under ${now.bars.join(',')} · ${String(now.focus)} in the focus`);
      expect(now.current).toEqual(now.bars);
      expect(now.focus).toBe(SURFACE_VIEW);
      // they AGREE here, so there is no disagreement line
      expect(now.elsewhere).toEqual([]);
    });

    /*
      ALL SIX, ONE PRESS EACH, in the plan's own order — and the three that
      cannot move the cursor are the reason this test exists. The control is
      found by its POSITION in the nav rather than by its name, because the two
      names differ by what a press MEANS (`workbench/steps.ts` · `seekLabelOf`
      / `showLabelOf` / `focusLabelOf`) and this test is about the mark.
    */
    for (const step of PROT_PLAN) {
      it(`marks column ${String(step.step)} — ${step.name} — when that column is pressed, and marks no other`, async () => {
        const control = page.locator(`nav ol li:nth-child(${String(step.step)}) button`);
        expect(await control.count(), `column ${String(step.step)} is not a control`).toBe(1);
        const named = (await control.getAttribute('aria-label')) ?? '';
        await control.click();
        await page.waitForTimeout(700);
        const now = await whereAmI(page);
        say(`  pressed ${String(step.step)} (${named.slice(0, 44)}…): aria-current ${now.current.join(',')} · bar ${now.bars.join(',')} · focus ${String(now.focus)}`);
        expect(now.current).toEqual([step.step]);
        expect(now.bars).toEqual([step.step]);
        // …and the press really did change the screen, which is the other half
        expect(now.focus).not.toBeNull();
      });
    }

    it('leaves the CURSOR’s own voice in the chrome, correct and visible through every one of those presses', async () => {
      // the last press was column 6, which lands no commit — so the cursor is
      // still standing where the last landed press put it, and the header says so
      const line = await commitLine(page);
      say(`  the chrome still says: ${(/as they stand at commit[^·]*/.exec(line) ?? ['(no commit line)'])[0]}`);
      expect(line).toContain('as they stand at commit');
      expect(line).toContain('185 rows');
    });
  });

  describe('DEFECT 1 — and when the two disagree, the page says so', () => {
    it('says it after a BLOCKED press, naming both stages', async () => {
      await page.locator('nav ol li:nth-child(5) button').click();
      await page.waitForTimeout(700);
      const now = await whereAmI(page);
      say(`  after pressing stage 5: “${now.elsewhere[0] ?? '(nothing)'}”`);
      expect(now.elsewhere).toHaveLength(1);
      expect(now.elsewhere[0]).toContain('You are looking at stage 5, Hot Spot Prediction');
      expect(now.elsewhere[0]).toContain('the cursor is standing in stage');
      expect(now.elsewhere[0]).toContain('every picture here is drawn where the cursor is');
    });

    it('says it after a STAGE 1 press too — the step ran, and it has no commit to seek to', async () => {
      await page.locator('nav ol li:nth-child(1) button').click();
      await page.waitForTimeout(700);
      const now = await whereAmI(page);
      say(`  after pressing stage 1: “${now.elsewhere[0] ?? '(nothing)'}”`);
      expect(now.elsewhere).toHaveLength(1);
      expect(now.elsewhere[0]).toContain('You are looking at stage 1, Structure Search');
    });

    it('says NOTHING after a LANDED press — the bar moved and so did the cursor, so there is nothing to announce', async () => {
      await page.locator('nav ol li:nth-child(3) button').click();
      await page.waitForSelector(`[data-chart="${SURFACE_VIEW}"][data-focused="true"] circle.vzf-line-dot`, { timeout: 30_000 });
      await page.waitForTimeout(700);
      const now = await whereAmI(page);
      say(`  after pressing stage 3: aria-current ${now.current.join(',')} and ${String(now.elsewhere.length)} disagreement lines`);
      expect(now.current).toEqual([3]);
      expect(now.elsewhere).toEqual([]);
      expect(await page.locator(`text=${ELSEWHERE}`).count()).toBe(0);
    });

    /*
      ── AND IT IS DERIVED, WHICH IS THE CLAIM THAT MATTERS ──────────────────
      The line must come from the two facts disagreeing and never from which
      button was pressed, so that it is right after a resize, a reload or a seek
      somebody made somewhere else. This proves it by reaching the same state
      through a door the stepper has nothing to do with: an act's own seek
      control, inside the record drawer.

      Seeking to the FIRST act's commit puts the cursor behind every stage's own
      commit — a stage's commit is its LAST act's — so the cursor stands in no
      stage at all, while the focus still holds a picture that belongs to one.
      Two facts, disagreeing, with no press on the stepper.
    */
    it('is DERIVED: a seek from the record drawer reaches the same state and finds the same line', async () => {
      const target = page.getByLabel(seekLabel(PAIRS_ACT), { exact: true });
      for (let tries = 0; tries < 6; tries += 1) {
        if ((await target.count()) > 0) break;
        const closed = page.locator('[aria-expanded="false"]');
        if ((await closed.count()) === 0) break;
        await closed.first().click();
      }
      expect(await target.count(), `no control on the page is called "${seekLabel(PAIRS_ACT)}"`).toBeGreaterThan(0);
      await target.first().click();
      // the re-read is a promise: the surface column steps back out of the table
      await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 0, `[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 30_000 });
      await page.waitForTimeout(900);
      const now = await whereAmI(page);
      say(`  after a seek from the drawer: aria-current ${now.current.join(',')} · focus ${String(now.focus)} · “${now.elsewhere[0] ?? '(nothing)'}”`);
      expect(now.elsewhere).toHaveLength(1);
      expect(now.elsewhere[0]).toContain(ELSEWHERE);
      // NOBODY PRESSED THE STEPPER, and the page still says the two parted
      // company — the cursor is behind every stage's own commit
      expect(now.elsewhere[0]).toContain('the cursor is not standing in any stage');
      // and the bar is under the column the FOCUS belongs to, which is the law
      expect(now.current).toEqual(now.bars);
      expect(now.current).toHaveLength(1);
      // the drawer opened over the charts to reach that control; shut it again
      await closeTheRecord(page);
    }, 120_000);
  });

  describe('DEFECT 2 — a mark in a rail tile can be pressed, and the tile says how hard that is', () => {
    beforeAll(async () => {
      await closeTheRecord(page);
      // back to the head, so the interface column is on the rows again
      await page.locator('nav ol li:nth-child(4) button').click();
      await page.waitForTimeout(1200);
      // …and the interface bars into the RAIL rather than the focus
      await page.locator('nav ol li:nth-child(3) button').click();
      /*
        `state: 'attached'` AND NOT THE DEFAULT `'visible'`, and the reason is
        this very defect: the FIRST of the 185 bars is `A:1 (0)` — a real count
        of zero, drawn `height="0"` — so Playwright's visibility check never
        resolves on it. This hook fell into the trap the suite below documents
        before it was written this way, which is the best proof of it there is.
      */
      await page.waitForSelector(`[data-tile="true"][data-chart="${INTERFACE_VIEW}"] rect.vzf-barrect`, { state: 'attached', timeout: 60_000 });
      await page.waitForTimeout(1500);
    }, 120_000);

    it('says in the tile’s own voice that its marks are too thin to press, beside its own figures', async () => {
      const tile = page.locator(`[data-tile="true"][data-chart="${INTERFACE_VIEW}"]`);
      const said = (await tile.innerText()).replace(/\s+/g, ' ');
      say(`  the tile says: ${said.slice(0, 160)}`);
      expect(said).toContain('too thin to press');
      // THE FIGURES FIRST AND THE CLAUSE SECOND — the counts are the only
      // surviving copy of themselves, so the clause is what shortens
      expect(said.indexOf('bars')).toBeLessThan(said.indexOf('too thin to press'));
      // and it names a remedy that is TRUE: not "press it to pick in the focus",
      // which at 185 marks would be false there too
      expect(said).toContain('Tab picks one');
      expect(said).not.toContain('pick in the focus');
    });

    /*
      ── THE ASSERTION THE SUITE COULD NOT MAKE ──────────────────────────────
      A real pointer, at the mark's OWN coordinates, and the selection has to
      land. The mark is chosen by its height and not by its position: 167 of the
      185 residues touch no other chain, so their count is a real ZERO and an
      SVG rect of zero height has no area at all — `locator.first().click()` is
      what times out on this chart, reporting the target as not stable, and that
      is the measurement the tile's own clause is about.
    */
    it('LANDS A SELECTION when a bar is pressed with a real pointer, and names the residue it picked', async () => {
      const mark = await page.evaluate((selector) => {
        const host = document.querySelector(selector);
        if (host === null) return null;
        const rects = [...host.querySelectorAll('rect.vzf-barrect')] as SVGRectElement[];
        let best: SVGRectElement | null = null;
        let tallest = -1;
        for (const rect of rects) {
          const box = rect.getBoundingClientRect();
          if (box.height > tallest) {
            tallest = box.height;
            best = rect;
          }
        }
        if (best === null) return null;
        const box = best.getBoundingClientRect();
        const withArea = rects.filter((r) => r.getBoundingClientRect().height > 0).length;
        return { label: best.getAttribute('aria-label'), x: box.x + box.width / 2, y: box.y + box.height / 2, w: Math.round(box.width * 100) / 100, h: Math.round(box.height * 100) / 100, bars: rects.length, withArea };
      }, `[data-tile="true"][data-chart="${INTERFACE_VIEW}"]`);
      expect(mark).not.toBeNull();
      say(`  the tile draws ${String(mark!.bars)} bars, ${String(mark!.withArea)} of them with any area at all; the tallest is ${String(mark!.w)}×${String(mark!.h)}px and is "${String(mark!.label)}"`);
      // the measurement the clause is folded from: a target no pointer guideline
      // would accept, and most of them with no area whatsoever
      expect(mark!.w).toBeLessThan(24);
      expect(mark!.withArea).toBeLessThan(mark!.bars);

      await page.mouse.click(mark!.x, mark!.y);
      // the clause reaches the session and comes back as a chip a reader can clear
      await page.waitForSelector('button[aria-label^="clear the"]', { timeout: 30_000 });
      await page.waitForTimeout(800);
      const chips = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      const residue = /select (\S+) \(/.exec(mark!.label ?? '')?.[1] ?? '';
      say(`  the press landed: the page now names the clause "${residue}" and offers a control to clear it`);
      expect(residue).not.toBe('');
      expect(chips).toContain(residue);
      expect(await page.locator('button[aria-label^="clear the"]').count()).toBeGreaterThan(0);
    }, 120_000);

    it('clears again, so the rest of this file is not reading a filtered desk', async () => {
      await page.locator('button[aria-label^="clear the"]').first().click();
      await page.waitForTimeout(1000);
      expect(await page.locator('button[aria-label^="clear the"]').count()).toBe(0);
    });
  });

  describe('a card’s face is a title, a picture and one line of figures', () => {
    beforeAll(async () => {
      await closeTheRecord(page);
    }, 60_000);

    it('puts no how-to-read line and no stage line above the picture, on the focus or on a tile', async () => {
      const words = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      expect(words).not.toContain('How to read:');
      // the stage attribution came off every footer with them — one owner per
      // question, and the stepper is the owner now
      expect(words).not.toContain('Stage 3 · Structure Analysis');
      // …and the FIGURES are all still there: the counts are the only surviving
      // copy of themselves on this desk
      for (const count of ['185 residues', 'residues plotted', 'cross-chain']) expect(words, `the page no longer states "${count}"`).toContain(count);
      say(`  no prose above a picture, and the counts are still on the cards`);
    });

    it('gives both sentences back on one press, whole', async () => {
      const note = page.locator('[data-chart][data-focused="true"] button[aria-label^="the full note"]');
      expect(await note.count()).toBeGreaterThan(0);
      await note.first().click();
      await page.waitForTimeout(500);
      const opened = (await page.locator('[data-chart][data-focused="true"]').innerText()).replace(/\s+/g, ' ');
      expect(opened).toContain('How to read:');
      expect(opened).toContain('STAGE');
      say(`  and on the press: ${(/How to read:[^·]*/.exec(opened) ?? ['?'])[0].slice(0, 90)}`);
      await note.first().click();
      await page.waitForTimeout(300);
    }, 120_000);
  });

  describe('the Ramachandran draws the crosshair it DECLARES, over the whole of torsion space', () => {
    it('draws two zero lines and runs both axes −180 to 180', async () => {
      await page.locator(`[data-tile="true"][data-chart="${RAMA_VIEW}"] button`).first().click();
      await page.waitForSelector(`[data-chart="${RAMA_VIEW}"][data-focused="true"] circle.vzf-dot`, { timeout: 30_000 });
      await page.waitForTimeout(1200);
      const drawn = await page.evaluate((selector) => {
        const host = document.querySelector(selector);
        if (host === null) return null;
        return {
          zero: host.querySelectorAll('line.vzf-zero').length,
          ticks: [...host.querySelectorAll('text.vzf-tick')].map((t) => t.textContent ?? ''),
          dots: host.querySelectorAll('circle.vzf-dot').length,
        };
      }, `[data-chart="${RAMA_VIEW}"][data-focused="true"]`);
      say(`  the backbone-angle plot: ${String(drawn?.zero)} zero lines, ${String(drawn?.dots)} dots, ticks ${(drawn?.ticks ?? []).join('/')}`);
      // ONE PER AXIS — φ = 0 and ψ = 0, which is what makes a quadrant readable
      expect(drawn?.zero).toBe(2);
      expect(drawn?.dots).toBeGreaterThan(100);
      // …and the box is the real square, not the extent of these residues
      for (const edge of ['-180', '180', '0']) expect(drawn?.ticks).toContain(edge);
    }, 120_000);
  });

  it('threw nothing while doing any of it', () => {
    expect(pageErrors).toEqual([]);
  });
});
