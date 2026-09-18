/**
 * THE PROTEIN SURFACE — one live vizfootprint session over one parsed PDB
 * entry, plus the one thing the session cannot hold.
 *
 *   tables    = protTables(text)        layer 1 — the file's atom records, shaped
 *   def       = protDef(tables, text, evidence)
 *                                       layers 2–4 — one table, seven views, four acts
 *   session   = buildDashboard(def)     validated (the firewall throws on a lie)
 *                 .createSession()
 *   …then ONE GESTURE at each unlanded chart, kept; then the ORCHESTRATOR, one
 *   stage per declared stage, each landing its own evidence
 *
 * ── THE BOOT IS A STORY, AND ITS FIRST STEP IS A REFUSAL ────────────────────
 * This desk used to land nothing: every column it drew was read off the file,
 * and the log a reader walked started empty. It now runs a PIPELINE, and the
 * order of {@link openProtSurfaceAsync} is the story:
 *
 *   1. build the session. THREE of the seven views are declared over columns
 *      that do not exist yet, so three of the pictures cannot draw.
 *   2. MAKE A GESTURE AT EACH OF THEM ({@link probeTheUnlandedColumns}) and keep
 *      the sentence the library refuses it with. A visitor always arrives after
 *      the acts, so a page that did not make the gesture could only QUOTE that
 *      refusal — and a quoted refusal is prose, not evidence. These two are the
 *      library's own, on this session, in this session's gap ledger.
 *   3. run the orchestrator (`./orchestrator.ts`): stage one finds every
 *      non-covalent contact and lands it twice — as a pair table in its own
 *      answer and as three columns on `residues` — stage two rolls a solvent
 *      probe and lands two more columns, and stage three places each residue in
 *      its family's curated alignment and lands its score beside the alignment
 *      it was cited against. Each stage's chart can draw the moment its stage
 *      ends, and not before.
 *
 * ── AND ONE PIECE OF EVIDENCE THIS SURFACE CANNOT READ FOR ITSELF ──────────
 * The conservation stage's data is somebody else's published alignment, so it
 * is gathered BEFORE the dashboard is built and handed in
 * (`./conservationEvidence.ts` · `conservationEvidenceFor`) — the committed
 * fixtures for the example, the three services for any other entry. A surface
 * opened without it declares the act anyway and lands its refusal, which is
 * the honest shape: a stage that is declared and said nothing would read as a
 * stage nobody ran.
 *
 * The exoplanet surface does exactly this with its histogram
 * (`../exo/session.ts` · `probeTheMintedTable`); this is that pattern with two
 * charts and a real pipeline behind them.
 *
 * ── WHAT THIS SURFACE HOLDS THAT THE SESSION CANNOT ─────────────────────────
 * Two things, and they are the same KIND of thing — evidence the library has no
 * declaration for:
 *
 *   {@link ProtSurface.structure}   the file's bytes (no source format fits them)
 *   {@link ProtSurface.run}         the pair table (no act can land a computed
 *                                   table into the data space)
 *
 * Both are named rather than papered over, and both are why this desk exists.
 *
 * ── THE BYTES BESIDE THE SESSION, and why they are beside it ────────────────
 * The 3D view draws the STRUCTURE FILE, not the rows. The library's source port
 * carries three formats — `rows`, `csv`, `json` (`vizfootprint/source` ·
 * `SOURCE_FORMATS`) — and a PDB file is none of them, so there is no declaration
 * that would make the file a thing the dashboard knows about. It therefore
 * rides on {@link ProtSurface.structure}: the host fetches it, the host holds
 * it, the host hands it to the renderer's factory.
 *
 *
 * SINCE `vizfootprint@0379d58` THE LIBRARY HAS THE DECLARATION this paragraph
 * asks for — a RESOURCE (`{ format: 'bytes' | 'text', via, at }`) lands through
 * the same carriers, carries a version, is stamped on every commit and rides the
 * renderer's handshake (`vizfootprint` · `src/source/README.md`; the contract's
 * Law 9). This desk found that gap and does NOT yet use the door: adopting it is
 * its own packet, and until then the hand-fetch below is what runs. So the cost
 * listed here is real TODAY and no longer the library's — say which, rather than
 * letting the prose rot.
 * What that costs, said plainly because it is the finding this desk exists to
 * produce: the residues table's version is stamped on every commit
 * (`inline:<size>-<hash>`, from the carrier), and the file's is stamped on
 * nothing. A reader who travels back to a commit gets the rows that were true
 * then and whatever bytes the page happens to be holding now. The demo cannot
 * fix that from out here — a host cannot stamp a commit — so it names it
 * instead, and `characters` below is deliberately not called `bytes`: it is
 * what the host can count, not what a carrier vouched for.
 */
