/**
 * THE EXOPLANET SURFACE'S NODE DOOR — the same session, with the committed CSVs
 * as its default.
 *
 * `./session.ts` holds the whole surface and takes its tables as an argument,
 * because a browser has no disk and the static site needs exactly that builder.
 * This file adds the one thing a server and a test want and a page cannot have:
 * `loadExo()` as a default argument. Every name `./session.ts` exports passes
 * straight through — `src/grid/surface.ts` is the same door over the same split.
 */
import { loadExo } from './snapshot.js';
import { openExoSurface, openExoSurfaceAsync } from './session.js';
import type { ExoSurface } from './session.js';
import type { ExoTables } from './etl.js';

export * from './session.js';

/** The surface, SYNCHRONOUSLY, over the committed CSVs — the five acts are declared but NOT landed; see {@link landExoActs}. */
export function buildExoSurface(tables: ExoTables = loadExo()): ExoSurface {
  return openExoSurface(tables);
}

/** The same surface through the async builder, over the committed CSVs — a refresh door, a data journal, and the five acts landed before the first request is served. */
export async function buildExoSurfaceAsync(tables: ExoTables = loadExo()): Promise<ExoSurface> {
  return openExoSurfaceAsync(tables);
}
