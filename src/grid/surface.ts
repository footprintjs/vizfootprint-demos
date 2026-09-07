/**
 * THE GRID SURFACE'S NODE DOOR — the same session, with the committed CSVs as
 * its default.
 *
 * `./session.ts` holds the whole surface and takes its tables as an argument,
 * because a browser has no disk and the static site needs exactly that
 * builder. This file adds the one thing a server and a test want and a page
 * cannot have: `loadGrid()` as a default argument. Every name `./session.ts`
 * exports passes straight through — the CDC demo's `src/nndss/surface.ts` is
 * the same door over the same split.
 */
import { loadGrid } from './snapshot.js';
import { openGridSurface, openGridSurfaceAsync } from './session.js';
import type { GridSurface } from './session.js';
import type { GridTables } from './etl.js';

export * from './session.js';

/** The surface, SYNCHRONOUSLY, over the committed CSVs — the graph is declared but NOT laid out; see {@link layOutGrid}. */
export function buildGridSurface(tables: GridTables = loadGrid()): GridSurface {
  return openGridSurface(tables);
}

/** The same surface through the async builder, over the committed CSVs — a refresh door, a data journal, and the grid laid out before the first request is served. */
export async function buildGridSurfaceAsync(tables: GridTables = loadGrid()): Promise<GridSurface> {
  return openGridSurfaceAsync(tables);
}
