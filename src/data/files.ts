/**
 * WHERE THE COMMITTED FILES LIVE — one list, three readers.
 *
 * The paths are repo-relative and they are also site-relative, because the
 * static build copies `data/` into the built site unchanged. That is the whole
 * trick: `data/nndss/snapshot.csv` names the same bytes whether a server reads
 * it off disk or a page fetches it under the site's base.
 *
 * This module imports NOTHING. It is loaded by the browser loaders
 * (`src/nndss/http.ts`, `src/grid/http.ts`) AND by the static build's Vite
 * config, which decides what to copy — and a config that had to evaluate the
 * library to learn a file name would be a build that fails for a reason
 * nothing to do with the build.
 */

/** The CDC demo's files, by the table each one becomes. */
export const NNDSS_FILES = {
  snapshot: 'data/nndss/snapshot.csv',
  nodes: 'data/nndss/graph/nodes.csv',
  edges: 'data/nndss/graph/edges.csv',
  geo: 'data/geo/us-states.geo.json',
} as const;

/** The grid demo's files. */
export const GRID_FILES = {
  balance: 'data/grid/balance.csv',
  interchange: 'data/grid/interchange.csv',
} as const;

/**
 * What a static build must carry, beyond the tables themselves.
 *
 * The provenance records ride along because a dashboard that says where its
 * numbers came from should be able to hand over the record, and
 * `LICENSE-us-atlas` rides along because the ISC licence requires its notice
 * to travel with the file it covers — publishing the boundaries without it
 * would break the one condition that made publishing them lawful.
 */
export const SITE_PROVENANCE_FILES = ['data/nndss/PROVENANCE.json', 'data/nndss/graph/PROVENANCE.json', 'data/geo/PROVENANCE.json', 'data/geo/LICENSE-us-atlas', 'data/grid/PROVENANCE.json'] as const;

/** Everything the built site needs under `data/` — the tables and the papers that must travel with them. */
export const SITE_DATA_FILES: readonly string[] = [...Object.values(NNDSS_FILES), ...Object.values(GRID_FILES), ...SITE_PROVENANCE_FILES];