import { buildDashboard } from 'vizfootprint/agent';
import type { InteractionSession } from 'vizfootprint/agent';
import { buildDashboardAsync } from 'vizfootprint/def';
import type { Dashboard } from 'vizfootprint/def';
import type { Row } from 'vizfootprint/data';
import { CONSERVATION_VIEW, INTERFACE_VIEW, RANKING_VIEW, RESIDUES_TABLE, SURFACE_VIEW, protDef } from './def.js';
import { CONSERVATION_COLUMN, INTERFACE_CONTACTS_COLUMN, SASA_COLUMN } from './analyses.js';
import type { ConservationEvidence } from './conservationEvidence.js';
import { landAct, runProtStages, type ActOutcome, type ProtRun, type ProtRunWatch } from './orchestrator.js';
import { HOTSPOTS_ACT, HOTSPOTS_INTENT, HOTSPOTS_STAGE, HOTSPOT_RANK_COLUMN, type HotspotAnswered, type HotspotSlot } from './hotspots.js';
import { protTables, type ProtTables } from './etl.js';

/**
 * The structure file as the HOST holds it — everything a host can say about a
 * bulk artifact it fetched itself.
 *
 * `at` is where it came from and `characters` is how long the text is. There is
 * no `version` and no `retrievedAt` field, and that absence is deliberate: the
 * carrier that would have vouched for both cannot carry this format, so a field
 * here would be the host vouching for itself.
 */
export interface StructureArtifact {
  /** Where the text came from — a URL for the page, a file URL for a test or a script. */
  readonly at: string;
  /** The file's text, verbatim: what the ETL parsed and what the viewer will draw. */
  readonly text: string;
  /** How long that text is. Counted here; vouched for by nobody. */
  readonly characters: number;
}

/**
 * THE TWO SENTENCES THE LIBRARY REFUSED THE UNLANDED CHARTS WITH, kept —
 * one per stage, keyed by the view the gesture was made at.
 *
 * `null` on a surface that never made the gesture (the synchronous door, whose
 * acts are not dispatched at all, so nothing has changed yet for a refusal to
 * be about).
 */
export interface UnlandedRefusals {
  readonly [viewId: string]: string | null;
}

/**
 * THE RESIDUE ROWS AT THE CURSOR — the file's own columns AND every column the
 * three stages landed on them.
 *
 * WHY the session and not the ETL: three of the five columns the new charts draw
 * do not exist in the data. They are acts' outputs, resolved at the cursor's
 * branch path, and reading them anywhere else would mean recomputing them —
 * which is the one thing a demo about provenance may not do.
 *
 * WHY IT IS READ WITH NOBODY'S EYES (`viewId: null`), and why that is what makes
 * re-reading safe. A window asked with no `viewId` at all is the
 * whole-dashboard truth — EVERY live clause filters it — so with a residue
 * picked in the 3D view it narrows to one row, and a bar chart of one bar is
 * not the picture the reader was promised, it is the picture of their own
 * click. That is why this used to be read exactly ONCE, before any clause could
 * exist; and reading once is what froze the pictures, because the columns are
 * resolved at the CURSOR and a boot-time answer is the boot's cursor forever.
 *
 * The library has the third state this needs and the demo was not using it:
 * `viewId: null` means **no clause at all** — the table as it stands at the
 * cursor (`vizfootprint` · `src/session/types.ts` · `ViewQuery.viewId`, whose
 * three states are a value, `null` and absent). So the window is the whole
 * table at the cursor, per cursor, and the cells go on narrowing it in the
 * browser from these rows exactly as they did. (`../exo/session.ts` ·
 * `derivedRowsAt` is still read once, and that desk lands no act behind a
 * cursor a reader can move to.)
 */
