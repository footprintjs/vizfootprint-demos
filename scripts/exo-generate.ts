/**
 * THE EXOPLANET SLICE'S PROVENANCE — the committed CSVs in, PROVENANCE.json out.
 *
 *   npm run data:exo         → data/exo/{ps.csv, pscomppars.csv, FETCH.json}
 *   npm run exo:generate     → data/exo/PROVENANCE.json
 *
 * The grid's generator CUTS its slice, because its fetch downloads 149 MB of
 * bulk CSV. This one cuts nothing: the cut is the TAP query, so the fetch wrote
 * the committed files itself. What is left is the half that matters — reading
 * those files back through the SAME ETL the server and the page will run, and
 * writing the counts that ETL reports. The numbers in `PROVENANCE.json` are
 * therefore not the cut's opinion of the slice; they are what the slice
 * actually parses to.
 *
 * It also holds the two records to each other: every column the ETL reads must
 * appear in the committed query for its table. A query that stopped selecting a
 * column the ETL reads would otherwise produce a table of nulls that looks like
 * data, and the failure would surface as an empty chart rather than a sentence.
 *
 * Nothing here reads a clock: the provenance carries the FETCH's retrieval times
 * and the digests of the files it wrote, and no stamp of its own — so two runs
 * over one download are byte-identical. Regenerate after `npm run data:exo`;
 * never edit the output by hand.
 */
import { writeFileSync } from 'node:fs';
import { CONFIRMED_ONLY, ETL_COLUMNS, sliceProvenance } from '../src/exo/slice.js';
import { fetchRecord, loadExo, SLICE_PROVENANCE } from '../src/exo/snapshot.js';

const GENERATOR = 'scripts/exo-generate.ts';

/** Every column the ETL reads must be in the query that fetched it, and the one judgement must still be in force. */
function holdRecordsTogether(fetched: ReturnType<typeof fetchRecord>): void {
  for (const [table, columns] of Object.entries(ETL_COLUMNS)) {
    const entry = fetched.tables.find((t) => t.table === table);
    if (entry === undefined) throw new Error(`data/exo/FETCH.json records no "${table}" query — re-run \`node data/exo/fetch.mjs\``);
    const missing = columns.filter((c) => !entry.columns.includes(c));
    if (missing.length > 0) throw new Error(`the ETL reads ${missing.join(', ')} from "${table}" and the committed query does not select ${missing.length === 1 ? 'it' : 'them'} — widen data/exo/fetch.mjs and re-fetch`);
  }
  const ps = fetched.tables.find((t) => t.table === 'ps');
  if (ps?.where !== CONFIRMED_ONLY) throw new Error(`the committed ps query narrows by ${JSON.stringify(ps?.where)} and src/exo/slice.ts states ${JSON.stringify(CONFIRMED_ONLY)} — one of the two is wrong`);
}

function main(): void {
  const fetched = fetchRecord();
  holdRecordsTogether(fetched);
  const { counts } = loadExo();
  writeFileSync(SLICE_PROVENANCE, JSON.stringify(sliceProvenance(fetched, counts, GENERATOR), null, 2) + '\n');
  process.stderr.write(
    `exo: ${String(counts.measurements)} measurements over ${String(counts.planets)} planets, ` +
      `${String(counts.references)} references (${String(counts.publications)} publications, ${String(counts.archiveSources)} the archive itself) ` +
      `→ ${String(counts.calculatedRadii)} composite radii and ${String(counts.calculatedMasses)} masses came from no paper ` +
      `→ data/exo/PROVENANCE.json\n`,
  );
}

main();
