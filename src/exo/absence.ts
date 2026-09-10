/**
 * ABSENCE — the exoplanet archive's own vocabulary for "this is not a
 * measurement", mapped onto vizfootprint's.
 *
 * Layer 1 (data). The archive says three different things with two columns. A
 * parameter arrives as a VALUE column (`pl_rade`, `pl_bmasse`) and a LIMIT FLAG
 * beside it (`pl_radelim`, `pl_bmasselim`), and which pair of cells is filled is
 * the whole message (counted over the committed slice, never assumed —
 * `data/exo/PROVENANCE.json` → `counts`):
 *
 *   value   flag        what the archive is saying                  → state
 *   ─────   ────        ──────────────────────────────────────────────────────
 *    7.1      0         a paper measured it and this is the number  → present
 *    7.1     ±1         the paper could only BOUND it: the number
 *                       is an upper (1) or lower (−1) limit         → limit
 *    ·        ·         this paper published no such parameter      → not-measured
 *    ·       ±1         a bound with no number — never seen in the
 *                       slice, and never guessed at                 → unknown
 *
 * A LIMIT IS THE INTERESTING ONE, and it is why this vocabulary exists at all.
 * "Radius < 2.4 Earth radii" is not a radius; put it on a scatter as though it
 * were and the picture claims a measurement nobody made. But it is not a
 * silence either — it CARRIES A NUMBER, and dropping the number would lose the
 * only thing the paper did establish. That is exactly the case
 * `AbsenceDecl.carries` exists for, so `limit` is declared there
 * ({@link CARRIES}) and the library's contradiction check stops reading those
 * rows as tables that say two things at once.
 *
 * Over the committed slice: 11,062 published radii are measurements and 7 are
 * limits; 7,202 published masses are measurements and 398 are limits. The
 * limits are few and they are the rows a demo about honesty may least afford to
 * round away.
 *
 * WHAT IS NOT IN THIS VOCABULARY, deliberately:
 *
 * - **`Msini`.** A radial-velocity mass is `M·sin(i)` — the true mass times the
 *   sine of an orbit inclination nobody measured — so it is a lower bound in
 *   physics, and the archive almost never flags it as a limit of ITS OWN
 *   vocabulary: `pl_bmasselim` is 0 on 2,418 of the 2,423 `Msini` rows (the
 *   other 5 DO carry the archive's own limit flag, and this module reads it
 *   exactly as published — `figureOf` never looks at `mass_kind`, so those 5
 *   rows word as `limit` like any other bounded row). Calling the other 2,418
 *   `limit` here, on physics alone, would be this demo overruling the archive
 *   about its own data. Msini travels instead as an ordinary column,
 *   `mass_kind` (the archive's `pl_bmassprov`), and the prose says what the word
 *   means. The distinction is the point: an absence state is what the SOURCE
 *   said, never what we would have said.
 * - **a `withheld` word.** The archive never knows a number and chooses not to
 *   print it; adding the word would promise a distinction the data cannot make.
 *
 * The one law, the same as the other two demos': the mapping never invents. A
 * pair of cells nobody can classify says `unknown`, and never becomes a
 * confident zero. There is no measured zero to protect here — no planet has a
 * radius of 0 — but a MISSING radius and a radius the paper bounded are two
 * different facts, and merging them is the mistake this file exists to refuse.
 */

/**
 * The four words. `present` and `unknown` are the library's own required pair;
 * `limit` and `not-measured` are the two the archive actually distinguishes.
 */
export const ABSENCE_STATES = ['present', 'limit', 'not-measured', 'unknown'] as const;
export type Absence = (typeof ABSENCE_STATES)[number];

/**
 * The states in which a number EXISTS. `limit` is here because a bound is a
 * number: the paper established it, and a table that dropped it would lose the
 * only quantity that paper had.
 */
export const PUBLISHED_STATES: readonly Absence[] = ['present', 'limit'];

/**
 * The words that hold a figure BESIDES `present` — the `AbsenceDecl.carries`
 * list, read off {@link PUBLISHED_STATES} so the two can never drift.
 */
