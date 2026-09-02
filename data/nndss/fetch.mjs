#!/usr/bin/env node
/**
 * Fetch the NNDSS slice this demo runs on, and write its provenance beside it.
 *
 * Source: "NNDSS Weekly Data" on data.cdc.gov (dataset x9gk-5huc), via the
 * Socrata SODA API. One row per (reporting area, MMWR year, MMWR week,
 * disease label); the count columns come with a FLAG column each — the flags
 * are the point (see src/nndss/absence.ts).
 *
 * The slice is deliberately small enough to commit: a handful of diseases,
 * two MMWR years, every reporting area. Re-run to refresh; the snapshot and
 * PROVENANCE.json move together and are never edited by hand.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = 'x9gk-5huc';
const BASE = `https://data.cdc.gov/resource/${DATASET}.json`;
const YEARS = ['2025', '2026'];
/** Exact NNDSS labels (probed from the dataset on 2026-09-01). */
const LABELS = [
  'Pertussis',
  'Measles, Indigenous',
  'Measles, Imported',
  'Salmonellosis (excluding Salmonella Typhi infection and Salmonella Paratyphi infection)',
  'Hepatitis A, Confirmed',
  'Giardiasis',
  'Cryptosporidiosis',
  'Gonorrhea',
  'Arboviral diseases, West Nile virus disease',
  'Legionellosis',
  'Mumps',
  // the four below are the diseases whose CURRENT-WEEK cells carried `U` in 2026 —
  // without them the slice would show "unavailable" only in the prior-year column
  'Hepatitis B, chronic, Confirmed',
  'Hepatitis C, acute, Confirmed',
  'Carbapenemase-Producing Organisms (CPO), Total',
  'Candida auris, clinical',
];
const FIELDS = ['states', 'year', 'week', 'label', 'm1', 'm1_flag', 'm2', 'm2_flag', 'm3', 'm3_flag', 'm4', 'm4_flag', 'location1', 'location2', 'geocode'];
const PAGE = 50_000;

const q = (s) => `'${s.replace(/'/g, "''")}'`;
const where = `year in (${YEARS.map(q).join(',')}) AND label in (${LABELS.map(q).join(',')})`;

async function page(offset) {
  const url = `${BASE}?$select=${FIELDS.join(',')}&$where=${encodeURIComponent(where)}&$order=sort_order&$limit=${PAGE}&$offset=${offset}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`data.cdc.gov answered ${res.status} for offset ${offset}`);
  return res.json();
}

const rows = [];
for (let offset = 0; ; offset += PAGE) {
  const batch = await page(offset);
  rows.push(...batch);
  process.stderr.write(`  fetched ${rows.length} rows\n`);
  if (batch.length < PAGE) break;
}

// CSV, one header, every field a column; the geocode point becomes lon/lat.
const csvField = (v) => {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = [...FIELDS.filter((f) => f !== 'geocode'), 'lon', 'lat'];
const lines = [header.join(',')];
for (const r of rows) {
  const coords = r.geocode?.coordinates ?? [];
  lines.push([...FIELDS.filter((f) => f !== 'geocode').map((f) => csvField(r[f])), csvField(coords[0]), csvField(coords[1])].join(','));
}
mkdirSync(HERE, { recursive: true });
writeFileSync(join(HERE, 'snapshot.csv'), lines.join('\n') + '\n');

const provenance = {
  source: 'NNDSS Weekly Data — data.cdc.gov',
  dataset: DATASET,
  url: `https://data.cdc.gov/NNDSS/NNDSS-Weekly-Data/${DATASET}`,
  api: BASE,
  attribution: 'Office of Public Health Data, Surveillance, and Technology, Centers for Disease Control and Prevention',
  license: 'Work of the United States Government — public domain (17 U.S.C. § 105)',
  query: { where, fields: FIELDS, order: 'sort_order' },
  years: YEARS,
  labels: LABELS,
  retrievedAt: new Date().toISOString(),
  rows: rows.length,
  note: 'Provisional weekly counts; CDC revises them. The snapshot is a slice, never edited by hand; re-run data:fetch to refresh.',
};
writeFileSync(join(HERE, 'PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');
process.stderr.write(`wrote ${rows.length} rows → data/nndss/snapshot.csv + PROVENANCE.json\n`);
