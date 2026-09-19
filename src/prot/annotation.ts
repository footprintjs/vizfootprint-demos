/**
 * WHAT IS ALREADY KNOWN ABOUT A SEQUENCE — the two doors stage 6 opens that no
 * other stage on this desk has.
 *
 * The functional annotation stage reads FOUR things and downloads TWO of them.
 * The other two are the conservation stage's, already committed and already
 * read through modules that own them, and this stage borrows rather than asks
 * again:
 *
 * | what                                   | whose door                          |
 * |----------------------------------------|--------------------------------------|
 * | which UniProt sequence each chain is   | `./entities.ts` — the archive        |
 * | where a UniProt position lands on a row| `./mapping.ts` — hops 3 and 4        |
 * | which Pfam family covers which residues| `./family.ts` · `pfamMatches`        |
 * | the sequence's own SITE features       | **here** — {@link uniprotSites}      |
 * | the epitopes already recorded for it   | **here** — {@link knownEpitopes}     |
 *
 * Reusing the middle three is not thrift. A second reading of "which residue of
 * this file is position N of this UniProt sequence" is a second ANSWER to it,
 * and the day the two disagree there is nobody to arbitrate — which is exactly
 * the drift this repository refuses. `./mapping.ts` says the same thing from
 * the other side, and said it before this stage existed: those hops are
 * declared where either stage can import them *and neither owns them.*
 *
 * ── UNIPROT IS ASKED BY FIELD, AND THAT IS THE WHOLE OF THE FILTER ─────────
 * The reviewed entry for `P05798` is 19,646 bytes and most of it is a
 * bibliography, a taxonomy and a list of cross-references nothing here reads.
 * `?fields=` is UniProt's own way of asking for a shape — the way GraphQL is
 * the archive's (`./entities.ts` · `ENTITY_QUERY`'s argument, one service
 * along) — and the
 * same request answers 776 bytes, which is a committed fixture a reader can
 * check by eye.
 *
 * It is also where the SELECTION happens, and that matters: this module never
 * drops a feature the service sent. It asks for the SITE fields — what is known
 * about a RESIDUE — and lands every feature that comes back, with the source's
 * own type word and the source's own description, verbatim. What is left out is
 * left out by a stated rule rather than by taste:
 *
 *   `Beta strand`, `Helix`, `Turn`   secondary structure, which this desk
 *                                    already reads off the file's own
 *                                    coordinates — citing UniProt for a second
 *                                    opinion on it would put two answers to one
 *                                    question on one screen;
 *   `Chain`                          covers every residue of the sequence, so
 *                                    it says nothing about any one of them;
 *   `Mutagenesis`, `Sequence conflict`  facts about an EXPERIMENT and about a
 *                                    reading of the sequence, not about what
 *                                    the residue does.
 *
 * AND THE ASKED-FOR LIST IS ON THE PAGE ({@link UNIPROT_SITE_FIELDS}), because
 * an absent `Modified residue` means NOBODY ASKED, which is a different
 * sentence from *there are none* — the `./analyses.ts` · `INTERACTION_COLUMNS`
 * rule about Mol*'s off providers, one service along.
 *
 * ── AND A BOND IS NOT A RANGE ──────────────────────────────────────────────
 * UniProt spells a disulfide bond as `7..96`, and the two numbers are its two
 * ENDS rather than a stretch: residues 8 to 95 are not in the bond. Every other
 * site feature's `from..to` IS a stretch (a binding site can be three residues
 * long). So {@link positionsOfSite} splits on {@link BOND_FEATURES} — UniProt's
 * own words for the two features that are bonds — and a packet that had read
 * `7..96` as a range would have put `Disulfide bond` on ninety residues that
 * are not in one.
 *
 * ── NOTHING IS CAST ────────────────────────────────────────────────────────
 * Every field is read through `./archive.ts`'s own "reading JSON without
 * trusting it" helpers, and a feature missing a position is DROPPED rather than
 * defaulted, for the reason `./mapping.ts` · `alignedRegionsOf` gives about a
 * defaulted begin: a position that defaulted to 1 would land a site,
 * confidently, on the wrong residue.
 */