export const CARRIES: readonly Absence[] = PUBLISHED_STATES.filter((state) => state !== 'present');

/** The one word that means the source reported a value — the library's own (`ABSENCE_PRESENT`), spelled once here for the acts that name it. */
export const PRESENT = 'present';

/**
 * WHERE `carries` CANNOT GO, written down instead of worked around.
 *
 * `AbsenceDecl.carries` is the library's way of saying "this word is not a
 * silence, it holds a number", and `limit` is exactly such a word. But
 * `AbsenceDecl` is declared PER TABLE and speaks for the ROW: the library reads
 * a row whose state is not `present` as having no value in any column, and its
 * data door refuses a table that says otherwise. The archive puts three
 * parameters on one row, each with its own silence — a paper that published a
 * period and no radius is an ordinary row — so no column of `measurements` can
 * hold that declaration truthfully, and `src/exo/def.ts` declines to make it.
 *
 * What the demo does instead: both state columns are declared ABSENCE WORDS per
 * column (`role: 'absence'`, which keeps a state off every magnitude channel),
 * and every act that must not read a bound SAYS SO IN ITS OWN RECORD — the
 * aggregate carries `where radius_state is "present"`, the delta is a
 * conditional. That is visible on the commit and in the why-sentence, which is
 * a better answer than an implicit law; but it is a workaround, and the gap is
 * real: **there is no per-COLUMN absence declaration** — a state column, its
 * vocabulary, the value column it speaks for, and which of its words carry a
 * number. A table like this one needs three of them.
 */
export const CARRIES_NOTE =
  'AbsenceDecl (and therefore `carries`) is per TABLE and speaks for the ROW; these rows carry three parameters with three separate silences, so no honest table-level declaration exists. The words are declared per column instead, and the acts name what a bound may not enter. The library gap: a per-column absence declaration.';

/**
 * The column a measurement row carries its HEADLINE state under. Radius is the
 * parameter a reader asks for first, and it is the one both charts are built
 * on; mass carries its own word beside it (`mass_state`).
 */
export const ABSENCE_FIELD = 'radius_state';

/** The judgement this module makes, in one sentence — written into the slice's provenance so it travels with the data. */
export const ABSENCE_RULE =
  'a parameter with a value and a limit flag of 0 is present; with a value and a flag of +1 or −1 it is a limit — an upper or lower bound, which carries its number and is never a measurement; with neither value nor flag it is not-measured, meaning this publication published no such parameter; a flag with no value would be unknown, and no row of the slice is (the archive never publishes one). Msini is NOT called a limit here, because the archive does not: it rides as mass_kind, the archive\'s own pl_bmassprov word';

/** Which side of the number the bound is on, when the state is `limit`. */
export type Bound = 'upper' | 'lower';

/** One parameter of one row, worded: the number when there is one, the state, and the bound's direction when it is a bound. */
export interface Figure {
  /** The archive's number — kept for a `limit` as well as for a measurement, because a bound is a number. */
  readonly value: number | null;
  readonly state: Absence;
  /** `upper` for a flag of +1, `lower` for −1, null otherwise. */
  readonly bound: Bound | null;
}

/** A number from a parsed CSV cell — `parseCSVTyped` gives numbers for numeric columns and null for blanks. */
export function numberOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Word one parameter from the archive's value column and its limit flag.
 *
 * Unlike the grid's `figureOf`, this needs no second pass over the table: the
 * archive puts the whole message in the row, so one row is enough to word it.
 * That is a property of THIS source and it is worth naming — the grid needs two
 * passes because EIA's empty cell means two different things depending on what
 * the same authority did in other hours, and the archive's does not.
 */
export function figureOf(value: unknown, flag: unknown): Figure {
  const n = numberOrNull(value);
  const lim = numberOrNull(flag);
  if (n === null) {
    // a bound with no number: the archive would be saying "this is a limit" and giving no limit
    return { value: null, state: lim === null || lim === 0 ? 'not-measured' : 'unknown', bound: null };
  }
  if (lim === null || lim === 0) return { value: n, state: 'present', bound: null };
  return { value: n, state: 'limit', bound: lim > 0 ? 'upper' : 'lower' };
}
