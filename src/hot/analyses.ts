/**
 * THE FIFTH DESK'S ACTS — three of its own, and FOUR COLUMNS IT DOES NOT
 * RECOMPUTE.
 *
 * ── WHAT IS REUSED, AND HOW ────────────────────────────────────────────────
 * Four of this desk's five measurement tracks are already landed on `residues`
 * by the protein desk's own acts, and {@link hotAnalyses} REUSES THOSE
 * DECLARATIONS — it calls `src/prot/analyses.ts` · `protAnalyses` and files
 * three of the slots it hands back under their own ids. Not a copy, not a
 * re-implementation: the same `AnalysisDef`, the same flowchart, the same
 * honesty notes, one owner.
 *
 * | track                    | column(s)                                     | whose act |
 * |--------------------------|-----------------------------------------------|-----------|
 * | Cα interface distance    | `interface_contacts`, `interface_separation`   | `residueContacts` (reused) |
 * | solvent accessibility    | `sasa`, `relative_sasa`                        | `residueSurface` (reused)  |
 * | IEDB epitope             | `epitope`                                      | `residueAnnotation` (reused) |
 * | Pfam domain              | `pfam_domain`                                  | `residueAnnotation` (reused) |
 * | Kyte–Doolittle hydropathy| `hydropathy`                                   | {@link HYDROPATHY_ACT} — the one that was missing |
 *
 * The whole argument of this desk is that those tracks are ALREADY REAL
 * MEASUREMENTS. Re-measuring them here would be the opposite of the point, and
 * a second implementation of a fold that already has one is the one nobody
 * tests.
 *
 * Two acts of `protAnalyses` are deliberately NOT filed: `interactionPairs`
 * (whose rows never enter the data space, so no score could read them) and
 * `residueConservation` (a fifth track this desk does not score on). An act
 * declared and never dispatched would be a def claiming a stage it does not
 * perform — the law `src/prot/plan.ts` already keeps.
 *
 * ── AND THREE ACTS OF ITS OWN, IN THE ORDER THEY MUST LAND ─────────────────
 *   {@link HYDROPATHY_ACT}  the missing track, by table lookup on `resname`
 *   {@link SCORE_ACT}       the two scores and their two bases, over the five tracks
 *   {@link EXTENT_ACT}      the patches, over the structural score and the Cα coordinates
 *
 * Each reads what the ones before it landed, because an act's `toRunInput` is
 * handed the rows AT THE CURSOR — so the residue axis every track joins onto is
 * the STRUCTURE'S own `residue_key`, read off the table, and never a sequence a
 * track brought with it. That is decision one of this desk's design, and it is
 * kept by construction rather than by a check.
 *
 * ── NO MODEL IS ASKED ANYWHERE IN THIS FILE ────────────────────────────────
 * The score is arithmetic. There is no key, no provider and no prose stage in
 * this packet; what a prose stage WOULD be is written down in
 * {@link WHAT_A_PROSE_STAGE_WOULD_BE} rather than half-built.
 */
import { flowChart } from 'footprintjs';
import type { AnalysisDef, AnalysisResult, ColumnsOutput, OutputColumnType } from 'vizfootprint/analysis';
import type { AnalysisSlot } from 'vizfootprint/def';
import { ACT_KEY_COLUMN, ACT_TABLE, ANNOTATION_ACT, CONTACTS_ACT, EPITOPE_COLUMN, INTERFACE_CONTACTS_COLUMN, INTERFACE_SEPARATION_COLUMN, PFAM_DOMAIN_COLUMN, RELATIVE_SASA_COLUMN, SURFACE_ACT, libraryChart, protAnalyses } from '../prot/analyses.js';
import type { AnnotationEvidence } from '../prot/annotationEvidence.js';
import { NO_HYDROPATHY, hydropathyOf } from './hydropathy.js';
import { CA_CUTOFF, hotspotPatches, patchColumn, type Patch, type PlacedResidue } from './extent.js';
import {
  CROSSING_SATURATION,
  DOMAIN_EDGE_RESIDUES,
  INTERFACE_FLOOR,
  PRIOR_TERMS,
  SEPARATION_FAR,
  SEPARATION_NEAR,
  STRUCTURAL_TERMS,
  W_BURIAL,
  W_CROSSING,
  W_DOMAIN,
  W_EPITOPE,
  W_HYDROPATHY,
  W_TIGHTNESS,
  domainExtents,
  priorScore,
  structuralScore,
  type ResidueTracks,
} from './score.js';

