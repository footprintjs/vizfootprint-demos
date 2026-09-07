/**
 * THE STATIC SITE'S TWO PROMISES.
 *
 * 1. Every file a page will FETCH is a file the build COPIES. The browser
 *    loaders and the Vite config read one list; a page asking for a file the
 *    build never carried would be a 404 in production and nothing here.
 * 2. Both hosts serve the SAME rows payload. The served desk gets it from
 *    `/api/rows`; the static page calls the same function on a session it
 *    built in the browser. A field that appeared on one and not the other
 *    would be a dashboard missing a chart with no sign of why.
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { GRID_FILES, NNDSS_FILES, SITE_DATA_FILES } from '../src/data/files.js';
import { nndssRows } from '../src/nndss/rows.js';
import { gridRows } from '../src/grid/rows.js';
import { buildNndssSurface } from '../src/nndss/surface.js';
import { buildGridSurface } from '../src/grid/surface.js';
import { loadGraph } from '../src/nndss/snapshot.js';

const REPO = new URL('../', import.meta.url);

describe('every file a page fetches is a file the build carries', () => {
  it('lists every table both demos declare', () => {
    for (const file of [...Object.values(NNDSS_FILES), ...Object.values(GRID_FILES)]) expect(SITE_DATA_FILES).toContain(file);
  });

  it('names files that are actually in this checkout', () => {
    const missing = SITE_DATA_FILES.filter((file) => !existsSync(new URL(file, REPO)));
    expect(missing).toEqual([]);
  });

  // the ISC licence asks that its notice travel with the file it covers, so the
  // built site carries the notice beside the boundaries or it does not carry them
  it('carries the boundary file\'s licence notice beside it', () => {
    expect(SITE_DATA_FILES).toContain('data/geo/LICENSE-us-atlas');
  });
});

describe('one rows payload, two hosts', () => {
  it('gives the CDC desk every field its cockpit reads', () => {
    const rows = nndssRows(buildNndssSurface(undefined, loadGraph()));
    expect(Object.keys(rows).sort()).toEqual(['absence', 'cells', 'counts', 'declared', 'diseases', 'edges', 'grain', 'grammar', 'jurisdictions', 'netRefused', 'nodes', 'series', 'weeks']);
  });

  it('gives the grid desk every field its cockpit reads', () => {
    const rows = gridRows(buildGridSurface());
    expect(Object.keys(rows).sort()).toEqual(['absence', 'authorities', 'counts', 'declared', 'grammar', 'hourly', 'hours', 'interchange', 'links', 'netRefused']);
  });

  // the contrast is the ONE field the static grid page does not have, and its
  // absence is a shape difference the payload states rather than a value it fakes
  it('leaves the contrast out when no second demo is beside it', () => {
    expect('contrast' in gridRows(buildGridSurface())).toBe(false);
    expect('contrast' in gridRows(buildGridSurface(), { label: 'CDC', nodes: 15, edges: 105, interaction: true })).toBe(true);
  });
});
