/**
 * THE ONE TRACK THIS REPOSITORY HAD TO BUILD — and the only thing worth
 * asserting about a table of published numbers is THE NUMBERS.
 *
 * The twenty values below are written out a SECOND time, here, in the form
 * ExPASy's ProtScale page prints them (`Ala:  1.800`), and compared to the
 * module's. That is not duplication for its own sake: a transcription error in
 * a published constant is silent — the desk would keep scoring, the charts
 * would keep drawing, and one residue type would carry a fabricated
 * measurement forever. Two independent transcriptions of the same page
 * disagreeing is the only cheap way to catch one.
 *
 * Source, fetched 2026-09-19:
 * https://web.expasy.org/protscale/pscale/Hphob.Doolittle.html
 * (Kyte J., Doolittle R.F., J. Mol. Biol. 157:105–132, 1982.)
 */
import { describe, expect, it } from 'vitest';
import { KD_MAX, KD_MIN, KYTE_DOOLITTLE, NO_HYDROPATHY, hydropathyOf } from '../src/hot/hydropathy.js';

/** ExPASy's own lines, transcribed independently of the module under test. */
const PROTSCALE = `
Ala:  1.800
Arg: -4.500
Asn: -3.500
Asp: -3.500
Cys:  2.500
Gln: -3.500
Glu: -3.500
Gly: -0.400
His: -3.200
Ile:  4.500
Leu:  3.800
Lys: -3.900
Met:  1.900
Phe:  2.800
Pro: -1.600
Ser: -0.800
Thr: -0.700
Trp: -0.900
Tyr: -1.300
Val:  4.200
`;

/** Those lines as `{ ALA: 1.8, … }` — the three-letter code upper-cased, which is how a PDB file spells it. */
const published = Object.fromEntries(
  PROTSCALE.trim()
    .split('\n')
    .map((line) => {
      const [name, value] = line.split(':');
      return [name!.trim().toUpperCase(), Number(value)];
    }),
);

describe('the Kyte & Doolittle table is the published one', () => {
  it('has exactly twenty values — one per amino acid, and no twenty-first', () => {
    expect(Object.keys(KYTE_DOOLITTLE)).toHaveLength(20);
    expect(Object.keys(published)).toHaveLength(20);
  });

  it('agrees with ExPASy ProtScale value for value', () => {
    expect(KYTE_DOOLITTLE).toEqual(published);
  });

  it('runs from arginine at −4.5 to isoleucine at +4.5, and those are the scale ends the normalisation uses', () => {
    expect(Math.min(...Object.values(KYTE_DOOLITTLE))).toBe(KD_MIN);
    expect(Math.max(...Object.values(KYTE_DOOLITTLE))).toBe(KD_MAX);
    expect([KD_MIN, KD_MAX]).toEqual([-4.5, 4.5]);
    expect(hydropathyOf('ARG')).toBe(KD_MIN);
    expect(hydropathyOf('ILE')).toBe(KD_MAX);
  });
});

describe('a name the scale does not cover is ABSENT, never zero', () => {
  it('answers null for a modified residue, and does NOT read it as its parent type', () => {
    // MSE is selenomethionine. Reading it as MET would be a scientific claim,
    // and this module makes none.
    expect(hydropathyOf('MSE')).toBeNull();
    expect(hydropathyOf('HOH')).toBeNull();
    expect(hydropathyOf('')).toBeNull();
  });

  it('never answers 0 for anything, because 0 is a real value on this scale', () => {
    // The point of the absence: zero sits between glycine (−0.4) and threonine
    // (−0.7), and cysteine — the fourth most hydrophobic residue — is +2.5. A
    // default of 0 would read as "slightly hydrophilic" and would be a
    // measurement nobody made.
    expect(Object.values(KYTE_DOOLITTLE)).not.toContain(0);
    expect(hydropathyOf('XXX')).not.toBe(0);
  });

  it('says WHY by name, with the name the file gave', () => {
    expect(NO_HYDROPATHY('MSE')).toContain('"MSE"');
    expect(NO_HYDROPATHY('MSE')).toContain('0 is a real value on that scale');
  });

  it('matches the file’s spelling only up to case and space — never a prefix, never a guess', () => {
    expect(hydropathyOf(' ala ')).toBe(1.8);
    expect(hydropathyOf('ala')).toBe(1.8);
    expect(hydropathyOf('ALAN')).toBeNull();
  });
});
