/**
 * THE ARCHIVE'S THREE DOORS, AND EVERY WAY THEY SAY NO.
 *
 * Going from one committed entry to any entry in the Protein Data Bank is not a
 * fetch — it is a list of refusals, and each one has to be a sentence a reader
 * sees. So every assertion here is on the SENTENCE, and the answers the fake
 * doors hand back are the shapes the real services really answer with
 * (probed once, against the live endpoints, while this was written):
 *
 *   - a search that matches nothing answers **204 with an empty body**, which
 *     is why `searchArchive` reads `text()` and never `json()`;
 *   - an id that does not exist answers 404 with the archive's own `message`,
 *     and the refusal QUOTES it;
 *   - an entry too large for the fixed-column format answers 404 at the FILE
 *     door while its record is fine — a different fact, and a different
 *     sentence.
 *
 * NOTHING HERE TOUCHES THE NETWORK. `ArchiveFetch` is a function
 * (`src/prot/archive.ts`), the fake below counts every call, and the one test
 * that matters most asserts a count of ZERO: choosing the committed example must
 * read the committed bytes.
 */
import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_URLS,
  ATOM_CEILING,
  EXAMPLE_ENTRY,
  browserArchive,
  downloadEntry,
  entryIdRefusal,
  entryRecord,
  exampleIsTheCommittedEntry,
  gateOf,
  listEntries,
  looksLikeEntryId,
  openEntryBytes,
  searchArchive,
  summaryLine,
  type ArchiveFetch,
  type EntrySummary,
} from '../src/prot/archive.js';
import { loadStructure, loadStructureText } from '../src/prot/snapshot.js';
import { RECORD_1AY7, fakeArchive, noSuchEntry, recordWith, searchAnswer } from './protFixture.js';

const summaryOf = async (body: string, status = 200): Promise<EntrySummary> => {
  const answered = await entryRecord('1AY7', fakeArchive(() => ({ status, body })).doors);
  if (!answered.ok) throw new Error(`the record was refused: ${answered.sentence}`);
  return answered.value;
};

describe('which door a reader’s words go through', () => {
  it('reads four characters as an entry id, case and space included — and nothing else', () => {
    expect(looksLikeEntryId('1ay7')).toBe(true);
    expect(looksLikeEntryId(' 1AY7 ')).toBe(true);
    expect(looksLikeEntryId('4hhb')).toBe(true);
    // a question, not an id
    expect(looksLikeEntryId('barstar')).toBe(false);
    expect(looksLikeEntryId('ribonuclease inhibitor')).toBe(false);
    // the shapes that LOOK like ids and are not: three characters, five, a
    // leading zero, and the archive's own extended form
    expect(looksLikeEntryId('1ay')).toBe(false);
    expect(looksLikeEntryId('1ay77')).toBe(false);
    expect(looksLikeEntryId('0ay7')).toBe(false);
    expect(looksLikeEntryId('pdb_00001ay7')).toBe(false);
  });

  it('refuses a not-an-id in a sentence that says what an id is, and that nothing was fetched', () => {
    const said = entryIdRefusal('pdb_00001ay7');
    expect(said).toContain('"pdb_00001ay7" is not a PDB entry id');
    expect(said).toContain('four characters');
    expect(said).toContain('extended ids');
    expect(said).toContain('Nothing was fetched.');
  });

  it('names the example by the id the committed bytes carry, not by a string beside them', () => {
    expect(exampleIsTheCommittedEntry(loadStructureText())).toBe(true);
    expect(EXAMPLE_ENTRY).toBe('1AY7');
  });
});

