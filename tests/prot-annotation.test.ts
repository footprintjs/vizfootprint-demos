/**
 * THE FUNCTIONAL ANNOTATION STAGE — every value is the source's own word, every
 * word lands on the residue it is about, and a source that named nothing said
 * something.
 *
 * Those three sentences are the whole of what this stage claims, and each one
 * is a way it could quietly become dishonest:
 *
 *   **the words** — a type word re-classified, a description paraphrased, an
 *   absence spelled `"none"`. So every landed value is asserted against what
 *   the service really answered, and the absences are asserted as absences.
 *   **the landing** — a UniProt position read as a PDB residue number. On chain
 *   A of this entry every hop IS the identity, which is exactly what makes it
 *   dangerous, so the pins below are on CHAIN B, where the archive's own
 *   aligned regions say entity 1 sits at reference 2. The hops themselves are
 *   pinned in `tests/prot-mapping.test.ts` and are NOT re-pinned here; what is
 *   new is the annotation landing THROUGH them.
 *   **the answer that named nothing** — `[]` read as a blank, a failure, or a
 *   stage that did not run. So the sentence a source earns for answering and
 *   naming none is pinned byte for byte, and it is asserted to be a different
 *   sentence from any refusal.
 *
 * And the fourth way is the network: the example must work with it unplugged,
 * so the committed path's call count is asserted to be zero.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ANNOTATION_ACT, ANNOTATION_STAGE, EPITOPE_COLUMN, NO_ANNOTATION_EVIDENCE, PFAM_DOMAIN_COLUMN, PROT_STAGES, UNIPROT_NOTE_COLUMN, UNIPROT_SITE_COLUMN, protAnalyses } from '../src/prot/analyses.js';
import { ANNOTATION_URLS, BOND_FEATURES, UNIPROT_ASKED, UNIPROT_SITE_FIELDS, epitopesOf, knownEpitopes, positionsOfSite, uniprotSites, uniprotSitesOf } from '../src/prot/annotation.js';
import { annotationEvidenceFor, annotationFromCommitted, annotationFromServices, noAnnotationReference, nothingKnown } from '../src/prot/annotationEvidence.js';
import { ANNOTATION_SOURCES, NARROWEST, ONE_MEMBER_DATABASE, foldAnnotation, landedNowhere, namedNone } from '../src/prot/annotationFold.js';
import { INTERPRO_URLS } from '../src/prot/family.js';
import { ARCHIVE_URLS } from '../src/prot/archive.js';
import { PROT_ANNOTATION_FILES, SITE_DATA_FILES, annotationFileOf, conservationFileOf } from '../src/data/files.js';
import { annotationProvenance, loadStructureText, readCommittedFile } from '../src/prot/snapshot.js';
import { protTables } from '../src/prot/etl.js';
import { CONSERVATION_COLUMN, CONTACTS_COLUMN, INTERFACE_CONTACTS_COLUMN, RELATIVE_SASA_COLUMN, SASA_COLUMN } from '../src/prot/analyses.js';
import { CONSERVATION_VIEW, INTERFACE_VIEW, KNOWN_VIEW, RESIDUE_KEY, STRUCTURE_VIEW, SURFACE_VIEW } from '../src/prot/def.js';
import { actColumnsOf, chartsOfStage, stepperStages } from '../web/src/protStages.js';
import { buriedSaid } from '../web/src/protCells.js';
import type { Row } from '../web/src/derive.js';
import { emptyFocusSaid } from '../web/src/workbench/panel.js';
import type { ActOutcome } from '../src/prot/orchestrator.js';
import { fakeArchive, type Answer } from './protFixture.js';

const TABLES = protTables(loadStructureText());
const KEYS: readonly string[] = TABLES.residues.map((r) => r.residue_key);

/** The committed example's evidence and its fold — read once, off disk, with no service anywhere near it. */
const evidence = await annotationFromCommitted('1AY7', readCommittedFile);
const fold = foldAnnotation(evidence, KEYS);

/** One residue's value in a folded column, by the key the desk's rows carry. */
const at = (column: readonly (string | null)[], key: string): string | null => column[KEYS.indexOf(key)] ?? null;

// ── the words ────────────────────────────────────────────────────────────────

