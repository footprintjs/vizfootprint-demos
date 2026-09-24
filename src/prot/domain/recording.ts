import { flowChart, type RunnableFlowChart } from 'footprintjs';
import type {
  DomainEvidenceEvent,
  DomainEvidenceRelation,
  EvidenceBundle,
  NormalizationReference,
  ObservationRecordingPort,
  PreparedStructureInput,
  SurfaceObservationInput,
  StrategyDescriptor,
  SurfaceStrategy,
  SurfaceStrategyResult,
} from './contracts.js';

type InputReference = Omit<PreparedStructureInput, 'pdbText'>;

interface SurfaceMethodState {
  input: InputReference;
  strategy: StrategyDescriptor;
  methodResult: SurfaceStrategyResult;
  result: SurfaceStrategyResult;
  surface: SurfaceStrategyResult['surface'];
  normalization: SurfaceStrategyResult['normalization'];
}

const descriptorOf = (strategy: StrategyDescriptor): StrategyDescriptor => ({
  id: strategy.id,
  methodology: strategy.methodology,
  implementation: { ...strategy.implementation },
});

/**
 * The shared recording boundary. Scientific methods remain injected and the
 * PDB bytes stay in the closure; only their identity and the selected row axis
 * enter the record. Reads between stages are tracked by footprintjs.
 *
 * This records method inputs, outputs and validation, not the internal atom
 * sampling performed inside a scientific engine.
 */
export function createSurfaceMethodChart(
  strategy: SurfaceStrategy,
  input: PreparedStructureInput,
  validate: (result: SurfaceStrategyResult) => void,
): RunnableFlowChart {
  const pdbText = input.pdbText;
  const reference: InputReference = {
    entryId: input.entryId,
    sha256: input.sha256,
    residueKeys: [...input.residueKeys],
    residues: input.residues.map((residue) => ({ ...residue })),
  };
  const descriptor = descriptorOf(strategy);
  return flowChart<SurfaceMethodState>(
    'Record the structure identity and selected surface strategy',
    (scope) => {
      scope.$setValue('input', reference);
      scope.$setValue('strategy', descriptor);
    },
    'surface-input',
  )
    .addFunction('Execute the selected surface method', async (scope) => {
      const recordedInput = scope.$getValue('input') as InputReference;
      const recordedStrategy = scope.$getValue('strategy') as StrategyDescriptor;
      if (recordedStrategy.id !== strategy.id) throw new Error('The recorded surface strategy changed before execution.');
      // Consume the recorded identity/axis, but never give an injected method
      // mutable aliases into the state whose provenance it is meant to keep.
      const prepared: PreparedStructureInput = Object.freeze({
        entryId: recordedInput.entryId,
        sha256: recordedInput.sha256,
        residueKeys: Object.freeze([...recordedInput.residueKeys]),
        residues: Object.freeze(recordedInput.residues.map((residue) => Object.freeze({ ...residue }))),
        pdbText,
      });
      const found = await strategy.execute(prepared);
      scope.$setValue('methodResult', found);
    }, 'surface-method')
    .addFunction('Validate the surface output and its normalization references', (scope) => {
      const found = scope.$getValue('methodResult') as SurfaceStrategyResult;
      validate(found);
      scope.$setValue('result', found);
      scope.$setValue('surface', found.surface);
      scope.$setValue('normalization', found.normalization);
    }, 'surface-validate')
    .build();
}

// Shared content events have no run timestamp: an identical ID must describe
// identical content when several captures are combined. Epoch is a declared
// identity marker, never a claimed acquisition/publication time.
const CONTENT_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const contentTime = { timestampMeaning: 'Content identity marker; acquisition time is not recorded.' };
const part = (value: string | number): string => encodeURIComponent(String(value));
const referenceIdentity = (reference: NormalizationReference): string =>
  `surface-reference:${[reference.referenceId, reference.referenceVersion, reference.compId, reference.maxAsa].map(part).join(':')}`;

