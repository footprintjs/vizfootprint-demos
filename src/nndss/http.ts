/**
 * THE COMMITTED SNAPSHOT, OVER HTTP — the browser half of the ETL.
 *
 * `./snapshot.ts` reads the same four CSVs off disk with the library's file
 * carrier. A page has no disk, so it declares the same tables `via: 'http'`
 * and lets the http carrier fetch them: same declaration shape, same decoder,
 * same refusal vocabulary, and a version the SERVER vouched for rather than a
 * stat we took ourselves.
 *
 * WHY the rows go through a carrier at all, when `fetch` plus `parseCSVTyped`
 * would be four lines shorter: the version. Every commit the session lands
 * stamps the version its tables were true of, and a page that fetched its own
 * bytes would have nothing honest to stamp. An ETag off a static file server
 * is a real answer to "which snapshot was this number computed from".
 */
import { openSource } from 'vizfootprint/source';
import { httpSource } from 'vizfootprint/source';
import { nndssTablesFromRows, type NndssTables } from './etl.js';
import { graphOf, type NndssGraph } from './graph.js';
import { populationRowsFrom } from './population.js';
import { NNDSS_FILES } from '../data/files.js';

export { NNDSS_FILES };

/** What the http carrier vouched for about one file it read. The file carrier's twin, one word different. */
export interface HttpCarriedSource {
  readonly format: 'csv' | 'json';
  readonly via: 'http';
  readonly at: string;
  readonly version: string;
  readonly retrievedAt: string;
  readonly rows: number;
}


/**
 * One declared file through the carrier, with what it vouched for.
 *
 * WHY `at` is absolutised against the base: the carrier refuses a locator that
 * is not an http(s) URL, on purpose — a relative string means different bytes
 * depending on which page asked. The base is the site's own, so the same build
 * works at `/` and at `/vizfootprint-demo/` with nothing recompiled.
 */
async function carried(base: string | URL, file: string, table: string, format: 'csv' | 'json', options?: Record<string, unknown>): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly source: HttpCarriedSource }> {
  const at = new URL(file, base).href;
  const handle = await openSource({ format, via: 'http', at, ...(options === undefined ? {} : { options }) }, table, [httpSource()]);
  const snap = await handle.snapshot();
  if ('unchanged' in snap) throw new Error(`${table}: a first read never answers unchanged`);
  await handle.close();
  return { rows: snap.rows, source: { format, via: 'http', at, version: snap.version, retrievedAt: snap.retrievedAt, rows: snap.rows.length } };
}

/** The snapshot, the denominator and the committed graph, fetched and shaped — the browser's `loadSnapshotAsync` + `loadGraphAsync`, in one round trip each. */
export async function loadNndssOverHttp(base: string | URL): Promise<{ readonly tables: NndssTables; readonly graph: NndssGraph; readonly sources: Readonly<Record<string, HttpCarriedSource>> }> {
  // WHY the denominator is fetched unconditionally though `NndssTables` marks
  // it OPTIONAL: the same law `./snapshot.ts` states — the type is optional for
  // the story page, which shapes its tables from one CSV, but a desk booted
  // without it demos the gap rather than the column. All four fail together, so
  // a missing file is a page that says which file, not a rate cell saying "no
  // denominator" on every run. A caller wanting three tables spreads it away.
  const [cells, people, nodes, edges] = await Promise.all([
    carried(base, NNDSS_FILES.snapshot, 'cells', 'csv'),
    carried(base, NNDSS_FILES.population, 'population', 'csv'),
    carried(base, NNDSS_FILES.nodes, 'nodes', 'csv'),
    carried(base, NNDSS_FILES.edges, 'edges', 'csv'),
  ]);
  return {
    tables: { ...nndssTablesFromRows(cells.rows), population: populationRowsFrom(people.rows) },
    graph: graphOf({ nodes: nodes.rows, edges: edges.rows }),
    sources: { 'snapshot.csv': cells.source, 'population.csv': people.source, 'graph/nodes.csv': nodes.source, 'graph/edges.csv': edges.source },
  };
}

/**
 * The map's shapes. A FeatureCollection is ONE ROW and the declaration says so
 * (`options: { as: 'one-row' }`) — the same words the server's geo door uses.
 * A JSON body that is not a collection is a decode refusal, never a table of
 * one accidental row.
 */
export async function loadGeoOverHttp(base: string | URL): Promise<Record<string, unknown>> {
  const { rows } = await carried(base, NNDSS_FILES.geo, 'geo', 'json', { as: 'one-row' });
  const collection = rows[0];
  if (collection === undefined) throw new Error(`geo: ${NNDSS_FILES.geo} decoded to zero rows`);
  return collection;
}
