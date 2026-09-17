/**
 * STAGE A'S NUMBERS, CHECKED AGAINST THE FILE'S OWN COORDINATES.
 *
 * ── WHAT THIS FILE DOES AND DOES NOT CLAIM ──────────────────────────────────
 * **Not one number here is quoted from a paper.** The engine reports a contact
 * and a separation; this file goes back to the committed entry, finds the atom
 * records the contact names, and recomputes the distance with its OWN
 * arithmetic — {@link atomsAt} reads the fixed columns and {@link separation}
 * is four lines of Pythagoras. Three hydrogen bonds are checked that way, and
 * so is the ring-to-ring stacking distance, which is the harder one: its value
 * is a distance between two CENTROIDS, so the check averages five and six atom
 * positions out of the file before it subtracts.
 *
 * `atomsAt` is deliberately NOT `src/prot/etl.ts`'s parser. A verification that
 * reads its subject's own reader proves the two agree about a format and
 * nothing about a number.
 *
 * ── AND THE TOLERANCE, measured rather than guessed ─────────────────────────
 * Mol* holds coordinates and feature centres in `Float32Array`s, so the engine's
 * arithmetic carries about seven significant digits where this file's carries
 * sixteen. The four deltas come out at 3.7e-9, 2.2e-7, 2.6e-7 and 3.4e-7 Å, so
 * every assertion below allows 1e-6 Å — three orders of magnitude tighter than
 * the last digit the file itself publishes (coordinates are given to 0.001 Å).
 */
import { describe, expect, it } from 'vitest';
import { entryId, protTables } from '../src/prot/etl.js';
import { loadStructureText } from '../src/prot/snapshot.js';
import { headlessEntry } from '../src/prot/molstar.js';
import { SYMMETRY_REFUSAL, interactionKey, interactionProviders, protInteractions, residueContactColumns, type InteractionRow } from '../src/prot/interactions.js';
import { INTERACTION_COLUMNS } from '../src/prot/analyses.js';

const TEXT = loadStructureText();
const TABLES = protTables(TEXT);
const KEYS = TABLES.residues.map((r) => r.residue_key);

/** How close two Ångström figures must be to count as the same number — see the file header. */
const TOLERANCE = 1e-6;

/** A point in the file's own frame. */
type Point = readonly [number, number, number];

/**
 * EVERY `ATOM` RECORD of the committed entry matching one chain, residue number,
 * atom name and alternate location — read from the legacy format's fixed
 * columns, here, and by nothing this file is testing.
 */
function atomsAt(chain: string, resnum: number, atom: string, altLoc = ''): readonly Point[] {
  return TEXT.split('\n')
    .filter((line) => line.startsWith('ATOM'))
    .filter((line) => line.slice(21, 22) === chain && Number(line.slice(22, 26)) === resnum && line.slice(12, 16).trim() === atom && line.slice(16, 17).trim() === altLoc)
    .map((line) => [Number(line.slice(30, 38)), Number(line.slice(38, 46)), Number(line.slice(46, 54))] as Point);
}

/**
 * THE ONE atom record matching — and a failure, not a guess, when the file holds
 * none or several.
 *
 * `altLoc` is an ARGUMENT and its default is the blank column, because the
 * ambiguity is real: four interface residues of this entry publish two positions
 * for the same atom, and a check that silently took the first would be checking
 * its own choice. Where a contact runs through one of them the caller NAMES the
 * location it means, which is also the honest reading of what the engine did.
 */
function atomAt(chain: string, resnum: number, atom: string, altLoc = ''): Point {
  const found = atomsAt(chain, resnum, atom, altLoc);
  expect(found, `${chain}:${String(resnum)} ${atom} should appear exactly once at alternate location "${altLoc}"`).toHaveLength(1);
  return found[0]!;
}

/** Pythagoras, in three dimensions — this file's own arithmetic. */
const separation = (a: Point, b: Point): number => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

/** The mean position of some atoms — what a feature's centre is, when the feature has more than one. */
const centre = (points: readonly Point[]): Point => [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length, points.reduce((s, p) => s + p[2], 0) / points.length];

