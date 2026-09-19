/**
 * EVERYTHING THE FUNCTIONAL ANNOTATION STAGE NEEDS, GATHERED — from the
 * committed fixtures or from the live services, through one port.
 *
 * ── NOTHING HERE IS COMPUTED, and this is the module that could blur it ────
 * Every field of {@link AnnotationEvidence} is somebody else's published work:
 * the archive's mapping records, UniProt's site features with their own
 * descriptions, InterPro's Pfam match ranges and the IEDB's epitope records.
 * The one computation on this stage is carrying each of those from the
 * coordinate system it was stated in to the rows this desk draws, and that
 * happens in `./annotationFold.ts` over this evidence, through the hops
 * `./mapping.ts` owns.
 *
 * ── FOUR READS, AND TWO OF THEM ARE SOMEBODY ELSE'S DOOR ───────────────────
 * `entities` and `matches` are the CONSERVATION stage's reads, and this module
 * calls the same functions over the same committed files (`./entities.ts` ·
 * `chainMappingsOf`, `./family.ts` · `pfamMatchesOf`). A second door onto one
 * question is a second ANSWER to it — and the archive's answer to *which
 * residue of this file is position N of this sequence* is the one thing on this
 * desk that, quietly wrong, would put a catalytic residue on the wrong atom.
 * `./mapping.ts`'s own header said so before this stage existed.
 *
 * ── THE EXAMPLE NEVER TOUCHES A SERVICE ────────────────────────────────────
 * {@link annotationEvidenceFor} routes the committed entry to the committed
 * fixtures and calls no service at all — the `./conservationEvidence.ts`
 * precedent, for the same two reasons: the demo works with the network
 * unplugged, and the example's provenance stays the record in
 * `data/prot/annotation/PROVENANCE.json` rather than whatever a service serves
 * today. `tests/prot-annotation.test.ts` counts the calls on that path and
 * asserts zero.
 *
 * ── AND IT NEVER THROWS, AND ONE SOURCE'S SILENCE IS NOT THE OTHERS' ───────
 * Every way this can fail is a SENTENCE, and it is kept at the narrowest place
 * it is true of: a chain with no UniProt reference is that CHAIN's sentence, a
 * service that would not answer is that SOURCE's sentence ON that chain, and
 * only a failure to read the ENTRY's own records empties the whole answer. So
 * three live services mean that a slow or absent one leaves the other two's
 * evidence standing — exactly as this desk leaves the rest of itself standing
 * when one stage is refused.
 *
 * ── AND A SERVICE THAT NAMES NOTHING IS NOT A FAILURE ──────────────────────
 * The IEDB answers `[]` for both of the committed entry's accessions, and that
 * is an ANSWER: asked, and none are known. It is recorded as
 * {@link SourceAnswer.answered} `true` with an empty list, never as a refusal
 * and never as a silence — which is what lets `./annotationFold.ts` say *the
 * service answered and named none* rather than leaving a reader to wonder
 * whether anyone asked.
 */
import { EXAMPLE_ENTRY, type ArchiveFetch, type FromArchive } from './archive.js';
import { annotationFileOf, conservationFileOf } from '../data/files.js';
import { chainMappingsOf, entityMappings } from './entities.js';
import { epitopesOf, knownEpitopes, uniprotSites, uniprotSitesOf, type Epitope, type SiteFeature, type UniprotSites } from './annotation.js';
import { pfamMatches, pfamMatchesOf, type PfamMatch } from './family.js';
import type { ChainMapping } from './mapping.js';
import type { ReadCommitted } from './conservationEvidence.js';

/**
 * WHAT ONE SOURCE SAID ABOUT ONE CHAIN — the thing it named, or the sentence it
 * could not be asked with.
 *
 * The two are deliberately not one field. A list of none with `answered: true`
 * is *the service was asked and named none*; the same list with a `refusal` is
 * *nobody knows, because the door did not open*. Those are different facts
 * about the world and the page says which — the distinction the epitope service
 * makes this stage's cleanest test of.
 */
