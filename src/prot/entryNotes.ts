/**
 * WHAT THIS ENTRY IS, AND WHAT THIS DESK CANNOT SAY ABOUT IT — the honesty
 * machinery of "any entry in the archive".
 *
 * One curated entry needs no module like this: its bytes are committed, its two
 * chains are protein, it has one model and not one insertion code, and every
 * caption on the desk was written against it. Open the door to the whole
 * archive and each of those becomes a way to be quietly wrong — so each one is
 * READ OFF THE BYTES here and turned into a sentence the reader sees, beside
 * the credit, where the entry is named.
 *
 * ── THE FIVE THINGS THAT GO WRONG ───────────────────────────────────────────
 *
 *   `models`           more than one model (what a solution-NMR deposition
 *                      publishes). The desk reads the FIRST — and
 *                      {@link readEntryBytes} is what makes that true rather
 *                      than a claim: the later models' records are handed to
 *                      neither the parse nor the 3D view.
 *   `chains-skipped`   a chain with coordinate records and no row: nucleic acid,
 *                      sugar, anything whose residues have no N, CA and C. The
 *                      two backbone angles and the key `<chain>:<resnum>` are
 *                      protein facts (`./etl.ts` · `residueKey`).
 *   `insertion-codes`  residues the minted key cannot tell apart, which the ETL
 *                      skips by design. The viewer still draws them, so the
 *                      count is the only honest way to say the picture and the
 *                      table disagree.
 *   `one-chain`        one chain in the table, so there is no interface for the
 *                      contacts stage to cross.
 *   `no-residues`      not one residue with a backbone. BLOCKING: there is
 *                      nothing to draw, and five empty pictures would be a lie.
 *
 * ── WHY THE BYTES AND NOT THE ARCHIVE'S RECORD ──────────────────────────────
 * `./archive.ts` reads the entry's own JSON record and judges the SIZE by it,
 * before any download. Everything here is read off the file instead, for two
 * reasons: the committed example has no record (it makes no network call at
 * all, and these notes must still be true of it), and where a record and the
 * bytes disagree the bytes are what was parsed.
 *
 * Nothing in this module counts anything the ETL already counted: the skipped
 * RECORDS are `ProtTables.skipped` and stay there. What is added is WHICH
 * residues and WHICH chains — the names, which a count cannot carry.
 */
import { ATOM_COLUMNS, atomField, type ProtTables } from './etl.js';
import { structureArtifact, type StructureArtifact } from './session.js';

/** One thing the reader is told about this entry, with the name of the thing that is wrong. */
export interface EntryNote {
  readonly code: EntryNoteCode;
  /** The sentence, as the reader sees it — read off the bytes, never a guess. */
  readonly sentence: string;
  /**
   * A note that STOPS the desk opening. Only `no-residues` is one today: every
   * other note describes a desk that still draws something true.
   */
  readonly blocking: boolean;
}

export type EntryNoteCode = 'models' | 'chains-skipped' | 'insertion-codes' | 'one-chain' | 'no-residues';

/** The bytes as the desk will read them, and what the archive's file held before that. */
export interface EntryRead {
  /** What the ETL parses and the 3D view draws — one model, always. */
  readonly artifact: StructureArtifact;
  /** How long the archive's file was. Equal to `artifact.characters` unless a model was dropped. */
  readonly archiveCharacters: number;
  /** `MODEL` records in the archive's file. `0` for a file that has none, which is the single-model case. */
  readonly models: number;
  /** Coordinate records of the models after the first — handed to nothing. */
  readonly droppedRecords: number;
}

/**
 * Which records belong to a MODEL rather than to the entry as a whole — the one
 * list {@link readEntryBytes} drops by.
 *
 * `END` is deliberately not here and `ENDMDL` is: the first ends the file, the
 * second ends a model, and a rule that could not tell them apart would truncate
 * every entry it touched.
 */
const MODEL_RECORDS = ['ATOM', 'HETATM', 'TER', 'ANISOU', 'SIGATM', 'SIGUIJ', 'MODEL', 'ENDMDL'] as const;

const isModelRecord = (line: string): boolean => MODEL_RECORDS.some((tag) => line.startsWith(tag));

/**
 * THE FIRST MODEL, AND ONLY IT — the bytes both the parse and the viewer get.
 *
 * A multi-model entry (116 of them, in the NMR case this desk was tested
 * against) is not a bigger structure: it is the same structure fitted 116 times
 * to the same data. Handing all of it to the ETL would mint one row per residue
 * from whichever model got there first and count the other 115 models' atoms as
 * ALTERNATE LOCATIONS — a true count under a false name — and handing it to
 * Mol* would draw 116 overlapping copies. So the later models are dropped here,
 * once, and {@link entryNotes} says so.
 *
 * A file with no `MODEL` record at all is returned BYTE FOR BYTE: the committed
 * example must reach the ETL exactly as `./http.ts` fetched it, and
 * `tests/prot-notes.test.ts` pins that identity.
 */
