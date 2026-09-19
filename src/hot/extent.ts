/**
 * THE EXTENT — a hot spot is a PATCH IN SPACE, found by connected components
 * over Cα coordinates, and never a window along the sequence.
 *
 * ── WHY NOT A SEQUENCE WINDOW ──────────────────────────────────────────────
 * A fixed-width window forces a SHAPE onto the answer: it can only ever report
 * a contiguous run of residue numbers, so a real patch made of two loops that
 * meet in space — or, on a complex like this one, of residues from BOTH chains
 * — comes back as a range that includes everything between them and excludes
 * half of what is in it. What follows from that is a range somebody then has to
 * repair, which is the defect this desk exists to answer: a pipeline that
 * clamps a bad range has already decided to publish a shape it cannot support.
 *
 * Components carry no shape at all. A patch's members are its residues, full
 * stop. Two residues forty apart in sequence, or in two different chains, are
 * in the same patch when they are adjacent in space, and nothing has to be
 * clamped because nothing was ever a range. `tests/hot-extent.test.ts` pins a
 * real non-contiguous case on the committed entry.
 *
 * ── THE TWO DECLARED CONSTANTS ─────────────────────────────────────────────
 * {@link CA_CUTOFF} says when two residues are adjacent, and the threshold the
 * candidates are taken above is not here at all: it is `score.ts` ·
 * `INTERFACE_FLOOR`, folded from the weights so that it cannot drift away from
 * the score it is a threshold on.
 */
import { INTERFACE_FLOOR } from './score.js';

/**
 * WHEN TWO RESIDUES ARE ADJACENT IN SPACE — 8 ångström between alpha carbons.
 *
 * This is the field's own long-standing definition of residue contact: a Cα–Cα
 * contact map is conventionally drawn at 8 Å, and it is the number a structural
 * biologist reads without being told. It is comfortably above the 3.8 Å between
 * two residues that are neighbours in the chain, so a run of sequence is
 * trivially connected — which is correct and is not the interesting half. The
 * interesting half is that it is also above the Cα separation of two residues
 * packed against each other from different loops or different chains, which is
 * what makes a patch a patch.
 *
 * It is a CENTRE-TO-CENTRE distance between backbone atoms, so it says nothing
 * about which way the side chains point. That is the honest limit of this
 * cutoff and it is named here rather than papered over.
 */
export const CA_CUTOFF = 8;

/** What the components are computed over: a residue, its score and where its alpha carbon is. */
export interface PlacedResidue {
  readonly residue_key: string;
  readonly chain: string;
  readonly resnum: number;
  readonly ca_x: number;
  readonly ca_y: number;
  readonly ca_z: number;
  /** The structural score, or `null` where the residue has none — a residue with no score is in no patch. */
  readonly hotspot_structural: number | null;
}

/** One patch: its name, its members, and what the desk prints about it. */
export interface Patch {
  /** The name the column carries — `patch 1`, `patch 2`, in descending order of how many residues are in them. */
  readonly id: string;
  /** Its residues, by key, in the table's own order. */
  readonly members: readonly string[];
  /** Which chains it spans — one entry for a patch inside a single chain, two for one that bridges the interface. */
  readonly chains: readonly string[];
  /** The widest gap in residue NUMBER between two members of the same chain — 0 for a patch that is a contiguous run. */
  readonly widestSequenceGap: number;
  /** The highest structural score in the patch, and whose it is. */
  readonly peak: { readonly residue_key: string; readonly score: number };
}

/**
 * THE CANDIDATES — every residue whose structural score is ABOVE the floor the
 * weights themselves set.
 *
 * Above `INTERFACE_FLOOR` is exactly the statement *the interface tracks said
 * something about this residue*: with both of them absent or zero a residue
 * cannot reach past the burial and hydropathy budget (`./score.ts` explains the
 * fold). So this is not a threshold somebody tuned until the picture looked
 * right — it is the only line on the scale that means something, and it moves
 * by itself if a weight ever changes.
 *
 * A residue with NO structural score at all is not a candidate, and that is a
 * different statement from scoring below the floor: `null` is *nothing measured
 * this residue*, and it is left out rather than sorted to the bottom.
 */