export interface ResiduesAtCursor {
  /** One row per residue, in the table's own order. */
  readonly rows: readonly Row[];
  /** `null` when the session answered; the library's refusal sentence when it did not. */
  readonly refused: string | null;
  /**
   * The commit the window was read AT, as the session stamped it
   * (`ViewQueryResult.cursor`) — `null` on a session with no commit on it.
   *
   * It exists so a page can SAY which commit its pictures are drawn at, out of
   * the read's own answer rather than out of whatever it believes the cursor to
   * be. Those two can differ for a beat (`web/src/protRows.ts` ·
   * `useResiduesAtCursor` says exactly when), and the honest thing to print is
   * the one the rows came with. It is also what tells a re-reader that the
   * boot's answer is already this cursor's, so the first paint costs no second
   * read.
   */
  readonly cursor: string | null;
}

export interface ProtSurface {
  readonly session: InteractionSession;
  readonly tables: ProtTables;
  /** The dashboard behind the session — its data checks and its journal. */
  readonly dashboard: Dashboard;
  /** The file the 3D view draws, held beside the session because no declaration can hold it. */
  readonly structure: StructureArtifact;
  /** The rows every picture on this desk draws — read once, at the cursor, after the stages. */
  readonly residues: ResiduesAtCursor;
  /**
   * What the three stages did, and the pair table they cut. `null` on a surface
   * whose stages were never run (the synchronous door).
   */
  readonly run: ProtRun | null;
  /**
   * The sentences the two unlanded charts were refused with, BEFORE the stages
   * ran — see {@link probeTheUnlandedColumns}.
   */
  readonly refusals: UnlandedRefusals;
  /**
   * STAGE 5'S SLOT, on a surface whose host can perform stage 5 — and ABSENT
   * on every other one.
   *
   * A static page holds no key, so nothing there can ask a model and the act
   * is not declared at all (`./hotspots.ts` · `hotspotSlot` says why the
   * declaration and the answer arrive at different moments). A host with a
   * process in front of a model opens its surface WITH one and lands the
   * answer through {@link landHotspots}.
   */
  readonly hotspots?: HotspotSlot;
}

/** The artifact, from text somebody already read — the one door both the node and the browser loaders end at. */
export function structureArtifact(at: string, text: string): StructureArtifact {
  return { at, text, characters: text.length };
}

