import { describe, expect, it, vi } from 'vitest';
import {
  createSurfaceAdapter,
  exportSurfaceEvidence,
  type DomainEvidenceEvent,
  type EvidenceBundle,
  type ObservationRecordingPort,
  type PreparedStructureInput,
  type StrategyDescriptor,
  type SurfaceObservationInput,
  type SurfaceStrategyResult,
} from '../src/prot/domain/index.js';
import { loadStructureText } from '../src/prot/snapshot.js';

type Recorded = ReturnType<ObservationRecordingPort['createObservation']>;
type Observation = SurfaceObservationInput['observation'] & { schemaVersion: 1 };

/** A record factory for delegation tests only. It performs no schema validation. */
function recordFactory(input: SurfaceObservationInput): Recorded {
  const { dependencies, ...copied } = structuredClone(input);
  return {
    event: { ...copied, kind: 'observation', observation: { ...copied.observation, schemaVersion: 1 } },
    relations: dependencies.map(({ evidenceId, ...relation }) => ({ ...relation, from: copied.id, to: evidenceId })),
  };
}

const INPUT: PreparedStructureInput = {
  pdbText: 'Synthetic prepared structure; this test does not run a scientific engine.',
  entryId: 'TEST',
  sha256: 'a'.repeat(64),
  residueKeys: ['A:1', 'A:2', 'A:3', 'A:4'],
  residues: ['GLY', 'ALA', 'SER', 'MSE'].map((compId, index) => ({ residueKey: `A:${index + 1}`, compId })),
};
const STRATEGY: StrategyDescriptor = {
  id: 'synthetic-sampling', methodology: 'synthetic-surface-method',
  implementation: { name: 'synthetic-engine', version: '2.3' },
};
const RESULT: SurfaceStrategyResult = {
  surface: {
    sasa: [150, 0, null, 25], relative_sasa: [1.5, 0, null, null],
    counts: { probeSize: 1.4, spherePoints: 960, nonPolymer: false, traceOnly: false, engineTotal: 175, landed: 3, noValue: 1, noReference: 1, buried: 1 },
  },
  normalization: INPUT.residues.map(({ compId }) => compId === 'MSE' ? null : {
    compId, maxAsa: 100, referenceId: 'synthetic-reference', referenceVersion: '1',
  }),
};
const TIMESTAMP = '2026-01-01T00:00:00.000Z';
const observationOf = (event: DomainEvidenceEvent): Observation => event.observation as Observation;
const exportRun = (port?: ObservationRecordingPort, prepared = INPUT, captureId = 'capture-1', runtimeRunId: string | undefined = 'runtime-1'): EvidenceBundle =>
  exportSurfaceEvidence(prepared, STRATEGY, RESULT, captureId, TIMESTAMP, runtimeRunId, port);
const findObservation = (bundle: EvidenceBundle, quantity: string, residueKey: string): DomainEvidenceEvent => {
  const event = bundle.events.find((candidate) => candidate.kind === 'observation' && candidate.residueKey === residueKey && observationOf(candidate).quantity === quantity);
  expect(event).toBeDefined();
  return event!;
};

