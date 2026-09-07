#!/usr/bin/env node
/**
 * Fetch the EIA Hourly Electric Grid Monitor bulk files this demo runs on, and
 * write a record of the download beside them.
 *
 *   npm run data:grid                   # download what is missing or stale
 *   npm run data:grid -- --force        # download again regardless
 *
 * Source: the U.S. Energy Information Administration's Hourly Electric Grid
 * Monitor, six-month bulk CSVs. Two files:
 *
 *   INTERCHANGE  one row per (from balancing authority, to balancing
 *                authority, hour) — the DIRECTED flows, this demo's edges.
 *   BALANCE      one row per (balancing authority, hour) — demand, net
 *                generation, total interchange, and the generation mix, each
 *                figure carrying whether it was reported or imputed.
 *
 * These are ~145 MB together, far too large to commit. They land in
 * `raw/` (git-ignored) and are the INPUT to `npm run grid:generate`, which
 * cuts the committed slice. Nothing downstream reads them directly.
 *
 * `raw/PROVENANCE.json` is this script's only other output: the exact URLs,
 * the byte counts, a SHA-256 of each file, the server's Last-Modified, and
 * the retrieval time — the facts the slice's own provenance repeats, so a
 * committed slice can always name the bytes it was cut from.
 *
 * A retrieval time belongs to a DOWNLOAD. A run that finds both files already
 * whole downloads nothing, so it keeps each file's previous stamp rather than
 * writing a new one — otherwise re-running this script would change the slice's
 * provenance, and therefore its bytes, without a single byte of data moving.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, 'raw');
const BASE = 'https://www.eia.gov/electricity/gridmonitor/sixMonthFiles';
/** The six-month period the demo is cut from. Change both entries together to move it. */
const PERIOD = '2025_Jan_Jun';
const FILES = [
  { table: 'interchange', name: `EIA930_INTERCHANGE_${PERIOD}.csv` },
  { table: 'balance', name: `EIA930_BALANCE_${PERIOD}.csv` },
];

const FORCE = process.argv.includes('--force');
const MB = (n) => `${(n / 1_000_000).toFixed(1)} MB`;

const sha256 = async (path) => {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
};

/** HEAD first: the server's byte count is what tells us a local copy is already whole. */
async function head(url) {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`eia.gov answered ${res.status} for HEAD ${url}`);
  return { bytes: Number(res.headers.get('content-length')), lastModified: res.headers.get('last-modified') };
}

async function download(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`eia.gov answered ${res.status} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
}

/** What the last run recorded, by file name — so a skipped file keeps the stamp of the download that actually happened. */
const previous = new Map();
const record = join(RAW, 'PROVENANCE.json');
if (existsSync(record)) {
  for (const f of JSON.parse(readFileSync(record, 'utf8')).files ?? []) previous.set(f.file, f);
}

mkdirSync(RAW, { recursive: true });
const files = [];
for (const { table, name } of FILES) {
  const url = `${BASE}/${name}`;
  const path = join(RAW, name);
  const remote = await head(url);
  const whole = !FORCE && existsSync(path) && statSync(path).size === remote.bytes;
  if (whole) process.stderr.write(`  ${name}: already ${MB(remote.bytes)} on disk — skipped\n`);
  else {
    process.stderr.write(`  ${name}: downloading ${MB(remote.bytes)}…\n`);
    await download(url, path);
  }
  const bytes = statSync(path).size;
  if (bytes !== remote.bytes) throw new Error(`${name}: wrote ${bytes} bytes, server said ${remote.bytes}`);
  const digest = await sha256(path);
  const before = previous.get(`raw/${name}`);
  // the stamp travels with the BYTES: reuse it only when the file on disk is the one that stamp described
  const retrievedAt = whole && before?.sha256 === digest && typeof before.retrievedAt === 'string' ? before.retrievedAt : new Date().toISOString();
  files.push({ table, file: `raw/${name}`, url, bytes, lastModified: remote.lastModified, sha256: digest, retrievedAt });
}

const provenance = {
  source: 'Hourly Electric Grid Monitor — six-month bulk files',
  agency: 'U.S. Energy Information Administration (EIA)',
  page: 'https://www.eia.gov/electricity/gridmonitor/dashboard/electric_overview/US48/US48',
  period: PERIOD.replace(/_/g, ' '),
  license: 'Public domain — a work of the United States Government (17 U.S.C. § 105).',
  // WHY both dates: the acknowledgement EIA asks for names the publication, and this
  // slice's bytes are the January–June 2025 file. A credit carrying only the month it
  // was downloaded would read as though the data were from 2026, which it is not.
  acknowledgement: 'Source: U.S. Energy Information Administration, Hourly Electric Grid Monitor, six-month file for January–June 2025 (retrieved September 2026)',
  trademark: "EIA's logo and seal are trademarks and are NOT reproduced here; the acknowledgement above is the only credit used.",
  reuseTerms: 'https://www.eia.gov/about/copyrights_reuse.php',
  files,
  // the whole download is as recent as its most recent file — no clock is read when nothing moved
  retrievedAt: files.map((f) => f.retrievedAt).sort().at(-1),
  note: 'The bulk files are git-ignored: too large to commit. They are the input to npm run grid:generate, which cuts the committed slice and repeats these facts in data/grid/PROVENANCE.json.',
};
writeFileSync(join(RAW, 'PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');
process.stderr.write(`wrote ${files.length} files → data/grid/raw/ + raw/PROVENANCE.json\n`);
