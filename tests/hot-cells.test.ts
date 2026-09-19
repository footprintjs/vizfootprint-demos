/**
 * THE FIFTH DESK'S FOLDS — layer 3, tested without a DOM, which is what the
 * four-layer law is for.
 *
 * Every function here takes rows and hands back props. None of them touches a
 * session, none of them holds a colour that is not the declared palette's, and
 * none of them can be tested only by rendering — which is the property that
 * would let them move into the library the day it wants them.
 */
import { describe, expect, it } from 'vitest';
import { NOT_IN_A_PATCH, NO_PATCH_COLOR, PATCH_PALETTE, basisCounts, patchBars, patchPaint, patchSaid, scoreRun, togetherDots } from '../web/src/hot/cells.js';
import type { Patch } from '../src/hot/extent.js';
import type { Row } from '../web/src/derive.js';
import type { LinePoint } from 'vizfootprint-ui';

const row = (over: Partial<Record<string, unknown>>): Row => ({ residue_key: 'A:1', chain: 'A', resnum: 1, ...over }) as Row;

/**
 * A run's point at its BAND arm — `LinePoint` is a union of the dated form and
 * the band form, and every point this desk's runs produce is the second
 * (`resnum` is a discrete dimension). Narrowed here once rather than cast at
 * each assertion.
 */
const banded = (points: readonly LinePoint[]): readonly { readonly category: string; readonly cell?: unknown; readonly value: number }[] =>
  points.map((p) => p as { readonly category: string; readonly cell?: unknown; readonly value: number });

const patch = (over: Partial<Patch> = {}): Patch => ({
  id: 'patch 1',
  members: ['A:10', 'A:50'],
  chains: ['A'],
  widestSequenceGap: 39,
  peak: { residue_key: 'A:50', score: 0.71 },
  ...over,
});

describe('a run stops where a residue has no score', () => {
  it('drops a residue whose y is absent rather than drawing it at zero', () => {
    const points = banded(scoreRun([row({ resnum: 1, hotspot_structural: 0.4 }), row({ resnum: 2, hotspot_structural: null }), row({ resnum: 3, hotspot_structural: 0.6 })], 'resnum', 'hotspot_structural', 'chain'));
    expect(points.map((p) => p.value)).toEqual([0.4, 0.6]);
    expect(points.map((p) => p.category)).toEqual(['1', '3']);
  });

  it('sorts a numeric axis numerically, so residue 10 follows residue 9', () => {
    const points = banded(scoreRun([row({ resnum: 10, hotspot_structural: 0.1 }), row({ resnum: 9, hotspot_structural: 0.2 })], 'resnum', 'hotspot_structural', 'chain'));
    expect(points.map((p) => p.category)).toEqual(['9', '10']);
  });

  it('carries the x VALUE beside its spelling, so a gesture lands a clause a row can answer', () => {
    const [point] = banded(scoreRun([row({ resnum: 63, hotspot_structural: 0.5 })], 'resnum', 'hotspot_structural', 'chain'));
    expect(point!.category).toBe('63');
    expect(point!.cell).toBe(63);
  });
});

describe('the scatter needs both scores', () => {
  it('has no dot for a residue missing either one', () => {
    const dots = togetherDots(
      [row({ residue_key: 'A:1', hotspot_structural: 0.5, hotspot_prior: 0.4 }), row({ residue_key: 'A:2', hotspot_structural: 0.5, hotspot_prior: null }), row({ residue_key: 'A:3', hotspot_structural: null, hotspot_prior: 0.4 })],
      'hotspot_structural',
      'hotspot_prior',
    );
    expect(dots.map((d) => d.id)).toEqual(['A:1']);
  });

  it('carries the patch as the category, and a WORD for a residue in none rather than an empty string', () => {
    const dots = togetherDots([row({ hotspot_structural: 0.5, hotspot_prior: 0.4 }), row({ residue_key: 'A:2', hotspot_structural: 0.6, hotspot_prior: 0.4, hotspot_patch: 'patch 1' })], 'hotspot_structural', 'hotspot_prior');
    expect(dots.map((d) => d.category)).toEqual([NOT_IN_A_PATCH, 'patch 1']);
  });
});

