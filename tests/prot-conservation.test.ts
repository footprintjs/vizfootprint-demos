/**
 * THE CONSERVATION STAGE — the alignment is CITED, the placement is COMPUTED by
 * the WEAKER of two methods, and the score is entropy rather than a published
 * grade.
 *
 * Those three sentences are the whole of what this stage claims, and each one
 * is a way it could quietly become dishonest:
 *
 *   **the citation** — a score attributed to an alignment nobody served. So the
 *   accession AND the version are read out of the Stockholm header
 *   (`src/prot/stockholm.ts`) and pinned here against the record the fetch
 *   script wrote, digest and all.
 *   **the placement** — a consensus-placed score read as an HMM-placed one. So
 *   the clause that says which method ran is asserted BYTE FOR BYTE, and the
 *   arm that is not implemented is asserted to refuse BY NAME.
 *   **the score** — entropy read as a ConSurf-style grade. So the arithmetic is
 *   worked out by hand over a five-sequence alignment, and the sentence that
 *   says what it is NOT is pinned.
 *
 * The four hops are the fourth way, and they have a file of their own
 * (`tests/prot-mapping.test.ts`), including the non-identity fixture.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CONSERVATION_ACT, CONSERVATION_BASIS_COLUMN, CONSERVATION_COLUMN, NO_CONSERVATION_EVIDENCE, PROT_STAGES, protAnalyses } from '../src/prot/analyses.js';
import { ENTROPY_STATES, FAMILY_POSITION_OCCUPANCY, SCORE_IS, SCORE_IS_NOT, columnEntropy, conservationAt, conservationByPosition, consensusAt, consensusOf, familyPositions } from '../src/prot/conservation.js';
import { CONSENSUS, GAP_EXTEND, GAP_OPEN, HMMALIGN, PLACEMENT_HERE, PLACEMENT_STRATEGIES, alignGlobally, placeAgainstHmm } from '../src/prot/placement.js';
import { parseStockholm } from '../src/prot/stockholm.js';
import { ALIGNMENT_USED, conservationEvidenceFor, evidenceFromCommitted, evidenceFromServices, noFamily, noReference } from '../src/prot/conservationEvidence.js';
import { foldConservation } from '../src/prot/conservationFold.js';
import { INTERPRO_URLS, familyAlignment, pfamMatches } from '../src/prot/family.js';
import { ARCHIVE_URLS } from '../src/prot/archive.js';
import { PROT_CONSERVATION_FILES, SITE_DATA_FILES, conservationFileOf } from '../src/data/files.js';
import { conservationProvenance, loadStructureText, readCommittedFile } from '../src/prot/snapshot.js';
import { protTables } from '../src/prot/etl.js';
import { fakeArchive, type Answer } from './protFixture.js';

const TABLES = protTables(loadStructureText());
const KEYS = TABLES.residues.map((r) => r.residue_key);

/** The two committed alignments, read the way the desk reads them. */
const alignment = (family: string) => {
  const read = parseStockholm(readFileSync(conservationFileOf.alignment(family), 'utf8'));
  if (!read.ok) throw new Error(read.sentence);
  return read.value;
};

// ── the citation ─────────────────────────────────────────────────────────────

