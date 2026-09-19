/**
 * THE EXTENT — connected components in space, and the case that is the whole
 * reason for them.
 *
 * A sliding window can only ever report a CONTIGUOUS RUN of residue numbers. So
 * the assertions that matter are the ones a window would fail: two residues far
 * apart in sequence and adjacent in space landing in one patch, and two
 * residues in DIFFERENT CHAINS doing the same. Both are pinned on synthetic
 * coordinates here and again on the committed entry in `tests/hot-desk.test.ts`,
 * which runs the real acts.
 */
import { describe, expect, it } from 'vitest';
import { CA_CUTOFF, hotResidues, hotspotPatches, patchColumn, widestGap, type PlacedResidue } from '../src/hot/extent.js';
import { INTERFACE_FLOOR } from '../src/hot/score.js';

/** One residue at a place, with a score — the only four facts the components are computed from. */
const at = (key: string, x: number, score: number | null, over: Partial<PlacedResidue> = {}): PlacedResidue => ({
  residue_key: key,
  chain: key.split(':')[0]!,
  resnum: Number(key.split(':')[1]),
  ca_x: x,
  ca_y: 0,
  ca_z: 0,
  hotspot_structural: score,
  ...over,
});

/** A score comfortably above the floor, so a test about GEOMETRY is not accidentally a test about the threshold. */
const HOT = INTERFACE_FLOOR + 0.2;

describe('who is a candidate at all', () => {
  it('is decided by the floor folded from the weights, not by a number in this file', () => {
    const residues = [at('A:1', 0, INTERFACE_FLOOR + 0.01), at('A:2', 1, INTERFACE_FLOOR), at('A:3', 2, INTERFACE_FLOOR - 0.01)];
    expect(hotResidues(residues).map((r) => r.residue_key)).toEqual(['A:1']);
  });

  it('leaves out a residue with NO score, which is a different statement from scoring low', () => {
    expect(hotResidues([at('A:1', 0, null)])).toEqual([]);
    expect(patchColumn([at('A:1', 0, null)], [])).toEqual([null]);
  });
});

describe('a patch is a set in space, never a range in sequence', () => {
  it('joins two residues FORTY APART IN SEQUENCE that are adjacent in space', () => {
    // 4 Å apart at the alpha carbon, and 40 residues apart in numbering: one
    // patch, and a sliding window could only have covered it by swallowing the
    // thirty-nine residues in between.
    const patches = hotspotPatches([at('A:10', 0, HOT), at('A:50', 4, HOT)]);
    expect(patches).toHaveLength(1);
    expect(patches[0]!.members).toEqual(['A:10', 'A:50']);
    expect(patches[0]!.widestSequenceGap).toBe(39);
  });

  it('joins two residues in DIFFERENT CHAINS, which no sequence window can express at all', () => {
    const patches = hotspotPatches([at('A:10', 0, HOT), at('B:70', 3, HOT)]);
    expect(patches).toHaveLength(1);
    expect(patches[0]!.chains).toEqual(['A', 'B']);
  });

  it('keeps two residues far apart in SPACE in two patches, however close their numbers are', () => {
    const patches = hotspotPatches([at('A:10', 0, HOT), at('A:11', CA_CUTOFF * 3, HOT)]);
    expect(patches).toHaveLength(2);
    expect(patches.map((p) => p.members)).toEqual([['A:10'], ['A:11']]);
  });

  it('is transitive: a chain of residues each within the cutoff of the next is ONE patch, however long it gets', () => {
    const chainOfFive = [0, 6, 12, 18, 24].map((x, i) => at(`A:${String(i + 1)}`, x, HOT));
    const patches = hotspotPatches(chainOfFive);
    expect(patches).toHaveLength(1);
    // the two ends are 24 Å apart — three times the cutoff — and are still one patch
    expect(patches[0]!.members).toHaveLength(5);
  });

  it('cuts exactly at the cutoff, and the cutoff is the field’s own contact distance', () => {
    expect(CA_CUTOFF).toBe(8);
    expect(hotspotPatches([at('A:1', 0, HOT), at('A:2', CA_CUTOFF - 0.01, HOT)])).toHaveLength(1);
    expect(hotspotPatches([at('A:1', 0, HOT), at('A:2', CA_CUTOFF + 0.01, HOT)])).toHaveLength(2);
  });
});

describe('what a patch says about itself', () => {
  it('names the peak residue and its score, never an average', () => {
    const patches = hotspotPatches([at('A:1', 0, HOT), at('A:2', 2, HOT + 0.1)]);
    expect(patches[0]!.peak).toEqual({ residue_key: 'A:2', score: HOT + 0.1 });
  });

  it('reports the widest in-chain jump — 0 for a contiguous run, which is what a window would also have found', () => {
    expect(widestGap([at('A:1', 0, HOT), at('A:2', 1, HOT), at('A:3', 2, HOT)])).toBe(0);
    expect(widestGap([at('A:1', 0, HOT), at('A:9', 1, HOT)])).toBe(7);
  });

  it('is named largest first, and the names are stable across two runs over the same rows', () => {
    const rows = [at('A:1', 0, HOT), at('A:2', 1, HOT), at('B:9', 100, HOT)];
    const first = hotspotPatches(rows);
    const again = hotspotPatches([...rows].reverse());
    expect(first.map((p) => `${p.id}=${p.members.join(',')}`)).toEqual(['patch 1=A:1,A:2', 'patch 2=B:9']);
    expect(again.map((p) => `${p.id}=${p.members.join(',')}`)).toEqual(first.map((p) => `${p.id}=${p.members.join(',')}`));
  });

  it('lands one column value per row, in the table’s own order, absent for a residue in no patch', () => {
    const rows = [at('A:1', 0, HOT), at('A:2', 100, INTERFACE_FLOOR - 0.1), at('A:3', 1, HOT)];
    expect(patchColumn(rows, hotspotPatches(rows))).toEqual(['patch 1', null, 'patch 1']);
  });
});