// ── the act ids and the column names, once ───────────────────────────────────

export const HYDROPATHY_ACT = 'residueHydropathy';
export const SCORE_ACT = 'residueHotspotScore';
export const EXTENT_ACT = 'residueHotspotPatch';

/** The column {@link HYDROPATHY_ACT} lands — ABSENT for a residue type the published scale does not cover. */
export const HYDROPATHY_COLUMN = 'hydropathy';
/** The columns {@link SCORE_ACT} lands — two scores, and the basis beside each of them. */
export const STRUCTURAL_COLUMN = 'hotspot_structural';
export const STRUCTURAL_BASIS_COLUMN = 'hotspot_structural_basis';
export const PRIOR_COLUMN = 'hotspot_prior';
export const PRIOR_BASIS_COLUMN = 'hotspot_prior_basis';
/** The column {@link EXTENT_ACT} lands — the patch a residue belongs to, ABSENT for a residue in none. */
export const PATCH_COLUMN = 'hotspot_patch';

/** The stage ids, which are also the keys the stepper and the captions name a stage by. */
export const HYDROPATHY_STAGE = 'hydropathy';
export const SCORE_STAGE = 'score';
export const EXTENT_STAGE = 'extent';

// ── what each act's answer carries beyond its channel ────────────────────────

/** What the hydropathy act counted: how many residues the published scale covers, and every name it does not. */
export interface HydropathyOutput extends ColumnsOutput {
  readonly counts: { readonly residues: number; readonly scored: number };
  /** One sentence per residue TYPE the scale does not cover, with the name the file gave it. Empty on the committed entry. */
  readonly refusals: readonly string[];
}

/** What the score act counted — per term, how many residues it was present on. */
export interface ScoreOutput extends ColumnsOutput {
  readonly counts: {
    readonly residues: number;
    readonly structural: number;
    readonly prior: number;
    /** `term → how many residues carried it`, for both scores' terms. */
    readonly seen: Readonly<Record<string, number>>;
  };
}

/** What the extent act found: the patches themselves, largest first. */
export interface ExtentOutput extends ColumnsOutput {
  readonly patches: readonly Patch[];
  readonly counts: { readonly candidates: number; readonly patched: number; readonly cutoff: number; readonly floor: number };
}

// ── the rows an act reads ────────────────────────────────────────────────────

/** The rows the session hands an act at the cursor. */
type KeyedRow = Readonly<Record<string, unknown>>;

const keyOf = (row: KeyedRow): string => String(row[ACT_KEY_COLUMN]);
const numberOr = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const textOr = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/** What every act here reads on `residues`. Inert documentation, and the slice read-set hint. */
const RESIDUE_INPUTS = [{ column: ACT_KEY_COLUMN, role: 'identifier' as const }];

/** An act's own array of values off the finished run's state — the `src/prot/analyses.ts` · `valuesAt` shape, and the same reason for it. */
function valuesAt(state: Readonly<Record<string, unknown>>, column: string): readonly unknown[] {
  const values = state[column];
  return Array.isArray(values) ? (values as readonly unknown[]) : [];
}

// ── act one: the missing track ───────────────────────────────────────────────

/** What the hydropathy act is handed: the residue types, on the structure's own axis. */
interface HydropathyArgs {
  readonly residues: readonly { readonly key: string; readonly resname: string }[];
  readonly source: string;
}

/** The published source, on the commit log — what a reader of the record needs to check the twenty numbers. */
export const HYDROPATHY_SOURCE = 'Kyte J., Doolittle R.F., J. Mol. Biol. 157:105–132 (1982), as ExPASy ProtScale prints the scale at https://web.expasy.org/protscale/pscale/Hphob.Doolittle.html';

/**
 * THE ONE TRACK THIS REPOSITORY WAS MISSING — hydropathy, from the residue name
 * the file itself gives.
 *
 * It reads no geometry and calls no service: twenty published numbers and a
 * lookup. What makes it an ACT rather than a column of the ETL is the same
 * thing that makes the other four acts: the value is somebody else's published
 * work, it lands as a commit with that citation on it, and the chart over it is
 * refused by name until it has.
 */
