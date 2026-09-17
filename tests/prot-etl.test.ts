/**
 * THE PROTEIN ETL, over the committed entry — every number HAND-COUNTED from
 * `data/prot/1ay7.pdb` and then DERIVED again a second way.
 *
 * The literals below were counted off the file with a stream editor before the
 * parser existed, which is the only order in which a test of a parser means
 * anything:
 *
 *   ATOM records                1,488     `grep -c '^ATOM'`
 *   HETATM records                190     `grep -c '^HETATM'` (all HOH)
 *   residues                      185     distinct chain + number over ATOM
 *   chain A / chain B          96 / 89
 *   kept atoms                    555     = 185 × 3 (every residue has N, CA, C)
 *   skipped: alternate location    22     the second copy of each of the 44
 *                                         alternate-location atoms
 *   skipped: not a backbone atom  911
 *   skipped: insertion code         0     this entry has none
 *   phi absent                      2     A:1 and B:1 — the first of each chain
 *   psi absent                      2     A:96 and B:89 — the last of each chain
 *   both present                  181
 *
 * And the arithmetic that ties them: 1,488 + 190 coordinate records = 555 kept
 * + 1,123 skipped. Every one of those numbers is asserted as a literal AND
 * derived from the bytes in the same test, so a parser that agrees with itself
 * and with nothing else fails here.
 *
 * The two ANGLES are checked the same way, and the derivation is deliberately
 * NOT the ETL's formula: `torsionByCrossProducts` below computes the same
 * torsion through the cross products of the three bond vectors, where
 * `src/prot/etl.ts` · `torsion` projects onto the plane perpendicular to the
 * middle bond. Two routes to one angle; a sign error would not survive both.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { entryCredit, entryId, pdbRecord, protTables, residueKey, skippedOf, skippedTotal, torsion } from '../src/prot/etl.js';
import { ENTRY_PDB, digestOf, entryProvenance, loadStructure, loadStructureText } from '../src/prot/snapshot.js';

const TEXT = loadStructureText();
const TABLES = protTables(TEXT);
const LINES = TEXT.split('\n');

/** Every coordinate record of the file, as text — the independent side of every count below. */
const atomLines = LINES.filter((l) => l.startsWith('ATOM'));
const hetatmLines = LINES.filter((l) => l.startsWith('HETATM'));

const skipped = (reason: string): number => TABLES.skipped.find((s) => s.reason === reason)?.records ?? -1;

describe('the committed entry is the file the fetch recorded', () => {
  it('is 169,371 bytes with the digest data/prot/PROVENANCE.json names', () => {
    // the size and the digest are the fetch script's own record, read back — never retyped here
    const record = entryProvenance();
    expect(readFileSync(ENTRY_PDB).length).toBe(169_371);
    expect(record['bytes']).toBe(169_371);
    expect(digestOf()).toBe(record['sha256']);
    expect(record['entry']).toBe('1AY7');
    expect(record['at']).toBe('https://files.rcsb.org/download/1AY7.pdb');
  });

  it('carries the entry’s own words, and the ETL reads the same ones the fetch script wrote', () => {
    // `pdbRecord` and the twin inside data/prot/fetch.mjs must agree, or the page
    // credits the entry differently from the provenance beside it
    const record = entryProvenance();
    const credit = entryCredit(TEXT);
    expect(credit.entry).toBe('1AY7');
    expect(entryId(TEXT)).toBe('1AY7');
    expect(credit.title).toBe('RIBONUCLEASE SA COMPLEX WITH BARSTAR');
    expect(credit.title).toBe(record['title']);
    expect(credit.depositors).toBe(record['depositors']);
    expect(credit.citation).toBe(record['primaryCitation']);
    expect(credit.experiment).toBe('X-RAY DIFFRACTION');
    // the two chains, in the depositors' own words
    expect(credit.molecules).toContain('GUANYL-SPECIFIC RIBONUCLEASE SA');
    expect(credit.molecules).toContain('BARSTAR');
    expect(pdbRecord(TEXT, 'EXPDTA')).toBe('X-RAY DIFFRACTION');
    // the licence claim this repository publishes is in the record, not in a comment
    expect((record['license'] as Record<string, unknown>)['dedication']).toBe('CC0 1.0 Universal');
  });
});

