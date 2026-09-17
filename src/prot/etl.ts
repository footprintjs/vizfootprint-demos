/**
 * ETL — one PDB entry, shaped for vizfootprint. Layer 1 (data), the adapter
 * side: the committed file in, ONE table out, nothing invented.
 *
 *   `residues`  one row per amino-acid residue the file gives a backbone for.
 *               Its key is minted HERE and nowhere else (see {@link residueKey}):
 *               `"<chain>:<resnum>"`, which is what a click in the 3D viewer, a
 *               dot on the scatter and a row of the sheet all say when they mean
 *               the same residue.
 *
 * ── What is READ, and what is skipped ───────────────────────────────────────
 * A dihedral needs three backbone atoms of the residue (N, CA, C) and one from
 * each neighbour, so those are the only atom records this parser keeps. Every
 * record it does NOT keep is counted and given a reason ({@link skippedOf}):
 * the waters and other hetero records, the repeated alternate locations, the
 * side-chain atoms, and the insertion-coded residues the minted key could not
 * tell apart. The demo's rule is the old one — **never a silent drop** — and a
 * class with a count of zero still says the parser looked.
 *
 * ── What is NOT here ────────────────────────────────────────────────────────
 * No interface, no contact, no buried surface, no secondary structure. All of
 * those are computable from these rows, and a number this file wrote would be a
 * number with no act behind it. The two angles ARE here, and that is a
 * deliberate line: phi and psi are the residue's own geometry, read off the
 * coordinates the file publishes, the way `../exo/etl.ts` reads a limit flag —
 * adapter work, not analysis. Where the geometry is not there to read, the
 * angle is ABSENT (`null`) and never 0: a torsion of zero degrees is a real
 * conformation, and a first residue has no torsion at all.
 *
 * ── Two owners this file deliberately does not become ───────────────────────
 * It does not hold the file's BYTES for the viewer (the desk does — see
 * `./session.ts`), and it does not decide what anything is coloured. It reads
 * bytes and answers rows.
 *
 * **This module runs in a browser.** Reading the committed file off disk needs
 * node, so that door lives in `./snapshot.ts` — the rule every other demo in
 * this repository states: a module that pulls a runtime into every importer is
 * a module every importer pays for.
 */

/** The one character between a chain and a residue number in a minted key. */
export const RESIDUE_KEY_SEPARATOR = ':';

/**
 * THE JOIN KEY, MINTED ONCE — `"<chain>:<resnum>"`.
 *
 * This function is the only place in the repository that spells it. The 3D
 * view emits it on a click, the scatter's dots carry it, the sheet's rows are
 * keyed by it and the def declares it as the table's `key`; four readers, one
 * owner, so a residue cannot be two different things on two views.
 *
 * WHAT IT CANNOT SAY, said out loud because the parser acts on it: the PDB
 * format allows an INSERTION CODE beside the number (`52` and `52A` are two
 * residues), and this key has no room for one. Rather than mint a key that
 * would collide, the parser SKIPS insertion-coded residues and counts them
 * ({@link skippedOf}); this entry has none, and a structure that had them would
 * lose rows the viewer still draws. The smallest honest key would be
 * `<chain>:<resnum><icode>` — which is a data decision, so it is written down
 * here rather than guessed at the call site.
 */
export function residueKey(chain: string, resnum: number): string {
  return `${chain}${RESIDUE_KEY_SEPARATOR}${String(resnum)}`;
}

/**
 * One residue, as the table sees it. `phi`/`psi` are `null` where the geometry
 * is not in the file.
 *
 * THE INDEX SIGNATURE IS DELIBERATE: a row is a record, and three separate
 * consumers want it as one — the library's own `Row`, the renderer contract's
 * `RenderRow`, and the desk's cells, which read a column by the name the
 * ENCODING FOLD gave them (`row[boundField]`) and cannot know that name at
 * build time. Without it every one of those doors needs a double cast through
 * `unknown`, which is a lie written four times instead of a shape written once.
 * The named columns below still hold their own types.
 */
export interface ResidueRow {
  readonly [column: string]: string | number | null;
  readonly residue_key: string;
  readonly chain: string;
  readonly resnum: number;
  readonly resname: string;
  readonly ca_x: number;
  readonly ca_y: number;
  readonly ca_z: number;
  readonly phi: number | null;
  readonly psi: number | null;
}

/** One class of coordinate record the parser did not keep, with its count and the reason. */
export interface SkippedRecords {
  readonly reason: string;
  readonly records: number;
  readonly why: string;
}

