/**
 * WHAT THE EXOPLANET DEMO COVERS — its one surface, as a card.
 *
 * Nothing here lists a feature. `defFeatures` reads them off the built
 * dashboard — the same `exoDef(tables)` the desk opens (`./session.ts`) — and
 * `logFeatures` reads them off the trace `npm run exo:capture` recorded on a
 * real walk. So a view added in the def is a chip here the same afternoon, and
 * a chip that says somebody DID something is a chip a commit proves.
 *
 * ONE HONEST ABSENCE, and why it stays absent rather than being filled in: no
 * `byHand`. Nobody has written this cockpit's gesture table. The CDC desk has
 * one because its Grammar panel needed it; this page draws no such panel and no
 * such table exists. A table this file invented to make the card look complete
 * would be the typed list the whole feature refuses.
 *
 * No `node:fs` here, for the reason `../grid/cards.ts` has none: the tables and
 * the captured walk are arguments, so this runs wherever the def does.
 */
import { buildDashboard, defFeatures } from 'vizfootprint/def';
import { logFeatures } from 'vizfootprint/branches';
import type { DemoSurface } from 'vizfootprint-studio/cards';
import type { CapturedWalk } from '../nndss/cards.js';
import { exoDef } from './def.js';
import type { ExoTables } from './etl.js';

/** The demo's name, once — the same word a gallery counts demos by. */
export const EXO_DEMO = 'Exoplanets, published twice';

export interface ExoCardsInput {
  readonly tables: ExoTables;
  /** The walk `scripts/exo-capture.ts` recorded; without one, the card says nobody has walked it. */
  readonly captured?: CapturedWalk;
}

/**
 * The demo's surfaces, ready for `<DemoGallery>` — one today.
 *
 * ```ts
 * const [desk] = exoSurfaces({ tables: loadExo(), captured });
 * desk.declares.analyses;   // the five acts, read off the def — not written here
 * desk.walked?.verbs;       // what the recorded walk really landed
 * ```
 */
export function exoSurfaces(input: ExoCardsInput): readonly DemoSurface[] {
  return [deskSurface(input)];
}

/** The desk: the definition exactly as `openExoSurface` builds it, plus the one recorded walk. */
function deskSurface(input: ExoCardsInput): DemoSurface {
  const captured = input.captured;
  return {
    demo: EXO_DEMO,
    surface: 'desk',
    blurb:
      "the archive's accepted numbers beside every number ever published for the same planet — a scatter of the composite, a histogram an act cuts at run time, references by year, and a sheet whose delta column says how far each publication sits from the accepted value",
    declares: defFeatures(buildDashboard(exoDef(input.tables))),
    ...(captured === undefined ? {} : { walked: logFeatures(captured.log) }),
  };
}