describe('the patch bars', () => {
  it('draw only the residues that are IN a patch', () => {
    const bars = patchBars([row({ residue_key: 'A:1', hotspot_patch: 'patch 1', hotspot_structural: 0.6 }), row({ residue_key: 'A:2', hotspot_patch: null, hotspot_structural: 0.4 })], 'residue_key', 'hotspot_structural');
    expect(bars.map((b) => b.category)).toEqual(['A:1']);
  });

  it('arrive tallest first, because a band takes its slot order from the order the marks arrive in', () => {
    const bars = patchBars(
      [row({ residue_key: 'A:1', hotspot_patch: 'patch 1', hotspot_structural: 0.5 }), row({ residue_key: 'A:2', hotspot_patch: 'patch 1', hotspot_structural: 0.9 })],
      'residue_key',
      'hotspot_structural',
    );
    expect(bars.map((b) => b.category)).toEqual(['A:2', 'A:1']);
    expect(bars.map((b) => b.count)).toEqual([0.9, 0.5]);
  });
});

describe('a patch keeps its colour between the two pictures', () => {
  it('gives each patch its own hue, in the order the patches were named', () => {
    const paint = patchPaint([patch({ id: 'patch 1' }), patch({ id: 'patch 2' })]);
    expect(paint('patch 1')).toBe(PATCH_PALETTE[0]);
    expect(paint('patch 2')).toBe(PATCH_PALETTE[1]);
  });

  it('paints a residue in NO patch the absence grey, never some patch’s colour', () => {
    const paint = patchPaint([patch()]);
    expect(paint(undefined)).toBe(NO_PATCH_COLOR);
    expect(paint(NOT_IN_A_PATCH)).toBe(NO_PATCH_COLOR);
    expect(PATCH_PALETTE).not.toContain(NO_PATCH_COLOR);
  });

  it('reuses the last hue past the palette’s length rather than inventing one', () => {
    const many = Array.from({ length: PATCH_PALETTE.length + 2 }, (_, at) => patch({ id: `patch ${String(at + 1)}` }));
    const paint = patchPaint(many);
    expect(paint(`patch ${String(PATCH_PALETTE.length + 2)}`)).toBe(PATCH_PALETTE[PATCH_PALETTE.length - 1]);
  });
});

describe('the sentence that says a window could not have found this patch', () => {
  it('names the jump, with the number', () => {
    expect(patchSaid(patch())).toContain('swallow 39 residues that are NOT in it');
    expect(patchSaid(patch())).toContain('peak A:50 at 0.71');
  });

  it('says a cross-chain patch is beyond a window entirely — AND still reports the jump inside a chain', () => {
    const said = patchSaid(patch({ chains: ['A', 'B'] }));
    expect(said).toContain('no sequence window could express it at all');
    expect(said).toContain('swallow 39 residues that are NOT in it');
  });

  it('counts one residue as a residue', () => {
    expect(patchSaid(patch({ members: ['A:10'], widestSequenceGap: 0 }))).toContain('1 residue, inside chain A');
  });

  it('is honest about a contiguous one', () => {
    expect(patchSaid(patch({ widestSequenceGap: 0 }))).toContain('a contiguous run, which a window would also have found');
  });
});

describe('the absence is counted from the rows on screen', () => {
  it('counts what is scored, what rests on every term, and what has no score at all', () => {
    const rows = [
      row({ hotspot_structural: 0.5, hotspot_structural_basis: '4 of 4 terms: a, b, c, d' }),
      row({ hotspot_structural: 0.3, hotspot_structural_basis: '3 of 4 terms: a, b, c — absent: d' }),
      row({ hotspot_structural: null, hotspot_structural_basis: null }),
    ];
    expect(basisCounts(rows, 'hotspot_structural', 'hotspot_structural_basis')).toEqual({ scored: 2, complete: 1, absent: 1 });
  });
});
