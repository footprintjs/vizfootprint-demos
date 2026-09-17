/**
 * STAGE A'S ARITHMETIC — the non-covalent contacts of one entry, read off Mol*'s
 * own interaction engine and shaped into rows.
 *
 * Nothing here decides what an interaction IS. `computeInteractions`
 * (`molstar/lib/mol-model-props/computed/interactions`) finds them, gives each
 * one a word from its own taxonomy, and this module does three things with the
 * answer:
 *
 *   1. **names both ends** with the key `./etl.ts` · `residueKey` mints, so a
 *      contact points at rows of `residues` and not at Mol* element indices;
 *   2. **drops what it cannot point at, with a reason and a count** — the
 *      desk's oldest law (`./etl.ts`, "never a silent drop"), one level up;
 *   3. **measures the separation** the engine's own geometry is built on, and
 *      says exactly which quantity that is (see {@link InteractionRow.separation}).
 *
 * ── WHICH INTERACTIONS ARE LOOKED FOR IS NOT THIS DESK'S CHOICE ─────────────
 * Mol* ships a provider per kind and has five of them ON by default. This
 * module passes NO props: it READS which providers the engine has on
 * ({@link interactionProviders}) and carries that set out with the rows, so the
 * caption can say which words the `kind` column could ever contain. Turning a
 * provider on to make a denser picture would be this desk choosing its own
 * result, which is the one thing a desk about provenance may not do — and
 * turning one off silently would be worse. The set is PINNED by
 * `tests/prot-interactions.test.ts`: if a Mol* upgrade changes it, a test says
 * so before a caption does.
 *
 * ── ONE REFUSAL, up front ───────────────────────────────────────────────────
 * A structure whose symmetry groups hold more than one unit is REFUSED by name
 * ({@link SYMMETRY_REFUSAL}). Two symmetry copies of a chain share the file's
 * chain label, so the minted key cannot tell them apart and every contact would
 * land on the wrong row half the time. The committed entry has one unit per
 * group; a structure that did not would lose the table rather than corrupt it.
 */
import type { Structure, Unit } from 'molstar/lib/mol-model/structure';
import type { Features } from 'molstar/lib/mol-model-props/computed/interactions/features';
import type { HeadlessEntry } from './molstar.js';

/** The one character between the parts of a minted interaction key. */
export const INTERACTION_KEY_SEPARATOR = '|';

/**
 * THE INTERACTION TABLE'S KEY, MINTED ONCE — `"<residue_a>|<residue_b>|<n>"`.
 *
 * The residue keys are `./etl.ts` · `residueKey`'s and are never respelled
 * here; `n` is the ordinal of this contact among the contacts between those two
 * residues, in the engine's own enumeration order.
 *
 * THE ORDINAL IS NOT DECORATION. One residue pair really does carry several
 * contacts — an arginine and a glutamate hydrogen-bond through four different
 * pairs of atoms in the committed entry — and two of them can even share a
 * separation to the last decimal, because without hydrogens in the file the
 * engine reports an ambiguous donor/acceptor pair in both directions. So
 * nothing about the chemistry makes a pair unique, and a key built from the
 * atoms alone would collide on exactly the rows a reader would most want to
 * count.
 */
export function interactionKey(residueA: string, residueB: string, ordinal: number): string {
  return [residueA, residueB, String(ordinal)].join(INTERACTION_KEY_SEPARATOR);
}

/** The sentence a structure with symmetry mates is refused with — see the file header. */
export const SYMMETRY_REFUSAL =
  'this structure has a symmetry group with more than one unit: two symmetry copies of a chain wear the same chain label, so the minted key "<chain>:<resnum>" cannot tell their residues apart and every contact would be filed against the wrong row. No interaction table was landed';

/**
 * One non-covalent contact, as a row.
 *
 * The index signature is deliberate, for the reason `./etl.ts` · `ResidueRow`
 * gives: three consumers want a row as a record (the library's `Row`, the
 * table cell's column lookup by the name a fold gave it, and the analysis's
 * `TableOutput.rows`), and a shape written once beats a cast written three
 * times.
 */
