/**
 * THE GRID SLICE GENERATOR — the downloaded bulk files in, three committed files out.
 *
 *   npm run data:grid       → data/grid/raw/{two bulk CSVs, PROVENANCE.json}   (149 MB, git-ignored)
 *   npm run grid:generate   → data/grid/{balance.csv, interchange.csv, PROVENANCE.json}
 *
 * It cuts the window and the columns `src/grid/slice.ts` names (streaming — the
 * interchange file is 101 MB), then reads the two files it just wrote back
 * through the same ETL the server will run, and writes the counts that ETL
 * reports into the provenance. So the numbers in `PROVENANCE.json` are not the
 * cut's opinion of the slice; they are what the slice actually parses to.
 *
 * Nothing here reads a clock: the provenance carries the FETCHER's retrieval
 * time and a SHA-256 of each downloaded file, which are facts about the input,
 * and no stamp of its own — so two runs over one download are byte-identical.
 * Regenerate after `npm run data:grid`; never edit the outputs by hand.
 */
import { writeFileSync } from 'node:fs';
import { sliceProvenance } from '../src/grid/slice.js';
import { cutSlice, loadGrid, rawProvenance, SLICE_PROVENANCE } from '../src/grid/snapshot.js';

const GENERATOR = 'scripts/grid-generate.ts';

async function main(): Promise<void> {
  const raw = rawProvenance();
  const sliced = await cutSlice(raw);
  const tables = loadGrid();
  writeFileSync(SLICE_PROVENANCE, JSON.stringify(sliceProvenance(raw, sliced, tables.counts, GENERATOR), null, 2) + '\n');
  const c = tables.counts;
  process.stderr.write(
    `grid: balance ${String(sliced.balance.kept)}/${String(sliced.balance.read)} rows kept, interchange ${String(sliced.interchange.kept)}/${String(sliced.interchange.read)} kept ` +
      `→ ${String(c.authorities)} authorities (${String(c.externalAuthorities)} external), ${String(c.links)} links (${String(c.linksNeverReported)} never reported), ${String(c.hours)} hours ` +
      `→ data/grid/{balance.csv, interchange.csv, PROVENANCE.json}\n`,
  );
}

void main();