export function readEntryBytes(at: string, text: string): EntryRead {
  const lines = text.split('\n');
  const models = lines.filter((line) => line.startsWith('MODEL')).length;
  if (models <= 1) return { artifact: structureArtifact(at, text), archiveCharacters: text.length, models, droppedRecords: 0 };
  const ends = lines.findIndex((line) => line.startsWith('ENDMDL'));
  // a file that opens models and never closes one is not a file this rule can
  // cut: it is returned whole, and the note still reports the model count
  if (ends < 0) return { artifact: structureArtifact(at, text), archiveCharacters: text.length, models, droppedRecords: 0 };
  const first = lines.slice(0, ends + 1);
  const after = lines.slice(ends + 1);
  const kept = [...first, ...after.filter((line) => !isModelRecord(line))].join('\n');
  return { artifact: structureArtifact(at, kept), archiveCharacters: text.length, models, droppedRecords: after.filter(isModelRecord).length };
}

// ── what the bytes say about the chains ─────────────────────────────────────

/** One chain as the file's coordinate records show it — before the ETL decides whether it can make a row of it. */
export interface ChainInBytes {
  readonly chain: string;
  /** `ATOM` records on this chain. */
  readonly records: number;
  /** The distinct residue names, in the order the file first mentions them. */
  readonly residueNames: readonly string[];
}

/**
 * THE STANDARD NUCLEIC-ACID RESIDUE NAMES — the DNA and RNA monomers, as the
 * PDB spells them.
 *
 * This list is used for ONE thing: to say *why* a chain has no row, in words a
 * reader can check against the file. It is not used to decide anything — the
 * ETL already decided, by whether the residue had an N, a CA and a C — so a
 * modified nucleotide missing from this list costs nothing but a vaguer
 * sentence, which is the failure mode a list like this should have.
 */
const NUCLEIC_RESIDUES: ReadonlySet<string> = new Set(['DA', 'DC', 'DG', 'DT', 'DI', 'DU', 'A', 'C', 'G', 'U', 'I']);

/** Every chain the file's `ATOM` records mention, with its residue names. */
export function chainsInBytes(text: string): readonly ChainInBytes[] {
  const seen = new Map<string, { records: number; names: string[] }>();
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    const chain = atomField(line, ATOM_COLUMNS.chain);
    const held = seen.get(chain) ?? { records: 0, names: [] };
    held.records += 1;
    const name = atomField(line, ATOM_COLUMNS.resName);
    if (name !== '' && !held.names.includes(name)) held.names.push(name);
    seen.set(chain, held);
  }
  return [...seen.entries()].map(([chain, held]) => ({ chain, records: held.records, residueNames: held.names }));
}

/** The insertion-coded residues, by the key the FILE gives them — which is the key the minted one cannot spell. */
export function insertionCodedResidues(text: string): { readonly keys: readonly string[]; readonly records: number } {
  const keys: string[] = [];
  let records = 0;
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    const code = atomField(line, ATOM_COLUMNS.iCode);
    if (code === '') continue;
    records += 1;
    const key = `${atomField(line, ATOM_COLUMNS.chain)}:${atomField(line, ATOM_COLUMNS.resSeq)}${code}`;
    if (!keys.includes(key)) keys.push(key);
  }
  return { keys, records };
}

/** A list a reader can read: the first few names, and how many more there are. */
const listOf = (names: readonly string[], howMany = 6): string => (names.length <= howMany ? names.join(', ') : `${names.slice(0, howMany).join(', ')} and ${String(names.length - howMany)} more`);

const count = (n: number): string => n.toLocaleString('en-US');

/** `1 residue` / `2 residues` — a sentence about one thing has to read like one. */
const plural = (n: number, one: string, many: string): string => `${count(n)} ${n === 1 ? one : many}`;

// ── the notes ───────────────────────────────────────────────────────────────

/**
 * EVERY SENTENCE THIS ENTRY NEEDS, in reading order: what was read, what was
 * skipped, and what the pictures therefore cannot show.
 *
 * ```ts
 * const read = readEntryBytes(at, await answer.text());
 * const tables = protTables(read.artifact.text);
 * entryNotes(read, tables).map((n) => n.sentence);
 * ```
 *
 * An entry with nothing wrong answers with an EMPTY list, and the committed
 * example is one — which is what makes the list worth showing when it is not.
 */
