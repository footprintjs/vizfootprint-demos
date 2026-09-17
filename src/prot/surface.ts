/**
 * STAGE B'S ARITHMETIC — how much of each residue the solvent can reach, read
 * off Mol*'s Shrake–Rupley implementation and shaped into two columns.
 *
 * `AccessibleSurfaceArea.compute` rolls a probe over the structure and
 * accumulates an area per residue; this module does three things with the
 * answer and computes nothing of its own:
 *
 *   1. **points each value at a row** of `residues`, by the key `./etl.ts` ·
 *      `residueKey` mints;
 *   2. **refuses the engine's sentinel**. `getValue` answers **−1** for an atom
 *      the computation skipped — a water under the default parameters — and −1
 *      Å² is not an area. Every −1 becomes an ABSENT value and is counted
 *      ({@link SurfaceCounts.noValue}); none has ever reached a row of this
 *      desk, and the count is what says so;
 *   3. **refuses the engine's silent fallback** for the relative value. See
 *      {@link relativeSurface} — this is the one place where a Mol* convenience
 *      would have quietly invented a number, and the only arithmetic in this
 *      file is the guard in front of it.
 *
 * ── THE PARAMETERS ARE READ, NOT SET ───────────────────────────────────────
 * As with the interaction providers (`./interactions.ts`), this module passes
 * no props: it reads `ShrakeRupleyComputationParams`' own defaults and carries
 * them out with the columns, so the caption states the probe size and the
 * sphere count the numbers were actually produced at. `nonPolymer: false` is
 * the one worth a reader's attention and it is in the counts: the deposited
 * waters are NOT occluders, so this is the accessible surface of the two chains
 * with the solvent taken away — and the two chains are still occluding each
 * other, which is the whole reason an interface residue's value is small.
 *
 * ── The one thing these numbers are NOT ─────────────────────────────────────
 * Nothing here is compared to a published value, because there is nothing
 * honest to compare it to: an accessible surface area depends on the probe, the
 * sphere count, the radii table and whether the solvent is present, and two
 * programs agreeing to three digits is a coincidence rather than a check.
 * `tests/prot-surface.test.ts` pins INTERNAL consistency instead, and says in
 * its own words that that is what it is doing.
 */
import type { Structure, Unit } from 'molstar/lib/mol-model/structure';
import type { HeadlessEntry } from './molstar.js';

/** What the computation ran at, and what it produced — read off the engine, never typed here. */
export interface SurfaceCounts {
  /** Probe radius, in Ångströms — the engine's own default (a water molecule's size). */
  readonly probeSize: number;
  /** How many points the probe is sampled at per atom. */
  readonly spherePoints: number;
  /** Whether non-polymer atoms occlude. See the file header. */
  readonly nonPolymer: boolean;
  /** Whether only alpha carbons were used. */
  readonly traceOnly: boolean;
  /** The sum of the engine's OWN per-residue array, over every residue it computed — the total the landed column is checked against. */
  readonly engineTotal: number;
  /** Rows that got a value. */
  readonly landed: number;
  /** Rows where the engine answered its `-1` sentinel: an area it did not compute. Absent on the row, never zero. */
  readonly noValue: number;
  /** Rows with an area but no maximum to divide it by, so no relative value — see {@link relativeSurface}. */
  readonly noReference: number;
  /** Rows whose area is exactly zero: a residue the probe could not touch anywhere. */
  readonly buried: number;
}

/** The two columns and the counts behind them — aligned to `residues` position by position. */
export interface ResidueSurface {
  /** Accessible surface area per residue, in Å². `null` where the engine computed none. */
  readonly sasa: readonly (number | null)[];
  /** That area over the largest this residue type can have. `null` where there is no reference — never 0. */
  readonly relative_sasa: readonly (number | null)[];
  readonly counts: SurfaceCounts;
}

/**
 * THE RELATIVE VALUE, and the guard that makes it honest.
 *
 * Mol* ships two doors and this desk can use only one of them:
 *
 *   `getNormalizedValue(location, asa)` divides by `MaxAsa[compId] ||
 *   DefaultMaxAsa` — so a component the reference table has never heard of
 *   (a modified residue, a ligand) comes back divided by **121**, the alanine
 *   figure, with nothing in the answer saying so. A number that looks like a
 *   fraction of a residue's own maximum and is really a fraction of
 *   somebody else's is the exact shape of claim this repository exists to
 *   refuse.
 *
 *   `normalize(compId, asa)` is the same division, and `MaxAsa` is EXPORTED.
 *
 * So the desk asks `MaxAsa` first and hands the division to the engine only
 * where there is a real reference; everywhere else the value is ABSENT. The
 * arithmetic stays Mol*'s, the judgement is the desk's, and the count of
 * absences is in {@link SurfaceCounts.noReference} where a caption can say it.
 *
 * On the committed entry that count is **0** — all 185 residues are standard
 * amino acids — and a class with a count of zero still says the desk looked
 * (`./etl.ts` · `skippedOf` makes the same choice for insertion codes).
 */
