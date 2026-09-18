/**
 * EVERYTHING A CONSERVATION SCORE NEEDS, GATHERED — and gathered from either
 * the committed fixtures or the three live services, through one port.
 *
 * ── WHAT IS CITED AND WHAT IS COMPUTED, once more, because this is the module
 * that could blur it ───────────────────────────────────────────────────────
 * Everything in {@link ConservationEvidence} is somebody else's published
 * work: the archive's mapping records, InterPro's family match, and the
 * family's own curated alignment with its accession AND VERSION read out of
 * its `#=GF AC` header. Nothing here is computed. The one computation on this
 * stage is the PLACEMENT, and it happens in `./conservationFold.ts` over this
 * evidence.
 *
 * ── THE EXAMPLE NEVER TOUCHES A SERVICE ────────────────────────────────────
 * {@link conservationEvidenceFor} routes the committed entry to the committed
 * fixtures and calls no service at all — the `./archive.ts` · `openEntryBytes`
 * precedent, for the same two reasons: the demo works with the network
 * unplugged, and the example's provenance stays the record in
 * `data/prot/conservation/PROVENANCE.json` rather than whatever a service
 * serves today. `tests/prot-conservation.test.ts` counts the calls on that
 * path and asserts zero.
 *
 * ── THE PORT IS A TEXT READER, and that is the whole of it ─────────────────
 * The fixtures are read with {@link ReadCommitted}, `(file) => Promise<string>`
 * — `src/prot/http.ts` fetches under the site's base in a browser,
 * `src/prot/snapshot.ts` reads them off disk in node, and a test hands a map.
 * A module that reached for `fetch` or for `node:fs` would be a module only one
 * of those three can load.
 *
 * ── AND IT NEVER THROWS ────────────────────────────────────────────────────
 * Every way this can fail is a SENTENCE on the evidence — per chain where the
 * chain is what failed, and on the entry where the whole read did. A chain
 * with no family leaves the other chain's score standing, which is the rule
 * this shape exists to keep.
 */
import { EXAMPLE_ENTRY, type ArchiveFetch, type FromArchive } from './archive.js';
import { conservationFileOf } from '../data/files.js';
import { chainMappingsOf, entityMappings } from './entities.js';
import { familyAlignment, pfamMatches, pfamMatchesOf, type PfamMatch } from './family.js';
import { parseStockholm, type StockholmAlignment } from './stockholm.js';
import type { ChainMapping } from './mapping.js';

/** WHICH alignment this build scores over. 283 sequences and 3,982 sequences are different claims — see `data/prot/conservation/fetch.mjs`. */
export const ALIGNMENT_USED = 'seed';

/** One family a chain is in, with the curated alignment behind it. A chain can be in more than one. */
export interface FamilyEvidence {
  readonly match: PfamMatch;
  readonly alignment: StockholmAlignment;
}

/** What is known about one chain — and, where nothing is, the sentence saying why. */
export interface ChainEvidence {
  /** The author's own chain label, as the coordinate file spells it. */
  readonly chain: string;
  /** Hops 3 and 4's records for this chain (`./mapping.ts`). */
  readonly mapping: ChainMapping;
  /** Every family this chain's reference sequence matches, each with its alignment. Empty where there is none. */
  readonly families: readonly FamilyEvidence[];
  /** Why this chain has no family alignment behind it, or `null`. A chain with a refusal scores nothing and says so by name. */
  readonly refusal: string | null;
}

/** Everything gathered for one entry. Never a throw — see the file header. */
export interface ConservationEvidence {
  readonly entry: string;
  readonly chains: readonly ChainEvidence[];
  /** Where it came from: the bytes this repository committed, or the three live services. */
  readonly from: 'committed' | 'live';
  /** Sentences about the whole read — the archive's entity records unavailable, or an entry with no polymer at all. */
  readonly refusals: readonly string[];
}

/** The port: one committed file's text, by its repo-and-site-relative path (`src/data/files.ts`). */
export type ReadCommitted = (file: string) => Promise<string>;

