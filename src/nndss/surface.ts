/**
 * THE SURFACE'S NODE DOOR — the same session, with the committed files as its
 * defaults.
 *
 * `./session.ts` holds the whole surface and takes its tables as arguments,
 * because a browser has no disk and the static site needs exactly that
 * builder. This file adds the one thing a server and a test want and a page
 * cannot have: `loadSnapshot()` and `loadGraph()` as default arguments. It is
 * a door, not a layer — every name `./session.ts` exports passes straight
 * through, so an importer picks the file by what it can afford to load, never
 * by what it needs to call.
 */
import { loadGraph, loadSnapshot } from './snapshot.js';
import { openNndssSurface, openNndssSurfaceAsync } from './session.js';
import type { NndssSurface } from './session.js';
import type { NndssTables } from './etl.js';
import type { NndssGraph } from './graph.js';

export * from './session.js';

/** The surface, SYNCHRONOUSLY, over the committed files — for a test or a script that wants a session and nothing else. The graph is declared but NOT laid out; see {@link layOutGraph}. */
export function buildNndssSurface(tables: NndssTables = loadSnapshot(), graph: NndssGraph = loadGraph()): NndssSurface {
  return openNndssSurface(tables, graph);
}

/** The same surface through the async builder, over the committed files — the one with a refresh door, a data journal, and the graph laid out before the first request is served. */
export async function buildNndssSurfaceAsync(tables: NndssTables = loadSnapshot(), graph: NndssGraph = loadGraph()): Promise<NndssSurface> {
  return openNndssSurfaceAsync(tables, graph);
}
