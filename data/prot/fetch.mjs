/**
 * ONE PROTEIN COMPLEX, as the archive published it — the fourth desk's whole
 * dataset.
 *
 * `1AY7` is a two-chain protein–protein complex: chain A is the ribonuclease
 * the depositors call RIBONUCLEASE SA, chain B the inhibitor they call BARSTAR.
 * It was chosen for one reason and it is a size: 185 residues, 169 KB, which a
 * static site can carry beside three other desks. Nothing about the science is
 * asserted here that the file does not say itself — every word above is a
 * COMPND/TITLE record of the download, and the provenance record below quotes
 * them rather than paraphrasing.
 *
 * The file is committed VERBATIM. No trimming, no re-ordering, no conversion:
 * `src/prot/etl.ts` reads the atom records it needs and counts every record it
 * skips, so a reader can check the parse against the bytes the archive sent.
 *
 *   node data/prot/fetch.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The entry, and the one URL it comes from. */
const ENTRY = '1AY7';
const AT = `https://files.rcsb.org/download/${ENTRY}.pdb`;
const FILE = '1ay7.pdb';

/** One header record's value, read out of the file rather than retyped here. */
function record(text, tag) {
  return text
    .split('\n')
    .filter((line) => line.startsWith(tag))
    .map((line) => line.slice(10).trimEnd())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const res = await fetch(AT);
if (!res.ok) throw new Error(`${AT} answered ${String(res.status)} ${res.statusText}`);
const text = await res.text();
if (!text.startsWith('HEADER')) throw new Error(`${AT} did not answer a PDB file (no HEADER record)`);
writeFileSync(path.join(here, FILE), text);

const bytes = readFileSync(path.join(here, FILE));
writeFileSync(
  path.join(here, 'PROVENANCE.json'),
  JSON.stringify(
    {
      source: 'RCSB Protein Data Bank — the wwPDB archive entry, in the legacy PDB format',
      entry: ENTRY,
      at: AT,
      page: `https://www.rcsb.org/structure/${ENTRY}`,
      // quoted from the download's own records, never paraphrased
      header: record(text, 'HEADER'),
      title: record(text, 'TITLE'),
      molecules: record(text, 'COMPND'),
      experiment: record(text, 'EXPDTA'),
      depositors: record(text, 'AUTHOR'),
      primaryCitation: record(text, 'JRNL'),
      license: {
        statement:
          'wwPDB data files carry no copyright restriction: the worldwide Protein Data Bank releases its archive into the public domain under the CC0 1.0 Universal dedication, for commercial and non-commercial use alike.',
        dedication: 'CC0 1.0 Universal',
        policyPage: 'https://www.wwpdb.org/about/usage-policies',
        attribution:
          'CC0 asks for nothing, and the archive asks for one thing anyway: that the depositors of a structure and its primary citation be credited. Both ride above, verbatim from the file, and the desk prints them under the viewer.',
      },
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      retrievedAt: new Date().toISOString(),
      slice: {
        rule: 'the whole entry, byte for byte as files.rcsb.org answered it — one 169 KB file is not a slice of anything',
        loses:
          'nothing of this entry. What the DESK reads is narrower than the file: the ETL keeps the backbone N, CA and C atoms the dihedrals need and treats no water as protein. It COUNTS every record it skipped and why (src/prot/etl.ts · skippedOf), so the cut is reported in numbers the parse produced rather than in numbers somebody typed here.',
      },
      note: 'Regenerating re-downloads the entry. The archive revises entries (this one last in 1999), so a re-run that changes the bytes changes the sha256 above — which is the point of recording it.',
    },
    null,
    2,
  ),
);
console.log(`wrote ${FILE} (${String(bytes.length)} bytes)`);