export const hotResidues = (residues: readonly PlacedResidue[]): readonly PlacedResidue[] => residues.filter((r) => r.hotspot_structural !== null && r.hotspot_structural > INTERFACE_FLOOR);

/** Squared Cα separation — squared, because a comparison against a cutoff needs no square root and a square root of 185² pairs is the one cost worth not paying. */
const gapSquared = (a: PlacedResidue, b: PlacedResidue): number => (a.ca_x - b.ca_x) ** 2 + (a.ca_y - b.ca_y) ** 2 + (a.ca_z - b.ca_z) ** 2;

/**
 * THE PATCHES — connected components of the candidates under {@link CA_CUTOFF}.
 *
 * ```ts
 * const patches = hotspotPatches(residues);
 * patches[0]?.members;        // the residue keys, never a range
 * patches[0]?.chains;         // ['A','B'] for a patch that bridges the interface
 * ```
 *
 * A plain breadth-first walk over an adjacency the loop builds as it goes: the
 * candidate set is small (a hot spot is a minority of any structure by
 * definition) and the honest cost of the pairwise pass is what it is. The
 * patches come back LARGEST FIRST so that `patch 1` is a stable name for the
 * biggest one, and ties are broken by the first member's key so two runs over
 * the same rows can never name the same patch differently.
 */
export function hotspotPatches(residues: readonly PlacedResidue[], cutoff: number = CA_CUTOFF): readonly Patch[] {
  const hot = hotResidues(residues);
  const limit = cutoff * cutoff;
  const unseen = new Set(hot.map((_, at) => at));
  const found: { readonly members: readonly PlacedResidue[] }[] = [];

  while (unseen.size > 0) {
    const first = unseen.values().next().value as number;
    unseen.delete(first);
    const members: PlacedResidue[] = [hot[first]!];
    const queue: number[] = [first];
    while (queue.length > 0) {
      const at = queue.pop() as number;
      for (const other of [...unseen]) {
        if (gapSquared(hot[at]!, hot[other]!) > limit) continue;
        unseen.delete(other);
        members.push(hot[other]!);
        queue.push(other);
      }
    }
    found.push({ members });
  }

  return found
    .map(({ members }) => {
      const ordered = [...members].sort((a, b) => (a.chain === b.chain ? a.resnum - b.resnum : a.chain.localeCompare(b.chain)));
      const peak = ordered.reduce((best, r) => ((r.hotspot_structural ?? 0) > (best.hotspot_structural ?? 0) ? r : best), ordered[0]!);
      return {
        members: ordered.map((r) => r.residue_key),
        chains: [...new Set(ordered.map((r) => r.chain))],
        widestSequenceGap: widestGap(ordered),
        peak: { residue_key: peak.residue_key, score: peak.hotspot_structural ?? 0 },
      };
    })
    .sort((a, b) => b.members.length - a.members.length || (a.members[0] ?? '').localeCompare(b.members[0] ?? ''))
    .map((patch, at) => ({ id: patchName(at), ...patch }));
}

/** What a patch is called on the column and in the picture — one owner of the spelling. */
export const patchName = (at: number): string => `patch ${String(at + 1)}`;

/**
 * THE WIDEST JUMP IN RESIDUE NUMBER inside one chain of a patch — the number
 * that says out loud whether a sliding window could ever have found this patch.
 *
 * 0 means the patch's residues in that chain are a contiguous run. Anything
 * above 1 means a window would have had to include residues that are not in the
 * patch to cover it, which is the repair-a-bad-range defect arriving by the
 * front door.
 */
export function widestGap(ordered: readonly PlacedResidue[]): number {
  let widest = 0;
  for (const chain of new Set(ordered.map((r) => r.chain))) {
    const numbers = ordered.filter((r) => r.chain === chain).map((r) => r.resnum);
    for (let at = 1; at < numbers.length; at += 1) widest = Math.max(widest, numbers[at]! - numbers[at - 1]! - 1);
  }
  return widest;
}

/** The patch column, one value per row in the table's own order — `null` for a residue in no patch. */
export function patchColumn(residues: readonly PlacedResidue[], patches: readonly Patch[]): readonly (string | null)[] {
  const byKey = new Map<string, string>();
  for (const patch of patches) for (const member of patch.members) byKey.set(member, patch.id);
  return residues.map((r) => byKey.get(r.residue_key) ?? null);
}
