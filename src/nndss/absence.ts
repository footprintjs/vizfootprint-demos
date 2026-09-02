/**
 * ABSENCE — CDC's own silence vocabulary, mapped onto vizfootprint's.
 *
 * Layer 1 (data). NNDSS weekly tables mark a cell that carries no number
 * with a FLAG, and the flags already distinguish the silences this library
 * insists on keeping apart (source: the NNDSS "guide to interpreting
 * provisional and finalized data tables", ndc.services.cdc.gov):
 *
 *   a number      cases reported this week                        → present
 *   -             no reported cases (the jurisdiction sent none)    → present, value 0
 *   N             not reportable by law in that jurisdiction         → not-configured
 *   NN            not nationally notifiable                          → not-configured
 *   U             the jurisdiction could not send it, or CDC could   → unavailable
 *                 not process it
 *   NP            nationally notifiable but NOT PUBLISHED            → withheld
 *   NC            not calculated (too little data)                   → unknown
 *   (nothing)     neither a number nor a flag                        → unknown
 *
 * `withheld` is a word this app adds (the vocabulary allows app words beside
 * the canonical four): a withheld count is not "unknown" — CDC knows it and
 * chose not to print it — and rendering it as either `not-configured` or
 * `unavailable` would tell the reader something CDC did not say.
 *
 * The one law: the mapping never invents. A cell we cannot classify says
 * `unknown`; it never becomes a confident zero.
 */

export const ABSENCE_STATES = ['present', 'not-configured', 'unavailable', 'withheld', 'unknown'] as const;
export type Absence = (typeof ABSENCE_STATES)[number];

/** The column every NNDSS table in this demo carries its state under. */
export const ABSENCE_FIELD = 'report_state';

/** A parsed cell: the count when there is one, and the state either way. */
export interface Cell {
  readonly value: number | null;
  readonly state: Absence;
  /** The flag exactly as CDC printed it (inert; for the table and the tooltip). */
  readonly flag: string | null;
}

/**
 * Classify one NNDSS cell from its numeric column and its flag column, as the
 * Socrata JSON delivers them: a number with no flag, or a flag with no number.
 */
export function cellOf(value: unknown, flag: unknown): Cell {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : null;
  const f = typeof flag === 'string' && flag.trim() !== '' ? flag.trim() : null;
  if (n !== null && Number.isFinite(n)) return { value: n, state: 'present', flag: f };
  switch (f) {
    case '-':
      return { value: 0, state: 'present', flag: f };
    case 'N':
    case 'NN':
      return { value: null, state: 'not-configured', flag: f };
    case 'U':
      return { value: null, state: 'unavailable', flag: f };
    case 'NP':
      return { value: null, state: 'withheld', flag: f };
    case 'NC':
      return { value: null, state: 'unknown', flag: f };
    default:
      return { value: null, state: 'unknown', flag: f };
  }
}
