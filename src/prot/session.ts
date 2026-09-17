/**
 * THE PROTEIN SURFACE — one live vizfootprint session over one parsed PDB
 * entry, plus the one thing the session cannot hold.
 *
 *   tables    = protTables(text)        layer 1 — the file's atom records, shaped
 *   def       = protDef(tables, text)   layers 2–4 — one table, six views, three acts
 *   session   = buildDashboard(def)     validated (the firewall throws on a lie)
 *                 .createSession()
 *   …then ONE GESTURE at each unlanded chart, kept; then the ORCHESTRATOR, two
 *   stages, each landing its own evidence
 *
 * ── THE BOOT IS A STORY, AND ITS FIRST STEP IS A REFUSAL ────────────────────
 * This desk used to land nothing: every column it drew was read off the file,
 * and the log a reader walked started empty. It now runs a PIPELINE, and the
 * order of {@link openProtSurfaceAsync} is the story:
 *
 *   1. build the session. Two of the six views are declared over columns that do
 *      not exist yet, so two of the pictures cannot draw.
 *   2. MAKE A GESTURE AT EACH OF THEM ({@link probeTheUnlandedColumns}) and keep
 *      the sentence the library refuses it with. A visitor always arrives after
 *      the acts, so a page that did not make the gesture could only QUOTE that
 *      refusal — and a quoted refusal is prose, not evidence. These two are the
 *      library's own, on this session, in this session's gap ledger.
 *   3. run the orchestrator (`./orchestrator.ts`): stage one finds every
 *      non-covalent contact and lands it twice — as a pair table in its own
 *      answer and as three columns on `residues` — and stage two rolls a
 *      solvent probe and lands two more columns. Each stage's chart can draw
 *      the moment its stage ends, and not before.
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
import { INTERFACE_VIEW, RESIDUES_TABLE, SURFACE_VIEW, protDef } from './def.js';
import { INTERFACE_CONTACTS_COLUMN, SASA_COLUMN } from './analyses.js';
import { runProtStages, type ProtRun } from './orchestrator.js';
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
 * two stages landed on them.
 *
 * WHY the session and not the ETL: three of the five columns the new charts draw
 * do not exist in the data. They are acts' outputs, resolved at the cursor's
 * branch path, and reading them anywhere else would mean recomputing them —
 * which is the one thing a demo about provenance may not do.
 *
 * WHY it must not be re-read per request: a view's clause reaches every table.
 * With a residue picked in the 3D view the window would narrow to one row, and a
 * bar chart of one bar is not the picture the reader was promised — it is the
 * picture of their own click. So this is read ONCE, immediately after the stages
 * land and BEFORE any clause can exist; the cells narrow in the browser
 * afterwards, from these rows, and say so. (`../exo/session.ts` ·
 * `derivedRowsAt` is the same decision, one table over.)
 */
export interface ResiduesAtCursor {
  /** One row per residue, in the table's own order. */
  readonly rows: readonly Row[];
  /** `null` when the session answered; the library's refusal sentence when it did not. */
  readonly refused: string | null;
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
   * What the two stages did, and the pair table they cut. `null` on a surface
   * whose stages were never run (the synchronous door).
   */
  readonly run: ProtRun | null;
  /**
   * The sentences the two unlanded charts were refused with, BEFORE the stages
   * ran — see {@link probeTheUnlandedColumns}.
   */
  readonly refusals: UnlandedRefusals;
}

/** The artifact, from text somebody already read — the one door both the node and the browser loaders end at. */
export function structureArtifact(at: string, text: string): StructureArtifact {
  return { at, text, characters: text.length };
}

/**
 * THE TWO GESTURES THE BOOT MAKES BEFORE ITS STAGES — one at each chart whose
 * column no act has landed yet.
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
 * The gesture each chart's actor meta advertises is the gesture made here: a
 * POINT on the bar (one residue), an INTERVAL on the run (a range of residue
 * numbers). Both land NOTHING by construction — a refused dispatch makes no
 * commit — so the log a reader walks is unchanged and the only trace is the gap
 * row, which is exactly the trace a refusal should leave.
 *
 * A gesture that is ACCEPTED here comes back as `null`, and that is a real
 * failure the caller reports rather than swallows: it would mean the column was
 * already there and this desk's claim about its own pipeline is wrong.
 */
