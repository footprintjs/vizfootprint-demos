// @vitest-environment jsdom
/**
 * THE READER MOVES THE BOUNDARY — and a drag may not break what the layout
 * promises.
 *
 * This layout exists so that a selection made in one chart is visible in the
 * others (`web/src/workbench/README.md`, and `tests/prot-crossfilter.smoke.test.ts`
 * drives the claim). A drag that shrinks the satellites past the point where
 * they can draw their marks destroys the only thing the layout is for, and it
 * does it SILENTLY. So every divider has a floor.
 *
 * ── WHAT THIS SUITE IS FOR, AND WHAT IT DELIBERATELY IS NOT ────────────────
 * Two of the three halves of the claim are testable without a browser and are
 * here:
 *
 *   1. THE FLOORS ARE DERIVED, NOT CHOSEN. Every one of the four is folded out
 *      of a number the LIBRARY or this page already measured, and this file
 *      PINS each derivation to its source — including `vizfootprint-ui`'s own
 *      `framePad`, so that a change to the library's chart margin fails here
 *      rather than quietly moving a floor.
 *   2. THE RULE IS A PURE FUNCTION. `clampShare` is asked of a drag, of a key
 *      press and of a value read back out of storage, all three, and it is
 *      asked against the CURRENT window — so the interesting cases are a stored
 *      fraction that would violate a floor and a stored fraction read into a
 *      SMALLER window than the one it was written at.
 *   3. …and the separator is a CONTROL: its roles, its values and its keyboard.
 *
 * What is NOT here is whether the panes still draw at the floor and whether the
 * crossfilter still works there. Those are layout and interaction facts, a
 * number measured in jsdom is a number about jsdom, and
 * `tests/prot-dividers.smoke.test.ts` measures them in a real browser at
 * 1280×800 — including the one a layout test could never catch, that a pick in a
 * tile still takes the focus's marks down with the divider pushed to its stop.
 *
 * ── THE NUMBERS THE CASES USE ARE THE PAGE'S OWN ───────────────────────────
 * At 1280×800 the instrument's region is 1,232 × 601 of content inside its own
 * padding, which `tests/prot-viewport.smoke.test.ts` prints the ingredients of
 * (a 800px window, 60px of header, 91px of stepper, a 32px record bar, and this
 * region's `8px 24px 40px`). The room either divider has is that minus its own
 * 10px track: 1,222 across and 591 down.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { framePad } from 'vizfootprint-ui';
import { AXIS_ROOM } from '../web/src/protCells.js';
import { RegionDivider, type DividerAction } from '../web/src/workbench/Chrome.js';
import {
  CARD_CHROME,
  COLUMN_CLAMP,
  DIVIDER_HINT,
  DIVIDER_LABEL,
  DIVIDER_TRACK,
  SPLIT_DEFAULT,
  SPLIT_STORAGE_KEY,
  STRIP_FR,
  TILE_CHROME,
  clampShare,
  columnTracks,
  dividerFloors,
  dividerValues,
  markFloor,
  parseSplit,
  rowTracks,
  serialiseSplit,
  shareAfterStep,
  shareAtEdge,
  shareAtPointer,
  stopSentence,
  trackPx,
  type Stops,
} from '../web/src/workbench/charts.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The margin the library reserves inside a chart box, for the kinds this desk draws. */
const PAD = framePad(['line', 'bar', 'point']);
/** The four stops, folded the way the page folds them. */
const FLOORS = dividerFloors({ pad: PAD, axisRoom: AXIS_ROOM });

/** The region at 1280×800, in px of content — and the room each divider has inside it. */
const REGION = { w: 1232, h: 601 } as const;
const ROOM = { w: REGION.w - DIVIDER_TRACK, h: REGION.h - DIVIDER_TRACK } as const;

