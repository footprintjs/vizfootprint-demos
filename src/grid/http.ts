/**
 * THE COMMITTED SLICE, OVER HTTP — the browser half of the grid ETL.
 *
 * `./snapshot.ts` reads `balance.csv` and `interchange.csv` off disk with the
 * library's file carrier. A page has no disk, so it declares the same two
 * tables `via: 'http'` and lets the http carrier fetch them. The CDC demo's
 * `src/nndss/http.ts` is the same door over the same law, and says why the
 * bytes go through a carrier rather than a bare `fetch`: the version.
 *
 * These two files are 8.7 MB together. That is the honest cost of a page that
 * carries its own data, and it is the reason the static build fetches them
 * rather than inlining them the way the single-file story page does.
 */
import { openSource } from 'vizfootprint/source';
import { httpSource } from 'vizfootprint/source';
import { gridTablesFromRows, type GridTables } from './etl.js';
import type { HttpCarriedSource } from '../nndss/http.js';
import { GRID_FILES } from '../data/files.js';

export { GRID_FILES };


/** One declared file through the carrier, with what it vouched for. */
async function carried(base: string | URL, file: string, table: string): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly source: HttpCarriedSource }> {
  const at = new URL(file, base).href;
  const handle = await openSource({ format: 'csv', via: 'http', at }, table, [httpSource()]);
  const snap = await handle.snapshot();
  if ('unchanged' in snap) throw new Error(`${table}: a first read never answers unchanged`);
  await handle.close();
  return { rows: snap.rows, source: { format: 'csv', via: 'http', at, version: snap.version, retrievedAt: snap.retrievedAt, rows: snap.rows.length } };
}

/** The committed slice, fetched and shaped — the browser's `loadGridAsync`, through the same ETL the server runs. */
export async function loadGridOverHttp(base: string | URL): Promise<{ readonly tables: GridTables; readonly sources: Readonly<Record<string, HttpCarriedSource>> }> {
  const [balance, interchange] = await Promise.all([carried(base, GRID_FILES.balance, 'hourly'), carried(base, GRID_FILES.interchange, 'interchange')]);
  return { tables: gridTablesFromRows(balance.rows, interchange.rows), sources: { 'balance.csv': balance.source, 'interchange.csv': interchange.source } };
}