describe('the search: what came back, and what to say when nothing did', () => {
  it('lists the ids the service returned, upper-cased, with its own total', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 200, body: searchAnswer(['2CX6', '1a19'], 269) }));
    const answered = await searchArchive('barstar', doors);
    expect(answered.ok && answered.value.ids).toEqual(['2CX6', '1A19']);
    expect(answered.ok && answered.value.total).toBe(269);
    expect(calls).toEqual([ARCHIVE_URLS.search]);
  });

  it('reads 204 as "nothing matches those words" — the status, never an inference from an empty list', async () => {
    const { doors } = fakeArchive(() => ({ status: 204, body: '' }));
    const answered = await searchArchive('zzzqqqxxnotathing', doors);
    expect(answered.ok).toBe(false);
    expect(!answered.ok && answered.sentence).toBe('the archive\'s search answered 204 (no content) for "zzzqqqxxnotathing" — nothing in the PDB\'s full text matches those words');
  });

  it('says what a broken service answered, rather than throwing a parse error at a reader', async () => {
    const { doors } = fakeArchive(() => ({ status: 503, body: '<html>Service Unavailable</html>' }));
    const answered = await searchArchive('barstar', doors);
    expect(!answered.ok && answered.sentence).toContain('answered 503 for "barstar"');
    expect(!answered.ok && answered.sentence).toContain('Service Unavailable');
  });

  it('says so when the answer is a 200 that is not JSON', async () => {
    const { doors } = fakeArchive(() => ({ status: 200, body: 'not json at all' }));
    const answered = await searchArchive('barstar', doors);
    expect(!answered.ok && answered.sentence).toContain('is not JSON');
    expect(!answered.ok && answered.sentence).toContain('not json at all');
  });

  it('says so when the service reports matches and lists no id', async () => {
    const { doors } = fakeArchive(() => ({ status: 200, body: JSON.stringify({ total_count: 12, result_set: [] }) }));
    const answered = await searchArchive('barstar', doors);
    expect(!answered.ok && answered.sentence).toContain('the archive\'s search reported 12 matches for "barstar" and listed no entry id');
  });
});

describe('the entry record: the archive’s own words for an id that is not there', () => {
  it('quotes the service’s message on a 404 rather than inventing one', async () => {
    const { doors } = fakeArchive(() => noSuchEntry('9ZZZ'));
    const answered = await entryRecord('9zzz', doors);
    expect(answered.ok).toBe(false);
    expect(!answered.ok && answered.sentence).toContain('the archive has no entry "9ZZZ"');
    expect(!answered.ok && answered.sentence).toContain('No data found for entryId: 9ZZZ');
    expect(!answered.ok && answered.sentence).toContain(`${ARCHIVE_URLS.entry}9ZZZ`);
  });

  it('reads the fields the gate and the list need, and leaves a field the record does not carry ABSENT', async () => {
    expect(await summaryOf(RECORD_1AY7)).toEqual({
      entry: '1AY7',
      title: 'RIBONUCLEASE SA COMPLEX WITH BARSTAR',
      methods: ['X-RAY DIFFRACTION'],
      models: 1,
      chains: 2,
      proteinEntities: 2,
      nucleicEntities: 0,
      atoms: 1678,
      composition: 'heteromeric protein',
    });
    // a record with no `rcsb_entry_info` at all: every count absent, never zero
    const bare = await summaryOf(JSON.stringify({ struct: { title: 'A STRUCTURE' } }));
    expect(bare).toMatchObject({ models: null, chains: null, atoms: null, proteinEntities: null, composition: null, methods: [] });
  });

  it('reads a line a reader can pick an entry by, naming every absence as an absence', async () => {
    expect(summaryLine(await summaryOf(RECORD_1AY7))).toBe('ribonuclease sa complex with barstar · x-ray diffraction · 2 chains · 1,678 atoms');
    expect(summaryLine(await summaryOf(recordWith({ deposited_model_count: 116 }, { exptl: [{ method: 'SOLUTION NMR' }] })))).toContain('116 models');
    expect(summaryLine(await summaryOf(JSON.stringify({})))).toBe("the archive's record carries no title for this entry · no method named · no chain count · no atom count");
  });
});

