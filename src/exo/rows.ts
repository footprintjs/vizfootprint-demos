/**
 * THE EXOPLANET DESK'S ROWS PAYLOAD — everything the page needs to draw.
 *
 * `src/nndss/rows.ts` says why this is not in a server: more than one host
 * answers it. Today that is the static site's page, which builds its session in
 * the browser; a served door would read the same function. One payload, so a
 * field added for one host cannot go missing on the other.
 *
 * The whole body is about 24 MB over the committed slice, and this door IS the
 * dataset: it is read once, on entry, and never polled.
 *
 * The DERIVED table travels beside the three declared ones, because it is not
 * in the data: the page cannot compute it and must not try. What arrives is what
 * the aggregate and its two derives actually landed.
 */
import { DISPATCH_VERBS } from 'vizfootprint/def';
import { ABSENCE_FIELD, ABSENCE_STATES, CARRIES, CARRIES_NOTE } from './absence.js';
import { EXO_ACT_ORDER, EXO_WORDS } from './def.js';
import type { ExoSurface } from './session.js';

/** The one wiring rule in force today, and the words that say what it means. */
const LINKS = 'implicit-crossfilter';
const LINKS_MEANING = "every view's selection filters every other view; a view never filters itself";

export function exoRows(surface: ExoSurface): Record<string, unknown> {
  const { tables, dashboard, derived } = surface;
  return {
    measurements: tables.measurements,
    planets: tables.planets,
    references: tables.references,
    // the table no file holds: one row per planet with a published radius, as the acts landed it
    derived: derived.rows,
    // null when the window answered; the library's own sentence when it did not
    derivedRefused: derived.refused,
    actRefusals: surface.actRefusals,
    // the sentence the library refused the boot's ONE pre-act gesture with — a click on the
    // histogram, made before the aggregate had landed, so a visitor who arrives afterwards can
    // still read the refusal that a chart over a minted table really answers (src/exo/session.ts
    // · probeTheMintedTable). Never re-derived on the page: a quoted refusal is prose.
    mintedTableRefusal: surface.mintedTableRefusal,
    /** What the five acts were asked to do, in order — the words the ledger will show. */
    acts: EXO_ACT_ORDER,
    counts: tables.counts,
    // the vocabulary, plus the one thing the library cannot be told about it today
    absence: { field: ABSENCE_FIELD, states: ABSENCE_STATES, carries: CARRIES, note: CARRIES_NOTE },
    // no `window` any more: the scatter's axes are LOGARITHMIC, declared on the view's
    // frame, and the frame rides in `grammar.encodings` below with the rest of the def
    // the session runs on — one owner, projected, never a second copy on the payload
    // the def's DECLARED words — the page's fallback before any describe
    declared: { dashboard: { ...EXO_WORDS } },
    // THE GRAMMAR, as declared — PROJECTED from the validated, frozen def the
    // session actually runs on, never re-derived.
    grammar: { verbs: DISPATCH_VERBS, encodings: dashboard.def.encodings ?? [], links: LINKS, linksMeaning: LINKS_MEANING },
  };
}
