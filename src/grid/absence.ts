/**
 * ABSENCE — EIA's own quality vocabulary, mapped onto vizfootprint's.
 *
 * Layer 1 (data). EIA-930 carries no flag characters. It says the same things
 * with COLUMNS: every published figure appears three times — as reported, as
 * imputed, and as adjusted — and which of the three are filled is the whole
 * message. Over the six-month files the only combinations that ever occur are
 * these four (counted, not assumed — `data/grid/PROVENANCE.json` → `counts`):
 *
 *   reported  imputed  adjusted   what EIA is saying                → state
 *   ────────  ───────  ────────   ───────────────────────────────────────────
 *      ✓         ·         ✓      the authority filed it, EIA published it     → present
 *      ·         ✓         ✓      the authority filed nothing; EIA supplied
 *                                 the number and published that                → estimated
 *      ✓         ✓         ✓      the authority filed a number, EIA judged it
 *                                 wrong, imputed another and published THAT    → replaced
 *      ·         ·         ·      nothing filed, nothing imputed, nothing
 *                                 published                                    → not-configured
 *                                                                                or unavailable
 *
 * The adjusted column is the published figure and nothing else: over all
 * 264,934 rows of the six-month balance file it equals the reported value
 * EXACTLY whenever no imputation happened (0 disagreements, all three series),
 * and equals the imputed value in every one of the 51 `replaced` demand rows.
 * So "adjusted" is not a fourth number — it is EIA naming which of the other
 * two it stands behind.
 *
 * SPLITTING THE LAST ROW is the one judgement this module makes, and it is a
 * judgement, so it is named: `ABSENCE_RULE`. EIA does not publish which
 * authorities have no demand to file — a generation-only balancing authority
 * (Arlington Valley, Gridforce, the two NaturEner wind farms, Harquahala,
 * Southeastern Power Administration, Yadkin, Avangrid Renewables, Sikeston)
 * files no retail demand AT ALL, and its empty cell means something completely
 * different from the empty cell Seminole Electric leaves on the 50 hours it
 * missed. The rule: an authority that filed the figure in NO hour of the slice
 * is `not-configured` for it; one that filed it in some hour and not this one
 * is `unavailable`. That is inferred from the data and it is stated as such —
 * never presented as EIA's own word.
 *
 * Two silences appear in this data that a value-level state cannot carry, so
 * they are words on the AUTHORITY, not on the cell (see `etl.ts`):
 *
 *   an authority with no hourly rows at all (the eight Canadian and Mexican
 *   interties: they are named as neighbours and never report)        → external
 *   an authority whose rows start after, or stop before, the window's
 *   own edges (Sikeston arrives 2025-06-01; Harquahala leaves the
 *   same day)                                                        → the
 *   `first_hour` / `last_hour` / `hours` columns say it in numbers
 *
 * There is no `withheld` here. NNDSS has one because CDC knows a count and
 * chooses not to print it; EIA never does that in these files, and adding the
 * word would promise a distinction the data cannot make. The four canonical
 * states plus the two EIA actually needs is the whole vocabulary.
 *
 * The one law, the same as the NNDSS module's: the mapping never invents. A
 * cell we cannot classify says `unknown`; it never becomes a confident zero.
 * And a reported 0 is a MEASURED zero — 5,971 of the slice's interchange rows
 * carry one — which is why `present` and `unavailable` can never be merged.
 */

export const ABSENCE_STATES = ['present', 'estimated', 'replaced', 'not-configured', 'unavailable', 'unknown'] as const;
export type Absence = (typeof ABSENCE_STATES)[number];

/** The states in which a figure exists: everything else has no number at all. */
export const PUBLISHED_STATES: readonly Absence[] = ['present', 'estimated', 'replaced'];

/** The column the hourly table carries its headline state under — demand is the figure a reader asks for first. */
export const ABSENCE_FIELD = 'demand_state';

/** The judgement this module makes, in one sentence — written into the slice's provenance so it travels with the data. */
export const ABSENCE_RULE =
  'a figure with a reported value and no imputed one is present; with an imputed value and no reported one, estimated; with both, replaced (EIA published the imputed number, never the reported one); with neither, not-configured when the authority filed that figure in NO hour of the slice and unavailable when it filed it in some other hour — the last split is inferred from the data, not published by EIA';

/** How EIA's three columns arrive for one figure, before a word is put on them. */
export interface Triple {
  /** What the balancing authority filed, or null. */
  readonly reported: number | null;
  /** What EIA imputed, or null. */
  readonly imputed: number | null;
  /** What EIA published, or null. */
  readonly adjusted: number | null;
}

/** A figure, worded: the published number when there is one, the state either way, and what the authority itself filed. */
export interface Figure {
  /** EIA's published number — the adjusted column — or null when nothing was published. */
  readonly value: number | null;
  readonly state: Absence;
  /** What the authority filed, kept even when EIA replaced it: the two disagreeing is the story. */
  readonly reported: number | null;
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
 * Word one figure from EIA's three columns.
 *
 * `everFiled` answers the question the row cannot: has this authority filed
 * this figure in ANY hour of the slice? It is what splits the empty cell into
 * `not-configured` and `unavailable` (`ABSENCE_RULE`), and the caller must
 * have walked the rows once to know it — which is why `etl.ts` reads the
 * hourly file in two passes and says so.
 */
export function figureOf(triple: Triple, everFiled: boolean): Figure {
  const { reported, imputed, adjusted } = triple;
  if (adjusted !== null) {
    if (imputed !== null) return { value: adjusted, state: reported !== null ? 'replaced' : 'estimated', reported };
    if (reported !== null) return { value: adjusted, state: 'present', reported };
    // published out of nowhere: no reported value, no imputed value — never seen in the six-month files, and never guessed at
    return { value: adjusted, state: 'unknown', reported };
  }
  if (reported !== null || imputed !== null) return { value: null, state: 'unknown', reported };
  return { value: null, state: everFiled ? 'unavailable' : 'not-configured', reported: null };
}

/**
 * Word one INTERCHANGE cell. The interchange file has a single value column —
 * no imputed or adjusted twin — so its vocabulary is the short one: a number
 * (a measured zero included) is `present`, an empty cell is `unavailable`.
 * `not-configured` cannot arise: EIA writes a row only for a pair that is
 * directly interconnected, so the pair being there is itself the claim that
 * the link exists. A pair whose every hour is empty (MISO→Sikeston, all 186
 * hours of the slice) is a declared link that never carried a number — a fact
 * about the LINK, counted in `GridTables.links`, not a different cell state.
 */
export function flowOf(value: unknown): Figure {
  const n = numberOrNull(value);
  return n === null ? { value: null, state: 'unavailable', reported: null } : { value: n, state: 'present', reported: n };
}
