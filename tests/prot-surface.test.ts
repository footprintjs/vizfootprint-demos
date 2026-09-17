/**
 * STAGE B'S NUMBERS, CHECKED FOR INTERNAL CONSISTENCY — and that is the whole
 * claim this file makes about them.
 *
 * ── WHY NOT A PUBLISHED VALUE ───────────────────────────────────────────────
 * An accessible surface area is not a property of a structure; it is a property
 * of a structure AND a probe radius AND a sphere count AND a van der Waals
 * radius table AND whether the solvent is in the way. Two programs agreeing to
 * three digits is a coincidence, and quoting a paper's number as a target would
 * be asserting that this desk made the same five choices somebody else made.
 * So nothing here is compared to anything outside the entry.
 *
 * What IS asserted, and each one is a real check:
 *
 *   1. **the column loses nothing.** The 185 values on the table sum to the
 *      engine's own per-residue total exactly — so the residue→row mapping is a
 *      bijection onto the polymer, with nothing dropped and nothing counted
 *      twice. This is the assertion that would catch the chain-label collision
 *      `src/prot/surface.ts` guards against (the waters of this entry carry
 *      chain label `A`, the same label the ribonuclease carries).
 *   2. **buried means buried.** A residue the probe cannot touch has exactly
 *      zero, and the most buried residues really are in the core — one of them
 *      is the histidine that makes four of the interface's contacts, which is
 *      the two stages telling one story.
 *   3. **exposed means exposed**, and the relative value is the arithmetic it
 *      claims to be: this file divides the area by the residue type's published
 *      maximum itself and gets the same number.
 *   4. **absent is absent.** A residue the reference table has no maximum for
 *      gets NO relative value — not a fraction of alanine's, which is what the
 *      engine's own convenience would have handed back. That class is empty for
 *      this entry, so the count is pinned at zero AND the guard is exercised
 *      directly on a component id the table has never heard of.
 */
import { describe, expect, it } from 'vitest';
import { entryId, protTables } from '../src/prot/etl.js';
import { loadStructureText } from '../src/prot/snapshot.js';
import { headlessEntry } from '../src/prot/molstar.js';
import { protSurface, relativeSurface, type ResidueSurface } from '../src/prot/surface.js';

const TEXT = loadStructureText();
const TABLES = protTables(TEXT);
const KEYS = TABLES.residues.map((r) => r.residue_key);

/** The two columns, computed once for the whole file. */
async function surface(): Promise<ResidueSurface> {
  const entry = await headlessEntry(TEXT, entryId(TEXT));
  return protSurface(entry, KEYS);
}

/** One residue's row and its two landed values, by minted key. */
const at = (result: ResidueSurface, key: string): { readonly resname: string; readonly sasa: number | null; readonly relative: number | null } => {
  const index = KEYS.indexOf(key);
  expect(index, `${key} should be a row of the table`).toBeGreaterThanOrEqual(0);
  return { resname: TABLES.residues[index]!.resname, sasa: result.sasa[index] ?? null, relative: result.relative_sasa[index] ?? null };
};

