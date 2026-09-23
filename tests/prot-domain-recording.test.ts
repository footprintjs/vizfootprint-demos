import { FlowChartExecutor } from 'footprintjs';
import { describe, expect, it, vi } from 'vitest';
import type { DomainEvidenceEvent, EvidenceBundle, PreparedStructureInput, StrategyDescriptor, SurfaceStrategyResult } from '../src/prot/domain/contracts.js';
import { createSurfaceMethodChart, exportSurfaceEvidence } from '../src/prot/domain/recording.js';

const INPUT: PreparedStructureInput = {
  pdbText: 'These are the structure bytes; they must not be copied into the recording.',
  entryId: 'TEST',
  sha256: 'abc123',
  residueKeys: ['A:1', 'A:2', 'A:3', 'A:4', 'A:5'],
  residues: ['ALA', 'ALA', 'MSE', 'UNK', 'ALA'].map((compId, index) => ({ residueKey: `A:${index + 1}`, compId })),
};
const STRATEGY: StrategyDescriptor = {
  id: 'test-surface',
  methodology: 'Injected deterministic surface fixture',
  implementation: { name: 'test-engine', version: '1.0.0' },
};
const REFERENCE = { compId: 'ALA', maxAsa: 121, referenceId: 'test-max-asa', referenceVersion: '1' };
const RESULT: SurfaceStrategyResult = {
  surface: {
    sasa: [121, 60.5, 60, null, 0],
    relative_sasa: [1, 0.5, null, null, 0],
    counts: { probeSize: 1.4, spherePoints: 960, nonPolymer: false, traceOnly: false, engineTotal: 241.5, landed: 4, noValue: 1, noReference: 1, buried: 1 },
  },
  normalization: [REFERENCE, REFERENCE, null, null, REFERENCE],
};
const exportRun = (captureId = 'run-1', timestamp = '2026-01-01T00:00:00.000Z'): EvidenceBundle =>
  exportSurfaceEvidence(INPUT, STRATEGY, RESULT, captureId, timestamp);
const measurement = (bundle: EvidenceBundle, name: string, residue: string): DomainEvidenceEvent => {
  const event = bundle.events.find((event) => event.measurement === name && event.residueKey === residue);
  expect(event).toBeDefined();
  return event!;
};