/** An evidence with nothing in it and one sentence — what every refusal below hands back. */
const nothing = (entry: string, from: 'committed' | 'live', sentence: string): ConservationEvidence => ({ entry, chains: [], from, refusals: [sentence] });

/**
 * THE THREE READS, AS A PORT — the one seam between "where the evidence comes
 * from" and "how it is put together".
 *
 * The committed files and the three live services are two ADAPTERS of this one
 * shape, and {@link gatherConservation} is the only thing that knows the order
 * the facts depend on each other in. It was written twice for one round —
 * fifty lines each, identical but for the reads — which is exactly the drift
 * this repository refuses: the sentence a chain with no family is refused with
 * has to be the same sentence whichever door answered.
 */
export interface EvidenceReaders {
  /** Which of the two this is, for {@link ConservationEvidence.from}. */
  readonly from: 'committed' | 'live';
  /** The archive's own entity records: the sequence, the accession, and hops 3 and 4 (`./entities.ts`). */
  entities(entry: string): Promise<FromArchive<readonly ChainMapping[]>>;
  /** Which Pfam families one accession is in, and over which reference residues (`./family.ts`). */
  matches(accession: string): Promise<FromArchive<readonly PfamMatch[]>>;
  /** One family's curated alignment, parsed, with its accession AND version (`./stockholm.ts`). */
  alignment(family: string): Promise<FromArchive<StockholmAlignment>>;
}

/** The committed files, read through the port a host hands in. */
export const committedReaders = (read: ReadCommitted): EvidenceReaders => ({
  from: 'committed',
  entities: async (entry) => await readCommitted(conservationFileOf.entities(entry), read, (text) => ({ ok: true, value: chainMappingsOf(JSON.parse(text) as Readonly<Record<string, unknown>>) })),
  matches: async (accession) => await readCommitted(conservationFileOf.matches(accession), read, (text) => ({ ok: true, value: pfamMatchesOf(JSON.parse(text)) })),
  alignment: async (family) => await readCommitted(conservationFileOf.alignment(family), read, (text) => parseStockholm(text)),
});

/** The three live services, through one `fetch`. */
export const serviceReaders = (doors: ArchiveFetch): EvidenceReaders => ({
  from: 'live',
  entities: (entry) => entityMappings(entry, doors),
  matches: (accession) => pfamMatches(accession, doors),
  alignment: (family) => familyAlignment(family, doors),
});

/**
 * ONE COMMITTED FILE, READ AND PARSED — with a THROW turned into the sentence
 * every other refusal on this stage is.
 *
 * A committed file can be missing from a build, or a mis-deployed site can
 * answer HTML for it (`./http.ts` refuses that by name), and `JSON.parse`
 * throws. None of those may reach a click handler as an unhandled promise, so
 * the throw is caught HERE, once — the `./archive.ts` · `knock` discipline,
 * one door along.
 */
async function readCommitted<T>(file: string, read: ReadCommitted, parse: (text: string) => FromArchive<T>): Promise<FromArchive<T>> {
  try {
    return parse(await read(file));
  } catch (error) {
    return { ok: false, sentence: `the committed file ${file} could not be read (${error instanceof Error ? error.message : String(error)}).` };
  }
}

/**
 * THE EVIDENCE, GATHERED — the reads in the order the facts depend on each
 * other, and a sentence wherever one of them could not be made.
 *
 * The order is not an optimisation: the entity records name the accessions,
 * the accessions' match records name the families, and the families name their
 * alignments. It is the same order `data/prot/conservation/fetch.mjs` writes
 * the committed files in, so the committed set is exactly what this function
 * asks for.
 *
 * ONE CHAIN'S FAILURE IS THAT CHAIN'S SENTENCE and never the entry's — a
 * heteromeric complex where one chain is in no family still draws a score for
 * the other, and saying so by name is the rule this shape exists to keep.
 * Only a failure to read the ENTRY's own records empties the whole answer,
 * because with no chains there is nothing to be per-chain about.
 */