describe('EVERY VALUE IS THE SOURCE’S OWN WORD, and an absence is an absence', () => {
  it('lands UniProt’s own type word on the two active sites and on BOTH ends of the disulfide', () => {
    expect(at(fold.uniprot_site, 'A:54')).toBe('Active site');
    expect(at(fold.uniprot_site, 'A:85')).toBe('Active site');
    // A BOND IS NOT A RANGE. UniProt spells this one `7..96` and the two numbers
    // are its two ENDS — residues 8 to 95 are not in the bond, and a packet that
    // read the record as a range would have named ninety of them.
    expect(at(fold.uniprot_site, 'A:7')).toBe('Disulfide bond');
    expect(at(fold.uniprot_site, 'A:96')).toBe('Disulfide bond');
    for (const key of ['A:8', 'A:50', 'A:55', 'A:84', 'A:95']) expect(at(fold.uniprot_site, key), `${key} is inside the bond's two ends, not in the bond`).toBeNull();
    // four residues of 185 carry a name, and the rest carry NOTHING — never the
    // word "none" and never an empty string
    expect(fold.counts.sited).toBe(4);
    expect(new Set(fold.uniprot_site.filter((v) => v !== null))).toEqual(new Set(['Active site', 'Disulfide bond']));
  });

  it('lands the description VERBATIM where there is one, and ABSENT where UniProt carries none', () => {
    expect(at(fold.uniprot_note, 'A:54')).toBe('Proton acceptor');
    expect(at(fold.uniprot_note, 'A:85')).toBe('Proton donor');
    // the disulfide record's description is the empty string — so the note is
    // ABSENT on both of its ends while the site word stands
    expect(at(fold.uniprot_note, 'A:7')).toBeNull();
    expect(at(fold.uniprot_note, 'A:96')).toBeNull();
    expect(fold.counts.noted).toBe(2);
  });

  it('never invents a value: a feature with no description reads as no description, not as its own type', () => {
    const read = uniprotSitesOf(JSON.parse(readFileSync(annotationFileOf.uniprot('P05798'), 'utf8')));
    expect(read.accession).toBe('P05798');
    expect(read.sequenceLength).toBe(96);
    expect(read.features.map((f) => `${f.type} ${String(f.from)}..${String(f.to)}`)).toEqual(['Active site 54..54', 'Active site 85..85', 'Disulfide bond 7..96']);
    expect(read.features.map((f) => f.note)).toEqual(['Proton acceptor', 'Proton donor', null]);
  });

  it('knows which features are BONDS and lands only their ends', () => {
    expect(BOND_FEATURES).toEqual(['Disulfide bond', 'Cross-link']);
    expect(positionsOfSite({ type: 'Disulfide bond', note: null, from: 7, to: 96 })).toEqual([7, 96]);
    expect(positionsOfSite({ type: 'Active site', note: 'Proton acceptor', from: 54, to: 54 })).toEqual([54]);
    // every other site feature IS a stretch — a binding site can be three
    // residues long, and all three are in it
    expect(positionsOfSite({ type: 'Binding site', note: 'Mg(2+)', from: 10, to: 12 })).toEqual([10, 11, 12]);
  });
});

// ── the landing, THROUGH the mapping stage 2 built ──────────────────────────

describe('THE LANDING — a reference position is not a residue number, and chain B proves it', () => {
  it('lands the Pfam domain on chain B’s EIGHTY residues, not eighty-one, because entity 1 sits at reference 2', () => {
    /*
      InterPro declares PF01337 over UniProt positions 1..81 of P11540, and the
      archive's own aligned regions say `entity_beg_seq_id 1 ↔ ref_beg_seq_id 2`.
      So UniProt position 1 has NO residue on this desk at all, and the domain
      lands on B:1 … B:80 — shifted by one from where an identity would have put
      it, and one residue shorter.

      THIS IS THE ASSERTION THE PACKET IS ABOUT. `tests/prot-mapping.test.ts`
      already pins the hops; what is new here is an ANNOTATION arriving at the
      right residue through them.
    */
    expect(at(fold.pfam_domain, 'B:1')).toBe('PF01337');
    expect(at(fold.pfam_domain, 'B:80')).toBe('PF01337');
    expect(at(fold.pfam_domain, 'B:81')).toBeNull();
    expect(at(fold.pfam_domain, 'B:89')).toBeNull();
    expect(KEYS.filter((key) => key.startsWith('B:') && at(fold.pfam_domain, key) !== null)).toHaveLength(80);
  });

  it('counts the reference position that lands nowhere rather than dropping it silently', () => {
    // exactly one: UniProt position 1 of P11540, which this construct does not
    // have. `src/prot/etl.ts`'s skip counts are the precedent.
    expect(fold.counts.unmapped).toBe(1);
    expect(landedNowhere(fold.counts)).toContain('1 reference position has no residue on this desk at all');
    expect(landedNowhere(fold.counts)).toContain('a construct is not its reference sequence');
  });

  it('lands chain A’s domain over the range InterPro declared, and nothing outside it', () => {
    for (const key of ['A:5', 'A:50', 'A:92']) expect(at(fold.pfam_domain, key), key).toBe('PF00545');
    for (const key of ['A:1', 'A:2', 'A:3', 'A:4', 'A:93', 'A:94', 'A:95', 'A:96']) expect(at(fold.pfam_domain, key), `${key} is outside 5..92`).toBeNull();
    expect(KEYS.filter((key) => key.startsWith('A:') && at(fold.pfam_domain, key) !== null)).toHaveLength(88);
    expect(fold.counts.domained).toBe(168);
  });

  it('states the overlap rule and the one-member-database argument rather than implying either', () => {
    expect(NARROWEST).toContain('the narrower one wins');
    expect(NARROWEST).toContain('left ABSENT and counted');
    expect(ONE_MEMBER_DATABASE).toContain('IPR000026 and PF00545 — are both 5..92');
    // nothing on THIS entry overlaps, which is why the rule is pinned by its
    // words and by the count rather than by a case the example does not have
    expect(fold.counts.collided).toBe(0);
  });
});

