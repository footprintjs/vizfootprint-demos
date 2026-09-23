import { createHash } from 'node:crypto';
import { FlowChartExecutor } from 'footprintjs';
import { describe, expect, it, vi } from 'vitest';
import {
  createSurfaceAdapter,
  prepareStructureInput,
  structureSha256,
  type EvidenceBundle,
  type PreparedStructureInput,
  type StructureInput,
  type SurfaceStrategy,
  type SurfaceStrategyResult,
} from '../src/prot/domain/index.js';
import { loadStructureText } from '../src/prot/snapshot.js';
import { headlessEntry } from '../src/prot/molstar.js';
import { protSurface } from '../src/prot/surface.js';

const TEXT = loadStructureText();
const KEYS = ['A:63', 'A:85', 'B:1'];
const STRUCTURE = { pdbText: TEXT, residueKeys: KEYS };
const REPEATED_SEGMENT = TEXT.split('\n').filter((line) => line.startsWith('ATOM  ') && line.slice(21, 26) === 'A   1').join('\n');

function resultFor(input: PreparedStructureInput): SurfaceStrategyResult {
  return {
    surface: {
      sasa: input.residueKeys.map(() => 50),
      relative_sasa: input.residueKeys.map(() => 0.5),
      counts: {
        probeSize: 1.4, spherePoints: 92, nonPolymer: false, traceOnly: false,
        engineTotal: 50 * input.residueKeys.length, landed: input.residueKeys.length,
        noValue: 0, noReference: 0, buried: 0,
      },
    },
    normalization: input.residues.map(({ compId }) => ({ compId, maxAsa: 100, referenceId: 'test:maximum-area', referenceVersion: '1' })),
  };
}

function strategy(id = 'fixture', execute: SurfaceStrategy['execute'] = async (input) => resultFor(input)): SurfaceStrategy {
  return { id, methodology: 'test-method', implementation: { name: 'test-engine', version: '1' }, execute };
}

function changeFirstAtom(start: number, end: number, replacement: string): string {
  let changed = false;
  return TEXT.split('\n').map((line) => {
    if (changed || !line.startsWith('ATOM  ')) return line;
    changed = true;
    return `${line.slice(0, start)}${replacement}${line.slice(end)}`;
  }).join('\n');
}