export interface SourceAnswer<T> {
  /** Whether the source was reached and gave an answer, whatever that answer was. */
  readonly answered: boolean;
  /** What it named. Empty where it named nothing, and empty where it was never reached. */
  readonly named: readonly T[];
  /** Why it could not be asked, verbatim from the door. `null` where it answered. */
  readonly refusal: string | null;
}

/** A source that answered, with what it named. */
const answered = <T>(named: readonly T[]): SourceAnswer<T> => ({ answered: true, named, refusal: null });
/** A source that could not be asked, with the door's own sentence. */
const refused = <T>(sentence: string): SourceAnswer<T> => ({ answered: false, named: [], refusal: sentence });

/** What is known about one chain, per source — and how long the sequence those positions are of is. */
export interface ChainAnnotation {
  /** The author's own chain label, as the coordinate file spells it. */
  readonly chain: string;
  /** Hops 3 and 4's records for this chain (`./mapping.ts`). */
  readonly mapping: ChainMapping;
  /** The UniProt accession this chain is matched to, or `null` — the one fact all three sources are keyed by. */
  readonly accession: string | null;
  /** UniProt's own site features for that accession. */
  readonly sites: SourceAnswer<SiteFeature>;
  /** How long the reference sequence is, as UniProt's own record states it. `null` where the record was not read. */
  readonly sequenceLength: number | null;
  /** InterPro's Pfam matches for that accession, with the reference ranges they cover. */
  readonly domains: SourceAnswer<PfamMatch>;
  /** The epitopes the IEDB records for that accession. */
  readonly epitopes: SourceAnswer<Epitope>;
  /** Why this chain has nothing known about it at all, or `null`. A chain with a refusal annotates nothing and says so BY NAME. */
  readonly refusal: string | null;
}

/** Everything gathered for one entry. Never a throw — see the file header. */
export interface AnnotationEvidence {
  readonly entry: string;
  readonly chains: readonly ChainAnnotation[];
  /** Where it came from: the bytes this repository committed, or the live services. */
  readonly from: 'committed' | 'live';
  /** Sentences about the whole read — the archive's entity records unavailable, or an entry with no polymer at all. */
  readonly refusals: readonly string[];
}

/** An evidence with nothing in it and one sentence — what every entry-level refusal below hands back. */
const nothing = (entry: string, from: 'committed' | 'live', sentence: string): AnnotationEvidence => ({ entry, chains: [], from, refusals: [sentence] });

/**
 * THE FOUR READS, AS A PORT — the one seam between "where what is known comes
 * from" and "how it is put together".
 *
 * The committed files and the live services are two ADAPTERS of this one shape,
 * and {@link gatherAnnotation} is the only thing that knows the order the facts
 * depend on each other in. The `./conservationEvidence.ts` · `EvidenceReaders`
 * shape, two sources wider.
 */
export interface AnnotationReaders {
  /** Which of the two this is, for {@link AnnotationEvidence.from}. */
  readonly from: 'committed' | 'live';
  /** The archive's own entity records: hops 3 and 4, and the accession (`./entities.ts`). NOT a door of this stage's own — see the file header. */
  entities(entry: string): Promise<FromArchive<readonly ChainMapping[]>>;
  /** The sequence's own site features (`./annotation.ts`). */
  sites(accession: string): Promise<FromArchive<UniprotSites>>;
  /** Which Pfam families one accession is in, and over which reference residues (`./family.ts`). NOT a door of this stage's own. */
  domains(accession: string): Promise<FromArchive<readonly PfamMatch[]>>;
  /** The epitopes already recorded for it (`./annotation.ts`). */
  epitopes(accession: string): Promise<FromArchive<readonly Epitope[]>>;
}

/**
 * ONE COMMITTED FILE, READ AND PARSED — with a THROW turned into the sentence
 * every other refusal on this stage is.
 *
 * The `./conservationEvidence.ts` · `readCommitted` discipline, one stage
 * along: a committed file can be missing from a build and a mis-deployed site
 * can answer HTML for it, and `JSON.parse` throws on both. None of those may
 * reach a click handler as an unhandled promise.
 */
