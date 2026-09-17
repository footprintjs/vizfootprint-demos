/**
 * WHAT THIS DESK CANNOT SAY ABOUT AN ENTRY IT WAS NOT BUILT WITH — every
 * sentence, over bytes made from the committed entry's own lines.
 *
 * The committed entry is the happy case by construction: one model, two protein
 * chains, no insertion code, 185 residues with a backbone. So each fixture here
 * takes ITS lines and changes exactly one thing — an insertion code in column
 * 27, the file wrapped in two MODEL records, chain B removed, a chain of
 * nucleotide names added, every ATOM record dropped. That keeps the fixtures
 * real (fixed columns, real coordinates, a real HEADER) while making one fact
 * about the entry different, which is what each sentence is about. The four
 * builders live in `tests/protFixture.ts`, because the landing's suite asserts
 * what a cell does with one of them.
 *
 * The first assertion is the one the whole module rests on: a file with no
 * `MODEL` record comes back BYTE FOR BYTE, so the committed example reaches the
 * ETL exactly as it was fetched.
 */
import { describe, expect, it } from 'vitest';
import { chainsInBytes, blockingSentence, entryNotes, insertionCodedResidues, readEntryBytes, type EntryNote } from '../src/prot/entryNotes.js';
import { protTables } from '../src/prot/etl.js';
import { loadStructureText } from '../src/prot/snapshot.js';
import { asTwoModels, oneChainOnly, withInsertionCode, withNucleicChain } from './protFixture.js';

const TEXT = loadStructureText();
const AT = 'https://files.rcsb.org/download/1AY7.pdb';

/** The notes for some bytes, the way the page computes them (`web/site/prot/entry.tsx` · `boot`). */
function notesOf(text: string): readonly EntryNote[] {
  const read = readEntryBytes(AT, text);
  return entryNotes(read, protTables(read.artifact.text));
}

const sentence = (notes: readonly EntryNote[], code: EntryNote['code']): string => notes.find((n) => n.code === code)?.sentence ?? `NO NOTE "${code}"`;

describe('the bytes the desk reads: one model, and byte-for-byte when there is only one', () => {
  it('hands a single-model file straight through, character for character', () => {
    const read = readEntryBytes(AT, TEXT);
    expect(read.artifact.text).toBe(TEXT);
    expect(read.artifact.characters).toBe(TEXT.length);
    expect(read.archiveCharacters).toBe(TEXT.length);
    expect(read.models).toBe(0); // this file has no MODEL record at all
    expect(read.droppedRecords).toBe(0);
    expect(notesOf(TEXT)).toEqual([]); // nothing to report about the committed entry
  });

  it('keeps the FIRST model of a multi-model file and hands the rest to nothing', () => {
    const two = asTwoModels(TEXT);
    const read = readEntryBytes(AT, two);
    expect(read.models).toBe(2);
    expect(read.archiveCharacters).toBe(two.length);
    expect(read.artifact.characters).toBeLessThan(two.length);
    // the kept text holds one MODEL and one ENDMDL, and half the coordinate records
    expect(read.artifact.text.split('\n').filter((l) => l.startsWith('MODEL'))).toHaveLength(1);
    expect(read.artifact.text.split('\n').filter((l) => l.startsWith('ATOM'))).toHaveLength(TEXT.split('\n').filter((l) => l.startsWith('ATOM')).length);
    expect(read.droppedRecords).toBeGreaterThan(0);
    // …and the parse of it is the parse of the committed entry: the same 185 residues
    expect(protTables(read.artifact.text).counts.residues).toBe(protTables(TEXT).counts.residues);
    // the records after the first model are gone, and the file's own END survived
    expect(read.artifact.text.trimEnd().endsWith('END')).toBe(true);
  });

  it('says how many models there were and that the desk read the first', () => {
    const said = sentence(notesOf(asTwoModels(TEXT)), 'models');
    expect(said).toContain('holds 2 models');
    expect(said).toContain('alternative fits to the same data');
    expect(said).toContain('THIS DESK READS THE FIRST');
    expect(said).toContain("the other model's");
    expect(said).toContain('handed to neither the parse nor the 3D view');
    expect(said).toMatch(/The file is [\d,]+ characters and [\d,]+ of them were read\./);
  });
});

