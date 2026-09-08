#!/usr/bin/env node
/**
 * Fetch the state populations this demo divides by, and write the provenance
 * beside them.
 *
 * Source: the U.S. Census Bureau's Population Estimates Program, file
 * `NST-EST2024-ALLDATA.csv` — the annual state-level estimates, served as a
 * plain file with no API key. We keep SUMLEV 040 (the 50 states, the District
 * of Columbia and Puerto Rico) and the single most recent estimate column,
 * because a rate needs one denominator per place and a column per year would
 * be a wider table nobody asked for.
 *
 * WHY the states only: NNDSS also files regions ("New England"), roll-ups
 * ("Total", "U.S. Residents") and territories the estimates file does not
 * carry (Guam, American Samoa, the Northern Mariana Islands, the U.S. Virgin
 * Islands) and one city (New York City). None of those gets a population here
 * — and none of them gets a rate either. That is the honest answer, and the
 * bring-over act COUNTS how many rows it could not follow rather than
 * inventing a denominator.
 *
 * The names are Census's own `NAME`, unedited, because that is what makes the
 * join a join: NNDSS files "Texas" and so does this file.
 *
 *   node data/population/fetch.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const URL_ = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/state/totals/NST-EST2024-ALLDATA.csv';
/** SUMLEV 040 is a state (010 the nation, 020 a region) — the only rows a jurisdiction join can use. */
const STATE_LEVEL = '040';
const ESTIMATE = 'POPESTIMATE2024';
const VINTAGE = 2024;

/** One CSV line into cells, honouring the quotes the Census file uses around names with commas. */
function cellsOf(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

const text = await (await fetch(URL_)).text();
const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
const head = cellsOf(lines[0]);
const at = (name) => {
  const index = head.indexOf(name);
  if (index < 0) throw new Error(`the Census file no longer carries a "${name}" column — it has ${head.join(', ')}`);
  return index;
};
const [sumlev, name, pop] = [at('SUMLEV'), at('NAME'), at(ESTIMATE)];

const rows = lines
  .slice(1)
  .map(cellsOf)
  .filter((cells) => cells[sumlev] === STATE_LEVEL)
  .map((cells) => ({ jurisdiction: cells[name], population: Number(cells[pop]) }))
  .sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));

if (rows.length === 0) throw new Error('no state rows in the Census file — nothing written');
for (const row of rows) {
  if (!Number.isFinite(row.population) || row.population <= 0) throw new Error(`"${row.jurisdiction}" has no usable population — nothing written`);
}

writeFileSync(join(HERE, 'population.csv'), `jurisdiction,population,vintage\n${rows.map((r) => `"${r.jurisdiction}",${r.population},${VINTAGE}\n`).join('')}`);
writeFileSync(
  join(HERE, 'PROVENANCE.json'),
  JSON.stringify(
    {
      source: 'Population Estimates Program (Vintage 2024) — U.S. Census Bureau',
      dataset: 'NST-EST2024-ALLDATA',
      url: URL_,
      page: 'https://www.census.gov/programs-surveys/popest.html',
      attribution: 'U.S. Census Bureau, Population Division',
      license: 'Work of the United States Government — public domain (17 U.S.C. § 105)',
      query: { keep: `SUMLEV = ${STATE_LEVEL}`, columns: ['NAME', ESTIMATE], estimate: ESTIMATE, vintage: VINTAGE },
      rows: rows.length,
      names: rows.map((r) => r.jurisdiction),
      retrievedAt: new Date().toISOString(),
      note: 'One denominator per place, as of July 1 of the vintage year. NNDSS regions, roll-ups, territories and New York City have no row here and get no rate; the bring-over act counts them rather than inventing a denominator.',
    },
    null,
    2,
  ),
);
console.log(`wrote ${rows.length} places`);