async function readCommittedFile<T>(file: string, read: ReadCommitted, parse: (text: string) => FromArchive<T>): Promise<FromArchive<T>> {
  try {
    return parse(await read(file));
  } catch (error) {
    return { ok: false, sentence: `the committed file ${file} could not be read (${error instanceof Error ? error.message : String(error)}).` };
  }
}

/**
 * The committed files, read through the port a host hands in — and TWO of the
 * four names are the conservation stage's own (`src/data/files.ts` ·
 * `conservationFileOf`), which is the reuse this stage is built on.
 */
export const committedAnnotationReaders = (read: ReadCommitted): AnnotationReaders => ({
  from: 'committed',
  entities: async (entry) => await readCommittedFile(conservationFileOf.entities(entry), read, (text) => ({ ok: true, value: chainMappingsOf(JSON.parse(text) as Readonly<Record<string, unknown>>) })),
  sites: async (accession) => await readCommittedFile(annotationFileOf.uniprot(accession), read, (text) => ({ ok: true, value: uniprotSitesOf(JSON.parse(text)) })),
  domains: async (accession) => await readCommittedFile(conservationFileOf.matches(accession), read, (text) => ({ ok: true, value: pfamMatchesOf(JSON.parse(text)) })),
  epitopes: async (accession) => await readCommittedFile(annotationFileOf.epitopes(accession), read, (text) => ({ ok: true, value: epitopesOf(JSON.parse(text), accession) })),
});

/** The live services, through one `fetch`. */
export const annotationServiceReaders = (doors: ArchiveFetch): AnnotationReaders => ({
  from: 'live',
  entities: (entry) => entityMappings(entry, doors),
  sites: (accession) => uniprotSites(accession, doors),
  domains: (accession) => pfamMatches(accession, doors),
  epitopes: (accession) => knownEpitopes(accession, doors),
});

/**
 * WHAT IS KNOWN, GATHERED — the reads in the order the facts depend on each
 * other, and a sentence wherever one of them could not be made.
 *
 * The order is not an optimisation: the entity records name the accessions, and
 * the three sources are all keyed by an accession. It is the same order
 * `data/prot/annotation/fetch.mjs` writes the committed files in, so the
 * committed set is exactly what this function asks for.
 *
 * ONE CHAIN'S FAILURE IS THAT CHAIN'S SENTENCE, and one SOURCE's failure is
 * that source's: a chain matched to no UniProt sequence annotates nothing and
 * says so by name while every other chain stands, and a service that would not
 * answer takes only its own column down. Only a failure to read the ENTRY's own
 * records empties the whole answer, because with no chains there is nothing to
 * be per-chain about.
 */
export async function gatherAnnotation(entry: string, readers: AnnotationReaders): Promise<AnnotationEvidence> {
  const asked = entry.trim().toUpperCase();
  const read = await readers.entities(asked);
  if (!read.ok) return nothing(asked, readers.from, read.sentence);
  if (read.value.length === 0) return nothing(asked, readers.from, `the ${readers.from === 'committed' ? 'committed' : "archive's"} entity records for "${asked}" carry no protein polymer chain, so there is no sequence for anything to be known about.`);
  /** One accession's three answers, read once — two chains of one entity are one read of each source. */
  const seen = new Map<string, { readonly sites: FromArchive<UniprotSites>; readonly domains: FromArchive<readonly PfamMatch[]>; readonly epitopes: FromArchive<readonly Epitope[]> }>();
  const chains: ChainAnnotation[] = [];
  for (const mapping of read.value) {
    if (mapping.accession === null) {
      chains.push({
        chain: mapping.chain,
        mapping,
        accession: null,
        sites: refused<SiteFeature>(noAnnotationReference(mapping.chain)),
        sequenceLength: null,
        domains: refused<PfamMatch>(noAnnotationReference(mapping.chain)),
        epitopes: refused<Epitope>(noAnnotationReference(mapping.chain)),
        refusal: noAnnotationReference(mapping.chain),
      });
      continue;
    }
    if (!seen.has(mapping.accession)) {
      /*
        THE THREE SOURCES ARE ASKED TOGETHER, and a rejection of one is not a
        rejection of the read: `Promise.all` over three doors that each turn
        their own throw into a sentence (`./archive.ts` · `knock`,
        `readCommittedFile` above) answers three answers, never a rejection. So
        a slow or absent service costs its own column and no other.
      */
      const [sites, domains, epitopes] = await Promise.all([readers.sites(mapping.accession), readers.domains(mapping.accession), readers.epitopes(mapping.accession)]);
      seen.set(mapping.accession, { sites, domains, epitopes });
    }
    const got = seen.get(mapping.accession)!;
    chains.push({
      chain: mapping.chain,
      mapping,
      accession: mapping.accession,
      sites: got.sites.ok ? answered(got.sites.value.features) : refused<SiteFeature>(`${got.sites.sentence} Every other source and every other chain stands.`),
      sequenceLength: got.sites.ok ? got.sites.value.sequenceLength : null,
      domains: got.domains.ok ? answered(got.domains.value) : refused<PfamMatch>(`${got.domains.sentence} Every other source and every other chain stands.`),
      epitopes: got.epitopes.ok ? answered(got.epitopes.value) : refused<Epitope>(`${got.epitopes.sentence} Every other source and every other chain stands.`),
      // A CHAIN IS ONLY REFUSED WHERE ALL THREE SOURCES WERE: one source down
      // is one column down, and the chain still carries what the other two
      // named.
      refusal: got.sites.ok || got.domains.ok || got.epitopes.ok ? null : nothingKnown(mapping.chain, mapping.accession),
    });
  }
  return { entry: asked, chains, from: readers.from, refusals: [] };
}

