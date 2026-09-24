# Surface domain adapter

This is the opt-in domain boundary for the existing non-LLM hotspot pipeline's
accessible-surface calculation. It implements Ports and Adapters, with selectable
Strategies inside the adapter and a shared FootPrint recording/export layer.
The existing `src/hot` and `src/prot` desks keep their current behavior and
scientific analyses. This module does not introduce another hotspot pipeline or
replace the existing surface kernel.

| Component | Responsibility |
| --- | --- |
| `SurfaceAdapter` / `createSurfaceAdapter()` | Validate structure input, dispatch the requested strategy, validate its result, record execution, and export evidence. |
| `MethodStrategy<I, O>` / `SurfaceStrategy` | Implement the scientific calculation and report its methodology and implementation version. |
| `createMolstarSurfaceStrategy()` | Use the existing `headlessEntry()` and `protSurface()` analysis with explicit optional sampling overrides. |
| `createSurfaceMethodChart()` / `exportSurfaceEvidence()` | Share execution recording and evidence export across all strategies. |
| `DependencyInspectionPort` | Let a host inject EvidenceFootprint dependency analysis without making that package a runtime requirement here. |
| `ObservationRecordingPort` | Let a host inject EvidenceFootprint observation creation and generic validation while the application supplies scientific facts and dependencies. |

## Run a built-in strategy

```ts
import { createSurfaceAdapter } from './src/prot/domain/index.js';

const adapter = createSurfaceAdapter();
const result = await adapter.run({
  structure: { pdbText },
  strategyId: 'molstar-defaults',
});

// A second configuration of the SAME scientific method:
const dense = await adapter.run({
  structure: { pdbText, residueKeys: ['A:63', 'A:85'] },
  strategyId: 'molstar-960',
});
```

The default adapter registers `molstar-defaults` and `molstar-960`. Both use
Mol*'s Shrake–Rupley implementation and its normalization table. The latter sets
`numberOfSpherePoints: 960`; the former uses the engine's defaults. Different
sampling densities are configurations of one method, not independent scientific
methods or independent evidence. Each result reports the effective probe radius,
sphere count, non-polymer setting, and trace-only setting.

Custom registration is explicit:

```ts
import {
  createSurfaceAdapter,
  createMolstarSurfaceStrategy,
} from './src/prot/domain/index.js';

const adapter = createSurfaceAdapter({
  strategies: [
    createMolstarSurfaceStrategy({ id: 'standard' }),
    createMolstarSurfaceStrategy({
      id: 'dense',
      sampling: { numberOfSpherePoints: 960 },
    }),
  ],
});
```

A host may supply other implementations of `SurfaceStrategy`. Strategies return
the existing `ResidueSurface` columns plus one normalization reference or `null`
for each selected residue. The common boundary checks alignment, finite
nonnegative values, normalization arithmetic, component identities, and counts.
Unknown strategy IDs, duplicate registrations, invalid results, and scientific
engine failures reject the run. They never silently select another strategy.

## Identity, absence, and scope

`StructureInput` contains the exact PDB text. Its SHA-256 is computed from that
text's UTF-8 bytes without newline normalization. An optional `expectedSha256`
is checked before running the method. `residueKeys` defaults to the existing
residues table's order; a nonempty, unique subset may specify another order.
Every output array follows that selected order.

This boundary inherits the existing PDB parser's residue identity
`<chain>:<resnum>` and supported polymer rows. It rejects multiple PDB models and
insertion-coded polymer residues because the current key cannot distinguish
them. Repeated residue identities across `TER` segments and conflicting component
names at one identity are rejected for the same reason. It also rejects
empty/unsupported structures, malformed coordinate records, unknown residue
keys, and digest mismatches. It is not an mmCIF reader or a new residue-identity
model.

A missing computed area remains `null`. An area without a normalization
reference has `relative_sasa: null`; it is never divided by an alanine fallback.
A buried residue's measured zero remains zero. A valid relative value may exceed
one; the adapter does not clamp it. `engineTotal` describes the engine's entire
computed structure, so it need not equal a selected subset's sum.

## Shared recording and evidence

Each run returns the scientific result, selected strategy descriptor, structure
digest and row axis, a FootPrint `recording` snapshot, and an `evidence` bundle.
Raw PDB text stays out of both exports. Each evidence capture uses a UUID so
bundles from different hosts do not rely on a process-local counter. The method
event's `runtimeRunId` links it to the FootPrint snapshot's `runId`. Structure and
normalization reference IDs identify reusable content across runs.