export interface InteractionRow {
  readonly [column: string]: string | number | boolean;
  /** {@link interactionKey} — the row's identity, and the only thing on it this repository spells. */
  readonly interaction_key: string;
  /**
   * The two ends, as `residues` keys, in THE FILE'S OWN ORDER (chain, then
   * residue number) — never the engine's A/B order.
   *
   * WHY sorted: the engine's contact carries `{ type, flag }` and nothing else,
   * so which end it calls A is a fact about its traversal, not about the
   * chemistry. A hydrogen bond really does have a direction, and the engine
   * really does know it — but it knows it about the FEATURES, not about the
   * contact, which is why the direction rides on {@link feature_a} /
   * {@link feature_b} below (`hydrogen donor` against `hydrogen acceptor`)
   * rather than being smuggled into the endpoint order.
   */
  readonly residue_a: string;
  readonly residue_b: string;
  /** The file's own atom name at each end: the first member atom of the engine's feature. */
  readonly atom_a: string;
  readonly atom_b: string;
  /**
   * How many atoms each end's feature has. `1` is the common case and the one
   * that makes {@link separation} checkable against two records of the file: a
   * one-atom feature's centre IS its atom. Above 1 — an aromatic ring, a
   * charged group — the centre is the centroid of those atoms and `atom_a` only
   * says where the feature starts.
   */
  readonly atoms_a: number;
  readonly atoms_b: number;
  /** The engine's own feature word at each end, lowercased (`hydrogen donor`, `aromatic ring`, `positive charge`). */
  readonly feature_a: string;
  readonly feature_b: string;
  /** The engine's own taxonomy word for the contact, lowercased (`hydrogen bond`, `pi stacking`, `cation-pi interaction`). */
  readonly kind: string;
  /**
   * The distance between the two features' CENTRES, in Ångströms — the quantity
   * the engine's own contact test thresholds on (`Features.position`, then a
   * Euclidean distance).
   *
   * Said this precisely because the engine has two distances and they are not
   * the same: `Features.distance` measures between the two features' FIRST
   * member atoms, which for a ring is an arbitrary vertex. The centre is the
   * one the providers use, and for the one-atom features that carry every
   * hydrogen bond on this desk it is the donor–acceptor heavy-atom separation
   * exactly.
   *
   * NOT a number from anybody's paper: `tests/prot-interactions.test.ts`
   * recomputes three of these, and the ring-to-ring one, from the coordinate
   * columns of the committed file with its own arithmetic.
   */
  readonly separation: number;
  /** TRUE where the two ends are in different chains — the interface, which is what this desk is about. */
  readonly crosses_chains: boolean;
}

/** One class of contact the enumeration did not keep, with its count and the reason — `./etl.ts` · `SkippedRecords`, one tier up. */
export interface DroppedContacts {
  readonly reason: string;
  readonly contacts: number;
  readonly why: string;
}

/** What the enumeration counted. Every number a caption says about the contacts comes from here. */
export interface InteractionCounts {
  /** Contacts the engine reported, after de-duplication and before any drop. */
  readonly reported: number;
  /** Rows landed. */
  readonly rows: number;
  /** Rows whose two ends are in different chains. */
  readonly crossing: number;
  /** One entry per kind the rows actually contain, in the engine's own words, most first. */
  readonly byKind: readonly { readonly kind: string; readonly contacts: number }[];
  /** The providers the engine had ON, and the ones it had off — read, never set ({@link interactionProviders}). */
  readonly providersOn: readonly string[];
  readonly providersOff: readonly string[];
  /**
   * Kept rows that run through an ATOM the residues table never saw: an
   * alternate location beyond the first. The residue still has a row, so
   * nothing is orphaned — but the two parses disagree about how many atoms that
   * residue has, and a count is the only honest way to say so
   * (`./molstar.ts` · `AtomAddress.altLoc`).
   */
  readonly throughAlternateLocation: number;
}

/** The rows, the counts and the drops — one answer, so no reader can have the contacts without the reasons. */
export interface ProtInteractions {
  readonly interactions: readonly InteractionRow[];
  readonly counts: InteractionCounts;
  readonly dropped: readonly DroppedContacts[];
}