export function entryNotes(read: EntryRead, tables: ProtTables): readonly EntryNote[] {
  const notes: EntryNote[] = [];
  const { counts } = tables;

  if (read.models > 1) {
    notes.push({
      code: 'models',
      blocking: false,
      sentence:
        `the archive's file for this entry holds ${count(read.models)} models — alternative fits to the same data, which is what a solution-NMR deposition publishes. ` +
        `THIS DESK READS THE FIRST: ${read.models === 2 ? "the other model's" : `the other ${count(read.models - 1)} models'`} ${count(read.droppedRecords)} coordinate records were handed to neither the parse nor the 3D view, so the table and the picture agree about where an atom is. ` +
        `The file is ${count(read.archiveCharacters)} characters and ${count(read.artifact.characters)} of them were read.`,
    });
  }

  const skippedChains = chainsInBytes(read.artifact.text).filter((chain) => !counts.chains.some((kept) => kept.chain === chain.chain));
  if (skippedChains.length > 0) {
    const detail = skippedChains
      .map((chain) => {
        const nucleic = chain.residueNames.length > 0 && chain.residueNames.every((name) => NUCLEIC_RESIDUES.has(name));
        return `chain ${chain.chain === '' ? '(unnamed)' : chain.chain} (${count(chain.records)} atom records; residue names ${listOf(chain.residueNames)}${nucleic ? ' — nucleic-acid residues' : ', none of which the parse found an N, a CA and a C for'})`;
      })
      .join('; ');
    notes.push({
      code: 'chains-skipped',
      blocking: false,
      sentence:
        `${plural(skippedChains.length, 'chain', 'chains')} of the ${count(skippedChains.length + counts.chains.length)} in this file ${skippedChains.length === 1 ? 'has' : 'have'} NO ROW in the residues table — ${detail}. ` +
        `The two backbone angles and the residue key "<chain>:<resnum>" are protein facts (src/prot/etl.ts · residueKey), so this desk has nothing to say about those chains; the 3D view still draws them, which is why this line exists.`,
    });
  }

  const inserted = insertionCodedResidues(read.artifact.text);
  if (inserted.keys.length > 0) {
    notes.push({
      code: 'insertion-codes',
      blocking: false,
      sentence:
        `${plural(inserted.keys.length, 'residue', 'residues')} of this entry ${inserted.keys.length === 1 ? 'carries' : 'carry'} an INSERTION CODE (${listOf(inserted.keys, 8)}) and ${inserted.keys.length === 1 ? 'is' : 'are'} absent from the residues table: ` +
        `the minted key "<chain>:<resnum>" cannot tell ${inserted.keys[0] ?? ''} from its un-coded neighbour, so the ETL skips ${plural(inserted.records, 'coordinate record', 'coordinate records')} and counts them rather than colliding ` +
        `(src/prot/etl.ts · residueKey). The 3D view draws ${inserted.keys.length === 1 ? 'that residue' : 'those residues'}, so the picture and the table disagree about exactly ${inserted.keys.length === 1 ? 'it' : 'them'}.`,
    });
  }

  const only = counts.chains.length === 1 ? counts.chains[0] : undefined;
  if (only !== undefined) {
    notes.push({
      code: 'one-chain',
      blocking: false,
      sentence:
        `the residues table holds ONE chain (${only.chain}, ${plural(only.residues, 'residue', 'residues')}), so this entry has no interface: the stage that counts contacts ACROSS two chains has nothing to cross, and every residue's count is a real zero. ` +
        `The interface picture says this sentence instead of drawing ${count(only.residues)} bars of zero.`,
    });
  }

  if (tables.residues.length === 0) {
    notes.push({
      code: 'no-residues',
      blocking: true,
      sentence:
        `the parse produced NO residue row from this entry: ${plural(counts.atomRecords, 'ATOM record', 'ATOM records')} and ${plural(counts.hetatmRecords, 'HETATM record', 'HETATM records')}, and not one residue with an N, a CA and a C to measure a backbone from. ` +
        `There is nothing for this desk to draw, so it draws nothing and says so.`,
    });
  }

  return notes;
}

/** The sentence a reader is refused with when a note blocks the desk — the notes' own words, joined, never a summary of them. */
export const blockingSentence = (notes: readonly EntryNote[]): string | null => {
  const blocking = notes.filter((note) => note.blocking);
  return blocking.length === 0 ? null : [...blocking, ...notes.filter((note) => !note.blocking)].map((note) => note.sentence).join(' ');
};
