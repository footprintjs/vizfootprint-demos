/**
 * THE EXOPLANET SURFACE — one live vizfootprint session over the archive's
 * three tables, with the five acts landed.
 *
 *   tables  = loadExo()               layer 1 — the archive's bytes, shaped
 *   def     = exoDef(tables)          layers 2–4 — declared: three tables, three relations
 *   session = buildDashboard(def)     validated (the firewall throws on a lie)
 *               .createSession()
 *   …then FIVE `analyze` commits, in dependency order, before anything is served
 *
 * PURE: nothing here reads a disk, so this module runs in a browser as well as
 * in a server. The tables are an ARGUMENT. `./surface.ts` beside it is the node
 * door that defaults them off the committed CSVs; the static site's page hands
 * in tables it fetched over http — see `./http.ts`.
 *
 * ── WHY THE ACTS LAND HERE AND NOT IN THE PAGE ──────────────────────────────
 * Every number this demo shows beyond the archive's own columns — how many
 * radii a planet has, how far apart they are, whether they disagree, and each
 * publication's distance from the accepted value — is the output of an act.
 * Landing them here puts all five on the log, at the top, with their causes; a
 * page that computed them would show the same figures with nothing behind them.
 * The grid demo lands its two layout acts for the same reason, in the same
 * shape.
 *
 * The five are a DEPENDENCY CHAIN (`EXO_ACT_ORDER`): two derives read the table
 * the aggregate mints, and the delta reads the column the bring-over carries. A
 * derive whose column is missing THROWS rather than refusing, so the chain stops
 * at the first refusal and reports it — running the next act anyway is what
 * turns one refusal into an uncaught error out of a server's boot.
 */
import { buildDashboard } from 'vizfootprint/agent';
import type { InteractionSession } from 'vizfootprint/agent';
import type { Cause } from 'vizfootprint/cause';
import { buildDashboardAsync } from 'vizfootprint/def';
import type { Dashboard } from 'vizfootprint/def';
import type { Row } from 'vizfootprint/data';
import { EXO_ACT_ORDER, RADII_PER_PLANET, SPREAD_ADDRESS, exoDef } from './def.js';
import type { ExoTables } from './etl.js';

export interface ExoSurface {
  readonly session: InteractionSession;
  readonly tables: ExoTables;
  /** The dashboard behind the session — its refresh door, data checks and journal. */
  readonly dashboard: Dashboard;
  /**
   * What the five acts REFUSED, kept. {@link landExoActs} returns its refusals
   * rather than throwing precisely so a caller can report them: a builder that
   * dropped them would leave an operator with an empty histogram and no
   * sentence saying why.
   */
  readonly actRefusals: readonly string[];
  /**
   * The table the aggregate MINTED, read once, here, where no clause can exist
   * — see {@link derivedRowsAt} for why not per request.
   */
  readonly derived: DerivedRowsAtCursor;
  /**
   * THE SENTENCE THE LIBRARY REFUSED A CLICK ON THE HISTOGRAM WITH, before the
   * act that mints its table had landed — see {@link probeTheMintedTable}.
   *
   * `null` on a surface that never made the gesture (the synchronous door,
   * whose acts are not landed at all, so nothing has changed yet for a refusal
   * to be about).
   */
  readonly mintedTableRefusal: string | null;
}

/**
 * THE BUCKET THE BOOT'S ONE GESTURE NAMES: the planets with exactly one
 * published radius — the leftmost bar of the histogram, and the biggest. A bin
 * is a half-open pair of edges, which is what a bar means and what an interval
 * clause carries.
 *
 * Written down rather than discovered, for the reason the captured walk's
 * planet is: a gesture at "whichever bar is tallest today" would answer
 * differently every time the archive published a new solution.
 */
export const SPREAD_BUCKET: readonly [number, number] = [1, 2];