describe('THE ALIGNMENT IS CITED — accession AND version, read out of its own header', () => {
  it('reads both committed alignments’ own accession, version, name and sequence count', () => {
    const rnase = alignment('PF00545');
    expect(rnase.cited).toBe('PF00545.26');
    expect([rnase.accession, rnase.version]).toEqual(['PF00545', '26']);
    expect(rnase.identifier).toBe('Ribonuclease');
    expect(rnase.description).toBe('ribonuclease');
    expect(rnase.rows).toHaveLength(283);
    expect(rnase.columns).toBe(241);
    // the header's OWN claim about how many sequences it holds, beside the count
    // of rows really parsed — two facts, and a disagreement would be a finding
    expect(rnase.declaredCount).toBe(rnase.rows.length);

    const barstar = alignment('PF01337');
    expect(barstar.cited).toBe('PF01337.25');
    expect(barstar.rows).toHaveLength(69);
    expect(barstar.columns).toBe(132);
    expect(barstar.declaredCount).toBe(barstar.rows.length);
  });

  it('cites the version the fetch script recorded, over the bytes it recorded — digest and all', () => {
    /*
      THE ONE ASSERTION THAT MAKES THE CITATION REAL. A version read out of a
      file the repository committed is only a citation if the file is the one
      that was downloaded, so the record the fetch wrote is checked against the
      bytes on disk AND against what this desk says it is citing.
    */
    const record = conservationProvenance() as { readonly alignments: { readonly files: readonly { readonly file: string; readonly accessionWithVersion: string; readonly declaredSequences: number; readonly bytes: number; readonly sha256: string }[] } };
    expect(record.alignments.files.map((f) => f.accessionWithVersion)).toEqual(['PF00545.26', 'PF01337.25']);
    for (const file of record.alignments.files) {
      const bytes = readFileSync(new URL(`../data/prot/conservation/${file.file}`, import.meta.url));
      expect(bytes).toHaveLength(file.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
      // and the version the DESK cites is the version those very bytes declare
      const read = parseStockholm(bytes.toString('utf8'));
      expect(read.ok && read.value.cited).toBe(file.accessionWithVersion);
      expect(read.ok && read.value.declaredCount).toBe(file.declaredSequences);
    }
  });

  it('says WHICH alignment it scored over, because 283 sequences and 3,982 are different claims', () => {
    expect(ALIGNMENT_USED).toBe('seed');
    const record = conservationProvenance() as { readonly alignments: { readonly chose: string } };
    expect(record.alignments.chose).toContain('the SEED and not the FULL alignment');
    expect(record.alignments.chose).toContain('3,982 sequences');
  });

  it('refuses a document, a file with no version, a ragged one and one with no sequence — each in its own sentence', () => {
    const html = parseStockholm('<!DOCTYPE html><html><body>503 Service Unavailable</body></html>');
    expect(html.ok).toBe(false);
    expect(html.ok ? '' : html.sentence).toBe(
      'the alignment service answered an HTML document where a Stockholm alignment was declared — the first characters are "<!DOCTYPE html><html><body>503 Service Unavailable</body></h". Nothing was parsed: a document is never an alignment by accident.',
    );

    const notStockholm = parseStockholm('name sequence\nother sequence\n');
    expect(notStockholm.ok ? '' : notStockholm.sentence).toBe('the alignment service answered something that is not a Stockholm alignment (no "# STOCKHOLM" on the first line) — the first characters are "name sequence other sequence". Nothing was parsed.');

    const noVersion = parseStockholm('# STOCKHOLM 1.0\nseq1 ACDE\n//\n');
    expect(noVersion.ok ? '' : noVersion.sentence).toBe('the alignment carries no "#=GF AC" line, so it does not say which family or which RELEASE it is — and a score this desk cannot attribute to a version is a score it will not show.');

    const ragged = parseStockholm('# STOCKHOLM 1.0\n#=GF AC   PF99999.1\nseq1 ACDE\nseq2 ACD\n//\n');
    expect(ragged.ok ? '' : ragged.sentence).toBe('the alignment is ragged: 1 of its 2 rows are not 4 characters long, so its columns do not line up and a column\'s residues cannot be read. Nothing was scored.');

    const empty = parseStockholm('# STOCKHOLM 1.0\n#=GF AC   PF99999.1\n#=GF SQ   0\n//\n');
    expect(empty.ok ? '' : empty.sentence).toBe('the alignment declares itself Stockholm and carries no aligned sequence at all — 5 lines, every one of them an annotation or blank. There is no column to score.');
  });

  it('reads an interleaved alignment by NAME, because Stockholm is legally written in blocks', () => {
    const blocks = parseStockholm('# STOCKHOLM 1.0\n#=GF AC   PF99999.1\nseq1 AC\nseq2 AD\n\nseq1 DE\nseq2 DF\n//\n');
    expect(blocks.ok && blocks.value.rows).toEqual(['ACDE', 'ADDF']);
  });

  it('does not read Pfam’s own consensus line — a reduced alphabet is a different quantity', () => {
    const withConsensus = parseStockholm('# STOCKHOLM 1.0\n#=GF AC   PF99999.1\nseq1 ACDE\n#=GC seq_cons ttss\n//\n');
    expect(withConsensus.ok && withConsensus.value.rows).toEqual(['ACDE']);
  });
});

// ── the score ────────────────────────────────────────────────────────────────

/**
 * FIVE SEQUENCES, FOUR COLUMNS, worked out by hand — and one column of each
 * kind the arithmetic has to get right.
 *
 *   column 0   A A A A A   one state                        H = 0
 *   column 1   A A A A C   4/5 and 1/5                      H = 0.721928…
 *   column 2   A A C C -   2/5, 2/5 and a GAP as a state    H = 1.521928…
 *   column 3   A C D E F   five states, evenly              H = log2 5 = 2.321928…
 *
 * The hand working for column 1:
 *   −(0.8 · log2 0.8 + 0.2 · log2 0.2) = −(0.8 · −0.321928 + 0.2 · −2.321928)
 *                                      = 0.257542 + 0.464386 = 0.721928
 * and for column 2:
 *   −(0.4 · log2 0.4 · 2 + 0.2 · log2 0.2) = 2 · 0.528771 + 0.464386 = 1.521928
 */
const BY_HAND = ['AAAA', 'AAAC', 'AACD', 'AACE', 'AC-F'];

describe('THE SCORE IS SHANNON ENTROPY over the alignment’s own column — and the gap is a state', () => {
  it('is 0 bits for a column every sequence agrees on', () => {
    expect(columnEntropy(BY_HAND, 0)).toBe(0);
    // …and 1 exactly once normalised, which is the only score that is exact
    expect(conservationAt(BY_HAND, 0)).toBe(1);
  });

  it('is the hand arithmetic, column by column', () => {
    expect(columnEntropy(BY_HAND, 1)).toBeCloseTo(0.721928, 6);
    expect(columnEntropy(BY_HAND, 2)).toBeCloseTo(1.521928, 6);
    expect(columnEntropy(BY_HAND, 3)).toBeCloseTo(2.321928, 6);
    expect(columnEntropy(BY_HAND, 3)).toBeCloseTo(Math.log2(5), 12);
  });

  it('normalises against the 22 states a column can hold, and nothing folded per column', () => {
    // 20 amino acids, the gap, and ONE state for everything else. Fixed, so two
    // entries' scores are on one scale — a divisor folded per column would
    // quietly destroy that.
    expect(ENTROPY_STATES).toBe(22);
    expect(conservationAt(BY_HAND, 1)).toBeCloseTo(1 - 0.721928 / Math.log2(22), 6);
    expect(conservationAt(BY_HAND, 1)).toBeCloseTo(0.838112, 5);
    expect(conservationAt(BY_HAND, 2)).toBeCloseTo(0.658717, 5);
    expect(conservationAt(BY_HAND, 3)).toBeCloseTo(0.479322, 5);
  });

  it('counts the GAP as its own state, which is what makes a half-gapped column score low', () => {
    // the same column with the gap replaced by a residue already present is a
    // BETTER known column, and scores higher — which is the reading the choice
    // of counting gaps is for
    expect(columnEntropy(['A', 'A', 'C', 'C', '-'], 0)).toBeCloseTo(1.521928, 6);
    expect(columnEntropy(['A', 'A', 'C', 'C', 'C'], 0)).toBeCloseTo(0.970951, 6);
    // and `.`, `-` and `~` are ONE state: the same alignment exported by three
    // tools must not score three ways, so a column of one residue and three
    // gaps scores identically however those gaps were spelled
    //   −(0.25 · log2 0.25 + 0.75 · log2 0.75) = 0.5 + 0.311278 = 0.811278
    expect(columnEntropy(['A', '.', '-', '~'], 0)).toBeCloseTo(0.811278, 6);
    expect(columnEntropy(['A', '.', '-', '~'], 0)).toBe(columnEntropy(['A', '-', '-', '-'], 0));
    expect(columnEntropy(['A', '.', '-', '~'], 0)).toBe(columnEntropy(['A', '.', '.', '.'], 0));
  });

  it('says what it is and says what it is NOT, in one owner each', () => {
    expect(SCORE_IS).toContain('Shannon entropy over the curated alignment’s own column');
    expect(SCORE_IS).toContain('gaps counted as a state of their own');
    expect(SCORE_IS).toContain('22 states');
    expect(SCORE_IS_NOT).toBe(
      'It is NOT a published conservation grade. ConSurf-style 1–9 grades estimate the evolutionary RATE at a site against a phylogenetic tree and a substitution model; this is a count of letters in a column, with no tree and no model in it, and nothing on this desk is reproducing those grades.',
    );
  });
});

describe('HOP 1 — which columns are family positions, and the consensus over them', () => {
  it('keeps a column at least half the sequences have a residue in, and drops the rest', () => {
    expect(FAMILY_POSITION_OCCUPANCY).toBe(0.5);
    expect(familyPositions(['AC.D', 'AC.D', 'A..D'])).toEqual([0, 1, 3]);
    // 2 of 5 is below the line, 3 of 5 is on it
    expect(familyPositions(['A', 'A', '-', '-', '-'])).toEqual([]);
    expect(familyPositions(['A', 'A', 'A', '-', '-'])).toEqual([0]);
  });

  it('is 100 positions of PF00545’s 241 columns and 97 of PF01337’s 132 — the insertion columns dropped', () => {
    expect(familyPositions(alignment('PF00545').rows)).toHaveLength(100);
    expect(familyPositions(alignment('PF01337').rows)).toHaveLength(97);
  });

  it('folds a consensus from the columns themselves, breaking ties alphabetically so the placement is deterministic', () => {
    expect(consensusAt(['A', 'A', 'C'], 0)).toBe('A');
    // a tie: `C` and `A` one each — alphabetical, and NOT whichever row came first
    expect(consensusAt(['C', 'A'], 0)).toBe('A');
    expect(consensusAt(['-', '-'], 0)).toBeNull();
    expect(consensusOf(['AC.D', 'AC.D', 'A..D'], [0, 1, 3])).toBe('ACD');
    // the real one, which is a ribonuclease's consensus and not noise
    const rnase = alignment('PF00545');
    expect(consensusOf(rnase.rows, familyPositions(rnase.rows))).toHaveLength(100);
    expect(conservationByPosition(rnase.rows, familyPositions(rnase.rows))).toHaveLength(100);
  });
});

// ── the placement, and which method ran ─────────────────────────────────────

describe('THE PLACEMENT is a port with two arms, and this build ships the WEAKER one', () => {
  it('runs the consensus arm, and says so in a clause that is byte-stable', () => {
    expect(PLACEMENT_HERE).toBe('consensus');
    expect(PLACEMENT_STRATEGIES[PLACEMENT_HERE]).toBe(CONSENSUS);
    expect(CONSENSUS.weaker).toBe(true);
    // THE CLAUSE THE PAGE PRINTS WHEREVER A NUMBER FROM THIS STAGE APPEARS.
    // Pinned byte for byte: a reader comparing two entries must not be able to
    // read a consensus-placed score as an HMM-placed one, and a clause that
    // drifted would be a different promise on each card.
    expect(CONSENSUS.said).toBe('placed by pairwise alignment to the family consensus — the weaker of the two methods');
    expect(CONSENSUS.label).toBe('pairwise alignment to the family consensus');
  });

  it('declares the BETTER arm and refuses it BY NAME, so the next packet drops an implementation in', () => {
    expect(HMMALIGN.weaker).toBe(false);
    expect(PLACEMENT_STRATEGIES.hmmalign).toBe(HMMALIGN);
    const refused = placeAgainstHmm();
    expect(refused.ok).toBe(false);
    expect(refused.method).toBe('hmmalign');
    expect(refused.ok ? '' : refused.sentence).toBe(
      'the family\'s own profile HMM is the right way to place these residues and this build cannot run it: the HMM is 11,752 bytes and answers a browser, so what is missing is not the data but HMMER itself — the container is the tool, and a static page has nothing to run it on. A build with a server behind it places the same chain with hmmalign; this build used the consensus instead and says so wherever it shows a number.',
    );
    // the ARM is a strategy like the other one, so a caller asks for it by name
    expect(HMMALIGN.place('ACDE', 'ACDE')).toEqual(refused);
  });

  it('aligns globally with affine gaps at BLAST’s own defaults, and is DETERMINISTIC', () => {
    expect([GAP_OPEN, GAP_EXTEND]).toEqual([-11, -1]);
    // A/A 4 + C/C 9 + D/D 6 + E/E 5 = 24
    const same = alignGlobally('ACDE', 'ACDE');
    expect(same.score).toBe(24);
    expect(same.pairs).toEqual([
      { query: 1, position: 1 },
      { query: 2, position: 2 },
      { query: 3, position: 3 },
      { query: 4, position: 4 },
    ]);
    // an unreadable letter is PLACED rather than dropped — X's own row answers
    expect(alignGlobally('ACDE', 'AXDE').pairs).toHaveLength(4);
    // THE SAME INPUT, THE SAME COLUMNS — asserted rather than assumed, because
    // this page's whole claim is that its numbers can be re-derived
    const once = CONSENSUS.place('DVSGTVCLSALPPEATDTLNLIASDGPFPYSQ', consensusOf(alignment('PF00545').rows, familyPositions(alignment('PF00545').rows)));
    const twice = CONSENSUS.place('DVSGTVCLSALPPEATDTLNLIASDGPFPYSQ', consensusOf(alignment('PF00545').rows, familyPositions(alignment('PF00545').rows)));
    expect(once).toEqual(twice);
  });

  it('refuses a sequence it cannot place, and a family with no consensus to place against — each in its own sentence', () => {
    const noConsensus = CONSENSUS.place('ACDE', '');
    expect(noConsensus.ok ? '' : noConsensus.sentence).toBe('the family alignment has no column at least half its sequences have a residue in, so there is no consensus to place this chain against and no residue of it is scored.');
    const noQuery = CONSENSUS.place('', 'ACDE');
    expect(noQuery.ok ? '' : noQuery.sentence).toBe('the chain\'s own sequence is empty at the residues the family covers, so there is nothing to place and no residue of it is scored.');
  });
});

// ── the whole fold, over the committed example ─────────────────────────────

describe('THE STAGE, over the committed entry — two chains, two families, two scales', () => {
  it('reads its evidence from the committed files and calls NO SERVICE at all', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 500, body: 'this door should never be knocked on for the example' }));
    const evidence = await conservationEvidenceFor('1AY7', { committed: readCommittedFile, archive: doors });
    expect(calls).toEqual([]);
    expect(evidence.from).toBe('committed');
    expect(evidence.refusals).toEqual([]);
    expect(evidence.chains.map((c) => c.chain)).toEqual(['A', 'B']);
    expect(evidence.chains.flatMap((c) => c.families.map((f) => f.alignment.cited))).toEqual(['PF00545.26', 'PF01337.25']);
    expect(evidence.chains.flatMap((c) => c.families.map((f) => `${String(f.match.from)}..${String(f.match.to)}`))).toEqual(['5..92', '1..81']);
  });

  it('lands 162 of the 185 residues, with the 23 that have no column ABSENT and counted', async () => {
    const fold = foldConservation(await evidenceFromCommitted('1AY7', readCommittedFile), KEYS);
    expect(fold.counts.residues).toBe(185);
    expect(fold.counts.scored).toBe(162);
    expect(fold.counts.absent).toBe(23);
    expect(fold.refusals).toEqual([]);
    expect(fold.counts.overlaps).toBe(0);
    // ABSENT, NEVER ZERO — every unscored residue is `null`, and not one of them
    // is 0, which would read as "the family agrees on nothing here"
    const unscored = fold.conservation.filter((value) => value === null);
    expect(unscored).toHaveLength(23);
    expect(fold.conservation.some((value) => value === 0)).toBe(false);
    // and the basis is absent exactly where the score is
    expect(fold.conservation.map((v) => v === null)).toEqual(fold.conservation_basis.map((v) => v === null));
  });

  it('puts every score on the residue the four hops name, and the first four residues of chain A outside the domain', async () => {
    const fold = foldConservation(await evidenceFromCommitted('1AY7', readCommittedFile), KEYS);
    const at = (key: string): number | null => fold.conservation[KEYS.indexOf(key)] ?? null;
    // PF00545 covers UniProt 5..92 of a 96-residue chain, and hops 3 and 4 are
    // the identity there — so 1…4 and 93…96 have no column
    for (const key of ['A:1', 'A:2', 'A:3', 'A:4', 'A:93', 'A:94', 'A:95', 'A:96']) expect(at(key), `${key} was scored and is outside the domain region`).toBeNull();
    expect(at('A:5')).not.toBeNull();
    // PF01337 covers UniProt 1..81 and chain B begins at UniProt 2, so its
    // domain reaches entity 1…80 — the LAST nine residues have no column
    for (const key of ['B:81', 'B:85', 'B:89']) expect(at(key), `${key} was scored and is outside the domain region`).toBeNull();
    expect(at('B:1')).not.toBeNull();
    expect(at('B:80')).not.toBeNull();
    // every score is a real 0…1
    for (const value of fold.conservation) if (value !== null) expect(value).toBeGreaterThanOrEqual(0), expect(value).toBeLessThanOrEqual(1);
  });

  it('reports each chain’s own citation, placement and counts — and the two are never compared', async () => {
    const fold = foldConservation(await evidenceFromCommitted('1AY7', readCommittedFile), KEYS);
    /*
      THE NUMBERS THE CARD PRINTS, pinned. `score` and `identities` are the
      PLACEMENT's own output, so a change in either means the placement changed
      — which is exactly what this test is for.
    */
    expect(fold.counts.chains).toEqual([
      { chain: 'A', cited: 'PF00545.26', family: 'PF00545', familyName: 'ribonuclease', sequences: 283, declaredSequences: 283, positions: 100, domain: [5, 92], domainResidues: 88, placed: 82, identities: 33, score: 79, residues: 96, scored: 82, absent: 14, method: 'consensus', refusal: null },
      { chain: 'B', cited: 'PF01337.25', family: 'PF01337', familyName: 'Barstar (barnase inhibitor)', sequences: 69, declaredSequences: 69, positions: 97, domain: [1, 81], domainResidues: 80, placed: 80, identities: 30, score: 99, residues: 89, scored: 80, absent: 9, method: 'consensus', refusal: null },
    ]);
    // TWO SCALES, AND THE COLUMN IS THE WARNING: every score carries the
    // alignment it came from, and the two chains' are different
    const basisFor = (chain: string): readonly (string | null)[] => [...new Set(KEYS.flatMap((key, at) => (key.startsWith(`${chain}:`) && fold.conservation_basis[at] !== null ? [fold.conservation_basis[at]!] : [])))];
    expect(basisFor('A')).toEqual(['PF00545.26']);
    expect(basisFor('B')).toEqual(['PF01337.25']);
    expect(new Set(fold.conservation_basis.filter((v) => v !== null)).size).toBe(2);
    // and the fold says which method placed them, as a BOOLEAN a consumer
    // branches on rather than as prose it has to parse
    expect([fold.counts.method, fold.counts.weaker]).toEqual(['consensus', true]);
  });

  it('is deterministic over the committed evidence — the same columns, twice', async () => {
    const evidence = await evidenceFromCommitted('1AY7', readCommittedFile);
    expect(foldConservation(evidence, KEYS)).toEqual(foldConservation(evidence, KEYS));
  });
});

