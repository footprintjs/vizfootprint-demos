/**
 * THE COMMITTED SNAPSHOT, off disk — the node half of the ETL.
 *
 * `etl.ts` beside this file is pure: bytes in, three tables out, and it runs in
 * a browser. Reading a file does not. So the two doors that touch the disk live
 * here, for exactly the reason the library gives for `src/source/file.ts`:
 * a module that pulls a runtime into every importer is a module every importer
 * pays for, including the ones that only wanted the shaping.
 *
 * The single-file story page is what turned that from tidiness into a
 * requirement — it runs `nndssTablesFromRows` in the browser over a CSV the
 * page carries, and one `node:fs` import at the top of `etl.ts` would have
 * failed the build.
 */
import { readFileSync } from 'node:fs';
import { openSource } from 'vizfootprint/source';
import { fileSource } from 'vizfootprint/source/file';
import { nndssTables, nndssTablesFromRows, type NndssTables } from './etl.js';

/** Where the committed slice of CDC's weekly table lives. */
export const SNAPSHOT_CSV = new URL('../../data/nndss/snapshot.csv', import.meta.url);

/** The committed snapshot, parsed. */
export function loadSnapshot(path: URL = SNAPSHOT_CSV): NndssTables {
  return nndssTables(readFileSync(path, 'utf8'));
}

/** The snapshot through the library's source layer: a declared `{ format: 'csv', via: 'file', at }`, read by the file carrier, with the provenance it vouches for. */
export async function loadSnapshotAsync(
  path: URL = SNAPSHOT_CSV,
): Promise<{ readonly tables: NndssTables; readonly source: { readonly format: 'csv'; readonly via: 'file'; readonly at: string; readonly version: string; readonly retrievedAt: string; readonly rows: number } }> {
  const handle = await openSource({ format: 'csv', via: 'file', at: path.href }, 'cells', [fileSource]);
  const snap = await handle.snapshot();
  if ('unchanged' in snap) throw new Error('snapshot: a first read never answers unchanged');
  await handle.close();
  return { tables: nndssTablesFromRows(snap.rows), source: { format: 'csv', via: 'file', at: path.href, version: snap.version, retrievedAt: snap.retrievedAt, rows: snap.rows.length } };
}
