/**
 * NAMES — how a reference's words are read, and the one thing typed in rather
 * than read.
 *
 * The archive does not carry a reference as a name. It carries an HTML ANCHOR,
 * and the anchor is three facts at once:
 *
 *   <a refstr=AGOL_ET_AL__2021 href=https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract target=ref>Agol et al. 2021</a>
 *     └ refstr: the archive's stable key      └ href: where it points        └ the words a reader sees
 *
 * {@link parseReference} takes those three out and invents none of them: the
 * key is the archive's key, the label is the archive's own text (trimmed —
 * some anchors carry a leading space), and the link is the archive's link. Every
 * one of the 20,598 committed measurement rows parses; a row that did not would
 * keep `null` and be counted, never given a made-up name.
 *
 * ── WHICH REFERENCES ARE NOT PUBLICATIONS ───────────────────────────────────
 * This is the fact that makes the whole demo: **not every number in the
 * composite table came from a paper.** 1,608 of its 6,360 radii and 2,977 of its
 * masses point at the archive rather than at a paper — 4,501 of those cells say
 * `CALCULATED_VALUE`, whose href is the archive's own documentation page, and
 * the rest name a follow-up database or a Kepler pipeline table. A demo that
 * read the composite as "the accepted published value" would be wrong about a
 * quarter of its radii and nearly half of its masses.
 *
 * The split is decided by the HREF, which is data: an anchor pointing inside
 * `ipac.caltech.edu` (or at a relative archive path) is the ARCHIVE speaking;
 * anything else is a literature reference. Over the slice that is 2,399
 * publications — 2,394 pointing at ADS and 5 straight at a journal — against
 * 4 archive-internal keys, and it holds without a list of paper hosts to
 * maintain.
 *
 * ── AND THE TYPED-IN PART ───────────────────────────────────────────────────
 * What the archive-internal keys MEAN is not in the data, so
 * {@link ARCHIVE_SOURCE_NOTES} and {@link MASS_KIND_NOTES} below are typed in
 * from the archive's own documentation — the only fields in `src/exo/` that are
 * not read out of a file. Because they are typed in they are allowed to be
 * incomplete, and they say so: a key with no entry gets `null`, never its own
 * code echoed back and never a guess. The href rule still classifies it, so an
 * archive key nobody has glossed yet is still known NOT to be a publication —
 * which is the half that matters.
 */

/** Where the typed-in glosses come from — written into the slice's provenance beside the data. */
export const NAMES_SOURCE =
  "the archive's own documentation for the composite table's calculated values and for the pl_bmassprov mass-provenance words — pages, not data; a key with no entry is left unglossed, never guessed";

/** What an anchor holds, once taken apart. */
export interface Reference {
  /** The archive's stable key for the reference — the column every other table joins on. */
  readonly refstr: string;
  /** The archive's own words for it, trimmed. */
  readonly label: string;
  /** Where the archive points. */
  readonly href: string;
}

/** Whether a reference is a paper or the archive speaking. */
export type ReferenceKind = 'publication' | 'archive';

const ANCHOR = /refstr=([^\s>]+)\s+href=([^\s>]+)[^>]*>([\s\S]*?)<\/a>/;

/**
 * Take one anchor apart, or answer null.
 *
 * Null is a real answer and the callers keep it: an anchor this pattern cannot
 * read is a reference we have no key for, and minting one from the row's index
 * would put a reference in the table that the archive never published.
 */
export function parseReference(anchor: unknown): Reference | null {
  if (typeof anchor !== 'string') return null;
  const m = ANCHOR.exec(anchor);
  if (m === null) return null;
  const [, refstr, href, label] = m;
  if (refstr === undefined || href === undefined) return null;
  return { refstr, href, label: (label ?? '').trim() };
}

/**
 * A paper, or the archive itself — decided by where the anchor points.
 *
 * WHY the host and not a list of keys: the archive adds internal sources
 * (a pipeline table, a follow-up program) without telling anyone, and a
 * hard-coded key list would silently promote the next one to "publication".
 * A relative href is the archive's own page by construction.
 */
export function referenceKindOf(href: string): ReferenceKind {
  if (href.startsWith('/')) return 'archive';
  try {
    return new URL(href).hostname.endsWith('ipac.caltech.edu') ? 'archive' : 'publication';
  } catch {
    // an href that is not a URL at all: it points nowhere we can name, so it is not evidence of a publication
    return 'archive';
  }
}

/**
 * The archive-internal keys, glossed from the archive's documentation — TYPED
 * IN, and allowed to be incomplete.
 */
export const ARCHIVE_SOURCE_NOTES: Readonly<Record<string, string>> = {
  CALCULATED_VALUE: "the archive's own calculation for the composite table, not a number any paper published",
  EXOFOP: 'the Exoplanet Follow-up Observing Program — a follow-up database entry rather than a publication',
  Q1_Q17_DR25_KOI_TABLE: "a Kepler pipeline's own KOI table, carried by the archive",
  Q1_Q8_KOI_TABLE: "an earlier Kepler pipeline KOI table, carried by the archive",
};

/**
 * The archive's mass-provenance words (`pl_bmassprov`), glossed — TYPED IN.
 *
 * `Msini` is the one that matters and the one no absence state may hold: a
 * radial-velocity mass is the true mass times the sine of an inclination
 * nobody measured, so it is a lower bound in physics — and the archive does
 * not flag it as a limit, so neither does `absence.ts`. The words are here so
 * the prose can say it without this repo overruling the archive.
 */
export const MASS_KIND_NOTES: Readonly<Record<string, string>> = {
  Mass: 'a true mass',
  Msini: 'M·sin(i) — the true mass times the sine of an orbit inclination nobody measured, so the true mass is at least this; the archive almost never flags it as a limit of its own (2,418 of 2,423 such rows), and the few it does still word as `limit` here, exactly as published',
  'Msin(i)/sin(i)': 'M·sin(i) divided by an inclination taken from elsewhere — a true mass assembled from two sources',
  'M-R relationship': 'a mass computed from the radius by a mass–radius relation: a MODEL, not a measurement of a mass',
};

/** The gloss for one key, or null when nobody has written one. */
export const archiveNoteFor = (refstr: string): string | null => ARCHIVE_SOURCE_NOTES[refstr] ?? null;
/** The gloss for one mass-provenance word, or null. */
export const massKindNoteFor = (kind: string): string | null => MASS_KIND_NOTES[kind] ?? null;