// ── every refusal, as its shipped sentence ─────────────────────────────────

describe('THE REFUSALS — each one a sentence, and none of them hides the other chain’s score', () => {
  it('a chain the archive matched to no UniProt sequence', () => {
    expect(noReference('C')).toBe("chain C is matched to no UniProt sequence in the archive's own record, so there is no family to look its residues up in and no residue of chain C is scored. Every other chain's score stands.");
  });

  it('a chain in no Pfam family — said by name, with the other chain’s score left standing', async () => {
    expect(noFamily('B', 'P11540')).toBe("chain B (P11540) is in no Pfam family, so there is no curated alignment to score its residues against and no residue of chain B is scored. Every other chain's score stands.");
    /*
      AND OVER A REAL READ: chain B's family record answers "no match" while
      chain A's is the committed one, so chain A is scored, chain B is not, and
      the refusal names chain B. That is the state the shape of this stage
      exists to keep honest — a refusal that only existed when the whole act
      failed would leave it silent.
    */
    const { doors } = fakeArchive((url) => committedOrEmpty(url, 'P11540'));
    const evidence = await evidenceFromServices('1AY7', doors);
    const fold = foldConservation(evidence, KEYS);
    expect(fold.counts.scored).toBe(82);
    expect(fold.counts.chains.map((c) => [c.chain, c.cited])).toEqual([
      ['A', 'PF00545.26'],
      ['B', null],
    ]);
    expect(fold.refusals).toEqual([noFamily('B', 'P11540')]);
    // the OTHER chain's evidence is all there
    expect(fold.conservation[KEYS.indexOf('A:5')]).not.toBeNull();
    expect(fold.conservation[KEYS.indexOf('B:5')]).toBeNull();
  });

  it('the alignment service unavailable, and the alignment service answering HTML', async () => {
    const down = fakeArchive(() => ({ status: 503, body: 'Service Unavailable' }));
    const unavailable = await familyAlignment('PF00545', down.doors);
    expect(unavailable.ok ? '' : unavailable.sentence).toBe(
      `the alignment service at ${INTERPRO_URLS.alignment('PF00545')} answered 503 for PF00545, so the curated alignment this score would come from was never read and no residue of this chain is scored. It said: Service Unavailable`,
    );
    const htmlDoor = fakeArchive(() => ({ status: 200, body: '<!DOCTYPE html><html><body>nope</body></html>' }));
    const html = await familyAlignment('PF00545', htmlDoor.doors);
    expect(html.ok ? '' : html.sentence).toContain('the alignment service answered an HTML document where a Stockholm alignment was declared');
    expect(html.ok ? '' : html.sentence).toContain('a document is never an alignment by accident');
  });

  it('a family lookup that answers nothing at all is a list of none, not a failure', async () => {
    for (const status of [204, 404]) {
      const { doors } = fakeArchive(() => ({ status, body: '' }));
      const matched = await pfamMatches('P05798', doors);
      expect(matched.ok).toBe(true);
      expect(matched.ok ? matched.value : null).toEqual([]);
    }
  });

  it('a def built with no family evidence at all — the refusal that is about this BUILD', () => {
    expect(NO_CONSERVATION_EVIDENCE).toBe(
      'no family evidence was gathered for this entry, so nothing was placed and no residue is scored. The curated alignment this stage cites is read before the dashboard is built — from the files this repository committed for the example, or from the three services for any other entry — and this dashboard was built without it.',
    );
    // the act is DECLARED either way, so a stage with no evidence lands a
    // refusal rather than reading as a stage nobody ran
    expect(Object.keys(protAnalyses('HEADER', null))).toContain(CONSERVATION_ACT);
  });

  it('and the honest statement that this build used the weaker placement is in the act’s own honesty note', () => {
    const slot = protAnalyses('HEADER', null)[CONSERVATION_ACT] as unknown as { readonly honesty: { readonly notes: string } };
    expect(slot.honesty.notes).toContain(CONSENSUS.said);
    expect(slot.honesty.notes).toContain(SCORE_IS);
    expect(slot.honesty.notes).toContain(SCORE_IS_NOT);
    expect(slot.honesty.notes).toContain('The alignment is CITED, not built');
    expect(slot.honesty.notes).toContain('absent, never zero');
  });
});