describe('THE FLOORS ARE DERIVED — every one of them out of a number the library or this page already measured', () => {
  it('reads the library’s OWN margin, and pins it: a change to `framePad` fails here rather than moving a floor quietly', () => {
    // `VizLine`'s 52/18/18/44 unioned with `VizBar`'s 38/14/20/48 and
    // `VizScatter`'s 52/18/18/44 — the widest side wins, which is the library's
    // own rule for a merged frame
    expect(PAD).toEqual({ l: 52, r: 18, t: 20, b: 48 });
    console.log(`the library reserves ${String(PAD.t + PAD.b)}px of any pane's height and ${String(PAD.l + PAD.r)}px of its width, whatever is drawn in it`);
  });

  it('folds the MARK FLOOR one clamp above the library’s own — half the pane’s margin back as plot', () => {
    // `framePlotBox` clamps at `pad.t + pad.b`: below it the plot is EMPTY, and
    // the measured disaster on this page was five pixels above it
    expect(markFloor(PAD)).toEqual({ height: 102, width: 105 });
    console.log(`a pane that must still draw needs ${String(markFloor(PAD).height)}px, which leaves ${String(markFloor(PAD).height - PAD.t - PAD.b)}px of band under ${String(PAD.t + PAD.b)}px of the library's margin`);
  });

  it('ACCEPTS the two panes this page measures as honest and REFUSES the one it measured as broken', () => {
    // the strip's 104px frame drawing 185 bars and the column's 125px drawing
    // 181 dots over a 56px band, both printed by the viewport smoke
    expect(104).toBeGreaterThanOrEqual(markFloor(PAD).height);
    expect(125).toBeGreaterThanOrEqual(markFloor(PAD).height);
    // …and the 67px frame under `VizLine`'s own 62px margin: 185 dots reported,
    // a 5px band, nothing anybody could see
    expect(67).toBeLessThan(markFloor({ l: 52, r: 18, t: 18, b: 44 }).height);
  });

  it('sits BELOW the axis threshold, which is the same question asked about the LABELS', () => {
    // between the two a pane draws its marks and drops its labels, which is
    // exactly what ships today (`protCells.tsx` · `AXIS_ROOM`)
    expect(markFloor(PAD).height).toBeLessThan(AXIS_ROOM);
  });

  it('gives the four stops, each traceable to its source', () => {
    expect(FLOORS.rail.far).toBe(COLUMN_CLAMP.floor * COLUMN_CLAMP.rootPx);
    expect(FLOORS.rail.near).toBe(COLUMN_CLAMP.ceiling * COLUMN_CLAMP.rootPx);
    expect(FLOORS.strip.far).toBe(markFloor(PAD).height + TILE_CHROME);
    expect(FLOORS.strip.near).toBe(AXIS_ROOM + CARD_CHROME);
    expect(FLOORS).toEqual({ rail: { near: 360, far: 256 }, strip: { near: 289, far: 148 } });
    console.log(
      `the stops: the satellite column ${String(FLOORS.rail.far)}px (the page's own clamp(${String(COLUMN_CLAMP.floor)}rem, …)) · the focus column ${String(FLOORS.rail.near)}px (that clamp's ceiling — the widest a tile can be) · the satellite strip ${String(FLOORS.strip.far)}px (${String(markFloor(PAD).height)} of marks + ${String(TILE_CHROME)} of tile chrome) · the focus row ${String(FLOORS.strip.near)}px (AXIS_ROOM ${String(AXIS_ROOM)} + ${String(CARD_CHROME)} of card chrome)`,
    );
  });

  it('never lets the declared column floor fall below the width the marks need', () => {
    // the width arm of the mark floor is 105px and the page's own declared
    // floor is 256px, so the declared one governs — and the fold takes the
    // larger of the two rather than assuming which
    expect(FLOORS.rail.far).toBe(Math.max(COLUMN_CLAMP.floor * COLUMN_CLAMP.rootPx, markFloor(PAD).width));
    const thin = dividerFloors({ pad: { l: 200, r: 200, t: PAD.t, b: PAD.b }, axisRoom: AXIS_ROOM });
    expect(thin.rail.far).toBe(600);
  });
});

