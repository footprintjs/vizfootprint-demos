/**
 * THE HEADLESS ENTRY — one PDB text parsed into a Mol* structure with no canvas,
 * no plugin and no renderer anywhere near it.
 *
 * This is the door the two analysis stages (`./analyses.ts`) go through, and it
 * exists because of one architectural decision worth stating rather than
 * assuming:
 *
 *   **an analysis must never reach into the mounted viewer for its structure.**
 *
 * The 3D view on this desk is a CONFORMED RENDERER (`web/src/molstarRenderer.ts`)
 * and it holds a Mol* `Structure` of its own. Borrowing that one would have been
 * one parse cheaper and wrong in three ways: an analysis that needs a renderer
 * cannot run before the screen exists, cannot run in a test at all, and would
 * make the numbers on the log depend on which pictures a reader had opened. So
 * the compute tier parses its OWN model, from the same committed bytes, and the
 * two never meet.
 *
 * **WHAT THAT COSTS, measured on the committed entry** (node 22, this machine,
 * `1ay7.pdb`, 169,371 characters): the parse is 6–17 ms and each act's own
 * compute is 24–60 ms. Three acts land on this desk, so the desk pays the parse
 * three times — about 20–50 ms in total, which is why there is NO cache here.
 * A memo would be a second thing to be wrong about (which bytes was it holding?)
 * bought for a fifth of the cost of one act.
 *
 * ── Why every Mol* import below is dynamic ──────────────────────────────────
 * The molecular viewer is 2.9 MB minified and already rides in its own chunk
 * (`web/src/molstarRenderer.ts` · `mount`, one `await import`). The COMPUTE
 * half — the reader, the model, the interaction and surface engines — is a
 * different subtree of the same package, and a static import here would pull it
 * into the page's first paint for an act nobody has dispatched yet. Every value
 * import in this folder is therefore `await import(...)`; the TYPES are
 * `import type`, which the bundler erases.
 *
 * ── What this module will not do ────────────────────────────────────────────
 * It answers a structure and the address of an atom in it. It computes nothing,
 * counts nothing, and knows no column name: `./interactions.ts` and
 * `./surface.ts` are where the two analyses' own arithmetic lives, and
 * `./etl.ts` is still the only module that mints a residue key.
 */
import type { Structure, Unit } from 'molstar/lib/mol-model/structure';
import { residueKey } from './etl.js';

/**
 * WHERE ONE ATOM IS, in the words the file uses — the one bridge between a Mol*
 * element index and a row of the `residues` table.
 *
 * `key` is minted by `./etl.ts` · {@link residueKey} and by nothing here: the
 * interaction rows, the surface columns, the dots and the 3D view all have to
 * say the same thing when they mean the same residue, and four spellings of
 * `"<chain>:<resnum>"` is four chances to disagree.
 */
export interface AtomAddress {
  /** `"<chain>:<resnum>"` — the same key a row of `residues` is identified by. */
  readonly key: string;
  /** The chain as the file labels it (`auth_asym_id`) — deliberately NOT the label id: the table's key uses the author's. */
  readonly chain: string;
  /** The residue number the depositors gave it (`auth_seq_id`). */
  readonly resnum: number;
  /** The component id — an amino acid's three-letter code, or `HOH` for a water. */
  readonly comp: string;
  /** The file's own atom name (`auth_atom_id`) — `CA`, `NE2`, `OD1`. */
  readonly atom: string;
  /**
   * TRUE when this atom's record is a `HETATM`: a water, an ion, anything that
   * is not part of a polymer chain. Such an atom has NO row in `residues`
   * (`./etl.ts` skips the class and counts it), which is why every consumer here
   * asks: an interaction with an endpoint nobody can point at is dropped and
   * counted, never half-drawn.
   */
  readonly hetero: boolean;
  /**
   * The alternate-location character the file gives this atom, `''` where the
   * column is blank.
   *
   * It matters because the two parses DISAGREE about alternate locations, on
   * purpose: `./etl.ts` keeps the FIRST location of each atom (the one a viewer
   * draws) and counts the rest as skipped, while Mol* keeps them all. So a
   * computed contact can run through an atom the residues table never saw. The
   * residue still has a row — nothing is orphaned — but the fact is counted and
   * printed rather than left to be discovered.
   */
  readonly altLoc: string;
}

/** A parsed entry and the one question the analyses ask of it. */
export interface HeadlessEntry {
  readonly structure: Structure;
  /**
   * The address of the `unitIndex`-th element of `unit` — `StructureElement.UnitIndex`,
   * which is what every Mol* feature and every ASA lookup hands back.
   *
   * It allocates one `StructureElement.Location` per call rather than mutating a
   * shared one, because the callers hold addresses side by side (an interaction
   * has two ends) and a shared cursor would answer the second question about the
   * first atom.
   */
  address(unit: Unit, unitIndex: number): AtomAddress;
}

/**
 * The entry, parsed — text in, a structure and an address function out.
 *
 * ```ts
 * const entry = await headlessEntry(loadStructureText(), '1AY7');
 * entry.structure.units.length;                       // 3 — chain A, chain B, the waters
 * entry.address(entry.structure.units[0]!, 0).key;    // 'A:1'
 * ```
 *
 * `id` is the label Mol* gives the parsed file and nothing else reads it; the
 * caller passes the entry's own four characters (`./etl.ts` · `entryId`) so a
 * Mol* error message names the file a reader would recognise.
 *
 * THROWS on a text Mol* cannot read, with the reader's own message. That is the
 * honest direction: the stage that called this is inside a declared analysis,
 * and a throw there is a refusal the session files with the sentence attached
 * (`./session.ts` · `landProtActs`) rather than a table of silences.
 */
export async function headlessEntry(pdbText: string, id: string): Promise<HeadlessEntry> {
  const [{ parsePDB }, { trajectoryFromPDB }, { Structure, StructureElement, StructureProperties }] = await Promise.all([
    import('molstar/lib/mol-io/reader/pdb/parser.js'),
    import('molstar/lib/mol-model-formats/structure/pdb.js'),
    import('molstar/lib/mol-model/structure.js'),
  ]);
  const parsed = await parsePDB(pdbText, id).run();
  if (parsed.isError) throw new Error(`Mol* could not read the structure text: ${parsed.message}`);
  const trajectory = await trajectoryFromPDB(parsed.result).run();
  // `getFrameAtIndex` answers a Model OR a Task of one — the Trajectory
  // interface's own union, and a PDB entry's single frame comes back directly.
  // Asked rather than assumed, because a format that returns the Task would
  // otherwise reach `Structure.ofModel` as an unrun Task.
  const frame = trajectory.getFrameAtIndex(0);
  const model = 'run' in frame ? await frame.run() : frame;
  const structure = Structure.ofModel(model);
  return {
    structure,
    address: (unit, unitIndex) => {
      const location = StructureElement.Location.create(structure, unit, unit.elements[unitIndex]!);
      const chain = StructureProperties.chain.auth_asym_id(location);
      const resnum = StructureProperties.residue.auth_seq_id(location);
      return {
        key: residueKey(chain, resnum),
        chain,
        resnum,
        comp: StructureProperties.atom.label_comp_id(location),
        atom: StructureProperties.atom.auth_atom_id(location),
        hetero: StructureProperties.residue.group_PDB(location) === 'HETATM',
        altLoc: StructureProperties.atom.label_alt_id(location),
      };
    },
  };
}
