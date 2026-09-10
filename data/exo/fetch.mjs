#!/usr/bin/env node
/**
 * Fetch the two NASA Exoplanet Archive tables this demo runs on, and write a
 * record of the download beside them.
 *
 *   npm run data:exo                 # download what is not already on disk
 *   npm run data:exo -- --force      # download again regardless
 *
 * Source: the NASA Exoplanet Archive's Table Access Protocol (TAP) service.
 * Two queries, two committed CSVs:
 *
 *   ps           one row per PUBLISHED MEASUREMENT of a confirmed planet —
 *                every solution any paper published, so one planet has as many
 *                rows as papers that measured it.
 *   pscomppars   one row per PLANET — the archive's own COMPOSITE, one number
 *                per parameter, each carrying a `*_reflink` that says which
 *                publication that number was taken from.
 *
 * Unlike the grid demo's bulk files, the cut IS the query: TAP answers with the
 * rows and the columns asked for, so what lands on disk is already the
 * committed slice and there is nothing to cut afterwards. `raw/` is git-ignored
 * and stays empty here — it is where an operator who wants the WHOLE table
 * (every column, candidates included) puts it, because that pull is 100 MB+ and
 * this repository does not commit it.
 *
 * THE PREFLIGHT IS THE POINT. Before either query runs, this script reads
 * `TAP_SCHEMA.columns` for both tables and refuses BY NAME any column the
 * archive does not have. A query that names a column TAP does not know answers
 * with an error page or, worse, a column of empty cells that looks like data;
 * a preflight turns that into one sentence naming the column and the table.
 * It is also how this demo learned two facts it would otherwise have guessed:
 * `pscomppars` has no `pl_refname` (its provenance is per-parameter, in
 * `*_reflink`), and `ps` has no `*_reflink` at all.
 *
 * The acknowledgement sentence and the two DOIs below are COPIED from the
 * archive's own pages named in ATTRIBUTION — not composed here, and no DOI is
 * invented. They are written into `FETCH.json` so the credit travels with the
 * bytes.
 *
 * A retrieval time belongs to a DOWNLOAD. A run that finds a file already on
 * disk downloads nothing, so it keeps that file's previous stamp rather than
 * writing a new one — otherwise re-running this script would change the
 * slice's provenance, and therefore its bytes, without a single row moving.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';

/**
 * THE ONE JUDGEMENT THE CUT MAKES, and it is a judgement, so it is named here
 * and repeated in `PROVENANCE.json`.
 *
 * `ps` holds 40,144 rows, and only 20,598 of them are published literature
 * solutions: the other 19,546 are PROJECT CANDIDATE rows — six Kepler KOI
 * pipeline lists, TESS project candidates, and papers' own candidate
 * solutions. Keeping them would mix a pipeline's re-fit of the same star into
 * "how many publications measured this planet", which is the question view 2
 * asks; and `pscomppars`, the composite this demo compares against, is built
 * over confirmed planets only, so the two tables would not describe the same
 * set. `soltype` is KEPT as a column precisely so a reader can check the cut
 * with grep rather than with trust: every committed row says the same word.
 */
const CONFIRMED = "soltype = 'Published Confirmed'";

/**
 * The columns kept from each table, in the archive's own spelling. The
 * preflight checks every one of them, and the query is built from this list —
 * so the file, the query in `FETCH.json` and the check can never disagree.
 */
const TABLES = [
  {
    table: 'ps',
    file: 'ps.csv',
    doi: '10.26133/NEA12',
    doiName: 'Planetary Systems Table',
    columns: [
      'pl_name',
      'hostname',
      'pl_letter',
      'sy_pnum',
      'soltype',
      'default_flag',
      'pl_refname',
      'pl_pubdate',
      'pl_orbper',
      'pl_rade',
      'pl_radeerr1',
      'pl_radeerr2',
      'pl_radelim',
      'pl_bmasse',
      'pl_bmasseerr1',
      'pl_bmasseerr2',
      'pl_bmasselim',
      'pl_bmassprov',
      'disc_year',
      'discoverymethod',
      'sy_dist',
    ],
    where: CONFIRMED,
    // an ORDER BY is what makes the download reproducible: TAP does not promise
    // a row order, and two fetches that differ only in row order would rewrite
    // a committed file for no change in what it says
    orderBy: 'pl_name, pl_pubdate, pl_refname',
  },
  {
    table: 'pscomppars',
    file: 'pscomppars.csv',
    doi: '10.26133/NEA13',
    doiName: 'Planetary Systems Composite Parameters Table',
    columns: [
      'pl_name',
      'hostname',
      'pl_letter',
      'sy_pnum',
      'pl_orbper',
      'pl_orbper_reflink',
      'pl_rade',
      'pl_radelim',
      'pl_rade_reflink',
      'pl_bmasse',
      'pl_bmasselim',
      'pl_bmassprov',
      'pl_bmasse_reflink',
      'disc_year',
      'discoverymethod',
      'disc_refname',
      'sy_dist',
    ],
    // no `where`: the composite table IS one row per confirmed planet
    orderBy: 'pl_name',
  },
];

/**
 * The credit, copied from the archive's own pages. Both URLs are in
 * `FETCH.json` so a reader can check the wording against its source.
 */
