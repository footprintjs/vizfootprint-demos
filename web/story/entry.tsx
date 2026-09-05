/**
 * THE PAGE ENTRY — file one of the recipe.
 *
 * A definition is data except for its analyses, which are code with a `run()`.
 * So a story page cannot carry its def in the payload the way it carries the
 * log: it IMPORTS it, here, and the build bundles it. That is the whole reason
 * this file exists and the whole reason a story page is a build rather than a
 * button in the cockpit.
 *
 * What it does: read the CSV and the shapes out of the payload, run the SAME
 * ETL the server runs (`nndssTablesFromRows` — which is why that module may not
 * import `node:fs`; see `src/nndss/snapshot.ts`), build the def over them, open
 * a session, and hand the two lenses to `StoryPage`. Everything after that —
 * restore the pictures, replay the log, restore the bookmarks, tell the story,
 * fork a path when a reader opens a door — is the library's.
 */
import { createRoot } from 'react-dom/client';
import { buildDashboard } from 'vizfootprint/agent';
import { parseCSVTyped } from 'vizfootprint/data';
import { StoryPage } from 'vizfootprint-ui/story/page';
import type { StoryPageSession } from 'vizfootprint-ui/story/page';
import type { GeoFeatureCollection } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import 'storydeck/storydeck.css';
import { nndssTablesFromRows, type NndssTables } from '../../src/nndss/etl.js';
import { DASHBOARD_WORDS, nndssDef } from '../../src/nndss/def.js';
import type { NndssPageData } from '../../src/nndss/story.js';
import { StoryDesk } from './Desk.js';

/**
 * What the def was built FROM — set once, by `open`, and read by the two lenses
 * afterwards. The charts draw the same rows the session judges clauses over, so
 * there is one copy and this is it; a second parse would be a second table that
 * could disagree with the one the session holds.
 */
let desk: { readonly tables: NndssTables; readonly geo: GeoFeatureCollection | null } | null = null;

function open(payload: { readonly data?: NndssPageData }): StoryPageSession {
  const data = payload.data;
  if (data === undefined) throw new Error('this page carries no snapshot — it was built without its data');
  const tables = nndssTablesFromRows(parseCSVTyped(data.csv).rows);
  desk = { tables, geo: (data.geo ?? null) as GeoFeatureCollection | null };
  return buildDashboard(nndssDef(tables)).createSession() as unknown as StoryPageSession;
}

const root = document.getElementById('root');
if (root === null) throw new Error('the page has no #root to mount into');

createRoot(root).render(
  <StoryPage<NndssPageData>
    open={open}
    story={{ declared: DASHBOARD_WORDS, author: 'the desk' }}
    figure={(lens) => (desk === null ? null : <StoryDesk lens={lens} tables={desk.tables} geo={desk.geo} as="figure" />)}
    explore={(lens) => (desk === null ? null : <StoryDesk lens={lens} tables={desk.tables} geo={desk.geo} as="cockpit" />)}
  />,
);