// ── the answer that named nothing ───────────────────────────────────────────

describe('A SERVICE THAT ANSWERED AND NAMED NONE HAS SAID SOMETHING', () => {
  it('lands no epitope on any of the 185 residues, because none are recorded', () => {
    expect(fold.epitope.filter((v) => v !== null)).toEqual([]);
    expect(fold.counts.epitoped).toBe(0);
    expect(fold.counts.unplaced).toBe(0);
  });

  it('records that the service ANSWERED, which is not the same as being unreachable', () => {
    const rows = fold.counts.sources.filter((row) => row.source === ANNOTATION_SOURCES.epitopes);
    expect(rows.map((row) => [row.chain, row.accession, row.answered, row.named, row.refusal])).toEqual([
      ['A', 'P05798', true, 0, null],
      ['B', 'P11540', true, 0, null],
    ]);
  });

  it('says so in a sentence that reads as a FACT and never as a failure', () => {
    expect(namedNone(fold.counts.sources, ANNOTATION_SOURCES.epitopes)).toBe(
      'IEDB was asked about chain A (P05798) and chain B (P11540) and named none — that is an ANSWER about this entry and not a silence: none are recorded, so no residue here carries one.',
    );
    // and it is NOT the sentence an unreachable service earns
    const { doors } = fakeArchive(() => ({ status: 503, body: 'Service Unavailable' }));
    return knownEpitopes('P05798', doors).then((read) => {
      expect(read.ok).toBe(false);
      expect(read.ok ? '' : read.sentence).toContain('so whether any epitope is recorded for that sequence is unknown — which is not the same as none');
    });
  });

  it('is `null` for a source that named something, and `null` for one that never answered', () => {
    // UniProt named three features for chain A, so there is something truer to say
    expect(namedNone(fold.counts.sources, ANNOTATION_SOURCES.sites)).toBeNull();
    const unreached = fold.counts.sources.map((row) => (row.source === ANNOTATION_SOURCES.epitopes ? { ...row, answered: false, named: 0, refusal: 'the door did not open' } : row));
    expect(namedNone(unreached, ANNOTATION_SOURCES.epitopes)).toBeNull();
  });

  it('and chain B’s own empty feature list is an answer too — the stage lands, the chain carries no site', () => {
    const sites = fold.counts.sources.filter((row) => row.source === ANNOTATION_SOURCES.sites);
    expect(sites.map((row) => [row.chain, row.answered, row.named])).toEqual([
      ['A', true, 3],
      ['B', true, 0],
    ]);
    expect(KEYS.filter((key) => key.startsWith('B:') && at(fold.uniprot_site, key) !== null)).toEqual([]);
    // a chain that was ASKED about is never refused, so nothing about chain B is
    // in the refusals
    expect(fold.refusals).toEqual([]);
  });

  it('reads `[]` as none rather than as “not JSON”, at the service and off the committed bytes', async () => {
    expect(epitopesOf(JSON.parse(readFileSync(annotationFileOf.epitopes('P05798'), 'utf8')), 'P05798')).toEqual([]);
    for (const answer of [{ status: 200, body: '[]' }, { status: 204, body: '' }]) {
      const { doors } = fakeArchive(() => answer);
      const read = await knownEpitopes('P05798', doors);
      expect(read.ok).toBe(true);
      expect(read.ok ? read.value : null).toEqual([]);
    }
  });

  it('reads an epitope’s positions off the antigen this desk ASKED about, never off the first one listed', () => {
    // the probed shape carries two curated antigens on one structure; taking the
    // first would place somebody else's protein's epitope on this chain
    const answered = [
      {
        structure_iri: 'IEDB_EPITOPE:497806',
        linear_sequence: 'DAIPENLPPLTADFAEDK',
        curated_source_antigens: [
          { iri: 'GENPEPT:AAI02743.1', starting_position: 319, ending_position: 336 },
          { iri: 'UNIPROT:P05798', starting_position: 10, ending_position: 20 },
        ],
      },
    ];
    expect(epitopesOf(answered, 'P05798')).toEqual([{ id: 'IEDB_EPITOPE:497806', sequence: 'DAIPENLPPLTADFAEDK', from: 10, to: 20 }]);
    // and an epitope recorded with no position at all is counted rather than placed
    const unplaced = foldAnnotation(
      {
        ...evidence,
        chains: evidence.chains.map((chain) => (chain.chain === 'A' ? { ...chain, epitopes: { answered: true, named: [{ id: 'IEDB_EPITOPE:1', sequence: null, from: null, to: null }], refusal: null } } : chain)),
      },
      KEYS,
    );
    expect(unplaced.counts.unplaced).toBe(1);
    expect(unplaced.counts.epitoped).toBe(0);
    expect(landedNowhere(unplaced.counts)).toContain('1 recorded epitope carries no position on this sequence');
  });
});

