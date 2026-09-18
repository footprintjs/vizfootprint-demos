/**
 * BLOSUM62 — the substitution matrix the placement scores with, verbatim, and
 * JUDGED AT LOAD.
 *
 * It is here as the TEXT of the matrix rather than as a nested object literal
 * for one reason: this is somebody else's published table (Henikoff & Henikoff
 * 1992, as NCBI distributes it), and a reader has to be able to lay it beside
 * the original and see that it is the same table. Four hundred numbers spread
 * across a TypeScript object cannot be checked that way; twenty-four rows of
 * twenty-four columns can.
 *
 * WHY IT IS JUDGED rather than trusted (the `./analyses.ts` · `ACT_TABLE`
 * precedent): a transposed digit in a substitution matrix does not fail — it
 * produces a slightly different alignment, silently, forever. A matrix is
 * SYMMETRIC by construction, so asymmetry is a typo and nothing else, and a
 * demo that will not start beats one whose placement is quietly wrong.
 *
 * The four trailing rows are the matrix's own and are kept: `B` and `Z` are the
 * ambiguous pairs (asparagine/aspartate, glutamine/glutamate), `X` is "some
 * residue, unknown which" and `*` is a stop. None of them appears in the two
 * committed alignments — both use exactly the twenty standard letters and `.` —
 * but a family this desk is pointed at tomorrow may, and a matrix missing the
 * rows for what it meets would silently score those positions as a mismatch
 * (see {@link substitutionScore}).
 */

/** The matrix, as NCBI distributes it — the header row is the column order. */
const BLOSUM62_TEXT = `
    A  R  N  D  C  Q  E  G  H  I  L  K  M  F  P  S  T  W  Y  V  B  Z  X  *
A   4 -1 -2 -2  0 -1 -1  0 -2 -1 -1 -1 -1 -2 -1  1  0 -3 -2  0 -2 -1  0 -4
R  -1  5  0 -2 -3  1  0 -2  0 -3 -2  2 -1 -3 -2 -1 -1 -3 -2 -3 -1  0 -1 -4
N  -2  0  6  1 -3  0  0  0  1 -3 -3  0 -2 -3 -2  1  0 -4 -2 -3  3  0 -1 -4
D  -2 -2  1  6 -3  0  2 -1 -1 -3 -4 -1 -3 -3 -1  0 -1 -4 -3 -3  4  1 -1 -4
C   0 -3 -3 -3  9 -3 -4 -3 -3 -1 -1 -3 -1 -2 -3 -1 -1 -2 -2 -1 -3 -3 -2 -4
Q  -1  1  0  0 -3  5  2 -2  0 -3 -2  1  0 -3 -1  0 -1 -2 -1 -2  0  3 -1 -4
E  -1  0  0  2 -4  2  5 -2  0 -3 -3  1 -2 -3 -1  0 -1 -3 -2 -2  1  4 -1 -4
G   0 -2  0 -1 -3 -2 -2  6 -2 -4 -4 -2 -3 -3 -2  0 -2 -2 -3 -3 -1 -2 -1 -4
H  -2  0  1 -1 -3  0  0 -2  8 -3 -3 -1 -2 -1 -2 -1 -2 -2  2 -3  0  0 -1 -4
I  -1 -3 -3 -3 -1 -3 -3 -4 -3  4  2 -3  1  0 -3 -2 -1 -3 -1  3 -3 -3 -1 -4
L  -1 -2 -3 -4 -1 -2 -3 -4 -3  2  4 -2  2  0 -3 -2 -1 -2 -1  1 -4 -3 -1 -4
K  -1  2  0 -1 -3  1  1 -2 -1 -3 -2  5 -1 -3 -1  0 -1 -3 -2 -2  0  1 -1 -4
M  -1 -1 -2 -3 -1  0 -2 -3 -2  1  2 -1  5  0 -2 -1 -1 -1 -1  1 -3 -1 -1 -4
F  -2 -3 -3 -3 -2 -3 -3 -3 -1  0  0 -3  0  6 -4 -2 -2  1  3 -1 -3 -3 -1 -4
P  -1 -2 -2 -1 -3 -1 -1 -2 -2 -3 -3 -1 -2 -4  7 -1 -1 -4 -3 -2 -2 -1 -2 -4
S   1 -1  1  0 -1  0  0  0 -1 -2 -2  0 -1 -2 -1  4  1 -3 -2 -2  0  0  0 -4
T   0 -1  0 -1 -1 -1 -1 -2 -2 -1 -1 -1 -1 -2 -1  1  5 -2 -2  0 -1 -1  0 -4
W  -3 -3 -4 -4 -2 -2 -3 -2 -2 -3 -2 -3 -1  1 -4 -3 -2 11  2 -3 -4 -3 -2 -4
Y  -2 -2 -2 -3 -2 -1 -2 -3  2 -1 -1 -2 -1  3 -3 -2 -2  2  7 -1 -3 -2 -1 -4
V   0 -3 -3 -3 -1 -2 -2 -3 -3  3  1 -2  1 -1 -2 -2  0 -3 -1  4 -3 -2 -1 -4
B  -2 -1  3  4 -3  0  1 -1  0 -3 -4  0 -3 -3 -2  0 -1 -4 -3 -3  4  1 -1 -4
Z  -1  0  0  1 -3  3  4 -2  0 -3 -3  1 -1 -3 -1  0 -1 -3 -2 -2  1  4 -1 -4
X   0 -1 -1 -1 -2 -1 -1 -1 -1 -1 -1 -1 -1 -1 -2  0  0 -2 -1 -1 -1 -1 -1 -4
*  -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4  1
`;

