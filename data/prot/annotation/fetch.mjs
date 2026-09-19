/**
 * WHAT IS ALREADY KNOWN ABOUT THIS ENTRY'S SEQUENCES — the functional
 * annotation stage's whole dataset, and it is TWO downloads per accession
 * rather than three.
 *
 * NOTHING HERE IS COMPUTED and nothing here is re-worded. Every value this
 * stage lands is a word somebody else published: UniProt's own feature TYPE
 * (`Active site`, `Disulfide bond`), UniProt's own DESCRIPTION verbatim
 * (`Proton acceptor`), the Pfam accession InterPro matched, and the IEDB's own
 * epitope identifier. What this desk computes is WHERE each of those sits on
 * this entry's rows, which is `src/prot/mapping.ts`'s four hops and not this
 * script's business.
 *
 * ── THE THIRD READ IS NOT HERE BECAUSE IT IS ALREADY COMMITTED ─────────────
 * The domain a residue is in comes from InterPro's Pfam match record, and the
 * conservation stage already downloads exactly that — `<ACCESSION>-pfam.json`,
 * beside this folder, written by `data/prot/conservation/fetch.mjs`. Two
 * downloads of one record would be two answers to one question the day Pfam
 * bumps a version, so this stage READS THE COMMITTED ONE and the provenance
 * record below points at it rather than copying it. Same for the archive's
 * entity records, which carry the four hops.
 *
 * So this script downloads the two things nothing else here has:
 *
 *   1. the sequence's own FEATURES, from UniProt, asked for BY FIELD — the
 *      `?fields=` parameter is UniProt's own way of asking for a shape, the
 *      way GraphQL is the archive's, and it is what turns a 19,646-byte entry
 *      record into a 776-byte fixture a reader can check by eye.
 *        → `<ACCESSION>-uniprot.json`
 *   2. the EPITOPES already recorded for it, from the IEDB's query API.
 *        → `<ACCESSION>-epitopes.json`
 *
 * WHICH FIELDS ARE ASKED FOR IS ITSELF A STATEMENT, and the page makes it: an
 * absent `Modified residue` means NOBODY ASKED is a different sentence from
 * there are none, and a reader can only tell the two apart if the list of
 * fields is on the page beside the answer. It is (`src/prot/annotation.ts` ·
 * `UNIPROT_SITE_FIELDS`), which is the `INTERACTION_COLUMNS` · `kind`
 * precedent one service along.
 *
 * AND THE EPITOPE SERVICE ANSWERS `[]` FOR BOTH OF THIS ENTRY'S ACCESSIONS.
 * That is a real answer — asked, and none are known — and it is committed as
 * such, so the example's "no known epitopes" is a FACT this repository holds
 * rather than a silence a missing file could also produce.
 *
 *   node data/prot/annotation/fetch.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * THE ENTRY IS READ, NOT TYPED — off the committed structure file's own HEADER
 * record, exactly as the sibling script beside this one reads it and as
 * `src/prot/etl.ts` · `entryId` reads it at runtime.
 */
const structure = readFileSync(path.join(here, '..', '1ay7.pdb'), 'utf8');
const ENTRY = structure.split('\n')[0].slice(62, 66).trim();
if (!/^[1-9][A-Za-z0-9]{3}$/.test(ENTRY)) throw new Error(`the committed structure file's HEADER record does not carry an entry id (read "${ENTRY}")`);

/**
 * THE ACCESSIONS ARE READ OFF THE COMMITTED ENTITY RECORD, not asked for
 * again.
 *
 * `../conservation/<ENTRY>-entities.json` is the archive's own answer to which
 * UniProt sequence each polymer entity was matched to, and it is already in
 * this repository. Asking the archive a second time here would be a second
 * answer to that question, and the day SIFTS re-maps a chain the two files
 * would disagree with nobody to arbitrate.
 */