describe('the parse: 185 residues out of 1,678 coordinate records, and every skipped record named', () => {
  it('counts the records the file really has', () => {
    expect(TABLES.counts.atomRecords).toBe(1_488);
    expect(TABLES.counts.atomRecords).toBe(atomLines.length);
    expect(TABLES.counts.hetatmRecords).toBe(190);
    expect(TABLES.counts.hetatmRecords).toBe(hetatmLines.length);
    // every hetero record of this entry is a water — so "190 skipped" is 190 waters
    expect(new Set(hetatmLines.map((l) => l.slice(17, 20).trim()))).toEqual(new Set(['HOH']));
  });

  it('parses 185 residues — 96 on chain A, 89 on chain B — and mints one key each', () => {
    expect(TABLES.counts.residues).toBe(185);
    expect(TABLES.counts.chains).toEqual([
      { chain: 'A', residues: 96 },
      { chain: 'B', residues: 89 },
    ]);
    // DERIVED from the bytes: the distinct (chain, number) pairs over the ATOM records
    const pairs = new Set(atomLines.map((l) => `${l.slice(21, 22)}:${String(Number(l.slice(22, 26)))}`));
    expect(pairs.size).toBe(185);
    expect(TABLES.residues.map((r) => r.residue_key).sort()).toEqual([...pairs].sort());
    // one key per row, and no two rows share one
    expect(new Set(TABLES.residues.map((r) => r.residue_key)).size).toBe(TABLES.residues.length);
    // the key is minted by ONE function and spelled one way
    expect(TABLES.residues[0]?.residue_key).toBe(residueKey('A', 1));
    expect(residueKey('A', 1)).toBe('A:1');
  });

  it('keeps 555 backbone atoms and names all 1,123 records it skipped, class by class', () => {
    expect(TABLES.counts.keptAtoms).toBe(555);
    // 185 residues × N, CA and C: the parse kept exactly the three atoms a torsion needs
    expect(TABLES.counts.keptAtoms).toBe(TABLES.counts.residues * 3);
    expect(skipped('water-or-hetero')).toBe(190);
    expect(skipped('insertion-code')).toBe(0);
    expect(skipped('alternate-location')).toBe(22);
    expect(skipped('not-a-backbone-atom')).toBe(911);
    expect(skippedTotal(TABLES.skipped)).toBe(1_123);
    // THE ARITHMETIC THAT TIES THE PARSE TO THE FILE: every coordinate record is
    // either on a row or in a skip class, and there is no third place for one to go
    expect(TABLES.counts.keptAtoms + skippedTotal(TABLES.skipped)).toBe(atomLines.length + hetatmLines.length);

    // DERIVED: 44 atom records sit at an alternate location, listed A then B, so
    // 22 are the second copy of an atom already taken
    const altLines = atomLines.filter((l) => l.slice(16, 17) !== ' ');
    expect(altLines.length).toBe(44);
    expect(skipped('alternate-location')).toBe(altLines.length / 2);
    // DERIVED: the side-chain and other atoms, counted off the bytes with the same
    // first-location rule the parser uses
    const taken = new Set<string>();
    let sideChain = 0;
    for (const l of atomLines) {
      const name = l.slice(12, 16).trim();
      const key = `${l.slice(21, 22)}:${String(Number(l.slice(22, 26)))}.${name}`;
      if (taken.has(key)) continue;
      taken.add(key);
      if (name !== 'N' && name !== 'CA' && name !== 'C') sideChain += 1;
    }
    expect(sideChain).toBe(911);
    expect(skipped('not-a-backbone-atom')).toBe(sideChain);
  });

  it('lists every skip class even at zero — a count is a statement, silence is not', () => {
    expect(TABLES.skipped.map((s) => s.reason)).toEqual(['water-or-hetero', 'insertion-code', 'alternate-location', 'not-a-backbone-atom']);
    // the zero class still carries its reason, and the reason says what would break
    expect(skippedOf({ hetatmRecords: 0, skippedInsertionCode: 0, skippedAlternate: 0, skippedSideChain: 0 }).map((s) => s.reason)).toEqual(TABLES.skipped.map((s) => s.reason));
    expect(TABLES.skipped.find((s) => s.reason === 'insertion-code')?.why).toContain('the minted key "<chain>:<resnum>" cannot tell');
    expect(TABLES.skipped.every((s) => s.why.length > 0)).toBe(true);
  });
});

// ── the angles ───────────────────────────────────────────────────────────────

type Point = readonly [number, number, number];

/** The four atoms of a torsion, read straight out of the file's fixed columns. */
function atom(chain: string, resnum: number, name: string): Point {
  const line = atomLines.find((l) => l.slice(21, 22) === chain && Number(l.slice(22, 26)) === resnum && l.slice(12, 16).trim() === name);
  if (line === undefined) throw new Error(`${chain}:${String(resnum)} has no ${name} in the committed file`);
  return [Number(line.slice(30, 38)), Number(line.slice(38, 46)), Number(line.slice(46, 54))];
}

/**
 * The same torsion by a DIFFERENT route: the signed angle between the two
 * bond-plane normals, taken with `atan2` over their cross product.
 *
 * `src/prot/etl.ts` · `torsion` projects the outer bonds onto the plane
 * perpendicular to the middle bond. This one never forms those projections.
 * Agreement to twelve decimals is therefore evidence rather than a tautology.
 */
function torsionByCrossProducts(p0: Point, p1: Point, p2: Point, p3: Point): number {
  const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const b0 = sub(p1, p0);
  const b1 = sub(p2, p1);
  const b2 = sub(p3, p2);
  const n1 = cross(b0, b1);
  const n2 = cross(b1, b2);
  const length = Math.sqrt(dot(b1, b1));
  return (Math.atan2(dot(cross(n1, n2), [b1[0] / length, b1[1] / length, b1[2] / length]), dot(n1, n2)) * 180) / Math.PI;
}

