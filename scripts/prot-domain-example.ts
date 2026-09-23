/** Run with: node --import tsx scripts/prot-domain-example.ts [molstar-defaults|molstar-960] */
import { createSurfaceAdapter } from '../src/prot/domain/index.js';
import { digestOf, loadStructureText } from '../src/prot/snapshot.js';

const adapter = createSurfaceAdapter();
const run = await adapter.run({
  structure: { pdbText: loadStructureText(), expectedSha256: digestOf() },
  strategyId: process.argv[2] ?? 'molstar-defaults',
});

console.log(JSON.stringify({
  entry: run.input.entryId,
  sha256: run.input.sha256,
  captureId: run.captureId,
  strategy: run.strategy,
  residues: run.input.residueKeys.length,
  counts: run.surface.counts,
  evidence: { events: run.evidence.events.length, relations: run.evidence.relations.length },
  traceCoverage: run.traceCoverage,
}, null, 2));
