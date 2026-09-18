/**
 * THE FOUR HOPS, AS PURE FUNCTIONS — and the fixture that stops two of them
 * being assumed.
 *
 * ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────
 * A conservation score is a fact about a COLUMN of somebody's curated
 * alignment; a row of this desk is `"<chain>:<resnum>"`, an author's own
 * residue number out of a coordinate file. Four coordinate systems sit between
 * those two, and every one of them is a place where the stage could put a
 * number on the wrong residue and never be caught — the picture would still
 * look like a conservation profile.
 *
 * ── AND WHY THE COMMITTED EXAMPLE IS NOT ENOUGH TO TEST THEM WITH ──────────
 * On `1AY7` hop 4 is the IDENTITY for both chains (author 1…96 is entity
 * 1…96) and hop 3 is the identity for chain A. An implementation that simply
 * returned its argument would pass every assertion this desk could make about
 * its own example — and would mislabel residues across most of the archive.
 *
 * So two things are pinned here. Chain B of the very same entry is NOT the
 * identity: `aligned_regions` says `entity_beg_seq_id 1 ↔ ref_beg_seq_id 2`,
 * so its first residue is UniProt position 2 and UniProt position 1 has no row
 * on this desk at all. And a SECOND entry's records (`tests/protFixture.ts` ·
 * `ENTITIES_1TUP`) carry an author numbering that starts at 94, where assuming
 * either hop is off by ninety-three.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chainMappingsOf } from '../src/prot/entities.js';
import { alignedRegionsOf, authOfEntity, entityOfReference, entityPositionsOfReferenceRange, referenceOfEntity, residueKeyOfEntity, residueKeyOfReference, type ChainMapping } from '../src/prot/mapping.js';
import { residueKey } from '../src/prot/etl.js';
import { conservationFileOf } from '../src/data/files.js';
import { ENTITIES_1TUP, P53_AUTH_FROM, P53_AUTH_MAPPING, P53_LENGTH } from './protFixture.js';

/** The committed entity records — the archive's own answer to the query `src/prot/entities.ts` sends. */
const COMMITTED = chainMappingsOf(JSON.parse(readFileSync(conservationFileOf.entities('1AY7'), 'utf8')) as Readonly<Record<string, unknown>>);
const chainOf = (chain: string): ChainMapping => COMMITTED.find((c) => c.chain === chain)!;

