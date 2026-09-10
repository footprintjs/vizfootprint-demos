/**
 * THE COMMITTED SLICE, OVER HTTP — the browser half of the exoplanet ETL.
 *
 * `./snapshot.ts` reads `ps.csv` and `pscomppars.csv` off disk with the
 * library's file carrier. A page has no disk, so it declares the same two
 * tables `via: 'http'` and lets the http carrier fetch them. `src/grid/http.ts`
 * is the same door over the same law, and `src/nndss/http.ts` says why the
 * bytes go through a carrier rather than a bare `fetch`: the version.
 *
 * These two files are 9.8 MB together. That is the honest cost of a page that
 * carries its own data, and it is why the static build fetches them rather than
 * inlining them the way the single-file story page does.
 *
 * NOT HERE, and named as the follow-up it already is: a **FIND door**. The
 * sheet's `httpSheetData` can take one (`NO_FIND_DOOR` is what a host passes
 * when it has none) so that a search reaches the whole table instead of the
 * fetched window. Neither the grid demo nor this one has one, and with 20,598
 * rows already in the browser the sheet reads them from memory; a served
 * deployment over the whole archive would need it, and that is the day to build
 * it — not before.
 */
import { openSource } from 'vizfootprint/source';
import { httpSource } from 'vizfootprint/source';
import { exoTablesFromRows, type ExoTables } from './etl.js';
import type { HttpCarriedSource } from '../nndss/http.js';
import { EXO_FILES } from '../data/files.js';

export { EXO_FILES };

/** One declared file through the carrier, with what it vouched for. */
async function carried(base: string | URL, file: string, table: string): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly source: HttpCarriedSource }> {
  const at = new URL(file, base).href;
  const handle = await openSource({ format: 'csv', via: 'http', at }, table, [httpSource()]);
  const snap = await handle.snapshot();
  if ('unchanged' in snap) throw new Error(`${table}: a first read never answers unchanged`);
  await handle.close();
  return { rows: snap.rows, source: { format: 'csv', via: 'http', at, version: snap.version, retrievedAt: snap.retrievedAt, rows: snap.rows.length } };
}

/** The committed slice, fetched and shaped — the browser's `loadExo`, through the same ETL a server would run. */
export async function loadExoOverHttp(base: string | URL): Promise<{ readonly tables: ExoTables; readonly sources: Readonly<Record<string, HttpCarriedSource>> }> {
  const [ps, composite] = await Promise.all([carried(base, EXO_FILES.measurements, 'measurements'), carried(base, EXO_FILES.planets, 'planets')]);
  return { tables: exoTablesFromRows(ps.rows, composite.rows), sources: { 'ps.csv': ps.source, 'pscomppars.csv': composite.source } };
}
