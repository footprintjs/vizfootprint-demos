/**
 * WHERE OUR RESIDUES SIT IN SOMEBODY ELSE'S ALIGNMENT — the one thing on this
 * stage that is COMPUTED, as a port with two strategies, of which this build
 * ships the WORSE ONE and says so.
 *
 * The alignment is cited and never built (`./stockholm.ts`). The score of a
 * column is a fact about its own residues (`./conservation.ts`). What is left
 * over — *which column is THIS residue's* — is a real computation, it has a
 * better and a worse way to do it, and the two are not equally good:
 *
 * | strategy            | how                                                      | here |
 * |---------------------|----------------------------------------------------------|------|
 * | {@link HMMALIGN}    | the family's own profile HMM, by HMMER's `hmmalign`      | **declared and refused** |
 * | {@link CONSENSUS}   | pairwise alignment to a consensus folded from the columns | **this is what runs** |
 *
 * ── WHY THE HMM IS THE RIGHT ANSWER, and why it is not in this packet ───────
 * A profile HMM knows what every column of the family is LIKE — which
 * positions tolerate an insertion, which ones never gap, what each one's
 * residue preferences are — so it places a sequence against the model the
 * curators built. The consensus throws all of that away and keeps one letter
 * per column, then aligns to it with one gap penalty for every position alike.
 * The two disagree exactly where it matters most: at the edges of a domain and
 * around an insertion.
 *
 * The HMM itself is 11,752 bytes and answers a browser, so the missing piece is
 * NOT data — it is HMMER: the container is the tool, and there is nothing to
 * run it on a static page. So the arm is DECLARED here and refuses BY NAME
 * ({@link placeAgainstHmm}), which is the shape a later packet drops an
 * implementation into rather than a shape it has to invent.
 *
 * ── AND WHY THE PAGE HAS TO SAY WHICH ONE RAN ───────────────────────────────
 * A reader comparing two entries, or this desk against a published figure,
 * must not be able to read a consensus-placed score as an HMM-placed one. So
 * {@link PlacementStrategy.said} is the clause that travels with every number
 * this stage lands — on the card, in the stage's own panel line and in the
 * column's declared label — and {@link PlacementStrategy.weaker} is the
 * BOOLEAN a consumer branches on rather than parsing prose.
 */
import { substitutionScore } from './blosum62.js';

/** The two ways to place a sequence in a family alignment. Plain names: the tool, or the consensus. */
export type PlacementMethod = 'hmmalign' | 'consensus';

/** One pairing the placement made: a 1-based position in the query, and the 1-based family position it sits at. */
export interface PlacedPair {
  readonly query: number;
  readonly position: number;
}

/** What a placement produced — or the sentence saying it could not be made. */
export type Placement =
  | {
      readonly ok: true;
      readonly method: PlacementMethod;
      /** Every query position that got a family position, in query order. A query residue the alignment gapped is simply absent. */
      readonly pairs: readonly PlacedPair[];
      /** The alignment's own score, in the substitution matrix's units — reported, never interpreted as a probability. */
      readonly score: number;
      /** How many placed pairs hold the same letter in both — the one number that says whether the placement is plausible at all. */
      readonly identities: number;
    }
  | { readonly ok: false; readonly method: PlacementMethod; readonly sentence: string };

/**
 * A STRATEGY, DECLARED — the shape both arms have, so a caller picks one by
 * name and the page reads its words off the same record.
 */
export interface PlacementStrategy {
  readonly method: PlacementMethod;
  /** What this method IS, in one noun phrase — what the page prints when it names the method. */
  readonly label: string;
  /** TRUE for a method that is not the best available one. The boolean a consumer branches on. */
  readonly weaker: boolean;
  /** The clause that must travel with every number this method placed. Byte-stable: `tests/prot-conservation.test.ts` pins it. */
  readonly said: string;
  /** The whole argument, for the card's own note. */
  readonly why: string;
  /** Place a query sequence in a family, given the consensus folded from its columns. */
  place(query: string, consensus: string): Placement;
}

/** The gap costs, declared: BLAST's own defaults for BLOSUM62, so they are not numbers this desk chose. */
export const GAP_OPEN = -11;
export const GAP_EXTEND = -1;

