/**
 * THE TWO SCORES — structural and prior, and they never become one number.
 *
 * ── WHY TWO ────────────────────────────────────────────────────────────────
 * The **structural** score is folded from what is true of THIS molecule: how
 * many contacts the residue makes across the interface, how tight the tightest
 * of them is, how much of the residue the solvent can no longer reach, and how
 * hydrophobic its type is. The **prior** score is folded from what somebody has
 * already published about something SIMILAR: an IEDB epitope, and how far
 * inside a Pfam domain the residue sits.
 *
 * Collapsing them into one weighted sum would lose the one cell a reader of
 * this desk is actually looking for — **high on both** — and would let a prior
 * track that said nothing about this entry (which is exactly what the IEDB did;
 * see {@link EPITOPE_TERM}) deflate a structural score that measured something
 * real. So there are two columns, two runs, and one scatter whose whole job is
 * the corner where both are high (`./def.ts` · `TOGETHER_VIEW`).
 *
 * ── ABSENCE PROPAGATES; IT NEVER DEFAULTS ──────────────────────────────────
 * Every term is `null` where its track said nothing about the residue, and a
 * `null` term **contributes nothing and the weights are NOT renormalised**.
 * That is the load-bearing decision in this file, so here is the argument:
 * renormalising would mean a residue with one term out of four scoring on that
 * term alone and beating a residue every track measured — which is a score that
 * goes UP when the evidence goes DOWN. Instead the weights are a fixed budget
 * summing to 1, a residue can only reach the part of it its tracks paid for,
 * and the BASIS column beside the score says which terms it saw and which it
 * did not (the `conservation_basis` precedent, `src/prot/analyses.ts`).
 *
 * A residue for which NO term of a score is present has **no score at all** —
 * `null`, never 0 — because 0 would be a measurement of "not a hot spot" that
 * nothing measured.
 *
 * ── AND WHAT THE STRUCTURAL SCORE IS NOT ───────────────────────────────────
 * It is a MEASUREMENT and it lands as a column like any other, bindable to any
 * chart. It is not a recommendation, nothing here ranks and nothing here writes
 * a sentence. The only thing on this desk that wears the recommendation
 * register is prose about already-computed picks, and it is not built in this
 * packet (`./analyses.ts` says what is left for it).
 *
 * ── ONE LIMIT, NAMED RATHER THAN HIDDEN ────────────────────────────────────
 * {@link BURIAL_TERM} answers high for a residue buried in the CORE of its own
 * chain, which is not a hot spot of an interface. Nothing here corrects for
 * that, because the correction would be a second, hidden interface test inside
 * a burial term. What keeps the score honest instead is the OTHER half: a core
 * residue takes nothing from either interface term, so it cannot pass
 * {@link INTERFACE_FLOOR}, which is where the extent stage starts
 * (`./extent.ts`).
 */
import { KD_MAX, KD_MIN } from './hydropathy.js';

// ── the terms, named once ────────────────────────────────────────────────────

/** How many contacts the residue makes across the chain boundary — `src/prot/analyses.ts` · `INTERFACE_CONTACTS_COLUMN`. */
export const CROSSING_TERM = 'interface_contacts';
/** The tightest of those crossing contacts, in ångström — `INTERFACE_SEPARATION_COLUMN`. ABSENT, never 0, where the residue touches no other chain. */
export const TIGHTNESS_TERM = 'interface_separation';
/** How much of the residue the solvent can still reach, as a fraction of its type's published maximum — `RELATIVE_SASA_COLUMN`. */
export const BURIAL_TERM = 'relative_sasa';
/** Kyte & Doolittle hydropathy of the residue type — `./hydropathy.ts`. */
export const HYDROPATHY_TERM = 'hydropathy';
/** The IEDB's own epitope identifier — `EPITOPE_COLUMN`. */
export const EPITOPE_TERM = 'epitope';
/** The Pfam accession InterPro matched, and how far inside it the residue sits — `PFAM_DOMAIN_COLUMN`. */
export const DOMAIN_TERM = 'pfam_domain';

/** Every term of the structural score, in the order the basis prints them. */
export const STRUCTURAL_TERMS = [CROSSING_TERM, TIGHTNESS_TERM, BURIAL_TERM, HYDROPATHY_TERM] as const;
/** Every term of the prior score, in the order the basis prints them. */
export const PRIOR_TERMS = [EPITOPE_TERM, DOMAIN_TERM] as const;