// ── the refusals, each a sentence ──────────────────────────────────────────

describe('THE REFUSALS — each one a sentence, and one source down is not the desk down', () => {
  it('a chain matched to no UniProt sequence, said by name', () => {
    expect(noAnnotationReference('C')).toBe(
      'chain C is matched to no UniProt sequence in the archive\'s own record, and everything this stage can look up is keyed by one — so nothing is known about chain C here and no residue of it is annotated. Every other chain stands.',
    );
  });

  it('a chain whose every source refused, said by name', () => {
    expect(nothingKnown('B', 'P11540')).toBe(
      'nothing could be read about chain B (P11540): all three of this stage\'s sources were asked and none of them answered, so no residue of chain B is annotated. Every other chain stands.',
    );
  });

  it('a service answering a non-200 names the URL, the status and what it said', async () => {
    const { doors } = fakeArchive(() => ({ status: 500, body: 'upstream exploded' }));
    const read = await uniprotSites('P05798', doors);
    expect(read.ok).toBe(false);
    expect(read.ok ? '' : read.sentence).toBe(
      `the sequence-annotation service at ${ANNOTATION_URLS.uniprot('P05798')} answered 500 for "P05798", so nothing already known about that sequence was read and no residue of its chain is annotated. It said: upstream exploded`,
    );
  });

  it('a service answering HTML is refused before it is parsed, with the first characters quoted', async () => {
    const { doors } = fakeArchive(() => ({ status: 200, body: '<!DOCTYPE html><html><body>503 Service Unavailable</body></html>' }));
    const read = await uniprotSites('P05798', doors);
    expect(read.ok ? '' : read.sentence).toBe(
      `the sequence-annotation service at ${ANNOTATION_URLS.uniprot('P05798')} answered 200 with something that is not JSON — the first characters are "<!DOCTYPE html><html><body>503 Service Unavailable</body></html>". No residue of this chain is annotated.`,
    );
  });

  it('a record for a DIFFERENT accession is refused rather than read onto this chain', async () => {
    const { doors } = fakeArchive(() => ({ status: 200, body: JSON.stringify({ primaryAccession: 'P11540', sequence: { length: 90 }, features: [{ type: 'Active site', location: { start: { value: 1 }, end: { value: 1 } }, description: 'x' }] }) }));
    const read = await uniprotSites('P05798', doors);
    expect(read.ok ? '' : read.sentence).toContain('answered a record for "P11540" and not for "P05798"');
  });

  it('ONE SOURCE DOWN LEAVES THE OTHER TWO STANDING — the desk does not lose a chain to a slow service', async () => {
    const { doors } = fakeArchive((url) => (url.startsWith('https://rest.uniprot.org') ? { status: 503, body: 'down' } : committedOrEmpty(url)));
    const partial = await annotationFromServices('1AY7', doors);
    const folded = foldAnnotation(partial, KEYS);
    // the site column is gone …
    expect(folded.counts.sited).toBe(0);
    // … and the domain column, from a different service, is exactly what it was
    expect(folded.counts.domained).toBe(fold.counts.domained);
    expect(at(folded.pfam_domain, 'B:80')).toBe('PF01337');
    // with the refused source's own sentence on the answer, and no chain refused
    expect(folded.refusals.some((s) => s.includes('answered 503') && s.endsWith('Every other source and every other chain stands.'))).toBe(true);
    expect(partial.chains.map((c) => c.refusal)).toEqual([null, null]);
  });

  it('a def built with no annotation evidence at all lands a refusal rather than reading as a stage nobody ran', () => {
    expect(NO_ANNOTATION_EVIDENCE).toBe(
      'nothing already known about this entry’s sequences was gathered, so no residue carries a site, a domain or an epitope. What is known is read before the dashboard is built — from the files this repository committed for the example, or from the services for any other entry — and this dashboard was built without it.',
    );
    expect(Object.keys(protAnalyses('HEADER', null))).toContain(ANNOTATION_ACT);
  });
});

