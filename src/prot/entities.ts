/**
 * THE ARCHIVE'S OWN ANSWER TO "WHICH RESIDUE OF THIS FILE IS POSITION N OF
 * THIS SEQUENCE" — hops 3 and 4's data, read over one request.
 *
 * `./mapping.ts` owns the arithmetic of those two hops and knows nothing about
 * a service. This module is the DOOR: it asks the archive's GraphQL endpoint
 * for exactly four things per polymer entity — the canonical sequence, the
 * UniProt accession SIFTS assigned it, `rcsb_polymer_entity_align[].aligned_regions`
 * and `auth_to_entity_poly_seq_mapping` — and hands back a
 * {@link ChainMapping} per chain.
 *
 * ── ONE REQUEST, AND WHY GRAPHQL ───────────────────────────────────────────
 * The REST record for one polymer entity is 13,827 bytes and there is a second
 * endpoint for the instance-level mapping, so the REST route is two requests
 * per chain and four for this entry, most of their bytes a taxonomy lineage
 * nothing here reads. The archive's GraphQL door answers the shape this module
 * asks for, for every entity of an entry, in one request of about 4 KB — which
 * is also what makes the committed fixture something a reader can check by eye.
 *
 * Measured with `Origin: https://footprintjs.github.io`: `200`,
 * `access-control-allow-origin: *`, `content-type: application/json`. So this
 * is a door a static page can really knock on, which is the whole reason the
 * conservation stage is no longer declared unavailable.
 *
 * ── NOTHING IS CAST ────────────────────────────────────────────────────────
 * Every field is read through `./archive.ts`'s own "reading JSON without
 * trusting it" helpers, and an entity whose alignment record is missing a field
 * loses that REGION rather than gaining a default (`./mapping.ts` ·
 * `alignedRegionsOf` says why a defaulted begin is worse than none).
 */
import { ARCHIVE_URLS, jsonOf, knock, objectOf, quoted, textAt, type ArchiveFetch, type FromArchive } from './archive.js';
import { alignedRegionsOf, type ChainMapping } from './mapping.js';

/** The reference database this desk reads a family from. A chain matched to anything else has no family lookup here. */
export const REFERENCE_DATABASE = 'UniProt';

/**
 * EXACTLY THE FIELDS THE FOUR HOPS READ — the query, spelled once.
 *
 * It is the same string `data/prot/conservation/fetch.mjs` sends, and the
 * fixture that script wrote is this query's own answer, so the committed bytes
 * and the live read cannot be answers to two different questions. The
 * provenance record carries the query verbatim for the same reason.
 */
export const ENTITY_QUERY =
  'query($id:String!){entry(entry_id:$id){rcsb_id polymer_entities{rcsb_id entity_poly{pdbx_seq_one_letter_code_can rcsb_entity_polymer_type}rcsb_polymer_entity_container_identifiers{entity_id auth_asym_ids}rcsb_polymer_entity_align{reference_database_name reference_database_accession provenance_source aligned_regions{entity_beg_seq_id ref_beg_seq_id length}}polymer_entity_instances{rcsb_polymer_entity_instance_container_identifiers{auth_asym_id asym_id entity_id auth_to_entity_poly_seq_mapping}}}}}';

/** A list at a key, or the empty list — an absent list and an empty one mean the same thing to every reader below. */
const listAt = (record: Readonly<Record<string, unknown>> | null, key: string): readonly unknown[] => {
  const value = record?.[key];
  return Array.isArray(value) ? (value as readonly unknown[]) : [];
};

/** Every string of a list of strings — what `auth_to_entity_poly_seq_mapping` is. */
const textsOf = (values: readonly unknown[]): readonly string[] => values.flatMap((value) => (typeof value === 'string' ? [value] : typeof value === 'number' ? [String(value)] : []));