/** The contacts of the committed entry, computed once for the whole file. */
async function contacts(): Promise<{ readonly rows: readonly InteractionRow[]; readonly byKey: ReadonlyMap<string, InteractionRow>; readonly counts: Awaited<ReturnType<typeof protInteractions>>['counts']; readonly dropped: Awaited<ReturnType<typeof protInteractions>>['dropped'] }> {
  const entry = await headlessEntry(TEXT, entryId(TEXT));
  const found = await protInteractions(entry, KEYS);
  return { rows: found.interactions, byKey: new Map(found.interactions.map((r) => [r.interaction_key, r])), counts: found.counts, dropped: found.dropped };
}

describe('the contacts, recomputed from the committed coordinates', () => {
  it('reports three interface hydrogen bonds at the distance this file measures between their own atom records', async () => {
    const { byKey } = await contacts();
    // Three contacts across the two chains, chosen because both of their atoms
    // appear exactly once in the file: an arginine and an aspartate, a histidine
    // and the same aspartate's other oxygen, and a glutamate accepting from a
    // leucine's backbone nitrogen — the last one with the DONOR on chain B, which
    // is why the endpoint order carries no direction (src/prot/interactions.ts).
    const checks = [
      { key: interactionKey('A:65', 'B:39', 0), a: ['A', 65, 'NH1'], b: ['B', 39, 'OD1'], feature: ['hydrogen donor', 'hydrogen acceptor'] },
      { key: interactionKey('A:85', 'B:39', 0), a: ['A', 85, 'NE2'], b: ['B', 39, 'OD2'], feature: ['hydrogen donor', 'hydrogen acceptor'] },
      { key: interactionKey('A:41', 'B:34', 0), a: ['A', 41, 'OE2'], b: ['B', 34, 'N'], feature: ['hydrogen acceptor', 'hydrogen donor'] },
    ] as const;
    for (const check of checks) {
      const row = byKey.get(check.key);
      expect(row, `the engine should report ${check.key}`).toBeDefined();
      expect([row?.kind, row?.crosses_chains]).toEqual(['hydrogen bond', true]);
      // the row names the atoms, which is what makes the number checkable at all
      expect([row?.atom_a, row?.atom_b]).toEqual([check.a[2], check.b[2]]);
      expect([row?.atoms_a, row?.atoms_b]).toEqual([1, 1]);
      // the DIRECTION the contact itself does not carry: the engine knows it about
      // the FEATURES, and this is where the row puts it
      expect([row?.feature_a, row?.feature_b]).toEqual([...check.feature]);
      // THE ARITHMETIC: the file's two records, subtracted here
      const mine = separation(atomAt(check.a[0], check.a[1], check.a[2]), atomAt(check.b[0], check.b[1], check.b[2]));
      expect(Math.abs((row?.separation ?? 0) - mine)).toBeLessThan(TOLERANCE);
      // and the value is a real hydrogen bond's length rather than an artefact of
      // the check — between 2.5 and 3.5 Å, which is the window the engine's own
      // `distanceMax` allows and this file's own measurement lands in
      expect(mine).toBeGreaterThan(2.5);
      expect(mine).toBeLessThan(3.5);
    }
  });

  it('reports the one ring-to-ring stacking at the distance between the two rings’ centroids, averaged here out of eleven atom records', async () => {
    const { byKey, rows } = await contacts();
    const stacking = rows.filter((r) => r.kind === 'pi stacking' && r.crosses_chains);
    expect(stacking).toHaveLength(1);
    const row = byKey.get(interactionKey('A:85', 'B:29', 0));
    expect(row?.kind).toBe('pi stacking');
    // FIVE ATOMS AND SIX: a histidine's imidazole and a tyrosine's phenol ring.
    // The counts are the engine's own (`atoms_a`/`atoms_b`), and they are what
    // tells this check which atoms to average — a check that chose the ring atoms
    // itself would be checking its own chemistry.
    expect([row?.atoms_a, row?.atoms_b]).toEqual([5, 6]);
    expect([row?.feature_a, row?.feature_b]).toEqual(['aromatic ring', 'aromatic ring']);
    const his = ['CG', 'ND1', 'CD2', 'CE1', 'NE2'].map((atom) => atomAt('A', 85, atom));
    const tyr = ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'].map((atom) => atomAt('B', 29, atom));
    expect([his, tyr].map((r) => r.length)).toEqual([5, 6]);
    const mine = separation(centre(his), centre(tyr));
    expect(Math.abs((row?.separation ?? 0) - mine)).toBeLessThan(TOLERANCE);
    // and the centroid separation is NOT the atom separation — 5.33 Å against a
    // closest approach nearer than that. This is the assertion behind the
    // `separation` column's own sentence: the two numbers differ, so which one the
    // column carries has to be said rather than assumed.
    const closest = Math.min(...his.flatMap((h) => tyr.map((t) => separation(h, t))));
    expect(closest).toBeLessThan(mine);
  });

  it('counts the contacts that cross the two chains — the interface, which is what this desk is about', async () => {
    const { rows, counts } = await contacts();
    expect(counts.crossing).toBe(21);
    expect(rows.filter((r) => r.crosses_chains)).toHaveLength(21);
    // every crossing contact really does have one end in each chain, checked off
    // the minted keys rather than off the flag that claims it
    for (const row of rows.filter((r) => r.crosses_chains)) {
      expect(new Set([row.residue_a.split(':')[0], row.residue_b.split(':')[0]])).toEqual(new Set(['A', 'B']));
    }
    // 18 residues are in the interface at all, nine from each chain — counted,
    // never described, and a smaller number than the 21 contacts because several
    // residues make more than one
    const residues = new Set(rows.filter((r) => r.crosses_chains).flatMap((r) => [r.residue_a, r.residue_b]));
    expect(residues.size).toBe(18);
    expect([...residues].filter((k) => k.startsWith('A:')).length).toBe(9);
    expect([...residues].filter((k) => k.startsWith('B:')).length).toBe(9);
  });

  it('accounts for every contact the engine reported: 224 rows and 317 drops make 541, each drop with its reason', async () => {
    const { counts, dropped } = await contacts();
    expect(counts.reported).toBe(541);
    expect(counts.rows).toBe(224);
    expect(dropped.reduce((total, d) => total + d.contacts, 0) + counts.rows).toBe(counts.reported);
    // the classes, in the shape `src/prot/etl.ts` · skippedOf established: every
    // one listed whatever its count, because a class with a count of zero still
    // says the enumeration looked
    expect(dropped.map((d) => [d.reason, d.contacts])).toEqual([
      ['filtered-by-the-engine', 0],
      ['water-or-hetero-end', 317],
      ['end-has-no-row', 0],
    ]);
    for (const drop of dropped) expect(drop.why.length).toBeGreaterThan(60);
    // and the whole entry's contacts are three kinds under the providers the
    // engine has on — a count, not a claim about what exists
    expect(counts.byKind).toEqual([
      { kind: 'hydrogen bond', contacts: 220 },
      { kind: 'pi stacking', contacts: 3 },
      { kind: 'cation-pi interaction', contacts: 1 },
    ]);
    expect(counts.byKind.reduce((total, k) => total + k.contacts, 0)).toBe(counts.rows);
  });

  it('reads which providers the engine has on, and never sets them', async () => {
    const { counts } = await contacts();
    // Mol*'s own defaults, as of the installed version. PINNED so that an upgrade
    // which turns a provider on or off fails a test rather than silently changing
    // what every caption on this desk means.
    expect(counts.providersOn).toEqual(['cation-pi', 'halogen-bonds', 'hydrogen-bonds', 'metal-coordination', 'pi-stacking']);
    expect(counts.providersOff).toEqual(['hydrophobic', 'ionic', 'weak-hydrogen-bonds']);
    // no contact of a kind nobody asked for can be in the table
    expect(counts.byKind.some((k) => k.kind === 'hydrophobic contact' || k.kind === 'ionic')).toBe(false);
    // and the reader is a pure fold over the engine's declaration, with no list of
    // provider names of its own
    expect(interactionProviders({ a: { name: 'on' }, b: { name: 'off' }, c: { name: 'on' } })).toEqual({ on: ['a', 'c'], off: ['b'] });
  });

  it('names the whole taxonomy the `kind` column could ever carry, against the engine’s own enum', async () => {
    const { interactionTypeLabel, InteractionType } = await import('molstar/lib/mol-model-props/computed/interactions/common.js');
    const words = Object.values(InteractionType)
      .filter((v): v is number => typeof v === 'number')
      .map((type) => interactionTypeLabel(type).toLowerCase());
    expect(words).toHaveLength(10);
    expect(words).toEqual(['unknown interaction', 'ionic interaction', 'cation-pi interaction', 'pi stacking', 'hydrogen bond', 'halogen bond', 'hydrophobic contact', 'metal coordination', 'weak hydrogen bond', 'water bridge']);
    const meaning = INTERACTION_COLUMNS.find((c) => c.name === 'kind')?.meaning ?? '';
    // EVERY word the engine can produce is named where the column is declared. A
    // Mol* upgrade that adds a kind fails here, which is the point: a vocabulary
    // the def does not name is a word a reader cannot tell from an absence.
    for (const word of words) expect(meaning, `the kind column's meaning should name "${word}"`).toContain(word);

    // THE FEATURE WORDS TOO, and their spelling is the engine's rather than
    // English: `hydrophobicatom` really has no space in it. Echoed as published,
    // because a word this desk tidied up would be a word a reader could not grep
    // for in Mol*.
    const { featureTypeLabel, FeatureTypes } = await import('molstar/lib/mol-model-props/computed/interactions/common.js');
    const features = Object.values(FeatureTypes)
      .filter((v): v is number => typeof v === 'number')
      .map((type) => featureTypeLabel(type).toLowerCase());
    const featureMeaning = INTERACTION_COLUMNS.find((c) => c.name === 'feature_a')?.meaning ?? '';
    for (const word of features) expect(featureMeaning, `the feature column's meaning should name "${word}"`).toContain(word);
  });

  it('mints one key per contact, and the ordinal is what keeps two contacts between one pair apart', async () => {
    const { rows, byKey } = await contacts();
    expect(byKey.size).toBe(rows.length);
    expect(interactionKey('A:40', 'B:76', 3)).toBe('A:40|B:76|3');
    // THE AMBIGUOUS PAIR, which is why an ordinal is not decoration: a threonine
    // hydroxyl and a tyrosine hydroxyl are each both a donor and an acceptor, so
    // with no hydrogens in the file the engine reports the contact in BOTH
    // directions — two rows, the same two atoms, the same separation to the last
    // digit, told apart only by which end it calls the donor.
    const pair = rows.filter((r) => r.residue_a === 'A:64' && r.residue_b === 'B:29');
    expect(pair).toHaveLength(2);
    expect(pair.map((r) => r.interaction_key)).toEqual(['A:64|B:29|0', 'A:64|B:29|1']);
    expect(pair[0]?.separation).toBe(pair[1]?.separation);
    expect([pair[0]?.atom_a, pair[0]?.atom_b]).toEqual([pair[1]?.atom_a, pair[1]?.atom_b]);
    expect([pair[0]?.feature_a, pair[1]?.feature_a]).toEqual(['hydrogen acceptor', 'hydrogen donor']);
    // and that separation is the one this file measures between those two records
    const mine = separation(atomAt('A', 64, 'OG1'), atomAt('B', 29, 'OH'));
    expect(Math.abs((pair[0]?.separation ?? 0) - mine)).toBeLessThan(TOLERANCE);
    // FOUR CONTACTS between one arginine and one glutamate, which is the other
    // reason: a bidentate salt-bridge geometry is several hydrogen bonds through
    // several pairs of atoms, and they have four different lengths
    const bidentate = rows.filter((r) => r.residue_a === 'A:40' && r.residue_b === 'B:76');
    expect(bidentate).toHaveLength(4);
    expect(new Set(bidentate.map((r) => r.separation)).size).toBe(4);
  });

  it('counts the contacts that run through an atom the residues table never kept — the two parses’ one disagreement', async () => {
    const { counts } = await contacts();
    // Mol* keeps every alternate location; `src/prot/etl.ts` keeps the first and
    // counts the rest as skipped. So 15 kept contacts run through an atom that is
    // not on any row of the table — the RESIDUE still has a row, so nothing is
    // orphaned, but the two parses disagree about how many atoms it has and this
    // is the count of where.
    expect(counts.throughAlternateLocation).toBe(15);
    expect(TABLES.skipped.find((s) => s.reason === 'alternate-location')?.records).toBeGreaterThan(0);
  });

  it('refuses a structure whose symmetry mates the minted key cannot tell apart, by name', () => {
    // Not reachable with the committed entry — it has one unit per symmetry group
    // — so the sentence is pinned rather than provoked, and it names the key and
    // what would go wrong.
    expect(SYMMETRY_REFUSAL).toContain('symmetry group with more than one unit');
    expect(SYMMETRY_REFUSAL).toContain('"<chain>:<resnum>"');
    expect(SYMMETRY_REFUSAL).toContain('No interaction table was landed');
  });
});