/** The committed fixtures — the example's evidence, with no service called. See {@link gatherAnnotation}. */
export const annotationFromCommitted = (entry: string, read: ReadCommitted): Promise<AnnotationEvidence> => gatherAnnotation(entry, committedAnnotationReaders(read));

/** The same evidence, live — the four services. See {@link gatherAnnotation}. */
export const annotationFromServices = (entry: string, doors: ArchiveFetch): Promise<AnnotationEvidence> => gatherAnnotation(entry, annotationServiceReaders(doors));

/**
 * A CHAIN THE ARCHIVE MATCHED TO NO REFERENCE SEQUENCE — the first refusal,
 * said by name.
 *
 * All three of this stage's sources are keyed by a UniProt accession, so a
 * chain without one has nothing for any of them to answer about. That is a
 * fact about the CHAIN and not a failure of the stage, and every other chain's
 * annotation stands.
 */
export const noAnnotationReference = (chain: string): string =>
  `chain ${chain} is matched to no UniProt sequence in the archive's own record, and everything this stage can look up is keyed by one — so nothing is known about chain ${chain} here and no residue of it is annotated. Every other chain stands.`;

/** A chain whose accession all three sources refused to answer about — every one of their sentences is on the chain beside this one. */
export const nothingKnown = (chain: string, accession: string): string =>
  `nothing could be read about chain ${chain} (${accession}): all three of this stage's sources were asked and none of them answered, so no residue of chain ${chain} is annotated. Every other chain stands.`;

/** The two doors a caller needs, named — the `./conservationEvidence.ts` · `ConservationDoors` shape, one stage along. */
export interface AnnotationDoors {
  /** Reads a committed file under the site's base or off disk. */
  readonly committed: ReadCommitted;
  /** The live services, as one `fetch`. */
  readonly archive: ArchiveFetch;
}

/**
 * ONE ENTRY'S ANNOTATION EVIDENCE — the committed fixtures for the example, the
 * live services for everything else.
 *
 * ```ts
 * const evidence = await annotationEvidenceFor('1AY7', { committed: readUnderSiteBase, archive: browserArchive });
 * evidence.from;                                          // 'committed' — nothing was called
 * evidence.chains.map((c) => c.sites.named.length);       // [3, 0] — and the 0 is an ANSWER
 * evidence.chains.map((c) => c.epitopes.answered);        // [true, true] — asked, and none are known
 * ```
 */
export async function annotationEvidenceFor(entry: string, doors: AnnotationDoors): Promise<AnnotationEvidence> {
  const asked = entry.trim().toUpperCase();
  return asked === EXAMPLE_ENTRY ? await annotationFromCommitted(asked, doors.committed) : await annotationFromServices(asked, doors.archive);
}