// ── the committed path, and the network it does not touch ──────────────────

/** The committed bytes, answered at whichever live URL asks for them. */
function committedOrEmpty(url: string): Answer {
  if (url === ARCHIVE_URLS.graphql) return { status: 200, body: readFileSync(conservationFileOf.entities('1AY7'), 'utf8') };
  for (const accession of ['P05798', 'P11540']) {
    if (url === INTERPRO_URLS.matches(accession)) return { status: 200, body: readFileSync(conservationFileOf.matches(accession), 'utf8') };
    if (url === ANNOTATION_URLS.uniprot(accession)) return { status: 200, body: readFileSync(annotationFileOf.uniprot(accession), 'utf8') };
    if (url === ANNOTATION_URLS.epitopes(accession)) return { status: 200, body: readFileSync(annotationFileOf.epitopes(accession), 'utf8') };
  }
  return { status: 404, body: `nothing here: ${url}` };
}

describe('THE EXAMPLE WORKS WITH THE NETWORK UNPLUGGED', () => {
  it('makes NO call at all for the committed entry', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 500, body: 'a service was called, and none should have been' }));
    const read = await annotationEvidenceFor('1AY7', { committed: readCommittedFile, archive: doors });
    expect(calls).toEqual([]);
    expect(read.from).toBe('committed');
    expect(foldAnnotation(read, KEYS).counts.sited).toBe(4);
  });

  it('routes any OTHER entry to the live services rather than to the example’s files', async () => {
    const { doors, calls } = fakeArchive(() => ({ status: 404, body: 'no such entry' }));
    const other = await annotationEvidenceFor('4HHB', { committed: readCommittedFile, archive: doors });
    expect(other.from).toBe('live');
    expect(calls).toEqual([ARCHIVE_URLS.graphql]);
    expect(other.refusals[0]).toContain('the archive\'s entity records for "4HHB" answered 404');
  });

  it('the live door and the committed files fold the same columns', async () => {
    const { doors, calls } = fakeArchive(committedOrEmpty);
    const live = await annotationFromServices('1AY7', doors);
    // the entity record first, then the three sources per accession — and the
    // Pfam door is the CONSERVATION stage's, reused rather than opened twice
    expect(calls[0]).toBe(ARCHIVE_URLS.graphql);
    expect(calls).toContain(INTERPRO_URLS.matches('P05798'));
    expect(calls).toContain(ANNOTATION_URLS.uniprot('P05798'));
    expect(calls).toContain(ANNOTATION_URLS.epitopes('P05798'));
    // one read per accession per source, whatever the chain count
    expect(calls).toHaveLength(1 + 2 * 3);
    const folded = foldAnnotation(live, KEYS);
    expect([folded.counts.sited, folded.counts.noted, folded.counts.domained, folded.counts.epitoped, folded.counts.unmapped]).toEqual([
      fold.counts.sited,
      fold.counts.noted,
      fold.counts.domained,
      fold.counts.epitoped,
      fold.counts.unmapped,
    ]);
  });
});