/** The matrix's own letter order, read off its header row. */
export const BLOSUM62_LETTERS: readonly string[] = BLOSUM62_TEXT.trim().split('\n')[0]!.trim().split(/\s+/);

/** The table, letter pair to score — parsed from {@link BLOSUM62_TEXT}, never typed twice. */
export const BLOSUM62: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.fromEntries(
  BLOSUM62_TEXT.trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const cells = line.trim().split(/\s+/);
      const row = cells[0]!;
      return [row, Object.fromEntries(cells.slice(1).map((value, at) => [BLOSUM62_LETTERS[at]!, Number(value)]))] as const;
    }),
);

/**
 * WHAT A LETTER THE MATRIX HAS NO ROW FOR SCORES — declared, because the
 * alternative is a silent zero.
 *
 * A sequence can carry a letter no substitution matrix has (`U` for
 * selenocysteine, `O` for pyrrolysine, a lower-case artefact of somebody's
 * export). `X`'s own row is the matrix's answer to "some residue, unknown
 * which", so an unknown letter is scored as `X` against its partner rather
 * than as a zero — a zero would be neither a match nor a mismatch and would
 * make an unreadable letter look like a neutral substitution.
 */
export const UNKNOWN_LETTER = 'X';

/**
 * ONE PAIR'S SCORE — case-folded, with an unreadable letter scored as `X`.
 *
 * ```ts
 * substitutionScore('W', 'W');   // 11 — the most conserved pair in the matrix
 * substitutionScore('A', 'W');   // -3
 * substitutionScore('U', 'A');   // 0  — U has no row, so X's row answers
 * ```
 */
export function substitutionScore(a: string, b: string): number {
  const rowKey = a.toUpperCase();
  const columnKey = b.toUpperCase();
  const row = BLOSUM62[rowKey] ?? BLOSUM62[UNKNOWN_LETTER]!;
  const cell = row[columnKey];
  return cell ?? row[UNKNOWN_LETTER] ?? 0;
}

/**
 * THE JUDGE — the matrix is square, symmetric and its own header order.
 *
 * See the file header for why this throws rather than warns: a transposed digit
 * here does not fail, it quietly places our residues one column out.
 */
function judgeTheMatrix(): void {
  const refuse = (why: string): never => {
    throw new Error(`the substitution matrix in src/prot/blosum62.ts is not the published table: ${why}`);
  };
  const rows = Object.keys(BLOSUM62);
  if (rows.length !== BLOSUM62_LETTERS.length) refuse(`its header names ${String(BLOSUM62_LETTERS.length)} letters and it has ${String(rows.length)} rows`);
  for (const [at, letter] of BLOSUM62_LETTERS.entries()) {
    if (rows[at] !== letter) refuse(`row ${String(at + 1)} is "${String(rows[at])}" where the header's order says "${letter}"`);
  }
  for (const a of BLOSUM62_LETTERS) {
    for (const b of BLOSUM62_LETTERS) {
      const left = BLOSUM62[a]?.[b];
      const right = BLOSUM62[b]?.[a];
      if (left === undefined) refuse(`it has no score for the pair ${a}/${b}`);
      if (left !== right) refuse(`${a}/${b} is ${String(left)} and ${b}/${a} is ${String(right)} — a substitution matrix is symmetric, so one of them is a typo`);
    }
  }
}

judgeTheMatrix();