// ── the live door, and the committed files ─────────────────────────────────

/** The committed bytes, answered at whichever of the three live URLs asks for them — and an EMPTY family list for one accession. */
function committedOrEmpty(url: string, noFamilyFor: string | null): Answer {
  if (url === ARCHIVE_URLS.graphql) return { status: 200, body: readFileSync(conservationFileOf.entities('1AY7'), 'utf8') };
  for (const accession of ['P05798', 'P11540']) {
    if (url === INTERPRO_URLS.matches(accession)) return accession === noFamilyFor ? { status: 200, body: '{"count":0,"results":[]}' } : { status: 200, body: readFileSync(conservationFileOf.matches(accession), 'utf8') };
  }
  for (const family of ['PF00545', 'PF01337']) {
    if (url === INTERPRO_URLS.alignment(family)) return { status: 200, body: readFileSync(conservationFileOf.alignment(family), 'utf8') };
  }
  return { status: 404, body: `nothing here: ${url}` };
}

describe('THE LIVE DOOR reads the same evidence the committed files hold', () => {
  it('asks the three services in the order the facts depend on each other, and folds the same numbers', async () => {
    const { doors, calls } = fakeArchive((url) => committedOrEmpty(url, null));
    const live = await evidenceFromServices('1AY7', doors);
    expect(calls).toEqual([ARCHIVE_URLS.graphql, INTERPRO_URLS.matches('P05798'), INTERPRO_URLS.alignment('PF00545'), INTERPRO_URLS.matches('P11540'), INTERPRO_URLS.alignment('PF01337')]);
    const committed = await evidenceFromCommitted('1AY7', readCommittedFile);
    expect(foldConservation(live, KEYS).counts.chains).toEqual(foldConservation(committed, KEYS).counts.chains);
  });

  it('routes any OTHER entry to the live services rather than to the example’s files', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 404, body: 'no such entry' }));
    const other = await conservationEvidenceFor('4HHB', { committed: readCommittedFile, archive: doors });
    expect(other.from).toBe('live');
    expect(calls).toEqual([ARCHIVE_URLS.graphql]);
    expect(other.refusals[0]).toContain('the archive\'s entity records for "4HHB" answered 404');
  });
});