describe('the committed files travel with the build, with their provenance', () => {
  it('mints exactly the four names that are committed, and the static build copies every one', () => {
    expect(PROT_ANNOTATION_FILES).toEqual([
      'data/prot/annotation/P05798-uniprot.json',
      'data/prot/annotation/P11540-uniprot.json',
      'data/prot/annotation/P05798-epitopes.json',
      'data/prot/annotation/P11540-epitopes.json',
    ]);
    for (const file of PROT_ANNOTATION_FILES) {
      // `[]` is three bytes and is a real answer, so this one is asserted to
      // EXIST rather than to be long
      expect(readFileSync(file, 'utf8').length, `${file} is not committed`).toBeGreaterThan(0);
      expect(SITE_DATA_FILES, `${file} is not copied into the static site`).toContain(file);
    }
    expect(SITE_DATA_FILES).toContain('data/prot/annotation/PROVENANCE.json');
  });

  it('names the service, the URL, the date and the licence for each one, over the bytes it recorded', () => {
    const record = annotationProvenance() as {
      readonly retrievedAt: string;
      readonly uniprot: { readonly service: string; readonly at: string; readonly asked: readonly string[]; readonly license: Readonly<Record<string, string>>; readonly files: readonly { readonly file: string; readonly bytes: number; readonly sha256: string }[] };
      readonly epitopes: { readonly service: string; readonly at: string; readonly answered: string; readonly license: Readonly<Record<string, string>>; readonly files: readonly { readonly file: string; readonly bytes: number; readonly sha256: string; readonly epitopes: number }[] };
      readonly reused: { readonly files: readonly string[]; readonly why: string };
    };
    expect(new Date(record.retrievedAt).getFullYear()).toBeGreaterThan(2000);
    for (const part of [record.uniprot, record.epitopes]) {
      expect(part.service).toBeTruthy();
      expect(part.at).toBeTruthy();
      expect(part.license['policyPage']).toBeTruthy();
      expect(part.license['statement']).toBeTruthy();
      for (const file of part.files) {
        const bytes = readFileSync(new URL(`../data/prot/annotation/${file.file}`, import.meta.url));
        expect(bytes).toHaveLength(file.bytes);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
      }
    }
    // the fields asked for are the ones the code asks for — the committed bytes
    // and a live read may not be answers to two different questions
    expect(record.uniprot.asked).toEqual([...UNIPROT_ASKED]);
    // ZERO IS RECORDED AS AN ANSWER
    expect(record.epitopes.files.map((f) => f.epitopes)).toEqual([0, 0]);
    expect(record.epitopes.answered).toContain('asked and named none');
    // and the two reads this stage does NOT download are pointed at rather than copied
    expect(record.reused.files).toEqual(['../conservation/1AY7-entities.json', '../conservation/<ACCESSION>-pfam.json']);
    expect(record.reused.why).toContain('A second copy would be a second answer to one question');
  });
});

// ── the stage, as the def and the plan now carry it ────────────────────────

describe('the stage the def now dispatches, and the step the plan no longer blocks', () => {
  it('is dispatched FOURTH though the plan publishes it sixth, with one act and the intent the ledger will carry', () => {
    const stage = PROT_STAGES.find((s) => s.stage === ANNOTATION_STAGE)!;
    /*
      FOURTH IN DISPATCH ORDER, SIXTH IN THE PLAN — and the position is pinned
      from both sides, because two laws meet on it and only one slot satisfies
      both. It has to be BEFORE the surface stage, or its own bar becomes the
      desk's opening picture (the commit at the head is what the desk opens
      focused on). And it has to be AFTER the interactions stage, or the column
      its picture borrows for a HEIGHT has not landed by the time its own commit
      is the cursor — which is exactly what happened when it was dispatched
      second, and what `tests/prot-progression.test.ts` now refuses.
      `src/prot/analyses.ts` · `PROT_STAGES` carries the whole argument.
    */
    expect(PROT_STAGES.map((s) => s.stage)).toEqual(['conservation', 'interactions', ANNOTATION_STAGE, 'surface']);
    expect(PROT_STAGES[PROT_STAGES.length - 1]!.stage).toBe('surface');
    expect(stage.label).toBe('What is already known about each residue');
    expect(stage.acts.map((a) => a.id)).toEqual([ANNOTATION_ACT]);
    expect(stage.acts[0]!.intent).toContain('ask what is already known');
    expect(stage.acts[0]!.intent).toContain('the source\'s own word, never re-classified');
  });

  it('declares ONLY the columns it wrote — so a service that named none is not reported as a gap', () => {
    const slot = protAnalyses('HEADER', null, null, null)[ANNOTATION_ACT] as unknown as {
      readonly produces: string;
      readonly honesty: { readonly notes: string };
      readonly readOutput: (ctx: { readonly snapshot: { readonly sharedState: Readonly<Record<string, unknown>> } }) => { readonly output: { readonly columns: Readonly<Record<string, { readonly type: string }>> } };
    };
    expect(slot.produces).toBe('columns');
    // nothing written: nothing declared, and the session then refuses a read of
    // each column by name exactly as it does for an act that threw
    expect(slot.readOutput({ snapshot: { sharedState: {} } }).output.columns).toEqual({});
    // THE COMMITTED ENTRY'S SHAPE: three columns, and `epitope` is not one of
    // them because the service answered and named none
    const written = slot.readOutput({ snapshot: { sharedState: { [UNIPROT_SITE_COLUMN]: fold.uniprot_site, [UNIPROT_NOTE_COLUMN]: fold.uniprot_note, [PFAM_DOMAIN_COLUMN]: fold.pfam_domain } } });
    expect(Object.keys(written.output.columns)).toEqual([UNIPROT_SITE_COLUMN, UNIPROT_NOTE_COLUMN, PFAM_DOMAIN_COLUMN]);
    expect(Object.keys(written.output.columns)).not.toContain(EPITOPE_COLUMN);
  });

  it('says in its honesty note which fields were asked for, so an absent kind of site reads as nobody asked', () => {
    const slot = protAnalyses('HEADER', null, null, null)[ANNOTATION_ACT] as unknown as { readonly honesty: { readonly notes: string } };
    expect(slot.honesty.notes).toContain('NOTHING HERE IS COMPUTED AND NOTHING IS RE-WORDED');
    for (const field of UNIPROT_SITE_FIELDS) expect(slot.honesty.notes).toContain(field);
    expect(slot.honesty.notes).toContain('An absent type means nobody asked');
    expect(slot.honesty.notes).toContain(NARROWEST);
    expect(slot.honesty.notes).toContain('A source that was asked and named none is an ANSWER');
  });
});

