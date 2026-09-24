import type { RuntimeSnapshot } from 'footprintjs';
import type { ResidueSurface } from '../surface.js';

/** The exact UTF-8 text supplied to the existing PDB readers. */
export interface StructureInput {
  readonly pdbText: string;
  /** Defaults to the existing residues table's order; a subset may be requested. */
  readonly residueKeys?: readonly string[];
  /** Optional integrity assertion, checked against the actual bytes. */
  readonly expectedSha256?: string;
}

export interface PreparedStructureInput {
  readonly pdbText: string;
  readonly entryId: string;
  readonly sha256: string;
  readonly residueKeys: readonly string[];
  readonly residues: readonly { readonly residueKey: string; readonly compId: string }[];
}

export interface StrategyDescriptor {
  readonly id: string;
  readonly methodology: string;
  readonly implementation: { readonly name: string; readonly version: string };
}

/** Scientific computation only. Validation, recording and export belong to the adapter. */
export interface MethodStrategy<I, O> extends StrategyDescriptor {
  execute(input: I): Promise<O>;
}

export interface NormalizationReference {
  readonly compId: string;
  readonly maxAsa: number;
  readonly referenceId: string;
  readonly referenceVersion: string;
}

/** The existing surface kernel's contract, with explicit normalization inputs. */
export interface SurfaceStrategyResult {
  readonly surface: ResidueSurface;
  readonly normalization: readonly (NormalizationReference | null)[];
}
export type SurfaceStrategy = MethodStrategy<PreparedStructureInput, SurfaceStrategyResult>;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue | undefined };

/** Structural interface accepted by EvidenceFootprint; no package dependency. */
export interface DomainEvidenceEvent {
  id: string;
  captureId: string;
  timestamp: string;
  kind: string;
  source: { artifact: string; origin: string; [field: string]: JsonValue | undefined };
  [field: string]: JsonValue | undefined;
}

export interface DomainEvidenceRelation {
  id: string;
  from: string;
  to: string;
  type: 'derived-from' | 'uses-input';
  basis: 'observed';
  reason: string;
}

export interface EvidenceBundle {
  readonly events: readonly DomainEvidenceEvent[];
  readonly relations: readonly DomainEvidenceRelation[];
}

/** Hosts inject analyzeDependencies from evidencefootprint/dependencies here. */
export interface DependencyInspectionPort<T = unknown> {
  analyzeDependencies(bundle: EvidenceBundle, evidenceIds: readonly string[]): T | Promise<T>;
}

/** Host-owned declarations passed to evidencefootprint/observations. */
export interface SurfaceObservationInput {
  id: string;
  captureId: string;
  timestamp: string;
  source: DomainEvidenceEvent['source'];
  observation: {
    subjectId: string;
    quantity: string;
    value: number | null;
    unit: string;
    absenceReason: string | null;
    method: { id: string; version: string | null; parameters: { [key: string]: JsonValue | undefined } };
    preparation: null;
    runtime?: { runId: string; stageId: string };
  };
  dependencies: readonly {
    id: string;
    evidenceId: string;
    type: DomainEvidenceRelation['type'];
    basis: 'observed';
    reason: string;
  }[];
}

/**
 * Inject the real synchronous createObservation; no package import or substitute
 * observation validator lives here. Returned edges must preserve our declarations.
 */
export interface ObservationRecordingPort {
  createObservation(input: SurfaceObservationInput): {
    event: DomainEvidenceEvent;
    relations: readonly {
      id: string; from: string; to: string; type: string;
      basis: 'observed' | 'inferred'; reason: string;
    }[];
  };
}

export interface SurfaceRunRequest {
  readonly structure: StructureInput;
  readonly strategyId: string;
}

export interface SurfaceRunResult extends SurfaceStrategyResult {
  readonly captureId: string;
  readonly strategy: StrategyDescriptor;
  readonly input: Omit<PreparedStructureInput, 'pdbText'>;
  readonly evidence: EvidenceBundle;
  readonly recording: RuntimeSnapshot;
  readonly traceCoverage: {
    readonly level: 'method-boundary-and-normalization';
    readonly internalAtomSampling: 'not-instrumented';
    readonly dependencyCompleteness: 'not-established';
    readonly statisticalIndependence: 'not-established';
  };
}

export interface SurfaceAdapter<T = unknown> {
  readonly strategies: readonly StrategyDescriptor[];
  run(request: SurfaceRunRequest): Promise<SurfaceRunResult>;
  inspectDependencies(bundle: EvidenceBundle, evidenceIds: readonly string[]): Promise<T>;
}