describe('THE CLAMP — one rule, pure, and asked of a drag, a key press and a stored value alike', () => {
  const rail = (share: number | null, region: number = REGION.w) => clampShare(share, region, FLOORS.rail);
  const strip = (share: number | null, region: number = REGION.h) => clampShare(share, region, FLOORS.strip);

  it('leaves a share between the floors exactly where it was', () => {
    const middle = 0.4;
    expect(rail(middle)).toEqual({ share: middle, stop: null });
  });

  it('AT a floor is not past it — the stop is where it stops, not one pixel before', () => {
    expect(rail(FLOORS.rail.far / ROOM.w)).toEqual({ share: FLOORS.rail.far / ROOM.w, stop: null });
    expect(rail(1 - FLOORS.rail.near / ROOM.w)).toEqual({ share: 1 - FLOORS.rail.near / ROOM.w, stop: null });
  });

  it('PAST the satellites’ floor is held at it, and says which stop held it', () => {
    const held = rail(0.05);
    expect(held.stop).toBe('satellites');
    expect(held.share).toBe(FLOORS.rail.far / ROOM.w);
    expect((held.share ?? 0) * ROOM.w).toBeCloseTo(256, 6);
  });

  it('PAST the focus’s floor is held at it, from the other side', () => {
    const held = rail(0.95);
    expect(held.stop).toBe('focus');
    expect((1 - (held.share ?? 0)) * ROOM.w).toBeCloseTo(360, 6);
  });

  it('holds the STRIP at the height where its bars are still a band', () => {
    const held = strip(0.02);
    expect(held.stop).toBe('satellites');
    expect((held.share ?? 0) * ROOM.h).toBeCloseTo(148, 6);
    const other = strip(0.9);
    expect(other.stop).toBe('focus');
    expect((1 - (other.share ?? 0)) * ROOM.h).toBeCloseTo(289, 6);
  });

  it('CLAMPS A STORED VALUE THAT WOULD VIOLATE A FLOOR — the broken state cannot be reproduced from storage', () => {
    // a fraction a reader could never have dragged to, hand-written into
    // storage or left there by an older build
    for (const nonsense of [0.001, 0.02, 0.99, 0.999]) {
      const held = rail(nonsense);
      expect(held.stop, `a stored ${String(nonsense)} was accepted`).not.toBeNull();
      const px = (held.share ?? 0) * ROOM.w;
      expect(px).toBeGreaterThanOrEqual(FLOORS.rail.far);
      expect(ROOM.w - px).toBeGreaterThanOrEqual(FLOORS.rail.near);
    }
  });

  it('CLAMPS A VALUE STORED AT A BIGGER WINDOW when it is read into a smaller one', () => {
    // 360px of column in a 1,920px window is a share of 0.1885; the same share
    // in a 700px-wide region is 121px, which is under the floor
    const stored = 360 / (1920 - 48 - DIVIDER_TRACK);
    const small = 700 - 48;
    const held = clampShare(stored, small, FLOORS.rail);
    expect(held.stop).toBe('satellites');
    expect((held.share ?? 0) * (small - DIVIDER_TRACK)).toBeCloseTo(256, 6);
    console.log(`a boundary stored in a 1,920px window (share ${stored.toFixed(4)}) is held at ${String(FLOORS.rail.far)}px when it is read into a ${String(small + 48)}px one`);
  });

  it('HANDS BACK THE PAGE’S OWN ARRANGEMENT when the window cannot give both sides their floor', () => {
    // 360 + 256 = 616px of floor, so a region with less room than that can
    // honour neither, and a preference honoured at one end and broken at the
    // other is the failure this rule exists to stop
    const tiny = 600 - 48;
    expect(tiny - DIVIDER_TRACK).toBeLessThan(FLOORS.rail.near + FLOORS.rail.far);
    expect(clampShare(0.4, tiny, FLOORS.rail)).toEqual({ share: null, stop: 'window' });
  });

  it('keeps the reader’s value while the window is too small — it is the LAYOUT that falls back, not the preference', () => {
    // the same share, read into a region that can hold it, comes back
    const stored = 0.4;
    expect(clampShare(stored, 600 - 48, FLOORS.rail).share).toBeNull();
    expect(clampShare(stored, REGION.w, FLOORS.rail).share).toBe(stored);
  });

  it('says nothing about a boundary the reader has not moved, and refuses nonsense', () => {
    expect(clampShare(null, REGION.w, FLOORS.rail)).toEqual({ share: null, stop: null });
    expect(clampShare(Number.NaN, REGION.w, FLOORS.rail)).toEqual({ share: null, stop: null });
    expect(clampShare(Number.POSITIVE_INFINITY, REGION.w, FLOORS.rail)).toEqual({ share: null, stop: null });
  });

  it('passes a share straight through before the region has been measured, and clamps on the first layout pass', () => {
    // the first render has no box yet; there is nothing to clamp against, and
    // the layout effect asks again with a real number
    expect(clampShare(0.001, 0, FLOORS.rail)).toEqual({ share: 0.001, stop: null });
    expect(clampShare(0.001, REGION.w, FLOORS.rail).stop).toBe('satellites');
  });
});