/**
 * THE GESTURES THE BOOT MAKES BEFORE ITS STAGES — one at each chart whose
 * column no act has landed yet: three on every build, and a FOURTH at stage 5's
 * own chart on a build that can perform stage 5 (`rank`).
 *
 * WHY A SURFACE DOES THIS ON PURPOSE. Both charts are DECLARED over columns an
 * act lands (`./def.ts` · `protEncodings`), so the def door accepts them and
 * the desk shows their frames from the first paint. Because the columns only
 * exist where the act landed, the READ answers per cursor and refuses the
 * gesture here, naming the column it cannot find. That sentence is the whole
 * point of declaring the charts up front instead of hiding them behind a
 * loading flag — and every visitor arrives AFTER the stages, so a page that did
 * not make the gesture could only quote it.
 *
 * THE GESTURE EACH CHART MAKES HERE IS THE GESTURE THAT CHART CAN MAKE — a
 * POINT at all three, because that is the voice all three declare (`./def.ts` ·
 * `capabilities`). The two runs used to probe with an INTERVAL, on the recorded
 * belief that a line's brush is a range of residue numbers. It is not: both
 * runs are drawn over a BAND, so a drag on them lands the slots it covered (a
 * MATCH) and a tap lands one slot (a POINT) — and by the library's SET-1 law a
 * view declaring `point` accepts both. An interval was a voice they never had,
 * so the session refused these probes FOR THE CAPABILITY — *view "surface" does
 * not encode a interval selection* — which is a true sentence about the wrong
 * thing: it hid the missing column these gestures exist to name. Probing with
 * the declared kind puts the column back in the refusal.
 *
 * All of them land NOTHING by construction — a refused dispatch makes no commit —
 * so the log a reader walks is unchanged and the only trace is the gap row,
 * which is exactly the trace a refusal should leave.
 *
 * A gesture that is ACCEPTED here comes back as `null`, and that is a real
 * failure the caller reports rather than swallows: it would mean the column was
 * already there and this desk's claim about its own pipeline is wrong.
 */
export async function probeTheUnlandedColumns(session: InteractionSession, rank: boolean): Promise<UnlandedRefusals> {
  const bar = await session.dispatch({
    verb: 'select',
    viewId: INTERFACE_VIEW,
    field: INTERFACE_CONTACTS_COLUMN,
    value: 1,
    cause: { requestedBy: 'system', computedBy: 'system', intent: `pick the residues with one contact across the interface, before the stage that counts them has run` },
  });
  const run = await session.dispatch({
    verb: 'select',
    viewId: SURFACE_VIEW,
    field: SASA_COLUMN,
    value: 0,
    cause: { requestedBy: 'system', computedBy: 'system', intent: 'pick the residues the solvent cannot reach at all, before the stage that measures them has run' },
  });
  // THE THIRD GESTURE, at the third chart declared over a column no act has
  // landed. It is the same claim as the other two, at a chart whose evidence is
  // somebody else's published alignment rather than this file's coordinates:
  // the read is what judges a binding, so the picture cannot draw and the
  // LIBRARY is what says why.
  const conserved = await session.dispatch({
    verb: 'select',
    viewId: CONSERVATION_VIEW,
    field: CONSERVATION_COLUMN,
    value: 1,
    cause: { requestedBy: 'system', computedBy: 'system', intent: 'pick the residues their family never varies, before the stage that places them in it has run' },
  });
  /*
    AND THE FOURTH, at stage 5's own chart — made only where that chart EXISTS.

    `rank` is the one condition the whole stage is declared under
    (`./def.ts` · `protDef`): on a build that cannot ask a model there is no
    `ranking` view to gesture at, and a probe at an address the def does not
    declare would be refused for the ADDRESS rather than for the column — a
    true sentence about the wrong thing, which is the exact mistake the two runs
    made when they probed with an interval.

    The gesture is a POINT, because that is the voice this chart declares, and
    the field is `hotspot_rank` rather than the bar's HEIGHT: the height is
    stage 4's column and the refusal a reader of this cell is owed names the
    column its own stage lands.
  */
  const ranked = !rank
    ? null
    : await session.dispatch({
        verb: 'select',
        viewId: RANKING_VIEW,
        field: HOTSPOT_RANK_COLUMN,
        value: 1,
        cause: { requestedBy: 'system', computedBy: 'system', intent: 'pick the residue a model ranked first among the hot spots, before the stage that asks one has run' },
      });
  return {
    [INTERFACE_VIEW]: bar.ok ? null : bar.rejection.detail,
    [SURFACE_VIEW]: run.ok ? null : run.rejection.detail,
    [CONSERVATION_VIEW]: conserved.ok ? null : conserved.rejection.detail,
    ...(ranked === null ? {} : { [RANKING_VIEW]: ranked.ok ? null : ranked.rejection.detail }),
  };
}

