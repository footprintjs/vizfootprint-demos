/**
 * THE COMMITTED SLICE, off disk — the node half of the exoplanet ETL.
 *
 * `etl.ts`, `absence.ts`, `names.ts` and `slice.ts` beside this file are pure:
 * bytes in, tables out, and they run in a browser. Reading a file does not. So
 * every door that touches the disk lives here, for the reason
 * `src/grid/snapshot.ts` and `src/nndss/snapshot.ts` both give: a module that
 * pulls a runtime into every importer is a module every importer pays for, and
 * the static site's page runs this ETL in a browser over CSVs it fetched.
 *
 * There is no `cutSlice()` twin of the grid's here, and that is the interesting
 * difference: the cut is the QUERY (`./slice.ts`), so `data/exo/fetch.mjs`
 * writes the committed files directly and nothing downstream re-cuts them.
 * This file only reads them back and reports what the fetch recorded.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseCSVTyped } from 'vizfootprint/data';
import { openSource } from 'vizfootprint/source';
import { fileSource } from 'vizfootprint/source/file';
import { exoTablesFromRows, type ExoTables } from './etl.js';
import type { FetchedRecord } from './slice.js';

/** Where the committed slice lives. */
export const SLICE_DIR = new URL('../../data/exo/', import.meta.url);
export const PS_CSV = new URL('ps.csv', SLICE_DIR);
export const PSCOMPPARS_CSV = new URL('pscomppars.csv', SLICE_DIR);
/** What the fetch recorded about the download — the queries, the credit, the digests. */
export const FETCH_RECORD = new URL('FETCH.json', SLICE_DIR);
/** What the generator writes: the fetch's record plus the counts the slice parses to. */
export const SLICE_PROVENANCE = new URL('PROVENANCE.json', SLICE_DIR);

/** What the file carrier vouched for about one CSV it read. */
export interface CarriedSource {
  readonly format: 'csv';
  readonly via: 'file';
  readonly at: string;
  readonly version: string;
  readonly retrievedAt: string;
  readonly rows: number;
}

/** The fetch's record, read from the file it wrote — never retyped. */
export function fetchRecord(at: URL = FETCH_RECORD): FetchedRecord {
  if (!existsSync(at)) throw new Error('data/exo/FETCH.json is missing — run `node data/exo/fetch.mjs` first');
  return JSON.parse(readFileSync(at, 'utf8')) as FetchedRecord;
}

/** The committed slice, parsed into the three tables. */
export function loadExo(dir: URL = SLICE_DIR): ExoTables {
  const read = (name: string): readonly Record<string, unknown>[] => parseCSVTyped(readFileSync(new URL(name, dir), 'utf8')).rows;
  return exoTablesFromRows(read('ps.csv'), read('pscomppars.csv'));
}

/** One CSV through the library's source layer: a declared `{ format: 'csv', via: 'file', at }`, read by the file carrier, with the provenance it vouches for. */
async function carried(path: URL, table: string): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly source: CarriedSource }> {
  const handle = await openSource({ format: 'csv', via: 'file', at: path.href }, table, [fileSource]);
  const snap = await handle.snapshot();
  if ('unchanged' in snap) throw new Error(`${table}: a first read never answers unchanged`);
  await handle.close();
  return { rows: snap.rows, source: { format: 'csv', via: 'file', at: path.href, version: snap.version, retrievedAt: snap.retrievedAt, rows: snap.rows.length } };
}

/** The committed slice through the library's source layer: two carried files, and what the carrier vouched for about each. */
export async function loadExoAsync(dir: URL = SLICE_DIR): Promise<{ readonly tables: ExoTables; readonly sources: Readonly<Record<'ps.csv' | 'pscomppars.csv', CarriedSource>> }> {
  const ps = await carried(new URL('ps.csv', dir), 'measurements');
  const composite = await carried(new URL('pscomppars.csv', dir), 'planets');
  return { tables: exoTablesFromRows(ps.rows, composite.rows), sources: { 'ps.csv': ps.source, 'pscomppars.csv': composite.source } };
}

/** SHA-256 of a file's bytes — how a test pins a committed file to the download that wrote it. */
export function digestOf(path: URL): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
