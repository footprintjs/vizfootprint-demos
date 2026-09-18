/**
 * THE CURATED ALIGNMENTS THIS DESK CITES, and the four records that say where
 * our residues sit in them — the conservation stage's whole dataset.
 *
 * NOTHING HERE IS A SEQUENCE SEARCH. The stage was declared unavailable for
 * eight releases on the premise that "how conserved is this residue" needs a
 * database search no browser can make. For a protein in a KNOWN FAMILY that
 * premise is wrong: somebody else has already curated, published and VERSIONED
 * the alignment, and three services answer a browser directly with
 * `access-control-allow-origin: *`. So the alignment is CITED and only the
 * PLACEMENT of our residues in it is computed (`src/prot/placement.ts`).
 *
 * Four reads, and each one is a file below:
 *
 *   1. the archive's own polymer-entity record, over GraphQL — the entity
 *      sequence, the UniProt accession SIFTS assigned it, the aligned regions
 *      that carry a UniProt position to an entity position, and the
 *      author↔entity residue-number mapping. One request, both chains.
 *        → `<ENTRY>-entities.json`
 *   2. which Pfam family each of those accessions belongs to, and over which
 *      residues — InterPro's own match record.
 *        → `<ACCESSION>-pfam.json`
 *   3. the family's SEED alignment, in Stockholm — the curated work this desk
 *      cites, with its accession AND VERSION in its own `#=GF AC` header.
 *        → `<PFAM>-seed.sto`
 *
 * WHY THE SEED AND NOT THE FULL alignment: the full PF00545 alignment is
 * 3,982 sequences and 2.9 MB of text, which is seventeen times the structure
 * file this desk already carries. The seed is 283 sequences and 142 KB. Those
 * are DIFFERENT CLAIMS about how well a column is known, so the page says which
 * one it scored over and how many sequences that was — it is read out of the
 * file's own `#=GF SQ` line, never typed.
 *
 * WHAT THE WIRE SENDS AND WHAT IS COMMITTED. The alignment endpoint answers
 * `content-type: text/plain` with `content-encoding: gzip` — 27,581 bytes on
 * the wire for 142,618 bytes of Stockholm. A content coding is transport, not
 * the resource, so what is committed is the TEXT and the digest below is the
 * text's; both byte counts are recorded so neither number can be mistaken for
 * the other.
 *
 *   node data/prot/conservation/fetch.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * THE ENTRY IS READ, NOT TYPED — off the committed structure file's own HEADER
 * record, which is where `src/prot/etl.ts` · `entryId` reads it too.
 *
 * Two spellings of one name is the thing this repository refuses, and the
 * sibling script beside this one already declares `1AY7` because it is the
 * script that downloads it. This one is downstream of those bytes, so it asks
 * them.
 */
const structure = readFileSync(path.join(here, '..', '1ay7.pdb'), 'utf8');
const ENTRY = structure.split('\n')[0].slice(62, 66).trim();
if (!/^[1-9][A-Za-z0-9]{3}$/.test(ENTRY)) throw new Error(`the committed structure file's HEADER record does not carry an entry id (read "${ENTRY}")`);

/** The three services, in one place, so no read below spells a URL. */
const SERVICES = {
  entities: 'https://data.rcsb.org/graphql',
  matches: (accession) => `https://www.ebi.ac.uk/interpro/api/entry/pfam/protein/uniprot/${accession}/`,
  alignment: (pfam) => `https://www.ebi.ac.uk/interpro/wwwapi/entry/pfam/${pfam}/?annotation=alignment:seed`,
};

/**
 * EXACTLY THE FIELDS THE FOUR HOPS READ, and not one field more.
 *
 * The REST record for one entity is 13,827 bytes, most of it a taxonomy
 * lineage nothing here reads. A GraphQL query is the archive's own way of
 * asking for a shape, so the fixture is small enough to read by eye — which is
 * what a committed fixture is for.
 */
const ENTITY_QUERY = `query($id:String!){entry(entry_id:$id){rcsb_id polymer_entities{rcsb_id entity_poly{pdbx_seq_one_letter_code_can rcsb_entity_polymer_type}rcsb_polymer_entity_container_identifiers{entity_id auth_asym_ids}rcsb_polymer_entity_align{reference_database_name reference_database_accession provenance_source aligned_regions{entity_beg_seq_id ref_beg_seq_id length}}polymer_entity_instances{rcsb_polymer_entity_instance_container_identifiers{auth_asym_id asym_id entity_id auth_to_entity_poly_seq_mapping}}}}}`;

