/**
 * WHAT THE PROTEIN DEMO COVERS — its one surface, as a card.
 *
 * Nothing here lists a feature. `defFeatures` reads them off the built
 * dashboard — the same `protDef(tables, text)` the desk opens (`./session.ts`) — so a
 * view added to the def is a chip on the front page the same afternoon.
 *
 * TWO HONEST ABSENCES, kept rather than filled in:
 *
 *   - no `walked`. Nobody has captured a walk on this desk: the picks that
 *     matter here happen inside a WebGL canvas, and this repository's capture
 *     scripts drive a session rather than a GPU. A card that claimed a walk
 *     would be claiming a trace no file holds.
 *   - no `byHand`. Nobody has written this desk's gesture table, and a table
 *     invented to make the card look complete is exactly the typed list the
 *     whole feature refuses.
 *
 * No `node:fs` here, for the reason `../exo/cards.ts` has none: the tables are
 * an argument, so this runs wherever the def does.
 */
import { buildDashboard, defFeatures } from 'vizfootprint/def';
import type { DemoSurface } from 'vizfootprint-studio/cards';
import { protDef } from './def.js';
import type { ProtTables } from './etl.js';

/** The demo's name, once — the same word a gallery counts demos by. */
export const PROT_DEMO = 'A protein complex, in two pictures';

export interface ProtCardsInput {
  readonly tables: ProtTables;
  /**
   * The entry's own text — what the three declared acts read
   * (`./analyses.ts`). A card lists what a def DECLARES and runs nothing, but
   * the def cannot be built without the bytes its acts are declared over, so
   * the caller that already has them hands them in (`../site/cards.ts` reads
   * the file once and passes both).
   */
  readonly structureText: string;
}

/**
 * The demo's surfaces, ready for `<DemoGallery>` — one.
 *
 * ```ts
 * const text = loadStructureText();
 * const [desk] = protSurfaces({ tables: protTables(text), structureText: text });
 * desk.declares.views;   // read off the def — not written here
 * ```
 */
export function protSurfaces(input: ProtCardsInput): readonly DemoSurface[] {
  return [deskSurface(input)];
}

function deskSurface(input: ProtCardsInput): DemoSurface {
  return {
    demo: PROT_DEMO,
    surface: 'desk',
    blurb:
      "one protein–protein complex, drawn twice: in three dimensions by Mol* — somebody else's viewer, joined to this grammar through the library's renderer contract — and again as the two backbone angles of every residue. A click in either picture is the same residue in the other, and in the sheet",
    declares: defFeatures(buildDashboard(protDef(input.tables, input.structureText))),
  };
}