describe('the shared method recording', () => {
  it('records input identity, calls the injected method once and validates through a tracked result read', async () => {
    const execute = vi.fn(async () => RESULT);
    const validate = vi.fn();
    const chart = createSurfaceMethodChart({ ...STRATEGY, execute }, INPUT, validate);
    const executor = new FlowChartExecutor(chart, { writeProvenance: 'reads-prefix' });
    await executor.run();
    const snapshot = executor.getSnapshot();
    expect(execute).toHaveBeenCalledExactlyOnceWith(INPUT);
    expect(validate).toHaveBeenCalledExactlyOnceWith(RESULT);
    expect(snapshot.sharedState.result).toEqual(RESULT);
    expect(snapshot.sharedState.surface).toEqual(RESULT.surface);
    expect(snapshot.sharedState.normalization).toEqual(RESULT.normalization);
    expect(snapshot.sharedState.input).not.toHaveProperty('pdbText');
    expect(snapshot.sharedState.strategy).toEqual(STRATEGY);
    const evidence = exportSurfaceEvidence(INPUT, STRATEGY, RESULT, 'recorded-capture', '2026-01-01T00:00:00.000Z', snapshot.runId);
    expect(evidence.events.find((event) => event.kind === 'method')).toMatchObject({ runtimeRunId: snapshot.runId });
    expect(JSON.stringify(snapshot)).not.toContain(INPUT.pdbText);
    expect(snapshot.commitLog.map((commit) => commit.stageId)).toEqual(['surface-input', 'surface-method', 'surface-validate']);
    const method = snapshot.commitLog.find((commit) => commit.stageId === 'surface-method')!;
    expect(method.trace.length).toBeGreaterThan(0);
    for (const write of method.trace) expect(write.readKeys).toEqual(expect.arrayContaining(['input', 'strategy']));
    const validated = snapshot.commitLog.find((commit) => commit.stageId === 'surface-validate')!;
    expect(validated.trace.length).toBeGreaterThan(0);
    for (const write of validated.trace) expect(write.readKeys).toContain('methodResult');
  });

  it('does not publish a validated result when validation refuses it', async () => {
    const chart = createSurfaceMethodChart({ ...STRATEGY, execute: async () => RESULT }, INPUT, () => {
      throw new Error('The selected method returned an invalid residue axis.');
    });
    const executor = new FlowChartExecutor(chart);
    await expect(executor.run()).rejects.toThrow('invalid residue axis');
    expect(executor.getSnapshot().sharedState).not.toHaveProperty('result');
  });

  it('prevents an injected method from changing the recorded residue axis or component identities', async () => {
    const execute = vi.fn(async (received: PreparedStructureInput) => {
      expect(Object.isFrozen(received)).toBe(true);
      expect(() => (received.residueKeys as string[]).push('invented:99')).toThrow(TypeError);
      expect(() => { (received.residues[0] as { compId: string }).compId = 'INVENTED'; }).toThrow(TypeError);
      return RESULT;
    });
    const executor = new FlowChartExecutor(createSurfaceMethodChart({ ...STRATEGY, execute }, INPUT, () => {}));
    await executor.run();
    expect(execute).toHaveBeenCalledOnce();
    expect(executor.getSnapshot().sharedState.input).toMatchObject({ residueKeys: INPUT.residueKeys, residues: INPUT.residues });
  });

  it('propagates method failure without calling validation or inventing measurements', async () => {
    const validate = vi.fn();
    const chart = createSurfaceMethodChart({ ...STRATEGY, execute: async () => { throw new Error('scientific engine failed'); } }, INPUT, validate);
    const executor = new FlowChartExecutor(chart);
    await expect(executor.run()).rejects.toThrow('scientific engine failed');
    expect(validate).not.toHaveBeenCalled();
    expect(executor.getSnapshot().sharedState).not.toHaveProperty('methodResult');
  });
});