const entities = JSON.parse(readFileSync(path.join(here, '..', 'conservation', `${ENTRY}-entities.json`), 'utf8'));
const accessions = [
  ...new Set(
    (entities.polymer_entities ?? []).flatMap((entity) =>
      (entity.rcsb_polymer_entity_align ?? []).flatMap((align) => (align.reference_database_name === 'UniProt' && typeof align.reference_database_accession === 'string' ? [align.reference_database_accession] : [])),
    ),
  ),
];
if (accessions.length === 0) throw new Error(`no polymer entity of "${ENTRY}" carries a UniProt reference — there is nothing already known about a sequence nobody has named`);

/**
 * EXACTLY THE FEATURE FIELDS THIS STAGE LANDS, and not one field more — the
 * same list `src/prot/annotation.ts` · `UNIPROT_SITE_FIELDS` declares, because
 * the committed bytes and the live read may not be answers to two different
 * questions.
 *
 * They are the SITE features: what is known about a RESIDUE. The ones left out
 * are left out for stated reasons rather than by taste — `Beta strand`,
 * `Helix` and `Turn` are secondary structure, which this desk already reads
 * off the file's own coordinates and would be citing UniProt for a second
 * opinion on; `Chain` covers every residue and so says nothing about any one
 * of them; `Mutagenesis` and `Sequence conflict` are facts about an
 * EXPERIMENT and about a reading of the sequence, not about what the residue
 * does.
 */
const SITE_FIELDS = ['ft_act_site', 'ft_binding', 'ft_site', 'ft_disulfid', 'ft_crosslnk', 'ft_mod_res', 'ft_carbohyd', 'ft_lipid'];

/** The two services, in one place, so no read below spells a URL. */
const SERVICES = {
  uniprot: (accession) => `https://rest.uniprot.org/uniprotkb/${accession}.json?fields=${['accession', 'sequence', ...SITE_FIELDS].join(',')}`,
  epitopes: (accession) => `https://query-api.iedb.org/epitope_search?parent_source_antigen_iri=eq.UNIPROT:${accession}`,
};

/** One text read, with the status named when it fails — every write below is of something a service really answered. */
async function readText(at) {
  const res = await fetch(at);
  if (!res.ok) throw new Error(`${at} answered ${String(res.status)} ${res.statusText}`);
  return await res.text();
}

const digest = (text) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
const write = (file, text) => {
  writeFileSync(path.join(here, file), text);
  return { file, bytes: Buffer.byteLength(text, 'utf8'), sha256: digest(text) };
};

// ── the two reads, per accession ────────────────────────────────────────────

const uniprotFiles = [];
const epitopeFiles = [];
for (const accession of accessions) {
  const record = JSON.parse(await readText(SERVICES.uniprot(accession)));
  if (record.primaryAccession !== accession) throw new Error(`${SERVICES.uniprot(accession)} answered a record for "${String(record.primaryAccession)}" and not for ${accession}`);
  uniprotFiles.push({
    accession,
    sequenceLength: record.sequence?.length ?? null,
    // THE TYPES THE SERVICE REALLY ANSWERED, counted — so the provenance says
    // what arrived rather than what was asked for
    features: (record.features ?? []).map((f) => `${f.type} ${String(f.location?.start?.value)}..${String(f.location?.end?.value)}`),
    ...write(`${accession}-uniprot.json`, `${JSON.stringify(record, null, 2)}\n`),
  });

  const answered = JSON.parse(await readText(SERVICES.epitopes(accession)));
  if (!Array.isArray(answered)) throw new Error(`${SERVICES.epitopes(accession)} answered something that is not a list of epitopes`);
  epitopeFiles.push({
    accession,
    // ZERO IS AN ANSWER and is recorded as one. See the file header.
    epitopes: answered.length,
    ...write(`${accession}-epitopes.json`, `${JSON.stringify(answered, null, 2)}\n`),
  });
}

// ── the record ──────────────────────────────────────────────────────────────