describe('the arithmetic a gesture goes through, and none of it in the component', () => {
  it('reads a POINTER into the satellites’ share, with the divider’s track centred under it', () => {
    // the boundary as the page ships it at 1280: a 282px column
    const pointer = 24 + REGION.w - 282 - DIVIDER_TRACK / 2;
    expect(shareAtPointer(pointer, { start: 24, extent: REGION.w })).toBeCloseTo(282 / ROOM.w, 10);
  });

  it('moves the boundary the way the key points: positive px gives the focus room', () => {
    const was = 282 / ROOM.w;
    expect(shareAfterStep(was, REGION.w, DIVIDER_TRACK)).toBeCloseTo((282 - DIVIDER_TRACK) / ROOM.w, 10);
    expect(shareAfterStep(was, REGION.w, -DIVIDER_TRACK)).toBeCloseTo((282 + DIVIDER_TRACK) / ROOM.w, 10);
  });

  it('puts HOME at the focus’s floor and END at the satellites’ — the two stops, and nothing between', () => {
    expect(shareAtEdge(FLOORS.rail, REGION.w, 'min') * ROOM.w).toBeCloseTo(ROOM.w - 360, 6);
    expect(shareAtEdge(FLOORS.rail, REGION.w, 'max') * ROOM.w).toBeCloseTo(256, 6);
    // and both survive the clamp untouched, which is what makes them the stops
    for (const to of ['min', 'max'] as const) expect(clampShare(shareAtEdge(FLOORS.rail, REGION.w, to), REGION.w, FLOORS.rail).stop).toBeNull();
  });

  it('gives the separator its own numbers, about the FOCUS side, in whole percents', () => {
    const values = dividerValues(282 / ROOM.w, REGION.w, FLOORS.rail);
    expect(values).toEqual({ now: 77, min: 29, max: 79 });
    expect(values.now).toBeGreaterThanOrEqual(values.min);
    expect(values.now).toBeLessThanOrEqual(values.max);
    console.log(`at rest the focus has ${String(values.now)}% of the width, and may have between ${String(values.min)}% and ${String(values.max)}%`);
  });

  it('answers harmlessly before anything has been measured', () => {
    expect(dividerValues(0, 0, FLOORS.rail)).toEqual({ now: 0, min: 0, max: 100 });
    expect(shareAtPointer(500, { start: 0, extent: 0 })).toBe(0);
    expect(shareAfterStep(0.3, 0, 10)).toBe(0.3);
    expect(shareAtEdge(FLOORS.rail, 0, 'min')).toBe(0);
  });
});

