/**
 * THE FOUR HOPS FROM A FAMILY POSITION TO A ROW OF THIS DESK — read, never
 * assumed, and this module is the one owner of two of them.
 *
 * A conservation score is a fact about a COLUMN of somebody's curated
 * alignment. A row of this desk is `"<chain>:<resnum>"`, the author's own
 * residue number out of a coordinate file. Between those two there are four
 * coordinate systems, and every one of them is a place where a stage could put
 * a number on the wrong residue and never be caught:
 *
 * | hop | from → to                            | read from                                        | owner |
 * |-----|--------------------------------------|--------------------------------------------------|-------|
 * | 1   | alignment column → family position   | the Stockholm alignment's own columns             | `./conservation.ts` · `familyPositions` |
 * | 2   | our residue → family position        | the COMPUTED placement                            | `./placement.ts` |
 * | 3   | reference (UniProt) position → entity position | `rcsb_polymer_entity_align[].aligned_regions` | **here** — {@link entityOfReference} |
 * | 4   | entity position → author residue number | `auth_to_entity_poly_seq_mapping`              | **here** — {@link authOfEntity} |
 *
 * ── WHY HOPS 3 AND 4 LIVE IN THEIR OWN MODULE ──────────────────────────────
 * They are not about conservation. They are the archive's answer to "which
 * residue of this file is position N of this UniProt sequence", which is the
 * same question the FUNCTIONAL ANNOTATION stage of the plan (`./plan.ts`, step
 * 6) has to ask to put a domain, a variant or an epitope on a row. So they are
 * declared where either stage can import them and neither owns them, rather
 * than being written twice and drifting once.
 *
 * ── AND WHY 1AY7 IS EXACTLY THE ENTRY THAT MAKES THIS DANGEROUS ────────────
 * On the committed example hop 4 is the identity for both chains — author 1…96
 * is entity 1…96 — and hop 3 is the identity for chain A. An implementation
 * that simply ASSUMED both would pass every assertion this desk could make
 * about its own example and mislabel residues across most of the archive.
 *
 * Two things stop that. Chain B of the very same entry is NOT the identity:
 * its `aligned_regions` say `entity_beg_seq_id 1 ↔ ref_beg_seq_id 2`, so the
 * chain begins at UniProt position 2 and UniProt position 1 has NO residue on
 * this desk at all. And `tests/prot-mapping.test.ts` pins a second entry whose
 * author numbering starts at 94, where assuming either hop is off by
 * ninety-three.
 */
import { residueKey } from './etl.js';

/**
 * ONE ALIGNED REGION, in this repository's own spelling — the archive's three
 * fields, renamed once so no reader below spells a wire name.
 *
 * The archive's own names are `entity_beg_seq_id`, `ref_beg_seq_id` and
 * `length`; {@link alignedRegionsOf} is the one place they appear.
 */
export interface AlignedRegion {
  /** The first entity sequence position of the region, 1-based. */
  readonly entityBegin: number;
  /** The reference (UniProt) position that entity position sits at, 1-based. */
  readonly referenceBegin: number;
  /** How many positions the region covers. */
  readonly length: number;
}

/** A polymer entity's mapping records, as this desk needs them — one per chain of the entry. */
export interface ChainMapping {
  /** The author's own chain label, as the coordinate file spells it and `residueKey` keys rows by. */
  readonly chain: string;
  /** The archive's entity id — which polymer this chain is an instance of. */
  readonly entityId: string;
  /** The entity's one-letter sequence, canonical — what the placement is computed over. */
  readonly sequence: string;
  /** The reference database accession SIFTS assigned (a UniProt accession), or `null` where the entity has none. */
  readonly accession: string | null;
  /** Hop 3's own record. Empty for an entity with no reference alignment. */
  readonly regions: readonly AlignedRegion[];
  /** Hop 4's own record: the author residue number of each entity position, in entity order. */
  readonly authOfEntityPosition: readonly string[];
}

/** The archive's `aligned_regions`, in this desk's spelling — the ONE place the wire's field names appear. */
export function alignedRegionsOf(regions: readonly { readonly entity_beg_seq_id?: number | null; readonly ref_beg_seq_id?: number | null; readonly length?: number | null }[]): readonly AlignedRegion[] {
  return regions.flatMap((region) => {
    const entityBegin = region.entity_beg_seq_id;
    const referenceBegin = region.ref_beg_seq_id;
    const length = region.length;
    // A region missing any of the three says nothing and is DROPPED rather than
    // defaulted: a region whose begin defaulted to 1 would place every residue
    // of the chain, confidently, at the wrong position.
    if (typeof entityBegin !== 'number' || typeof referenceBegin !== 'number' || typeof length !== 'number' || length <= 0) return [];
    return [{ entityBegin, referenceBegin, length }];
  });
}