/**
 * THE ENTRY'S CHAINS, WITH THEIR MAPPING RECORDS — one per polymer instance.
 *
 * ```ts
 * const read = await entityMappings('1AY7', browserArchive);
 * read.ok && read.value.map((c) => `${c.chain} → ${String(c.accession)}`);
 * // ['A → P05798', 'B → P11540']
 * ```
 *
 * A NON-PROTEIN entity is dropped: a nucleic-acid chain has no Pfam family and
 * the placement has nothing to align. It is dropped rather than refused because
 * a protein–DNA complex is an entry this desk draws happily — its protein chain
 * still gets a score and the desk says the other has none
 * ({@link ChainMapping} is simply absent for it).
 */
export async function entityMappings(entry: string, doors: ArchiveFetch): Promise<FromArchive<readonly ChainMapping[]>> {
  const asked = entry.trim().toUpperCase();
  const knocked = await knock(doors, ARCHIVE_URLS.graphql, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: ENTITY_QUERY, variables: { id: asked } }),
  });
  if (!knocked.ok) return knocked;
  const answer = knocked.value;
  if (!answer.ok) {
    return { ok: false, sentence: `the archive's entity records for "${asked}" answered ${String(answer.status)} at ${ARCHIVE_URLS.graphql} — no residue of this entry can be placed in a family alignment without them. It said: ${quoted(answer.body)}` };
  }
  const parsed = jsonOf(answer.body);
  if (parsed === null) {
    return { ok: false, sentence: `the archive's entity records for "${asked}" answered ${String(answer.status)} with something that is not JSON — the first characters are "${quoted(answer.body)}". Nothing was placed.` };
  }
  return { ok: true, value: chainMappingsOf(parsed) };
}

/**
 * THE SAME READ, off bytes somebody already has — the committed fixture's door
 * and the live door's shared half.
 *
 * It takes the GraphQL answer's own JSON so the fixture and the live read go
 * through ONE parse. A fixture parsed by a second reader would be a second
 * reading of the same shape, which is the drift this repository refuses.
 */
export function chainMappingsOf(answered: Readonly<Record<string, unknown>>): readonly ChainMapping[] {
  // the fixture is `data.entry` on its own; the live answer wraps it in `data`
  const entry = objectOf(answered['data']) === null ? answered : objectOf(objectOf(answered['data'])?.['entry'] ?? null);
  const entities = listAt(entry, 'polymer_entities');
  return entities.flatMap((value) => {
    const entity = objectOf(value);
    const poly = objectOf(entity?.['entity_poly'] ?? null);
    const kind = textAt(poly, 'rcsb_entity_polymer_type');
    // a nucleic-acid chain has no Pfam family — see the doc comment above
    if (kind !== null && kind !== 'Protein') return [];
    const sequence = textAt(poly, 'pdbx_seq_one_letter_code_can') ?? '';
    const identifiers = objectOf(entity?.['rcsb_polymer_entity_container_identifiers'] ?? null);
    const entityId = textAt(identifiers, 'entity_id') ?? '';
    const aligns = listAt(entity, 'rcsb_polymer_entity_align');
    const uniprot = aligns.map(objectOf).find((align) => textAt(align, 'reference_database_name') === REFERENCE_DATABASE) ?? null;
    const accession = textAt(uniprot, 'reference_database_accession');
    const regions = alignedRegionsOf(
      listAt(uniprot, 'aligned_regions').flatMap((region) => {
        const read = objectOf(region);
        return read === null ? [] : [read as { readonly entity_beg_seq_id?: number | null; readonly ref_beg_seq_id?: number | null; readonly length?: number | null }];
      }),
    );
    return listAt(entity, 'polymer_entity_instances').flatMap((value2) => {
      const instance = objectOf(objectOf(value2)?.['rcsb_polymer_entity_instance_container_identifiers'] ?? null);
      const chain = textAt(instance, 'auth_asym_id');
      if (chain === null) return [];
      return [
        {
          chain,
          entityId: textAt(instance, 'entity_id') ?? entityId,
          sequence,
          accession,
          regions,
          authOfEntityPosition: textsOf(listAt(instance, 'auth_to_entity_poly_seq_mapping')),
        } satisfies ChainMapping,
      ];
    });
  });
}
