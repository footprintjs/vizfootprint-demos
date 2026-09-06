/**
 * THE GRAPH GENERATOR — the committed snapshot in, three committed files out.
 *
 *   npm run graph:generate   → data/nndss/graph/{nodes.csv, edges.csv, PROVENANCE.json}
 *
 * It reads the snapshot the way the server does (the library's file carrier,
 * then the same ETL — never a hand parse of the CSV), folds the disease
 * co-occurrence graph with `diseaseGraph` (the rule lives there, in one
 * sentence, and is written into the provenance), and writes the files.
 *
 * Nothing here reads a clock: the provenance carries the SNAPSHOT's retrieval
 * time and a SHA-256 of its bytes (`snapshotProvenance`, the one reader the
 * test that pins these files also calls), which are facts about the input,
 * and no stamp of its own — so two runs over one snapshot are byte-identical,
 * which `tests/graph.test.ts` proves. Regenerate after `npm run data:fetch`;
 * never edit the outputs by hand.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { diseaseGraph, graphFiles } from '../src/nndss/graph.js';
import { GRAPH_DIR, loadSnapshotAsync, snapshotProvenance } from '../src/nndss/snapshot.js';

const GENERATOR = 'scripts/graph-generate.ts';

async function main(): Promise<void> {
  const { tables, source } = await loadSnapshotAsync();
  const fold = diseaseGraph(tables.cells);
  const files = graphFiles(fold, snapshotProvenance(), GENERATOR);
  mkdirSync(GRAPH_DIR, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(new URL(name, GRAPH_DIR), text);
  const c = fold.counts;
  process.stderr.write(
    `graph: ${String(c.cells)} cells read (${String(source.rows)} snapshot rows), ${String(c.rollups)} roll-up cells set aside, ${String(c.repeats)} repeated, ${String(c.reporting)} reporting → ${String(fold.nodes.length)} nodes, ${String(fold.edges.length)} edges → data/nndss/graph/{${Object.keys(files).join(', ')}}\n`,
  );
}

void main();
