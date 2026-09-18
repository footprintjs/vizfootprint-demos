/**
 * THE FAKE ARCHIVE — the one test double the protein desk's suites share.
 *
 * `src/prot/archive.ts` takes `fetch` as an argument for exactly this reason:
 * every refusal the landing shows can be asserted against the shape a real
 * service answers with, and no test in this repository touches the network.
 * The shapes below were probed once against the live endpoints while the door
 * was written — a 204 for a search that matches nothing, a 404 carrying the
 * archive's own `message`, and `rcsb_entry_info` for the counts the gate reads.
 *
 * It lives here rather than in two suites for the reason `tests/deskStub.tsx`
 * gives: two spellings of one stub is the drift a shared one exists to end.
 */
import type { ArchiveAnswer, ArchiveFetch } from '../src/prot/archive.js';

/** One answer a fake door gives: a status and a body, the two things the doors read. */
export interface Answer {
  readonly status: number;
  readonly body: string;
}

/** A fake archive: answers by URL, and a log of every call — so "made no request" is an assertion and not a hope. */
export function fakeArchive(answerOf: (url: string) => Answer): { readonly doors: ArchiveFetch; readonly calls: string[] } {
  const calls: string[] = [];
  const doors: ArchiveFetch = (url) => {
    calls.push(url);
    const answered = answerOf(url);
    const answer: ArchiveAnswer = { ok: answered.status >= 200 && answered.status < 300, status: answered.status, text: () => Promise.resolve(answered.body) };
    return Promise.resolve(answer);
  };
  return { doors, calls };
}

/** The archive's own record for the committed entry, as the data API really answers it (the fields this desk reads). */
export const RECORD_1AY7 = JSON.stringify({
  struct: { title: 'RIBONUCLEASE SA COMPLEX WITH BARSTAR' },
  exptl: [{ method: 'X-RAY DIFFRACTION' }],
  rcsb_entry_info: {
    deposited_model_count: 1,
    deposited_polymer_entity_instance_count: 2,
    polymer_entity_count_protein: 2,
    polymer_entity_count_nucleic_acid: 0,
    deposited_atom_count: 1678,
    polymer_composition: 'heteromeric protein',
  },
});

/** A record shaped like the archive's, with whatever the test is about changed. */
export const recordWith = (info: Record<string, unknown>, over: Record<string, unknown> = {}): string =>
  JSON.stringify({
    struct: { title: 'A STRUCTURE' },
    exptl: [{ method: 'X-RAY DIFFRACTION' }],
    ...over,
    rcsb_entry_info: {
      deposited_model_count: 1,
      deposited_polymer_entity_instance_count: 2,
      polymer_entity_count_protein: 2,
      polymer_entity_count_nucleic_acid: 0,
      deposited_atom_count: 1678,
      polymer_composition: 'heteromeric protein',
      ...info,
    },
  });

/** What the full-text search answers for words that match: its own total, and the ids it listed. */
export const searchAnswer = (ids: readonly string[], total = ids.length): string =>
  JSON.stringify({ query_id: 'fake', result_type: 'entry', total_count: total, result_set: ids.map((identifier, index) => ({ identifier, score: 1 - index / 100 })) });

/** The archive's 404 for an id it does not have — the body carries the sentence a refusal quotes. */
export const noSuchEntry = (id: string): Answer => ({ status: 404, body: JSON.stringify({ status: 404, message: `No data found for entryId: ${id}` }) });

// ── bytes, made from the committed entry's own lines ────────────────────────

/**
 * THE FOUR FIXTURES EVERY REFUSAL IS ASSERTED OVER.
 *
 * Each one takes the committed entry's lines and changes exactly one fact — an
 * insertion code in column 27, two MODEL records, one chain removed, a chain of
 * nucleotide names added. The columns stay fixed-width, the coordinates stay
 * real and the HEADER stays the entry's own, so what is under test is the one
 * changed fact and not a hand-written file.
 */

/** The same entry with an insertion code on one residue's records — the one thing the minted key cannot spell. */
export function withInsertionCode(text: string, chain: string, resnum: string, code: string): string {
  return text
    .split('\n')
    .map((line) => (line.startsWith('ATOM') && line.slice(21, 22) === chain && line.slice(22, 26).trim() === resnum ? `${line.slice(0, 26)}${code}${line.slice(27)}` : line))
    .join('\n');
}