/** The reasons a reported contact does not become a row, and the sentence each carries. */
const DROP_REASONS = {
  refined:
    'the engine\'s own refinement pass flagged this contact as filtered — a contact it found and then withdrew (line of sight blocked, or superseded by a better one at the same atoms). Mol* draws none of these, and neither does this table',
  hetero:
    'an end of the contact is a HETATM: a water, an ion or another non-polymer atom. The residues table has no row for one (`src/prot/etl.ts` skips the class and counts it), so the contact has nothing to point at — and half a contact is not a contact',
  noRow:
    'an end of the contact is a polymer atom whose residue still has no row: an insertion-coded residue the minted key cannot tell from its neighbour, or a residue the file gave no alpha carbon for. Both classes are counted by the ETL for the same reason',
} as const;

/**
 * WHICH PROVIDERS THE ENGINE HAS ON — read off `InteractionsParams`' own
 * defaults, never chosen here.
 *
 * Each provider is a `PD.Mapped` whose default value names `'on'` or `'off'`,
 * so the answer is the engine's declaration read as data. See the file header
 * for why this desk reads it instead of setting it.
 */
export function interactionProviders(providers: Readonly<Record<string, { readonly name: string }>>): { readonly on: readonly string[]; readonly off: readonly string[] } {
  const names = Object.keys(providers).sort();
  return {
    on: names.filter((k) => providers[k]?.name === 'on'),
    off: names.filter((k) => providers[k]?.name !== 'on'),
  };
}

/** The endpoints in the file's own order — chain first, then residue number. See {@link InteractionRow.residue_a}. */
function fileOrder(a: { readonly chain: string; readonly resnum: number }, b: { readonly chain: string; readonly resnum: number }): number {
  return a.chain === b.chain ? a.resnum - b.resnum : a.chain < b.chain ? -1 : 1;
}

/** One end of a contact, as the enumeration holds it before a row exists. */
interface Endpoint {
  readonly key: string;
  readonly chain: string;
  readonly resnum: number;
  readonly atom: string;
  readonly atoms: number;
  readonly feature: string;
  readonly altLoc: string;
  readonly hetero: boolean;
}

/**
 * THE CONTACTS OF ONE ENTRY — every non-covalent interaction the engine reports,
 * as rows over the residues that have one.
 *
 * ```ts
 * const entry = await headlessEntry(loadStructureText(), '1AY7');
 * const { interactions, counts } = await protInteractions(entry, residues.map((r) => r.residue_key));
 * counts.reported;                       // 541 on the committed entry
 * counts.rows;                           // 224 — the rest had an end with no row
 * counts.crossing;                       // 21 — the interface
 * interactions[0]?.kind;                 // 'hydrogen bond'
 * ```
 *
 * `residueKeys` is what the ends must point at — the keys of the rows the table
 * really has, IN ITS OWN ORDER — and it is an ARGUMENT rather than something
 * re-parsed here: the whole point of the key is that one module mints it
 * (`./etl.ts` · `residueKey`) and everything else agrees with the rows.
 */
