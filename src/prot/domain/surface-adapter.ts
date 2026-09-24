import { FlowChartExecutor } from 'footprintjs';
import type {
  DependencyInspectionPort, ObservationRecordingPort, PreparedStructureInput, StrategyDescriptor, SurfaceAdapter,
  SurfaceStrategy, SurfaceStrategyResult,
} from './contracts.js';
import { prepareStructureInput } from './structure-input.js';
import { createMolstarSurfaceStrategy } from './surface-strategies.js';
import { createSurfaceMethodChart, exportSurfaceEvidence } from './recording.js';

const present = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Validate at the common boundary, so every strategy obeys the same contract. */
export function validateSurfaceResult(input: PreparedStructureInput, result: SurfaceStrategyResult): void {
  if (result === null || typeof result !== 'object' || result.surface === null || typeof result.surface !== 'object') {
    throw new Error('Invalid surface strategy result');
  }
  const { surface, normalization } = result;
  const size = input.residueKeys.length;
  if (![surface.sasa, surface.relative_sasa, normalization].every((array) => Array.isArray(array) && array.length === size)) {
    throw new Error('Surface output must align with the requested residue keys');
  }
  let noValue = 0;
  let noReference = 0;
  let buried = 0;
  for (let index = 0; index < size; index += 1) {
    const area = surface.sasa[index];
    const relative = surface.relative_sasa[index];
    const reference = normalization[index];
    if ((area !== null && !nonnegative(area)) || (relative !== null && !nonnegative(relative))) {
      throw new Error('Surface values must be finite nonnegative numbers or null');
    }
    if (reference !== null && (reference === undefined || typeof reference !== 'object' ||
        reference.compId !== input.residues[index]!.compId || !nonnegative(reference.maxAsa) || reference.maxAsa === 0 ||
        !present(reference.referenceId) || !present(reference.referenceVersion))) {
      throw new Error('Invalid normalization reference for the requested residue');
    }
    if (area === null) {
      noValue += 1;
      if (relative !== null) throw new Error('A missing area cannot have a relative value');
    } else {
      if (area === 0) buried += 1;
      if (reference === null) {
        noReference += 1;
        if (relative !== null) throw new Error('A relative value requires its normalization reference');
      } else {
        const expected = area! / reference!.maxAsa;
        if (!Number.isFinite(expected) || relative === null || Math.abs(relative! - expected) > 1e-10 * Math.max(1, expected)) {
          throw new Error('Relative surface does not equal area divided by its recorded normalization reference');
        }
      }
    }
  }
  const counts = surface.counts;
  if (counts === null || typeof counts !== 'object' || !nonnegative(counts.probeSize) || counts.probeSize === 0 ||
      !Number.isSafeInteger(counts.spherePoints) || counts.spherePoints < 1 || !nonnegative(counts.engineTotal) ||
      typeof counts.nonPolymer !== 'boolean' || typeof counts.traceOnly !== 'boolean' ||
      counts.noValue !== noValue || counts.noReference !== noReference || counts.buried !== buried || counts.landed !== size - noValue) {
    throw new Error('Surface counts or sampling parameters are inconsistent with the output');
  }
}

export function createSurfaceAdapter<T = unknown>(options: {
  readonly strategies?: readonly SurfaceStrategy[];
  readonly dependencyInspection?: DependencyInspectionPort<T>;
  readonly observationRecording?: ObservationRecordingPort;
} = {}): SurfaceAdapter<T> {
  const supplied = options.strategies ?? [createMolstarSurfaceStrategy(), createMolstarSurfaceStrategy({ id: 'molstar-960', sampling: { numberOfSpherePoints: 960 } })];
  if (supplied.length === 0) throw new Error('At least one surface strategy is required');
  const registered = new Map<string, { strategy: SurfaceStrategy; descriptor: StrategyDescriptor }>();
  for (const strategy of supplied) {
    if (!strategy || !present(strategy.id) || !present(strategy.methodology) || !present(strategy.implementation?.name) ||
        !present(strategy.implementation?.version) || typeof strategy.execute !== 'function') throw new Error('Invalid surface strategy');
    if (registered.has(strategy.id)) throw new Error(`Duplicate surface strategy: ${strategy.id}`);
    const descriptor = Object.freeze({ id: strategy.id, methodology: strategy.methodology, implementation: Object.freeze({ ...strategy.implementation }) });
    registered.set(strategy.id, { descriptor, strategy: Object.freeze({ ...descriptor, execute: strategy.execute.bind(strategy) }) });
  }
  const inspection = options.dependencyInspection;
  const observationRecording = options.observationRecording;
  return Object.freeze({
    strategies: Object.freeze([...registered.values()].map(({ descriptor }) => descriptor)),
    async run(request) {
      const selected = registered.get(request?.strategyId);
      if (!selected) throw new Error(`Unknown surface strategy: ${String(request?.strategyId)}`);
      const input = await prepareStructureInput(request.structure);
      const chart = createSurfaceMethodChart(selected.strategy, input, (result) => validateSurfaceResult(input, result));
      const executor = new FlowChartExecutor(chart, { writeProvenance: 'reads-prefix' });
      await executor.run();
      const recording = executor.getSnapshot();
      const result = recording.sharedState['result'] as SurfaceStrategyResult;
      // A failed/incomplete chart must never be exported as successful evidence.
      validateSurfaceResult(input, result);
      // Footprint runtime IDs are process-local; evidence can be combined across hosts.
      const captureId = globalThis.crypto.randomUUID();
      const evidence = exportSurfaceEvidence(input, selected.descriptor, result, captureId, new Date().toISOString(), recording.runId, observationRecording);
      const { pdbText: _text, ...reference } = input;
      return {
        ...result, captureId, strategy: selected.descriptor, input: reference, evidence, recording,
        traceCoverage: {
          level: 'method-boundary-and-normalization' as const, internalAtomSampling: 'not-instrumented' as const,
          dependencyCompleteness: 'not-established' as const, statisticalIndependence: 'not-established' as const,
        },
      };
    },
    async inspectDependencies(bundle, evidenceIds) {
      if (!inspection) throw new Error('No DependencyInspectionPort was injected');
      return inspection.analyzeDependencies(bundle, evidenceIds);
    },
  } satisfies SurfaceAdapter<T>);
}