export async function gatherConservation(entry: string, readers: EvidenceReaders): Promise<ConservationEvidence> {
  const asked = entry.trim().toUpperCase();
  const read = await readers.entities(asked);
  if (!read.ok) return nothing(asked, readers.from, read.sentence);
  if (read.value.length === 0) return nothing(asked, readers.from, `the ${readers.from === 'committed' ? 'committed' : "archive's"} entity records for "${asked}" carry no protein polymer chain, so there is no sequence to place in a family alignment.`);
  /** One alignment per family, read once — two chains of one family are one read. Either the alignment or the sentence it was refused with. */
  const alignments = new Map<string, StockholmAlignment | string>();
  const chains: ChainEvidence[] = [];
  for (const mapping of read.value) {
    if (mapping.accession === null) {
      chains.push({ chain: mapping.chain, mapping, families: [], refusal: noReference(mapping.chain) });
      continue;
    }
    const matched = await readers.matches(mapping.accession);
    if (!matched.ok) {
      chains.push({ chain: mapping.chain, mapping, families: [], refusal: `${matched.sentence} Every other chain's score stands.` });
      continue;
    }
    if (matched.value.length === 0) {
      chains.push({ chain: mapping.chain, mapping, families: [], refusal: noFamily(mapping.chain, mapping.accession) });
      continue;
    }
    const families: FamilyEvidence[] = [];
    const refusals: string[] = [];
    for (const match of matched.value) {
      if (!alignments.has(match.family)) {
        const got = await readers.alignment(match.family);
        alignments.set(match.family, got.ok ? got.value : got.sentence);
      }
      const resolved = alignments.get(match.family)!;
      if (typeof resolved === 'string') refusals.push(`chain ${mapping.chain} is in ${match.family} and this build could not read that family's alignment — ${resolved} No residue of chain ${mapping.chain} is scored from it.`);
      else families.push({ match, alignment: resolved });
    }
    chains.push({ chain: mapping.chain, mapping, families, refusal: families.length === 0 && refusals.length > 0 ? refusals.join(' ') : null });
  }
  return { entry: asked, chains, from: readers.from, refusals: [] };
}

/** The committed fixtures — the example's evidence, with no service called. See {@link gatherConservation}. */
export const evidenceFromCommitted = (entry: string, read: ReadCommitted): Promise<ConservationEvidence> => gatherConservation(entry, committedReaders(read));

/** The same evidence, live — the three services. See {@link gatherConservation}. */
export const evidenceFromServices = (entry: string, doors: ArchiveFetch): Promise<ConservationEvidence> => gatherConservation(entry, serviceReaders(doors));

/** A chain the archive matched to no reference sequence — the first refusal, said by name. */
export const noReference = (chain: string): string =>
  `chain ${chain} is matched to no UniProt sequence in the archive's own record, so there is no family to look its residues up in and no residue of chain ${chain} is scored. Every other chain's score stands.`;

/** A chain whose reference sequence is in no Pfam family — the second refusal, said by name. */
export const noFamily = (chain: string, accession: string): string =>
  `chain ${chain} (${accession}) is in no Pfam family, so there is no curated alignment to score its residues against and no residue of chain ${chain} is scored. Every other chain's score stands.`;

/** The two doors a caller needs, named — the `./archive.ts` · `EntryDoors` shape, one service short. */
export interface ConservationDoors {
  /** Reads a committed file under the site's base or off disk. */
  readonly committed: ReadCommitted;
  /** The live services, as one `fetch`. */
  readonly archive: ArchiveFetch;
}

/**
 * ONE ENTRY'S EVIDENCE — the committed fixtures for the example, the three
 * services for everything else.
 *
 * ```ts
 * const evidence = await conservationEvidenceFor('1AY7', { committed: readUnderSiteBase, archive: browserArchive });
 * evidence.from;                                        // 'committed' — nothing was called
 * evidence.chains.map((c) => c.families[0]?.alignment.cited);
 * // ['PF00545.26', 'PF01337.25']
 * ```
 */
export async function conservationEvidenceFor(entry: string, doors: ConservationDoors): Promise<ConservationEvidence> {
  const asked = entry.trim().toUpperCase();
  return asked === EXAMPLE_ENTRY ? await evidenceFromCommitted(asked, doors.committed) : await evidenceFromServices(asked, doors.archive);
}
