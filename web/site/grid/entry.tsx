/**
 * THE GRID DESK, STATIC — the same dashboard with no server behind it.
 *
 * `web/src/GridApp.tsx` is the SERVED cockpit: two host endpoints and a reset
 * door under `/api/grid/*`. A static host has none, so this is the smaller
 * host a page with no process can honestly be — and everything that matters is
 * shared with the served one: `gridDef` (one definition), `openGridSurfaceAsync`
 * (one session builder), `gridRows` (one payload), `useGridCells` (one set of
 * charts). The CDC desk beside it boots the same way; see `../nndss/entry.tsx`.
 *
 * One thing the served page has that this one does not: the `contrast` counts,
 * the CDC graph's node and edge totals, which reach the served page only when
 * ONE process serves both demos. Here the two demos are two pages, so the
 * reading-rule contrast has nothing to compare against and the payload leaves
 * it out — the cell already knows how to say so.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSessionView, sessionSheetData, sessionSource } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import 'storydeck/storydeck.css';
import { Desk } from 'vizfootprint-studio/desk';
import { loadGridOverHttp } from '../../../src/grid/http.js';
import { gridRows } from '../../../src/grid/rows.js';
import { openGridSurfaceAsync, type GridSurface } from '../../../src/grid/session.js';
import type { GridRowsPayload } from '../../src/GridApp.js';
import { GRID_STORY_FIGURE, colorOfState, useGridCells, useGridSilences, type GridDeskData } from '../../src/gridCells.js';
import { Broken, Reading, WhatIsMissing, sentenceOf, siteBase } from '../boot.js';

interface Booted {
  readonly surface: GridSurface;
  readonly rows: GridRowsPayload;
  readonly checks: readonly string[];
}

/** The whole start-up, in the order the server does it. `../nndss/entry.tsx` says why the payload is cast. */
async function boot(): Promise<Booted> {
  const { tables } = await loadGridOverHttp(siteBase());
  const surface = await openGridSurfaceAsync(tables);
  return { surface, rows: gridRows(surface) as unknown as GridRowsPayload, checks: await surface.dashboard.lintData() };
}

function StaticGridDesk({ booted }: { readonly booted: Booted }): JSX.Element {
  const { surface, rows, checks } = booted;
  const data: GridDeskData = { authorities: rows.authorities, links: rows.links, hourly: rows.hourly, hours: rows.hours, absence: rows.absence, netRefused: rows.netRefused };
  const silences = useGridSilences(data);
  return (
    <Desk
      view={createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' })}
      charts={(desk) => useGridCells(desk, data)}
      silences={{
        groups: silences,
        colorOf: colorOfState,
        heading: (
          <>
            Every hour of the window, regardless of the selection. EIA has no flag characters — it says these things with COLUMNS, and these are our words for them: <b>estimated</b> — the authority filed nothing and EIA supplied the number; <b>replaced</b> — the authority filed a number, EIA judged it wrong and published its own (both are kept); <b>not-configured</b> — this authority has no such figure to file at all (nine are generation-only); <b>unavailable</b> — it normally files this and this hour is missing; <b>unknown</b> — never invented, the word that refuses to guess. A measured <b>0</b> is not any of these: 5,971 flow cells carry one.
          </>
        ),
      }}
      data={{ table: 'hourly', sheet: () => sessionSheetData(surface.session, { table: 'hourly' }), checks }}
      story={{ declared: rows.declared?.dashboard, author: 'the desk', figure: GRID_STORY_FIGURE, emptyNote: 'No bookmarks named on this lineage yet — name a bookmark in the time strip and it becomes a section here.' }}
    />
  );
}

function Page(): JSX.Element {
  const [state, setState] = useState<{ readonly status: 'reading' } | { readonly status: 'broken'; readonly sentence: string } | { readonly status: 'ready'; readonly booted: Booted }>({ status: 'reading' });

  useEffect(() => {
    let live = true;
    void boot()
      .then((booted) => live && setState({ status: 'ready', booted }))
      .catch((e: unknown) => live && setState({ status: 'broken', sentence: sentenceOf(e) }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status === 'reading') return <Reading what="EIA's committed slice (8.7 MB across two files)" />;
  if (state.status === 'broken') return <Broken sentence={state.sentence} />;
  return (
    <>
      <WhatIsMissing extra={<> The <b>reading-rule contrast</b> against the CDC graph is also absent: it only exists when one process serves both demos, and here they are two pages.</>} />
      <StaticGridDesk booted={state.booted} />
    </>
  );
}

const mount = document.getElementById('root');
if (mount === null) throw new Error('the page has no #root to mount into');
createRoot(mount).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
