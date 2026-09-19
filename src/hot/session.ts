/**
 * THE FIFTH DESK'S SESSION — the def, its six acts landed in order, and the
 * rows read at the one moment no clause can exist.
 *
 * ── WHAT IS SHARED AND WHAT IS THIS DESK'S ─────────────────────────────────
 * The ETL is shared (`src/prot/etl.ts` · `protTables`), the structure artifact
 * is shared (`src/prot/session.ts` · `StructureArtifact`), and the ONE-ACT
 * dispatcher is shared (`src/prot/orchestrator.ts` · `landAct`, which is
 * exported for exactly this reason: the three-way distinction between a refused
 * dispatch, a result that is not `ok` and a stage that threw should be made in
 * one place with one vocabulary). What is this desk's own is WHICH acts run and
 * in what order ({@link HOT_STAGES}), because here the order is a real
 * dependency chain rather than the order a reader meets the pictures in.
 *
 * ── WHY THE STAGES ARE A PLAIN LOOP AND NOT A CHART ────────────────────────
 * `src/prot/orchestrator.ts` builds a footprintjs chart with a stage per
 * declared stage, and its own header gives the two reasons: the ordering is the
 * chart's rather than a comment's, and the account is a recorder's. Both still
 * hold and neither is re-argued here — what this desk needed was the same walk
 * over a DIFFERENT stage list, and `runProtStages` reads `PROT_STAGES` directly.
 * Generalising it over a list would have meant editing the protein desk, which
 * this packet may not do. **FINDING, reported rather than worked around:** the
 * orchestrator is one parameter away from serving both desks, and that
 * parameter is the one edit that would let the chart and its narrative be
 * shared too. Until then this desk keeps the shared `landAct` and its own
 * fifteen-line walk, and says so here.
 */
import type { InteractionSession } from 'vizfootprint/agent';
import { buildDashboardAsync } from 'vizfootprint/def';
import type { Dashboard } from 'vizfootprint/def';
import type { Row } from 'vizfootprint/data';
import { protTables, type ProtTables } from '../prot/etl.js';
import type { StructureArtifact } from '../prot/session.js';
import { landAct, type ActOutcome, type ProtRunWatch } from '../prot/orchestrator.js';
import type { AnnotationEvidence } from '../prot/annotationEvidence.js';
import { EXTENT_ACT, HOT_STAGES, SCORE_ACT, STRUCTURAL_COLUMN, type ExtentOutput, type ScoreOutput } from './analyses.js';
import { HOT_VIEWS, RESIDUES_TABLE, STRUCTURAL_VIEW, hotDef } from './def.js';

/** What one run of this desk's stages produced. */
export interface HotRun {
  readonly outcomes: readonly ActOutcome[];
  /** What the score act landed and counted — `null` when it was refused. */
  readonly scores: ScoreOutput | null;
  /** The patches themselves, as the extent act found them — `null` when it was refused. */
  readonly extent: ExtentOutput | null;
}

/** The rows at the cursor, and the sentence the session refused the read with when it did. */
export interface ResiduesAtCursor {
  readonly rows: readonly Row[];
  readonly refused: string | null;
  readonly cursor: string | null;
}

export interface HotSurface {
  readonly session: InteractionSession;
  readonly tables: ProtTables;
  readonly dashboard: Dashboard;
  readonly structure: StructureArtifact;
  readonly residues: ResiduesAtCursor;
  readonly run: HotRun | null;
  /** The sentence the structural run was refused with BEFORE any act landed — `null` only on a surface that made no gesture. */
  readonly refusalBeforeTheAct: string | null;
}

/**
 * THE GESTURE THIS SURFACE MAKES BEFORE ITS STAGES — one press at the
 * structural run, whose column no act has landed yet.
 *
 * It lands NOTHING by construction (a refused dispatch makes no commit), so the
 * log a reader walks is unchanged and the only trace is the gap row. A gesture
 * ACCEPTED here is a real failure the caller reports rather than swallows: it
 * would mean the column was already there and this desk's account of its own
 * pipeline is wrong.
 */
export async function probeBeforeTheAct(session: InteractionSession): Promise<string | null> {
  const asked = await session.dispatch({
    verb: 'select',
    viewId: STRUCTURAL_VIEW,
    field: STRUCTURAL_COLUMN,
    value: 1,
    cause: { requestedBy: 'system', computedBy: 'system', intent: 'pick the residues at the top of the structural score, before the stage that computes it has run' },
  });
  return asked.ok ? null : asked.rejection.detail;
}

