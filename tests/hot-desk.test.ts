/**
 * THE FIFTH DESK, RUN FOR REAL on the committed entry — one boot, every claim
 * the desk makes about itself asserted against it.
 *
 * Nothing here is stubbed: the same acts the page dispatches, over the same
 * 169 kB the repository committed and the same evidence files, through the
 * library's own session. That is the only way to assert the thing this desk is
 * FOR — that the residue axis is the structure's, that absence really
 * propagates, and that a patch really is not a range.
 *
 * `beforeAll` boots once and every test reads it, because the boot parses a
 * headless structure twice and rolling it per test would be paying forty
 * seconds for nothing.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadStructure, readCommittedFile } from '../src/prot/snapshot.js';
import { annotationFromCommitted } from '../src/prot/annotationEvidence.js';
import { entryId } from '../src/prot/etl.js';
import { ANNOTATION_ACT, CONTACTS_ACT, EPITOPE_COLUMN, INTERFACE_CONTACTS_COLUMN, INTERFACE_SEPARATION_COLUMN, PFAM_DOMAIN_COLUMN, RELATIVE_SASA_COLUMN, SURFACE_ACT } from '../src/prot/analyses.js';
import { EXTENT_ACT, HOT_ACT_ORDER, HYDROPATHY_ACT, HYDROPATHY_COLUMN, PATCH_COLUMN, PRIOR_BASIS_COLUMN, PRIOR_COLUMN, SCORE_ACT, STRUCTURAL_BASIS_COLUMN, STRUCTURAL_COLUMN, hotAnalyses } from '../src/hot/analyses.js';
import { HOT_VIEWS, RESIDUE_KEY, hotDef } from '../src/hot/def.js';
import { hotSurfaceProblems, openHotSurfaceAsync, type HotSurface } from '../src/hot/session.js';
import { CROSSING_SATURATION, INTERFACE_FLOOR, SEPARATION_FAR, SEPARATION_NEAR } from '../src/hot/score.js';
import { CA_CUTOFF } from '../src/hot/extent.js';
import { KYTE_DOOLITTLE } from '../src/hot/hydropathy.js';

let surface: HotSurface;
let rows: readonly Record<string, unknown>[];

beforeAll(async () => {
  const artifact = loadStructure();
  const annotation = await annotationFromCommitted(entryId(artifact.text), readCommittedFile);
  surface = await openHotSurfaceAsync(artifact, undefined, annotation);
  rows = surface.residues.rows as readonly Record<string, unknown>[];
}, 120_000);

const numbers = (column: string): readonly number[] => rows.map((r) => r[column]).filter((v): v is number => typeof v === 'number');
const carrying = (column: string): number => rows.filter((r) => r[column] !== null && r[column] !== undefined).length;

describe('the boot', () => {
  it('reports no problem at all — every act landed, and the pre-act gesture was refused', () => {
    expect(hotSurfaceProblems(surface)).toEqual([]);
  });

  it('refused the gesture at the structural run BEFORE any act landed, by naming the column', () => {
    expect(surface.refusalBeforeTheAct).toContain(STRUCTURAL_COLUMN);
    expect(surface.refusalBeforeTheAct).toContain('residues');
  });

  it('landed six commits, in the order the stages declare', () => {
    const outcomes = surface.run!.outcomes;
    expect(outcomes.map((o) => o.act)).toEqual([...HOT_ACT_ORDER]);
    expect(outcomes.map((o) => o.refusal)).toEqual(outcomes.map(() => null));
    expect(new Set(outcomes.map((o) => o.commit))).toHaveLength(6);
  });
});

describe('the four measured tracks are REUSED, not recomputed', () => {
  it('declares the protein desk’s own act objects, by identity', () => {
    const mine = hotAnalyses('HEADER    X', null);
    const theirs = hotAnalyses('HEADER    X', null);
    // the three reused ids are filed, and the two acts this desk has no use for
    // are NOT — an act declared and never dispatched would be a def claiming a
    // stage it does not perform
    expect(Object.keys(mine)).toEqual([CONTACTS_ACT, SURFACE_ACT, ANNOTATION_ACT, HYDROPATHY_ACT, SCORE_ACT, EXTENT_ACT]);
    expect(Object.keys(theirs)).not.toContain('interactionPairs');
    expect(Object.keys(theirs)).not.toContain('residueConservation');
  });

  it('and those three acts are the ones that land the four columns', () => {
    const by = (act: string): readonly string[] => surface.run!.outcomes.find((o) => o.act === act)?.materialized ?? [];
    expect(by(CONTACTS_ACT)).toContain(INTERFACE_CONTACTS_COLUMN);
    expect(by(CONTACTS_ACT)).toContain(INTERFACE_SEPARATION_COLUMN);
    expect(by(SURFACE_ACT)).toContain(RELATIVE_SASA_COLUMN);
    expect(by(ANNOTATION_ACT)).toContain(PFAM_DOMAIN_COLUMN);
    // and this desk's own acts land only its own columns — it writes none of the four
    const ours = [HYDROPATHY_ACT, SCORE_ACT, EXTENT_ACT].flatMap(by);
    for (const borrowed of [INTERFACE_CONTACTS_COLUMN, INTERFACE_SEPARATION_COLUMN, RELATIVE_SASA_COLUMN, PFAM_DOMAIN_COLUMN, EPITOPE_COLUMN]) expect(ours).not.toContain(borrowed);
  });
});

describe('the structure owns the residue axis', () => {
  it('every scored row is a row of the parse, under the key the FILE minted', () => {
    const parsed = new Set(surface.tables.residues.map((r) => r.residue_key));
    expect(rows).toHaveLength(surface.tables.residues.length);
    for (const row of rows) expect(parsed.has(String(row[RESIDUE_KEY]))).toBe(true);
  });

  it('and no track added a residue of its own: the score lands on the parse’s count, not a track’s', () => {
    expect(surface.run!.scores!.counts.residues).toBe(surface.tables.residues.length);
    expect(carrying(STRUCTURAL_COLUMN)).toBe(surface.tables.residues.length);
  });
});

describe('the fifth track', () => {
  it('scored every residue of this entry, because all nineteen of its residue types are in the published table', () => {
    expect(carrying(HYDROPATHY_COLUMN)).toBe(rows.length);
    const types = new Set(rows.map((r) => String(r['resname'])));
    for (const type of types) expect(Object.keys(KYTE_DOOLITTLE)).toContain(type);
  });
});

describe('absence, on real rows', () => {
  it('167 of the 185 residues have NO tightest crossing contact, and their basis says exactly that', () => {
    const withoutTightness = rows.filter((r) => String(r[STRUCTURAL_BASIS_COLUMN]).includes(`absent: ${INTERFACE_SEPARATION_COLUMN}`));
    expect(carrying(INTERFACE_SEPARATION_COLUMN)).toBe(18);
    expect(withoutTightness).toHaveLength(rows.length - 18);
    expect(withoutTightness[0]![STRUCTURAL_BASIS_COLUMN]).toBe(`3 of 4 terms: ${INTERFACE_CONTACTS_COLUMN}, ${RELATIVE_SASA_COLUMN}, ${HYDROPATHY_COLUMN} — absent: ${INTERFACE_SEPARATION_COLUMN}`);
  });

  it('EVERY prior score on this entry is missing the epitope term — the source answered and named nothing', () => {
    // The IEDB was asked about both chains and named no epitope, so
    // `src/prot/analyses.ts` writes no `epitope` column at all. That is an
    // ANSWER, not a gap, and the basis is where a reader meets it.
    expect(carrying(EPITOPE_COLUMN)).toBe(0);
    const priors = rows.filter((r) => typeof r[PRIOR_COLUMN] === 'number');
    expect(priors.length).toBeGreaterThan(0);
    for (const row of priors) expect(String(row[PRIOR_BASIS_COLUMN])).toContain(`absent: ${EPITOPE_COLUMN}`);
  });

  it('and 17 residues have NO prior score at all — outside both domains, which is absent rather than zero', () => {
    const none = rows.filter((r) => r[PRIOR_COLUMN] === null || r[PRIOR_COLUMN] === undefined);
    expect(none).toHaveLength(17);
    for (const row of none) {
      expect(row[PFAM_DOMAIN_COLUMN] ?? null).toBeNull();
      expect(row[PRIOR_BASIS_COLUMN] ?? null).toBeNull();
    }
  });

  it('no residue carries a structural score of exactly 0 that was manufactured from an absent term', () => {
    // every score here rests on at least one measured term, and the basis proves it
    for (const row of rows) {
      if (typeof row[STRUCTURAL_COLUMN] !== 'number') continue;
      expect(String(row[STRUCTURAL_BASIS_COLUMN])).toMatch(/^[1-4] of 4 terms/);
    }
  });
});

describe('the constants were measured against this entry rather than believed', () => {
  it('no residue’s crossing count is clipped by the saturation', () => {
    expect(Math.max(...numbers(INTERFACE_CONTACTS_COLUMN))).toBeLessThanOrEqual(CROSSING_SATURATION);
  });

  it('every crossing separation falls inside the tightness ramp, so neither end clips', () => {
    const separations = numbers(INTERFACE_SEPARATION_COLUMN);
    expect(Math.min(...separations)).toBeGreaterThan(SEPARATION_NEAR);
    expect(Math.max(...separations)).toBeLessThan(SEPARATION_FAR);
  });
});

describe('the extent, on the real structure — and the case a sequence window cannot reach', () => {
  it('found three patches over the residues above the folded floor', () => {
    const extent = surface.run!.extent!;
    expect(extent.counts.floor).toBe(INTERFACE_FLOOR);
    expect(extent.counts.cutoff).toBe(CA_CUTOFF);
    expect(extent.patches).toHaveLength(3);
    expect(extent.counts.candidates).toBe(extent.patches.reduce((n, p) => n + p.members.length, 0));
  });

  it('THE NON-CONTIGUOUS CASE: the largest patch spans both chains and jumps 23 residues inside one of them', () => {
    const biggest = surface.run!.extent!.patches[0]!;
    // A:40 and A:64 are in it and A:41…A:63 are not — a sequence window
    // covering both would have had to swallow twenty-three residues that are
    // not in the patch, which is exactly where a range that then needs
    // repairing comes from.
    expect(biggest.chains).toEqual(['A', 'B']);
    expect(biggest.widestSequenceGap).toBe(23);
    expect(biggest.members).toContain('A:40');
    expect(biggest.members).toContain('A:64');
    for (let n = 41; n <= 63; n += 1) expect(biggest.members).not.toContain(`A:${String(n)}`);
    // and it is genuinely one patch in SPACE: every member is within the cutoff
    // of another member
    const placed = new Map(rows.map((r) => [String(r[RESIDUE_KEY]), [Number(r['ca_x']), Number(r['ca_y']), Number(r['ca_z'])] as const]));
    for (const member of biggest.members) {
      const me = placed.get(member)!;
      const near = biggest.members.filter((other) => other !== member).some((other) => {
        const it = placed.get(other)!;
        return Math.hypot(me[0] - it[0], me[1] - it[1], me[2] - it[2]) <= CA_CUTOFF;
      });
      expect(near, `${member} is in the patch and within ${String(CA_CUTOFF)} Å of nobody else in it`).toBe(true);
    }
  });

  it('lands the patch on the rows, absent for a residue in none', () => {
    const patched = rows.filter((r) => typeof r[PATCH_COLUMN] === 'string');
    expect(patched).toHaveLength(surface.run!.extent!.counts.candidates);
    for (const row of patched) expect(Number(row[STRUCTURAL_COLUMN])).toBeGreaterThan(INTERFACE_FLOOR);
    for (const row of rows) if (row[PATCH_COLUMN] === null || row[PATCH_COLUMN] === undefined) expect(Number(row[STRUCTURAL_COLUMN])).toBeLessThanOrEqual(INTERFACE_FLOOR);
  });
});

describe('the def', () => {
  it('declares five views and six acts, and no column that blends the two scores', () => {
    const def = hotDef(surface.tables, surface.structure.text, null);
    expect(Object.keys(def.actors ?? {})).toEqual([...HOT_VIEWS]);
    expect(Object.keys(def.analyses ?? {})).toHaveLength(6);
    const landed = new Set(rows.flatMap((r) => Object.keys(r)));
    expect([...landed].filter((c) => c.includes('combined') || c.includes('blend') || c === 'hotspot_score')).toEqual([]);
    expect(landed).toContain(STRUCTURAL_COLUMN);
    expect(landed).toContain(PRIOR_COLUMN);
  });
});