describe('the tracks — the page’s own expression until the reader moves the boundary', () => {
  it('spells the default from the numbers it owns, with the divider as a real track', () => {
    expect(columnTracks(null)).toBe(`minmax(0, 1fr) ${String(DIVIDER_TRACK)}px clamp(${String(COLUMN_CLAMP.floor)}rem, ${String(COLUMN_CLAMP.vw)}vw, ${String(COLUMN_CLAMP.ceiling)}rem)`);
    expect(rowTracks(null)).toBe(`minmax(0, 1fr) ${String(DIVIDER_TRACK)}px minmax(0, ${String(STRIP_FR)}fr)`);
    // the ten pixels are the ten the `gap` used to be, so the page at rest is
    // unchanged — which is why the viewport smoke's numbers still hold
    expect(columnTracks(null)).toContain('10px');
  });

  it('becomes two fractions and the same track once a reader has moved it', () => {
    expect(columnTracks(0.25)).toBe('minmax(0, 0.7500fr) 10px minmax(0, 0.2500fr)');
    expect(rowTracks(0.3)).toBe('minmax(0, 0.7000fr) 10px minmax(0, 0.3000fr)');
    // and the two fractions always sum to one, so the region stays exactly full
    // — which is the whole reason this is a divider and not a corner scale
    for (const share of [0.21, 0.25, 0.4, 0.7]) {
      const parts = /minmax\(0, ([\d.]+)fr\) 10px minmax\(0, ([\d.]+)fr\)/.exec(columnTracks(share));
      expect(Number(parts?.[1]) + Number(parts?.[2])).toBeCloseTo(1, 6);
    }
  });

  it('reads the USED track sizes back off a computed value, and keeps what it had when it cannot', () => {
    expect(trackPx('940px 10px 282px')).toEqual([940, 10, 282]);
    expect(trackPx('  1031.5px  10px  360px ')).toEqual([1031.5, 10, 360]);
    expect(trackPx('none')).toEqual([]);
    expect(trackPx('')).toEqual([]);
    expect(trackPx('940px 10px')).toEqual([]);
  });
});

describe('a stored boundary, and what happens when there is none', () => {
  it('defaults cleanly on nothing, on rubbish and on the wrong shape', () => {
    for (const raw of [null, '', 'not json at all', '[]', '"0.3"', '{}', '{"rail":null}']) expect(parseSplit(raw)).toEqual(SPLIT_DEFAULT);
  });

  it('refuses a share outside (0, 1) on READ, before any floor is asked about', () => {
    for (const bad of [0, 1, -0.2, 1.5, Number.NaN, null]) expect(parseSplit(JSON.stringify({ rail: bad })).rail).toBeNull();
    expect(parseSplit('{"rail":"0.3"}').rail).toBeNull();
  });

  it('keeps a share it recognises, one boundary at a time', () => {
    expect(parseSplit('{"rail":0.3}')).toEqual({ rail: 0.3, strip: null });
    expect(parseSplit('{"strip":0.3}')).toEqual({ rail: null, strip: 0.3 });
    expect(parseSplit('{"rail":0.3,"strip":0.28}')).toEqual({ rail: 0.3, strip: 0.28 });
  });

  it('round-trips, and writes NOTHING for a boundary nobody moved — so a reset leaves no trace of the reader', () => {
    expect(serialiseSplit(SPLIT_DEFAULT)).toBeNull();
    expect(parseSplit(serialiseSplit({ rail: 0.3, strip: 0.28 }))).toEqual({ rail: 0.3, strip: 0.28 });
    expect(parseSplit(serialiseSplit({ rail: 0.3, strip: null }))).toEqual({ rail: 0.3, strip: null });
    // one key, named for this page and versioned, and nowhere near the record
    expect(SPLIT_STORAGE_KEY).toBe('pw.prot.dividers.v1');
  });
});

describe('the words at a stop are a REASON and never an error', () => {
  it('says which side stopped it and why, for both dividers', () => {
    const said = {
      railFar: stopSentence('rail', 'satellites'),
      railNear: stopSentence('rail', 'focus'),
      stripFar: stopSentence('strip', 'satellites'),
      stripNear: stopSentence('strip', 'focus'),
      window: stopSentence('rail', 'window'),
    };
    expect(new Set(Object.values(said)).size).toBe(5);
    expect(said.railFar).toContain('still reads as a shape');
    expect(said.railNear).toContain('not a focus');
    expect(said.stripFar).toContain('band rather than a line');
    expect(said.stripNear).toContain('encoding pickers');
    expect(said.window).toContain('where the page put it');
    for (const [name, sentence] of Object.entries(said)) {
      expect(sentence, `${name} is empty`).toBeTruthy();
      // a reason, in the page's own register — not a refusal, not a warning
      for (const wrong of ['error', 'invalid', 'cannot be', 'not allowed', 'failed']) expect((sentence ?? '').toLowerCase(), `${name} reads as an error: ${sentence ?? ''}`).not.toContain(wrong);
    }
    for (const line of Object.values(said)) console.log(`  at a stop the page says: ${line ?? ''}`);
  });

  it('says nothing at rest', () => {
    expect(stopSentence('rail', null)).toBeNull();
    expect(stopSentence('strip', null)).toBeNull();
  });
});

