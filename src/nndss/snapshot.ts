/**
 * THE COMMITTED SNAPSHOT, off disk — the node half of the ETL. And, beside it,
 * THE COMMITTED GRAPH — the node half of `graph.ts`.
 *
 * `etl.ts` beside this file is pure: bytes in, three tables out, and it runs in
 * a browser. Reading a file does not. So the doors that touch the disk live
 * here, for exactly the reason the library gives for `src/source/file.ts`:
 * a module that pulls a runtime into every importer is a module every importer
 * pays for, including the ones that only wanted the shaping.
 *
 * The single-file story page is what turned that from tidiness into a
 * requirement — it runs `nndssTablesFromRows` in the browser over a CSV the
 * page carries, and one `node:fs` import at the top of `etl.ts` would have
 * failed the build.
 *
 * The graph's two tables load the way the snapshot does: a declared
 * `{ format: 'csv', via: 'file', at }` read by the library's file carrier, so
 * the desk's provenance can vouch for them by version too.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseCSVTyped } from 'vizfootprint/data';
import { openSource } from 'vizfootprint/source';
import { fileSource } from 'vizfootprint/source/file';
import { nndssTables, nndssTablesFromRows, type NndssTables } from './etl.js';
import { graphOf, type NndssGraph, type SnapshotProvenance } from './graph.js';
import { populationRows, populationRowsFrom, type PopulationRow } from './population.js';

/** Where the committed slice of CDC's weekly table lives. */
export const SNAPSHOT_CSV = new URL('../../data/nndss/snapshot.csv', import.meta.url);
/** Where the graph the generator derived from it lives (`nodes.csv`, `edges.csv`, `PROVENANCE.json`). */
export const GRAPH_DIR = new URL('../../data/nndss/graph/', import.meta.url);
export const GRAPH_NODES_CSV = new URL('nodes.csv', GRAPH_DIR);
export const GRAPH_EDGES_CSV = new URL('edges.csv', GRAPH_DIR);
/** The fetcher's record of where the snapshot came from, beside it. */
export const SNAPSHOT_PROVENANCE = new URL('PROVENANCE.json', SNAPSHOT_CSV);

/** What the file carrier vouched for about one CSV it read. */
export interface CarriedSource {
  readonly format: 'csv';
  readonly via: 'file';
  readonly at: string;
  readonly version: string;
  readonly retrievedAt: string;
  readonly rows: number;
}

/** Where the denominator lives — the Census Bureau's state estimates, fetched with their provenance (`data/population`). */
export const POPULATION_CSV = new URL('../../data/population/population.csv', import.meta.url);

/**
 * The committed snapshot, parsed — WITH the denominator beside it.
 *
 * WHY the population rides on the default: the desk has a view over it now
 * (the rate bar, `web/src/cells.tsx`), and the def declares the table, the
 * relation and the two acts together off `tables.population`. A default that
 * left it out would boot a desk whose rate cell says "no denominator" on every
 * run, which is a demo of the gap and not of the column. A caller that wants
 * three tables and no rate — the story page's shape — spreads it away:
 * `{ ...loadSnapshot(), population: undefined }`.
 */
export function loadSnapshot(path: URL = SNAPSHOT_CSV, population: URL = POPULATION_CSV): NndssTables {
  return { ...nndssTables(readFileSync(path, 'utf8')), population: loadPopulation(population) };
}

/** The committed population table alone, parsed — one door, so a test can read the denominator without the 90,300 cells. */
export function loadPopulation(path: URL = POPULATION_CSV): PopulationRow[] {
  return populationRows(readFileSync(path, 'utf8'));
}

/**
 * The snapshot's own provenance, the fields the graph's provenance repeats — read from the file the
 * fetcher wrote, never retyped — plus a SHA-256 of the snapshot's bytes. ONE reader, called by the
 * generator and by the test that pins the generator's output, so the projection cannot drift between them.
 * WHY the hash: `retrievedAt` + `rows` name a fetch, not a content; a hand-edited snapshot with the same
 * row count would otherwise claim the same derivation. A digest is clock-free, so byte-stability holds.
 */
export function snapshotProvenance(csv: URL = SNAPSHOT_CSV, provenance: URL = SNAPSHOT_PROVENANCE): SnapshotProvenance {
  const p = JSON.parse(readFileSync(provenance, 'utf8')) as Record<string, unknown>;
  const str = (k: string): string => {
    const v = p[k];
    if (typeof v !== 'string') throw new Error(`data/nndss/PROVENANCE.json: "${k}" is not a string — re-run npm run data:fetch`);
    return v;
  };
  const rows = p['rows'];
  if (typeof rows !== 'number') throw new Error('data/nndss/PROVENANCE.json: "rows" is not a number — re-run npm run data:fetch');
  const sha256 = createHash('sha256').update(readFileSync(csv)).digest('hex');
  return { source: str('source'), dataset: str('dataset'), url: str('url'), attribution: str('attribution'), license: str('license'), retrievedAt: str('retrievedAt'), rows, sha256 };
}

/** One CSV through the library's source layer: a declared `{ format: 'csv', via: 'file', at }`, read by the file carrier, with the provenance it vouches for. */
async function carried(path: URL, table: string): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly source: CarriedSource }> {
  const handle = await openSource({ format: 'csv', via: 'file', at: path.href }, table, [fileSource]);
  const snap = await handle.snapshot();
  if ('unchanged' in snap) throw new Error(`${table}: a first read never answers unchanged`);
  await handle.close();
  return { rows: snap.rows, source: { format: 'csv', via: 'file', at: path.href, version: snap.version, retrievedAt: snap.retrievedAt, rows: snap.rows.length } };
}

/**
 * The snapshot through the library's source layer, with the provenance the
 * carrier vouches for — and the population table through the same carrier,
 * keyed as the desk's provenance lists it, so a rate's denominator is vouched
 * for by version exactly as its numerator is.
 */
export async function loadSnapshotAsync(
  path: URL = SNAPSHOT_CSV,
  population: URL = POPULATION_CSV,
): Promise<{ readonly tables: NndssTables; readonly source: CarriedSource; readonly sources: Readonly<Record<'population.csv', CarriedSource>> }> {
  const cells = await carried(path, 'cells');
  const people = await carried(population, 'population');
  return { tables: { ...nndssTablesFromRows(cells.rows), population: populationRowsFrom(people.rows) }, source: cells.source, sources: { 'population.csv': people.source } };
}

/** The committed graph, parsed and narrowed — a file that drifted from the generator is refused with the row and column. */
export function loadGraph(dir: URL = GRAPH_DIR): NndssGraph {
  const read = (name: string): readonly Record<string, unknown>[] => parseCSVTyped(readFileSync(new URL(name, dir), 'utf8')).rows;
  return graphOf({ nodes: read('nodes.csv'), edges: read('edges.csv') });
}

/** The committed graph through the library's source layer: two carried files, and what the carrier vouched for about each, keyed as the desk's provenance lists them. */
export async function loadGraphAsync(dir: URL = GRAPH_DIR): Promise<{ readonly graph: NndssGraph; readonly sources: Readonly<Record<'graph/nodes.csv' | 'graph/edges.csv', CarriedSource>> }> {
  const nodes = await carried(new URL('nodes.csv', dir), 'nodes');
  const edges = await carried(new URL('edges.csv', dir), 'edges');
  return { graph: graphOf({ nodes: nodes.rows, edges: edges.rows }), sources: { 'graph/nodes.csv': nodes.source, 'graph/edges.csv': edges.source } };
}
