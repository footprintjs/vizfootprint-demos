/**
 * THE EVIDENCE, FOLDED ONTO THIS DESK'S ROWS — two columns, a count of every
 * residue that got no score, and one sentence per refusal.
 *
 * This is where the four hops meet. Each one is read rather than assumed and
 * each one is somebody else's, except the second, which is ours:
 *
 *   1. **alignment column → family position** — `./conservation.ts` ·
 *      `familyPositions`, off the Stockholm alignment's own columns.
 *   2. **our residue → family position** — `./placement.ts`, the ONE
 *      computation on this stage, by the WEAKER of its two methods.
 *   3. **reference position → entity position** — `./mapping.ts` ·
 *      `entityPositionsOfReferenceRange`, off the archive's own
 *      `aligned_regions`. This is what carries InterPro's domain range, which
 *      is stated in UniProt coordinates, into the numbering our sequence lives
 *      in.
 *   4. **entity position → author residue number** — `./mapping.ts` ·
 *      `residueKeyOfEntity`, off `auth_to_entity_poly_seq_mapping`, ending at
 *      the key `./etl.ts` · `residueKey` mints and nothing here respells.
 *
 * ── ABSENT, NEVER ZERO, AND COUNTED ────────────────────────────────────────
 * A residue outside the family's domain region has no column, so it has NO
 * SCORE: `conservation` is `null` there and never 0, because "this residue is
 * not in the part of the chain the family describes" is not a conservation of
 * nothing. On the committed entry that is 23 of 185 residues — PF00545 covers
 * UniProt 5..92 of a 96-residue chain, PF01337 covers 1..81 of a chain whose
 * first residue is UniProt position 2 — and the count is on the card.
 *
 * ── TWO CHAINS, TWO FAMILIES, TWO SCALES ───────────────────────────────────
 * `conservation_basis` is the accession WITH ITS VERSION of the alignment each
 * residue's score came from. It exists because the two chains of this entry are
 * scored against two different curated alignments, over different numbers of
 * sequences, and a reader who compared chain A's 0.8 with chain B's 0.8 as if
 * they were one scale would be comparing two different claims. The column is
 * the warning, in the data, where a caption cannot be missed.
 */
import { RESIDUE_KEY_SEPARATOR } from './etl.js';
import { SCORE_IS, SCORE_IS_NOT, conservationByPosition, consensusOf, familyPositions } from './conservation.js';
import { PLACEMENT_HERE, PLACEMENT_STRATEGIES, type PlacementMethod } from './placement.js';
import { entityPositionsOfReferenceRange, residueKeyOfEntity } from './mapping.js';
import type { ConservationEvidence } from './conservationEvidence.js';

export { SCORE_IS, SCORE_IS_NOT };

/** What the placement did for ONE chain — every number on the card, and the sentence where there is none. */
export interface ChainPlacement {
  readonly chain: string;
  /** The alignment cited for this chain: accession AND version, read out of its own header. `null` where none was. */
  readonly cited: string | null;
  /** The family accession without the version, and its own name. */
  readonly family: string | null;
  readonly familyName: string | null;
  /** How many sequences the scored alignment really holds, and how many its header says it does. */
  readonly sequences: number | null;
  readonly declaredSequences: number | null;
  /** How many of its columns are family positions (`./conservation.ts` · `FAMILY_POSITION_OCCUPANCY`). */
  readonly positions: number | null;
  /** The domain region the family covers, in REFERENCE (UniProt) coordinates — what InterPro declared. */
  readonly domain: readonly [number, number] | null;
  /** How many of this chain's own sequence positions that region reaches — hop 3's answer, which can be fewer. */
  readonly domainResidues: number | null;
  /** How many of those the placement put on a family position. */
  readonly placed: number;
  /** How many placed pairs hold the same letter in chain and consensus — whether the placement is plausible at all. */
  readonly identities: number | null;
  /** The alignment's own score, in the substitution matrix's units. */
  readonly score: number | null;
  /** This chain's rows on this desk, and how many of them ended with a score. */
  readonly residues: number;
  readonly scored: number;
  readonly absent: number;
  /** Which method placed it, or `null` for a chain nothing placed. */
  readonly method: PlacementMethod | null;
  /** Why this chain has no score, or `null`. Verbatim from whichever refusal applied. */
  readonly refusal: string | null;
}

/** What the whole fold did — the numbers the stage's own panel line and the card's foot are folded from. */
export interface ConservationCounts {
  readonly residues: number;
  readonly scored: number;
  readonly absent: number;
  readonly chains: readonly ChainPlacement[];
  /** Which arm of the placement port ran, and whether it is the weaker one. The BOOLEAN a consumer branches on. */
  readonly method: PlacementMethod;
  readonly weaker: boolean;
  /** How many residues two family matches both claimed. The first one placed keeps it; this is the count of the rest. */
  readonly overlaps: number;
}

/** The two columns, the counts, and every refusal — the act's whole answer. */
export interface ConservationFold {
  /** One value per residue key handed in, in that order. `null` where the residue has no column. */
  readonly conservation: readonly (number | null)[];
  /** The alignment each score came from, cited with its version. `null` wherever the score is. */
  readonly conservation_basis: readonly (string | null)[];
  readonly counts: ConservationCounts;
  /** Every sentence a reader must see — per chain where a chain failed, per entry where the read did. */
  readonly refusals: readonly string[];
}

