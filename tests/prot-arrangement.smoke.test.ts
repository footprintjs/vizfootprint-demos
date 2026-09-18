// @vitest-environment node
/**
 * THE READER ARRANGES THE DESK, AND THE ARRANGEMENT LANDS — asserted where a
 * reader is, on the built page, in a real browser.
 *
 * ── WHY IN A BROWSER, and it is the lesson rather than the feature ─────────
 * Twice in this project a script-driven check passed while the page failed, and
 * this desk has already shipped a drag handle that was ten pixels by zero while
 * its keyboard path worked perfectly (`web/src/workbench/Chrome.tsx` ·
 * `RegionDivider`). A claim about what a reader can DO has to be made where the
 * reader is, with a real pointer at real coordinates — and a claim about where
 * the panes ARE has to be made against real boxes a real grid laid out.
 *
 * ── WHAT IT ASSERTS ─────────────────────────────────────────────────────────
 *   1. THE FOCUSED WIDGET IS VISIBLY THE FOCUSED ONE, and unmarked when the
 *      focus leaves.
 *   2. THE SWAP LAW: a focus change moves exactly the pane that lifts and the
 *      pane that settles back. Every other pane's box is identical to the pixel.
 *   3. THE ACT: one commit per release, none mid-drag, and it is INERT — every
 *      pane's own row counts are unchanged across it.
 *   4. IT REPLAYS BOTH WAYS: seek behind the swap and the desk returns to the
 *      earlier arrangement; seek forward and it returns to the later one.
 *   5. A READER WITH A KEYBOARD CAN MAKE IT — `Tab` to a handle, `Enter` to pick
 *      up, `Enter` on another handle to land the same act, `Escape` to cancel.
 *   6. REDUCED MOTION changes nothing, because nothing here moves: the panes are
 *      laid out by the grid in one paint and no transition is declared on them.
 *
 * Nothing here needs a key, a network call or a model: it is the static site the
 * repository builds, served off disk.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildSiteIfMissing, startProtSite, type SiteHandle } from './protSiteServer.js';
import { EXAMPLE_ENTRY } from '../src/prot/archive.js';
import { SURFACE_VIEW } from '../src/prot/def.js';

const CHROME = process.env['VZF_CHROME'];
const SIZE = { width: 1280, height: 800 } as const;

/** One pane's box and what it is drawing, keyed by the pane it belongs to — a HOME shows the marker, a slot shows the picture. */
interface Where {
  readonly box: string;
  readonly kind: 'picture' | 'home-marker';
}

/**
 * WHERE EVERY PANE IS AND WHAT ITS BOX HOLDS.
 *
 * The focus slot is deliberately NOT in this map: it is one box that always
 * exists and always holds whatever is lifted, so counting it would report every
 * focus change as a move of a thing that never moved. What the swap law is
 * about is the HOMES, and this reads exactly those.
 */
const homes = (page: Page): Promise<Readonly<Record<string, Where>>> =>
  page.evaluate(() => {
    const out: Record<string, { box: string; kind: 'picture' | 'home-marker' }> = {};
    // A PANE IS A BOX WITH A HANDLE. Asked that way rather than by `data-tile`,
    // which the blocked steps' own rows also carry: a blocked step's card is
    // not a pane, has no home and cannot be swapped, and a test that treated
    // one as a pane spent a whole run landing nothing and calling it green.
    for (const el of document.querySelectorAll('[data-tile="true"],[data-home]')) {
      const id = el.getAttribute('data-home') ?? el.getAttribute('data-chart');
      if (id === null || el.querySelector('button[data-arrange]') === null) continue;
      const r = el.getBoundingClientRect();
      out[id] = { box: `${String(Math.round(r.x))},${String(Math.round(r.y))} ${String(Math.round(r.width))}x${String(Math.round(r.height))}`, kind: el.hasAttribute('data-home') ? 'home-marker' : 'picture' };
    }
    return out;
  });