// ── the separator, as a control ─────────────────────────────────────────────

/** One divider on screen, with every gesture it reports collected. */
async function mount(orientation: 'vertical' | 'horizontal', over: { readonly stop?: string | null } = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const acted: DividerAction[] = [];
  const which = orientation === 'vertical' ? 'rail' : 'strip';
  await act(async () => {
    root.render(
      <RegionDivider
        orientation={orientation}
        label={DIVIDER_LABEL[which]}
        hint={DIVIDER_HINT[which]}
        now={77}
        min={29}
        max={79}
        step={DIVIDER_TRACK}
        stop={over.stop ?? null}
        onAct={(action) => acted.push(action)}
      />,
    );
  });
  const bar = host.querySelector('[role="separator"]') as HTMLElement | null;
  if (bar === null) throw new Error('the divider rendered no separator');
  return {
    host,
    bar,
    acted,
    key: async (key: string, shift = false): Promise<void> => {
      await act(async () => {
        bar.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }));
      });
    },
    unmount: async (): Promise<void> => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('THE SEPARATOR IS A REAL ONE — its roles and its values', () => {
  it('is a focusable role="separator" that names the two regions it divides', async () => {
    const it_ = await mount('vertical');
    expect(it_.bar.getAttribute('role')).toBe('separator');
    expect(it_.bar.tabIndex).toBe(0);
    const name = it_.bar.getAttribute('aria-label') ?? '';
    expect(name).toBe('the boundary between the focus and the column of satellite panes on the right');
    // it names BOTH sides, which is what makes it a boundary and not a handle
    expect(name).toContain('focus');
    expect(name).toContain('satellite');
    console.log(`the vertical separator is called: ${name}`);
    await it_.unmount();
  });

  it('carries its orientation and its three values', async () => {
    const down = await mount('vertical');
    expect(down.bar.getAttribute('aria-orientation')).toBe('vertical');
    expect(down.bar.getAttribute('aria-valuenow')).toBe('77');
    expect(down.bar.getAttribute('aria-valuemin')).toBe('29');
    expect(down.bar.getAttribute('aria-valuemax')).toBe('79');
    await down.unmount();
    const across = await mount('horizontal');
    expect(across.bar.getAttribute('aria-orientation')).toBe('horizontal');
    expect(across.bar.getAttribute('aria-label')).toBe('the boundary between the focus and the strip of satellite panes below it');
    await across.unmount();
  });

  it('says how it is worked, and offers the right cursor for the axis it moves on', async () => {
    const down = await mount('vertical');
    expect(down.bar.getAttribute('title')).toContain('arrow keys');
    expect(down.bar.getAttribute('title')).toContain('Home and End');
    expect(down.bar.getAttribute('title')).toContain('Enter');
    expect(down.bar.style.cursor).toBe('col-resize');
    // a drag on a touch screen is not a scroll
    expect(down.bar.style.touchAction).toBe('none');
    // no transition on the drag, in any case: a divider that eases lags
    expect(down.bar.style.transition).toBe('none');
    await down.unmount();
    const across = await mount('horizontal');
    expect(across.bar.style.cursor).toBe('row-resize');
    await across.unmount();
  });

  it('paints the line in a TOKEN and holds no colour of its own', async () => {
    const down = await mount('vertical');
    const paint = down.bar.style.background;
    expect(paint).toContain('var(--pw-rule-divider)');
    expect(paint).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/);
    await down.unmount();
  });

  it('holds a hit area far bigger than the line it draws', async () => {
    // the visible rule is 2px inside a 10px track: `inset: 0` on the separator
    // means the TARGET is the whole track, and a 2px target is not a target
    const down = await mount('vertical');
    expect(down.bar.style.inset).toBe('0px');
    expect(down.bar.style.position).toBe('absolute');
    expect(DIVIDER_TRACK).toBeGreaterThan(2);
    await down.unmount();
  });

  it('reads its stop sentence out politely, and renders nothing at rest', async () => {
    const quiet = await mount('vertical');
    expect(quiet.host.querySelector('[role="status"]')).toBeNull();
    await quiet.unmount();
    const said = stopSentence('rail', 'satellites') ?? '';
    const loud = await mount('vertical', { stop: said });
    const status = loud.host.querySelector('[role="status"][data-divider-stop="true"]');
    expect(status).not.toBeNull();
    expect(status?.textContent).toBe(said);
    // it is ABSOLUTELY positioned, because the page is exactly the window: a
    // line that took layout space would move the pictures it is about
    expect((status as HTMLElement).style.position).toBe('absolute');
    await loud.unmount();
  });
});