describe('surface evidence dependencies', () => {
  it('connects every relative measurement to its area and real denominator, and areas through the method to the bytes', () => {
    const bundle = exportRun();
    const byId = new Map(bundle.events.map((event) => [event.id, event]));
    expect(byId.size).toBe(bundle.events.length);
    for (const relation of bundle.relations) {
      expect(byId.has(relation.from)).toBe(true);
      expect(byId.has(relation.to)).toBe(true);
      expect(relation.basis).toBe('observed');
    }
    const area = measurement(bundle, 'sasa', 'A:2');
    const relative = measurement(bundle, 'relative_sasa', 'A:2');
    const parents = bundle.relations.filter((relation) => relation.from === relative.id);
    expect(parents).toHaveLength(2);
    expect(parents.every((relation) => relation.type === 'derived-from')).toBe(true);
    expect(parents.map((relation) => byId.get(relation.to))).toEqual(expect.arrayContaining([
      area,
      expect.objectContaining({ kind: 'reference', compId: 'ALA', value: 121, referenceVersion: '1' }),
    ]));
    const areaParent = bundle.relations.find((relation) => relation.from === area.id)!;
    expect(areaParent.type).toBe('uses-input');
    const method = byId.get(areaParent.to)!;
    expect(method).toMatchObject({ kind: 'method', implementation: STRATEGY.implementation, parameters: { numberOfSpherePoints: 960 } });
    const methodParent = bundle.relations.find((relation) => relation.from === method.id)!;
    expect(methodParent.type).toBe('uses-input');
    expect(byId.get(methodParent.to)).toMatchObject({ kind: 'source', sha256: INPUT.sha256 });
    expect(method.traceCoverage).toEqual({ level: 'method-boundary-and-normalization', internalAtomSampling: 'not-instrumented', dependencyCompleteness: 'not-established', statisticalIndependence: 'not-established' });
    expect(bundle.events.filter((event) => event.kind === 'reference')).toHaveLength(1);
  });

  it('keeps missing measurements absent with reasons while preserving a real buried zero', () => {
    const bundle = exportRun();
    expect(measurement(bundle, 'sasa', 'A:4')).toMatchObject({ value: null, absenceReason: 'area-not-computed' });
    expect(measurement(bundle, 'relative_sasa', 'A:4')).toMatchObject({ value: null, absenceReason: 'area-not-computed' });
    expect(measurement(bundle, 'relative_sasa', 'A:3')).toMatchObject({ value: null, absenceReason: 'no-normalization-reference' });
    expect(measurement(bundle, 'sasa', 'A:5')).toMatchObject({ value: 0, absenceReason: null });
    expect(measurement(bundle, 'relative_sasa', 'A:5')).toMatchObject({ value: 0, absenceReason: null });
    expect(bundle.events.some((event) => event.kind === 'reference' && event.compId === 'MSE')).toBe(false);
    expect(JSON.parse(JSON.stringify(bundle))).toEqual(bundle);
  });

  it('does not claim an observed denominator dependency when a missing area prevented normalization', () => {
    const input = { ...INPUT, residueKeys: ['A:1'], residues: [INPUT.residues[0]!] };
    const result: SurfaceStrategyResult = {
      surface: {
        sasa: [null],
        relative_sasa: [null],
        counts: { ...RESULT.surface.counts, engineTotal: 0, landed: 0, noValue: 1, noReference: 0, buried: 0 },
      },
      normalization: [REFERENCE],
    };
    const bundle = exportSurfaceEvidence(input, STRATEGY, result, 'missing-area', '2026-01-01T00:00:00.000Z');
    const area = measurement(bundle, 'sasa', 'A:1');
    const relative = measurement(bundle, 'relative_sasa', 'A:1');
    expect(relative).toMatchObject({ value: null, absenceReason: 'area-not-computed' });
    expect(bundle.events.find((event) => event.kind === 'reference')).toMatchObject({ value: REFERENCE.maxAsa });
    expect(bundle.relations.filter((relation) => relation.from === relative.id)).toEqual([
      expect.objectContaining({ to: area.id, type: 'derived-from', basis: 'observed' }),
    ]);
  });

  it('shares identical source/reference events across captures, without conflicting payloads or shared measurement IDs', () => {
    const first = exportRun();
    const second = exportRun('run-2', '2027-02-02T00:00:00.000Z');
    const merged = new Map<string, DomainEvidenceEvent>();
    const duplicates: DomainEvidenceEvent[] = [];
    for (const event of [...first.events, ...second.events]) {
      if (merged.has(event.id)) {
        expect(event).toEqual(merged.get(event.id));
        duplicates.push(event);
      }
      merged.set(event.id, event);
    }
    expect(duplicates.map((event) => event.kind).sort()).toEqual(['reference', 'source']);
    for (const relation of [...first.relations, ...second.relations]) {
      expect(merged.has(relation.from)).toBe(true);
      expect(merged.has(relation.to)).toBe(true);
    }
    expect(measurement(first, 'sasa', 'A:1').id).not.toBe(measurement(second, 'sasa', 'A:1').id);
  });

  it('changes reference identity when its version or value changes, and keeps structure identity independent of the selected axis', () => {
    const initial = exportRun();
    const changed: SurfaceStrategyResult = { ...RESULT, normalization: RESULT.normalization.map((reference) => reference === null ? null : { ...reference, referenceVersion: '2', maxAsa: 122 }) };
    const next = exportSurfaceEvidence(INPUT, STRATEGY, changed, 'run-2', '2027-02-02T00:00:00.000Z');
    expect(next.events.find((event) => event.kind === 'reference')!.id).not.toBe(initial.events.find((event) => event.kind === 'reference')!.id);
    const subsetInput = { ...INPUT, residueKeys: ['A:5'], residues: [INPUT.residues[4]!] };
    const subsetResult: SurfaceStrategyResult = { surface: { ...RESULT.surface, sasa: [0], relative_sasa: [0] }, normalization: [REFERENCE] };
    const subset = exportSurfaceEvidence(subsetInput, STRATEGY, subsetResult, 'run-3', '2028-03-03T00:00:00.000Z');
    expect(subset.events.find((event) => event.kind === 'source')).toEqual(initial.events.find((event) => event.kind === 'source'));
  });
});