/** One text read, with the status named when it fails — every write below is of something a service really answered. */
async function readText(at, init) {
  const res = await fetch(at, init);
  if (!res.ok) throw new Error(`${at} answered ${String(res.status)} ${res.statusText}`);
  return await res.text();
}

const digest = (text) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
const write = (file, text) => {
  writeFileSync(path.join(here, file), text);
  return { file, bytes: Buffer.byteLength(text, 'utf8'), sha256: digest(text) };
};

/** One `#=GF` value out of a Stockholm header — read, never typed. See the file header. */
const gf = (text, tag) => {
  const line = text.split('\n').find((l) => l.startsWith(`#=GF ${tag}`));
  return line === undefined ? null : line.slice(`#=GF ${tag}`.length).trim();
};

// ── 1. the archive's polymer-entity record, over GraphQL ────────────────────

const answered = await readText(SERVICES.entities, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: ENTITY_QUERY, variables: { id: ENTRY } }),
});
const parsed = JSON.parse(answered);
if (parsed.errors !== undefined) throw new Error(`the archive's GraphQL door answered errors: ${JSON.stringify(parsed.errors)}`);
const entities = parsed.data?.entry;
if (entities === undefined || entities === null) throw new Error(`the archive's GraphQL door carried no entry for "${ENTRY}"`);
const entitiesFile = write(`${ENTRY}-entities.json`, `${JSON.stringify(entities, null, 2)}\n`);

/** Every UniProt accession SIFTS assigned to a polymer entity of this entry, in entity order, once each. */
const accessions = [
  ...new Set(
    (entities.polymer_entities ?? []).flatMap((entity) =>
      (entity.rcsb_polymer_entity_align ?? []).flatMap((align) => (align.reference_database_name === 'UniProt' && typeof align.reference_database_accession === 'string' ? [align.reference_database_accession] : [])),
    ),
  ),
];
if (accessions.length === 0) throw new Error(`no polymer entity of "${ENTRY}" carries a UniProt reference — there is no family to look up`);

// ── 2. which Pfam family each accession is in ───────────────────────────────

const matchFiles = [];
const families = new Map();
for (const accession of accessions) {
  const text = await readText(SERVICES.matches(accession));
  const record = JSON.parse(text);
  matchFiles.push({ accession, ...write(`${accession}-pfam.json`, `${JSON.stringify(record, null, 2)}\n`), families: (record.results ?? []).map((r) => r.metadata?.accession).filter((a) => typeof a === 'string') });
  for (const result of record.results ?? []) {
    const pfam = result.metadata?.accession;
    if (typeof pfam === 'string') families.set(pfam, result.metadata?.name ?? null);
  }
}

// ── 3. each family's seed alignment, in Stockholm ───────────────────────────

const alignmentFiles = [];
for (const [pfam, name] of families) {
  const at = SERVICES.alignment(pfam);
  const res = await fetch(at);
  if (!res.ok) throw new Error(`${at} answered ${String(res.status)} ${res.statusText}`);
  const wire = res.headers.get('content-length');
  const text = await res.text();
  if (!text.startsWith('# STOCKHOLM')) throw new Error(`${at} did not answer a Stockholm alignment (the first characters are "${text.slice(0, 40)}")`);
  const accession = gf(text, 'AC');
  if (accession === null || !accession.startsWith(pfam)) throw new Error(`${at} answered an alignment whose own #=GF AC is "${String(accession)}" and not a version of ${pfam}`);
  alignmentFiles.push({
    family: pfam,
    // THE VERSION IS THE FILE'S OWN, read out of its header. A version this
    // script typed would be a version that could drift from the bytes it names.
    accessionWithVersion: accession,
    name: gf(text, 'DE') ?? name,
    identifier: gf(text, 'ID'),
    declaredSequences: Number(gf(text, 'SQ')),
    authors: gf(text, 'AU'),
    citation: [gf(text, 'RT'), gf(text, 'RA'), gf(text, 'RL')].filter((p) => p !== null).join(' '),
    wireBytes: wire === null ? null : Number(wire),
    ...write(`${pfam}-seed.sto`, text),
  });
}

