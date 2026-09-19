/**
 * THE FIFTH TRACK — Kyte & Doolittle hydropathy, by residue type.
 *
 * Four of the five measurement tracks this desk scores on are already landed by
 * the protein desk's own acts and are REUSED, not recomputed (`./analyses.ts`
 * says which). This is the one that was missing from this repository and from
 * the library, and it is the cheapest of the five: a lookup on the residue name
 * the file itself gives, with no geometry and no service behind it.
 *
 * ── WHOSE NUMBERS THESE ARE ────────────────────────────────────────────────
 * They are not this project's. The scale is:
 *
 *   Kyte J., Doolittle R.F., "A simple method for displaying the hydropathic
 *   character of a protein", J. Mol. Biol. 157:105–132 (1982).
 *
 * and the twenty values below were taken VERBATIM, on 2026-09-19, from ExPASy's
 * ProtScale page for the scale — the reference copy every tool in this field
 * cites:
 *
 *   https://web.expasy.org/protscale/pscale/Hphob.Doolittle.html
 *
 * That page prints them to three decimals (`Ala:  1.800`), which is the same
 * number the paper publishes to one; the one-decimal form is kept here because
 * a trailing zero is not precision. They are transcribed rather than fetched
 * for the reason every other fixture in this repository is committed: a desk
 * that reached a third-party page at run time would be a desk whose score
 * changes when somebody else's web server does.
 *
 * ── AND AN UNRECOGNISED NAME IS ABSENT, NEVER ZERO ─────────────────────────
 * This is the whole reason {@link hydropathyOf} answers `null`. **Zero is a real
 * value on this scale** — it sits between glycine (−0.4) and threonine (−0.7),
 * and cysteine, the most hydrophobic residue after the three aliphatics, is
 * +2.5. So a modified residue, a HETATM, or anything else the twenty names
 * below do not cover has NO hydropathy here; defaulting it to 0 would put a
 * fabricated measurement — "slightly hydrophilic" — on a residue nobody
 * measured. The column is written `null` there and the score that reads it says
 * the term was absent (`./score.ts` · `structuralScore`).
 */

/** The scale's own extremes, which is where a normalisation gets its ends from rather than from a number anybody picked. */
export const KD_MIN = -4.5;
export const KD_MAX = 4.5;

/**
 * THE TWENTY VALUES, in the order ExPASy prints them — alphabetical by the
 * three-letter code, which is also the order they can be checked against that
 * page line by line.
 *
 * The key is the PDB file's own three-letter residue name, upper case, because
 * that is what `src/prot/etl.ts` · `ResidueRow.resname` carries: the file's
 * word, never re-coded.
 */
export const KYTE_DOOLITTLE: Readonly<Record<string, number>> = {
  ALA: 1.8, // Ala:  1.800
  ARG: -4.5, // Arg: -4.500
  ASN: -3.5, // Asn: -3.500
  ASP: -3.5, // Asp: -3.500
  CYS: 2.5, // Cys:  2.500
  GLN: -3.5, // Gln: -3.500
  GLU: -3.5, // Glu: -3.500
  GLY: -0.4, // Gly: -0.400
  HIS: -3.2, // His: -3.200
  ILE: 4.5, // Ile:  4.500
  LEU: 3.8, // Leu:  3.800
  LYS: -3.9, // Lys: -3.900
  MET: 1.9, // Met:  1.900
  PHE: 2.8, // Phe:  2.800
  PRO: -1.6, // Pro: -1.600
  SER: -0.8, // Ser: -0.800
  THR: -0.7, // Thr: -0.700
  TRP: -0.9, // Trp: -0.900
  TYR: -1.3, // Tyr: -1.300
  VAL: 4.2, // Val:  4.200
};

/**
 * The hydropathy of one residue type, or `null` for a name the scale does not
 * cover.
 *
 * ```ts
 * hydropathyOf('ILE');   //  4.5 — the most hydrophobic of the twenty
 * hydropathyOf('ARG');   // -4.5 — the least
 * hydropathyOf('MSE');   //  null — selenomethionine is not one of the twenty
 * ```
 *
 * The name is matched EXACTLY as the file spells it, apart from case and
 * surrounding space: a PDB residue name is a fixed-column field and the parse
 * already trimmed it (`src/prot/etl.ts` · `atomField`). Nothing here maps a
 * modified residue onto its parent — `MSE` is not silently read as `MET`,
 * because deciding that two residue types are the same residue type is a
 * scientific claim and this module makes none.
 */
export function hydropathyOf(resname: string): number | null {
  return KYTE_DOOLITTLE[resname.trim().toUpperCase()] ?? null;
}

/** What this desk says about a residue type it cannot score — by name, with the reason, and never repaired. */
export const NO_HYDROPATHY = (resname: string): string =>
  `"${resname}" is not one of the twenty amino acids Kyte & Doolittle (1982) published a hydropathy for, so this residue has none — and 0 is a real value on that scale (glycine is −0.4, cysteine +2.5), so it is left ABSENT rather than defaulted to the middle`;
