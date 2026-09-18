/**
 * THE READER'S ARRANGEMENT, AS A FOLD — the permutation, the codec, the slot
 * law, and the identity the act lands under, all asked without a browser.
 *
 * The browser half is `tests/prot-arrangement.smoke.test.ts`, which asserts on
 * the served page that the act LANDS, that it is INERT and that the cursor
 * replays it both ways. This file is the half a browser cannot state cleanly:
 * that the slot list is a CONSTANT, which is the whole reason a focus change
 * moves two panes and not five.
 *
 * ── AND THE IDENTITY IS PINNED AGAINST THE LIBRARY'S OWN ───────────────────
 * `web/src/workbench/arrangement.ts` STATES the scope rather than importing it,
 * because the rules layer may not reach the library at all
 * (`tests/prot-layers.test.ts`, rule 2). That makes it a COPY, so it is pinned
 * here byte-for-byte against the door the act actually goes through — drift
 * would land every swap under an identity the session does not route as a
 * layout note.
 */
import { describe, expect, it } from 'vitest';
import { LAYOUT_DASHBOARD_VIEW_ID, parseLayout } from 'vizfootprint-ui';
import {
  ARRANGEMENT_PROP,
  ARRANGEMENT_SCOPE,
  ARRANGEMENT_SEPARATOR,
  arrangePanes,
  arrangementSaid,
  defaultPaneOrder,
  dropLabel,
  heldLabel,
  paneNameRefusal,
  pickUpLabel,
  slotsOf,
  stripSlots,
  swapPanes,
} from '../web/src/workbench/arrangement.js';
import { shapeOfView } from '../web/src/workbench/charts.js';
import { CONSERVATION_VIEW, INTERFACE_VIEW, PAIRS_VIEW, RAMA_VIEW, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';

/** The eight panes this desk draws at a finished run, in the order `byPlanStep` hands them over. */
const PANES = [STRUCTURE_VIEW, RAMA_VIEW, CONSERVATION_VIEW, SURFACE_VIEW, INTERFACE_VIEW, PAIRS_VIEW] as const;

const wants = (id: string): boolean => shapeOfView(id) === 'wide';
const says = (id: string): boolean => id === STRUCTURE_VIEW;
const base = (): readonly string[] => defaultPaneOrder(PANES, wants, says);

describe('the identity and the codec are the library’s own, not a second grammar', () => {
  it('lands under `layout:dashboard` — the scope pinned against the door the act goes through', () => {
    expect(`layout:${ARRANGEMENT_SCOPE}`).toBe(LAYOUT_DASHBOARD_VIEW_ID);
  });

  it('rides the cockpit’s `order` prop, and round-trips through the cockpit’s own reader', () => {
    const order = [...base()];
    // exactly what `SessionView.setLayout({ order })` writes…
    const value = order.join(ARRANGEMENT_SEPARATOR);
    // …and exactly what `SessionViewState.layout.order` reads back
    expect(parseLayout({ [ARRANGEMENT_PROP]: value }).order).toEqual(order);
  });

  it('refuses the one name the joined codec cannot carry, rather than writing it down as two', () => {
    expect(paneNameRefusal('surface')).toBeNull();
    expect(paneNameRefusal('a,b')).toContain('cannot be written down');
    expect(paneNameRefusal('   ')).toContain('cannot be arranged');
  });
});

describe('the recorded arrangement is applied, and never repaired', () => {
  it('puts the recorded panes in the recorded order and lets the rest follow in the desk’s own', () => {
    const { panes, missing } = arrangePanes(base(), [PAIRS_VIEW, SURFACE_VIEW]);
    expect(panes.slice(0, 2)).toEqual([PAIRS_VIEW, SURFACE_VIEW]);
    expect([...panes].sort()).toEqual([...PANES].sort());
    expect(missing).toEqual([]);
  });

  it('IGNORES a name this desk has no pane for and hands it back to be said once', () => {
    const { panes, missing } = arrangePanes(base(), ['ranking', SURFACE_VIEW]);
    expect(panes[0]).toBe(SURFACE_VIEW);
    expect(panes).not.toContain('ranking');
    expect(missing).toEqual(['ranking']);
    expect(arrangementSaid(missing)[0]).toContain('ranking');
    // and nothing is said when there is nothing to say
    expect(arrangementSaid([])).toEqual([]);
  });

  it('gives a pane the arrangement never named a slot anyway — a chart that arrives mid-run does not vanish', () => {
    const { panes } = arrangePanes([...PANES, 'ranking'], [SURFACE_VIEW]);
    expect(panes).toContain('ranking');
    expect(panes).toHaveLength(PANES.length + 1);
  });

  it('takes a repeated name once: a permutation cannot put one pane in two slots', () => {
    const { panes } = arrangePanes(base(), [SURFACE_VIEW, SURFACE_VIEW, PAIRS_VIEW]);
    expect(panes.filter((id) => id === SURFACE_VIEW)).toHaveLength(1);
    expect(panes.slice(0, 2)).toEqual([SURFACE_VIEW, PAIRS_VIEW]);
  });
});

describe('one act exchanges two panes, and offers nothing that would change nothing', () => {
  it('swaps exactly two slots and leaves every other slot holding what it held', () => {
    const before = base();
    const after = swapPanes(before, before[1] as string, before[4] as string);
    expect(after).not.toBeNull();
    const moved = before.flatMap((id, at) => (after?.[at] === id ? [] : [at]));
    expect(moved).toEqual([1, 4]);
  });

  it('lands nothing for a pane onto itself, or for a name this desk has no pane for', () => {
    expect(swapPanes(base(), SURFACE_VIEW, SURFACE_VIEW)).toBeNull();
    expect(swapPanes(base(), SURFACE_VIEW, 'ranking')).toBeNull();
  });
});

describe('THE SWAP LAW — a focus change moves the two panes that changed, and nothing else', () => {
  it('THE HOMES ARE A CONSTANT: every pane keeps its slot whichever pane is focused', () => {
    const panes = base();
    const strip = stripSlots(panes, wants);
    const at = slotsOf(panes, strip, SURFACE_VIEW);
    for (const focus of [...panes, null]) {
      const now = slotsOf(panes, strip, focus);
      expect(now.strip, `focusing ${String(focus)} moved a strip home`).toEqual(at.strip);
      expect(now.column, `focusing ${String(focus)} moved a column home`).toEqual(at.column);
      expect(now.focus).toBe(focus);
    }
  });

  it('and a pane this desk does not hold is not lifted at all — no home shows a marker for it', () => {
    const panes = base();
    expect(slotsOf(panes, stripSlots(panes, wants), 'ranking').focus).toBeNull();
    expect(slotsOf(panes, stripSlots(panes, wants), null).focus).toBeNull();
  });

  it('EVERY PANE HAS EXACTLY ONE HOME, and the strip and the column between them hold every pane', () => {
    const panes = base();
    const slots = slotsOf(panes, stripSlots(panes, wants), SURFACE_VIEW);
    expect([...slots.strip, ...slots.column].sort()).toEqual([...panes].sort());
  });

  it('for EVERY pair of focuses this desk can take, exactly two things change: one lifts, one settles back', () => {
    const panes = base();
    const strip = stripSlots(panes, wants);
    /** What a reader SEES at one focus: every home, and whether it holds its picture or the marker. */
    const seen = (focus: string | null): Readonly<Record<string, string>> => {
      const slots = slotsOf(panes, strip, focus);
      const out: Record<string, string> = {};
      slots.strip.forEach((id, i) => (out[id] = `strip:${String(i)}:${id === slots.focus ? 'home-marker' : 'picture'}`));
      slots.column.forEach((id, i) => (out[id] = `column:${String(i)}:${id === slots.focus ? 'home-marker' : 'picture'}`));
      out['#focus'] = slots.focus ?? 'none';
      return out;
    };
    for (const from of panes) {
      for (const to of panes) {
        if (from === to) continue;
        const a = seen(from);
        const b = seen(to);
        const changed = panes.filter((id) => a[id] !== b[id]);
        expect(changed.sort(), `moving the focus from ${from} to ${to} changed ${changed.join(', ') || 'nothing'}`).toEqual([from, to].sort());
        // …and not one pane changed the SLOT it lives in, which is the fact a
        // reader's spatial memory rests on
        for (const id of panes) expect(a[id]?.split(':').slice(0, 2).join(':')).toBe(b[id]?.split(':').slice(0, 2).join(':'));
      }
    }
  });

  it('a blocked step taking the focus lifts nothing: every pane is drawn in its own home, and exactly one settles back', () => {
    const panes = base();
    const strip = stripSlots(panes, wants);
    const was = slotsOf(panes, strip, SURFACE_VIEW);
    const now = slotsOf(panes, strip, null);
    expect(now.strip).toEqual(was.strip);
    expect(now.column).toEqual(was.column);
    expect(now.focus).toBeNull();
  });
});

describe('the desk’s own order is the arrangement the page has always drawn', () => {
  it('puts the wide-shaped panes first, then the panes that draw, then the one that says', () => {
    const order = base();
    const wide = order.filter(wants);
    expect(order.slice(0, wide.length)).toEqual(wide);
    expect(order[order.length - 1]).toBe(STRUCTURE_VIEW);
  });

  it('and at rest it gives the focus its own home in the strip, with three column homes beside it', () => {
    const panes = base();
    const strip = stripSlots(panes, wants);
    // the resting cursor stands in the stage that produced the surface run, and
    // the surface's own home is the strip's middle box — which holds the marker
    const slots = slotsOf(panes, strip, SURFACE_VIEW);
    expect(slots.focus).toBe(SURFACE_VIEW);
    expect(slots.strip).toEqual([CONSERVATION_VIEW, SURFACE_VIEW, INTERFACE_VIEW]);
    expect(slots.column).toEqual([RAMA_VIEW, PAIRS_VIEW, STRUCTURE_VIEW]);
  });
});

describe('the words say which act a handle would land, and name both panes', () => {
  it('names the pane before anything is held, the pane itself while it is, and BOTH once a drop would swap them', () => {
    expect(pickUpLabel('the contacts')).toContain('the contacts');
    expect(heldLabel('the contacts')).toContain('picked up');
    const drop = dropLabel('the contacts', 'the backbone angles');
    expect(drop).toContain('the contacts');
    expect(drop).toContain('the backbone angles');
    expect(drop).toContain('nothing else on the desk moves');
  });
});