/**
 * GLOBAL ALIGNMENT WITH AFFINE GAPS — Needleman–Wunsch as Gotoh implements it,
 * three matrices and one traceback.
 *
 * AFFINE and not linear, because a linear gap penalty charges a ten-residue
 * insertion ten times what it charges a one-residue one, and a domain with a
 * loop the family does not have would be shredded into ten separate gaps
 * placed wherever the arithmetic liked. `GAP_OPEN`/`GAP_EXTEND` are BLAST's own
 * defaults for this matrix.
 *
 * DETERMINISM IS A REQUIREMENT AND NOT A HAPPY ACCIDENT: this page's whole
 * claim is that its numbers can be re-derived, so every tie in the recurrence
 * and in the traceback breaks the same way — towards a MATCH first, then an
 * insertion in the query, then one in the family — and the test asserts the
 * same input twice gives the same columns.
 *
 * ```ts
 * alignGlobally('ACDE', 'ACDE').identities;   // 4
 * alignGlobally('ACDE', 'AXDE').pairs.length; // 4 — X is placed, not dropped
 * ```
 */
export function alignGlobally(query: string, target: string): { readonly score: number; readonly pairs: readonly PlacedPair[] } {
  const n = query.length;
  const m = target.length;
  if (n === 0 || m === 0) return { score: 0, pairs: [] };
  const NONE = Number.NEGATIVE_INFINITY;
  /** `match[i][j]` = the best score aligning the first i and first j with position i on position j. */
  const match: Float64Array[] = [];
  /** `queryGap` = the query's residue i is over a gap in the family; `familyGap` = the other way round. */
  const queryGap: Float64Array[] = [];
  const familyGap: Float64Array[] = [];
  /** Which state each cell came FROM: 0 match, 1 queryGap, 2 familyGap. */
  const fromMatch: Int8Array[] = [];
  const fromQueryGap: Int8Array[] = [];
  const fromFamilyGap: Int8Array[] = [];
  for (let i = 0; i <= n; i += 1) {
    match.push(new Float64Array(m + 1).fill(NONE));
    queryGap.push(new Float64Array(m + 1).fill(NONE));
    familyGap.push(new Float64Array(m + 1).fill(NONE));
    fromMatch.push(new Int8Array(m + 1));
    fromQueryGap.push(new Int8Array(m + 1));
    fromFamilyGap.push(new Int8Array(m + 1));
  }
  match[0]![0] = 0;
  for (let i = 1; i <= n; i += 1) {
    queryGap[i]![0] = GAP_OPEN + GAP_EXTEND * (i - 1);
    fromQueryGap[i]![0] = i === 1 ? 0 : 1;
  }
  for (let j = 1; j <= m; j += 1) {
    familyGap[0]![j] = GAP_OPEN + GAP_EXTEND * (j - 1);
    fromFamilyGap[0]![j] = j === 1 ? 0 : 2;
  }
  /** The best of the three states at one cell, ties towards match then queryGap — see the determinism note above. */
  const bestOf = (a: number, b: number, c: number): 0 | 1 | 2 => (b > a ? (c > b ? 2 : 1) : c > a ? 2 : 0);
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const pair = substitutionScore(query[i - 1]!, target[j - 1]!);
      const from = bestOf(match[i - 1]![j - 1]!, queryGap[i - 1]![j - 1]!, familyGap[i - 1]![j - 1]!);
      const previous = from === 0 ? match[i - 1]![j - 1]! : from === 1 ? queryGap[i - 1]![j - 1]! : familyGap[i - 1]![j - 1]!;
      match[i]![j] = previous + pair;
      fromMatch[i]![j] = from;
      const openDown = match[i - 1]![j]! + GAP_OPEN;
      const extendDown = queryGap[i - 1]![j]! + GAP_EXTEND;
      if (openDown >= extendDown) {
        queryGap[i]![j] = openDown;
        fromQueryGap[i]![j] = 0;
      } else {
        queryGap[i]![j] = extendDown;
        fromQueryGap[i]![j] = 1;
      }
      const openRight = match[i]![j - 1]! + GAP_OPEN;
      const extendRight = familyGap[i]![j - 1]! + GAP_EXTEND;
      if (openRight >= extendRight) {
        familyGap[i]![j] = openRight;
        fromFamilyGap[i]![j] = 0;
      } else {
        familyGap[i]![j] = extendRight;
        fromFamilyGap[i]![j] = 2;
      }
    }
  }
  let state = bestOf(match[n]![m]!, queryGap[n]![m]!, familyGap[n]![m]!);
  const score = state === 0 ? match[n]![m]! : state === 1 ? queryGap[n]![m]! : familyGap[n]![m]!;
  const pairs: PlacedPair[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (state === 0) {
      pairs.push({ query: i, position: j });
      const back = fromMatch[i]![j]!;
      i -= 1;
      j -= 1;
      state = back as 0 | 1 | 2;
    } else if (state === 1) {
      const back = fromQueryGap[i]![j]!;
      i -= 1;
      state = back as 0 | 1 | 2;
    } else {
      const back = fromFamilyGap[i]![j]!;
      j -= 1;
      state = back as 0 | 1 | 2;
    }
  }
  return { score, pairs: pairs.reverse() };
}