export async function protInteractions(entry: HeadlessEntry, residueKeys: readonly string[]): Promise<ProtInteractions> {
  const { structure, address } = entry;
  for (const group of structure.unitSymmetryGroups) if (group.units.length > 1) throw new Error(SYMMETRY_REFUSAL);

  const [{ computeInteractions, InteractionsParams }, { InteractionFlag, interactionTypeLabel, featureTypeLabel }, { Features }, { Unit: UnitOf }, { Vec3 }, { SyncRuntimeContext }, { AssetManager }, { ParamDefinition }] = await Promise.all([
    import('molstar/lib/mol-model-props/computed/interactions/interactions.js'),
    import('molstar/lib/mol-model-props/computed/interactions/common.js'),
    import('molstar/lib/mol-model-props/computed/interactions/features.js'),
    import('molstar/lib/mol-model/structure.js'),
    import('molstar/lib/mol-math/linear-algebra.js'),
    import('molstar/lib/mol-task/execution/synchronous.js'),
    import('molstar/lib/mol-util/assets.js'),
    import('molstar/lib/mol-util/param-definition.js'),
  ]);
  const defaults = ParamDefinition.getDefaultValues(InteractionsParams);
  const providers = interactionProviders(defaults.providers as unknown as Record<string, { name: string }>);
  const interactions = await computeInteractions({ runtime: SyncRuntimeContext, assetManager: new AssetManager() }, structure, {});

  const hasRow = new Set(residueKeys);
  /** One `Features.Info` per unit, reused across that unit's contacts — the engine's own reader shape, and the only mutable thing here. */
  const infos = new Map<number, Features.Info>();
  const infoOf = (unit: Unit): Features.Info => {
    let info = infos.get(unit.id);
    if (info === undefined) {
      // the ENGINE'S OWN predicate, never a comparison with its enum's number: a
      // coarse-grained unit (a sphere, a Gaussian) has no atoms to name, and
      // `Features.Info` is declared over an atomic one
      if (!UnitOf.isAtomic(unit)) throw new Error(`the engine reported a contact in a non-atomic unit (${String(unit.id)}), which has no atoms to name`);
      info = Features.Info(structure, unit, interactions.unitsFeatures.get(unit.id));
      infos.set(unit.id, info);
    }
    return info;
  };
  const centreA = Vec3();
  const centreB = Vec3();

  /** One end, addressed — the feature's first member atom plus how many atoms the feature has. */
  const endpointOf = (unit: Unit, feature: Features.FeatureIndex): Endpoint => {
    const features = interactions.unitsFeatures.get(unit.id);
    const from = features.offsets[feature]!;
    const at = address(unit, features.members[from]!);
    return {
      key: at.key,
      chain: at.chain,
      resnum: at.resnum,
      atom: at.atom,
      atoms: features.offsets[feature + 1]! - from,
      feature: featureTypeLabel(features.types[feature]!).toLowerCase(),
      altLoc: at.altLoc,
      hetero: at.hetero,
    };
  };

  /** The separation of two features' centres — see {@link InteractionRow.separation}. */
  const separationOf = (unitA: Unit, featureA: Features.FeatureIndex, unitB: Unit, featureB: Features.FeatureIndex): number => {
    const infoA = infoOf(unitA);
    const infoB = infoOf(unitB);
    infoA.feature = featureA;
    infoB.feature = featureB;
    Features.position(centreA, infoA);
    Features.position(centreB, infoB);
    return Vec3.distance(centreA, centreB);
  };

  const rows: InteractionRow[] = [];
  /** How many rows each residue pair already has — the ordinal {@link interactionKey} needs. */
  const ordinals = new Map<string, number>();
  let reported = 0;
  let droppedRefined = 0;
  let droppedHetero = 0;
  let droppedNoRow = 0;
  let throughAlternateLocation = 0;

  const keep = (unitA: Unit, featureA: Features.FeatureIndex, unitB: Unit, featureB: Features.FeatureIndex, type: number, filtered: boolean): void => {
    reported += 1;
    if (filtered) {
      droppedRefined += 1;
      return;
    }
    const one = endpointOf(unitA, featureA);
    const two = endpointOf(unitB, featureB);
    if (one.hetero || two.hetero) {
      droppedHetero += 1;
      return;
    }
    if (!hasRow.has(one.key) || !hasRow.has(two.key)) {
      droppedNoRow += 1;
      return;
    }
    const [a, b] = fileOrder(one, two) <= 0 ? [one, two] : [two, one];
    const pair = `${a.key}${INTERACTION_KEY_SEPARATOR}${b.key}`;
    const ordinal = ordinals.get(pair) ?? 0;
    ordinals.set(pair, ordinal + 1);
    if (a.altLoc !== '' || b.altLoc !== '') throughAlternateLocation += 1;
    rows.push({
      interaction_key: interactionKey(a.key, b.key, ordinal),
      residue_a: a.key,
      residue_b: b.key,
      atom_a: a.atom,
      atom_b: b.atom,
      atoms_a: a.atoms,
      atoms_b: b.atoms,
      feature_a: a.feature,
      feature_b: b.feature,
      kind: interactionTypeLabel(type).toLowerCase(),
      separation: separationOf(unitA, featureA, unitB, featureB),
      crosses_chains: a.chain !== b.chain,
    });
  };

  // WITHIN a unit: the engine's adjacency graph holds every edge TWICE (its own
  // documented shape — `a` and `b` are both directions), so only the ordered
  // half is read. `edgeProps` is indexed the same way as `a`/`b`.
  for (const unit of structure.units) {
    const contacts = interactions.unitsContacts.get(unit.id);
    if (contacts === undefined) continue;
    for (let i = 0; i < contacts.a.length; i += 1) {
      if (contacts.a[i]! > contacts.b[i]!) continue;
      keep(unit, contacts.a[i]!, unit, contacts.b[i]!, contacts.edgeProps.type[i]!, contacts.edgeProps.flag[i] === InteractionFlag.Filtered);
    }
  }
  // BETWEEN units: `contacts.edges` holds each contact twice as well — the
  // inter-unit builder files every unit pair under both of its units — so the
  // ordered half is the whole set. Verified against the committed entry:
  // `edges.length` is 676 and 338 of them are ordered.
  for (const edge of interactions.contacts.edges) {
    if (edge.unitA > edge.unitB) continue;
    keep(structure.unitMap.get(edge.unitA), edge.indexA, structure.unitMap.get(edge.unitB), edge.indexB, edge.props.type, edge.props.flag === InteractionFlag.Filtered);
  }

  const byKind = new Map<string, number>();
  for (const row of rows) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);
  return {
    interactions: rows,
    counts: {
      reported,
      rows: rows.length,
      crossing: rows.filter((r) => r.crosses_chains).length,
      byKind: [...byKind.entries()].map(([kind, contacts]) => ({ kind, contacts })).sort((x, y) => y.contacts - x.contacts || (x.kind < y.kind ? -1 : 1)),
      providersOn: providers.on,
      providersOff: providers.off,
      throughAlternateLocation,
    },
    dropped: [
      { reason: 'filtered-by-the-engine', contacts: droppedRefined, why: DROP_REASONS.refined },
      { reason: 'water-or-hetero-end', contacts: droppedHetero, why: DROP_REASONS.hetero },
      { reason: 'end-has-no-row', contacts: droppedNoRow, why: DROP_REASONS.noRow },
    ],
  };
}

