/**
 * `npm run exo:capture` — walk the exoplanet desk and write down what the walk
 * left behind.
 *
 * The CDC demo's `story-capture.ts` reads a story off a RUNNING desk over
 * `/api/state`, because that demo has a served host. This demo has none: it was
 * built for the static site, so its walk is taken IN PROCESS — the same
 * `openExoSurfaceAsync` the page calls, the same acts, the same session — and
 * the log that comes out is a real log of real commits, not a transcript
 * somebody typed.
 *
 * The walk is the one the demo is about:
 *
 *   1. the five acts land (the surface's own boot: the aggregate that mints the
 *      histogram's table, its two derived columns, the bring-over, the delta)
 *   2. SELECT a planet on the scatter — the declared link fills the sheet with
 *      every publication for it
 *   3. SORT the sheet by publication date — oldest first, so the disagreement
 *      reads in the order it happened. A sort is an ACT (`navigate` on
 *      `layout:sheet:<table>`), because it changes what row 1 IS for every
 *      later reader; a scroll is not.
 *   4. BOOKMARK the moment, so the trace has a name a reader can seek to
 *   5. ask WHY of the selection — a READ: no commit, and the answer is the
 *      session's own sentence, kept in the file so a reader can check it
 *   6. EXPORT the rows — also a read, and the receipt is the point: it names
 *      the table, the version, the cursor and the clauses those rows were read
 *      at, so the CSV that leaves can be traced back to this walk
 *
 * The two reads are recorded beside the log rather than in it, because they
 * landed nothing and a file that mixed them into the commits would be claiming
 * acts that never happened.
 *
 * Output: `web/site/exo/walk.json` — read by `src/site/cards.ts` (`exoWalk`),
 * which runs `logFeatures` over the log so the demo's card can say what
 * somebody really DID, not only what the def declares.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportFromSession } from 'vizfootprint/session';
import type { Cause } from 'vizfootprint/cause';
import { SCATTER_ADDRESS, SHEET_VIEW } from '../src/exo/def.js';
import { buildExoSurfaceAsync } from '../src/exo/surface.js';

const OUT = new URL('../web/site/exo/walk.json', import.meta.url);

/**
 * THE PLANET THE WALK PICKS, and why this one: TRAPPIST-1 e is measured by
 * several papers whose radii disagree, and the archive's composite matches none
 * of them exactly — so every step of the walk has something to show. Written
 * down rather than discovered at run time: a capture that picked "whichever
 * planet disagrees most today" would rewrite this file whenever the archive
 * published a new solution.
 */
const PLANET = 'TRAPPIST-1 e';

/** The sheet's arrangement scope — the library's LY-1 door (`vizfootprint-ui` · `sheetLayoutViewId`), spelled here so this script needs no React import. */
const SHEET_LAYOUT = 'layout:sheet:measurements';

const cause = (intent: string): Cause => ({ requestedBy: 'user', computedBy: 'user', intent });

async function main(): Promise<void> {
  const surface = await buildExoSurfaceAsync();
  if (surface.actRefusals.length > 0) throw new Error(`the acts did not land, so there is no walk to capture: ${surface.actRefusals.join('; ')}`);
  const { session } = surface;

  // 2 · the planet
  const picked = await session.dispatch({ verb: 'select', viewId: SCATTER_ADDRESS, field: 'pl_name', value: PLANET, cause: cause(`read every published value for ${PLANET}`) });
  if (!picked.ok) throw new Error(`the select was refused: ${picked.rejection.detail}`);

  // 3 · oldest first — an act, not a scroll
  const sorted = await session.dispatch({
    verb: 'navigate',
    viewId: SHEET_LAYOUT,
    field: 'sort',
    value: JSON.stringify([{ field: 'pl_pubdate', dir: 'asc' }]),
    cause: cause('sort the published values by date, oldest first'),
  });
  if (!sorted.ok) throw new Error(`the sort was refused: ${sorted.rejection.detail}`);

  // 4 · a name for the moment
  const named = await session.dispatch({ verb: 'bookmark', label: `every published radius for ${PLANET}`, cause: cause(`name this moment: every published radius for ${PLANET}`) });
  if (!named.ok) throw new Error(`the bookmark was refused: ${named.rejection.detail}`);

  // 5 · a READ: why does the sheet hold these rows?
  const why = await session.why({ kind: 'selection', viewId: SCATTER_ADDRESS });

  // 6 · another READ: the rows, and the receipt that addresses them
  const exported = await exportFromSession(session, { table: 'measurements', viewId: SHEET_VIEW, sort: [{ field: 'pl_pubdate', dir: 'asc' }], format: 'csv' });
  if (!exported.ok) throw new Error(`the export was refused: ${exported.rejected}`);

  const walk = {
    from: 'in process — this demo has no served host, so the walk is taken through the same session builder the page uses',
    capturedAt: new Date().toISOString(),
    planet: PLANET,
    log: session.log.records,
    bookmarks: session.bookmarkViews(),
    saved: [],
    // the two READS, kept out of the log because they landed nothing
    reads: {
      why: { question: { kind: 'selection', viewId: SCATTER_ADDRESS }, answer: why },
      export: { names: exported.names, receipt: exported.receipt, bodyBytes: exported.body.length, firstLine: exported.body.split('\n')[0] },
    },
  };
  await mkdir(dirname(fileURLToPath(OUT)), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(walk, null, 2)}\n`, 'utf8');

  process.stderr.write(
    `exo: walked ${String(walk.log.length)} commits (${String(surface.tables.measurements.length)} measurements, ${String(surface.derived.rows.length)} planets in the minted table), ` +
      `exported ${String(exported.receipt.exported.rows)} of ${String(exported.receipt.count)} rows for ${PLANET}\n→ ${fileURLToPath(OUT)}\n`,
  );
}

void main();