/**
 * THE ARM THIS BUILD SHIPS — pairwise alignment of our sequence to a consensus
 * folded from the family's own columns.
 *
 * ```ts
 * const placed = CONSENSUS.place(entitySequence, consensusOfTheFamily);
 * placed.ok && placed.pairs.length;   // 82 of chain A's 88 domain residues
 * ```
 */
export const CONSENSUS: PlacementStrategy = {
  method: 'consensus',
  label: 'pairwise alignment to the family consensus',
  weaker: true,
  said: 'placed by pairwise alignment to the family consensus — the weaker of the two methods',
  why:
    'WHICH COLUMN A RESIDUE SITS IN was computed here, and by the weaker of the two methods there are. The right way is the family\'s own profile HMM (HMMER\'s hmmalign), which knows which columns tolerate an insertion and which never gap; this build aligned the chain to a CONSENSUS folded from the alignment\'s columns instead — one letter per column, one gap penalty everywhere — because the HMM needs HMMER and a static page has nothing to run it on. ' +
    'The two methods disagree exactly where it matters: at the edges of a domain and around an insertion. So a score on this page may be attributed to the wrong column, and a reader comparing it with a published per-residue figure is comparing two different placements. ' +
    'Global Needleman–Wunsch with affine gaps (Gotoh), BLOSUM62, gap open −11 and extend −1 — BLAST\'s own defaults for this matrix, so they are not numbers this desk chose. It is deterministic: the same chain and the same alignment give the same columns every time.',
  place: (query, consensus) => {
    if (consensus.length === 0) return { ok: false, method: 'consensus', sentence: 'the family alignment has no column at least half its sequences have a residue in, so there is no consensus to place this chain against and no residue of it is scored.' };
    if (query.length === 0) return { ok: false, method: 'consensus', sentence: 'the chain\'s own sequence is empty at the residues the family covers, so there is nothing to place and no residue of it is scored.' };
    const aligned = alignGlobally(query, consensus);
    if (aligned.pairs.length === 0) {
      return { ok: false, method: 'consensus', sentence: `the placement put not one of this chain's ${String(query.length)} residues on a family position — the alignment is all gap, so no residue of it is scored.` };
    }
    return {
      ok: true,
      method: 'consensus',
      pairs: aligned.pairs,
      score: aligned.score,
      identities: aligned.pairs.filter((pair) => query[pair.query - 1]!.toUpperCase() === consensus[pair.position - 1]!.toUpperCase()).length,
    };
  },
};

/**
 * THE ARM THAT IS DECLARED AND REFUSES BY NAME — see the file header for why it
 * is the right method and why it is not here.
 *
 * It is a real function returning a real refusal rather than a comment, so a
 * caller can ASK for it, the sentence a reader would see is already written,
 * and the next packet's whole job is replacing this body.
 */
export function placeAgainstHmm(): Placement {
  return {
    ok: false,
    method: 'hmmalign',
    sentence:
      'the family\'s own profile HMM is the right way to place these residues and this build cannot run it: the HMM is 11,752 bytes and answers a browser, so what is missing is not the data but HMMER itself — the container is the tool, and a static page has nothing to run it on. A build with a server behind it places the same chain with hmmalign; this build used the consensus instead and says so wherever it shows a number.',
  };
}

/** The HMM arm, as a strategy — same shape, one refusal. See {@link placeAgainstHmm}. */
export const HMMALIGN: PlacementStrategy = {
  method: 'hmmalign',
  label: 'the family’s own profile HMM, by HMMER’s hmmalign',
  weaker: false,
  said: 'placed against the family’s own profile HMM',
  why: 'The right method: the curators\' own model of the family, which knows what every column is like. Declared here and not performed on this build — see the refusal it answers with.',
  place: () => placeAgainstHmm(),
};

/** Both arms, by name — the port, so a caller names a method rather than a function. */
export const PLACEMENT_STRATEGIES: Readonly<Record<PlacementMethod, PlacementStrategy>> = { consensus: CONSENSUS, hmmalign: HMMALIGN };

/** Which arm this build runs. One constant, so the act, the page's words and the tests cannot disagree about it. */
export const PLACEMENT_HERE: PlacementMethod = 'consensus';