function hydropathyAnalysis(): AnalysisDef<readonly KeyedRow[], HydropathyOutput> {
  return {
    id: HYDROPATHY_ACT,
    kind: 'transform',
    produces: 'columns',
    inputs: RESIDUE_INPUTS,
    honesty: {
      notes:
        `NOTHING IS COMPUTED HERE: the value is ${HYDROPATHY_SOURCE}, looked up on the residue name this file gives, never re-coded and never mapped onto a parent residue type. ` +
        'A residue type the scale does not cover is ABSENT — never 0 — because 0 is a real value on this scale (glycine is −0.4, cysteine +2.5), so a default would be a fabricated measurement rather than a neutral one.',
    },
    build: () =>
      libraryChart(
        flowChart<{ readonly hydropathy: readonly (number | null)[]; readonly counts: HydropathyOutput['counts']; readonly refusals: readonly string[] }>(
          'Look up each residue type’s published hydropathy',
          (scope) => {
            const args = scope.$getArgs() as unknown as HydropathyArgs;
            const values = args.residues.map((r) => hydropathyOf(r.resname));
            const unknownNames = [...new Set(args.residues.filter((_, at) => values[at] === null).map((r) => r.resname))];
            scope.$setValue(HYDROPATHY_COLUMN, values);
            scope.$setValue('counts', { residues: args.residues.length, scored: values.filter((v) => v !== null).length });
            scope.$setValue('refusals', unknownNames.map(NO_HYDROPATHY));
          },
          'kyte-doolittle',
        ).build(),
      ),
    toRunInput: (rows): HydropathyArgs => ({ residues: rows.map((r) => ({ key: keyOf(r), resname: String(r['resname'] ?? '') })), source: HYDROPATHY_SOURCE }),
    readOutput: ({ snapshot }): AnalysisResult<HydropathyOutput> => {
      const state = snapshot.sharedState as Readonly<Record<string, unknown>>;
      return {
        ok: true,
        output: {
          as: 'columns',
          table: ACT_TABLE,
          columns: { [HYDROPATHY_COLUMN]: { type: 'float', role: 'measure', label: 'Kyte & Doolittle hydropathy of the residue type, −4.5 (arginine) to +4.5 (isoleucine) — absent for a type the published scale does not cover' } },
          counts: state['counts'] as HydropathyOutput['counts'],
          refusals: valuesAt(state, 'refusals') as readonly string[],
        },
      };
    },
  };
}

// ── act two: the two scores ──────────────────────────────────────────────────

/** What the score act is handed: the five tracks, joined on the structure's own residue keys. */
interface ScoreArgs {
  readonly rows: readonly ResidueTracks[];
  /** The weights and the ramps, on the commit log — so a reader of the record can redo the arithmetic without reading this file. */
  readonly weights: Readonly<Record<string, number>>;
}

/**
 * THE TWO SCORES, AS FOUR COLUMNS — and they stay two numbers.
 *
 * There is no blended column here and there will not be one: the cell a reader
 * of this desk is looking for is *high on both*, and one sum cannot say it
 * (`./score.ts` carries the argument). The two bases land beside the two
 * scores, following `conservation_basis`: a score whose terms were only ever in
 * a caption is a number nobody can check.
 */