const ATTRIBUTION = {
  acknowledgementPage: 'https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html',
  acknowledgement:
    'This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.',
  citationNote:
    "The same page asks that work using data from a specific literature reference acknowledge that reference directly, and that the archive be cited as Christiansen et al. (2025), the archive's published overview paper (which replaces Akeson et al. 2013).",
  doiPage: 'https://exoplanetarchive.ipac.caltech.edu/docs/doi.html',
  license:
    'No explicit licence is published for these tables. The archive states the acknowledgement above as the condition of use, and this repository carries it; nothing here claims a licence the archive has not granted.',
};

const FORCE = process.argv.includes('--force');
const MB = (n) => `${(n / 1_000_000).toFixed(1)} MB`;
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
/** Data lines, header excluded — the row count a reader can check with `wc -l`. */
const rowsOf = (text) => text.trimEnd().split('\n').length - 1;

/** One TAP query, as CSV text. No timeout: the archive answers a 20,000-row query in minutes, not seconds. */
async function tap(query) {
  const url = `${TAP}?${new URLSearchParams({ query, format: 'csv' }).toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`the archive answered ${res.status} for ${query.slice(0, 80)}…\n${text.slice(0, 400)}`);
  // TAP reports a bad query as a 200 with an XML error document, so the SHAPE is
  // checked rather than the status: a CSV answer's first line is its header
  if (text.startsWith('<')) throw new Error(`the archive answered an error document for ${query.slice(0, 80)}…\n${text.slice(0, 400)}`);
  return text;
}

/** The columns the archive says a table has, read live. */
async function schemaOf(table) {
  const csv = await tap(`select column_name from TAP_SCHEMA.columns where table_name='${table}'`);
  return new Set(
    csv
      .split('\n')
      .slice(1)
      .map((line) => line.trim().replace(/^"|"$/g, ''))
      .filter((name) => name !== ''),
  );
}

/** The query this script runs, spelled once — the string written verbatim into `FETCH.json`. */
const queryFor = (t) => `select ${t.columns.join(',')} from ${t.table}${t.where === undefined ? '' : ` where ${t.where}`} order by ${t.orderBy}`;

/** What the last run recorded, by file — so a skipped file keeps the stamp of the download that actually happened. */
const previous = new Map();
const record = join(HERE, 'FETCH.json');
if (existsSync(record)) {
  for (const t of JSON.parse(readFileSync(record, 'utf8')).tables ?? []) previous.set(t.file, t);
}

const tables = [];
for (const t of TABLES) {
  // THE PREFLIGHT: every column, against the live schema, before a query runs
  const schema = await schemaOf(t.table);
  const missing = t.columns.filter((c) => !schema.has(c));
  if (missing.length > 0) throw new Error(`${t.table}: the archive has no column named ${missing.map((c) => JSON.stringify(c)).join(', ')} — the fetch is refused rather than guessed`);
  process.stderr.write(`  ${t.table}: ${String(t.columns.length)} columns checked against TAP_SCHEMA, all present\n`);

  const query = queryFor(t);
  const path = join(HERE, t.file);
  const onDisk = !FORCE && existsSync(path);
  if (onDisk) process.stderr.write(`  ${t.file}: already on disk — skipped (use --force to download again)\n`);
  else {
    process.stderr.write(`  ${t.file}: querying…\n`);
    writeFileSync(path, await tap(query));
  }
  const text = readFileSync(path, 'utf8');
  const digest = sha256(text);
  const before = previous.get(t.file);
  // the stamp travels with the BYTES: reuse it only when the file on disk is the one that stamp described
  const retrievedAt = onDisk && before?.sha256 === digest && typeof before.retrievedAt === 'string' ? before.retrievedAt : new Date().toISOString();
  tables.push({ table: t.table, file: t.file, doi: t.doi, doiName: t.doiName, query, columns: t.columns, ...(t.where === undefined ? {} : { where: t.where }), rows: rowsOf(text), bytes: Buffer.byteLength(text), sha256: digest, retrievedAt });
  process.stderr.write(`  ${t.file}: ${String(rowsOf(text))} rows, ${MB(Buffer.byteLength(text))}\n`);
}

const fetched = {
  source: 'NASA Exoplanet Archive — Table Access Protocol (TAP), synchronous queries',
  archive: 'NASA Exoplanet Archive, operated by the California Institute of Technology under contract with NASA (Exoplanet Exploration Program)',
  page: 'https://exoplanetarchive.ipac.caltech.edu/',
  service: TAP,
  ...ATTRIBUTION,
  tables,
  // the whole download is as recent as its most recent file — no clock is read when nothing moved
  retrievedAt: tables.map((t) => t.retrievedAt).sort().at(-1),
  note: 'The cut IS the query: TAP answered with these columns and these rows, so both CSVs are the committed slice and nothing was transformed after the download. `npm run exo:generate` reads them back through the ETL and writes data/exo/PROVENANCE.json, which repeats these facts and adds the counts the slice actually parses to.',
};
writeFileSync(record, JSON.stringify(fetched, null, 2) + '\n');
process.stderr.write(`wrote ${String(tables.length)} tables → data/exo/ + FETCH.json\n`);