/** Which chain a minted key belongs to — the key is `"<chain>:<resnum>"`, split at its LAST separator (`./etl.ts` · `residueKey`). */
const chainOfKey = (key: string): string => key.slice(0, key.lastIndexOf(RESIDUE_KEY_SEPARATOR));

/**
 * THE FOLD.
 *
 * ```ts
 * const fold = foldConservation(evidence, residueKeys);
 * fold.counts.scored;                        // 162 of 185 on the committed entry
 * fold.counts.absent;                        // 23 — outside the families' domain regions
 * fold.counts.chains.map((c) => c.cited);    // ['PF00545.26', 'PF01337.25']
 * fold.counts.weaker;                        // true — the consensus arm ran
 * ```
 *
 * A chain can match more than one family (a two-domain protein), so every
 * match is placed in turn and the FIRST one to claim a residue keeps it, with
 * the rest counted as `overlaps`. First-wins rather than best-wins because
 * "best" would need a comparison between two families' scores, which are on
 * two different scales — the very thing `conservation_basis` exists to warn a
 * reader about.
 */
export function foldConservation(evidence: ConservationEvidence, residueKeys: readonly string[], method: PlacementMethod = PLACEMENT_HERE): ConservationFold {
  const strategy = PLACEMENT_STRATEGIES[method];
  const scoreOf = new Map<string, number>();
  const basisOf = new Map<string, string>();
  const chains: ChainPlacement[] = [];
  const refusals: string[] = [...evidence.refusals];
  let overlaps = 0;

  for (const chain of evidence.chains) {
    const rows = residueKeys.filter((key) => chainOfKey(key) === chain.chain).length;
    if (chain.families.length === 0) {
      const refusal = chain.refusal ?? `chain ${chain.chain} has no curated family alignment behind it, so no residue of it is scored. Every other chain's score stands.`;
      refusals.push(refusal);
      chains.push(blankPlacement(chain.chain, rows, refusal));
      continue;
    }
    for (const family of chain.families) {
      const positions = familyPositions(family.alignment.rows);
      const consensus = consensusOf(family.alignment.rows, positions);
      // HOP 3: the domain region is stated in REFERENCE coordinates, so it is
      // carried into this entity's own numbering before a residue is named
      const entityPositions = entityPositionsOfReferenceRange(chain.mapping.regions, family.match.from, family.match.to, chain.mapping.sequence.length);
      const query = entityPositions.map((at) => chain.mapping.sequence[at - 1] ?? 'X').join('');
      // HOP 2: the one computation — and by the weaker of its two methods
      const placed = strategy.place(query, consensus);
      if (!placed.ok) {
        const refusal = `chain ${chain.chain} is in ${family.alignment.cited} and this build could not place it: ${placed.sentence}`;
        refusals.push(refusal);
        chains.push({ ...blankPlacement(chain.chain, rows, refusal), cited: family.alignment.cited, family: family.match.family, familyName: family.match.name, sequences: family.alignment.rows.length, declaredSequences: family.alignment.declaredCount, positions: positions.length, domain: [family.match.from, family.match.to], domainResidues: entityPositions.length });
        continue;
      }
      const byPosition = conservationByPosition(family.alignment.rows, positions);
      let landed = 0;
      for (const pair of placed.pairs) {
        const entityPosition = entityPositions[pair.query - 1];
        const score = byPosition[pair.position - 1];
        if (entityPosition === undefined || score === undefined) continue;
        // HOP 4: the author's own residue number, and the key this desk keys by
        const key = residueKeyOfEntity(chain.mapping, entityPosition);
        if (key === null) continue;
        if (scoreOf.has(key)) {
          overlaps += 1;
          continue;
        }
        scoreOf.set(key, score);
        basisOf.set(key, family.alignment.cited);
        landed += 1;
      }
      const scored = residueKeys.filter((key) => chainOfKey(key) === chain.chain && basisOf.get(key) === family.alignment.cited).length;
      chains.push({
        chain: chain.chain,
        cited: family.alignment.cited,
        family: family.match.family,
        familyName: family.match.name,
        sequences: family.alignment.rows.length,
        declaredSequences: family.alignment.declaredCount,
        positions: positions.length,
        domain: [family.match.from, family.match.to],
        domainResidues: entityPositions.length,
        placed: landed,
        identities: placed.identities,
        score: placed.score,
        residues: rows,
        scored,
        absent: rows - scored,
        method: placed.method,
        refusal: null,
      });
    }
  }

  const conservation = residueKeys.map((key) => scoreOf.get(key) ?? null);
  const basis = residueKeys.map((key) => basisOf.get(key) ?? null);
  const scored = conservation.filter((value) => value !== null).length;
  return {
    conservation,
    conservation_basis: basis,
    counts: { residues: residueKeys.length, scored, absent: residueKeys.length - scored, chains, method: strategy.method, weaker: strategy.weaker, overlaps },
    refusals,
  };
}

/** A chain nothing was placed for — every number absent rather than zero, and the sentence carried. */
const blankPlacement = (chain: string, residues: number, refusal: string): ChainPlacement => ({
  chain,
  cited: null,
  family: null,
  familyName: null,
  sequences: null,
  declaredSequences: null,
  positions: null,
  domain: null,
  domainResidues: null,
  placed: 0,
  identities: null,
  score: null,
  residues,
  scored: 0,
  absent: residues,
  method: null,
  refusal,
});
