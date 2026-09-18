// @vitest-environment node
/**
 * THE SERVED DESK, IN A REAL BROWSER — the page the author was watching when he
 * asked why its boot was a static paragraph, driven the way a reader drives it.
 *
 * ── WHY THIS SUITE HAD TO EXIST ────────────────────────────────────────────
 * *A script-driven door call is exactly what passed while the page failed last
 * time.* Everything this packet changed is a thing only a browser can see: a
 * boot screen that fills, a stepper mark that was lying about which build it
 * was on, and a colour channel bound to a column the model wrote. So the real
 * bundle is served, with the real door behind it on the SCRIPTED driver — no
 * key, no network, no model — and the page is asked what it says.
 *
 * Four claims:
 *
 *   1. **THE BOOT REPORTS THE BOOT.** Each step is on screen, in order, with
 *      its own state — and the static paragraph is gone from this page.
 *   2. **STAGE 5 IS PENDING DURING BOOT, NEVER *NOT ON THIS BUILD*.** The bug
 *      in the author's own screenshot, watched from the first paint.
 *   3. **NO PARTIAL RANKING IS IN THE DOM WHILE THE ASK IS IN FLIGHT** —
 *      sampled throughout the boot, not only at the end.
 *   4. **A CLICK ON A RANKED RESIDUE NARROWS EVERY OTHER PANE**, and an
 *      unranked one does too: the picks are marked, and the structure stays a
 *      structure.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { buildWebIfMissing, startServedProt, type ServedHandle } from './protServedServer.js';
import { EXAMPLE_ENTRY } from '../src/prot/archive.js';
import { CONSERVATION_VIEW, INTERFACE_VIEW, RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { HOTSPOT_RANK_COLUMN, HOTSPOT_TAG } from '../src/prot/hotspots.js';
import { BLOCKED_TAG } from '../src/prot/plan.js';

const CHROME = process.env['VZF_CHROME'];

/** Every pane's mark count, by the address the desk stamps on it. */
const marks = (page: Page): Promise<Readonly<Record<string, number>>> =>
  page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('[data-chart]')].map((el) => [el.getAttribute('data-chart') ?? '?', el.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect').length])),
  );

/** How many marks a pane draws BRIGHT — the scatter keeps its dots and dims the ones a clause drops. */
const bright = (page: Page, address: string): Promise<number> =>
  page.evaluate((id) => {
    const pane = document.querySelector(`[data-chart="${id}"]`);
    if (pane === null) return -1;
    const all = pane.querySelectorAll('circle.vzf-line-dot, circle.vzf-dot, rect.vzf-barrect');
    return [...all].filter((el) => !el.classList.contains('vzf-dim') && el.closest('.vzf-dim') === null).length;
  }, address);

const words = (page: Page): Promise<string> => page.evaluate(() => (document.body.textContent ?? '').replace(/\s+/g, ' '));

/** One moment of the boot screen: the centred line, whether it says something is running, which stepper marks spin, and every word on the page. */
interface BootMoment {
  /** The ONE centred line — `null` once the desk has replaced the boot screen. */
  readonly line: string | null;
  /** `running` or `still`, as the line's own prop says — the fold's answer, read back off the DOM. */
  readonly running: string | null;
  /** Which stepper columns are drawing the one moving mark, by the column's own text. */
  readonly spinning: readonly string[];
  readonly said: string;
}

/**
 * ONE SAMPLE OF THE BOOT SCREEN, read in ONE `evaluate`.
 *
 * **It has to be one call, and a real browser taught that too.** Two calls are
 * two moments: the first found the boot screen, React swapped it for the desk,
 * and the second returned the DESK'S words — so the honesty check was handed a
 * sample that paired a boot state with the answered page and failed on a
 * residue that was never on the boot screen at all. A sample of two facts read
 * a millisecond apart is not a sample of a moment.
 *
 * `line` is `null` once the desk has replaced the boot screen, and a sample
 * with no line is not a sample of the boot.
 */
const bootSample = (page: Page): Promise<BootMoment> =>
  page.evaluate(() => {
    const line = document.querySelector('[data-boot-line]');
    return {
      line: line === null ? null : (line.textContent ?? '').replace(/\s+/g, ' ').trim(),
      running: line?.getAttribute('data-boot-line') ?? null,
      // WHICH MARKS SPIN — the design gives its one moving state an animated
      // arc with the class `pw-spin` (`workbench/theme.css`), so the marks that
      // are spinning are the columns that contain one
      spinning: [...document.querySelectorAll('nav ol > li')].filter((el) => el.querySelector('.pw-spin') !== null).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()),
      said: (document.body.textContent ?? '').replace(/\s+/g, ' '),
    };
  });