/** What the parse counted — every number the desk shows about the file itself comes from here. */
export interface ProtCounts {
  /** Coordinate records in the file: `ATOM` and `HETATM`. */
  readonly atomRecords: number;
  readonly hetatmRecords: number;
  /** The `ATOM` records that became coordinates on a row (N, CA and C of a kept residue). */
  readonly keptAtoms: number;
  readonly residues: number;
  /** One entry per chain, in the order the file first mentions it. */
  readonly chains: readonly { readonly chain: string; readonly residues: number }[];
  /** Residues with no phi, with no psi, and with both — the absence, counted rather than described. */
  readonly phiAbsent: number;
  readonly psiAbsent: number;
  readonly bothPresent: number;
}

/** The table, the counts, and what was skipped — one answer, so no reader can have the rows without the reasons. */
export interface ProtTables {
  readonly residues: readonly ResidueRow[];
  readonly counts: ProtCounts;
  readonly skipped: readonly SkippedRecords[];
}

// ── the PDB's fixed columns, in one place ────────────────────────────────────

/**
 * Where each field sits on a coordinate record. The legacy PDB format is
 * FIXED-COLUMN and not delimited — `substring`, never `split` — and these are
 * the 1-based column ranges the format document gives, turned into JS offsets
 * once here so no call site does the arithmetic twice.
 */
export const ATOM_COLUMNS = {
  name: [12, 16],
  altLoc: [16, 17],
  resName: [17, 20],
  chain: [21, 22],
  resSeq: [22, 26],
  iCode: [26, 27],
  x: [30, 38],
  y: [38, 46],
  z: [46, 54],
} as const;

/**
 * The same offsets under the short name this file's own parse uses. Exported
 * above rather than copied, because `./entryNotes.ts` reads the same columns to
 * say WHAT was skipped and a second table of numbers is a second thing to keep
 * in step.
 */
const AT = ATOM_COLUMNS;

/** The three backbone atoms a torsion is measured from. */
const BACKBONE = ['N', 'CA', 'C'] as const;
type Backbone = (typeof BACKBONE)[number];
const isBackbone = (name: string): name is Backbone => (BACKBONE as readonly string[]).includes(name);

/** One fixed-column field of a coordinate record, trimmed — the only way this repository reads one. */
export const atomField = (line: string, at: readonly [number, number]): string => line.slice(at[0], at[1]).trim();

const field = atomField;

/** A 3-D point, in the file's own Ångströms. */
type Point = readonly [number, number, number];

/** One residue as the parse accumulates it, before the angles can be measured. */
interface Backbones {
  readonly chain: string;
  readonly resnum: number;
  readonly resname: string;
  readonly atoms: Map<Backbone, Point>;
}

// ── the geometry ─────────────────────────────────────────────────────────────

const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k, a[2] * k];

/**
 * The torsion angle about the p1→p2 bond, in DEGREES on (−180, 180] — the
 * IUPAC sign convention, which is the one the Ramachandran plot is drawn in.
 *
 * Measured by projecting the two outer bonds onto the plane perpendicular to
 * the middle one and taking the signed angle between them. `null` when the
 * middle bond has no length (two atoms at one point), which is a broken file
 * rather than a conformation — and an angle nobody can measure is absent, not
 * zero.
 */
export function torsion(p0: Point, p1: Point, p2: Point, p3: Point): number | null {
  const b0 = minus(p0, p1);
  const b1 = minus(p2, p1);
  const b2 = minus(p3, p2);
  const length = Math.sqrt(dot(b1, b1));
  if (!(length > 0)) return null;
  const axis = scale(b1, 1 / length);
  const v = minus(b0, scale(axis, dot(b0, axis)));
  const w = minus(b2, scale(axis, dot(b2, axis)));
  return (Math.atan2(dot(cross(axis, v), w), dot(v, w)) * 180) / Math.PI;
}

// ── the parse ────────────────────────────────────────────────────────────────

/** The reasons a coordinate record is not kept, and the sentence each one carries. */
const SKIP_REASONS = {
  hetero: 'a HETATM record: water, an ion or any other non-polymer atom. This desk is about the protein chains, and a water has no residue in the table to belong to',
  insertionCode:
    'an ATOM record on a residue with an insertion code, which the minted key "<chain>:<resnum>" cannot tell from its un-coded neighbour (src/prot/etl.ts · residueKey). Skipped rather than collided — the viewer still draws the residue, so this class going above zero means the table and the picture disagree',
  alternateLocation:
    'an ATOM record for an atom already taken at another alternate location. The first location the file lists is kept — the one a viewer draws by default — so the rows and the picture agree about where an atom is',
  sideChain: 'an ATOM record for an atom that is not N, CA or C. A backbone torsion cannot be measured from it, and nothing on this desk reads it',
} as const;

/**
 * The residue table, its counts and its skips — the whole ETL, over the text of
 * one PDB entry.
 *
 * ```ts
 * const { residues, counts, skipped } = protTables(readFileSync('data/prot/1ay7.pdb', 'utf8'));
 * counts.residues;                       // 185
 * residues[1]?.phi;                      // -77.43…  (chain A, residue 2)
 * residues[0]?.phi;                      // null — the first residue of a chain has no phi
 * skipped.find((s) => s.records > 0);    // and every record that is not on a row is in here
 * ```
 */