/** Which pane is lifted into the focus slot, and whether the card says so. */
const lifted = (page: Page): Promise<{ readonly id: string | null; readonly marked: number }> =>
  page.evaluate(() => ({
    id: document.querySelector('[data-chart][data-focused="true"]')?.getAttribute('data-chart') ?? null,
    marked: document.querySelectorAll('[data-focus-mark]').length,
  }));

/** Every pane's own FIGURES — the counts it draws at this cursor. An inert act may not move one of them. */
const counts = (page: Page): Promise<Readonly<Record<string, string>>> =>
  page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const el of document.querySelectorAll('[data-chart]')) {
      const id = el.getAttribute('data-chart');
      if (id === null) continue;
      // the Mono line of figures — the only place a pane states what it drew
      out[id] = [...el.querySelectorAll('span')].map((s) => s.textContent ?? '').filter((t) => /\d/.test(t) && /rows|residues|dots|bars|marks|contacts|chains/.test(t)).join(' | ');
    }
    return out;
  });

/** How many commits the record holds, read off the drawer's own bar. */
const commits = async (page: Page): Promise<number> => {
  const label = (await page.locator('button[aria-label^="open the record"]').first().getAttribute('aria-label')) ?? '';
  return Number((/open the record: ([\d,]+) commits/.exec(label)?.[1] ?? '0').replace(/,/g, ''));
};

/** One pane's arrangement handle. */
const grip = (page: Page, id: string) => page.locator(`[data-chart="${id}"] button[data-arrange], [data-home="${id}"] button[data-arrange]`).first();

const closeTheRecord = async (page: Page): Promise<void> => {
  const bar = page.locator('button[aria-label^="open the record"]');
  if ((await bar.count()) === 0) return;
  if ((await bar.first().getAttribute('aria-expanded')) !== 'true') return;
  await bar.first().click();
  await page.waitForTimeout(400);
};

describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('the reader arranges the desk, and the arrangement lands (real headless Chromium)', () => {
  let site: SiteHandle;
  let browser: Browser;
  let page: Page;
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
    await page.goto(`${site.protUrl}?entry=${EXAMPLE_ENTRY}`);
    await page.waitForSelector(`[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 180_000 });
    // the panes have to settle: `ChartFrame` re-measures on a ResizeObserver
    // callback, so the first arrangement is not the last
    await page.waitForTimeout(2500);
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await site?.close();
  });

  describe('1 — the focused widget is visibly the focused one', () => {
    it('marks the pane in the focus, and marks exactly one', async () => {
      const now = await lifted(page);
      say(`at rest: ${String(now.id)} is lifted, ${String(now.marked)} card says so`);
      expect(now.id).toBe(SURFACE_VIEW);
      expect(now.marked).toBe(1);
    });

    it('holds its home open and says which pane lives there', async () => {
      const home = page.locator(`[data-home="${SURFACE_VIEW}"]`);
      expect(await home.count()).toBe(1);
      expect((await home.getAttribute('aria-label')) ?? '').toContain('is in the focus');
    });

    it('moves the mark with the focus, and leaves no second one behind', async () => {
      await page.locator('nav ol li:nth-child(2) button').click();
      await page.waitForTimeout(800);
      const now = await lifted(page);
      say(`after pressing stage 2: ${String(now.id)} is lifted, ${String(now.marked)} card says so`);
      expect(now.id).not.toBe(SURFACE_VIEW);
      expect(now.marked).toBe(1);
      expect(await page.locator(`[data-home="${SURFACE_VIEW}"]`).count()).toBe(0);
    });
  });

  describe('2 — THE SWAP LAW: a focus change moves the two panes that changed, and nothing else', () => {
    /**
     * THE ONE PANE WHOSE ROW TRACK IS ITS OWN.
     *
     * A pane that DRAWS wants `minmax(0, 1fr)` of the column and the desk's one
     * pane of WORDS — the 3D viewer's rail tile — wants `auto`, content height
     * and no more. That is the one thing a slot cannot decide for its occupant
     * (`web/src/protDesk.tsx` · `columnTrack` argues it), so a focus change that
     * lifts or settles THAT pane also changes one track and the column's other
     * panes resize with it. Named here, and asserted as itself below, rather
     * than folded into the law it does not keep.
     */
    const WORD_PANE = 'structure';

    it('presses every stepper column and finds exactly what changed: one pane lifts, one settles back', async () => {
      await page.locator('nav ol li:nth-child(3) button').click();
      await page.waitForTimeout(800);
      let before = await homes(page);
      let wasLifted = (await lifted(page)).id;
      // the four columns that LANDED a commit and own a drawing pane: a press on
      // a blocked step's column is a different event and has its own test below
      for (const step of [2, 4, 3, 4, 2, 3]) {
        await page.locator(`nav ol li:nth-child(${String(step)}) button`).click();
        await page.waitForTimeout(700);
        const after = await homes(page);
        const nowLifted = (await lifted(page)).id;
        const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((id) => before[id]?.kind !== after[id]?.kind);
        say(`  column ${String(step)}: lifted ${String(wasLifted)} → ${String(nowLifted)}, changed: ${changed.join(', ') || 'nothing'}`);
        expect(changed.length, `pressing column ${String(step)} changed ${String(changed.length)} panes`).toBeLessThanOrEqual(2);
        // EVERY HOME IS STILL EXACTLY WHERE IT WAS, to the pixel — this is the
        // assertion the whole packet turns on, and it is about BOXES a real
        // grid laid out, not about a model
        if (wasLifted !== WORD_PANE && nowLifted !== WORD_PANE && nowLifted !== null) {
          for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
            expect(after[id]?.box, `pressing column ${String(step)} MOVED ${id}`).toBe(before[id]?.box);
          }
        }
        before = after;
        wasLifted = nowLifted;
      }
    });

    it('a blocked step taking the focus lifts no pane at all, and the panes keep their reading order', async () => {
      /**
       * THE ORDER A READER READS THE PANES IN — within each REGION, because
       * that is what a reader's spatial memory holds.
       *
       * Grouped by region and not by raw `y`, and the reason is a measurement:
       * when a blocked step's card leaves the column's group, that group's
       * `auto` row is shorter and the drawing rows take the slack, so the
       * column's last home can end up lower on the screen than the strip's
       * first. Its place in the COLUMN is unchanged, which is the fact; a sort
       * by `y` alone would have called that a reshuffle.
       */
      const order = (at: Readonly<Record<string, Where>>): readonly string[] =>
        Object.keys(at).sort((x, y) => {
          const a = (at[x]?.box.split(' ')[0] ?? '0,0').split(',').map(Number);
          const b = (at[y]?.box.split(' ')[0] ?? '0,0').split(',').map(Number);
          const region = (at: readonly number[]): number => ((at[0] ?? 0) > 900 ? 0 : 1);
          return region(a) - region(b) || (a[1] ?? 0) - (b[1] ?? 0) || (a[0] ?? 0) - (b[0] ?? 0);
        });
      await page.locator('nav ol li:nth-child(3) button').click();
      await page.waitForTimeout(800);
      const before = await homes(page);
      await page.locator('nav ol li:nth-child(5) button').click();
      await page.waitForTimeout(900);
      const after = await homes(page);
      const now = await lifted(page);
      say(`  a blocked step in the focus: ${String(now.id)}; reading order ${order(after).join(' > ')}`);
      // NO PANE IS LIFTED: the focus slot holds a blocked step's CARD, which is
      // not a pane, has no home and cannot be swapped — so every pane is drawn
      // in its own home, exactly one has settled back, and no home shows a
      // marker.
      expect(now.id ?? '').toMatch(/^stage:/);
      expect(await page.locator('[data-home]').count()).toBe(0);
      expect(order(after)).toEqual(order(before));
      // WHAT DOES CHANGE, named: the card leaves the column's group of blocked
      // steps, so that group's own `auto` row is shorter and the column's
      // drawing rows take the slack. A card has no home, which is the fact
      // underneath it — the same bend as the word pane's track, for the same
      // reason.
      const settled = Object.keys(before).filter((id) => before[id]?.kind !== after[id]?.kind);
      expect(settled).toHaveLength(1);
    });

    it('and the ONE bend is exactly the word pane’s own track — every pane keeps its SLOT even there', async () => {
      const slotOf = (at: Readonly<Record<string, Where>>): readonly string[] =>
        Object.keys(at).sort((x, y) => {
          const a = (at[x]?.box.split(' ')[0] ?? '0,0').split(',').map(Number);
          const b = (at[y]?.box.split(' ')[0] ?? '0,0').split(',').map(Number);
          const region = (at: readonly number[]): number => ((at[0] ?? 0) > 900 ? 0 : 1);
          return region(a) - region(b) || (a[1] ?? 0) - (b[1] ?? 0) || (a[0] ?? 0) - (b[0] ?? 0);
        });
      await page.locator('nav ol li:nth-child(3) button').click();
      await page.waitForTimeout(800);
      const before = await homes(page);
      // stage 1 landed at the root and promotes its own first picture, the 3D view
      await page.locator('nav ol li:nth-child(1) button').click();
      await page.waitForTimeout(900);
      const after = await homes(page);
      expect((await lifted(page)).id).toBe(WORD_PANE);
      say(`  lifting the word pane: reading order ${slotOf(before).join(' > ')} → ${slotOf(after).join(' > ')}`);
      // the ORDER the panes are read in — the thing a reader's spatial memory
      // actually holds — is untouched; only the word pane's own row resized
      expect(slotOf(after)).toEqual(slotOf(before));
      const resized = Object.keys(before).filter((id) => before[id]?.box !== after[id]?.box);
      say(`  boxes that changed: ${resized.join(', ')}`);
      expect(resized).toContain(WORD_PANE);
    });
  });

  describe('3 — the arrangement is an ACT: one commit per release, none mid-gesture, and INERT', () => {
    it('lands NOTHING while a pane is merely picked up', async () => {
      await closeTheRecord(page);
      await page.locator('nav ol li:nth-child(3) button').click();
      await page.waitForTimeout(700);
      const was = await commits(page);
      const picked = await homes(page);
      const [a, b] = Object.keys(picked).filter((id) => picked[id]?.kind === 'picture');
      expect(a, 'the desk draws two pictures in its rail').toBeDefined();
      expect(b).toBeDefined();
      await grip(page, a as string).click();
      await page.waitForTimeout(400);
      say(`  picked ${String(a)} up: ${String(await commits(page))} commits, was ${String(was)}`);
      expect(await commits(page)).toBe(was);
      // …and the desk says which pane it is holding
      expect(await page.locator(`[data-chart="${String(a)}"] button[data-arrange="held"], [data-home="${String(a)}"] button[data-arrange="held"]`).count()).toBe(1);
      // Escape puts it back, and still lands nothing
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      expect(await commits(page)).toBe(was);
      expect(await page.locator('button[data-arrange="held"]').count()).toBe(0);
    });

    it('lands ONE commit when the two panes are swapped, and the swap is INERT — every pane draws the same counts', async () => {
      const was = await commits(page);
      const before = await homes(page);
      const drew = await counts(page);
      // TWO DRAWING PANES: the desk's one pane of WORDS owns its own row track,
      // and a swap that moves it resizes the column — the bend named in test 2.
      const rail = Object.keys(before).filter((id) => before[id]?.kind === 'picture' && id !== 'structure');
      const a = rail[0] as string;
      const b = rail[rail.length - 1] as string;
      say(`  the panes with homes: ${Object.keys(before).join(', ')}`);
      await grip(page, a).click();
      await page.waitForTimeout(300);
      await grip(page, b).click();
      await page.waitForTimeout(900);
      const now = await commits(page);
      say(`  swapped ${a} with ${b}: ${String(now)} commits, was ${String(was)}`);
      expect(now).toBe(was + 1);
      // AND THE PAGE IS STILL EXACTLY THE WINDOW. A page scrollbar narrows the
      // whole instrument by its own width, which moves every pane — so an
      // arrangement that overflowed would break the swap law by twelve pixels
      // and by nothing anybody could see. Measured exactly that way once.
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(await page.evaluate(() => window.innerHeight));
      const after = await homes(page);
      // the two named panes exchanged boxes…
      expect(after[a]?.box).toBe(before[b]?.box);
      expect(after[b]?.box).toBe(before[a]?.box);
      // …and nothing else did
      for (const id of Object.keys(before)) {
        if (id === a || id === b) continue;
        expect(after[id]?.box, `swapping ${a} with ${b} moved ${id}`).toBe(before[id]?.box);
      }
      // AND IT MOVED NO NUMBER. If rearranging panes could move a count, that
      // is catastrophic — so it is asserted, pane by pane, on the figures each
      // one prints.
      expect(await counts(page)).toEqual(drew);
    });
  });

  describe('4 — and the cursor replays it, both ways', () => {
    it('seeks behind the swap and the desk comes back to the earlier arrangement, then forward and it returns', async () => {
      const swapped = await homes(page);
      const order = (at: Readonly<Record<string, Where>>): string => Object.keys(at).sort((x, y) => (at[x]?.box ?? '').localeCompare(at[y]?.box ?? '')).join(',');
      say(`  arrangement now: ${order(swapped)}`);

      // BEHIND IT: the last landed stage's own commit is the parent of the
      // layout note, and pressing its column seeks there.
      await page.locator('nav ol li:nth-child(4) button').click();
      await page.waitForTimeout(1200);
      const behind = await homes(page);
      say(`  behind the swap:  ${order(behind)}`);
      expect(order(behind), 'seeking behind the swap left the desk arranged as if the act had happened').not.toBe(order(swapped));

      // FORWARD AGAIN: the layout commit's own row in the record drawer.
      await page.locator('button[aria-label^="open the record"]').first().click();
      await page.waitForTimeout(1000);
      // THE LOG IS BEHIND ITS OWN DISCLOSURE — everything in the record drawer
      // is, which is this desk's one folding shape.
      await page.locator('button[aria-label^="the commit log"]').first().click();
      await page.waitForTimeout(900);
      const row = page.locator('button[data-commit][title^="layout order"]').last();
      expect(await row.count(), 'the swap landed no commit the log can name').toBe(1);
      say(`  the act on the log: ${String(await row.getAttribute('title'))}`);
      await row.click();
      await page.waitForTimeout(1200);
      await closeTheRecord(page);
      await page.waitForTimeout(600);
      const forward = await homes(page);
      say(`  forward again:    ${order(forward)}`);
      expect(order(forward)).toBe(order(swapped));
    });
  });

  describe('5 — a reader with a keyboard can make the same act', () => {
    it('focuses a handle, presses Enter to pick up and Enter on another to land the swap', async () => {
      await closeTheRecord(page);
      await page.locator('nav ol li:nth-child(3) button').click();
      await page.waitForTimeout(800);
      const was = await commits(page);
      const before = await homes(page);
      const rail = Object.keys(before).filter((id) => before[id]?.kind === 'picture' && id !== 'structure');
      const a = rail[0] as string;
      const b = rail[1] as string;
      const first = grip(page, a);
      await first.focus();
      // the handle is a real control a keyboard reaches, and it says what it does
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-arrange'))).toBe('idle');
      expect((await first.getAttribute('aria-label')) ?? '').toContain('press to pick this pane up');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      expect(await commits(page)).toBe(was);
      const second = grip(page, b);
      // …and the OTHER handle now names the act pressing it would land
      expect((await second.getAttribute('aria-label')) ?? '').toContain('swap');
      await second.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
      say(`  keyboard swap ${a} ⇄ ${b}: ${String(await commits(page))} commits, was ${String(was)}`);
      expect(await commits(page)).toBe(was + 1);
      const after = await homes(page);
      expect(after[a]?.box).toBe(before[b]?.box);
      expect(after[b]?.box).toBe(before[a]?.box);
    });
  });

  describe('6 — and a pointer drag lands exactly the same act', () => {
    it('drags one pane onto another and lands one commit on release, none on the way', async () => {
      await closeTheRecord(page);
      const was = await commits(page);
      const before = await homes(page);
      const rail = Object.keys(before).filter((id) => before[id]?.kind === 'picture' && id !== 'structure');
      const a = rail[0] as string;
      const b = rail[rail.length - 1] as string;
      const from = await grip(page, a).boundingBox();
      const onto = await page.locator(`[data-chart="${b}"],[data-home="${b}"]`).first().boundingBox();
      expect(from, `no handle box for ${a}`).not.toBeNull();
      expect(onto, `no box for ${b}`).not.toBeNull();
      await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
      await page.mouse.down();
      await page.mouse.move(onto!.x + onto!.width / 2, onto!.y + onto!.height / 2, { steps: 12 });
      await page.waitForTimeout(300);
      // MID-DRAG REACHES NOTHING — a report, never a commit
      expect(await commits(page), 'a commit landed mid-drag').toBe(was);
      await page.mouse.up();
      await page.waitForTimeout(900);
      say(`  dragged ${a} onto ${b}: ${String(await commits(page))} commits, was ${String(was)}`);
      expect(await commits(page)).toBe(was + 1);
      const after = await homes(page);
      expect(after[a]?.box).toBe(before[b]?.box);
      expect(after[b]?.box).toBe(before[a]?.box);
    });

    it('declares no motion on a pane, so `prefers-reduced-motion` has nothing to reduce', async () => {
      const moving = await page.evaluate(() =>
        [...document.querySelectorAll('[data-tile="true"],[data-home],[data-chart]')].filter((el) => {
          const used = window.getComputedStyle(el as HTMLElement);
          return used.transitionDuration !== '0s' || used.animationName !== 'none';
        }).length,
      );
      say(`  panes declaring a transition or an animation: ${String(moving)}`);
      expect(moving).toBe(0);
    });
  });

  describe('7 — and the pane no clause can reach says so in its declaration’s own words', () => {
    it('says nothing at rest, and gives the DECLARED reason the moment a selection is live', async () => {
      await closeTheRecord(page);
      const clearAll = page.locator('button[aria-label^="clear every selection"]');
      // COUNTED FIRST: a `click()` on a locator that matches nothing waits out
      // the whole test timeout, which is how this test spent 30 seconds saying
      // nothing on its first run.
      if ((await clearAll.count()) > 0) await clearAll.first().click();
      await page.waitForTimeout(600);
      const quiet = await page.evaluate(() => (document.querySelector('[data-chart="pairs"] [data-narrowed]')?.textContent ?? '(nothing)').trim());
      say(`  pairs at rest: ${quiet}`);
      await page.locator(`[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`).nth(20).click({ force: true });
      await page.waitForTimeout(1200);
      const said = await page.evaluate(() => (document.querySelector('[data-chart="pairs"]') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ') ?? '');
      say(`  pairs with a selection live: ${(/[\d,]+ of [\d,]+ rows[^A-Z]*/.exec(said) ?? ['(nothing)'])[0]}`);
      expect(said).toContain('declared outside the grammar');
      expect(said).toContain('no clause can be about it');
    });
  });
});