The recording covers the method input boundary, method invocation, and output
validation. Evidence connects each residue area to its method invocation and
exact structure digest, then connects each relative value to its area and named,
versioned normalization reference. It does not instrument Mol*'s internal atom
sampling loop. The explicit `traceCoverage` fields say that dependency
completeness and statistical independence have not been established. Content
events use a declared identity timestamp, not an asserted acquisition date.

## Inject EvidenceFootprint in the host

The core depends on the public `footprintjs` recorder and optional structural
ports. It imports neither the private EvidenceFootprint
package nor AgentFootprint, and it requires no LLM, agent, API key, or network
request to run the committed example.

Hosts with access to EvidenceFootprint's `/observations` and `/dependencies`
entry points inject the real library functions:

```ts
import {
  createSurfaceAdapter,
  type DependencyInspectionPort,
  type ObservationRecordingPort,
} from './src/prot/domain/index.js';
import { analyzeDependencies } from 'evidencefootprint/dependencies';
import { createObservation, createObservationSemantics } from 'evidencefootprint/observations';
import { createEvidenceDictionary } from 'evidencefootprint/semantics';

// This host-only import needs access to the private EvidenceFootprint package.
const dependencyInspection: DependencyInspectionPort = { analyzeDependencies };
const observationRecording: ObservationRecordingPort = { createObservation };

const adapter = createSurfaceAdapter({ dependencyInspection, observationRecording });
const result = await adapter.run({
  structure: { pdbText },
  strategyId: 'molstar-defaults',
});
const selectedIds = result.evidence.events
  .filter((event) => {
    const observation = event.observation;
    return event.kind === 'observation' && observation !== null &&
      typeof observation === 'object' && !Array.isArray(observation) &&
      observation.quantity === 'relative_sasa';
  })
  .slice(0, 2)
  .map((event) => event.id);
const report = await adapter.inspectDependencies(result.evidence, selectedIds);
const dictionary = createEvidenceDictionary({ extensions: [createObservationSemantics()] });
```

With `observationRecording`, the shared exporter delegates each residue's area
and relative area to `createObservation()`. The library constructs and validates
standard `kind: 'observation'` events and their declared relations. The application
retains scientific validation: row alignment, nonnegative areas, normalization
arithmetic and counts. Those rules are specific to surface analysis and do not
belong in the evidence library.

The measurement is at `event.observation.{quantity,value,unit,absenceReason}`.
Top-level `residueKey` and `compId` remain domain annotations; values are not
duplicated in legacy fields. Existing evidence IDs, source/reference records and
dependency edges are preserved. Subjects include the exact structure digest and
residue key, so the same chain/number in different structures cannot be conflated.
Method metadata records the methodology, actual implementation version, selected
strategy and effective sampling parameters. Preparation remains explicitly
unknown (`null`); structure bytes alone do not identify a preparation protocol.
The optional runtime reference names `surface-method` within the returned
recording, scoped by the evidence capture.

The port must be synchronous. Errors, asynchronous results, or rewrites of the
declared measurements/provenance/dependency edges reject export without fallback.
The application checks that its declarations survived the boundary; it contains
no replacement for the library's observation schema validator. Use a library
revision containing `/observations` (first added at `e4d0c68`); the older 0.9.0
code alone does not establish availability of that entry point.

Select a bounded set of observations for inspection (two in this example), within
the host's installed EvidenceFootprint selection limit. The adapter forwards both
arguments and the host's report unchanged. Committed tests verify that port
contract with injected functions. A separate host integration check uses the real
EvidenceFootprint library: both strategy runs, all observation schemas, exact
scientific-result parity with the uninjected adapter, combined bundles with 128
selected observations, shared structure/normalization ancestry, and strict
TypeScript interface compatibility. That check stays outside this public
repository, so its tests require no private package access.
The adapter contains no substitute dependency-analysis engine. Without an
observation port, the original `kind: 'measurement'` export and its top-level
fields remain unchanged. Without a dependency inspection port,
`inspectDependencies()` rejects with `No DependencyInspectionPort was injected`.

## Committed example and checks

From the repository root, with the repository's dependencies installed:

```sh
node --import tsx scripts/prot-domain-example.ts
node --import tsx scripts/prot-domain-example.ts molstar-960
npx vitest run tests/prot-domain-adapter.test.ts tests/prot-domain-strategies.test.ts tests/prot-domain-recording.test.ts tests/prot-domain-observations.test.ts tests/prot-surface.test.ts
npm run typecheck
npm test
npm run site:build
```

The example reads the committed 1AY7 snapshot, verifies its bytes against the
local file digest, and prints the selected strategy, digest, counts, and evidence
summary. It needs no private EvidenceFootprint installation.