/**
 * THE PER-RESIDUE COUNTS, folded over the rows — stage A's columns channel.
 *
 * Three arrays, each aligned to `residues` position by position, which is the
 * shape the library's columns channel takes (`vizfootprint` · `session.ts` ·
 * `writeColumns` reads `snapshot.sharedState[<column>]` as an array over the
 * table's own row order).
 *
 *   `contacts`              how many contacts this residue is an end of.
 *   `interface_contacts`    how many of those cross to the other chain.
 *   `interface_separation`  the tightest of those, in Ångströms — and ABSENT
 *                           (`null`) for a residue with no crossing contact,
 *                           never 0: a separation of zero is two atoms at one
 *                           point, and "this residue does not touch the other
 *                           chain" is not a distance at all.
 *
 * A contact both of whose ends are the same residue counts ONCE for it, not
 * twice — the committed entry has none, and a fold that double-counted them
 * would make its own bar taller than the number of contacts.
 */
export interface ResidueContactColumns {
  readonly contacts: readonly number[];
  readonly interface_contacts: readonly number[];
  readonly interface_separation: readonly (number | null)[];
}

export function residueContactColumns(residueKeys: readonly string[], interactions: readonly InteractionRow[]): ResidueContactColumns {
  const all = new Map<string, number>();
  const crossing = new Map<string, number>();
  const tightest = new Map<string, number>();
  for (const row of interactions) {
    for (const key of row.residue_a === row.residue_b ? [row.residue_a] : [row.residue_a, row.residue_b]) {
      all.set(key, (all.get(key) ?? 0) + 1);
      if (!row.crosses_chains) continue;
      crossing.set(key, (crossing.get(key) ?? 0) + 1);
      const best = tightest.get(key);
      if (best === undefined || row.separation < best) tightest.set(key, row.separation);
    }
  }
  return {
    contacts: residueKeys.map((key) => all.get(key) ?? 0),
    interface_contacts: residueKeys.map((key) => crossing.get(key) ?? 0),
    interface_separation: residueKeys.map((key) => tightest.get(key) ?? null),
  };
}