describe('the committed files travel with the build', () => {
  it('mints exactly the five names that are committed, and the static build copies every one', () => {
    expect(PROT_CONSERVATION_FILES).toEqual([
      'data/prot/conservation/1AY7-entities.json',
      'data/prot/conservation/P05798-pfam.json',
      'data/prot/conservation/P11540-pfam.json',
      'data/prot/conservation/PF00545-seed.sto',
      'data/prot/conservation/PF01337-seed.sto',
    ]);
    for (const file of PROT_CONSERVATION_FILES) {
      expect(readFileSync(file, 'utf8').length, `${file} is not committed`).toBeGreaterThan(100);
      expect(SITE_DATA_FILES, `${file} is not copied into the static site`).toContain(file);
    }
    // and the record travels too, because a score that cites an alignment has to
    // be able to hand over the citation
    expect(SITE_DATA_FILES).toContain('data/prot/conservation/PROVENANCE.json');
  });

  it('names the service, the URL, the accession-with-version, the date and the licence for every one of them', () => {
    const record = conservationProvenance() as Readonly<Record<string, { readonly service?: string; readonly at?: string; readonly license?: Readonly<Record<string, string>> }>> & { readonly retrievedAt: string };
    expect(new Date(record.retrievedAt as unknown as string).getFullYear()).toBeGreaterThan(2000);
    for (const key of ['entities', 'matches', 'alignments']) {
      const part = record[key]!;
      expect(part.service, `${key} names no service`).toBeTruthy();
      expect(part.at, `${key} names no URL`).toBeTruthy();
      expect(part.license?.['policyPage'], `${key} names no licence policy page`).toBeTruthy();
      expect(part.license?.['statement'], `${key} states no licence`).toBeTruthy();
    }
  });
});