/**
 * THE READ — every residue at the cursor, with whatever the stages have landed
 * on it by then. See {@link ResiduesAtCursor} for whose eyes and why.
 *
 * The limit is the RESIDUE COUNT: the table can never have more rows than the
 * parse produced, and a window narrower than the table would draw a chart
 * missing residues nobody filtered out.
 */
export async function residuesAt(session: InteractionSession, tables: ProtTables): Promise<ResiduesAtCursor> {
  // `viewId: null` = NOBODY'S EYES — the whole table at the cursor, with no
  // live clause applied. Leaving it out would apply every one of them.
  const window = await session.viewQuery({ table: RESIDUES_TABLE, viewId: null, limit: tables.residues.length });
  // A REFUSAL IS STAMPED WITH ITS CURSOR TOO. It has no window to read one off,
  // so it asks the session — and the field must be filled either way, because a
  // caller that re-reads whenever the stamp disagrees with the cursor would read
  // a refusing table forever if a refusal came back unstamped.
  return window.ok ? { rows: window.rows, refused: null, cursor: window.cursor } : { rows: [], refused: window.rejected, cursor: session.cursor() };
}

/**
 * The surface, SYNCHRONOUSLY — for a test or a script that wants a session and
 * nothing else. The only table is an INLINE source, which the synchronous
 * builder is allowed to read (the library's law is about non-inline sources).
 *
 * The four acts are DECLARED and not dispatched, because dispatching is async
 * — the same split the exoplanet surface has, and for the same reason: a
 * builder that quietly returned before its own stages ran would be a surface
 * whose two new pictures have no columns and no sign of why. Call
 * {@link probeTheUnlandedColumns} and then `runProtStages`, or use the async
 * door, which does both in that order.
 */
export function openProtSurface(artifact: StructureArtifact, evidence: ConservationEvidence | null = null, hotspots: HotspotSlot | null = null): ProtSurface {
  const tables = protTables(artifact.text);
  const dashboard = buildDashboard(protDef(tables, artifact.text, evidence, hotspots?.analysis ?? null));
  return { session: dashboard.createSession({ as: 'user' }), tables, dashboard, structure: artifact, residues: unrunResidues(tables), run: null, refusals: NO_GESTURES_YET, ...(hotspots === null ? {} : { hotspots }) };
}

/**
 * THE THREE UNLANDED CHARTS' SENTENCES ON A SURFACE THAT MADE NO GESTURE —
 * `null` each, and `null` is not a refusal here.
 *
 * It means *nobody asked yet*: the synchronous door does not dispatch, so
 * nothing has changed for a refusal to be about. A surface that had made the
 * gestures and been refused carries the library's own words instead
 * ({@link probeTheUnlandedColumns}), and a surface that made them and was
 * ACCEPTED is a real failure the caller reports (`protSurfaceProblems`).
 */
const NO_GESTURES_YET: UnlandedRefusals = { [INTERFACE_VIEW]: null, [SURFACE_VIEW]: null, [CONSERVATION_VIEW]: null };

/**
 * The rows of a session no stage has run on — the ETL's own, and NOT a stand-in
 * for a read that failed.
 *
 * `refused: null` is the true answer here rather than a sentence: with no act
 * landed, the session's `residues` really are the parse's rows, column for
 * column. What the two new charts then find is that their column is not on
 * them, which is exactly the state this door exists to open.
 */
const unrunResidues = (tables: ProtTables): ResiduesAtCursor => ({ rows: tables.residues as readonly Row[], refused: null, cursor: null });