/** The six stages, dispatched in order — each act sees the columns the acts before it committed and nothing else. */
export async function runHotStages(session: InteractionSession, watch?: ProtRunWatch): Promise<HotRun> {
  const outcomes: ActOutcome[] = [];
  const outputs = new Map<string, unknown>();
  for (const stage of HOT_STAGES) {
    for (const act of stage.acts) {
      const landed = await landAct(session, act.id, act.intent);
      if (landed.output !== null) outputs.set(act.id, landed.output);
      const outcome: ActOutcome = { stage: stage.stage, act: act.id, commit: landed.commit, refusal: landed.refusal, materialized: landed.materialized };
      outcomes.push(outcome);
      watch?.onOutcome?.(outcome);
    }
  }
  return { outcomes, scores: (outputs.get(SCORE_ACT) as ScoreOutput | undefined) ?? null, extent: (outputs.get(EXTENT_ACT) as ExtentOutput | undefined) ?? null };
}

/**
 * THE READ — every residue at the cursor, with whatever the stages landed on it.
 *
 * `viewId: null` is NOBODY'S EYES: the whole table at the cursor, with no live
 * clause applied. The protein desk's `residuesAt` says why at length, and the
 * reason is the same one — a read with eyes would narrow to whatever is
 * selected and the pictures would be drawn from the reader's own click.
 */
export async function residuesAt(session: InteractionSession, tables: ProtTables): Promise<ResiduesAtCursor> {
  const window = await session.viewQuery({ table: RESIDUES_TABLE, viewId: null, limit: tables.residues.length });
  return window.ok ? { rows: window.rows, refused: null, cursor: window.cursor } : { rows: [], refused: window.rejected, cursor: session.cursor() };
}

/** Somebody watching the boot go by — the acts as they come back, plus the one fact a promise cannot give: the build itself. */
export interface HotBootWatch extends ProtRunWatch {
  onBuilt?(built: { readonly views: number; readonly acts: number; readonly rows: number }): void;
  onProbed?(probed: { readonly refused: boolean }): void;
}

/** The surface with its stages still unrun — the one moment a caller can watch the library refuse a gesture at a chart whose column does not exist. */
export async function openHotSurfaceUnrun(artifact: StructureArtifact, annotation: AnnotationEvidence | null = null): Promise<HotSurface> {
  const tables = protTables(artifact.text);
  const dashboard = await buildDashboardAsync(hotDef(tables, artifact.text, annotation));
  return {
    session: dashboard.createSession({ as: 'user' }),
    tables,
    dashboard,
    structure: artifact,
    residues: { rows: tables.residues as readonly Row[], refused: null, cursor: null },
    run: null,
    refusalBeforeTheAct: null,
  };
}

/** The whole boot, in the order a server would do it: build, probe, land the six stages, read the rows once. */
export async function openHotSurfaceAsync(artifact: StructureArtifact, watch?: HotBootWatch, annotation: AnnotationEvidence | null = null): Promise<HotSurface> {
  const unrun = await openHotSurfaceUnrun(artifact, annotation);
  watch?.onBuilt?.({ views: Object.keys(unrun.dashboard.def.actors ?? {}).length, acts: Object.keys(unrun.dashboard.def.analyses ?? {}).length, rows: unrun.tables.residues.length });
  const refusalBeforeTheAct = await probeBeforeTheAct(unrun.session);
  watch?.onProbed?.({ refused: refusalBeforeTheAct !== null });
  const run = await runHotStages(unrun.session, watch);
  const residues = await residuesAt(unrun.session, unrun.tables);
  return { ...unrun, residues, run, refusalBeforeTheAct };
}

/**
 * What a caller should SAY went wrong, over one boot — and the two halves read
 * opposite ways, which is the `protSurfaceProblems` law kept here too: an ACT
 * that was refused is a fault, and a GESTURE that was ACCEPTED is a fault.
 */
export function hotSurfaceProblems(surface: HotSurface): readonly string[] {
  const acts = (surface.run?.outcomes ?? []).flatMap((o) => (o.refusal === null ? [] : [`stage "${o.stage}": ${o.refusal}`]));
  const gesture =
    surface.run !== null && surface.refusalBeforeTheAct === null
      ? [`the gesture at "${STRUCTURAL_VIEW}" was ACCEPTED before its stage ran — the column it reads was already there, so this desk's account of its own pipeline is wrong`]
      : [];
  const drawn = surface.residues.refused === null ? [] : [`the rows could not be read at the cursor: ${surface.residues.refused}`];
  return [...acts, ...gesture, ...drawn];
}

/** Every view this desk declares — re-exported so a boot can count them without importing the def twice. */
export { HOT_VIEWS };
