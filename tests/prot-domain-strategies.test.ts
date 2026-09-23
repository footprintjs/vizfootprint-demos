import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { PLUGIN_VERSION } from 'molstar/lib/mol-plugin/version.js';
import { entryId, protTables } from '../src/prot/etl.js';
import { headlessEntry } from '../src/prot/molstar.js';
import { loadStructureText } from '../src/prot/snapshot.js';
import { protSurface, type ResidueSurface, type SurfaceSampling } from '../src/prot/surface.js';
import { createMolstarSurfaceStrategy } from '../src/prot/domain/surface-strategies.js';
import type { PreparedStructureInput, SurfaceStrategyResult } from '../src/prot/domain/contracts.js';

function input(pdbText = loadStructureText()): PreparedStructureInput {
  const residues = protTables(pdbText).residues;
  return {
    pdbText,
    entryId: entryId(pdbText),
    sha256: createHash('sha256').update(pdbText).digest('hex'),
    residueKeys: residues.map((residue) => residue.residue_key),
    residues: residues.map((residue) => ({ residueKey: residue.residue_key, compId: residue.resname })),
  };
}

describe('Mol* surface strategy configurations', () => {
  const prepared = input();
  const defaults = createMolstarSurfaceStrategy();
  const options = { numberOfSpherePoints: 960 };
  const dense = createMolstarSurfaceStrategy({ id: 'molstar-960', sampling: options });
  options.numberOfSpherePoints = 12;
  let direct: ResidueSurface;
  let standard: SurfaceStrategyResult;
  let sampled: SurfaceStrategyResult;

  beforeAll(async () => {
    const entry = await headlessEntry(prepared.pdbText, prepared.entryId);
    direct = await protSurface(entry, prepared.residueKeys);
    standard = await defaults.execute(prepared);
    sampled = await dense.execute(prepared);
  });

  it('preserves the existing default calculation exactly and records the installed engine version', () => {
    expect(standard.surface).toEqual(direct);
    expect(defaults).toMatchObject({
      id: 'molstar-defaults',
      methodology: 'shrake-rupley',
      implementation: { name: 'molstar', version: PLUGIN_VERSION },
    });
    expect(standard.surface.counts).toMatchObject({ probeSize: 1.4, spherePoints: 92, nonPolymer: false, traceOnly: false });
    expect(standard.surface.counts.engineTotal).toBeCloseTo(9150.4798, 3);
  });

  it('actually changes sampling and measurements while keeping the same methodology', () => {
    expect(sampled.surface.counts).toMatchObject({ probeSize: 1.4, spherePoints: 960, nonPolymer: false, traceOnly: false });
    expect(sampled.surface.sasa).not.toEqual(standard.surface.sasa);
    expect(sampled.surface.counts.engineTotal).not.toBe(standard.surface.counts.engineTotal);
    expect(dense.methodology).toBe(defaults.methodology);
    expect(dense.implementation).toEqual(defaults.implementation);
  });

  it('retains its configuration when the original options object changes', () => {
    expect(options.numberOfSpherePoints).toBe(12);
    expect(sampled.surface.counts.spherePoints).toBe(960);
    expect(Object.isFrozen(dense)).toBe(true);
    expect(Object.isFrozen(dense.implementation)).toBe(true);
  });

  it('exports the actual normalization denominator for each selected residue', async () => {
    const { MaxAsa } = await import('molstar/lib/mol-model-props/computed/accessible-surface-area/shrake-rupley/common.js');
    expect(standard.normalization).toHaveLength(prepared.residueKeys.length);
    for (const [index, reference] of standard.normalization.entries()) {
      expect(reference).toMatchObject({
        compId: prepared.residues[index]!.compId,
        maxAsa: MaxAsa[prepared.residues[index]!.compId],
        referenceId: 'doi:10.1371/journal.pone.0080635',
        referenceVersion: `molstar-${PLUGIN_VERSION}`,
      });
      expect(standard.surface.relative_sasa[index]).toBeCloseTo(standard.surface.sasa[index]! / reference!.maxAsa, 9);
    }
  });

  it('aligns normalization and measurements to a requested subset and order', async () => {
    const keys = ['A:63', 'B:1', 'A:85'];
    const selected = await defaults.execute({ ...prepared, residueKeys: keys });
    expect(selected.surface.sasa).toEqual(keys.map((key) => direct.sasa[prepared.residueKeys.indexOf(key)]));
    expect(selected.normalization.map((reference) => reference!.compId)).toEqual(
      keys.map((key) => prepared.residues.find((residue) => residue.residueKey === key)!.compId),
    );
  });

  it('keeps unknown normalization references absent instead of substituting alanine', async () => {
    const text = prepared.pdbText.split('\n').map((line) =>
      line.startsWith('ATOM  ') && line.slice(17, 20) === 'GLY' ? `${line.slice(0, 17)}MSE${line.slice(20)}` : line,
    ).join('\n');
    const modified = input(text);
    const key = modified.residues.find((residue) => residue.compId === 'MSE')!.residueKey;
    const result = await defaults.execute({ ...modified, residueKeys: [key] });
    expect(result.normalization).toEqual([null]);
    expect(result.surface.relative_sasa).toEqual([null]);
  });

  it('treats undefined overrides as omitted engine defaults', async () => {
    const entry = await headlessEntry(prepared.pdbText, prepared.entryId);
    expect(await protSurface(entry, prepared.residueKeys, { probeSize: undefined, numberOfSpherePoints: undefined })).toEqual(direct);
  });

  it('passes all supported overrides through and reports their effective values', async () => {
    const entry = await headlessEntry(prepared.pdbText, prepared.entryId);
    const actual = await protSurface(entry, prepared.residueKeys, { probeSize: 4, numberOfSpherePoints: 120, nonPolymer: true, traceOnly: true });
    expect(actual.counts).toMatchObject({ probeSize: 4, spherePoints: 120, nonPolymer: true, traceOnly: true });
    expect(actual.sasa).not.toEqual(direct.sasa);
  });

  it.each([
    { probeSize: 0 }, { probeSize: -1 }, { probeSize: Number.NaN }, { probeSize: Number.POSITIVE_INFINITY },
    { numberOfSpherePoints: 0 }, { numberOfSpherePoints: -1 }, { numberOfSpherePoints: 1.5 }, { numberOfSpherePoints: Number.POSITIVE_INFINITY },
    { nonPolymer: 'false' }, { traceOnly: 1 }, { spherePoints: 960 },
  ])('rejects invalid configuration before computing: %j', (sampling) => {
    expect(() => createMolstarSurfaceStrategy({ sampling: sampling as SurfaceSampling })).toThrow();
  });

  it('also validates overrides on direct kernel calls', async () => {
    const entry = await headlessEntry(prepared.pdbText, prepared.entryId);
    await expect(protSurface(entry, prepared.residueKeys, { probeSize: -1 })).rejects.toThrow('probeSize');
  });

  it('requires a non-empty strategy identity', () => {
    expect(() => createMolstarSurfaceStrategy({ id: ' ' })).toThrow('id');
  });
});