/**
 * THE ASYNC SURFACE WITH ITS STAGES STILL UNRUN — the one moment a caller can
 * watch the library refuse a gesture at a chart whose column does not exist.
 *
 * Everything {@link openProtSurfaceAsync} has (the refresh door, the data
 * journal) and none of its commits. It is its own door rather than a private
 * half of the builder below because "the stages have not run" is a state worth
 * being able to open on purpose: {@link probeTheUnlandedColumns} is what a
 * caller does with it, and `tests/prot-progression.test.ts` holds this cursor
 * still.
 */
export async function openProtSurfaceUnrun(artifact: StructureArtifact, evidence: ConservationEvidence | null = null, hotspots: HotspotSlot | null = null): Promise<ProtSurface> {
  const tables = protTables(artifact.text);
  const dashboard = await buildDashboardAsync(protDef(tables, artifact.text, evidence, hotspots?.analysis ?? null));
  return { session: dashboard.createSession({ as: 'user' }), tables, dashboard, structure: artifact, residues: unrunResidues(tables), run: null, refusals: NO_GESTURES_YET, ...(hotspots === null ? {} : { hotspots }) };
}

/**
 * SOMEBODY WATCHING THE WHOLE BOOT, and not only its acts.
 *
 * `ProtRunWatch` offers the acts as they come back, which is three of the boot's
 * steps out of five. The other two are the ones a reader waits longest for and
 * hears nothing about: the DASHBOARD BUILD (the def through the firewall, which
 * throws on a lie) and the THREE PROBE GESTURES this surface makes on purpose
 * (`probeTheUnlandedColumns`). Both are states of the boot, so both are offered
 * — and every field on them is a COUNT the builder already holds, never a
 * payload and never a row.
 *
 * It EXTENDS `ProtRunWatch` rather than replacing it, so every existing caller
 * is a `ProtBootWatch` already and a host that passes none gets exactly today's
 * boot.
 */
export interface ProtBootWatch extends ProtRunWatch {
  /** The def went through the firewall and a session exists: how many views it declares, how many acts, how many rows. */
  onBuilt?(built: { readonly views: number; readonly acts: number; readonly rows: number }): void;
  /**
   * The gestures at the charts whose columns no act has landed were made: how
   * many were asked and how many the library refused.
   *
   * A gesture ACCEPTED here is a fault rather than a success
   * ({@link protSurfaceProblems} says why), so the two numbers are reported
   * apart instead of as one "done".
   */
  onProbed?(probed: { readonly asked: number; readonly refused: number }): void;
}

/**
 * The same surface through the async builder — the one with a refresh door and
 * a data journal, which is what the page opens, AND the one that runs the two
 * stages: the contacts and the surface are on the log before the first paint,
 * so every number the desk shows beyond the file's own columns is already on
 * the trace.
 *
 * The order is the story ({@link probeTheUnlandedColumns} first, then the
 * stages) and the sentences from step two are kept, because a visitor arrives
 * at the end of it.
 */
export async function openProtSurfaceAsync(artifact: StructureArtifact, watch?: ProtBootWatch, evidence: ConservationEvidence | null = null, hotspots: HotspotSlot | null = null): Promise<ProtSurface> {
  const unrun = await openProtSurfaceUnrun(artifact, evidence, hotspots);
  // THE BUILD, REPORTED — counted off the def the builder was handed rather than
  // off anything this function believes about it
  //
  // THE VIEW COUNT IS THE DEF'S OWN ACTOR REGISTRY and no longer a constant's
  // length: stage 5's chart is declared only where its act is
  // (`./def.ts` · `RANKING_VIEW`), so a page that performs the stage really
  // draws eight addresses and the published one really draws seven. The
  // comment above always claimed the count came off the def; now it does.
  watch?.onBuilt?.({ views: Object.keys(unrun.dashboard.def.actors ?? {}).length, acts: Object.keys(unrun.dashboard.def.analyses ?? {}).length, rows: unrun.tables.residues.length });
  const refusals = await probeTheUnlandedColumns(unrun.session, hotspots !== null);
  const asked = Object.keys(refusals);
  watch?.onProbed?.({ asked: asked.length, refused: asked.filter((viewId) => refusals[viewId] !== null).length });
  // `watch` is the SCREEN's copy of the acts, act by act, and it changes nothing
  // about the run (`./orchestrator.ts` · ProtRunWatch): a host that passes none
  // gets exactly today's boot.
  const run = await runProtStages(unrun.session, watch);
  // read HERE and nowhere else: this is the one moment the session is guaranteed
  // to hold no clause, which is the only moment this window is the whole table
  const residues = await residuesAt(unrun.session, unrun.tables);
  return { ...unrun, residues, run, refusals };
}

