/**
 * WHAT IS ALREADY KNOWN, FOLDED ONTO THIS DESK'S OWN ROWS — the one
 * computation the functional annotation stage makes, and every one of its
 * refusals.
 *
 * The evidence is somebody else's published work stated in SOMEBODY ELSE'S
 * COORDINATES: a UniProt position, which is not a PDB residue number. This
 * module carries each fact across that gap and no further — the words it lands
 * are the source's own, verbatim, and it re-classifies nothing.
 *
 * ── THE HOPS ARE NOT WRITTEN HERE, AND THAT IS THE POINT ───────────────────
 * `./mapping.ts` owns them and has since the conservation stage needed them —
 * its own header names THIS stage as the second caller and says why they are
 * declared where either can import them and neither owns them. So:
 *
 *   a site feature's position  → `residueKeyOfReference`
 *   a domain's reference RANGE → `entityPositionsOfReferenceRange` then
 *                                `residueKeyOfEntity`
 *
 * A range is walked through the second pair rather than through the first
 * because a range is a RANGE OF THE REFERENCE and the chain can cover it in
 * pieces — an entity with two aligned regions covers a reference range with a
 * hole in the middle, and a single `[lo, hi]` would silently include the
 * residues in between. That module's own doc comment gives the worked example.
 *
 * ── AND 1AY7 IS WHY THIS COULD NOT BE ASSUMED ──────────────────────────────
 * On chain A every hop is the identity, so an implementation that simply read
 * `Active site 54` as *residue A:54* passes every assertion this desk can make
 * about its own chain A. Chain B of the same entry is NOT the identity: its
 * `aligned_regions` say entity 1 sits at reference 2, so UniProt position 1 has
 * no residue here AT ALL and PF01337's declared range `1..81` lands on
 * `B:1 … B:80` — eighty residues, not eighty-one, and shifted by one from
 * where an identity would have put them. `tests/prot-annotation.test.ts` pins
 * that landing through the mapping rather than re-pinning the mapping, which
 * `tests/prot-mapping.test.ts` already does.
 *
 * ── A POSITION THAT LANDS NOWHERE LANDS NOTHING, AND IS COUNTED ────────────
 * `./etl.ts`'s skip counts are the precedent: a fact this desk cannot place is
 * dropped, counted with its reason, and the count goes on the screen. Never a
 * guess and never a silence.
 *
 * ── ONE COLUMN CANNOT HOLD TWO, so the rule is stated rather than implied ──
 * Two facts from one source can cover one residue, and the two cases are
 * answered differently because they are different:
 *
 *   SITES are the source's own list in the source's own order, and two site
 *   features on one residue is a real thing (a modified residue that is also a
 *   binding site). The FIRST in the record's order is kept and the rest are
 *   counted — order is the only preference UniProt states, and inventing a
 *   ranking over its type words would be this desk re-classifying its data.
 *
 *   DOMAINS overlap by construction, and the rule is {@link NARROWEST}: the
 *   accession whose declared reference range is the SHORTEST wins, because a
 *   narrower range is the more specific statement about the residue. Where two
 *   are exactly as narrow the residue lands NOTHING and is counted, because
 *   picking by list order there would be a preference the source never stated.
 *
 * ── AND WHY THE DOMAIN COLUMN NAMES ONE MEMBER DATABASE ────────────────────
 * Measured, on this very entry, and it is what settled the rule. InterPro's
 * `entry/all` door answers SIX entries for `P05798` — `cd00607 2..93`,
 * `G3DSA:3.10.450.30 1..96`, `IPR000026 5..92`, `IPR016191 1..96`,
 * `PF00545 5..92`, `SSF53933 2..96` — and the two narrowest are `IPR000026` and
 * `PF00545`, both `5..92`, a dead tie on 88 positions. So *narrowest* alone
 * decides nothing there, and a column drawn from `entry/all` would land
 * NOTHING on the eighty-eight residues a reader most wants named. Naming ONE
 * member database is what makes the tie rare instead of guaranteed — and the
 * one this desk names is Pfam, because `./family.ts` already reads exactly that
 * record for the conservation stage and this stage reuses the read rather than
 * opening a second door onto the same question.
 */