import { knock, numberAt, objectOf, quoted, textAt, type ArchiveFetch, type FromArchive } from './archive.js';

/**
 * THE UNIPROT RETURN FIELDS THIS STAGE ASKS FOR — the SITE features, and the
 * list is on the page.
 *
 * They are UniProt's own return-field names, not this desk's vocabulary
 * (`https://www.uniprot.org/help/return_fields`). `data/prot/annotation/fetch.mjs`
 * sends the same list, so the committed bytes and a live read cannot be answers
 * to two different questions — the `./entities.ts` · `ENTITY_QUERY` discipline.
 */
export const UNIPROT_SITE_FIELDS: readonly string[] = ['ft_act_site', 'ft_binding', 'ft_site', 'ft_disulfid', 'ft_crosslnk', 'ft_mod_res', 'ft_carbohyd', 'ft_lipid'];

/** Everything the request asks for: the accession to check the answer against, the sequence the positions are of, and the site fields. */
export const UNIPROT_ASKED: readonly string[] = ['accession', 'sequence', ...UNIPROT_SITE_FIELDS];

/**
 * THE TWO SITE FEATURES THAT ARE BONDS AND NOT STRETCHES — UniProt's own type
 * words for them. See the file header for why this distinction is load-bearing.
 */
export const BOND_FEATURES: readonly string[] = ['Disulfide bond', 'Cross-link'];

/** The two endpoints, in one place, so no call site spells one. */
export const ANNOTATION_URLS = {
  uniprot: (accession: string): string => `https://rest.uniprot.org/uniprotkb/${accession}.json?fields=${UNIPROT_ASKED.join(',')}`,
  epitopes: (accession: string): string => `https://query-api.iedb.org/epitope_search?parent_source_antigen_iri=eq.UNIPROT:${accession}`,
} as const;

/**
 * ONE SITE FEATURE, in this repository's own spelling — and every word of it is
 * the source's.
 *
 * `from` and `to` are REFERENCE (UniProt) positions, which is why hop 3 exists:
 * they have to be carried into the entity's own numbering before a residue of
 * this desk can be named (`./mapping.ts`).
 */
export interface SiteFeature {
  /** UniProt's own type word, verbatim — `Active site`, `Disulfide bond`. Never re-worded and never re-classified. */
  readonly type: string;
  /** UniProt's own description, verbatim — `Proton acceptor`. `null` where the record carries none, which is ABSENT and never `"none"`. */
  readonly note: string | null;
  /** The first and last reference position the record states. For a bond these are its two ENDS — see {@link positionsOfSite}. */
  readonly from: number;
  readonly to: number;
}

/** One accession's site features, with the sequence the positions are of. */
export interface UniprotSites {
  /** The accession the record answered for, as the record itself spells it. */
  readonly accession: string;
  /** How long that sequence is, or `null` where the record carries no sequence. */
  readonly sequenceLength: number | null;
  /** Every site feature the asked-for fields answered. Empty where the service named none — which is an ANSWER. */
  readonly features: readonly SiteFeature[];
}

/**
 * WHICH REFERENCE POSITIONS ONE SITE FEATURE IS ABOUT — its two ends for a
 * bond, every position of its range otherwise.
 *
 * ```ts
 * positionsOfSite({ type: 'Disulfide bond', note: null, from: 7, to: 96 });  // [7, 96]
 * positionsOfSite({ type: 'Active site', note: 'Proton acceptor', from: 54, to: 54 });  // [54]
 * ```
 */