describe('the gate: what is refused before a byte is downloaded', () => {
  it('states the cost when it lets an entry through — atoms, chains, and the ceiling', async () => {
    const gate = gateOf(await summaryOf(RECORD_1AY7));
    expect(gate.ok).toBe(true);
    expect(gate.ok && gate.cost).toContain('1AY7 deposits 1,678 atoms in 2 polymer chains');
    expect(gate.ok && gate.cost).toContain('before anything was downloaded');
    expect(gate.ok && gate.cost).toContain(`ceiling of ${ATOM_CEILING.toLocaleString('en-US')} atoms`);
  });

  it('refuses a size it will not attempt, names the ceiling, and says nothing was downloaded', async () => {
    const gate = gateOf(await summaryOf(recordWith({ deposited_atom_count: 200_000 })));
    expect(gate.ok).toBe(false);
    expect(!gate.ok && gate.sentence).toContain('deposits 200,000 atoms and this desk will not attempt more than 50,000');
    expect(!gate.ok && gate.sentence).toContain('run in this browser tab');
    expect(!gate.ok && gate.sentence).toContain('Nothing was downloaded.');
  });

  it('fails CLOSED when the record carries no atom count — a ceiling nobody can check is not a ceiling', async () => {
    const gate = gateOf(await summaryOf(recordWith({ deposited_atom_count: null })));
    expect(!gate.ok && gate.sentence).toContain('carries no deposited atom count');
    expect(!gate.ok && gate.sentence).toContain('Nothing was downloaded.');
  });

  it('refuses an entry with no protein polymer, in the archive’s own word for what it is', async () => {
    const gate = gateOf(await summaryOf(recordWith({ polymer_entity_count_protein: 0, polymer_entity_count_nucleic_acid: 2, polymer_composition: 'DNA' })));
    expect(!gate.ok && gate.sentence).toContain('deposits no protein polymer (the archive calls it "DNA")');
    expect(!gate.ok && gate.sentence).toContain('every column this desk draws is a protein fact');
  });
});

describe('the file door', () => {
  it('tells "no PDB-format file" apart from "no such entry", because they are not the same fact', async () => {
    const { doors } = fakeArchive(() => ({ status: 404, body: '<html>not found</html>' }));
    const answered = await downloadEntry('4v4a', doors);
    expect(!answered.ok && answered.sentence).toContain('the archive publishes no PDB-format file for 4V4A');
    expect(!answered.ok && answered.sentence).toContain('although the entry exists');
    expect(!answered.ok && answered.sentence).toContain('released as mmCIF only');
  });

  it('refuses an error page served with a 200, by the HEADER record a PDB entry must begin with', async () => {
    const { doors } = fakeArchive(() => ({ status: 200, body: '<!doctype html><title>oops</title>' }));
    const answered = await downloadEntry('1ay7', doors);
    expect(!answered.ok && answered.sentence).toContain('are not a PDB entry (no HEADER record on the first line)');
  });

  it('answers the bytes and where they came from', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 200, body: 'HEADER    SOMETHING\nATOM      1  N   ALA A   1\n' }));
    const answered = await downloadEntry('1abc', doors);
    expect(answered.ok && answered.value.at).toBe(`${ARCHIVE_URLS.file}1ABC.pdb`);
    expect(answered.ok && answered.value.text.startsWith('HEADER')).toBe(true);
    expect(calls).toEqual([`${ARCHIVE_URLS.file}1ABC.pdb`]);
  });
});

describe('the landing’s list', () => {
  it('lists every id the search gave, with the gate’s refusal where there is one and never a dropped row', async () => {
    const { doors, calls } = fakeArchive((url) => {
      if (url.endsWith('1AY7')) return { status: 200, body: RECORD_1AY7 };
      if (url.endsWith('4V4A')) return { status: 200, body: recordWith({ deposited_atom_count: 200_000 }) };
      return noSuchEntry('9ZZZ');
    });
    const listed = await listEntries(['1AY7', '4V4A', '9ZZZ'], doors);
    expect(listed.map((row) => row.entry)).toEqual(['1AY7', '4V4A', '9ZZZ']);
    expect(listed[0]?.refusal).toBeNull();
    expect(listed[0]?.line).toContain('ribonuclease sa complex with barstar');
    // the row is LISTED and says why it cannot be opened, before anybody clicks it
    expect(listed[1]?.refusal).toContain('will not attempt more than 50,000');
    // and a row whose record could not be read is still a row
    expect(listed[2]?.line).toBeNull();
    expect(listed[2]?.refusal).toContain('No data found for entryId: 9ZZZ');
    expect(calls).toHaveLength(3);
  });
});

