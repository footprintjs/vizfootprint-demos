/**
 * THE ROWS PAYLOAD — everything a cockpit needs to draw, in one object.
 *
 * The three ETL'd tables, the graph's two AT THE CURSOR, the absence
 * vocabulary, the grain, and the grammar as the def declares it. It is read
 * ONCE on entry and never polled; the cheap poll is the session state.
 *
 * WHY it lives here and not in the server: there are two hosts now. The server
 * answers it at `/api/rows`; the static site's page calls it directly on a
 * session it built in the browser. A second copy of this object would be a
 * second answer to "what does this dashboard declare?", and the day one gains
 * a field the other would quietly serve a dashboard missing it.
 */
import { DISPATCH_VERBS } from 'vizfootprint/def';
import { ABSENCE_FIELD, ABSENCE_STATES } from './absence.js';
import { DASHBOARD_WORDS } from './def.js';
import type { NndssSurface } from './session.js';

/** The one wiring rule in force today, and the words that say what it means. */
const LINKS = 'implicit-crossfilter';
const LINKS_MEANING = "every view's selection filters every other view; a view never filters itself";

export function nndssRows(surface: NndssSurface): Record<string, unknown> {
  const { tables, graphRows, dashboard } = surface;
  return {
    cells: tables.cells,
    jurisdictions: tables.jurisdictions,
    series: tables.series,
    // the graph's two tables AT THE CURSOR — the committed rows plus the columns
    // the layout and bring-over acts wrote onto them. Not the CSVs: the positions
    // are two commits' output, and a reader that took the files would serve a
    // graph with nowhere to put anything.
    nodes: graphRows.nodes,
    edges: graphRows.edges,
    // null when both windows answered; the library's own sentence when one did not
    netRefused: graphRows.refused,
    grain: tables.grain,
    diseases: tables.diseases,
    weeks: tables.weeks,
    counts: tables.counts,
    absence: { field: ABSENCE_FIELD, states: ABSENCE_STATES },
    // the def's DECLARED words — the story's fallback for bookmarks no describe reached (never the live words)
    declared: { dashboard: { ...DASHBOARD_WORDS } },
    // THE GRAMMAR, as declared — the Grammar panel renders this and nothing else.
    // PROJECTED from the validated, frozen def the session actually runs on, never
    // re-derived: rebuilding it here would copy every series row to read one field,
    // and could drift from what the session runs the next time the def grows an argument.
    grammar: { verbs: DISPATCH_VERBS, encodings: dashboard.def.encodings ?? [], links: LINKS, linksMeaning: LINKS_MEANING },
  };
}