describe('the accessible surface, and what it is consistent with', () => {
  it('runs at the engine’s own default parameters — read, never set here', async () => {
    const { counts } = await surface();
    // PINNED so that a Mol* upgrade which changes a default fails a test rather
    // than silently changing every number on the desk. `nonPolymer: false` is the
    // one a reader has to know: the deposited waters do NOT occlude, so this is
    // the surface of the two chains with the solvent taken away — and the two
    // chains still occlude each other, which is why an interface residue is small.
    expect(counts).toMatchObject({ probeSize: 1.4, spherePoints: 92, nonPolymer: false, traceOnly: false });
  });

  it('lands one value per row and loses nothing: the column sums to the engine’s own total, exactly', async () => {
    const result = await surface();
    expect(result.sasa).toHaveLength(KEYS.length);
    expect(result.relative_sasa).toHaveLength(KEYS.length);
    expect(result.counts.landed).toBe(185);
    expect(result.counts.noValue).toBe(0);
    // THE CONSISTENCY CHECK, and it is an equality rather than a tolerance: the
    // engine accumulates one figure per residue and the 185 landed values are
    // those same figures re-read, so the two sums are the same float additions in
    // the same order. A residue counted twice — a water overwriting a polymer
    // residue's value under the shared chain label — would break this by exactly
    // the size of what it clobbered.
    const sum = result.sasa.reduce((total: number, value) => total + (value ?? 0), 0);
    expect(sum).toBe(result.counts.engineTotal);
    // and the total is the number it is, to a tenth of a square ångström — pinned
    // so a change in the entry, the parse or the engine is visible rather than
    // absorbed
    expect(result.counts.engineTotal).toBeCloseTo(9150.4798, 3);
    // never negative, and never the engine's `-1` sentinel: -1 Å² is not an area,
    // and `src/prot/surface.ts` turns every one of them into an absence
    for (const value of result.sasa) expect(value === null || value >= 0).toBe(true);
  });

  it('gives a residue the probe cannot touch exactly zero — and one of those is the interface’s busiest histidine', async () => {
    const result = await surface();
    expect(result.counts.buried).toBe(17);
    expect(result.sasa.filter((v) => v === 0)).toHaveLength(17);
    // A:85 is a HISTIDINE with no accessible surface at all, and it makes four of
    // the twenty-one contacts across the interface
    // (`tests/prot-interactions.test.ts`). That is the two stages agreeing: it is
    // buried BECAUSE the other chain is on top of it.
    const his = at(result, 'A:85');
    expect([his.resname, his.sasa, his.relative]).toEqual(['HIS', 0, 0]);
    // a buried residue's relative value is zero for the same reason its area is —
    // zero over a real maximum is zero, which is a measurement and not an absence
    expect(result.relative_sasa[KEYS.indexOf('A:85')]).not.toBeNull();
  });

  it('gives an exposed loop residue a large area, and the relative value is that area over its type’s own maximum — divided here', async () => {
    const result = await surface();
    // the most exposed residue of the entry, found rather than named: an arginine
    // whose side chain is in the solvent
    const most = result.sasa.reduce<number>((best, value, index) => ((value ?? -1) > (result.sasa[best] ?? -1) ? index : best), 0);
    expect(KEYS[most]).toBe('A:63');
    const arg = at(result, 'A:63');
    expect(arg.resname).toBe('ARG');
    expect(arg.sasa).toBeCloseTo(225.9379, 3);
    // THE ARITHMETIC: this file reads the maximum out of the engine's exported
    // reference table and does the division itself. 225.9379 / 265 = 0.85259…
    const { MaxAsa } = await import('molstar/lib/mol-model-props/computed/accessible-surface-area/shrake-rupley/common.js');
    expect(MaxAsa['ARG']).toBe(265);
    expect(arg.relative).toBeCloseTo((arg.sasa ?? 0) / 265, 9);
    expect(arg.relative).toBeCloseTo(0.852596, 6);
    // and every landed relative value really is its own area over its own type's
    // maximum — 185 divisions, checked here rather than trusted
    for (const [index, relative] of result.relative_sasa.entries()) {
      const area = result.sasa[index];
      const max = MaxAsa[TABLES.residues[index]!.resname];
      if (relative === null || area === null || area === undefined || max === undefined) continue;
      expect(relative).toBeCloseTo(area / max, 9);
    }
  });

  it('leaves the relative value ABSENT where the reference table has no maximum — never a fraction of somebody else’s', async () => {
    const result = await surface();
    // Every residue of this entry is one of the twenty standard amino acids, so
    // the class is EMPTY — and a class with a count of zero still says the desk
    // looked (`src/prot/etl.ts` · skippedOf makes the same choice).
    expect(result.counts.noReference).toBe(0);
    expect(result.relative_sasa.filter((v) => v === null)).toHaveLength(0);
    const { AccessibleSurfaceArea } = await import('molstar/lib/mol-model-props/computed/accessible-surface-area/shrake-rupley.js');
    const { MaxAsa, DefaultMaxAsa } = await import('molstar/lib/mol-model-props/computed/accessible-surface-area/shrake-rupley/common.js');
    // SO THE GUARD IS EXERCISED DIRECTLY, on a component id the reference table
    // has never heard of. `relativeSurface` answers null; the engine's own
    // convenience would have divided by 121 — alanine's figure — and said nothing,
    // which is why this desk asks the table first.
    expect(relativeSurface(MaxAsa, AccessibleSurfaceArea.normalize, 'MSE', 60)).toBeNull();
    expect(AccessibleSurfaceArea.normalize('MSE', 60)).toBeCloseTo(60 / DefaultMaxAsa, 9);
    expect(AccessibleSurfaceArea.getNormalizedValue).toBeTypeOf('function');
    // and where there IS a reference the division is the engine's, not a second
    // copy of it written here
    expect(relativeSurface(MaxAsa, AccessibleSurfaceArea.normalize, 'ARG', 265)).toBe(1);
  });

  it('sees both chains, and the interface residues are quieter than the population they sit in', async () => {
    const result = await surface();
    const mean = (keys: readonly string[]): number => keys.reduce((total, key) => total + (at(result, key).sasa ?? 0), 0) / keys.length;
    // The nine residues of chain A that contact chain B
    // (`tests/prot-interactions.test.ts` counts them) against every residue of
    // chain A. A COMPARISON INSIDE ONE RUN — no external number — and the
    // direction is the one the story needs: an interface residue has less surface
    // left to the solvent, because its neighbour is occupying it.
    const interfaceA = ['A:32', 'A:38', 'A:40', 'A:41', 'A:64', 'A:65', 'A:66', 'A:69', 'A:85'];
    const allA = KEYS.filter((k) => k.startsWith('A:'));
    expect(allA).toHaveLength(96);
    expect(mean(interfaceA)).toBeLessThan(mean(allA));
    // both chains really are in the answer: neither is all zeroes, which is what a
    // structure parsed as one chain would look like
    for (const chain of ['A:', 'B:']) {
      const values = KEYS.map((k, i) => (k.startsWith(chain) ? (result.sasa[i] ?? 0) : 0));
      expect(values.reduce((a, b) => a + b, 0)).toBeGreaterThan(1000);
    }
  });
});
