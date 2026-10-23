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
 * A review link pins the committed CSVs by SHA-256, including the row order
 * that mints measurement ids. The bytes must therefore match the download
 * record BEFORE the carrier decodes them. A wrapped fetch verifies a clone
 * of each response and hands the ORIGINAL response to the carrier: one network
 * request, the server's version unchanged, and no rows from a stale snapshot.
 *
 * NOT HERE, and named as the follow-up it already is: a **FIND door**. The
 * sheet's `httpSheetData` can take one (`NO_FIND_DOOR` is what a host passes
 * when it has none) so that a search reaches the whole table instead of the
 * fetched window. Neither the grid demo nor this one has one, and with 20,598
 * rows already in the browser the sheet reads them from memory; a served
 * deployment over the whole archive would need it, and that is the day to build
 * it — not before.
 */
import { SourceRefusal, httpSource, openSource } from 'vizfootprint/source';
import fetched from '../../data/exo/FETCH.json';
import { exoTablesFromRows, type ExoTables } from './etl.js';
import type { HttpCarriedSource } from '../nndss/http.js';
import { EXO_FILES } from '../data/files.js';

export { EXO_FILES };

/** The carrier's source version and the independently verified committed bytes. */
export interface VerifiedExoSource extends HttpCarriedSource {
  readonly sha256: string;
}

/** One declared file through the carrier, bound to its download's exact bytes. */
async function carried(base: string | URL, file: string, table: string): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly source: VerifiedExoSource }> {
  const at = new URL(file, base).href;
  const expected = fetched.tables.find((source) => file.endsWith(`/${source.file}`))?.sha256;
  if (expected === undefined || !/^[a-f0-9]{64}$/.test(expected)) throw new Error(`${file}: the committed fetch record has no SHA-256 fingerprint`);
  let verifiedSha256: string | undefined;
  const verifiedFetch: typeof fetch = async (input, init) => {
    const response = await globalThis.fetch(input, init);
    // HTTP refusals still belong to the carrier, with their original status.
    if (!response.ok || response.body === null) return response;
    if (globalThis.crypto?.subtle === undefined) throw new SourceRefusal('no-adapter', `${file}: SHA-256 snapshot verification needs Web Crypto in a secure browser context`, table, 'http');
    const bytes = await response.clone().arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw new SourceRefusal('malformed', `${file}: snapshot fingerprint mismatch — expected SHA-256 ${expected}, received ${actual}. The downloaded CSV is not the committed archive slice; the review was not opened.`, table, 'http');
    verifiedSha256 = actual;
    return response;
  };
  const handle = await openSource({ format: 'csv', via: 'http', at }, table, [httpSource({ fetch: verifiedFetch })]);
  try {
    const snap = await handle.snapshot();
    if ('unchanged' in snap) throw new Error(`${table}: a first read never answers unchanged`);
    if (verifiedSha256 === undefined) throw new Error(`${file}: no snapshot fingerprint was verified`);
    return { rows: snap.rows, source: { format: 'csv', via: 'http', at, version: snap.version, retrievedAt: snap.retrievedAt, rows: snap.rows.length, sha256: verifiedSha256 } };
  } finally {
    await handle.close();
  }
}

/** The committed slice, fetched and shaped — the browser's `loadExo`, through the same ETL a server would run. */
export async function loadExoOverHttp(base: string | URL): Promise<{ readonly tables: ExoTables; readonly sources: Readonly<Record<'ps.csv' | 'pscomppars.csv', VerifiedExoSource>> }> {
  const [ps, composite] = await Promise.all([carried(base, EXO_FILES.measurements, 'measurements'), carried(base, EXO_FILES.planets, 'planets')]);
  return { tables: exoTablesFromRows(ps.rows, composite.rows), sources: { 'ps.csv': ps.source, 'pscomppars.csv': composite.source } };
}