writeFileSync(
  path.join(here, 'PROVENANCE.json'),
  `${JSON.stringify(
    {
      what: 'What is already KNOWN about this entry’s sequences — the functional annotation stage’s evidence. Nothing here is computed and nothing is re-worded: every value the stage lands is the source’s own word, and the only thing this desk computes is where each of them sits on this entry’s own rows.',
      entry: ENTRY,
      uniprot: {
        service: 'UniProt (UniProtKB) — the reviewed entry for one accession, asked for BY FIELD',
        at: SERVICES.uniprot('<ACCESSION>'),
        asked: ['accession', 'sequence', ...SITE_FIELDS],
        reads:
          'the SITE features of the sequence — what is known about a RESIDUE — each with the source’s own TYPE word, its own DESCRIPTION verbatim and the reference positions it covers, plus the sequence length the positions are of. Secondary structure, the whole-chain `Chain` feature, `Mutagenesis` and `Sequence conflict` are NOT asked for, and the page says which fields were asked for so an absent type reads as nobody asked rather than as there are none.',
        license: {
          statement:
            'UniProt is released under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence: “We have chosen to apply the Creative Commons Attribution 4.0 International (CC BY 4.0) License to all copyrightable parts of our databases.”',
          dedication: 'CC BY 4.0',
          policyPage: 'https://www.uniprot.org/help/license',
          attribution: 'The UniProt Consortium, UniProt: the Universal Protein Knowledgebase. The desk names the accession wherever it shows a word read out of one of these records, and every such word is quoted rather than paraphrased.',
        },
        files: uniprotFiles,
      },
      epitopes: {
        service: 'IEDB (Immune Epitope Database) — the query API’s epitope search, by source antigen',
        at: SERVICES.epitopes('<ACCESSION>'),
        reads: 'every epitope the database records for that source antigen, with the positions of the antigen it covers.',
        answered:
          'BOTH accessions of this entry answer `[]`. That is a real answer — the service was asked and named none — and it is committed as such so the example’s “no known epitopes” is a fact this repository holds rather than a silence a missing file would also produce.',
        license: {
          statement:
            'IEDB data are free to use: “The IEDB is freely available to the scientific community” and its contents are released for use without restriction, with attribution requested by citation.',
          policyPage: 'https://www.iedb.org/citeiedb_v3.php',
          attribution: 'Vita R, et al. The Immune Epitope Database (IEDB): 2018 update. Nucleic Acids Res. The desk names the service and the accession it asked about wherever it says how many epitopes are known.',
        },
        files: epitopeFiles,
      },
      reused: {
        what: 'Two of this stage’s four reads are NOT downloaded here, because this repository already holds them.',
        files: [`../conservation/${ENTRY}-entities.json`, '../conservation/<ACCESSION>-pfam.json'],
        why: 'the archive’s entity record carries the four hops from a UniProt position to a row of this desk (`src/prot/mapping.ts`), and InterPro’s Pfam match record carries the domain ranges — both are already downloaded, recorded and committed by `data/prot/conservation/fetch.mjs`. A second copy would be a second answer to one question the day either source revises, with nobody to arbitrate, so this stage reads those files and this entry points at them.',
      },
      retrievedAt: new Date().toISOString(),
      note: 'Regenerating re-downloads both. A UniProt release can add, move or re-describe a feature, and the IEDB gains epitopes continuously — which changes the digests recorded here, which is the point of recording them.',
    },
    null,
    2,
  )}\n`,
);

console.log(`entry ${ENTRY}: ${String(accessions.length)} accessions`);
for (const f of uniprotFiles) console.log(`  ${f.accession} — ${String(f.features.length)} site features over ${String(f.sequenceLength)} positions → ${f.file} (${String(f.bytes)} bytes)`);
for (const f of epitopeFiles) console.log(`  ${f.accession} — ${String(f.epitopes)} epitopes recorded → ${f.file} (${String(f.bytes)} bytes)`);