export function positionsOfSite(feature: SiteFeature): readonly number[] {
  if (BOND_FEATURES.includes(feature.type)) return feature.from === feature.to ? [feature.from] : [feature.from, feature.to];
  const positions: number[] = [];
  for (let at = feature.from; at <= feature.to; at += 1) positions.push(at);
  return positions;
}

/**
 * ONE ACCESSION'S SITE FEATURES, off bytes somebody already has — the fixture
 * door and the live door's shared half, so neither is a second reading of one
 * shape.
 *
 * A feature with no start, no end or no type says nothing this desk can place
 * and is DROPPED rather than defaulted (the file header says why).
 */
export function uniprotSitesOf(answered: unknown): UniprotSites {
  const record = objectOf(answered);
  const sequence = objectOf(record?.['sequence'] ?? null);
  const features = Array.isArray(record?.['features']) ? (record['features'] as readonly unknown[]) : [];
  return {
    accession: textAt(record, 'primaryAccession') ?? '',
    sequenceLength: numberAt(sequence, 'length'),
    features: features.flatMap((value) => {
      const feature = objectOf(value);
      const type = textAt(feature, 'type');
      const location = objectOf(feature?.['location'] ?? null);
      const from = numberAt(objectOf(location?.['start'] ?? null), 'value');
      const to = numberAt(objectOf(location?.['end'] ?? null), 'value');
      if (type === null || from === null || to === null || from > to) return [];
      // THE DESCRIPTION IS THE SOURCE'S OWN WORD OR IT IS ABSENT. UniProt spells
      // "no description" as an empty string, and `textAt` answers `null` for
      // one — which is the column's own law: absent, never `"none"`.
      return [{ type, note: textAt(feature, 'description'), from, to } satisfies SiteFeature];
    }),
  };
}

/**
 * ONE ACCESSION'S SITE FEATURES, from UniProt.
 *
 * ```ts
 * const read = await uniprotSites('P05798', browserArchive);
 * read.ok && read.value.features.map((f) => `${f.type} ${String(f.from)}..${String(f.to)}`);
 * // ['Active site 54..54', 'Active site 85..85', 'Disulfide bond 7..96']
 * ```
 *
 * A record for a DIFFERENT accession is refused by name rather than read: a
 * redirect to a merged entry would otherwise land another protein's active site
 * on this chain's residues, confidently.
 */