// ── the picture, and the press ─────────────────────────────────────────────

describe('THE PRESS ON STEP 6 PROMOTES STAGE 6’S OWN PICTURE', () => {
  /** A run in which every stage landed, as the stepper's fold takes it. */
  const OUTCOMES: readonly ActOutcome[] = [
    { stage: 'conservation', act: 'residueConservation', commit: 'c0', refusal: null, materialized: ['conservation', 'conservation_basis'] },
    { stage: 'interactions', act: 'residueContacts', commit: 'c2', refusal: null, materialized: [CONTACTS_COLUMN, INTERFACE_CONTACTS_COLUMN] },
    { stage: 'surface', act: 'residueSurface', commit: 'c3', refusal: null, materialized: [SASA_COLUMN, RELATIVE_SASA_COLUMN] },
    { stage: ANNOTATION_STAGE, act: ANNOTATION_ACT, commit: 'c5', refusal: null, materialized: [UNIPROT_SITE_COLUMN, UNIPROT_NOTE_COLUMN, PFAM_DOMAIN_COLUMN] },
  ];
  /** The encoding fold the real def declares, as the session serves it at the head. */
  const SHOWN = {
    [STRUCTURE_VIEW]: { color: 'chain' },
    [CONSERVATION_VIEW]: { x: 'resnum', y: CONSERVATION_COLUMN, color: 'chain' },
    [INTERFACE_VIEW]: { category: RESIDUE_KEY, y: INTERFACE_CONTACTS_COLUMN },
    [SURFACE_VIEW]: { x: 'resnum', y: SASA_COLUMN, color: 'chain' },
    [KNOWN_VIEW]: { category: RESIDUE_KEY, y: CONTACTS_COLUMN, color: UNIPROT_SITE_COLUMN },
  } as const;
  const stages = stepperStages(OUTCOMES, null);
  const columns = actColumnsOf(stages);
  const six = stages.find((s) => s.stage === ANNOTATION_STAGE)!;

  it('is step 6, it landed, and it OWNS the picture that binds its column', () => {
    expect(six.number).toBe(6);
    expect(six.state).toBe('landed');
    expect(six.blockedBy).toBe(null);
    expect(chartsOfStage(six, SHOWN, columns, stages)).toEqual([KNOWN_VIEW]);
  });

  it('and the INTERACTIONS stage does not own it, because a picture drawn from two stages belongs to the LATER one', () => {
    /*
      This chart's HEIGHT is `contacts`, which stage 4 landed, and its COLOUR is
      `uniprot_site`, which stage 6 did. Left alone the fold would have answered
      *whichever stage matched first* — stage 4's name on stage 6's card, and the
      stepper's bar moving to stage 4 when a reader pressed 6. The law is
      `web/src/protStages.ts` · `chartsOfStage`'s, taught by stage 5's chart;
      this is the second picture it applies to, which is what makes it a law
      rather than a special case.

      AND ITS OTHER HALF, which this chart taught: the borrowed column has to
      land EARLIER. `contacts` does; `relative_sasa` did not, and the picture
      was empty at its own cursor until it was rebound
      (`tests/prot-progression.test.ts` pins that, on real rows at a real
      cursor).
    */
    const four = stages.find((s) => s.stage === 'interactions')!;
    expect(chartsOfStage(four, SHOWN, columns, stages)).toEqual([INTERFACE_VIEW]);
    expect(chartsOfStage(four, SHOWN, columns, stages)).not.toContain(KNOWN_VIEW);
  });

  it('a reader who UNBINDS the site word gives the picture back to stage 3 — the intersection follows a re-encode', () => {
    const rebound = { ...SHOWN, [KNOWN_VIEW]: { category: RESIDUE_KEY, y: CONTACTS_COLUMN, color: 'chain' } };
    expect(chartsOfStage(six, rebound, columns, stages)).toEqual([]);
    expect(chartsOfStage(stages.find((s) => s.stage === 'interactions')!, rebound, columns, stages)).toContain(KNOWN_VIEW);
  });

  it('so NO READER MEETS THE EMPTY-FOCUS SENTENCE on a working desk — and the sentence still exists for a stage with no picture', () => {
    /*
      `emptyFocusSaid` was kept expressly for the day this stage landed
      (`src/prot/def.ts` · `RANKING_VIEW` says so in as many words). Stage 6 has
      a picture, so a press on it promotes one and the sentence is `null` — and
      the sentence itself is NOT deleted, because the next stage whose columns
      no chart takes up will need it. Both halves, asserted.
    */
    expect(emptyFocusSaid(six, chartsOfStage(six, SHOWN, columns, stages))).toBe(null);
    // EVERY STAGE THAT LANDED owns a picture, so none of them can reach the
    // sentence. Step 5 is excluded because it is not a landed stage on the
    // published build at all: its press promotes its blocked CARD, which is a
    // different branch and has its own words.
    for (const stage of stages.filter((s) => s.state === 'landed')) {
      expect(emptyFocusSaid(stage, chartsOfStage(stage, SHOWN, columns, stages)), `${stage.stage} has no picture to promote`).toBe(null);
    }
    // …and it still answers for a stage that landed columns nothing binds
    const said = emptyFocusSaid(six, []);
    expect(said).toContain('the cursor moved to stage 6, Functional Annotation');
    expect(said).toContain(UNIPROT_SITE_COLUMN);
    expect(said).toContain('no picture on this desk is bound to any of them');
  });
});