describe('THE KEYBOARD — a mouse-only resize is not a control', () => {
  it('moves the boundary with the arrow keys, by the divider’s own width', async () => {
    const down = await mount('vertical');
    await down.key('ArrowRight');
    await down.key('ArrowLeft');
    expect(down.acted).toEqual([
      { kind: 'nudge', px: DIVIDER_TRACK },
      { kind: 'nudge', px: -DIVIDER_TRACK },
    ]);
    await down.unmount();
  });

  it('moves it ten times as far with Shift, so the whole range is reachable', async () => {
    const down = await mount('vertical');
    await down.key('ArrowRight', true);
    expect(down.acted).toEqual([{ kind: 'nudge', px: DIVIDER_TRACK * 10 }]);
    await down.unmount();
  });

  it('reads the keys of the axis it lies on, and ignores the other pair', async () => {
    const across = await mount('horizontal');
    await across.key('ArrowDown');
    await across.key('ArrowUp');
    await across.key('ArrowLeft');
    await across.key('ArrowRight');
    expect(across.acted).toEqual([
      { kind: 'nudge', px: DIVIDER_TRACK },
      { kind: 'nudge', px: -DIVIDER_TRACK },
    ]);
    await across.unmount();
  });

  it('puts HOME and END on the two floors', async () => {
    const down = await mount('vertical');
    await down.key('Home');
    await down.key('End');
    expect(down.acted).toEqual([
      { kind: 'edge', to: 'min' },
      { kind: 'edge', to: 'max' },
    ]);
    await down.unmount();
  });

  it('OFFERS THE WAY BACK — Enter, and a double-click for the same thing', async () => {
    const down = await mount('vertical');
    await down.key('Enter');
    await act(async () => {
      down.bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(down.acted).toEqual([{ kind: 'default' }, { kind: 'default' }]);
    await down.unmount();
  });

  it('leaves every other key alone — a divider is not a keyboard trap', async () => {
    const down = await mount('vertical');
    for (const key of ['Tab', 'Escape', ' ', 'a', 'PageUp']) await down.key(key);
    expect(down.acted).toEqual([]);
    await down.unmount();
  });
});

describe('and the gesture reaches the layout and nothing else', () => {
  it('reports a POINTER and not a share — the component cannot know where the region begins', async () => {
    // the whole reason `DividerAction.move` carries a client coordinate: a
    // presentational component that computed a fraction would have to know the
    // region it divides, and it would stop being able to move into the library
    const down = await mount('vertical');
    expect(down.acted).toEqual([]);
    const stops: Stops = FLOORS.rail;
    // the composition's own arithmetic, over the gesture the component reports
    const asked = shareAtPointer(24 + 100, { start: 24, extent: REGION.w });
    expect(clampShare(asked, REGION.w, stops).stop).toBe('focus');
    await down.unmount();
  });
});
