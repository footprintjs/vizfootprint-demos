/**
 * THE GRID'S ROWS PAYLOAD — everything the grid cockpit needs to draw.
 *
 * The CDC demo's `src/nndss/rows.ts` says why this is not in the server: two
 * hosts answer it now — `/api/grid/rows` on the wire, and the static site's
 * page directly, on a session it built in the browser. One payload, so a field
 * added for one host cannot go missing on the other.
 *
 * The whole body is 30.7 MB over the committed slice (measured). This door IS
 * the dataset; it is read once, on entry, and never polled.
 */
import { DISPATCH_VERBS } from 'vizfootprint/def';
import { ABSENCE_FIELD, ABSENCE_STATES } from './absence.js';
import { GRID_WORDS } from './def.js';
import type { GridSurface } from './session.js';

/** The one wiring rule in force today, and the words that say what it means. */
const LINKS = 'implicit-crossfilter';
const LINKS_MEANING = "every view's selection filters every other view; a view never filters itself";

/**
 * The OTHER demo's graph, counted — never its verdict.
 *
 * The page runs the library's reading rule over BOTH graphs and renders what
 * comes back, which means the CDC graph has to reach the page as NUMBERS. A
 * payload that shipped "the CDC graph prefers a matrix" would be a hand-written
 * verdict wearing the rule's clothes; one that ships 15 nodes and 105
 * undirected pairs lets the reader watch the rule fire.
 */
export interface ContrastGraph {
  readonly label: string;
  readonly nodes: number;
  /** Undirected pairs, counted once — the fact `graphReadingFor` asks for. */
  readonly edges: number;
  readonly interaction: boolean;
}

export function gridRows(surface: GridSurface, contrast?: ContrastGraph): Record<string, unknown> {
  const { tables, dashboard, graphRows } = surface;
  return {
    authorities: graphRows.authorities,
    links: graphRows.links,
    hourly: tables.hourly,
    interchange: tables.interchange,
    // null when both windows answered; the library's own sentence when one did not
    netRefused: graphRows.refused,
    hours: tables.hours,
    counts: tables.counts,
    absence: { field: ABSENCE_FIELD, states: ABSENCE_STATES },
    // the def's DECLARED words — the page's fallback before any describe
    declared: { dashboard: { ...GRID_WORDS } },
    ...(contrast === undefined ? {} : { contrast }),
    // THE GRAMMAR, as declared — PROJECTED from the validated, frozen def the
    // session actually runs on, never re-derived.
    grammar: { verbs: DISPATCH_VERBS, encodings: dashboard.def.encodings ?? [], links: LINKS, linksMeaning: LINKS_MEANING },
  };
}