function scoreAnalysis(): AnalysisDef<readonly KeyedRow[], ScoreOutput> {
  return {
    id: SCORE_ACT,
    kind: 'transform',
    produces: 'columns',
    inputs: RESIDUE_INPUTS,
    honesty: {
      notes:
        `TWO SCORES, NEVER ONE: "${STRUCTURAL_COLUMN}" is folded from what is true of THIS molecule (${STRUCTURAL_TERMS.join(', ')}) and "${PRIOR_COLUMN}" from what somebody has already published about something similar (${PRIOR_TERMS.join(', ')}). They are not added together anywhere, because the interesting answer is a residue high on both and one number cannot carry it. ` +
        `THE WEIGHTS ARE A FIXED BUDGET summing to 1 and are NOT renormalised over the terms that landed: an absent term contributes nothing, so a residue can only reach the part of the budget its own evidence paid for, and the basis column beside each score names every term it saw and every term it did not. ` +
        `A residue for which NO term of a score is present carries no score at all — absent, never 0. ` +
        `THE CONSTANTS: crossing contacts saturate at ${String(CROSSING_SATURATION)}; the tightness ramp runs from ${String(SEPARATION_NEAR)} Å to ${String(SEPARATION_FAR)} Å; a Pfam domain's edge band is ${String(DOMAIN_EDGE_RESIDUES)} residues wide, measured on THIS entry's own numbering and never on the reference sequence the match was made against. ` +
        `NOTHING HERE RANKS AND NOTHING HERE RECOMMENDS: both columns are measurements and land like any other column, bindable to any chart.`,
    },
    build: () =>
      libraryChart(
        flowChart<{
          readonly hotspot_structural: readonly (number | null)[];
          readonly hotspot_structural_basis: readonly (string | null)[];
          readonly hotspot_prior: readonly (number | null)[];
          readonly hotspot_prior_basis: readonly (string | null)[];
          readonly counts: ScoreOutput['counts'];
        }>(
          'Score every residue on what this molecule shows, and on what is already published',
          (scope) => {
            const args = scope.$getArgs() as unknown as ScoreArgs;
            const domains = domainExtents(args.rows);
            const structural = args.rows.map((row) => structuralScore(row));
            const prior = args.rows.map((row) => priorScore(row, domains));
            const seen: Record<string, number> = {};
            for (const scored of [...structural, ...prior]) for (const t of scored.terms) if (t.value !== null) seen[t.term] = (seen[t.term] ?? 0) + 1;
            scope.$setValue(STRUCTURAL_COLUMN, structural.map((s) => s.score));
            scope.$setValue(STRUCTURAL_BASIS_COLUMN, structural.map((s) => s.basis));
            scope.$setValue(PRIOR_COLUMN, prior.map((s) => s.score));
            scope.$setValue(PRIOR_BASIS_COLUMN, prior.map((s) => s.basis));
            scope.$setValue('counts', {
              residues: args.rows.length,
              structural: structural.filter((s) => s.score !== null).length,
              prior: prior.filter((s) => s.score !== null).length,
              seen,
            });
          },
          'two-scores',
        ).build(),
      ),
    toRunInput: (rows): ScoreArgs => ({
      // THE AXIS IS THE STRUCTURE'S. Every track is read off the row the session
      // handed over, under the key the table declares — no track brings its own
      // sequence and nothing is joined by position.
      rows: rows.map((r) => ({
        residue_key: keyOf(r),
        chain: String(r['chain'] ?? ''),
        resnum: Number(r['resnum']),
        interface_contacts: numberOr(r[INTERFACE_CONTACTS_COLUMN]),
        interface_separation: numberOr(r[INTERFACE_SEPARATION_COLUMN]),
        relative_sasa: numberOr(r[RELATIVE_SASA_COLUMN]),
        hydropathy: numberOr(r[HYDROPATHY_COLUMN]),
        epitope: textOr(r[EPITOPE_COLUMN]),
        pfam_domain: textOr(r[PFAM_DOMAIN_COLUMN]),
      })),
      weights: { [INTERFACE_CONTACTS_COLUMN]: W_CROSSING, [INTERFACE_SEPARATION_COLUMN]: W_TIGHTNESS, [RELATIVE_SASA_COLUMN]: W_BURIAL, [HYDROPATHY_COLUMN]: W_HYDROPATHY, [EPITOPE_COLUMN]: W_EPITOPE, [PFAM_DOMAIN_COLUMN]: W_DOMAIN },
    }),
    readOutput: ({ snapshot }): AnalysisResult<ScoreOutput> => {
      const state = snapshot.sharedState as Readonly<Record<string, unknown>>;
      return {
        ok: true,
        output: {
          as: 'columns',
          table: ACT_TABLE,
          columns: {
            [STRUCTURAL_COLUMN]: { type: 'float', role: 'measure', label: 'how much THIS molecule says the residue is a hot spot, 0–1 — absent where no structural track measured it' },
            [STRUCTURAL_BASIS_COLUMN]: { type: 'string', role: 'dimension', label: 'which structural terms the score rests on, and which were absent' },
            [PRIOR_COLUMN]: { type: 'float', role: 'measure', label: 'how much ALREADY-PUBLISHED work says the residue is a hot spot, 0–1 — absent where no prior track named it' },
            [PRIOR_BASIS_COLUMN]: { type: 'string', role: 'dimension', label: 'which prior terms the score rests on, and which were absent' },
          },
          counts: state['counts'] as ScoreOutput['counts'],
        },
      };
    },
  };
}

// ── act three: the extent ────────────────────────────────────────────────────

/** What the extent act is handed: the structural score and where each alpha carbon is. */
interface ExtentArgs {
  readonly residues: readonly PlacedResidue[];
  readonly cutoff: number;
  readonly floor: number;
}

/**
 * THE PATCHES — connected components in SPACE, never a window along the
 * sequence (`./extent.ts` carries the argument).
 */