describe('the archive’s entity records, read', () => {
  it('reads one mapping per chain, with the sequence, the accession and both hops’ records', () => {
    expect(COMMITTED.map((c) => c.chain)).toEqual(['A', 'B']);
    expect(COMMITTED.map((c) => c.accession)).toEqual(['P05798', 'P11540']);
    expect(chainOf('A').sequence).toHaveLength(96);
    expect(chainOf('B').sequence).toHaveLength(89);
    expect(chainOf('A').authOfEntityPosition).toHaveLength(96);
    expect(chainOf('B').authOfEntityPosition).toHaveLength(89);
  });

  it('reads chain B’s region as the NON-IDENTITY it really is — the trap this entry sets', () => {
    expect(chainOf('A').regions).toEqual([{ entityBegin: 1, referenceBegin: 1, length: 96 }]);
    // entity position 1 of chain B is UniProt position 2, not 1
    expect(chainOf('B').regions).toEqual([{ entityBegin: 1, referenceBegin: 2, length: 89 }]);
  });

  it('drops a region missing any of its three fields rather than defaulting one', () => {
    // A DEFAULTED BEGIN IS THE WORST OUTCOME: it would place every residue of
    // the chain, confidently, at the wrong position. So a half-written region is
    // dropped and the positions it would have covered are simply absent.
    expect(alignedRegionsOf([{ entity_beg_seq_id: 1, ref_beg_seq_id: 2, length: 3 }])).toEqual([{ entityBegin: 1, referenceBegin: 2, length: 3 }]);
    expect(alignedRegionsOf([{ entity_beg_seq_id: 1, length: 3 }])).toEqual([]);
    expect(alignedRegionsOf([{ entity_beg_seq_id: 1, ref_beg_seq_id: null, length: 3 }])).toEqual([]);
    expect(alignedRegionsOf([{ entity_beg_seq_id: 1, ref_beg_seq_id: 2, length: 0 }])).toEqual([]);
  });

  it('drops a chain the archive matched to no UniProt sequence, and keeps its mapping records', () => {
    const noReference = chainMappingsOf(
      JSON.parse(
        JSON.stringify({
          data: {
            entry: {
              polymer_entities: [
                {
                  entity_poly: { pdbx_seq_one_letter_code_can: 'ACDE', rcsb_entity_polymer_type: 'Protein' },
                  rcsb_polymer_entity_container_identifiers: { entity_id: '1', auth_asym_ids: ['X'] },
                  polymer_entity_instances: [{ rcsb_polymer_entity_instance_container_identifiers: { auth_asym_id: 'X', entity_id: '1', auth_to_entity_poly_seq_mapping: ['1', '2', '3', '4'] } }],
                },
              ],
            },
          },
        }),
      ) as Readonly<Record<string, unknown>>,
    );
    // the chain is still THERE — it has rows on this desk and the refusal about
    // it is said by name — it simply has no accession and so no family
    expect(noReference.map((c) => [c.chain, c.accession, c.regions.length])).toEqual([['X', null, 0]]);
  });

  it('drops a nucleic-acid entity, because a Pfam family is a protein family', () => {
    const nucleic = chainMappingsOf({
      data: {
        entry: {
          polymer_entities: [
            {
              entity_poly: { pdbx_seq_one_letter_code_can: 'ACGT', rcsb_entity_polymer_type: 'DNA' },
              rcsb_polymer_entity_container_identifiers: { entity_id: '1', auth_asym_ids: ['E'] },
              polymer_entity_instances: [{ rcsb_polymer_entity_instance_container_identifiers: { auth_asym_id: 'E', entity_id: '1', auth_to_entity_poly_seq_mapping: ['1'] } }],
            },
          ],
        },
      },
    });
    expect(nucleic).toEqual([]);
  });
});

