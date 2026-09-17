/**
 * THE PROTEIN SURFACE — one live vizfootprint session over one parsed PDB
 * entry, plus the one thing the session cannot hold.
 *
 *   tables    = protTables(text)      layer 1 — the file's atom records, shaped
 *   def       = protDef(tables)       layers 2–4 — one table, three views
 *   session   = buildDashboard(def)   validated (the firewall throws on a lie)
 *                 .createSession()
 *
 * NO ACTS. This desk declares none and lands none: every column it draws is
 * read off the file, and the two angles are adapter work (`./etl.ts` says why
 * they are not a derive — the op grammar has no trigonometry). So there is no
 * `landActs` twin of the exoplanet surface's here, and the log a reader walks
 * starts empty, which is the honest starting state for a desk whose whole
 * story is a selection.
 *
 * ── THE BYTES BESIDE THE SESSION, and why they are beside it ────────────────
 * The 3D view draws the STRUCTURE FILE, not the rows. The library's source port
 * carries three formats — `rows`, `csv`, `json` (`vizfootprint/source` ·
 * `SOURCE_FORMATS`) — and a PDB file is none of them, so there is no declaration
 * that would make the file a thing the dashboard knows about. It therefore
 * rides on {@link ProtSurface.structure}: the host fetches it, the host holds
 * it, the host hands it to the renderer's factory.
 *
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
import { protDef } from './def.js';
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

export interface ProtSurface {
  readonly session: InteractionSession;
  readonly tables: ProtTables;
  /** The dashboard behind the session — its data checks and its journal. */
  readonly dashboard: Dashboard;
  /** The file the 3D view draws, held beside the session because no declaration can hold it. */
  readonly structure: StructureArtifact;
}

/** The artifact, from text somebody already read — the one door both the node and the browser loaders end at. */
export function structureArtifact(at: string, text: string): StructureArtifact {
  return { at, text, characters: text.length };
}

/**
 * The surface, SYNCHRONOUSLY — for a test or a script that wants a session and
 * nothing else. The only table is an INLINE source, which the synchronous
 * builder is allowed to read (the library's law is about non-inline sources),
 * so this door is complete rather than a stub: there are no acts it could fail
 * to land.
 */
export function openProtSurface(artifact: StructureArtifact): ProtSurface {
  const tables = protTables(artifact.text);
  const dashboard = buildDashboard(protDef(tables));
  return { session: dashboard.createSession({ as: 'user' }), tables, dashboard, structure: artifact };
}

/**
 * The same surface through the async builder — the one with a refresh door and
 * a data journal, which is what the page opens. Identical in every other way:
 * the def is the same def and the log starts empty either way.
 */
export async function openProtSurfaceAsync(artifact: StructureArtifact): Promise<ProtSurface> {
  const tables = protTables(artifact.text);
  const dashboard = await buildDashboardAsync(protDef(tables));
  return { session: dashboard.createSession({ as: 'user' }), tables, dashboard, structure: artifact };
}