import { entityPositionsOfReferenceRange, residueKeyOfEntity, residueKeyOfReference } from './mapping.js';
import { positionsOfSite } from './annotation.js';
import type { ChainAnnotation, AnnotationEvidence } from './annotationEvidence.js';

/** The rule this stage resolves an overlap with, in one sentence — printed on the card and pinned by a test. */
export const NARROWEST =
  'where two domains both cover a residue the narrower one wins, because a shorter declared range is the more specific statement about that residue; where two are exactly as narrow the residue is left ABSENT and counted, since picking one there would be a preference the source never stated';

/** Which member database the domain column names, and why it names one. See the file header for the measurement. */
export const ONE_MEMBER_DATABASE =
  'the domain column names Pfam and no other member database. InterPro\'s all-databases door answers six entries for this entry\'s chain A and the two narrowest — IPR000026 and PF00545 — are both 5..92, a dead tie that would have left the eighty-eight residues a reader most wants named ABSENT. One member database is what makes that tie rare rather than certain, and Pfam is the one this repository already reads for the conservation stage';

/** The three sources, named the way the page names them — no reader below spells one. */
export const ANNOTATION_SOURCES = { sites: 'UniProt', domains: 'InterPro (Pfam)', epitopes: 'IEDB' } as const;

/** What one source said about one chain, as a row the card prints. */
export interface SourceReport {
  /** The source's own name, from {@link ANNOTATION_SOURCES}. */
  readonly source: string;
  readonly chain: string;
  /** The accession it was asked about, or `null` for a chain that has none. */
  readonly accession: string | null;
  /** Whether it answered at all. See `./annotationEvidence.ts` · `SourceAnswer` for why this is not the same as naming something. */
  readonly answered: boolean;
  /** How many things it named. `0` with `answered` is a FACT; `0` without it is *nobody knows*. */
  readonly named: number;
  /** What it named, each with the reference range it was stated over — the card's own rows. */
  readonly ranges: readonly string[];
  /** Why it could not be asked, verbatim. `null` where it answered. */
  readonly refusal: string | null;
}

/** What the fold did, in numbers — every one of them on the screen. */
export interface AnnotationCounts {
  /** How many rows it folded over. */
  readonly residues: number;
  /** How many carry a named site, a note, a domain and an epitope. */
  readonly sited: number;
  readonly noted: number;
  readonly domained: number;
  readonly epitoped: number;
  /**
   * REFERENCE POSITIONS THIS ENTRY HAS NO ROW FOR — dropped, never guessed.
   *
   * A construct is not its reference sequence: it can start later, end earlier
   * or leave a stretch out, and a residue with an insertion code is a row this
   * desk's minted key cannot spell (`./mapping.ts` · `authOfEntity`).
   */
  readonly unmapped: number;
  /** Residues where two facts from one source covered the same row — see the file header for which one is kept. */
  readonly collided: number;
  /** Epitopes the database records with no position on the sequence at all, so there is nowhere to draw them. */
  readonly unplaced: number;
  /** One row per source per chain — what each was asked and what each said. */
  readonly sources: readonly SourceReport[];
}

/** The four columns, aligned to the residue keys the act was handed, and everything the card has to say. */
export interface AnnotationFold {
  readonly uniprot_site: readonly (string | null)[];
  readonly uniprot_note: readonly (string | null)[];
  readonly pfam_domain: readonly (string | null)[];
  readonly epitope: readonly (string | null)[];
  readonly counts: AnnotationCounts;
  /** One sentence per chain that has nothing known about it, and per source that would not answer. */
  readonly refusals: readonly string[];
}