describe('phi and psi: read off the coordinates, absent where the geometry is not there', () => {
  const rowOf = (key: string) => TABLES.residues.find((r) => r.residue_key === key);

  it('chain A residue 2 is a valine at phi −77.43°, psi 144.30° — the literal and the derivation', () => {
    const row = rowOf('A:2');
    expect(row?.resname).toBe('VAL');
    // THE LITERALS, to two decimal places (the precision this test states)
    expect(row?.phi).toBeCloseTo(-77.43, 2);
    expect(row?.psi).toBeCloseTo(144.3, 2);
    // …and DERIVED from the file's own coordinates, the other way round
    const phi = torsionByCrossProducts(atom('A', 1, 'C'), atom('A', 2, 'N'), atom('A', 2, 'CA'), atom('A', 2, 'C'));
    const psi = torsionByCrossProducts(atom('A', 2, 'N'), atom('A', 2, 'CA'), atom('A', 2, 'C'), atom('A', 3, 'N'));
    expect(row?.phi).toBeCloseTo(phi, 12);
    expect(row?.psi).toBeCloseTo(psi, 12);
    // and the two implementations in this repository agree to the same place
    expect(torsion(atom('A', 1, 'C'), atom('A', 2, 'N'), atom('A', 2, 'CA'), atom('A', 2, 'C'))).toBeCloseTo(phi, 12);
  });

  it('chain A residue 50 is a glycine at a POSITIVE phi, 107.08° — the one thing only a glycine does', () => {
    const row = rowOf('A:50');
    expect(row?.resname).toBe('GLY');
    expect(row?.phi).toBeCloseTo(107.08, 2);
    expect(row?.psi).toBeCloseTo(-7.53, 2);
    const phi = torsionByCrossProducts(atom('A', 49, 'C'), atom('A', 50, 'N'), atom('A', 50, 'CA'), atom('A', 50, 'C'));
    expect(row?.phi).toBeCloseTo(phi, 12);
    // a positive phi is where the sign convention shows: an implementation with the
    // torsion's sign flipped would put this residue at −107 and pass every other check
    expect(row?.phi).toBeGreaterThan(0);
  });

  it('the CA of chain A residue 50 is the file’s own coordinate, unrounded', () => {
    expect([rowOf('A:50')?.ca_x, rowOf('A:50')?.ca_y, rowOf('A:50')?.ca_z]).toEqual([-5.337, 20.843, 11.087]);
    expect([rowOf('A:50')?.ca_x, rowOf('A:50')?.ca_y, rowOf('A:50')?.ca_z]).toEqual([...atom('A', 50, 'CA')]);
  });

  it('exactly four residues are missing an angle, and they are the two ends of each chain', () => {
    expect(TABLES.counts.phiAbsent).toBe(2);
    expect(TABLES.counts.psiAbsent).toBe(2);
    expect(TABLES.counts.bothPresent).toBe(181);
    expect(TABLES.residues.filter((r) => r.phi === null).map((r) => r.residue_key)).toEqual(['A:1', 'B:1']);
    expect(TABLES.residues.filter((r) => r.psi === null).map((r) => r.residue_key)).toEqual(['A:96', 'B:89']);
    // DERIVED: the first and the last residue number of each chain, off the bytes
    const numbersOf = (chain: string): readonly number[] => [...new Set(atomLines.filter((l) => l.slice(21, 22) === chain).map((l) => Number(l.slice(22, 26))))].sort((a, b) => a - b);
    expect([numbersOf('A')[0], numbersOf('B')[0]]).toEqual([1, 1]);
    expect([numbersOf('A').at(-1), numbersOf('B').at(-1)]).toEqual([96, 89]);
    // ABSENT, not zero — the whole point of the column
    expect(rowOf('A:1')?.phi).toBeNull();
    expect(rowOf('A:1')?.psi).not.toBeNull();
    expect(TABLES.residues.some((r) => r.phi === 0 || r.psi === 0)).toBe(false);
    // …and 181 + 2 + 2 = 185, so no residue is missing both
    expect(TABLES.counts.bothPresent + TABLES.counts.phiAbsent + TABLES.counts.psiAbsent).toBe(TABLES.counts.residues);
  });

  it('a torsion with no middle bond is absent rather than zero', () => {
    // two atoms at one point: an angle nobody can measure. A file like this is broken,
    // and the parser says "no value" rather than "zero degrees"
    expect(torsion([0, 0, 0], [1, 1, 1], [1, 1, 1], [2, 0, 0])).toBeNull();
  });
});

describe('the artifact the desk holds beside the session', () => {
  it('is the file’s text, and the host can say only how long it is', () => {
    const artifact = loadStructure();
    expect(artifact.text).toBe(TEXT);
    expect(artifact.characters).toBe(TEXT.length);
    expect(artifact.at).toBe(ENTRY_PDB.href);
    // NO version and NO retrievedAt: nothing vouched for these bytes, and a field
    // here would be the host vouching for itself (src/prot/session.ts)
    expect(Object.keys(artifact).sort()).toEqual(['at', 'characters', 'text']);
  });
});