/**
 * Export validated method-boundary evidence through a structural interface.
 * It requires no EvidenceFootprint runtime, agent or model. A host may pass the
 * result directly to its injected dependency inspector. With an observation
 * recording port, measurement declarations become standard library-created
 * observations; without one the original export format is preserved.
 *
 * Relations record observed reuse and normalization inputs. They establish
 * neither exhaustive dependencies nor statistical independence.
 */
export function exportSurfaceEvidence(
  input: PreparedStructureInput,
  strategy: StrategyDescriptor,
  result: SurfaceStrategyResult,
  captureId: string,
  timestamp: string,
  runtimeRunId?: string,
  observationRecording?: ObservationRecordingPort,
): EvidenceBundle {
  const structureId = `surface-structure:sha256:${input.sha256}`;
  const methodId = `surface-method:${part(captureId)}`;
  const implementation = { ...strategy.implementation };
  const computationSource = { artifact: `${implementation.name}@${implementation.version}`, origin: 'surface-computation' };
  const counts = result.surface.counts;
  const events: DomainEvidenceEvent[] = [{
    id: structureId,
    captureId: structureId,
    timestamp: CONTENT_TIMESTAMP,
    kind: 'source',
    source: { artifact: `sha256:${input.sha256}`, origin: 'pdb-input' },
    sha256: input.sha256,
    encoding: 'UTF-8',
    ...contentTime,
  }, {
    id: methodId,
    captureId,
    timestamp,
    kind: 'method',
    source: computationSource,
    strategyId: strategy.id,
    runtimeRunId,
    methodology: strategy.methodology,
    implementation,
    entryId: input.entryId,
    residueKeys: [...input.residueKeys],
    parameters: {
      probeSize: counts.probeSize,
      numberOfSpherePoints: counts.spherePoints,
      nonPolymer: counts.nonPolymer,
      traceOnly: counts.traceOnly,
    },
    counts: { ...counts },
    traceCoverage: {
      level: 'method-boundary-and-normalization',
      internalAtomSampling: 'not-instrumented',
      dependencyCompleteness: 'not-established',
      statisticalIndependence: 'not-established',
    },
  }];
  const relations: DomainEvidenceRelation[] = [];
  const connect = (from: string, to: string, type: DomainEvidenceRelation['type'], reason: string): void => {
    relations.push({ id: `surface-relation:${part(from)}:${part(type)}:${part(to)}`, from, to, type, basis: 'observed', reason });
  };
  connect(methodId, structureId, 'uses-input', 'The selected method received these exact structure bytes, identified by SHA-256.');
  const references = new Set<string>();
  for (const [index, residueKey] of input.residueKeys.entries()) {
    const area = result.surface.sasa[index]!;
    const relative = result.surface.relative_sasa[index]!;
    const reference = result.normalization[index]!;
    const compId = input.residues[index]!.compId;
    const areaId = `surface-sasa:${part(captureId)}:${part(residueKey)}`;
    const relativeId = `surface-relative-sasa:${part(captureId)}:${part(residueKey)}`;
    events.push({
      id: areaId,
      captureId,
      timestamp,
      kind: 'measurement',
      source: computationSource,
      measurement: 'sasa',
      residueKey,
      compId,
      value: area,
      unit: 'angstrom-squared',
      absenceReason: area === null ? 'area-not-computed' : null,
    });
    connect(areaId, methodId, 'uses-input', 'This residue area was returned by this invocation of the selected surface method.');
    events.push({
      id: relativeId,
      captureId,
      timestamp,
      kind: 'measurement',
      source: computationSource,
      measurement: 'relative_sasa',
      residueKey,
      compId,
      value: relative,
      unit: 'fraction-of-reference-area',
      absenceReason: relative === null ? (area === null ? 'area-not-computed' : 'no-normalization-reference') : null,
    });
    connect(relativeId, areaId, 'derived-from', 'The relative surface uses this residue area as its numerator; an absent area stays absent.');
    if (reference !== null) {
      const referenceId = referenceIdentity(reference);
      if (!references.has(referenceId)) {
        references.add(referenceId);
        events.push({
          id: referenceId,
          captureId: referenceId,
          timestamp: CONTENT_TIMESTAMP,
          kind: 'reference',
          source: { artifact: reference.referenceId, origin: 'normalization-reference' },
          compId: reference.compId,
          referenceId: reference.referenceId,
          referenceVersion: reference.referenceVersion,
          value: reference.maxAsa,
          unit: 'angstrom-squared',
          ...contentTime,
        });
      }
      if (area !== null) {
        connect(relativeId, referenceId, 'derived-from', 'The relative surface uses this component-specific maximum area as its denominator.');
      }
    }
  }
  if (!observationRecording) return { events, relations };

  // Preserve the domain's declarations while the library owns generic record
  // construction/validation. Group once so export stays linear in residue count.
  const byMeasurement = new Map<string, DomainEvidenceRelation[]>();
  for (const relation of relations) {
    const group = byMeasurement.get(relation.from) ?? [];
    group.push(relation);
    byMeasurement.set(relation.from, group);
  }
  const recordedRelations = relations.filter((relation) => relation.from === methodId);
  const recordedEvents = events.map((event): DomainEvidenceEvent => {
    if (event.kind !== 'measurement') return event;
    const declared = byMeasurement.get(event.id) ?? [];
    const request: SurfaceObservationInput = {
      id: event.id, captureId, timestamp: new Date(timestamp).toISOString(), source: { ...computationSource },
      observation: {
        subjectId: `surface-residue:sha256:${input.sha256}:${part(event.residueKey as string)}`,
        quantity: event.measurement as string,
        value: event.value as number | null,
        unit: event.unit as string,
        absenceReason: event.absenceReason as string | null,
        method: {
          id: strategy.methodology, version: implementation.version,
          parameters: {
            implementation: implementation.name, strategyId: strategy.id,
            probeSize: counts.probeSize, numberOfSpherePoints: counts.spherePoints,
            nonPolymer: counts.nonPolymer, traceOnly: counts.traceOnly,
          },
        },
        // Input bytes are known; a preparation protocol/version was not recorded.
        preparation: null,
        ...(runtimeRunId === undefined ? {} : { runtime: { runId: runtimeRunId, stageId: 'surface-method' } }),
      },
      dependencies: declared.map(({ id, to, type, basis, reason }) => ({ id, evidenceId: to, type, basis, reason })),
    };
    // Keep the expected declaration detached: an injected function must not
    // rewrite its input and then present the changed facts as our result.
    const expected = structuredClone(request);
    const returned = observationRecording.createObservation(request);
    if (returned && typeof (returned as unknown as { then?: unknown }).then === 'function') {
      Promise.resolve(returned).catch(() => {});
      throw new TypeError('ObservationRecordingPort must be synchronous');
    }
    // Validate the detached snapshot we will export, rather than reading a
    // mutable object (or accessor) again after checking it.
    const recorded = structuredClone(returned);
    if (!recorded || !preservesDeclaration(recorded.event, {
      id: expected.id, captureId: expected.captureId, timestamp: expected.timestamp,
      kind: 'observation', source: expected.source,
      observation: { ...expected.observation, schemaVersion: 1 },
    }) || !Array.isArray(recorded.relations) || recorded.relations.length !== declared.length) {
      throw new Error('ObservationRecordingPort changed a surface observation declaration');
    }
    for (const relation of declared) {
      const matches = recorded.relations.filter((candidate) => candidate.id === relation.id);
      if (matches.length !== 1 || !preservesDeclaration(matches[0], relation)) {
        throw new Error('ObservationRecordingPort changed a surface dependency declaration');
      }
      recordedRelations.push({ ...matches[0]!, type: relation.type, basis: relation.basis });
    }
    return { ...recorded.event, residueKey: event.residueKey, compId: event.compId };
  });
  return { events: recordedEvents, relations: recordedRelations };
}

/** Compare declared facts only; generic observation schema validation belongs to the injected library. */
function preservesDeclaration(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
  return Object.entries(expected).every(([key, value]) =>
    Object.hasOwn(actual, key) && preservesDeclaration((actual as Record<string, unknown>)[key], value));
}
