/**
 * WHAT A COLUMN'S SCORE IS — and, just as load-bearing, WHAT IT IS NOT.
 *
 * ── IT IS SHANNON ENTROPY OVER A CURATED ALIGNMENT'S OWN COLUMN ────────────
 * One column of the alignment is a few hundred sequences' letters at one
 * family position. Tally them, take the Shannon entropy of the tally in bits,
 * divide by the most a column of this alphabet can carry, and subtract from
 * one. A column where every sequence has the same residue scores 1; a column
 * where they are spread evenly across the alphabet scores near 0. That is the
 * whole arithmetic and it is worked out by hand in
 * `tests/prot-conservation.test.ts` over a five-sequence alignment.
 *
 * ── IT IS NOT A PUBLISHED CONSERVATION GRADE ───────────────────────────────
 * ConSurf-style grades — the 1–9 scale a structural biologist reads off a
 * coloured surface — are something else: a Bayesian or maximum-likelihood
 * estimate of the evolutionary RATE at a site, computed against a phylogenetic
 * tree with a substitution model, then binned. Entropy has no tree in it, no
 * model of substitution, and no notion that a lysine-for-arginine swap is a
 * smaller event than a lysine-for-tryptophan one. It is a count of letters.
 *
 * The two agree often enough to be confused, and that is exactly why the page
 * says which one it has ({@link SCORE_IS} / {@link SCORE_IS_NOT}). Implying
 * otherwise would be the one dishonest number on this desk.
 *
 * ── THE GAP IS ITS OWN STATE, and that is a choice with a consequence ──────
 * A column half of whose sequences have no residue at all is not well known,
 * and counting only the residues present would score it as if it were. So the
 * gap is a state of the tally like any letter — which means a column's score
 * falls when the family disagrees about whether there is a residue there,
 * which is the honest reading.
 */
import { isGap } from './stockholm.js';

/**
 * WHICH COLUMNS COUNT AS FAMILY POSITIONS — and this threshold is OURS, so it
 * is declared, printed and pinned.
 *
 * A Pfam alignment is wider than the family is long: PF00545's seed is 241
 * columns for a domain of about 96 positions, because every insertion any one
 * of its 283 sequences carries gets columns of its own that almost every other
 * sequence gaps through. A consensus over all 241 would be mostly gap, and a
 * placement against it would be meaningless.
 *
 * So a column is a FAMILY POSITION when at least half the alignment's
 * sequences have a residue in it — the majority rule, the simplest statement
 * that can be checked by hand. On the two committed alignments it yields 100
 * positions for PF00545 and 97 for PF01337.
 *
 * WHAT IT COSTS, named: a profile HMM decides the same question with the
 * curators' own match states rather than with a fraction, and where the two
 * disagree the HMM is right. It is the same shortfall the placement has
 * (`./placement.ts`), from the same cause, and it goes the same way — with the
 * HMM.
 */
export const FAMILY_POSITION_OCCUPANCY = 0.5;

/**
 * HOW MANY STATES A COLUMN CAN HOLD — the divisor that makes the score 0…1.
 *
 * Twenty standard amino acids, the gap, and ONE state for everything else (`X`
 * for an unknown residue, `B`/`Z` for the ambiguous pairs, a non-standard
 * letter from another family's alignment). Twenty-two, fixed — so two entries'
 * scores are on one scale, which a divisor folded per column would quietly
 * destroy.
 */
export const ENTROPY_STATES = 22;

/** The twenty standard amino acids, in the one-letter code — every other letter is the one `other` state. */
const STANDARD = new Set('ACDEFGHIKLMNPQRSTVWY'.split(''));

/** What the page says the score IS, in one sentence. One owner: the act's honesty note, the column label and the card all read this. */
export const SCORE_IS =
  'Shannon entropy over the curated alignment’s own column, gaps counted as a state of their own, normalised against the 22 states a column can hold (the 20 standard amino acids, the gap, and one state for everything else) and subtracted from one — so 1 is a column every sequence agrees on and 0 a column spread evenly across the alphabet.';

/** What it is NOT — the sentence that keeps a reader from taking it for a published grade. See the file header. */
export const SCORE_IS_NOT =
  'It is NOT a published conservation grade. ConSurf-style 1–9 grades estimate the evolutionary RATE at a site against a phylogenetic tree and a substitution model; this is a count of letters in a column, with no tree and no model in it, and nothing on this desk is reproducing those grades.';