/** One `analyze` act, landed — the refusal SENTENCE, or null when a commit landed. */
async function land(session: InteractionSession, analysisId: string, table: string, cause: Cause): Promise<string | null> {
  try {
    const res = await session.dispatch({ verb: 'analyze', analysisId, table, cause });
    if (!res.ok) return res.rejection.detail;
    if (res.analysis?.commit !== undefined) return null;
    const result = res.analysis?.result;
    // Two ways an analysis lands nothing, and they are not the same thing: a
    // DEGENERATE fit read the rows and found no honest answer in them; an
    // UNAVAILABLE one never read them, because the engine refused — so it
    // carries the engine's own sentence and no row count at all.
    const why =
      result === undefined || result.ok
        ? ''
        : result.reason === 'unavailable'
          ? ` — the rows could not be read: ${result.rejection.detail ?? result.rejection.reason}`
          : ` — ${result.reason} at ${String(result.n)} rows`;
    return `analysis "${analysisId}" landed nothing${why}`;
  } catch (err) {
    return `analysis "${analysisId}" threw: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * THE FIVE ACTS, dispatched in dependency order — never computed.
 *
 * Stops at the first refusal, because everything after it reads what it would
 * have produced. Each act's cause carries the intent the def wrote down, so the
 * ledger's sentence and the definition cannot drift.
 */
export async function landExoActs(session: InteractionSession): Promise<readonly string[]> {
  const refusals: string[] = [];
  for (const act of EXO_ACT_ORDER) {
    const refusal = await land(session, act.id, act.table, { requestedBy: 'system', computedBy: 'system', intent: act.intent });
    if (refusal !== null) {
      refusals.push(refusal);
      // the rest of the chain reads what this act would have landed: a derive over a
      // missing column THROWS, and one uncaught error out of a boot is worse than a sentence
      refusals.push(`the ${String(EXO_ACT_ORDER.length - EXO_ACT_ORDER.indexOf(act) - 1)} acts after "${act.id}" were not dispatched: each reads what it would have landed`);
      return refusals;
    }
  }
  return refusals;
}

/**
 * THE MINTED TABLE AT THE CURSOR — one row per planet with a published radius,
 * plus the two columns the derives wrote (`spread`, `disagrees`).
 *
 * WHY the session and not the ETL: this table does not exist in the data. It is
 * an act's output, resolved at the cursor's branch path, and reading it anywhere
 * else would mean recomputing it — which is the one thing a demo about
 * provenance may not do.
 *
 * WHY it must not be re-read per request: a view's clause reaches EVERY table.
 * With a planet picked on the scatter the derived window narrows to one row, and
 * a histogram of one bar is not the picture the reader was promised — it is the
 * picture of their own click. So this is read ONCE, immediately after the acts
 * land and BEFORE any clause can exist; the cell narrows in the browser
 * afterwards, from these rows, and says so.
 */
export interface DerivedRowsAtCursor {
  /** One row per planet that has at least one published radius. */
  readonly rows: readonly Row[];
  /** `null` when the session answered; the refusal sentence when it did not. */
  readonly refused: string | null;
}

export async function derivedRowsAt(session: InteractionSession, tables: ExoTables): Promise<DerivedRowsAtCursor> {
  // the limit is the PLANET count: the derived table can never have more rows than
  // there are planets, and a window narrower than the table would draw a histogram
  // missing planets nobody filtered out
  const window = await session.viewQuery({ table: RADII_PER_PLANET, limit: tables.planets.length });
  return window.ok ? { rows: window.rows, refused: null } : { rows: [], refused: window.rejected };
}

/**
 * The surface, SYNCHRONOUSLY — for a test or a script that wants a session and
 * nothing else. The acts are DECLARED and not landed: dispatching is async, and
 * a builder that quietly returned before its own acts landed would be a surface
 * whose histogram has no table and no sign of why. Call {@link landExoActs}
 * after it, or use the async builder, which does.
 */
export function openExoSurface(tables: ExoTables): ExoSurface {
  const dashboard = buildDashboard(exoDef(tables));
  const session = dashboard.createSession({ as: 'user' });
  return {
    session,
    tables,
    dashboard,
    actRefusals: [],
    derived: { rows: [], refused: 'no act has landed on this session — this surface was built synchronously, which declares the five acts without dispatching them' },
    mintedTableRefusal: null,
  };
}

/**
 * THE ONE GESTURE THE BOOT MAKES BEFORE ITS ACTS — a click on the histogram, at
 * the one cursor where the table under that picture does not exist yet.
 *
 * WHY A SURFACE DOES THIS ON PURPOSE. The histogram draws the table the
 * `radiiPerPlanet` aggregate MINTS. Because the def declares that act, the def
 * door accepts the chart over it; because the table only exists where the act
 * landed, the PROBE door answers per cursor and refuses the click here, in a
 * sentence naming the act as the repair. That sentence is the whole point of a
 * view keeping its voice instead of declaring `canProbe: false`, and every
 * visitor arrives AFTER the acts have landed — so a page that did not make the
 * gesture could only ever quote the sentence, and a quoted refusal is prose,
 * not evidence. This one is the library's own, on this session, filed in this
 * session's gap ledger where the desk shows it.
 *
 * It lands NOTHING, by construction: a refused dispatch makes no commit. The
 * log a reader walks is the same log it was, and the only trace is the gap row,
 * which is exactly the trace a refusal should leave.
 *
 * Answers the sentence, or `null` if the click was ACCEPTED — which would mean
 * the table was already there and the demo's claim about a minted table is
 * wrong. Callers report that rather than swallowing it.
 */
export async function probeTheMintedTable(session: InteractionSession): Promise<string | null> {
  const answer = await session.dispatch({
    verb: 'filter',
    viewId: SPREAD_ADDRESS,
    field: 'radii',
    range: [...SPREAD_BUCKET],
    cause: { requestedBy: 'system', computedBy: 'system', intent: `select the planets with ${String(SPREAD_BUCKET[0])} published radius, before the act that mints their table has landed` },
  });
  return answer.ok ? null : answer.rejection.detail;
}

/**
 * THE ASYNC SURFACE WITH ITS ACTS STILL UNLANDED — the one moment a caller can
 * watch the library refuse a gesture on a table that does not exist yet.
 *
 * Everything {@link openExoSurfaceAsync} has (the refresh door, the data
 * journal) and none of the five commits. The histogram's layer draws
 * `radii_per_planet`, which the aggregate MINTS, so a click on a bar here is
 * refused as a typed `needs-act` gap naming the act. It is its own door rather
 * than a private half of the builder below because "the acts have not landed"
 * is a state worth being able to open on purpose — {@link probeTheMintedTable}
 * is what a caller does with it, and a test can hold this cursor still.
 *
 * The derived rows are absent, and the sentence says which of the two reasons
 * it is: nobody dispatched, not "the act failed".
 */
export async function openExoSurfaceUnlanded(tables: ExoTables): Promise<ExoSurface> {
  const dashboard = await buildDashboardAsync(exoDef(tables));
  return {
    session: dashboard.createSession({ as: 'user' }),
    tables,
    dashboard,
    actRefusals: [],
    derived: { rows: [], refused: 'no act has landed on this session yet — the five acts are declared and nobody has dispatched them' },
    mintedTableRefusal: null,
  };
}

/**
 * The same surface through the async builder — the one with a refresh door and
 * a data journal (a server's way in), and the one that LANDS THE FIVE ACTS: the
 * aggregate, its two derived columns, the bring-over and the delta are on the
 * log before the first request is served, so every number the dashboard shows
 * is already on the trace.
 *
 * The boot's order is a story, and the first step of it is a REFUSAL: it clicks
 * the histogram before anything has landed, keeps the sentence the library
 * refused it with ({@link probeTheMintedTable}), and only then lands the acts.
 * A visitor arrives at the end of that story, which is why the sentence has to
 * be kept rather than re-derived.
 */
export async function openExoSurfaceAsync(tables: ExoTables): Promise<ExoSurface> {
  const { session, dashboard } = await openExoSurfaceUnlanded(tables);
  const mintedTableRefusal = await probeTheMintedTable(session);
  const actRefusals = await landExoActs(session);
  // read HERE and nowhere else: this is the one moment the session is guaranteed
  // to hold no clause, which is the only moment the derived window is the whole table
  const read = await derivedRowsAt(session, tables);
  const derived = read.refused === null && actRefusals.length > 0 ? { ...read, refused: actRefusals.join('; ') } : read;
  return { session, tables, dashboard, actRefusals, derived, mintedTableRefusal };
}