/**
 * HOP 3 — a reference (UniProt) position to an entity position, or `null`.
 *
 * `null` is the honest answer for a reference position no region covers: the
 * entity is a construct, and the reference sequence it was matched to can be
 * longer at either end.
 *
 * ```ts
 * const barstar = [{ entityBegin: 1, referenceBegin: 2, length: 89 }];
 * entityOfReference(barstar, 2);   // 1
 * entityOfReference(barstar, 1);   // null — this chain has no residue for UniProt position 1
 * ```
 */
export function entityOfReference(regions: readonly AlignedRegion[], referencePosition: number): number | null {
  for (const region of regions) {
    const offset = referencePosition - region.referenceBegin;
    if (offset >= 0 && offset < region.length) return region.entityBegin + offset;
  }
  return null;
}

/** HOP 3, the other way — an entity position to its reference position, for a caller that has a residue and wants its UniProt number. */
export function referenceOfEntity(regions: readonly AlignedRegion[], entityPosition: number): number | null {
  for (const region of regions) {
    const offset = entityPosition - region.entityBegin;
    if (offset >= 0 && offset < region.length) return region.referenceBegin + offset;
  }
  return null;
}

/**
 * HOP 4 — an entity position to the AUTHOR residue number, or `null`.
 *
 * The record is an array indexed by entity position (1-based, so index
 * `position - 1`) whose value is the author's number as a string. Probed:
 * entity position 1 of `1TUP`'s p53 entity is author residue 94.
 *
 * A value that is not a plain integer is refused rather than coerced. That is
 * the residue with an INSERTION CODE (`52A`), which this desk's minted key
 * cannot tell from its un-coded neighbour and which the parse already skips and
 * counts (`./etl.ts` · `skippedOf`) — so a score for it would be a score on a
 * row that is not there.
 */
export function authOfEntity(authOfEntityPosition: readonly string[], entityPosition: number): number | null {
  const value = authOfEntityPosition[entityPosition - 1];
  if (value === undefined) return null;
  if (!/^-?\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

/**
 * HOPS 3 AND 4 TOGETHER, ending at the key this desk's rows carry — the one
 * door a caller with a UniProt position should use.
 *
 * `null` at either hop is `null` here: a position the chain has no residue for
 * and a position whose author number cannot be spelled are both "there is no
 * row for this", which is ABSENT and never a guess.
 *
 * The key is minted by `./etl.ts` · `residueKey` and never respelled — the
 * chain and the number joined by the one character this repository spells in
 * one place.
 */
export function residueKeyOfReference(mapping: ChainMapping, referencePosition: number): string | null {
  const entity = entityOfReference(mapping.regions, referencePosition);
  if (entity === null) return null;
  return residueKeyOfEntity(mapping, entity);
}

/** HOP 4, ending at the row's key — for a caller that already has an entity position (the placement's own coordinate). */
export function residueKeyOfEntity(mapping: ChainMapping, entityPosition: number): string | null {
  const auth = authOfEntity(mapping.authOfEntityPosition, entityPosition);
  if (auth === null) return null;
  return residueKey(mapping.chain, auth);
}

/**
 * THE ENTITY POSITIONS A REFERENCE RANGE COVERS — ascending, deduplicated, and
 * only the ones this entity really has.
 *
 * This is what carries a fact stated in UniProt coordinates — InterPro's Pfam
 * match is `5..92` OF THE UNIPROT SEQUENCE — into the coordinate system our
 * residues live in. It walks the reference range rather than the entity's,
 * because the range is the thing that was declared.
 *
 * NON-CONTIGUOUS BY CONSTRUCTION: an entity with two aligned regions (an
 * expression tag in the middle, a disordered stretch the depositors left out of
 * the construct) covers a reference range in two pieces, and returning a single
 * `[lo, hi]` would silently include the positions in between. So it returns the
 * positions, in order, and a caller reads its query sequence off exactly those.
 *
 * ```ts
 * const barstar = [{ entityBegin: 1, referenceBegin: 2, length: 89 }];
 * entityPositionsOfReferenceRange(barstar, 1, 81, 89);  // [1 … 80] — UniProt 1 is not there
 * ```
 */
export function entityPositionsOfReferenceRange(regions: readonly AlignedRegion[], referenceFrom: number, referenceTo: number, entityLength: number): readonly number[] {
  const found = new Set<number>();
  for (let reference = referenceFrom; reference <= referenceTo; reference += 1) {
    const entity = entityOfReference(regions, reference);
    if (entity !== null && entity >= 1 && entity <= entityLength) found.add(entity);
  }
  return [...found].sort((a, b) => a - b);
}