function extentAnalysis(): AnalysisDef<readonly KeyedRow[], ExtentOutput> {
  return {
    id: EXTENT_ACT,
    kind: 'transform',
    produces: 'columns',
    inputs: RESIDUE_INPUTS,
    honesty: {
      notes:
        `A HOT SPOT IS A PATCH IN SPACE. The candidates are the residues scoring above ${String(INTERFACE_FLOOR)} — which is not a number anybody tuned: it is the most a residue can score with NO interface evidence at all, folded from the weights, so "above it" and "the interface tracks said something" are one statement. They are then grouped by CONNECTED COMPONENTS under ${String(CA_CUTOFF)} Å between alpha carbons, the field's own contact-map distance. ` +
        'A patch\'s members are its residues and never a range, so two residues far apart in sequence — or in two different chains — land in one patch when they are adjacent in space, and no range is ever clamped because none was ever produced. ' +
        'The cutoff is centre-to-centre between BACKBONE atoms, so it says nothing about which way the side chains point: that is its honest limit.',
    },
    build: () =>
      libraryChart(
        flowChart<{ readonly hotspot_patch: readonly (string | null)[]; readonly patches: readonly Patch[]; readonly counts: ExtentOutput['counts'] }>(
          'Group the high-scoring residues into patches in three dimensions',
          (scope) => {
            const args = scope.$getArgs() as unknown as ExtentArgs;
            const patches = hotspotPatches(args.residues, args.cutoff);
            const column = patchColumn(args.residues, patches);
            scope.$setValue(PATCH_COLUMN, column);
            scope.$setValue('patches', patches);
            scope.$setValue('counts', { candidates: column.filter((v) => v !== null).length, patched: patches.length, cutoff: args.cutoff, floor: args.floor });
          },
          'connected-components',
        ).build(),
      ),
    toRunInput: (rows): ExtentArgs => ({
      residues: rows.map((r) => ({
        residue_key: keyOf(r),
        chain: String(r['chain'] ?? ''),
        resnum: Number(r['resnum']),
        ca_x: Number(r['ca_x']),
        ca_y: Number(r['ca_y']),
        ca_z: Number(r['ca_z']),
        hotspot_structural: numberOr(r[STRUCTURAL_COLUMN]),
      })),
      cutoff: CA_CUTOFF,
      floor: INTERFACE_FLOOR,
    }),
    readOutput: ({ snapshot }): AnalysisResult<ExtentOutput> => {
      const state = snapshot.sharedState as Readonly<Record<string, unknown>>;
      return {
        ok: true,
        output: {
          as: 'columns',
          table: ACT_TABLE,
          // A PATCH NAME IS NOT A MAGNITUDE — `patch 2` is not twice `patch 1`, it
          // is a PLACE — which is the `hotspot_rank` precedent next door
          // (`src/prot/hotspots.ts`): a landed column read as a continuous number
          // is refused by the structure view's colour rule by name.
          columns: { [PATCH_COLUMN]: { type: 'string', role: 'dimension', scale: 'discrete', label: 'which spatial patch of high-scoring residues this residue belongs to — absent for a residue in none' } },
          patches: valuesAt(state, 'patches') as readonly Patch[],
          counts: state['counts'] as ExtentOutput['counts'],
        },
      };
    },
  };
}

// ── the registry, and the stages ─────────────────────────────────────────────

/**
 * THE SIX ACTS THIS DESK DECLARES — three of the protein desk's, reused by
 * reference, and three of its own.
 *
 * See the file header for which are reused and why the other two of
 * `protAnalyses` are deliberately not filed.
 */
export function hotAnalyses(structureText: string, annotation: AnnotationEvidence | null = null): Readonly<Record<string, AnalysisSlot>> {
  const reused = protAnalyses(structureText, null, null, annotation);
  const borrow = (act: string): AnalysisSlot => {
    const slot = reused[act];
    if (slot === undefined) throw new Error(`this desk reuses the protein desk's "${act}" act and src/prot/analyses.ts no longer declares one — the two have drifted`);
    return slot;
  };
  return {
    [CONTACTS_ACT]: borrow(CONTACTS_ACT),
    [SURFACE_ACT]: borrow(SURFACE_ACT),
    [ANNOTATION_ACT]: borrow(ANNOTATION_ACT),
    [HYDROPATHY_ACT]: hydropathyAnalysis() as unknown as AnalysisSlot,
    [SCORE_ACT]: scoreAnalysis() as unknown as AnalysisSlot,
    [EXTENT_ACT]: extentAnalysis() as unknown as AnalysisSlot,
  };
}

