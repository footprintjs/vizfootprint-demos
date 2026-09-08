/**
 * WHAT THE GRID DEMO COVERS — its one surface, as a card.
 *
 * The CDC demo's `../nndss/cards.ts` is two cards because that demo is two
 * builds. This demo is ONE: the desk over EIA's four tables, and nothing else
 * has been built from `gridDef`. So this file is one function returning one
 * surface, and the moment a second build exists (a story page, a wizard output)
 * it becomes a second entry here, read off that build the same way.
 *
 * Nothing here lists a feature. `defFeatures` reads them off the built
 * dashboard — the same `gridDef(tables)` the desk opens (`./session.ts`), so a
 * view added there is a chip here the same afternoon.
 *
 * TWO HONEST ABSENCES, and why they stay absent rather than being filled in:
 *
 * - no `byHand`: nobody has written this cockpit's gesture table. The CDC desk
 *   has one because its Grammar panel needed it; the grid desk draws no such
 *   panel and no such table exists. A table this file invented to make the card
 *   look complete would be the typed list the whole feature refuses.
 * - no `walked`: no trace has been captured on this desk. The card says
 *   "no trace has been captured for this surface" in the studio's own words,
 *   which is a different sentence from "nobody did anything".
 *
 * No `node:fs` here, for the reason `../nndss/cards.ts` has none: the tables
 * are an argument, so this runs wherever the def does.
 */
import { buildDashboard, defFeatures } from 'vizfootprint/def';
import type { DemoSurface } from 'vizfootprint-studio/cards';
import { gridDef } from './def.js';
import type { GridTables } from './etl.js';

/** The demo's name, once — the same word a gallery counts demos by. */
export const GRID_DEMO = 'US grid, hour by hour';

export interface GridCardsInput {
  readonly tables: GridTables;
}

/**
 * The demo's surfaces, ready for `<DemoGallery>` — one today.
 *
 * ```ts
 * const [desk] = gridSurfaces({ tables: loadGrid() });
 * desk.declares.chartKinds;   // whatever gridDef draws with — read, not written here
 * desk.walked;                // undefined: no trace has been captured on this desk
 * ```
 */
export function gridSurfaces(input: GridCardsInput): readonly DemoSurface[] {
  return [deskSurface(input)];
}

/** The desk: the definition exactly as `openGridSurface` builds it. */
function deskSurface(input: GridCardsInput): DemoSurface {
  return {
    demo: GRID_DEMO,
    surface: 'desk',
    blurb: "the whole cockpit over EIA's four tables — the interchange graph laid out as a network, and demand and generation hour by hour",
    declares: defFeatures(buildDashboard(gridDef(input.tables))),
  };
}