describe('the opt-in surface adapter', () => {
  it('uses the existing scientific kernel unchanged at the default strategy', async () => {
    const adapter = createSurfaceAdapter();
    expect(adapter.strategies.map(({ id }) => id)).toEqual(['molstar-defaults', 'molstar-960']);
    const run = await adapter.run({ structure: STRUCTURE, strategyId: 'molstar-defaults' });
    const entry = await headlessEntry(TEXT, run.input.entryId);
    expect(run.surface).toEqual(await protSurface(entry, KEYS));
    expect(run.input.residueKeys).toEqual(KEYS);
    expect(run.strategy.methodology).toBe('shrake-rupley');
    expect(run.traceCoverage).toEqual({
      level: 'method-boundary-and-normalization', internalAtomSampling: 'not-instrumented',
      dependencyCompleteness: 'not-established', statisticalIndependence: 'not-established',
    });
  });

  it('dispatches only the explicitly selected custom strategy', async () => {
    const first = vi.fn(async (input: PreparedStructureInput) => resultFor(input));
    const selected = vi.fn(async (input: PreparedStructureInput) => resultFor(input));
    const adapter = createSurfaceAdapter({ strategies: [strategy('first', first), strategy('selected', selected)] });
    const run = await adapter.run({ structure: STRUCTURE, strategyId: 'selected' });
    expect(first).not.toHaveBeenCalled();
    expect(selected).toHaveBeenCalledOnce();
    expect(selected.mock.calls[0]![0]).toMatchObject({ pdbText: TEXT, residueKeys: KEYS });
    expect(run.strategy.id).toBe('selected');
  });

  it('rejects an unknown strategy without executing a fallback', async () => {
    const execute = vi.fn(async (input: PreparedStructureInput) => resultFor(input));
    const adapter = createSurfaceAdapter({ strategies: [strategy('known', execute)] });
    await expect(adapter.run({ structure: STRUCTURE, strategyId: 'missing' })).rejects.toThrow('Unknown surface strategy: missing');
    expect(execute).not.toHaveBeenCalled();
  });

  it('requires unambiguous, complete strategy registrations', () => {
    expect(() => createSurfaceAdapter({ strategies: [] })).toThrow('At least one');
    expect(() => createSurfaceAdapter({ strategies: [strategy(), strategy()] })).toThrow('Duplicate surface strategy: fixture');
    expect(() => createSurfaceAdapter({ strategies: [strategy(' ')] })).toThrow('Invalid surface strategy');
    expect(() => createSurfaceAdapter({ strategies: [{ ...strategy(), implementation: { name: '', version: '1' } }] })).toThrow('Invalid surface strategy');
  });

  it('rejects a selected method failure without running another method', async () => {
    const failure = new Error('scientific engine could not compute this structure');
    const fallback = vi.fn(async (input: PreparedStructureInput) => resultFor(input));
    const adapter = createSurfaceAdapter({ strategies: [
      strategy('broken', async () => { throw failure; }), strategy('other', fallback),
    ] });
    await expect(adapter.run({ structure: STRUCTURE, strategyId: 'broken' })).rejects.toThrow(failure.message);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('keeps absent, zero and above-one relative measurements distinct', async () => {
    const adapter = createSurfaceAdapter({ strategies: [strategy('mixed', async (input) => {
      const valid = resultFor(input);
      return {
        surface: {
          sasa: [null, 0, 150], relative_sasa: [null, 0, 1.5],
          counts: { ...valid.surface.counts, engineTotal: 150, landed: 2, noValue: 1, buried: 1 },
        },
        normalization: valid.normalization,
      };
    })] });
    const run = await adapter.run({ structure: STRUCTURE, strategyId: 'mixed' });
    expect(run.surface.sasa).toEqual([null, 0, 150]);
    expect(run.surface.relative_sasa).toEqual([null, 0, 1.5]);
    expect(run.evidence.events.filter((event) => event.measurement === 'relative_sasa').map((event) => event.value)).toEqual([null, 0, 1.5]);
  });

  it('accepts a missing normalization reference only with an absent relative measurement', async () => {
    const adapter = createSurfaceAdapter({ strategies: [strategy('unreferenced', async (input) => {
      const valid = resultFor(input);
      return {
        surface: { ...valid.surface, relative_sasa: [null], counts: { ...valid.surface.counts, noReference: 1 } },
        normalization: [null],
      };
    })] });
    const run = await adapter.run({ structure: { ...STRUCTURE, residueKeys: ['A:63'] }, strategyId: 'unreferenced' });
    expect(run.surface.sasa).toEqual([50]);
    expect(run.surface.relative_sasa).toEqual([null]);
    expect(run.evidence.events.find((event) => event.measurement === 'relative_sasa')?.absenceReason).toBe('no-normalization-reference');
  });

  it.each<[string, (valid: SurfaceStrategyResult) => SurfaceStrategyResult]>([
    ['NaN area', (valid) => ({ ...valid, surface: { ...valid.surface, sasa: [Number.NaN] } })],
    ['negative area', (valid) => ({ ...valid, surface: { ...valid.surface, sasa: [-1] } })],
    ['infinite relative area', (valid) => ({ ...valid, surface: { ...valid.surface, relative_sasa: [Number.POSITIVE_INFINITY] } })],
    ['negative relative area', (valid) => ({ ...valid, surface: { ...valid.surface, relative_sasa: [-0.5] } })],
    ['misaligned area', (valid) => ({ ...valid, surface: { ...valid.surface, sasa: [] } })],
    ['misaligned normalization', (valid) => ({ ...valid, normalization: [] })],
    ['incorrect ratio', (valid) => ({ ...valid, surface: { ...valid.surface, relative_sasa: [0.75] } })],
    ['missing ratio with reference', (valid) => ({ ...valid, surface: { ...valid.surface, relative_sasa: [null] } })],
    ['relative value without area', (valid) => ({ ...valid, surface: { ...valid.surface, sasa: [null] } })],
    ['relative value without reference', (valid) => ({ ...valid, normalization: [null] })],
    ['wrong residue reference', (valid) => ({ ...valid, normalization: [{ ...valid.normalization[0]!, compId: 'XXX' }] })],
    ['zero normalization denominator', (valid) => ({ ...valid, normalization: [{ ...valid.normalization[0]!, maxAsa: 0 }] })],
    ['overflowing normalization quotient', (valid) => ({
      surface: { ...valid.surface, sasa: [Number.MAX_VALUE], counts: { ...valid.surface.counts, engineTotal: Number.MAX_VALUE } },
      normalization: [{ ...valid.normalization[0]!, maxAsa: Number.MIN_VALUE }],
    })],
    ['unnamed normalization source', (valid) => ({ ...valid, normalization: [{ ...valid.normalization[0]!, referenceId: '' }] })],
    ['incorrect landed count', (valid) => ({ ...valid, surface: { ...valid.surface, counts: { ...valid.surface.counts, landed: 0 } } })],
    ['incorrect missing count', (valid) => ({ ...valid, surface: { ...valid.surface, counts: { ...valid.surface.counts, noValue: 1 } } })],
    ['incorrect unreferenced count', (valid) => ({ ...valid, surface: { ...valid.surface, counts: { ...valid.surface.counts, noReference: 1 } } })],
    ['incorrect buried count', (valid) => ({ ...valid, surface: { ...valid.surface, counts: { ...valid.surface.counts, buried: 1 } } })],
    ['invalid engine total', (valid) => ({ ...valid, surface: { ...valid.surface, counts: { ...valid.surface.counts, engineTotal: Number.NaN } } })],
    ['zero probe radius', (valid) => ({ ...valid, surface: { ...valid.surface, counts: { ...valid.surface.counts, probeSize: 0 } } })],
    ['fractional sphere count', (valid) => ({ ...valid, surface: { ...valid.surface, counts: { ...valid.surface.counts, spherePoints: 1.5 } } })],
  ])('rejects %s at the shared boundary', async (_label, invalidate) => {
    const adapter = createSurfaceAdapter({ strategies: [strategy('invalid', async (input) => invalidate(resultFor(input)))] });
    await expect(adapter.run({ structure: { ...STRUCTURE, residueKeys: ['A:63'] }, strategyId: 'invalid' })).rejects.toThrow();
  });

  it('forwards dependency inspection to the injected port without changing either argument', async () => {
    const report = { related: true, source: 'host-inspector' };
    const analyzeDependencies = vi.fn(async (_bundle: EvidenceBundle, _evidenceIds: readonly string[]) => report);
    const adapter = createSurfaceAdapter({ strategies: [strategy()], dependencyInspection: { analyzeDependencies } });
    const run = await adapter.run({ structure: STRUCTURE, strategyId: 'fixture' });
    const ids = run.evidence.events.filter((event) => event.measurement === 'relative_sasa').map((event) => event.id);
    expect(await adapter.inspectDependencies(run.evidence, ids)).toBe(report);
    expect(analyzeDependencies).toHaveBeenCalledExactlyOnceWith(run.evidence, ids);
    expect(analyzeDependencies.mock.calls[0]![0]).toBe(run.evidence);
    expect(analyzeDependencies.mock.calls[0]![1]).toBe(ids);
  });

  it('requires a dependency port only when inspection is requested', async () => {
    const adapter = createSurfaceAdapter({ strategies: [strategy()] });
    const run = await adapter.run({ structure: STRUCTURE, strategyId: 'fixture' });
    expect(run.surface.sasa).toHaveLength(KEYS.length);
    await expect(adapter.inspectDependencies(run.evidence, [])).rejects.toThrow('No DependencyInspectionPort was injected');
  });

  it('isolates overlapping runs and exports serializable recordings without raw PDB text', async () => {
    let releaseFirst!: () => void;
    const firstMayFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const adapter = createSurfaceAdapter({ strategies: [strategy('concurrent', async (input) => {
      if (input.residueKeys[0] === 'A:63') await firstMayFinish;
      else releaseFirst();
      return resultFor(input);
    })] });
    const results = await Promise.all(['A:63', 'B:1'].map((key) => adapter.run({
      strategyId: 'concurrent', structure: { ...STRUCTURE, residueKeys: [key] },
    })));
    expect(new Set(results.map((run) => run.captureId)).size).toBe(2);
    for (const [index, run] of results.entries()) {
      const selectedKey = ['A:63', 'B:1'][index]!;
      expect(run.captureId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(run.evidence.events.find((event) => event.kind === 'method')).toMatchObject({
        captureId: run.captureId, runtimeRunId: run.recording.runId,
      });
      expect(run.recording.sharedState.input).toMatchObject({ residueKeys: [selectedKey] });
      expect(run.evidence.events.filter((event) => event.kind === 'measurement').every((event) => event.residueKey === selectedKey)).toBe(true);
      const serialized = JSON.stringify(run);
      expect(JSON.parse(serialized).captureId).toBe(run.captureId);
      expect(serialized).not.toContain('pdbText');
      expect(serialized).not.toContain('ATOM  ');
    }
  });

  it('keeps evidence captures distinct when separate runtimes reuse a local run ID', async () => {
    const getSnapshot = FlowChartExecutor.prototype.getSnapshot;
    // Model a collision between two processes, whose local counters can start alike.
    const snapshot = vi.spyOn(FlowChartExecutor.prototype, 'getSnapshot').mockImplementation(function (
      this: FlowChartExecutor, options?: { redact?: boolean },
    ) {
      return { ...getSnapshot.call(this, options), runId: 'same-local-runtime-id' };
    });
    try {
      const adapters = [createSurfaceAdapter({ strategies: [strategy()] }), createSurfaceAdapter({ strategies: [strategy()] })];
      const [first, second] = await Promise.all(adapters.map((adapter) => adapter.run({ structure: STRUCTURE, strategyId: 'fixture' })));
      expect(first!.recording.runId).toBe(second!.recording.runId);
      expect(first!.captureId).not.toBe(second!.captureId);
      const firstIds = new Set(first!.evidence.events.filter((event) => event.captureId === first!.captureId).map((event) => event.id));
      const secondIds = second!.evidence.events.filter((event) => event.captureId === second!.captureId).map((event) => event.id);
      expect(firstIds.size).toBeGreaterThan(0);
      expect(secondIds.every((id) => !firstIds.has(id))).toBe(true);
      for (const run of [first!, second!]) {
        expect(run.evidence.events.find((event) => event.kind === 'method')?.runtimeRunId).toBe('same-local-runtime-id');
      }
    } finally {
      snapshot.mockRestore();
    }
  });
});

describe('structure input identity and row selection', () => {
  it('hashes the exact UTF-8 input and honors a verified reordered selection', async () => {
    const digest = createHash('sha256').update(TEXT, 'utf8').digest('hex');
    const keys = ['B:1', 'A:63'];
    const input = await prepareStructureInput({ pdbText: TEXT, residueKeys: keys, expectedSha256: digest.toUpperCase() });
    expect(input.sha256).toBe(digest);
    expect(input.residueKeys).toEqual(keys);
    expect(input.residues.map(({ residueKey }) => residueKey)).toEqual(keys);
    keys.reverse();
    expect(input.residueKeys).toEqual(['B:1', 'A:63']);
    expect(await structureSha256(`${TEXT}\n`)).not.toBe(digest);
    expect(await structureSha256('Å')).toBe(createHash('sha256').update('Å', 'utf8').digest('hex'));
  });

  it.each<[string, StructureInput, string]>([
    ['empty text', { pdbText: ' \n ' }, 'nonempty PDB'],
    ['non-PDB text', { pdbText: 'This is not a coordinate file.' }, 'no supported polymer residues'],
    ['empty selection', { ...STRUCTURE, residueKeys: [] }, 'At least one residue'],
    ['duplicate selected keys', { ...STRUCTURE, residueKeys: ['A:63', 'A:63'] }, 'Duplicate residue keys'],
    ['unknown selected key', { ...STRUCTURE, residueKeys: ['A:999999'] }, 'Unknown residue key'],
    ['malformed digest', { ...STRUCTURE, expectedSha256: 'abc' }, '64-character SHA-256'],
    ['wrong digest', { ...STRUCTURE, expectedSha256: '0'.repeat(64) }, 'does not match'],
    ['nonfinite coordinate', { pdbText: changeFirstAtom(30, 38, '     NaN') }, 'finite coordinates'],
    ['missing coordinate', { pdbText: changeFirstAtom(38, 46, '        ') }, 'finite coordinates'],
    ['fractional residue number', { pdbText: changeFirstAtom(22, 26, ' 1.5') }, 'residue number'],
    ['insertion code', { pdbText: changeFirstAtom(26, 27, 'A') }, 'Insertion-coded'],
    ['multiple models', { pdbText: `MODEL        1\n${TEXT}\nENDMDL\nMODEL        2\n${TEXT}\nENDMDL\n` }, 'Multiple PDB models'],
    ['residue identity reused across TER segments', { pdbText: `${TEXT}\nTER\n${REPEATED_SEGMENT}\n` }, 'residue'],
    ['conflicting component names at one residue identity', { pdbText: changeFirstAtom(17, 20, 'XXX') }, 'residue'],
  ])('rejects %s before calling the scientific method', async (_label, structure, message) => {
    const execute = vi.fn(async (input: PreparedStructureInput) => resultFor(input));
    const adapter = createSurfaceAdapter({ strategies: [strategy('fixture', execute)] });
    await expect(adapter.run({ structure, strategyId: 'fixture' })).rejects.toThrow(message);
    expect(execute).not.toHaveBeenCalled();
  });
});