describe('the injected observation recording boundary', () => {
  it('delegates every area and relative value once, with explicit scientific provenance declarations', () => {
    const createObservation = vi.fn(recordFactory);
    const result = exportRun({ createObservation });
    expect(createObservation).toHaveBeenCalledTimes(2 * INPUT.residueKeys.length);
    expect(result.events.filter((event) => event.kind === 'observation')).toHaveLength(8);
    const declarations = createObservation.mock.calls.map(([request]) => request);
    expect(declarations.map((request) => request.observation.quantity)).toEqual([
      'sasa', 'relative_sasa', 'sasa', 'relative_sasa', 'sasa', 'relative_sasa', 'sasa', 'relative_sasa',
    ]);
    for (const request of declarations) {
      expect(request).toMatchObject({ captureId: 'capture-1', timestamp: TIMESTAMP, source: { artifact: 'synthetic-engine@2.3', origin: 'surface-computation' } });
      expect(request.observation.method).toEqual({
        id: STRATEGY.methodology, version: STRATEGY.implementation.version,
        parameters: {
          implementation: STRATEGY.implementation.name, strategyId: STRATEGY.id,
          probeSize: 1.4, numberOfSpherePoints: 960, nonPolymer: false, traceOnly: false,
        },
      });
      expect(request.observation.preparation).toBeNull();
      expect(request.observation.runtime).toEqual({ runId: 'runtime-1', stageId: 'surface-method' });
      expect(request.observation).not.toHaveProperty('schemaVersion');
      expect(request.observation).not.toHaveProperty('adapter');
      expect(request.dependencies.length).toBeGreaterThan(0);
    }
    for (const event of result.events.filter((candidate) => candidate.kind === 'observation')) {
      expect(event).toHaveProperty('residueKey');
      expect(event).toHaveProperty('compId');
      expect(observationOf(event).schemaVersion).toBe(1);
      for (const legacyField of ['measurement', 'value', 'unit', 'absenceReason']) expect(event).not.toHaveProperty(legacyField);
    }
    expect(JSON.stringify(result)).not.toContain(INPUT.pdbText);
  });

  it('preserves a buried zero, above-one relative values, and explicit reasons for both types of absence', () => {
    const result = exportRun({ createObservation: recordFactory });
    expect(observationOf(findObservation(result, 'relative_sasa', 'A:1'))).toMatchObject({ value: 1.5, unit: 'fraction-of-reference-area', absenceReason: null });
    expect(observationOf(findObservation(result, 'sasa', 'A:2'))).toMatchObject({ value: 0, unit: 'angstrom-squared', absenceReason: null });
    expect(observationOf(findObservation(result, 'relative_sasa', 'A:2'))).toMatchObject({ value: 0, absenceReason: null });
    expect(observationOf(findObservation(result, 'sasa', 'A:3'))).toMatchObject({ value: null, absenceReason: 'area-not-computed' });
    expect(observationOf(findObservation(result, 'relative_sasa', 'A:3'))).toMatchObject({ value: null, absenceReason: 'area-not-computed' });
    expect(observationOf(findObservation(result, 'sasa', 'A:4'))).toMatchObject({ value: 25, absenceReason: null });
    expect(observationOf(findObservation(result, 'relative_sasa', 'A:4'))).toMatchObject({ value: null, absenceReason: 'no-normalization-reference' });
  });

  it('keeps the existing graph unchanged and declares denominator use only when normalization occurred', () => {
    const createObservation = vi.fn(recordFactory);
    const recorded = exportRun({ createObservation });
    const legacy = exportRun();
    expect(recorded.relations).toEqual(legacy.relations);
    expect(recorded.events.map((event) => event.id)).toEqual(legacy.events.map((event) => event.id));
    expect(recorded.events.filter((event) => event.kind !== 'observation')).toEqual(legacy.events.filter((event) => event.kind !== 'measurement'));
    for (const [request] of createObservation.mock.calls) {
      expect(request.dependencies).toEqual(legacy.relations.filter((relation) => relation.from === request.id).map(({ to, from: _from, ...relation }) => ({ ...relation, evidenceId: to })));
    }
    const relative = findObservation(recorded, 'relative_sasa', 'A:1');
    const dependencies = recorded.relations.filter((relation) => relation.from === relative.id);
    expect(dependencies).toHaveLength(2);
    expect(dependencies.every((relation) => relation.type === 'derived-from' && relation.basis === 'observed')).toBe(true);
    expect(dependencies.map((relation) => recorded.events.find((event) => event.id === relation.to)?.kind).sort()).toEqual(['observation', 'reference']);
    for (const residue of ['A:3', 'A:4']) {
      const absentRelative = findObservation(recorded, 'relative_sasa', residue);
      expect(recorded.relations.filter((relation) => relation.from === absentRelative.id)).toEqual([
        expect.objectContaining({ to: findObservation(recorded, 'sasa', residue).id, type: 'derived-from' }),
      ]);
    }
    // A real reference may be recorded even though the absent numerator prevented its use.
    expect(recorded.events.some((event) => event.kind === 'reference' && event.compId === 'SER')).toBe(true);
    expect(recorded.events.some((event) => event.kind === 'reference' && event.compId === 'MSE')).toBe(false);
  });

  it('retains the exact legacy measurement envelope when the port is omitted', () => {
    const result = exportRun();
    expect(result.events.filter((event) => event.kind === 'observation')).toEqual([]);
    expect(result.events.filter((event) => event.kind === 'measurement')).toEqual(INPUT.residueKeys.flatMap((residueKey, index) => [
      {
        id: `surface-sasa:capture-1:${encodeURIComponent(residueKey)}`, captureId: 'capture-1', timestamp: TIMESTAMP,
        kind: 'measurement', source: { artifact: 'synthetic-engine@2.3', origin: 'surface-computation' },
        measurement: 'sasa', residueKey, compId: INPUT.residues[index]!.compId,
        value: RESULT.surface.sasa[index], unit: 'angstrom-squared', absenceReason: index === 2 ? 'area-not-computed' : null,
      },
      {
        id: `surface-relative-sasa:capture-1:${encodeURIComponent(residueKey)}`, captureId: 'capture-1', timestamp: TIMESTAMP,
        kind: 'measurement', source: { artifact: 'synthetic-engine@2.3', origin: 'surface-computation' },
        measurement: 'relative_sasa', residueKey, compId: INPUT.residues[index]!.compId,
        value: RESULT.surface.relative_sasa[index], unit: 'fraction-of-reference-area',
        absenceReason: index === 2 ? 'area-not-computed' : index === 3 ? 'no-normalization-reference' : null,
      },
    ]));
  });

  it('scopes subjects to structure bytes and residue keys while retaining subject identity across captures', () => {
    const port = { createObservation: recordFactory };
    const first = exportRun(port);
    const repeated = exportRun(port, INPUT, 'capture-2');
    const changed = exportRun(port, { ...INPUT, sha256: 'b'.repeat(64) }, 'capture-3');
    const firstSubject = observationOf(findObservation(first, 'sasa', 'A:1')).subjectId;
    expect(firstSubject).toBe(`surface-residue:sha256:${INPUT.sha256}:A%3A1`);
    expect(observationOf(findObservation(first, 'relative_sasa', 'A:1')).subjectId).toBe(firstSubject);
    expect(observationOf(findObservation(first, 'sasa', 'A:2')).subjectId).not.toBe(firstSubject);
    expect(observationOf(findObservation(repeated, 'sasa', 'A:1')).subjectId).toBe(firstSubject);
    expect(observationOf(findObservation(changed, 'sasa', 'A:1')).subjectId).not.toBe(firstSubject);
  });

  it('omits the runtime reference when no existing run is supplied', () => {
    const createObservation = vi.fn(recordFactory);
    exportSurfaceEvidence(INPUT, STRATEGY, RESULT, 'capture-1', TIMESTAMP, undefined, { createObservation });
    for (const [request] of createObservation.mock.calls) expect(request.observation).not.toHaveProperty('runtime');
  });

  it.each<[string, (recorded: Recorded) => void]>([
    ['event identity', (recorded) => { recorded.event.id = 'rewritten'; }],
    ['capture identity', (recorded) => { recorded.event.captureId = 'rewritten'; }],
    ['timestamp', (recorded) => { recorded.event.timestamp = '2027-01-01T00:00:00.000Z'; }],
    ['event kind', (recorded) => { recorded.event.kind = 'measurement'; }],
    ['source', (recorded) => { recorded.event.source.artifact = 'rewritten'; }],
    ['subject', (recorded) => { observationOf(recorded.event).subjectId = 'rewritten'; }],
    ['quantity', (recorded) => { observationOf(recorded.event).quantity = 'rewritten'; }],
    ['value', (recorded) => { observationOf(recorded.event).value = 999; }],
    ['unit', (recorded) => { observationOf(recorded.event).unit = 'rewritten'; }],
    ['absence reason', (recorded) => { observationOf(recorded.event).absenceReason = 'rewritten'; }],
    ['scientific method', (recorded) => { observationOf(recorded.event).method.id = 'rewritten'; }],
    ['method version', (recorded) => { observationOf(recorded.event).method.version = 'rewritten'; }],
    ['effective sampling', (recorded) => { observationOf(recorded.event).method.parameters.numberOfSpherePoints = 123; }],
    ['runtime', (recorded) => { observationOf(recorded.event).runtime!.stageId = 'rewritten'; }],
    ['edge target', (recorded) => { recorded.relations[0]!.to = 'rewritten'; }],
    ['edge source', (recorded) => { recorded.relations[0]!.from = 'rewritten'; }],
    ['edge identity', (recorded) => { recorded.relations[0]!.id = 'rewritten'; }],
    ['edge basis', (recorded) => { recorded.relations[0]!.basis = 'inferred'; }],
    ['edge type', (recorded) => { recorded.relations[0]!.type = 'copy-of'; }],
    ['edge reason', (recorded) => { recorded.relations[0]!.reason = 'rewritten'; }],
  ])('rejects a port that rewrites the declared %s', (_label, rewrite) => {
    const createObservation = vi.fn((request: SurfaceObservationInput): Recorded => {
      const recorded = recordFactory(request);
      rewrite(recorded);
      return recorded;
    });
    expect(() => exportRun({ createObservation })).toThrow('declaration');
    expect(createObservation).toHaveBeenCalledOnce();
  });

  it('rejects rewriting the input before returning it as the recorded fact', () => {
    const before = structuredClone(RESULT);
    const createObservation = vi.fn((request: SurfaceObservationInput): Recorded => {
      request.observation.value = 999;
      request.observation.method.parameters.numberOfSpherePoints = 123;
      request.dependencies[0]!.evidenceId = 'rewritten';
      return recordFactory(request);
    });
    expect(() => exportRun({ createObservation })).toThrow('declaration');
    expect(RESULT).toEqual(before);
  });

  it('checks and exports the same detached value when a port returns an unstable getter', () => {
    let reads = 0;
    const createObservation = (request: SurfaceObservationInput): Recorded => {
      const recorded = recordFactory(request);
      if (request.observation.quantity === 'sasa' && request.observation.value === 150) {
        Object.defineProperty(recorded.event.observation, 'value', {
          enumerable: true,
          get() { reads += 1; return reads === 1 ? 150 : 999; },
        });
      }
      return recorded;
    };
    const exported = exportRun({ createObservation });
    expect(reads).toBe(1);
    expect(observationOf(findObservation(exported, 'sasa', 'A:1')).value).toBe(150);
    expect(reads).toBe(1);
  });

  it('detaches exported facts and edges from later changes to a port-owned result', () => {
    const returned: Recorded[] = [];
    const createObservation = (request: SurfaceObservationInput): Recorded => {
      const recorded = recordFactory(request);
      returned.push(recorded);
      return recorded;
    };
    const exported = exportRun({ createObservation });
    const before = structuredClone(exported);
    for (const recorded of returned) {
      observationOf(recorded.event).value = 999;
      recorded.event.source.artifact = 'changed-after-return';
      recorded.relations[0]!.to = 'changed-after-return';
    }
    expect(exported).toEqual(before);
  });

  it.each(['missing', 'extra', 'duplicate'] as const)('rejects %s dependency edges from the port', (change) => {
    const createObservation = (request: SurfaceObservationInput): Recorded => {
      const recorded = recordFactory(request);
      if (change === 'missing') return { ...recorded, relations: [] };
      if (change === 'extra') return { ...recorded, relations: [...recorded.relations, { ...recorded.relations[0]!, id: 'extra' }] };
      if (recorded.relations.length === 2) return { ...recorded, relations: [recorded.relations[0]!, recorded.relations[0]!] };
      return recorded;
    };
    expect(() => exportRun({ createObservation })).toThrow('declaration');
  });

  it('propagates recorder errors without emitting a legacy fallback', () => {
    const failure = new Error('synthetic observation recorder failed');
    const createObservation = vi.fn((): Recorded => { throw failure; });
    expect(() => exportRun({ createObservation })).toThrow(failure);
    expect(createObservation).toHaveBeenCalledOnce();
  });

  it('rejects asynchronous recording and handles a rejected promise without a second unhandled failure', async () => {
    const failure = new Error('synthetic async recorder failure');
    for (const execute of [async (request: SurfaceObservationInput) => recordFactory(request), async (_request: SurfaceObservationInput): Promise<Recorded> => { throw failure; }]) {
      const createObservation = vi.fn(execute);
      expect(() => exportRun({ createObservation } as unknown as ObservationRecordingPort)).toThrow('synchronous');
      expect(createObservation).toHaveBeenCalledOnce();
    }
    await new Promise((resolve) => setImmediate(resolve));
  });
});