export async function uniprotSites(accession: string, doors: ArchiveFetch): Promise<FromArchive<UniprotSites>> {
  const at = ANNOTATION_URLS.uniprot(accession);
  const knocked = await knock(doors, at);
  if (!knocked.ok) return knocked;
  const answer = knocked.value;
  if (!answer.ok) {
    return { ok: false, sentence: `the sequence-annotation service at ${at} answered ${String(answer.status)} for "${accession}", so nothing already known about that sequence was read and no residue of its chain is annotated. It said: ${quoted(answer.body)}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(answer.body);
  } catch {
    return { ok: false, sentence: `the sequence-annotation service at ${at} answered ${String(answer.status)} with something that is not JSON — the first characters are "${quoted(answer.body)}". No residue of this chain is annotated.` };
  }
  const read = uniprotSitesOf(parsed);
  if (read.accession !== '' && read.accession.toUpperCase() !== accession.trim().toUpperCase()) {
    return { ok: false, sentence: `${at} answered a record for "${read.accession}" and not for "${accession}", so what came back is about a different sequence and no residue of this chain is annotated.` };
  }
  return { ok: true, value: read };
}

/**
 * ONE EPITOPE ALREADY RECORDED FOR A SEQUENCE — the database's own identifier,
 * its own peptide and the positions of the antigen it covers.
 *
 * `from`/`to` are REFERENCE positions like a site feature's, and `null` where
 * the curated record states none — an epitope nobody has placed on the sequence
 * is a real epitope that this desk has nowhere to draw, which is counted and
 * said rather than guessed at.
 */
export interface Epitope {
  /** The IEDB's own identifier for the structure, verbatim (`IEDB_EPITOPE:497806`). */
  readonly id: string;
  /** Its peptide, as the database gives it, or `null`. */
  readonly sequence: string | null;
  readonly from: number | null;
  readonly to: number | null;
}

/**
 * THE EPITOPES ONE ACCESSION HAS, off bytes somebody already has.
 *
 * The answer is a LIST and not an object, which is why this module parses it
 * itself rather than through `./archive.ts` · `jsonOf`: that helper answers
 * `null` for anything that is not an object, and `[]` — the answer for both of
 * the committed entry's accessions — would then read as *not JSON* instead of
 * as *none are known*.
 *
 * WHICH POSITIONS ARE READ: only those of a curated source antigen whose own
 * IRI is the accession this desk asked about. A structure can be recorded
 * against several antigens at once (the probed shape carries two), and taking
 * the first one's positions would place an epitope of somebody else's protein
 * on this chain.
 */
export function epitopesOf(answered: unknown, accession: string): readonly Epitope[] {
  const wanted = `UNIPROT:${accession.trim().toUpperCase()}`;
  if (!Array.isArray(answered)) return [];
  return (answered as readonly unknown[]).flatMap((value) => {
    const structure = objectOf(value);
    const id = textAt(structure, 'structure_iri');
    if (id === null) return [];
    const antigens = Array.isArray(structure?.['curated_source_antigens']) ? (structure['curated_source_antigens'] as readonly unknown[]) : [];
    const mine = antigens.map(objectOf).find((antigen) => (textAt(antigen, 'iri') ?? '').toUpperCase() === wanted) ?? null;
    return [
      {
        id,
        sequence: textAt(structure, 'linear_sequence'),
        from: numberAt(mine, 'starting_position'),
        to: numberAt(mine, 'ending_position'),
      } satisfies Epitope,
    ];
  });
}

/**
 * THE EPITOPES ALREADY RECORDED FOR ONE ACCESSION.
 *
 * ```ts
 * const read = await knownEpitopes('P05798', browserArchive);
 * read.ok && read.value.length;   // 0 — asked, and none are known
 * ```
 *
 * AN EMPTY LIST IS AN ANSWER AND NEVER A REFUSAL, which is this stage's
 * cleanest honesty test: *no epitope is recorded for this sequence* is a fact
 * about the sequence, and it reads that way on the page rather than as a blank
 * or as a stage that did not run (`./annotationFold.ts` · `EPITOPES_NAMED`).
 * The `./family.ts` · `pfamMatches` precedent, which says the same thing about
 * a chain in no family.
 */
export async function knownEpitopes(accession: string, doors: ArchiveFetch): Promise<FromArchive<readonly Epitope[]>> {
  const at = ANNOTATION_URLS.epitopes(accession);
  const knocked = await knock(doors, at);
  if (!knocked.ok) return knocked;
  const answer = knocked.value;
  // NO CONTENT IS AN ANSWER, and it is read BEFORE the parse — the
  // `./family.ts` · `pfamMatches` reasoning, verbatim: `fetch` reports a 204 as
  // ok, and `JSON.parse('')` throws a syntax error where the service said
  // something perfectly clear.
  if (answer.status === 204 || answer.body.trim() === '') return { ok: true, value: [] };
  if (!answer.ok) {
    return { ok: false, sentence: `the epitope service at ${at} answered ${String(answer.status)} for "${accession}", so whether any epitope is recorded for that sequence is unknown — which is not the same as none — and no residue of its chain carries one. It said: ${quoted(answer.body)}` };
  }
  try {
    return { ok: true, value: epitopesOf(JSON.parse(answer.body), accession) };
  } catch {
    return { ok: false, sentence: `the epitope service at ${at} answered ${String(answer.status)} with something that is not JSON — the first characters are "${quoted(answer.body)}". No residue of this chain carries an epitope.` };
  }
}