/** A chain's reports, one per source. */
function reportsOf(chain: ChainAnnotation): readonly SourceReport[] {
  const row = <T>(source: string, answer: { readonly answered: boolean; readonly named: readonly T[]; readonly refusal: string | null }, ranges: readonly string[]): SourceReport => ({
    source,
    chain: chain.chain,
    accession: chain.accession,
    answered: answer.answered,
    named: answer.named.length,
    ranges,
    refusal: answer.refusal,
  });
  return [
    row(
      ANNOTATION_SOURCES.sites,
      chain.sites,
      chain.sites.named.map((f) => `${f.type} ${f.from === f.to ? String(f.from) : `${String(f.from)}..${String(f.to)}`}${f.note === null ? '' : ` — ${f.note}`}`),
    ),
    row(
      ANNOTATION_SOURCES.domains,
      chain.domains,
      chain.domains.named.map((m) => `${m.family}${m.name === null ? '' : ` ${m.name}`} ${String(m.from)}..${String(m.to)}`),
    ),
    row(
      ANNOTATION_SOURCES.epitopes,
      chain.epitopes,
      chain.epitopes.named.map((e) => `${e.id}${e.from === null || e.to === null ? ' — no position on this sequence' : ` ${String(e.from)}..${String(e.to)}`}`),
    ),
  ];
}

/**
 * THE FOLD — every fact carried onto the rows it is about, and everything that
 * could not be.
 *
 * ```ts
 * const fold = foldAnnotation(evidence, keys);
 * fold.uniprot_site[keys.indexOf('A:54')];  // 'Active site'
 * fold.uniprot_note[keys.indexOf('A:54')];  // 'Proton acceptor'
 * fold.uniprot_site[keys.indexOf('A:8')];   // null — inside the disulfide's two ends, not in the bond
 * fold.counts.epitoped;                     // 0, and `counts.sources` says the service ANSWERED
 * ```
 */
export function foldAnnotation(evidence: AnnotationEvidence, residueKeys: readonly string[]): AnnotationFold {
  const at = new Map(residueKeys.map((key, index) => [key, index]));
  const site: (string | null)[] = residueKeys.map(() => null);
  const note: (string | null)[] = residueKeys.map(() => null);
  const domain: (string | null)[] = residueKeys.map(() => null);
  /** How wide the winning domain's declared range was, per row — the state {@link NARROWEST} needs. `null` where a tie emptied the row. */
  const domainWidth: (number | null)[] = residueKeys.map(() => null);
  /** Rows a tie has already emptied, so a third, wider domain cannot fill one back in. */
  const tied = new Set<number>();
  const epitope: (string | null)[] = residueKeys.map(() => null);
  const refusals: string[] = [];
  const sources: SourceReport[] = [];
  let unmapped = 0;
  let collided = 0;
  let unplaced = 0;

  for (const chain of evidence.chains) {
    sources.push(...reportsOf(chain));
    if (chain.refusal !== null) refusals.push(chain.refusal);
    for (const answer of [chain.sites, chain.domains, chain.epitopes]) {
      if (answer.refusal !== null && answer.refusal !== chain.refusal) refusals.push(answer.refusal);
    }

    // ── the sites: each one's own positions, through hop 3 then hop 4 ───────
    for (const feature of chain.sites.named) {
      for (const position of positionsOfSite(feature)) {
        const key = residueKeyOfReference(chain.mapping, position);
        const index = key === null ? undefined : at.get(key);
        if (index === undefined) {
          unmapped += 1;
          continue;
        }
        // THE FIRST IN THE SOURCE'S OWN ORDER IS KEPT — see the file header.
        if (site[index] !== null) {
          collided += 1;
          continue;
        }
        site[index] = feature.type;
        // THE NOTE IS ABSENT WHERE THE SOURCE NAMES NOTHING, never `"none"`
        // and never the type word repeated: `./annotation.ts` reads an empty
        // description as `null` and this is where that stays true.
        note[index] = feature.note;
      }
    }

    // ── the domains: a reference RANGE, walked into the entity's own ───────
    for (const match of chain.domains.named) {
      const width = match.to - match.from + 1;
      const positions = entityPositionsOfReferenceRange(chain.mapping.regions, match.from, match.to, chain.mapping.sequence.length);
      // EVERY REFERENCE POSITION THE CHAIN HAS NO RESIDUE FOR IS COUNTED. The
      // hop answers with the positions it could carry, so what it dropped is
      // the difference — which on chain B of the committed entry is exactly
      // one: UniProt position 1, which this construct does not have.
      unmapped += width - positions.length;
      for (const entity of positions) {
        const key = residueKeyOfEntity(chain.mapping, entity);
        const index = key === null ? undefined : at.get(key);
        if (index === undefined) {
          unmapped += 1;
          continue;
        }
        if (tied.has(index)) continue;
        const standing = domainWidth[index];
        if (standing === undefined || standing === null) {
          domain[index] = match.family;
          domainWidth[index] = width;
          continue;
        }
        if (width === standing && domain[index] !== match.family) {
          // AS NARROW AS EACH OTHER AND NOT THE SAME ANSWER: the row lands
          // NOTHING and is counted. See {@link NARROWEST}.
          collided += 1;
          tied.add(index);
          domain[index] = null;
          domainWidth[index] = null;
          continue;
        }
        if (width < standing) {
          collided += 1;
          domain[index] = match.family;
          domainWidth[index] = width;
        } else if (width > standing) collided += 1;
      }
    }

    // ── the epitopes: the same reference range, the same two hops ──────────
    for (const known of chain.epitopes.named) {
      if (known.from === null || known.to === null) {
        // RECORDED, AND NOWHERE TO DRAW IT: an epitope the database carries
        // with no position on this sequence is a real epitope this desk cannot
        // put on a residue, which is counted rather than placed at a guess.
        unplaced += 1;
        continue;
      }
      for (const entity of entityPositionsOfReferenceRange(chain.mapping.regions, known.from, known.to, chain.mapping.sequence.length)) {
        const key = residueKeyOfEntity(chain.mapping, entity);
        const index = key === null ? undefined : at.get(key);
        if (index === undefined) {
          unmapped += 1;
          continue;
        }
        if (epitope[index] !== null) {
          collided += 1;
          continue;
        }
        epitope[index] = known.id;
      }
    }
  }

  const placed = (values: readonly (string | null)[]): number => values.filter((value) => value !== null).length;
  return {
    uniprot_site: site,
    uniprot_note: note,
    pfam_domain: domain,
    epitope,
    counts: {
      residues: residueKeys.length,
      sited: placed(site),
      noted: placed(note),
      domained: placed(domain),
      epitoped: placed(epitope),
      unmapped,
      collided,
      unplaced,
      sources,
    },
    refusals: [...evidence.refusals, ...refusals],
  };
}

