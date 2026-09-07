/**
 * THE COMMITTED SLICE, off disk — the node half of the grid ETL.
 *
 * `etl.ts`, `absence.ts`, `names.ts` and `slice.ts` beside this file are pure:
 * bytes in, tables out, and they run in a browser. Streaming a 101 MB download
 * and writing files does not. So every door that touches the disk lives here,
 * for exactly the reason `src/nndss/snapshot.ts` gives: a module that pulls a
 * runtime into every importer is a module every importer pays for.
 *
 * Two jobs:
 *
 *   `cutSlice()`   the bulk files in `data/grid/raw/` → the two committed CSVs.
 *                  It streams (the interchange file does not fit comfortably in
 *                  memory), keeps EIA's row order, and copies every retained
 *                  cell's text unchanged.
 *   `loadGrid()`   the committed CSVs → the four tables, through the same ETL
 *                  the server will run.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { parseCSVTyped } from 'vizfootprint/data';
import { openSource } from 'vizfootprint/source';
import { fileSource } from 'vizfootprint/source/file';
import { gridTablesFromRows, stampMs, type GridTables } from './etl.js';
import { BALANCE_SLICE_COLUMNS, INTERCHANGE_SLICE_COLUMNS, inWindow, type RawProvenance, type SliceCounts } from './slice.js';

/** Where the committed slice lives. */
export const SLICE_DIR = new URL('../../data/grid/', import.meta.url);
export const BALANCE_CSV = new URL('balance.csv', SLICE_DIR);
export const INTERCHANGE_CSV = new URL('interchange.csv', SLICE_DIR);
export const SLICE_PROVENANCE = new URL('PROVENANCE.json', SLICE_DIR);
/** Where `data/grid/fetch.mjs` puts the bulk files it downloads — git-ignored, never committed. */
export const RAW_DIR = new URL('raw/', SLICE_DIR);
export const RAW_PROVENANCE = new URL('PROVENANCE.json', RAW_DIR);

/** What the file carrier vouched for about one CSV it read. */
export interface CarriedSource {
  readonly format: 'csv';
  readonly via: 'file';
  readonly at: string;
  readonly version: string;
  readonly retrievedAt: string;
  readonly rows: number;
}

// ── CSV, exactly as EIA spells it ─────────────────────────────────────────────

/** One line into fields, honouring quotes — EIA quotes only its header, but a cut must not assume that. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cell);
      cell = '';
    } else cell += c;
  }
  out.push(cell);
  return out;
}

/** One data field, quoted only when it must be — the same spelling `src/nndss/graph.ts` writes its files in. */
const csvField = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
/** One header field, quoted always — the way EIA writes its own header line. */
const headerField = (s: string): string => `"${s.replace(/"/g, '""')}"`;

// ── the cut ───────────────────────────────────────────────────────────────────

interface CutResult {
  readonly read: number;
  readonly kept: number;
}

/**
 * Stream one bulk file into one committed CSV: keep the rows whose UTC hour is
 * in the window, keep the named columns, copy every retained cell's text
 * unchanged, and preserve EIA's row order.
 *
 * A column named in `keep` that the source header does not have is refused by
 * name — a silently missing column would produce a file of empty cells that
 * looks like data.
 */
async function cutFile(from: URL, to: URL, keep: readonly string[], utcColumn: string): Promise<CutResult> {
  const out = createWriteStream(to);
  const write = async (line: string): Promise<void> => {
    if (!out.write(line)) await once(out, 'drain');
  };
  const lines = createInterface({ input: createReadStream(from), crlfDelay: Infinity });
  let indices: number[] = [];
  let utcAt = -1;
  let read = 0;
  let kept = 0;
  for await (const line of lines) {
    if (line === '') continue;
    const fields = splitCsvLine(line);
    if (indices.length === 0) {
      const header = fields.map((f) => f.trim());
      indices = keep.map((column) => {
        const at = header.indexOf(column);
        if (at === -1) throw new Error(`${from.pathname}: no column named ${JSON.stringify(column)} — EIA changed the header, so the cut is refused rather than guessed`);
        return at;
      });
      utcAt = header.indexOf(utcColumn);
      await write(keep.map(headerField).join(',') + '\n');
      continue;
    }
    read++;
    if (!inWindow(stampMs(fields[utcAt]))) continue;
    kept++;
    await write(indices.map((i) => csvField(fields[i] ?? '')).join(',') + '\n');
  }
  out.end();
  await once(out, 'close');
  return { read, kept };
}

/** The fetcher's record of the download, read from the file it wrote — never retyped. */
export function rawProvenance(at: URL = RAW_PROVENANCE): RawProvenance {
  if (!existsSync(at)) throw new Error('data/grid/raw/PROVENANCE.json is missing — run `node data/grid/fetch.mjs` first');
  return JSON.parse(readFileSync(at, 'utf8')) as RawProvenance;
}

/** The bulk files this download produced, by table name. */
function rawFile(raw: RawProvenance, table: string): URL {
  const entry = raw.files.find((f) => f.table === table);
  if (entry === undefined) throw new Error(`data/grid/raw/PROVENANCE.json names no "${table}" file — re-run \`node data/grid/fetch.mjs\``);
  return new URL(entry.file.replace(/^raw\//, ''), RAW_DIR);
}

/** Cut both bulk files into the two committed CSVs, and report what was read and kept. */
export async function cutSlice(raw: RawProvenance = rawProvenance()): Promise<SliceCounts> {
  const balance = await cutFile(rawFile(raw, 'balance'), BALANCE_CSV, BALANCE_SLICE_COLUMNS, 'UTC Time at End of Hour');
  const interchange = await cutFile(rawFile(raw, 'interchange'), INTERCHANGE_CSV, INTERCHANGE_SLICE_COLUMNS, 'UTC Time at End of Hour');
  return { balance, interchange };
}

// ── reading the slice back ────────────────────────────────────────────────────

/** The committed slice, parsed into the four tables. */
export function loadGrid(dir: URL = SLICE_DIR): GridTables {
  const read = (name: string): readonly Record<string, unknown>[] => parseCSVTyped(readFileSync(new URL(name, dir), 'utf8')).rows;
  return gridTablesFromRows(read('balance.csv'), read('interchange.csv'));
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
export async function loadGridAsync(dir: URL = SLICE_DIR): Promise<{ readonly tables: GridTables; readonly sources: Readonly<Record<'balance.csv' | 'interchange.csv', CarriedSource>> }> {
  const balance = await carried(new URL('balance.csv', dir), 'hourly');
  const interchange = await carried(new URL('interchange.csv', dir), 'interchange');
  return { tables: gridTablesFromRows(balance.rows, interchange.rows), sources: { 'balance.csv': balance.source, 'interchange.csv': interchange.source } };
}

/** SHA-256 of a file's bytes — how the tests pin a committed file to the generator that wrote it. */
export function digestOf(path: URL): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