// ── the weights, each with its value and its reason ──────────────────────────

/**
 * THE STRUCTURAL BUDGET — four weights, summing to exactly 1, and the split is
 * argued in two halves rather than four numbers.
 *
 * **The two halves are equal (0.50 each).** The first two terms say the residue
 * is AT the interface; the second two say it is the KIND of residue that makes
 * a hot spot when it is. Neither half can carry the score alone — a buried
 * leucine in the core is not a hot spot, and a lysine making one long contact
 * across the interface is not one either — so neither half outweighs the other.
 *
 * **Inside the interface half, the COUNT outweighs the DISTANCE (0.30 vs
 * 0.20).** How many contacts a residue makes across the boundary is a count of
 * real interactions; the tightest separation is a property of exactly ONE of
 * them. A residue with six crossing contacts whose closest is 2.6 Å and a
 * residue with one crossing contact at 2.6 Å have the same tightness and are
 * plainly not the same residue.
 *
 * **Inside the other half, BURIAL outweighs HYDROPATHY (0.30 vs 0.20).** Burial
 * is measured on THIS molecule — a solvent probe rolled over these coordinates
 * with the partner chain in place — while hydropathy is a property of the
 * residue TYPE and says nothing about this structure at all. A measurement of
 * the thing in front of us outweighs a table lookup on its name.
 */
export const W_CROSSING = 0.3;
export const W_TIGHTNESS = 0.2;
export const W_BURIAL = 0.3;
export const W_HYDROPATHY = 0.2;

/**
 * THE PRIOR BUDGET — two weights, summing to exactly 1.
 *
 * **An epitope outweighs a domain (0.60 vs 0.40)** because it is a claim of a
 * different grain. The IEDB names a short stretch somebody OBSERVED being
 * recognised; a Pfam domain names a functional unit a hundred residues long, so
 * as evidence about any ONE residue it is much coarser. The finer prior carries
 * more of the budget, and the coarser one can never reach the top of the scale
 * on its own — which is the honest statement about a residue whose only prior
 * is "it is somewhere inside a domain".
 */
export const W_EPITOPE = 0.6;
export const W_DOMAIN = 0.4;

// ── the normalisations, each with its ends argued ────────────────────────────

/**
 * WHERE THE CROSSING COUNT SATURATES — six contacts.
 *
 * A side chain presents a bounded number of contact-capable features, and
 * across a protein–protein interface the per-residue count is small. Six is
 * where a residue is already making about as much of the interface as one
 * residue can; the difference between six and nine is not the difference
 * between a hot spot and not one.
 *
 * MEASURED on the committed entry as a CHECK and not as the source: the highest
 * crossing count there is 6 (`A:40`), so no residue of this entry is clipped by
 * this ceiling. `tests/hot-score.test.ts` pins that, so the day an entry
 * arrives whose residues exceed it the claim is re-measured rather than
 * believed.
 */
export const CROSSING_SATURATION = 6;

/**
 * THE TWO ENDS OF THE TIGHTNESS RAMP, in ångström.
 *
 * `SEPARATION_NEAR` (2.5 Å) is about where a hydrogen bond's heavy atoms sit:
 * below it two features are in contact and nothing tighter is a further claim.
 * `SEPARATION_FAR` (5.0 Å) is past where Mol*'s own interaction tests report a
 * contact at all, so a separation at or beyond it carries no proximity signal —
 * and a residue that HAS this column by definition has a contact, so the ramp's
 * far end is the weakest contact the engine will report rather than a cutoff
 * this desk imposes.
 *
 * MEASURED on the committed entry: the eighteen residues carrying this column
 * span 2.59 Å to 4.15 Å, so neither end clips anything here.
 */
export const SEPARATION_NEAR = 2.5;
export const SEPARATION_FAR = 5.0;

/**
 * HOW WIDE A DOMAIN'S EDGE BAND IS — five residues.
 *
 * The prior a Pfam match carries is *somebody has already named this region*,
 * and at the boundary residue that naming is least certain: the alignment which
 * placed the domain is itself fuzzy within a few positions of its ends. Five
 * residues is the shortest run of sequence that has a structure of its own —
 * about one and a half turns of an α-helix, and the short end of a β-strand —
 * and therefore the smallest band over which *is it inside the domain* is a
 * real question. A residue that deep or deeper takes the whole domain term; one
 * on the boundary itself takes none of it.
 */