/** The same entry deposited as two models — the coordinate records twice, between MODEL and ENDMDL. */
export function asTwoModels(text: string): string {
  const lines = text.split('\n');
  const isCoordinate = (line: string): boolean => line.startsWith('ATOM') || line.startsWith('HETATM') || line.startsWith('TER');
  const coordinates = lines.filter(isCoordinate);
  const head = lines.filter((line) => !isCoordinate(line) && !line.startsWith('CONECT') && !line.startsWith('MASTER') && line !== 'END');
  return [...head, 'MODEL        1', ...coordinates, 'ENDMDL', 'MODEL        2', ...coordinates, 'ENDMDL', 'END'].join('\n');
}

/** Only one chain of the complex — which is what an entry with no interface looks like. */
export const oneChainOnly = (text: string, keep: string): string =>
  text
    .split('\n')
    .filter((line) => !((line.startsWith('ATOM') || line.startsWith('TER')) && line.slice(21, 22) !== keep))
    .join('\n');

/**
 * A chain of NUCLEOTIDES, written from this entry's own atom records: three
 * fields changed — the atom name (so it is not N, CA or C), the residue name
 * (`DA`) and the chain (`E`).
 */
export function withNucleicChain(text: string, howMany = 12): string {
  const atoms = text.split('\n').filter((line) => line.startsWith('ATOM')).slice(0, howMany);
  const nucleic = atoms.map((line, index) => `${line.slice(0, 12)}${index % 2 === 0 ? ' P  ' : " C1'"}${line.slice(16, 17)} DA${line.slice(20, 21)}E${line.slice(22)}`);
  const lines = text.split('\n');
  const end = lines.findIndex((line) => line.startsWith('CONECT') || line.startsWith('MASTER') || line === 'END');
  return [...lines.slice(0, end), ...nucleic, ...lines.slice(end)].join('\n');
}

// ── the mapping records, and the ENTRY THAT IS NOT THE IDENTITY ─────────────

/**
 * THE ARCHIVE'S ENTITY RECORDS FOR A SECOND ENTRY, whose author numbering
 * starts at 94 — the fixture that stops hops 3 and 4 from being assumed.
 *
 * On the committed example hop 4 is the identity for both chains (author 1…96
 * IS entity 1…96) and hop 3 is the identity for chain A. An implementation that
 * simply assumed both would pass every assertion this desk can make about its
 * own example and mislabel residues across most of the archive
 * (`src/prot/mapping.ts` says the same thing where the arithmetic lives).
 *
 * So this is `1TUP`'s p53 core domain, probed once against the live GraphQL
 * door exactly as the other shapes in this file were: `aligned_regions` says
 * `entity_beg_seq_id 1 ↔ ref_beg_seq_id 94`, and
 * `auth_to_entity_poly_seq_mapping` starts at `"94"` — so both hops are off by
 * ninety-three and an off-by-93 error cannot hide.
 *
 * The mapping is written from its own first value rather than pasted, because
 * 219 quoted numbers cannot be checked by eye and a generated run of them can:
 * the entity is 219 residues numbered contiguously from 94, which is what the
 * archive really answered.
 */
export const P53_AUTH_FROM = 94;
export const P53_LENGTH = 219;

/** `auth_to_entity_poly_seq_mapping` for that entity: 219 author numbers, 94…312, in entity order. */
export const P53_AUTH_MAPPING: readonly string[] = Array.from({ length: P53_LENGTH }, (_, at) => String(P53_AUTH_FROM + at));

/** The archive's GraphQL answer for that entity, in the shape `src/prot/entities.ts` reads — one chain, one region, no identity anywhere. */
export const ENTITIES_1TUP = JSON.stringify({
  data: {
    entry: {
      rcsb_id: '1TUP',
      polymer_entities: [
        {
          rcsb_id: '1TUP_3',
          entity_poly: { pdbx_seq_one_letter_code_can: 'X'.repeat(P53_LENGTH), rcsb_entity_polymer_type: 'Protein' },
          rcsb_polymer_entity_container_identifiers: { entity_id: '3', auth_asym_ids: ['A'] },
          rcsb_polymer_entity_align: [{ reference_database_name: 'UniProt', reference_database_accession: 'P04637', provenance_source: 'SIFTS', aligned_regions: [{ entity_beg_seq_id: 1, ref_beg_seq_id: P53_AUTH_FROM, length: P53_LENGTH }] }],
          polymer_entity_instances: [{ rcsb_polymer_entity_instance_container_identifiers: { auth_asym_id: 'A', asym_id: 'A', entity_id: '3', auth_to_entity_poly_seq_mapping: P53_AUTH_MAPPING } }],
        },
      ],
    },
  },
});