describe('insertion codes: the residues the minted key cannot tell apart', () => {
  it('names them, counts them, and says they are absent from the table', () => {
    const notes = notesOf(withInsertionCode(TEXT, 'A', '2', 'A'));
    const said = sentence(notes, 'insertion-codes');
    expect(said).toContain('1 residue of this entry carries an INSERTION CODE (A:2A) and is absent from the residues table');
    expect(said).toContain('cannot tell A:2A from its un-coded neighbour');
    expect(said).toContain('src/prot/etl.ts · residueKey');
    expect(said).toContain('The 3D view draws that residue, so the picture and the table disagree about exactly it');
    // and the count is the ETL's own: those records really are skipped
    const read = readEntryBytes(AT, withInsertionCode(TEXT, 'A', '2', 'A'));
    const tables = protTables(read.artifact.text);
    expect(tables.skipped.find((s) => s.reason === 'insertion-code')?.records).toBeGreaterThan(0);
    expect(tables.residues.some((r) => r.residue_key === 'A:2')).toBe(false);
  });

  it('reads the keys off the bytes, in the file’s own spelling', () => {
    const marked = withInsertionCode(withInsertionCode(TEXT, 'A', '2', 'A'), 'B', '5', 'B');
    expect(insertionCodedResidues(marked).keys).toEqual(['A:2A', 'B:5B']);
    expect(insertionCodedResidues(TEXT).keys).toEqual([]);
    expect(insertionCodedResidues(TEXT).records).toBe(0);
  });
});

describe('chains this desk cannot read', () => {
  it('names each one, its records and its residue names, and calls the nucleotides what they are', () => {
    const said = sentence(notesOf(withNucleicChain(TEXT)), 'chains-skipped');
    expect(said).toContain('1 chain of the 3 in this file has NO ROW in the residues table');
    expect(said).toContain('chain E (12 atom records; residue names DA — nucleic-acid residues)');
    expect(said).toContain('protein facts (src/prot/etl.ts · residueKey)');
    expect(said).toContain('the 3D view still draws them');
  });

  it('reads the chains off the bytes, in the order the file mentions them', () => {
    expect(chainsInBytes(TEXT).map((c) => c.chain)).toEqual(['A', 'B']);
    expect(chainsInBytes(TEXT)[0]?.residueNames).toContain('ASP');
    expect(chainsInBytes(withNucleicChain(TEXT)).map((c) => c.chain)).toEqual(['A', 'B', 'E']);
  });

  it('says nothing at all about the committed entry, whose every chain has rows', () => {
    expect(notesOf(TEXT).map((n) => n.code)).toEqual([]);
  });
});

describe('an entry with one chain has no interface', () => {
  it('says so, with the chain and the residue count, instead of promising a bar of zeros', () => {
    const notes = notesOf(oneChainOnly(TEXT, 'A'));
    const said = sentence(notes, 'one-chain');
    expect(said).toContain('the residues table holds ONE chain (A, 96 residues)');
    expect(said).toContain('has nothing to cross');
    expect(said).toContain('every residue\'s count is a real zero');
    expect(said).toContain('instead of drawing 96 bars of zero');
    expect(notes.every((n) => !n.blocking)).toBe(true); // the desk still opens: four of its five pictures are true
  });
});

describe('an entry with no residue at all', () => {
  it('BLOCKS the desk, and says what was in the file instead', () => {
    const waters = TEXT.split('\n').filter((line) => !line.startsWith('ATOM') && !line.startsWith('TER')).join('\n');
    const notes = notesOf(waters);
    const said = sentence(notes, 'no-residues');
    expect(said).toContain('the parse produced NO residue row from this entry: 0 ATOM records and 190 HETATM records');
    expect(said).toContain('not one residue with an N, a CA and a C');
    expect(said).toContain('so it draws nothing and says so');
    expect(notes.find((n) => n.code === 'no-residues')?.blocking).toBe(true);
    // the sentence a reader is refused with is the notes' own words, blocking first
    const refusal = blockingSentence(notes);
    expect(refusal).not.toBeNull();
    expect(refusal?.startsWith('the parse produced NO residue row')).toBe(true);
  });

  it('blocks nothing when there is nothing blocking', () => {
    expect(blockingSentence(notesOf(TEXT))).toBeNull();
    expect(blockingSentence(notesOf(oneChainOnly(TEXT, 'A')))).toBeNull();
  });
});

describe('several things wrong at once', () => {
  it('says all of them, in reading order, and each one only once', () => {
    const notes = notesOf(asTwoModels(withInsertionCode(withNucleicChain(oneChainOnly(TEXT, 'A')), 'A', '2', 'A')));
    expect(notes.map((n) => n.code)).toEqual(['models', 'chains-skipped', 'insertion-codes', 'one-chain']);
  });
});