/**
 * HOP 1 — the alignment's own columns, gaps excluded: which column indices are
 * family positions, in column order.
 *
 * The 1-based family position of a column is its place in this list, which is
 * what the placement's `PlacedPair.position` names.
 *
 * ```ts
 * familyPositions(['AC.D', 'AC.D', 'A..D']);   // [0, 1, 3] — column 2 is gap in every row
 * ```
 */
export function familyPositions(rows: readonly string[], occupancy: number = FAMILY_POSITION_OCCUPANCY): readonly number[] {
  if (rows.length === 0) return [];
  const width = rows[0]!.length;
  const kept: number[] = [];
  for (let column = 0; column < width; column += 1) {
    let residues = 0;
    for (const row of rows) if (!isGap(row[column] ?? '-')) residues += 1;
    if (residues / rows.length >= occupancy) kept.push(column);
  }
  return kept;
}

/**
 * THE MOST COMMON RESIDUE OF ONE COLUMN — the consensus letter, ties broken
 * alphabetically.
 *
 * Alphabetically and not "whichever the tally happened to meet first", because
 * the placement has to be deterministic and a Map's insertion order is the
 * alignment's row order, which is not a fact about the family.
 */
export function consensusAt(rows: readonly string[], column: number): string | null {
  const tally = new Map<string, number>();
  for (const row of rows) {
    const character = row[column] ?? '-';
    if (isGap(character)) continue;
    const letter = character.toUpperCase();
    tally.set(letter, (tally.get(letter) ?? 0) + 1);
  }
  let best: string | null = null;
  let most = 0;
  for (const [letter, count] of [...tally.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (count > most) {
      best = letter;
      most = count;
    }
  }
  return best;
}

/**
 * THE FAMILY'S CONSENSUS SEQUENCE — one letter per family position, in order.
 *
 * This is the ONE thing in the citation chain this desk derives rather than
 * reads, and it is derived from the alignment's own columns and nothing else.
 * `./placement.ts` aligns our chain to it; a column whose residues are all
 * gaps cannot happen here (it would not be a family position), so the `X`
 * fallback is unreachable by construction and present so the type is total.
 */
export function consensusOf(rows: readonly string[], positions: readonly number[]): string {
  return positions.map((column) => consensusAt(rows, column) ?? 'X').join('');
}

/**
 * ONE COLUMN'S SHANNON ENTROPY, IN BITS — the tally, gaps as their own state
 * and every non-standard letter folded into one.
 *
 * ```ts
 * columnEntropy(['A', 'A', 'A', 'A']);   // 0    — one state, perfectly known
 * columnEntropy(['A', 'C', 'A', 'C']);   // 1    — two states, evenly split
 * columnEntropy(['A', 'C', 'D', '-']);   // 2    — four states, evenly split
 * ```
 */
export function columnEntropy(rows: readonly string[], column = 0): number {
  if (rows.length === 0) return 0;
  const tally = new Map<string, number>();
  for (const row of rows) {
    const character = row[column] ?? '-';
    const state = isGap(character) ? '-' : STANDARD.has(character.toUpperCase()) ? character.toUpperCase() : 'other';
    tally.set(state, (tally.get(state) ?? 0) + 1);
  }
  let bits = 0;
  for (const count of tally.values()) {
    const share = count / rows.length;
    bits -= share * Math.log2(share);
  }
  return bits;
}

/**
 * ONE COLUMN'S CONSERVATION, NORMALISED 0…1 — the number this stage lands.
 *
 * `1 − H / log2(22)`. See {@link SCORE_IS} for the sentence the page prints and
 * {@link SCORE_IS_NOT} for the one that keeps it honest.
 */
export function conservationAt(rows: readonly string[], column: number): number {
  return 1 - columnEntropy(rows, column) / Math.log2(ENTROPY_STATES);
}

/**
 * EVERY FAMILY POSITION'S SCORE, in position order — index 0 is family
 * position 1, which is what `PlacedPair.position` counts from.
 */
export function conservationByPosition(rows: readonly string[], positions: readonly number[]): readonly number[] {
  return positions.map((column) => conservationAt(rows, column));
}