export function protTables(pdbText: string): ProtTables {
  const held = new Map<string, Backbones>();
  const order: string[] = [];
  /** Which (residue, atom name) pairs are already taken — the first alternate location wins. */
  const taken = new Set<string>();
  let atomRecords = 0;
  let hetatmRecords = 0;
  let keptAtoms = 0;
  let skippedInsertionCode = 0;
  let skippedAlternate = 0;
  let skippedSideChain = 0;

  for (const line of pdbText.split('\n')) {
    if (line.startsWith('HETATM')) {
      hetatmRecords += 1;
      continue;
    }
    if (!line.startsWith('ATOM')) continue;
    atomRecords += 1;
    if (field(line, AT.iCode) !== '') {
      skippedInsertionCode += 1;
      continue;
    }
    const name = field(line, AT.name);
    const chain = field(line, AT.chain);
    const resnum = Number(field(line, AT.resSeq));
    const key = `${residueKey(chain, resnum)}.${name}`;
    if (taken.has(key)) {
      skippedAlternate += 1;
      continue;
    }
    taken.add(key);
    if (!isBackbone(name)) {
      skippedSideChain += 1;
      continue;
    }
    keptAtoms += 1;
    const id = residueKey(chain, resnum);
    let residue = held.get(id);
    if (residue === undefined) {
      residue = { chain, resnum, resname: field(line, AT.resName), atoms: new Map() };
      held.set(id, residue);
      order.push(id);
    }
    residue.atoms.set(name, [Number(field(line, AT.x)), Number(field(line, AT.y)), Number(field(line, AT.z))]);
  }

  const rows = order.flatMap((id) => rowOf(held, held.get(id)!));
  return {
    residues: rows,
    counts: countsOf(rows, { atomRecords, hetatmRecords, keptAtoms }),
    skipped: skippedOf({ hetatmRecords, skippedInsertionCode, skippedAlternate, skippedSideChain }),
  };
}

/**
 * One row, with its two angles — or NO row at all when the file gave this
 * residue no CA, because `ca_x/ca_y/ca_z` are where every dot and every
 * viewer mark is placed and a row with no position is a row nothing can draw.
 * (Every residue of the committed entry has all three backbone atoms, so this
 * arm is a guard against another file, not a filter on this one.)
 */
function rowOf(held: ReadonlyMap<string, Backbones>, residue: Backbones): readonly ResidueRow[] {
  const ca = residue.atoms.get('CA');
  const n = residue.atoms.get('N');
  const c = residue.atoms.get('C');
  if (ca === undefined) return [];
  // THE NEIGHBOUR IS THE CONSECUTIVE NUMBER IN THE SAME CHAIN, and that is the
  // only evidence this file gives: a peptide bond is not a record, so numbering
  // is what says two residues are adjacent. A gap in the numbering is therefore
  // a chain break here — which is the honest reading — and a break WITHOUT a
  // gap (two chains' worth of numbering run together) would be invisible; a
  // bond check by distance would be a rule nobody declared.
  const before = held.get(residue_id(residue, -1));
  const after = held.get(residue_id(residue, +1));
  const prevC = before?.atoms.get('C');
  const nextN = after?.atoms.get('N');
  return [
    {
      residue_key: residueKey(residue.chain, residue.resnum),
      chain: residue.chain,
      resnum: residue.resnum,
      resname: residue.resname,
      ca_x: ca[0],
      ca_y: ca[1],
      ca_z: ca[2],
      // phi: C(i−1) → N(i) → CA(i) → C(i); psi: N(i) → CA(i) → C(i) → N(i+1).
      // Absent where an atom of the torsion is not in the file — the first
      // residue of a chain has no phi, the last has no psi, and neither has a
      // zero.
      phi: prevC !== undefined && n !== undefined && c !== undefined ? torsion(prevC, n, ca, c) : null,
      psi: n !== undefined && c !== undefined && nextN !== undefined ? torsion(n, ca, c, nextN) : null,
    },
  ];
}

const residue_id = (residue: Backbones, step: number): string => residueKey(residue.chain, residue.resnum + step);

/** The counts, folded over the rows the parse produced — never typed anywhere. */
function countsOf(rows: readonly ResidueRow[], records: { readonly atomRecords: number; readonly hetatmRecords: number; readonly keptAtoms: number }): ProtCounts {
  const perChain = new Map<string, number>();
  for (const row of rows) perChain.set(row.chain, (perChain.get(row.chain) ?? 0) + 1);
  return {
    ...records,
    residues: rows.length,
    chains: [...perChain.entries()].map(([chain, residues]) => ({ chain, residues })),
    phiAbsent: rows.filter((r) => r.phi === null).length,
    psiAbsent: rows.filter((r) => r.psi === null).length,
    bothPresent: rows.filter((r) => r.phi !== null && r.psi !== null).length,
  };
}