describe('surface adapter with an observation recorder', () => {
  const structure = { pdbText: loadStructureText(), residueKeys: ['A:63', 'A:85', 'B:1'] };
  const scientificFixture = (prepared: PreparedStructureInput): SurfaceStrategyResult => ({
    surface: {
      sasa: [150, 0, null], relative_sasa: [1.5, 0, null],
      counts: { ...RESULT.surface.counts, engineTotal: 150, landed: 2, noValue: 1, noReference: 0, buried: 1 },
    },
    normalization: prepared.residues.map(({ compId }) => ({ compId, maxAsa: 100, referenceId: 'synthetic-reference', referenceVersion: '1' })),
  });

  it('runs the selected science once and preserves scientific columns, counts, normalization and trace', async () => {
    let computed!: SurfaceStrategyResult;
    const execute = vi.fn(async (prepared: PreparedStructureInput) => { computed = scientificFixture(prepared); return computed; });
    const createObservation = vi.fn(recordFactory);
    const adapter = createSurfaceAdapter({ strategies: [{ ...STRATEGY, execute }], observationRecording: { createObservation } });
    const run = await adapter.run({ structure, strategyId: STRATEGY.id });
    expect(execute).toHaveBeenCalledOnce();
    expect(createObservation).toHaveBeenCalledTimes(6);
    expect(run.surface).toEqual(computed.surface);
    expect(run.normalization).toEqual(computed.normalization);
    expect(run.recording.sharedState.result).toEqual(computed);
    expect(run.recording.commitLog.map((commit) => commit.stageId)).toEqual(['surface-input', 'surface-method', 'surface-validate']);
    for (const [request] of createObservation.mock.calls) {
      expect(request.captureId).toBe(run.captureId);
      expect(request.observation.runtime).toEqual({ runId: run.recording.runId, stageId: 'surface-method' });
    }
    expect(run.evidence.events.filter((event) => event.kind === 'measurement')).toEqual([]);
    expect(run.traceCoverage.dependencyCompleteness).toBe('not-established');
  });

  it('rejects scientific output before invoking the observation recorder', async () => {
    const execute = vi.fn(async (prepared: PreparedStructureInput) => {
      const result = scientificFixture(prepared);
      return { ...result, surface: { ...result.surface, relative_sasa: [0.5, 0, null] } };
    });
    const createObservation = vi.fn(recordFactory);
    const adapter = createSurfaceAdapter({ strategies: [{ ...STRATEGY, execute }], observationRecording: { createObservation } });
    await expect(adapter.run({ structure, strategyId: STRATEGY.id })).rejects.toThrow('Relative surface');
    expect(execute).toHaveBeenCalledOnce();
    expect(createObservation).not.toHaveBeenCalled();
  });

  it('propagates an injected recording failure without retrying another scientific strategy', async () => {
    const execute = vi.fn(async (prepared: PreparedStructureInput) => scientificFixture(prepared));
    const fallback = vi.fn(async (prepared: PreparedStructureInput) => scientificFixture(prepared));
    const createObservation = vi.fn((): Recorded => { throw new Error('observation recording failed'); });
    const adapter = createSurfaceAdapter({
      strategies: [{ ...STRATEGY, execute }, { ...STRATEGY, id: 'fallback', execute: fallback }],
      observationRecording: { createObservation },
    });
    await expect(adapter.run({ structure, strategyId: STRATEGY.id })).rejects.toThrow('observation recording failed');
    expect(execute).toHaveBeenCalledOnce();
    expect(createObservation).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });
});