describe('the stage the def now dispatches', () => {
  it('is PROT_STAGES’ own third stage, with one act and the intent the ledger will carry', () => {
    const stage = PROT_STAGES.find((s) => s.stage === 'conservation')!;
    expect(stage.label).toBe('How conserved each residue is across the family');
    expect(stage.acts.map((a) => a.id)).toEqual([CONSERVATION_ACT]);
    expect(stage.acts[0]!.intent).toContain('cite the curated alignment');
    expect(stage.acts[0]!.intent).toContain('accession and version, read out of the alignment');
    expect(stage.acts[0]!.intent).toContain('placed by the weaker of the two methods');
  });

  it('declares the two columns it lands, and the basis as a string beside the score', () => {
    const slot = protAnalyses('HEADER', null)[CONSERVATION_ACT] as unknown as { readonly produces: string; readonly readOutput: (ctx: { readonly snapshot: { readonly sharedState: Readonly<Record<string, unknown>> } }) => { readonly ok: boolean; readonly output: { readonly columns: Readonly<Record<string, { readonly type: string }>> } } };
    expect(slot.produces).toBe('columns');
    const read = slot.readOutput({ snapshot: { sharedState: {} } });
    expect(read.output.columns).toEqual({ [CONSERVATION_COLUMN]: { type: 'float' }, [CONSERVATION_BASIS_COLUMN]: { type: 'string' } });
  });
});