/**
 * THE SIX STAGES, IN THE ORDER THEY MUST LAND — and here the order IS a
 * dependency chain, which is the one way this desk differs from the protein
 * desk beside it.
 *
 * The three reused stages land the tracks; the hydropathy stage lands the
 * fifth; the score stage reads all five off the rows AT ITS OWN CURSOR; the
 * extent stage reads the score the same way. Each act's `toRunInput` sees the
 * columns the acts before it committed and nothing else, so stepping the cursor
 * back behind a commit really does un-build the picture above it.
 */
export const HOT_STAGES: readonly { readonly stage: string; readonly label: string; readonly acts: readonly { readonly id: string; readonly intent: string }[] }[] = [
  {
    stage: 'interactions',
    label: 'Every contact across the interface',
    acts: [{ id: CONTACTS_ACT, intent: 'fold this entry\'s non-covalent contacts onto the residues they touch — how many each one is in, how many of those cross to another chain, and the tightest of the crossing ones, absent for a residue that touches no other chain' }],
  },
  {
    stage: 'surface',
    label: 'How much of each residue the solvent can reach',
    acts: [{ id: SURFACE_ACT, intent: 'roll a 1.4 Å solvent probe over the complex with the partner chain in place, and land each residue\'s accessible area with the relative value beside it' }],
  },
  {
    stage: 'annotation',
    label: 'What is already known about each residue',
    acts: [{ id: ANNOTATION_ACT, intent: 'ask what is already published about each chain\'s sequence — the Pfam domain InterPro matched and every epitope the IEDB records — and land each on the residue it is about, absent where the source names nothing' }],
  },
  {
    stage: HYDROPATHY_STAGE,
    label: 'How hydrophobic each residue type is',
    acts: [{ id: HYDROPATHY_ACT, intent: `look up each residue type's hydropathy in ${HYDROPATHY_SOURCE} — absent, never zero, for a type the published scale does not cover` }],
  },
  {
    stage: SCORE_STAGE,
    label: 'Two scores: what this molecule shows, and what is already published',
    acts: [{ id: SCORE_ACT, intent: 'fold the four structural tracks into one score and the two prior tracks into a second, on a fixed weight budget that is never renormalised over the terms that landed — and write beside each score the terms it rests on and the terms that were absent' }],
  },
  {
    stage: EXTENT_STAGE,
    label: 'The patches those scores make in space',
    acts: [{ id: EXTENT_ACT, intent: `take every residue scoring above ${String(INTERFACE_FLOOR)} — the most a residue can reach with no interface evidence, folded from the weights rather than chosen — and group them into connected components under ${String(CA_CUTOFF)} Å between alpha carbons, so a patch's members are its residues and never a range` }],
  },
];

/** Every act id, in landing order — the flat view of {@link HOT_STAGES}. */
export const HOT_ACT_ORDER: readonly string[] = HOT_STAGES.flatMap((s) => s.acts.map((a) => a.id));

/**
 * THE PROSE STAGE THIS PACKET DID NOT BUILD, and what is left for it.
 *
 * It is written down rather than half-built, because a shape nobody finishes is
 * worse than a door left open. What it would be, exactly:
 *
 *   * it receives the ALREADY-COMPUTED patches and their scores as facts with
 *     ids — it ranks nothing and measures nothing, because the score already
 *     did, which is the whole simplification this design buys: there is no
 *     "the model disagreed with the score" case to handle;
 *   * it writes ONE reason per patch, citing the ids it used;
 *   * it is REFUSED by name if it mentions a residue outside that patch's own
 *     members — the `src/prot/hotspots.ts` · `REFUSE_NOT_IN_TABLE` door, one
 *     grain narrower;
 *   * no key is a REAL, COMPLETE state and not a lesser one — exactly as
 *     `server/prot-doors.ts` · `chooseHotspotDriver` already treats it — and
 *     the static build of this desk would declare no such act at all, the way
 *     `protAnalyses` declares no fifth act without a slot.
 *
 * Nothing in this desk assumes it exists. Both score columns are measurements
 * and are complete without a sentence from anybody.
 */
export const WHAT_A_PROSE_STAGE_WOULD_BE =
  'this desk computes its picks arithmetically and writes no prose about them. A prose stage, if one is ever built, would receive the computed patches as facts with ids, write one reason per patch citing those ids, and be refused by name for naming a residue outside the patch — it would rank nothing, because the score already did.';

/** The column type vocabulary, re-exported so a test can name it without reaching into the library. */
export type { OutputColumnType };