export async function probeTheUnlandedColumns(session: InteractionSession): Promise<UnlandedRefusals> {
  const bar = await session.dispatch({
    verb: 'select',
    viewId: INTERFACE_VIEW,
    field: INTERFACE_CONTACTS_COLUMN,
    value: 1,
    cause: { requestedBy: 'system', computedBy: 'system', intent: `pick the residues with one contact across the interface, before the stage that counts them has run` },
  });
  const run = await session.dispatch({
    verb: 'filter',
    viewId: SURFACE_VIEW,
    field: SASA_COLUMN,
    range: [0, 1],
    cause: { requestedBy: 'system', computedBy: 'system', intent: 'keep the residues the solvent barely reaches, before the stage that measures them has run' },
  });
  return { [INTERFACE_VIEW]: bar.ok ? null : bar.rejection.detail, [SURFACE_VIEW]: run.ok ? null : run.rejection.detail };
}

/**
 * THE ONE READ — every residue at the cursor, with whatever the stages have
 * landed on it. See {@link ResiduesAtCursor} for why once and why here.
 *
 * The limit is the RESIDUE COUNT: the table can never have more rows than the
 * parse produced, and a window narrower than the table would draw a chart
 * missing residues nobody filtered out.
 */
export async function residuesAt(session: InteractionSession, tables: ProtTables): Promise<ResiduesAtCursor> {
  const window = await session.viewQuery({ table: RESIDUES_TABLE, limit: tables.residues.length });
  return window.ok ? { rows: window.rows, refused: null } : { rows: [], refused: window.rejected };
}

/**
 * The surface, SYNCHRONOUSLY — for a test or a script that wants a session and
 * nothing else. The only table is an INLINE source, which the synchronous
 * builder is allowed to read (the library's law is about non-inline sources).
 *
 * The three acts are DECLARED and not dispatched, because dispatching is async
 * — the same split the exoplanet surface has, and for the same reason: a
 * builder that quietly returned before its own stages ran would be a surface
 * whose two new pictures have no columns and no sign of why. Call
 * {@link probeTheUnlandedColumns} and then `runProtStages`, or use the async
 * door, which does both in that order.
 */
export function openProtSurface(artifact: StructureArtifact): ProtSurface {
  const tables = protTables(artifact.text);
  const dashboard = buildDashboard(protDef(tables, artifact.text));
  return { session: dashboard.createSession({ as: 'user' }), tables, dashboard, structure: artifact, residues: unrunResidues(tables), run: null, refusals: { [INTERFACE_VIEW]: null, [SURFACE_VIEW]: null } };
}

/**
 * The rows of a session no stage has run on — the ETL's own, and NOT a stand-in
 * for a read that failed.
 *
 * `refused: null` is the true answer here rather than a sentence: with no act
 * landed, the session's `residues` really are the parse's rows, column for
 * column. What the two new charts then find is that their column is not on
 * them, which is exactly the state this door exists to open.
 */
const unrunResidues = (tables: ProtTables): ResiduesAtCursor => ({ rows: tables.residues as readonly Row[], refused: null });

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
export async function openProtSurfaceUnrun(artifact: StructureArtifact): Promise<ProtSurface> {
  const tables = protTables(artifact.text);
  const dashboard = await buildDashboardAsync(protDef(tables, artifact.text));
  return { session: dashboard.createSession({ as: 'user' }), tables, dashboard, structure: artifact, residues: unrunResidues(tables), run: null, refusals: { [INTERFACE_VIEW]: null, [SURFACE_VIEW]: null } };
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
export async function openProtSurfaceAsync(artifact: StructureArtifact): Promise<ProtSurface> {
  const unrun = await openProtSurfaceUnrun(artifact);
  const refusals = await probeTheUnlandedColumns(unrun.session);
  const run = await runProtStages(unrun.session);
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