/**
 * WHAT THE PAGE SAYS WHEN A SOURCE ANSWERED AND NAMED NOTHING — a FACT, and it
 * has to read as one.
 *
 * This is the sentence the epitope service earns on the committed entry, and it
 * is the cleanest honesty test this stage has: `[]` is not a blank, not a
 * failure and not a stage that did not run. A source that could NOT be asked
 * gets its own refusal sentence instead (`./annotationEvidence.ts`), and the
 * two never share words.
 *
 * `null` where the source named something, or where it never answered — in both
 * of those cases there is something truer to say.
 */
export function namedNone(reports: readonly SourceReport[], source: string): string | null {
  const rows = reports.filter((row) => row.source === source);
  if (rows.length === 0 || rows.some((row) => !row.answered) || rows.some((row) => row.named > 0)) return null;
  const asked = rows.map((row) => `chain ${row.chain}${row.accession === null ? '' : ` (${row.accession})`}`).join(' and ');
  return `${source} was asked about ${asked} and named none — that is an ANSWER about this entry and not a silence: none are recorded, so no residue here carries one.`;
}

/** How many facts landed nowhere, said the way `./etl.ts` says its skips — `null` where none did. */
export function landedNowhere(counts: AnnotationCounts): string | null {
  const parts = [
    counts.unmapped === 0 ? null : `${counts.unmapped.toLocaleString('en-US')} reference ${counts.unmapped === 1 ? 'position has' : 'positions have'} no residue on this desk at all — a construct is not its reference sequence, so a position outside what the depositors built, or one whose residue carries an insertion code, lands NOTHING rather than landing on a neighbour`,
    counts.collided === 0 ? null : `${counts.collided.toLocaleString('en-US')} ${counts.collided === 1 ? 'fact' : 'facts'} met another on the same residue, and one column cannot hold two: ${NARROWEST}`,
    counts.unplaced === 0 ? null : `${counts.unplaced.toLocaleString('en-US')} recorded ${counts.unplaced === 1 ? 'epitope carries' : 'epitopes carry'} no position on this sequence, so there is nowhere on these rows to draw ${counts.unplaced === 1 ? 'it' : 'them'}`,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join('. ');
}