export function relativeSurface(reference: Readonly<Record<string, number>>, normalize: (compId: string, asa: number) => number, comp: string, sasa: number): number | null {
  return Object.prototype.hasOwnProperty.call(reference, comp) ? normalize(comp, sasa) : null;
}

/**
 * THE TWO COLUMNS — one accessible surface area per row of `residues`, and the
 * relative value beside it.
 *
 * ```ts
 * const entry = await headlessEntry(loadStructureText(), '1AY7');
 * const { sasa, relative_sasa, counts } = await protSurface(entry, residues.map((r) => r.residue_key));
 * counts.engineTotal;       // 9150.4798… Å² over the committed entry
 * counts.buried;            // 17 residues the probe could not touch at all
 * sasa.length;              // 185 — one per row, in the table's own order
 * relative_sasa[i];         // sasa[i] / the largest that residue type can have
 * ```
 *
 * `residueKeys` are the table's own keys IN ITS OWN ORDER, and the alignment to
 * them is the contract: the library's columns channel reads these arrays against
 * the table's row order, so a row the walk below never reached keeps its `null`
 * rather than shifting every value after it.
 */
export async function protSurface(entry: HeadlessEntry, residueKeys: readonly string[]): Promise<ResidueSurface> {
  const { structure, address } = entry;
  const [{ AccessibleSurfaceArea, ShrakeRupleyComputationParams }, { MaxAsa }, { StructureElement }, { ParamDefinition }] = await Promise.all([
    import('molstar/lib/mol-model-props/computed/accessible-surface-area/shrake-rupley.js'),
    import('molstar/lib/mol-model-props/computed/accessible-surface-area/shrake-rupley/common.js'),
    import('molstar/lib/mol-model/structure.js'),
    import('molstar/lib/mol-util/param-definition.js'),
  ]);
  const props = ParamDefinition.getDefaultValues(ShrakeRupleyComputationParams);
  const area = await AccessibleSurfaceArea.compute(structure, {}).run();

  /** The engine's own total, over every residue it computed — `area.area` is already one entry per residue. */
  let engineTotal = 0;
  for (let i = 0; i < area.area.length; i += 1) engineTotal += area.area[i]!;

  /**
   * The area of every POLYMER residue, by minted key. Hetero atoms are skipped
   * here rather than filtered later, and the reason is a real collision: in the
   * committed entry the waters carry chain label `A`, the same label the
   * ribonuclease carries, so a water numbered inside the protein's range would
   * otherwise overwrite a real residue's value. The residues table has no water
   * rows at all, so skipping them loses nothing and cannot be wrong.
   */
  const byResidue = new Map<string, { readonly comp: string; readonly sasa: number }>();
  for (const unit of structure.units) {
    for (let i = 0; i < unit.elements.length; i += 1) {
      const at = address(unit, i);
      if (at.hetero || byResidue.has(at.key)) continue;
      const location = StructureElement.Location.create(structure, unit as Unit, unit.elements[i]!);
      byResidue.set(at.key, { comp: at.comp, sasa: AccessibleSurfaceArea.getValue(location, area) });
    }
  }

  const sasa: (number | null)[] = [];
  const relative: (number | null)[] = [];
  let noValue = 0;
  let noReference = 0;
  let buried = 0;
  for (const key of residueKeys) {
    const found = byResidue.get(key);
    // the engine's sentinel, and the honest reading of it: `-1` is "not
    // computed", so the row gets nothing at all — and so does the relative
    // value, because a fraction of a maximum needs a numerator
    if (found === undefined || found.sasa < 0) {
      noValue += 1;
      sasa.push(null);
      relative.push(null);
      continue;
    }
    if (found.sasa === 0) buried += 1;
    const rel = relativeSurface(MaxAsa, AccessibleSurfaceArea.normalize, found.comp, found.sasa);
    if (rel === null) noReference += 1;
    sasa.push(found.sasa);
    relative.push(rel);
  }

  return {
    sasa,
    relative_sasa: relative,
    counts: {
      probeSize: props.probeSize,
      spherePoints: props.numberOfSpherePoints,
      nonPolymer: props.nonPolymer,
      traceOnly: props.traceOnly,
      engineTotal,
      landed: residueKeys.length - noValue,
      noValue,
      noReference,
      buried,
    },
  };
}