export const DOMAIN_EDGE_RESIDUES = 5;

/**
 * THE SCORE A RESIDUE CAN REACH WITH NO INTERFACE EVIDENCE AT ALL — and it is
 * FOLDED from the weights, never a number anybody picked.
 *
 * With both interface terms at nothing, the most a residue can score is
 * `W_BURIAL + W_HYDROPATHY`. So *above this floor* is exactly the same
 * statement as *the interface tracks said something about this residue*, which
 * is what the extent stage thresholds on (`./extent.ts` · `hotResidues`). Move
 * a weight and the floor moves with it, which is the only way a threshold and
 * the thing it is a threshold ON can stay one fact.
 */
export const INTERFACE_FLOOR = W_BURIAL + W_HYDROPATHY;

// ── what a score is ──────────────────────────────────────────────────────────

/** One term's own account of itself — what it weighs, what it saw, and what it therefore put in. */
export interface ScoreTerm {
  readonly term: string;
  readonly weight: number;
  /** The term's value on 0…1, or `null` where its track said nothing about this residue. */
  readonly value: number | null;
  /** `weight × value`, or 0 for an absent term — see the file header on why the weights are not renormalised. */
  readonly contribution: number;
}

/** A score, its basis and the terms behind it. */
export interface Scored {
  /** 0…1, or `null` where NO term was present — never 0 for "nothing measured". */
  readonly score: number | null;
  /** The sentence that lands beside the score, saying which terms it rests on. See {@link basisOf}. */
  readonly basis: string | null;
  readonly terms: readonly ScoreTerm[];
}

/** The columns of one residue the two scores read — the structure's own row, narrowed to the tracks. */
export interface ResidueTracks {
  readonly residue_key: string;
  readonly chain: string;
  readonly resnum: number;
  readonly interface_contacts: number | null;
  readonly interface_separation: number | null;
  readonly relative_sasa: number | null;
  readonly hydropathy: number | null;
  readonly epitope: string | null;
  readonly pfam_domain: string | null;
}

// ── the arithmetic ───────────────────────────────────────────────────────────

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A number, or `null` for anything a track did not land — `undefined`, `null` and a non-finite number are all *nothing was measured*. */
export const measured = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A word, or `null` — a column whose absence is the source having named nothing. */
export const named = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

const term = (name: string, weight: number, value: number | null): ScoreTerm => ({ term: name, weight, value, contribution: value === null ? 0 : weight * value });

/**
 * THE BASIS — which terms this score saw and which it did not, in one string
 * beside the number.
 *
 * The `conservation_basis` precedent (`src/prot/analyses.ts`): a number whose
 * evidence lives only in a caption is a number a reader can quote with nothing
 * behind it. The counted prefix is first so the string sorts and filters by how
 * much evidence the score rests on, and the absent terms are NAMED rather than
 * counted, because *which* track was silent is the whole question.
 *
 * `null` where no term was present at all — there is no basis for a score that
 * does not exist.
 */
export function basisOf(terms: readonly ScoreTerm[]): string | null {
  const saw = terms.filter((t) => t.value !== null).map((t) => t.term);
  if (saw.length === 0) return null;
  const missed = terms.filter((t) => t.value === null).map((t) => t.term);
  const head = `${String(saw.length)} of ${String(terms.length)} terms: ${saw.join(', ')}`;
  return missed.length === 0 ? head : `${head} — absent: ${missed.join(', ')}`;
}

const fold = (terms: readonly ScoreTerm[]): Scored =>
  terms.every((t) => t.value === null) ? { score: null, basis: null, terms } : { score: terms.reduce((sum, t) => sum + t.contribution, 0), basis: basisOf(terms), terms };

/**
 * THE STRUCTURAL SCORE — what is true of this molecule, on 0…1.
 *
 * ```ts
 * structuralScore({ ...tracks, interface_contacts: 6, interface_separation: 2.59, relative_sasa: 0.168, hydropathy: -4.5 }).score;
 * // 0.30·1 + 0.20·0.964 + 0.30·0.832 + 0.20·0 = 0.7426…
 * ```
 */