/**
 * What a caller should SAY went wrong, over one run — the refusals of the three
 * acts and of the two gestures that were supposed to be refused, in one list.
 *
 * The two halves read opposite ways and that is not a trick: an ACT that was
 * refused is a fault (its picture has no column), and a GESTURE that was
 * ACCEPTED is a fault (the column was there before its act, so the desk's claim
 * about its own pipeline is false). One list, so a boot cannot report the first
 * kind and forget the second.
 */
export function protSurfaceProblems(surface: ProtSurface): readonly string[] {
  const acts = (surface.run?.outcomes ?? []).flatMap((o) => (o.refusal === null ? [] : [`stage "${o.stage}": ${o.refusal}`]));
  const gestures = Object.entries(surface.refusals).flatMap(([viewId, sentence]) =>
    sentence === null && surface.run !== null ? [`the gesture at "${viewId}" was ACCEPTED before its stage ran — the column it reads was already there, so this desk's account of its own pipeline is wrong`] : [],
  );
  return [...acts, ...gestures];
}

/**
 * STAGE 5'S ANSWER, FROZEN — the act dispatched the moment the ranking arrives.
 *
 * ── WHY IT IS ITS OWN DOOR AND NOT PART OF THE RUN ─────────────────────────
 * The orchestrator's chart runs the stages whose evidence is the FILE and
 * somebody else's published alignment; those can all land before the first
 * paint. Stage 5's evidence is *what those stages landed*, so its answer
 * cannot exist while they are dispatching, and the model that gives it lives
 * behind a process with a key. So the act is dispatched later — through
 * `./orchestrator.ts` · `landAct`, the one owner of the three-way distinction
 * between a refusal, a result that was not ok and a throw, so stage 5's
 * refusal reads exactly like every other stage's.
 *
 * ── AND IT LANDS BEFORE ANYTHING CHECKS IT ─────────────────────────────────
 * This is the whole reason the door is one call: the answer is on the record,
 * with the fact ids it cited, before anything compares it to what is known
 * about those residues. The judge's verdicts came back WITH the answer and are
 * NOT dispatched here — they ride beside the act (`./hotspots.ts` ·
 * `HotspotAnswered.verdicts`), because a prediction whose commit also carried
 * its check would be a prediction revised by the check.
 *
 * A surface with no slot is a surface whose host cannot perform stage 5, and
 * that is a REFUSAL rather than a throw: it is the honest state of every static
 * build of this desk.
 */
export async function landHotspots(surface: ProtSurface, answer: HotspotAnswered): Promise<ActOutcome> {
  if (surface.hotspots === undefined) {
    return {
      stage: HOTSPOTS_STAGE,
      act: HOTSPOTS_ACT,
      commit: null,
      refusal: `act "${HOTSPOTS_ACT}" was never declared on this surface — it was opened without a slot for stage 5, which is what every build that cannot ask a model does, so there is nothing here to land a ranking into`,
      materialized: [],
    };
  }
  surface.hotspots.offer(answer);
  const landed = await landAct(surface.session, HOTSPOTS_ACT, HOTSPOTS_INTENT);
  return { stage: HOTSPOTS_STAGE, act: HOTSPOTS_ACT, commit: landed.commit, refusal: landed.refusal, materialized: landed.materialized };
}