describe('the example is READ, never fetched', () => {
  it('reads the committed bytes and calls the archive zero times', async () => {
    const { doors, calls } = fakeArchive(() => {
      throw new Error('the example must not reach the archive');
    });
    let committed = 0;
    const opened = await openEntryBytes('1ay7', {
      archive: doors,
      committed: () => {
        committed += 1;
        return Promise.resolve(loadStructure());
      },
    });
    expect(opened.ok).toBe(true);
    expect(committed).toBe(1);
    expect(calls).toEqual([]);
    // no record was read for it, so there is no cost line to show: nothing was downloaded
    expect(opened.ok && opened.value.summary).toBeNull();
    expect(opened.ok && opened.value.cost).toBeNull();
    expect(opened.ok && opened.value.bytes.text.startsWith('HEADER')).toBe(true);
  });

  it('takes any other entry through the record, the gate and then the file — in that order', async () => {
    const { doors, calls } = fakeArchive((url) => (url.startsWith(ARCHIVE_URLS.entry) ? { status: 200, body: RECORD_1AY7 } : { status: 200, body: 'HEADER    A COMPLEX\n' }));
    const opened = await openEntryBytes('2cx6', { archive: doors, committed: () => Promise.reject(new Error('the committed file is not this entry')) });
    expect(opened.ok).toBe(true);
    expect(calls).toEqual([`${ARCHIVE_URLS.entry}2CX6`, `${ARCHIVE_URLS.file}2CX6.pdb`]);
    expect(opened.ok && opened.value.cost).toContain('read off the archive\'s own record before anything was downloaded');
  });

  it('never reaches the file door for an entry the gate refused', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 200, body: recordWith({ deposited_atom_count: 200_000 }) }));
    const opened = await openEntryBytes('4v4a', { archive: doors, committed: () => Promise.reject(new Error('not the example')) });
    expect(opened.ok).toBe(false);
    expect(!opened.ok && opened.sentence).toContain('will not attempt more than 50,000');
    expect(calls).toEqual([`${ARCHIVE_URLS.entry}4V4A`]);
  });

  it('refuses a not-an-id without asking anything at all', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 200, body: RECORD_1AY7 }));
    const opened = await openEntryBytes('ribonuclease', { archive: doors, committed: () => Promise.reject(new Error('not the example')) });
    expect(!opened.ok && opened.sentence).toContain('is not a PDB entry id');
    expect(calls).toEqual([]);
  });
});

describe('a door that does not answer at all', () => {
  /** A browser with no network: `fetch` REJECTS, and so does a body that stops mid-stream. */
  const offline: ArchiveFetch = () => Promise.reject(new TypeError('Failed to fetch'));
  const halfRead: ArchiveFetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.reject(new Error('network error while reading the body')) });

  it('is a SENTENCE at every door, never an unhandled promise', async () => {
    for (const [what, answered] of [
      ['search', await searchArchive('barstar', offline)],
      ['record', await entryRecord('1ay7', offline)],
      ['file', await downloadEntry('1ay7', offline)],
    ] as const) {
      expect(answered.ok, `the ${what} door threw instead of answering`).toBe(false);
      expect(!answered.ok && answered.sentence).toContain('nothing answered at https://');
      expect(!answered.ok && answered.sentence).toContain('Failed to fetch');
      // the one thing a reader of a server-less page needs to know
      expect(!answered.ok && answered.sentence).toContain('asks the archive from your browser');
    }
  });

  it('says so when the body itself could not be read', async () => {
    const answered = await entryRecord('1ay7', halfRead);
    expect(!answered.ok && answered.sentence).toContain('network error while reading the body');
  });

  it('carries it through the router, with nothing downloaded after it', async () => {
    const opened = await openEntryBytes('2cx6', { archive: offline, committed: () => Promise.reject(new Error('not the example')) });
    expect(opened.ok).toBe(false);
    expect(!opened.ok && opened.sentence).toContain('nothing answered at');
  });

  it('lists a row whose record could not be reached, rather than dropping it', async () => {
    const listed = await listEntries(['2CX6'], offline);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.line).toBeNull();
    expect(listed[0]?.refusal).toContain('nothing answered at');
  });
});

describe('the one adapter', () => {
  it('is the browser’s own fetch, named once', () => {
    expect(typeof browserArchive).toBe('function');
  });
});