// ── the pairing, as a sentence ─────────────────────────────────────────────

describe('THE BURIAL PAIRING IS A SENTENCE, because it cost a blank chart to be a height', () => {
  /** The rows of the committed entry as the desk holds them at the head, with both columns on. */
  const ROWS: readonly Row[] = TABLES.residues.map((row, at) => ({
    ...row,
    uniprot_site: fold.uniprot_site[at],
    relative_sasa: row.residue_key === 'A:85' ? 0 : row.residue_key === 'A:54' ? 0.04 : row.residue_key === 'A:7' ? 0.31 : row.residue_key === 'A:96' ? 0.45 : 0.5,
  })) as unknown as readonly Row[];

  it('names the most buried of the named residues, in the source’s own word, and counts them', () => {
    expect(buriedSaid(ROWS, 'residue_key', UNIPROT_SITE_COLUMN)).toBe(
      'AND THE PAIRING THIS STAGE IS FOR, off the same rows: the most buried of the 4 named residues is A:85, which UniProt calls an active site — and the solvent cannot reach it at all. ' +
        'The annotation and the exposure land on the SAME KEY, which is the only reason that sentence can be said at all',
    );
  });

  it('takes the article the source’s own word earns, and never re-words the word', () => {
    const disulfideOnly = ROWS.map((row) => (row['residue_key'] === 'A:7' ? { ...row, relative_sasa: 0.01 } : { ...row, uniprot_site: row['residue_key'] === 'A:7' ? row['uniprot_site'] : null }));
    expect(buriedSaid(disulfideOnly, 'residue_key', UNIPROT_SITE_COLUMN)).toContain('which UniProt calls a disulfide bond');
  });

  it('quotes the exposure where it is not zero, rather than saying nothing can reach it', () => {
    const shallow = ROWS.map((row) => (typeof row['uniprot_site'] === 'string' ? { ...row, relative_sasa: 0.421 } : row));
    expect(buriedSaid(shallow, 'residue_key', UNIPROT_SITE_COLUMN)).toContain("with 42.1% of its type's published maximum reachable");
  });

  it('is ABSENT where either column is missing — which is how it degrades at an earlier cursor', () => {
    /*
      THE HONEST HALF. At stage 6's own commit the surface stage has not landed,
      so there is no exposure to compare and no *most buried* to name. A sentence
      there would be an invention, and this is the case the height could not
      degrade into — it drew nothing instead, which is the defect this fold
      exists because of.
    */
    expect(buriedSaid(ROWS.map(({ relative_sasa: _drop, ...rest }) => rest as unknown as Row), 'residue_key', UNIPROT_SITE_COLUMN)).toBeNull();
    expect(buriedSaid(ROWS.map((row) => ({ ...row, uniprot_site: null })), 'residue_key', UNIPROT_SITE_COLUMN)).toBeNull();
    expect(buriedSaid([], 'residue_key', UNIPROT_SITE_COLUMN)).toBeNull();
  });
});