describe('HOP 3 — a reference position to an entity position', () => {
  it('is the identity on chain A of the committed entry, and is READ rather than assumed', () => {
    expect(entityOfReference(chainOf('A').regions, 5)).toBe(5);
    expect(entityOfReference(chainOf('A').regions, 92)).toBe(92);
    // and outside the region it is ABSENT, not clamped
    expect(entityOfReference(chainOf('A').regions, 0)).toBeNull();
    expect(entityOfReference(chainOf('A').regions, 97)).toBeNull();
  });

  it('is NOT the identity on chain B of the SAME entry — the offset an assumption would lose', () => {
    expect(entityOfReference(chainOf('B').regions, 2)).toBe(1);
    expect(entityOfReference(chainOf('B').regions, 81)).toBe(80);
    // UNIPROT POSITION 1 HAS NO RESIDUE HERE. The chain begins at position 2, so
    // the family's domain region loses its first position on this entry — which
    // is absent, and is exactly the sort of quiet off-by-one this hop prevents.
    expect(entityOfReference(chainOf('B').regions, 1)).toBeNull();
  });

  it('is off by ninety-three on an entry whose author numbering starts at 94', () => {
    const p53 = chainMappingsOf(JSON.parse(ENTITIES_1TUP) as Readonly<Record<string, unknown>>)[0]!;
    expect(p53.regions).toEqual([{ entityBegin: 1, referenceBegin: P53_AUTH_FROM, length: P53_LENGTH }]);
    expect(entityOfReference(p53.regions, 94)).toBe(1);
    expect(entityOfReference(p53.regions, 175)).toBe(82);
    expect(entityOfReference(p53.regions, 93)).toBeNull();
    // and back again, which is the hop the annotation stage will want
    expect(referenceOfEntity(p53.regions, 1)).toBe(94);
    expect(referenceOfEntity(p53.regions, P53_LENGTH)).toBe(312);
    expect(referenceOfEntity(p53.regions, P53_LENGTH + 1)).toBeNull();
  });

  it('carries a reference RANGE across, and says what the chain does not have', () => {
    // chain A's domain region, whole
    expect(entityPositionsOfReferenceRange(chainOf('A').regions, 5, 92, 96)).toHaveLength(88);
    // chain B's domain region LOSES ONE: UniProt 1..81 reaches entity 1..80
    const barstar = entityPositionsOfReferenceRange(chainOf('B').regions, 1, 81, 89);
    expect(barstar).toHaveLength(80);
    expect(barstar[0]).toBe(1);
    expect(barstar.at(-1)).toBe(80);
  });

  it('answers a NON-CONTIGUOUS range as the positions it really covers, never as one span', () => {
    /*
      TWO ALIGNED REGIONS is an ordinary entity: an expression tag in the
      middle, or a stretch the depositors left out of the construct. Returning
      `[lo, hi]` would silently include the reference positions in between,
      which this entity does not have — so the answer is the positions.
    */
    const split = [
      { entityBegin: 1, referenceBegin: 10, length: 3 },
      { entityBegin: 4, referenceBegin: 20, length: 2 },
    ];
    expect(entityPositionsOfReferenceRange(split, 10, 21, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(entityPositionsOfReferenceRange(split, 13, 19, 5)).toEqual([]);
    // and never a position the entity is not long enough to have
    expect(entityPositionsOfReferenceRange(split, 10, 21, 3)).toEqual([1, 2, 3]);
  });
});

describe('HOP 4 — an entity position to the author residue number', () => {
  it('is the identity on both chains of the committed entry, and is READ rather than assumed', () => {
    expect(authOfEntity(chainOf('A').authOfEntityPosition, 1)).toBe(1);
    expect(authOfEntity(chainOf('A').authOfEntityPosition, 96)).toBe(96);
    expect(authOfEntity(chainOf('B').authOfEntityPosition, 89)).toBe(89);
    // and absent off either end, never clamped
    expect(authOfEntity(chainOf('A').authOfEntityPosition, 0)).toBeNull();
    expect(authOfEntity(chainOf('A').authOfEntityPosition, 97)).toBeNull();
  });

  it('is off by ninety-three on the second entry — where an assumption would mislabel every residue', () => {
    expect(authOfEntity(P53_AUTH_MAPPING, 1)).toBe(94);
    expect(authOfEntity(P53_AUTH_MAPPING, 82)).toBe(175);
    expect(authOfEntity(P53_AUTH_MAPPING, P53_LENGTH)).toBe(312);
  });

  it('refuses a value that is not a plain integer, because that residue has no row here', () => {
    // A RESIDUE WITH AN INSERTION CODE (`52A`) is one the minted key cannot tell
    // from its un-coded neighbour, so the parse already skips it and counts it
    // (`src/prot/etl.ts` · `skippedOf`). A score for it would be a score on a
    // row that is not there.
    expect(authOfEntity(['52A'], 1)).toBeNull();
    expect(authOfEntity([''], 1)).toBeNull();
    expect(authOfEntity(['-3'], 1)).toBe(-3);
    expect(authOfEntity([' 7 '], 1)).toBe(7);
  });
});

describe('the two hops together, ending at the key this desk’s rows carry', () => {
  it('mints the key with `residueKey` and never respells it', () => {
    expect(residueKeyOfEntity(chainOf('A'), 5)).toBe(residueKey('A', 5));
    expect(residueKeyOfEntity(chainOf('A'), 5)).toBe('A:5');
    // chain B: UniProt 2 is entity 1 is author 1
    expect(residueKeyOfReference(chainOf('B'), 2)).toBe(residueKey('B', 1));
    expect(residueKeyOfReference(chainOf('B'), 1)).toBeNull();
  });

  it('is absent at either hop rather than a guess', () => {
    const p53 = chainMappingsOf(JSON.parse(ENTITIES_1TUP) as Readonly<Record<string, unknown>>)[0]!;
    expect(residueKeyOfReference(p53, 94)).toBe('A:94');
    expect(residueKeyOfReference(p53, 312)).toBe('A:312');
    expect(residueKeyOfReference(p53, 93)).toBeNull();
    expect(residueKeyOfReference(p53, 313)).toBeNull();
  });
});