/**
 * BRING STAGE 5'S CARD INTO THE FOCUS, and the reason this is a step at all is
 * the desk's own layout rather than anything about stage 5.
 *
 * At rest the card is a COMPACT ROW in the rail — the tag, the name and one
 * line of figures (`workbench/ChartCard.tsx · BlockedGroup`, which is what
 * reclaimed 177px of a 583px column for the drawings). The ranking, its
 * citations and its two controls are read at the size of the thing they are
 * about, which means in the focus. So a reader presses the row, and so does
 * this test — by the control's ACCESSIBLE NAME, never by a position in the DOM.
 */
async function promoteHotspots(page: Page): Promise<void> {
  /*
    KEYED ON THE CARD'S OWN CONTROLS, not on a word: the card's two controls
    exist only while it is in the focus, and *the card is already there* is the
    honest test for whether a press is needed. Keying on the word `cites` was
    wrong after another card had taken the focus — the ranking's rows leave with
    it, but so do the controls, and only the controls are what a caller wants.
  */
  const mine = page.getByRole('button', { name: /colour the 3D structure by (the model’s rank|chain again)/ });
  if ((await mine.count()) > 0) return;
  const promote = page.getByRole('button', { name: /bring Hot Spot Prediction into the focus/ });
  expect(await promote.count(), 'the desk offers no control that brings stage 5’s card into the focus').toBeGreaterThan(0);
  await promote.first().click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /colour the 3D structure by /.test(b.textContent ?? '')), undefined, { timeout: 30_000 });
}

/** The 3D card's own name, as the def declares it — what its promote control and its note are called after. */
const STRUCTURE_CARD = 'The complex, in three dimensions';

/**
 * BRING ONE CARD INTO THE FOCUS AND OPEN ITS `Full note` — which is where a
 * cell's CAPTION lives, and the two reasons it takes two presses are both the
 * desk's own design.
 *
 * A card that is not in the focus is a TILE: it keeps its name and its figures
 * and has no note at all, because the note is prose and the ruling is *no
 * paragraphs between the stepper and the charts*. And a focused card's note is
 * CONDITIONALLY RENDERED (`workbench/ChartCard.tsx`: `!hasNote || !open ? null
 * : …`), so the caption is not in the document until a reader asks for it.
 *
 * Both of those mean a test that read `document.body.textContent` without
 * driving the two controls would be asserting the absence of a sentence nobody
 * had asked for — which is the assertion that proves nothing.
 */
async function openNoteOf(page: Page, card: string): Promise<void> {
  const focus = page.getByRole('button', { name: new RegExp(`^bring ${card} into the focus`) });
  if ((await focus.count()) > 0) {
    await focus.first().click();
    await page.waitForFunction((name) => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') ?? '').startsWith(`the full note for ${name}`)), card, { timeout: 30_000 });
  }
  const note = page.getByRole('button', { name: new RegExp(`^the full note for ${card}`) });
  expect(await note.count(), `the card "${card}" is not in the focus, so it offers no full note`).toBeGreaterThan(0);
  if ((await note.first().getAttribute('aria-expanded')) !== 'true') {
    await note.first().click();
    await page.waitForFunction(() => (document.body.textContent ?? '').includes('drawn by Mol*'), undefined, { timeout: 30_000 });
  }
}

/** The residues the card says the model ranked, read off the card's own rows — `<rank> <residue> … cites <ids>`. */
const pickedResidues = (page: Page): Promise<readonly string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('li')]
      .filter((el) => (el.textContent ?? '').includes('cites '))
      .map((el) => /\b([A-Za-z]:\d+)\b/.exec(el.textContent ?? '')?.[1])
      .filter((one): one is string => one !== undefined),
  );

describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('the served desk boots out loud and the model’s picks are marks in the structure (real headless Chromium)', () => {
  let served: ServedHandle;
  let browser: Browser;
  let page: Page;
  const pageErrors: string[] = [];
  const say = (line: string): void => console.log(line);
  /** Everything the page said during its boot, sampled — so the honesty check is about the whole of it and not its end. */
  const duringBoot: BootMoment[] = [];

  beforeAll(async () => {
    say(`the built app: ${await buildWebIfMissing()}`);
    served = await startServedProt();
    browser = await chromium.launch({
      ...(CHROME !== undefined ? { executablePath: CHROME } : {}),
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    /*
      `domcontentloaded` AND NOT THE DEFAULT `load`: the sampling below has to
      start before the boot does, and `load` waits for every chunk — including
      the 1.7 MB Mol* adapter — by which time the reads are already back. Waiting
      for the document is enough: the boot report's own rows are what is polled
      for, and their absence is a page that has not mounted yet.
    */
    await page.goto(`${served.protUrl}?entry=${EXAMPLE_ENTRY}`, { waitUntil: 'domcontentloaded' });
    /*
      SAMPLE THE BOOT WHILE IT IS HAPPENING. The honesty test is *no partial
      ranking in the DOM at any point*, and a check made only after the desk has
      painted would be a check of the answered state. So the boot screen is read
      as fast as the harness can read it, until it is gone, and every sample is
      kept.
    */
    const until = Date.now() + 240_000;
    let seen = false;
    while (Date.now() < until) {
      const sample = await bootSample(page);
      if (sample.line === null) {
        if (seen) break;
        continue;
      }
      seen = true;
      duringBoot.push(sample);
    }
    /*
      THE DESK HAS PAINTED — waited for by a pane that always DRAWS, and not by
      the FOCUSED one.
      A real browser taught this too: on the served desk the last stage that
      landed is stage 5, so the focus slot holds its CARD OF WORDS rather than a
      picture, and `[data-focused="true"] circle.vzf-line-dot` is a selector for
      a chart that is deliberately not there.
    */
    await page.waitForSelector(`[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 180_000 });
  }, 480_000);

  afterAll(async () => {
    await browser?.close();
    await served?.close();
  });

  it('ONE CENTRED LINE CARRIES THE STATUS, and the static paragraph is gone from this page', () => {
    expect(duringBoot.length, 'the boot screen was never on screen long enough to be read — nothing was sampled').toBeGreaterThan(0);
    const lines = [...new Set(duringBoot.map((sample) => sample.line))];
    say(`the boot, sampled ${String(duringBoot.length)} times · the lines it showed:\n${lines.join('\n')}`);
    // THE STATIC PARAGRAPH, replaced rather than kept beside the line
    for (const sample of duringBoot) expect(sample.said).not.toContain('The page is fetching the committed files over http and running the same ETL the server runs');
    /*
      AND THE LIST IS NOT THE STATUS DISPLAY ANY MORE. The stepper is — *the
      stage stepper IS the cursor* — so a vertical list narrating the same
      progression beside it would be a second answer to one question. The
      DETAIL moved to the record drawer rather than vanishing, which the last
      test in this file reads back off the desk.
    */
    for (const sample of duringBoot) expect(sample.said).not.toContain('content-length is the size of what came over the wire');
    // the acts, in the author's own words: present tense, one at a time
    expect(lines.some((line) => /^reading the committed files( · \d of 6)?$/.test(line ?? ''))).toBe(true);
    /*
      AND THE THREE DISPATCHED STAGES, EACH IN ITS OWN DECLARED WORDS.

      **The parse, the build and the probes are NOT asserted here, and that is a
      measurement rather than an omission**: those three complete inside ONE
      React batch — the conservation reads resolve, `buildDashboardAsync` and
      the three probe dispatches are already-resolved promises, and nothing
      yields to the renderer until the first stage awaits — so the browser never
      paints those moments. The FOLD produces every one of them and
      `tests/prot-boot.test.tsx` walks all three. Forcing a paint so the screen
      looked busier would be this desk inventing a moment it did not have.
    */
    expect(lines.some((line) => /^(placing|rolling|finding) /.test(line ?? ''))).toBe(true);
    expect(lines.some((line) => /^(asking |answering|thinking|the model is reading|it read |scoring)/.test(line ?? ''))).toBe(true);
    // AND NO BYTE COUNT REACHES IT: a number only where it is the point
    for (const sample of duringBoot) expect(sample.line ?? '').not.toMatch(/\d{3},\d{3}/);
  });

  it('THE SPINNER IS ON ONE MARK, and never on a stage that has dispatched nothing', () => {
    // exactly one column spins at a time, for the whole of the boot
    for (const sample of duringBoot) expect(sample.spinning.length, `${String(sample.spinning.length)} marks spinning at once: ${sample.spinning.join(' | ')}`).toBeLessThanOrEqual(1);
    const spun = [...new Set(duringBoot.flatMap((sample) => sample.spinning))];
    say(`the marks that spun: ${spun.join(' · ')}`);
    /*
      THE DEFECT THIS CLOSES: the SECOND stage's mark used to spin from the
      first paint, through six http reads and a dashboard build, while its stage
      had dispatched nothing at all. So while the line says *reading the
      committed files*, the mark that spins is step 1's.
    */
    for (const sample of duringBoot) {
      if ((sample.line ?? '').startsWith('reading the committed files')) {
        expect(sample.spinning.join(' ')).toContain('Structure Search');
        expect(sample.spinning.join(' ')).not.toContain('Sequence Analysis');
      }
      // and the line's own mark and the stepper's agree about whether anything is running
      if (sample.spinning.length > 0) expect(sample.running).toBe('running');
    }
    // the ask spins stage 5's mark, which is the column the screenshot bug was about
    expect(duringBoot.some((sample) => sample.spinning.join(' ').includes('Hot Spot Prediction'))).toBe(true);
  });

  it('THE STEPPER NEVER SAYS *NOT ON THIS BUILD* ABOUT STAGE 5 — the bug in the author’s own screenshot', () => {
    for (const sample of duringBoot) {
      expect(sample.said, 'the served boot marked stage 5 with the published build’s blocker').not.toContain(BLOCKED_TAG['this build']);
      expect(sample.said).not.toContain('not on this build');
    }
    // and step 6 — which really is ours and not built — still says so, so the
    // fix did not silence the marks it was not about
    expect(duringBoot.some((sample) => sample.said.includes(BLOCKED_TAG.us))).toBe(true);
    say(`stage 5 during boot: never "${BLOCKED_TAG['this build']}" across ${String(duringBoot.length)} samples; step 6 still "${BLOCKED_TAG.us}"`);
  });

  it('THE CARD SAYS WHAT IT IS — a recommendation, with every rank’s citations', async () => {
    // AT REST it is one row in the rail, and even there it carries its register
    expect((await words(page)).toLowerCase()).toContain(HOTSPOT_TAG.toLowerCase());
    await promoteHotspots(page);
    const said = await words(page);
    expect(said.toLowerCase()).toContain(HOTSPOT_TAG.toLowerCase());
    // EVERY ROW SHOWS THE FACT IDS IT CITED — a ranking that cited nothing was
    // refused before it reached a screen
    expect(said).toContain('cites ');
    expect(said).toContain('asked once, from the rows at commit');
    expect(pageErrors, `the page threw: ${pageErrors.join(' · ')}`).toEqual([]);
  });

  it('NO PARTIAL RANKING IS IN THE DOM AT ANY POINT WHILE THE ASK IS IN FLIGHT', async () => {
    await promoteHotspots(page);
    const picks = await pickedResidues(page);
    expect(picks.length, 'the desk shows no ranked residues, so this assertion would prove nothing').toBeGreaterThan(0);
    say(`the model ranked ${String(picks.length)} residues: ${picks.join(', ')}`);
    /*
      AND NOW THE SAMPLES FROM THE BOOT, checked against what the answer turned
      out to be. This is the assertion the whole *show the act, never the
      answer* law exists for: a residue on screen before the hallucination door
      had refused any of them.
    */
    for (const sample of duringBoot) {
      for (const pick of picks) {
        expect(sample.said, `the residue "${pick}" was in the DOM while the ask was still in flight`).not.toContain(pick);
      }
      // nor the word the ranking's citations are shown under
      expect(sample.said).not.toContain('cites ');
    }
    // and what the boot DID say about the ask is the act: a count of tokens, or
    // the model being asked
    expect(duringBoot.some((sample) => /^(asking |answering|thinking|the model is reading|it read |scoring)/.test(sample.line ?? ''))).toBe(true);
  });

  it('BINDS the 3D view’s colour to the rank, says the register while it is bound, and stops saying it when it is not', async () => {
    // THE CAPTION IS IN THE 3D CARD'S OWN NOTE, and a reader has to ask for it
    // — see `openNoteOf` for the two presses and why each one is the design
    await openNoteOf(page, STRUCTURE_CARD);
    const before = await words(page);
    expect(before, 'the 3D card’s note is not open, so this test would assert the absence of a sentence nobody asked for').toContain('drawn by Mol*');
    // THE REGISTER IS NOT STANDING over a picture of `chain`: the file's own
    // labels are not a recommendation
    expect(before).not.toContain('THE COLOURS IN THIS PICTURE ARE');
    expect(before).not.toContain('absent in the bound column');

    /** The card's own control, by its accessible name — never by a position in the DOM. */
    await promoteHotspots(page);
    const bind = page.getByRole('button', { name: /colour the 3D structure by the model’s rank/ });
    expect(await bind.count(), 'the card offers no control that binds the colour channel to the rank').toBeGreaterThan(0);
    expect(await bind.first().textContent()).toContain('shown as absent rather than as a rank of their own');
    await bind.first().click();
    /*
      WAIT FOR THE CONTROL TO FLIP, not for the caption. The control's own name
      is derived from the ENCODING FOLD at the cursor, so the moment it reads
      *by chain again* the rebind has landed — whereas the caption lives in the
      3D card's note, and that card is a TILE while stage 5's is in the focus.
      Waiting for a sentence that cannot be in the document yet is how this test
      timed out twice.
    */
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => (b.textContent ?? '').includes('colour the 3D structure by chain again')), undefined, { timeout: 60_000 });

    await openNoteOf(page, STRUCTURE_CARD);
    const bound = await words(page);
    // THE REGISTER, in the card's own words, from the one module that owns them
    expect(bound.toLowerCase()).toContain(HOTSPOT_TAG.toLowerCase());
    expect(bound).toContain(HOTSPOT_RANK_COLUMN);
    // THE ABSENCE, said as the WORD and counted from the rows on screen
    expect(bound).toContain('absent in the bound column');
    expect(bound).toContain('not a zero and not a last place');
    const absent = /([\d,]+) of the residues drawn here carry NO rank at all/.exec(bound);
    expect(absent, 'the caption does not count the residues the column says nothing about').not.toBe(null);
    say(`bound to ${HOTSPOT_RANK_COLUMN}: ${absent?.[1] ?? '?'} of 185 residues absent in the bound column, and the caption carries the register`);
    // EVERYTHING IS STILL CLICKABLE, said where a reader would expect otherwise
    expect(bound).toContain('every residue in this picture is still clickable, ranked or not');
    // and no gesture was refused on the way
    expect(bound).not.toContain('a gesture this page made on the model’s answer was refused');

    // AND BACK: the register goes away with the binding, because a standing
    // disclaimer over `chain` would call the file's own labels a recommendation
    await promoteHotspots(page);
    const unbind = page.getByRole('button', { name: /colour the 3D structure by chain again/ });
    expect(await unbind.count(), 'the control does not offer the way back').toBeGreaterThan(0);
    await unbind.first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => (b.textContent ?? '').includes('colour the 3D structure by the model’s rank')), undefined, { timeout: 60_000 });
    await openNoteOf(page, STRUCTURE_CARD);
    const back = await words(page);
    expect(back).toContain('drawn by Mol*');
    expect(back).not.toContain('THE COLOURS IN THIS PICTURE ARE');
    expect(back).not.toContain('absent in the bound column');
    expect(pageErrors, `the page threw: ${pageErrors.join(' · ')}`).toEqual([]);
  }, 180_000);

  it('A CLICK ON A RANKED RESIDUE IN THE VIEWER NARROWS EVERY OTHER PANE — counted, before and after', async () => {
    await promoteHotspots(page);
    const before = await marks(page);
    say(`before the click: ${Object.entries(before).map(([id, n]) => `${id} ${String(n)}`).join(' · ')}`);
    expect(before[SURFACE_VIEW]).toBeGreaterThan(100);
    expect(before[CONSERVATION_VIEW]).toBeGreaterThan(100);
    expect(before[INTERFACE_VIEW]).toBeGreaterThan(100);
    /**
     * THE GESTURE IS THE DESK'S OWN, made where a reader makes it: the card's
     * control puts the model's picks into the live selection, and the panes
     * narrow to them.
     *
     * A CLICK INSIDE THE MOL* CANVAS IS NOT DRIVEN HERE and the reason is a
     * measurement rather than a shortcut: the canvas is WebGL, the pick is
     * Mol*'s own ray cast into a scene software GL renders, and a synthetic
     * click at computed coordinates in swiftshader hits whatever that frame
     * happened to draw. `tests/prot-cells.test.tsx` drives the 3D view's own
     * emission on a REAL session instead — `pointOf` through `view.emit`,
     * which is the same clause this control lands — and
     * `tests/prot-hotspot-marks.test.tsx` proves an UNRANKED residue narrows
     * the desk through exactly that door. What a browser is needed for is that
     * the panes really move, and that is what is counted here.
     */
    const select = page.getByRole('button', { name: /select these \d+ residues across the desk/ });
    expect(await select.count()).toBeGreaterThan(0);
    const started = Date.now();
    await select.first().click();
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length < 100, `[data-chart="${SURFACE_VIEW}"] circle.vzf-line-dot`, { timeout: 30_000 });
    const roundTrip = Date.now() - started;
    const after = await marks(page);
    const dimmed = await bright(page, RAMA_VIEW);
    say(`after the picks reached the desk: ${Object.entries(after).map(([id, n]) => `${id} ${String(n)}`).join(' · ')} · ${String(dimmed)} dots bright in the Ramachandran · round trip ${String(roundTrip)} ms`);
    // EVERY OTHER PANE, each in the way its own chart shows a clause
    expect(after[SURFACE_VIEW]!).toBeLessThan(before[SURFACE_VIEW]!);
    expect(after[CONSERVATION_VIEW]!).toBeLessThan(before[CONSERVATION_VIEW]!);
    // the scatter DIMS rather than dropping, so its bright count is what moved
    expect(dimmed).toBeLessThan(before[RAMA_VIEW]!);
    /*
      AND `interface` DOES NOT NARROW, which is correct and worth pinning.

      The picks are emitted AT `interface` (its category channel binds
      `residue_key`, which is why one dispatch reaches the whole desk), and the
      library's own fold excludes a view's SELF clause by contract — *a press on
      a bar never collapses its own chart* (`web/src/protCells.tsx` · `barRows`
      through `keepPredicate`). A bar chart that answered its own clause would
      show one bar: the picture of the reader's own gesture.
    */
    expect(after[INTERFACE_VIEW]!).toBe(before[INTERFACE_VIEW]!);
    // the 3D view recolours rather than dropping marks, and its own pane is there
    expect(Object.keys(after)).toContain(STRUCTURE_VIEW);
    // and every pane says what narrowed it, in its own words
    /*
      AND EVERY PANE SAYS WHAT NARROWED IT, in the library's own derived words —
      *narrowed from another pane*, with the marks it drew counted against the
      marks it has at rest (`web/src/workbench/charts.ts` · `narrowingAt`). A
      pane that narrowed silently is the omission this desk is built against.
    */
    const sentences = await page.evaluate(() => [...document.querySelectorAll('[data-narrowed="true"]')].map((el) => (el.textContent ?? '').replace(/\s+/g, ' ')));
    say(`what the panes said: ${sentences.join(' || ')}`);
    expect(sentences.length).toBeGreaterThan(2);
    expect(sentences.some((one) => /^3 of 162 residues in force/.test(one))).toBe(true);
    expect(sentences.every((one) => one.includes('in force') || one.includes('still drawn'))).toBe(true);
    expect(pageErrors, `the page threw: ${pageErrors.join(' · ')}`).toEqual([]);
  }, 120_000);

  it('THE WHOLE TRIP: the stream carried its reports, the answer arrived, AND the ranking landed', async () => {
    /*
      THE DEFECT THIS PINS. The reader took an `answer` frame or nothing, so a
      body carrying the outcome with no framing round it read as *a stream that
      ended after 0 reports* — and the stage was marked refused on a page whose
      door had answered a good ranking. **A test that asserted only the reports
      would have passed through exactly that**, so all three halves are here:
      the door answered, the page has a ranking, and the COLUMN is on the rows.
    */
    expect(served.desk.asks, 'the door answered a different number of asks than this boot made').toHaveLength(1);
    expect(served.desk.asks[0]!.ok, 'the door itself did not answer a ranking, so nothing downstream proves anything').toBe(true);
    await promoteHotspots(page);
    const said = await words(page);
    // THE ANSWER ARRIVED AT THE PAGE: the card has rows, and it does not say the stream died
    expect(await pickedResidues(page)).not.toHaveLength(0);
    expect(said).not.toContain('answer stream ended after');
    expect(said).not.toContain('refused ·');
    // AND THE RANKING LANDED: the column is bindable, which it is only because
    // the act put it on the rows
    // EITHER DIRECTION OF THE CONTROL proves the column is on the rows: the
    // card offers it only for a ranking, and its name is read off the encoding
    // fold, so a suite that has already bound the channel sees the way back
    const bind = page.getByRole('button', { name: /colour the 3D structure by (the model’s rank|chain again)/ });
    expect(await bind.count(), 'the rank is not bindable, so the act did not land its column').toBeGreaterThan(0);
  });

  it('A PRESS ON STAGE 5 PROMOTES THE VIEW BOUND TO THE RANK — and says so when nothing is bound', async () => {
    /*
      The author's report: *clicking on the cursor stage nothing happens.*
      `chartsOfStage` intersects what a stage landed with what each view binds,
      and with the rank unbound that intersection is empty — a true answer, and
      it used to be a SILENT one. So: unbound, the press says which columns
      exist and that no picture reads them; bound, it promotes the 3D view.
    */
    await openNoteOf(page, STRUCTURE_CARD); // unbind state: the desk starts on `chain`
    const five = page.getByRole('button', { name: /^move the desk to stage 5/ });
    expect(await five.count(), 'stage 5 is not a control, so the press cannot be tested').toBe(1);
    await five.first().click();
    await page.waitForFunction(() => (document.body.textContent ?? '').includes('no picture on this desk is bound to any of them'), undefined, { timeout: 30_000 });
    const unbound = await words(page);
    expect(unbound).toContain('the cursor moved to stage 5, Hot Spot Prediction');
    expect(unbound).toContain(HOTSPOT_RANK_COLUMN);
    say(`the press on stage 5, with nothing bound: "${/the cursor moved to stage 5[^.]*\./.exec(unbound)?.[0] ?? '?'}"`);

    // NOW BIND IT, and the same press promotes the 3D view instead
    await promoteHotspots(page);
    await page.getByRole('button', { name: /colour the 3D structure by the model’s rank/ }).first().click();
    await page.waitForFunction((column) => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') ?? '').includes('by chain again')) || (document.body.textContent ?? '').includes(column), HOTSPOT_RANK_COLUMN, { timeout: 60_000 });
    await five.first().click();
    await page.waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') ?? '').startsWith('the full note for The complex, in three dimensions')),
      undefined,
      { timeout: 30_000 },
    );
    const bound = await words(page);
    // ONE BINDING, TWO SYMPTOMS: the colours appear AND the stepper's press works
    expect(bound).not.toContain('no picture on this desk is bound to any of them');
    expect(pageErrors, `the page threw: ${pageErrors.join(' · ')}`).toEqual([]);
  }, 180_000);

  it('THE DETAIL MOVED TO THE RECORD rather than vanishing — every fact the list used to show is still reachable', async () => {
    const open = page.getByRole('button', { name: /^open the record: / });
    expect(await open.count()).toBeGreaterThan(0);
    await open.first().click();
    const boot = page.getByRole('button', { name: /^How this desk came to hold what it holds/ });
    await boot.first().waitFor({ timeout: 30_000 });
    await boot.first().click();
    await page.waitForFunction(() => (document.body.textContent ?? '').includes('content-length is the size of what came over the wire'), undefined, { timeout: 30_000 });
    const said = await words(page);
    // THE BYTES and the measured gzip sentence that cost a packet to learn
    expect(said).toMatch(/[\d,]+ bytes read, no total/);
    expect(said).toContain('content-length is the size of what came over the wire');
    // THE PROBES' OWN COUNTS, and why a refusal is the answer that step wanted
    expect(said).toContain('gestures made, 3 refused by the library');
    /*
      AND THE STATES IN WORDS, for a reader who cannot see a mark. They are
      lower-case in the DOM and upper-cased by the stylesheet, which is the
      desk's own rule: a state is text, and the register is the theme's.
    */
    expect(said).toContain('landed');
    say('the boot’s own account is in the record drawer, with its bytes, its gzip sentence and its probe counts');
  }, 120_000);
});

/**
 * THE SAME BOOT WITH REDUCED MOTION ON — a reader who asked for no animation
 * still learns which step is running.
 *
 * The constraint is the desk's own: a static but VISIBLY DISTINCT in-progress
 * mark, never a silent drop to looking pending. `workbench/theme.css` turns the
 * arc's `animation` off under `prefers-reduced-motion: reduce` and leaves the
 * arc, the 2px accent ring and the halo — so the mark is still the only one of
 * its kind on the row.
 */
describe.skipIf(CHROME !== undefined && !existsSync(CHROME))('the boot is legible with reduced motion on (real headless Chromium)', () => {
  let served: ServedHandle;
  let browser: Browser;

  beforeAll(async () => {
    await buildWebIfMissing();
    served = await startServedProt();
    browser = await chromium.launch({ ...(CHROME !== undefined ? { executablePath: CHROME } : {}), headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  }, 300_000);

  afterAll(async () => {
    await browser?.close();
    await served?.close();
  });

  it('the running mark keeps its arc and its ring, and the animation is OFF', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`${served.protUrl}?entry=${EXAMPLE_ENTRY}`, { waitUntil: 'domcontentloaded' });
    /** The one running mark, with what the browser resolved for it. */
    const running = await page.waitForFunction(
      () => {
        const arc = document.querySelector('nav ol > li .pw-spin');
        if (arc === null) return null;
        const mark = arc.parentElement;
        if (mark === null) return null;
        return {
          animation: getComputedStyle(arc).animationName,
          border: getComputedStyle(mark).borderTopWidth,
          shadow: getComputedStyle(mark).boxShadow,
          column: (arc.closest('li')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        };
      },
      undefined,
      { timeout: 120_000 },
    );
    const said = await running.jsonValue();
    console.log(`with reduced motion: the mark on "${said?.column ?? '?'}" — animation ${said?.animation ?? '?'}, border ${said?.border ?? '?'}`);
    // THE ANIMATION IS OFF — the reader's declared wish, honoured
    expect(said?.animation).toBe('none');
    // AND THE MARK IS STILL DISTINCT: the arc is drawn, and the ring is the
    // 2px accent one that no other state has
    expect(said?.border).toBe('2px');
    expect(said?.shadow).not.toBe('none');
    // and it is still ONE mark, on a real column
    expect(said?.column.length ?? 0).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.querySelectorAll('nav ol > li .pw-spin').length)).toBe(1);
    await page.close();
  }, 180_000);
});