// ── the record ──────────────────────────────────────────────────────────────

writeFileSync(
  path.join(here, 'PROVENANCE.json'),
  `${JSON.stringify(
    {
      what: 'The curated family alignments the conservation stage CITES, and the three records that place this entry’s own residues in them. Nothing here is a sequence search: the alignments are somebody else’s published work and are named as such, with the accession and the version read out of each file’s own Stockholm header.',
      entry: ENTRY,
      entities: {
        service: 'RCSB Protein Data Bank — the archive’s own data API, over GraphQL',
        at: SERVICES.entities,
        query: ENTITY_QUERY,
        reads: 'the entity sequence, the UniProt accession SIFTS assigned it, `rcsb_polymer_entity_align[].aligned_regions` (a UniProt position to an entity position) and `auth_to_entity_poly_seq_mapping` (an entity position to the author residue number this desk keys its rows by)',
        license: {
          statement:
            'wwPDB data files carry no copyright restriction: the worldwide Protein Data Bank releases its archive into the public domain under the CC0 1.0 Universal dedication, for commercial and non-commercial use alike.',
          dedication: 'CC0 1.0 Universal',
          policyPage: 'https://www.wwpdb.org/about/usage-policies',
        },
        ...entitiesFile,
      },
      matches: {
        service: 'InterPro (EMBL-EBI) — the Pfam families matched to a UniProt accession, with the residue range of each match',
        at: SERVICES.matches('<ACCESSION>'),
        license: {
          statement:
            'EMBL-EBI’s terms of use, last revised 5 February 2024: “Where EMBL-EBI presents scientific data generated by others, EMBL-EBI imposes no additional restriction on the use of the contributed data than those provided by the data owner” — and “EMBL-EBI expects attribution … for the use of any of its Data Resources and Tools in accordance with good scientific practice”.',
          policyPage: 'https://www.ebi.ac.uk/about/terms-of-use/',
          attribution: 'Each family’s own authors and primary citation travel with its alignment below, read out of the Stockholm header rather than paraphrased, and the desk prints the accession with its version wherever a number from it appears.',
        },
        files: matchFiles,
      },
      alignments: {
        service: 'InterPro (EMBL-EBI) — the Pfam family’s SEED alignment, in Stockholm format',
        at: SERVICES.alignment('<PFAM>'),
        chose:
          'the SEED and not the FULL alignment: PF00545’s full alignment is 3,982 sequences and 2,943,028 bytes of text, seventeen times the structure file this desk already carries. 283 sequences and 3,982 sequences are different claims about how well a column is known, so the page says which one it scored over and reads the count out of the file’s own #=GF SQ line.',
        encoding: 'the endpoint answers content-type text/plain with content-encoding gzip. A content coding is transport and not the resource, so the TEXT is what is committed and `sha256` below is the text’s; `wireBytes` is what the response’s own content-length reported.',
        license: {
          statement:
            'EMBL-EBI’s terms of use, last revised 5 February 2024: “Where EMBL-EBI presents scientific data generated by others, EMBL-EBI imposes no additional restriction on the use of the contributed data than those provided by the data owner” — and “EMBL-EBI expects attribution … for the use of any of its Data Resources and Tools in accordance with good scientific practice”.',
          policyPage: 'https://www.ebi.ac.uk/about/terms-of-use/',
          attribution: 'The `authors` and `citation` fields of each alignment below are that family’s own #=GF AU and #=GF RT/RA/RL records, quoted verbatim from the download. The desk names the accession WITH ITS VERSION wherever it shows a score from it.',
        },
        files: alignmentFiles,
      },
      retrievedAt: new Date().toISOString(),
      note: 'Regenerating re-downloads all three. A Pfam release bumps the version in a #=GF AC line, which changes the accession the page prints and the digest recorded here — which is the point of reading the version out of the file rather than typing it.',
    },
    null,
    2,
  )}\n`,
);

console.log(`entry ${ENTRY}: ${String(accessions.length)} accessions, ${String(families.size)} families`);
for (const a of alignmentFiles) console.log(`  ${a.accessionWithVersion} — ${String(a.declaredSequences)} sequences, ${String(a.bytes)} bytes of Stockholm (${String(a.wireBytes)} on the wire) → ${a.file}`);