/**
 * THE SKIP NOTE — every coordinate record that is not on a row, by class, with
 * the reason in words.
 *
 * All four classes are listed whatever their count, including the zero ones: a
 * class with a count says the parser looked, and "no residue of this entry has
 * an insertion code" is a different statement from silence about insertion
 * codes. (`../exo/def.ts` makes the same choice about the absence word no row
 * of its slice needs.)
 */
export function skippedOf(counted: {
  readonly hetatmRecords: number;
  readonly skippedInsertionCode: number;
  readonly skippedAlternate: number;
  readonly skippedSideChain: number;
}): readonly SkippedRecords[] {
  return [
    { reason: 'water-or-hetero', records: counted.hetatmRecords, why: SKIP_REASONS.hetero },
    { reason: 'insertion-code', records: counted.skippedInsertionCode, why: SKIP_REASONS.insertionCode },
    { reason: 'alternate-location', records: counted.skippedAlternate, why: SKIP_REASONS.alternateLocation },
    { reason: 'not-a-backbone-atom', records: counted.skippedSideChain, why: SKIP_REASONS.sideChain },
  ];
}

/** How many records the parse did not keep, over every class — the one number a caption can put beside the ones it did. */
export function skippedTotal(skipped: readonly SkippedRecords[]): number {
  return skipped.reduce((total, s) => total + s.records, 0);
}

// ── the entry's own words ────────────────────────────────────────────────────

/**
 * One header record's value, joined and squeezed — the entry's own words, read
 * off the file rather than retyped.
 *
 * `data/prot/fetch.mjs` holds a TWIN of this function, and that is deliberate
 * rather than sloppy: it writes `PROVENANCE.json` and cannot import TypeScript.
 * The two answer the same thing for the committed file, which
 * `tests/prot-etl.test.ts` checks against the record on disk.
 */
export function pdbRecord(text: string, tag: string): string {
  return text
    .split('\n')
    .filter((line) => line.startsWith(tag))
    .map((line) => line.slice(10).trimEnd())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The four-character entry id, from the HEADER record's own columns (63–66, 1-based). */
export function entryId(text: string): string {
  const header = text.split('\n').find((line) => line.startsWith('HEADER')) ?? '';
  return header.slice(62, 66).trim();
}

/**
 * WHO TO CREDIT — read out of the file.
 *
 * wwPDB releases its archive under CC0, which asks for nothing; the archive
 * asks anyway that the depositors of a structure and its primary citation be
 * named. So the page prints these, and it prints the entry's own records rather
 * than a sentence somebody wrote about them.
 */
export interface EntryCredit {
  readonly entry: string;
  readonly title: string;
  readonly molecules: string;
  readonly experiment: string;
  readonly depositors: string;
  readonly citation: string;
  /**
   * The resolution the file states, in the file's own digits and WITHOUT a unit
   * ({@link pdbResolution}) — `null` for an entry whose record says it does not
   * apply, which is every method that does not diffract.
   *
   * It is READ rather than assumed because a workbench header that named a
   * resolution the file does not state would be the page inventing a number
   * about somebody's structure.
   */
  readonly resolution: string | null;
}

/**
 * THE RESOLUTION, off `REMARK   2` — the one numeric fact about the experiment
 * that is not in a header record of its own.
 *
 * The legacy format states it as `REMARK   2 RESOLUTION.    1.70 ANGSTROMS.`
 * and, for a method where it has no meaning, as `RESOLUTION. NOT APPLICABLE.`
 * — so the absence is a statement the file makes and `null` is the honest
 * reading of it, not a parse failure.
 *
 * The digits come back EXACTLY as the file writes them (`1.70`, not `1.7`): a
 * depositor's two decimal places are a claim about precision, and rounding
 * them here would be this code editing somebody else's measurement.
 */
export function pdbResolution(text: string): string | null {
  const line = text.split('\n').find((l) => l.startsWith('REMARK   2') && l.includes('RESOLUTION.'));
  if (line === undefined) return null;
  const found = /RESOLUTION\.\s+([0-9]+(?:\.[0-9]+)?)\s*ANGSTROM/.exec(line);
  return found === null ? null : (found[1] ?? null);
}

export function entryCredit(text: string): EntryCredit {
  return {
    entry: entryId(text),
    title: pdbRecord(text, 'TITLE'),
    molecules: pdbRecord(text, 'COMPND'),
    experiment: pdbRecord(text, 'EXPDTA'),
    depositors: pdbRecord(text, 'AUTHOR'),
    citation: pdbRecord(text, 'JRNL'),
    resolution: pdbResolution(text),
  };
}