export function structuralScore(tracks: ResidueTracks): Scored {
  const crossing = measured(tracks.interface_contacts);
  const tightness = measured(tracks.interface_separation);
  const burial = measured(tracks.relative_sasa);
  const hydropathy = measured(tracks.hydropathy);
  return fold([
    term(CROSSING_TERM, W_CROSSING, crossing === null ? null : clamp01(crossing / CROSSING_SATURATION)),
    term(TIGHTNESS_TERM, W_TIGHTNESS, tightness === null ? null : clamp01((SEPARATION_FAR - tightness) / (SEPARATION_FAR - SEPARATION_NEAR))),
    // BURIAL IS THE COMPLEMENT of what the solvent can still reach: 0 exposure is
    // a residue entirely covered — here, by the partner chain (`src/prot/analyses.ts`
    // rolls the probe with it in place). Clamped above 1 because a relative area
    // is a ratio against a published maximum and can exceed it.
    term(BURIAL_TERM, W_BURIAL, burial === null ? null : clamp01(1 - burial)),
    // THE SCALE'S OWN ENDS, not a range read off this entry — so the term means
    // the same thing on every structure this desk is ever opened on.
    term(HYDROPATHY_TERM, W_HYDROPATHY, hydropathy === null ? null : clamp01((hydropathy - KD_MIN) / (KD_MAX - KD_MIN))),
  ]);
}

/** Where one Pfam domain starts and stops ON THIS ENTRY'S OWN NUMBERING — see {@link domainExtents}. */
export interface DomainExtent {
  readonly chain: string;
  readonly accession: string;
  readonly lo: number;
  readonly hi: number;
}

/** The key one extent is filed under: a domain is a match on ONE chain, and the same accession on two chains is two extents. */
export const domainKey = (chain: string, accession: string): string => `${chain}|${accession}`;

/**
 * WHERE EACH DOMAIN STARTS AND STOPS, read off THE ROWS.
 *
 * The structure owns the residue axis here as everywhere else on this desk: a
 * domain's edge is where its column stops on THIS entry's own residue
 * numbering, never a position in the reference sequence the match was made
 * against. Anything else would mean a term computed on one axis landing on
 * rows keyed by another — the defect this whole desk is an answer to.
 */
export function domainExtents(rows: readonly ResidueTracks[]): ReadonlyMap<string, DomainExtent> {
  const found = new Map<string, DomainExtent>();
  for (const row of rows) {
    const accession = named(row.pfam_domain);
    if (accession === null) continue;
    const key = domainKey(row.chain, accession);
    const seen = found.get(key);
    found.set(key, seen === undefined ? { chain: row.chain, accession, lo: row.resnum, hi: row.resnum } : { ...seen, lo: Math.min(seen.lo, row.resnum), hi: Math.max(seen.hi, row.resnum) });
  }
  return found;
}

/**
 * THE PRIOR SCORE — what somebody has already published, on 0…1.
 *
 * On the committed entry the epitope term is absent on EVERY residue, and that
 * is a real answer rather than a gap: the IEDB was asked about both chains,
 * answered, and named no epitope, so `src/prot/analyses.ts` writes no `epitope`
 * column at all. Every prior score on this entry therefore rests on the domain
 * term alone and says so in its basis — and can reach at most {@link W_DOMAIN}.
 */
export function priorScore(tracks: ResidueTracks, domains: ReadonlyMap<string, DomainExtent>): Scored {
  const epitope = named(tracks.epitope);
  const accession = named(tracks.pfam_domain);
  const extent = accession === null ? undefined : domains.get(domainKey(tracks.chain, accession));
  const depth = extent === undefined ? null : Math.min(tracks.resnum - extent.lo, extent.hi - tracks.resnum);
  return fold([
    // THE FIXTURE CARRIES NO E-VALUE, so present-against-absent is the whole of
    // this prior and the term is 1 wherever the source named anything. If an
    // entry's evidence ever carries a strength, this is the one line that would
    // read it — and until it does, saying so is cheaper than a scale nothing
    // fills in.
    term(EPITOPE_TERM, W_EPITOPE, epitope === null ? null : 1),
    term(DOMAIN_TERM, W_DOMAIN, depth === null ? null : clamp01(depth / DOMAIN_EDGE_RESIDUES)),
  ]);
}