describe('the residue-grain fold — stage A’s columns', () => {
  it('lands three columns aligned to the table, and every contact is counted once for each of its two ends', async () => {
    const { rows, counts } = await contacts();
    const columns = residueContactColumns(KEYS, rows);
    expect([columns.contacts.length, columns.interface_contacts.length, columns.interface_separation.length]).toEqual([KEYS.length, KEYS.length, KEYS.length]);
    // TWO ENDS PER CONTACT, and the committed entry has no contact whose two ends
    // are the same residue — so the sums are exactly twice the row counts, and
    // that is an arithmetic check on the fold rather than a restated number
    expect(rows.filter((r) => r.residue_a === r.residue_b)).toHaveLength(0);
    expect(columns.contacts.reduce((a, b) => a + b, 0)).toBe(2 * counts.rows);
    expect(columns.interface_contacts.reduce((a, b) => a + b, 0)).toBe(2 * counts.crossing);
  });

  it('leaves the tightest crossing separation ABSENT — never zero — for a residue that touches no other chain', async () => {
    const { rows } = await contacts();
    const columns = residueContactColumns(KEYS, rows);
    const touching = columns.interface_contacts.filter((n) => n > 0).length;
    expect(touching).toBe(18);
    // the absence and the zero are the same residues, seen from two columns
    expect(columns.interface_separation.filter((v) => v === null)).toHaveLength(KEYS.length - touching);
    for (const [i, value] of columns.interface_separation.entries()) expect(value === null).toBe(columns.interface_contacts[i] === 0);
    // and not one of them is a zero pretending to be a distance
    expect(columns.interface_separation.some((v) => v === 0)).toBe(false);
  });

  it('gives the interface’s busiest residue its own six contacts, and its tightest is the one this file measures', async () => {
    const { rows } = await contacts();
    const columns = residueContactColumns(KEYS, rows);
    const at = KEYS.indexOf('A:40');
    expect(at).toBeGreaterThanOrEqual(0);
    // one arginine makes six of the twenty-one crossing contacts
    expect(columns.interface_contacts[at]).toBe(6);
    expect(columns.contacts[at]).toBe(6);
    // AND ITS TIGHTEST IS ONE OF THE FIFTEEN THAT RUN THROUGH AN ALTERNATE
    // LOCATION, which is why this check names the location rather than the atom:
    // the glutamate publishes its OE1 twice, at half occupancy each, and the
    // engine took the first — the one the residues table's own parse also kept.
    // Both positions are in the file; a check that averaged them would be
    // inventing a third.
    expect(atomsAt('B', 76, 'OE1', '')).toHaveLength(0);
    expect([atomsAt('B', 76, 'OE1', 'A'), atomsAt('B', 76, 'OE1', 'B')].map((r) => r.length)).toEqual([1, 1]);
    const mine = separation(atomAt('A', 40, 'NH1'), atomAt('B', 76, 'OE1', 'A'));
    expect(Math.abs((columns.interface_separation[at] ?? 0) - mine)).toBeLessThan(TOLERANCE);
    // A BURIED RESIDUE CAN BE A BUSY ONE: the histidine whose surface area stage B
    // measures as exactly zero (tests/prot-surface.test.ts) makes four of these
    // contacts, which is the two stages telling one story.
    expect(columns.interface_contacts[KEYS.indexOf('A:85')]).toBe(4);
  });
});
