/**
 * THE CDC DESK, STATIC — the same dashboard with no server behind it.
 *
 * `web/src/App.tsx` is the SERVED cockpit: six host endpoints, an analyst, a
 * proposals door, a refresh door, a reset door. None of those exist on a
 * static host, so this is not that file with parts commented out — it is the
 * smaller host that a page with no process can honestly be. What it shares
 * with the served one is everything that matters: `nndssDef` (one definition),
 * `openNndssSurfaceAsync` (one session builder), `nndssRows` (one payload),
 * `useNndssCells` (one set of charts) and the Grammar panel.
 *
 * The boot, in the order the server does it:
 *   1. the three committed CSVs, over http, through the library's source port
 *   2. the ETL, unchanged — it was always pure
 *   3. the dashboard, validated, and the two layout acts landed as commits
 *   4. a session view over an IN-PROCESS session (`sessionSource`), not a poll
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSessionView, sessionSheetData, sessionSource, type GeoFeatureCollection } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import 'storydeck/storydeck.css';
import { Desk } from 'vizfootprint-studio/desk';
import { loadGeoOverHttp, loadNndssOverHttp } from '../../../src/nndss/http.js';
import { nndssRows } from '../../../src/nndss/rows.js';
import { openNndssSurfaceAsync, type NndssSurface } from '../../../src/nndss/session.js';
import type { RowsPayload } from '../../src/App.js';
import { STORY_FIGURE, colorOfState, useNndssCells, useSilences, type NndssDeskData } from '../../src/cells.js';
import { GrammarPanel } from '../../src/GrammarPanel.js';
import { Broken, Reading, WhatIsMissing, sentenceOf, siteBase } from '../boot.js';
import { BrowserAnalyst } from './analyst.js';

/** What the boot produces: a live session, the rows it will draw, the shapes, and the data checks. */
interface Booted {
  readonly surface: NndssSurface;
  readonly rows: RowsPayload;
  readonly geo: GeoFeatureCollection;
  readonly checks: readonly string[];
}

/**
 * The whole start-up. It is `async` and it is one function on purpose: the
 * order is the contract — the graph has no positions until the layout acts
 * land, and the rows payload is read at the one moment no clause can exist.
 *
 * WHY the cast on the payload: `nndssRows` builds the object the wire carries,
 * and the served cockpit types it on arrival with exactly this cast
 * (`await res.json() as RowsPayload`). Making the same crossing without a wire
 * does not make it a different crossing, and inventing a second typed shape
 * for it would be the second copy this page exists to avoid.
 */
async function boot(): Promise<Booted> {
  const base = siteBase();
  const [{ tables, graph }, geo] = await Promise.all([loadNndssOverHttp(base), loadGeoOverHttp(base)]);
  const surface = await openNndssSurfaceAsync(tables, graph);
  return { surface, rows: nndssRows(surface) as unknown as RowsPayload, geo: geo as unknown as GeoFeatureCollection, checks: await surface.dashboard.lintData() };
}

function StaticNndssDesk({ booted }: { readonly booted: Booted }): JSX.Element {
  const { surface, rows, geo, checks } = booted;
  const data: NndssDeskData = { cells: rows.cells, series: rows.series, nodes: rows.nodes, edges: rows.edges, netRefused: rows.netRefused, diseases: rows.diseases, weeks: rows.weeks, absence: rows.absence, grain: rows.grain, geo };
  const silences = useSilences(data);
  return (
    <Desk
      // the session is already built, so the desk takes the LIVE view and the
      // page owns its lifetime — the factory form exists for a front slot, and
      // this page's front door is the site's index
      view={createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' })}
      charts={(desk) => useNndssCells(desk, data)}
      silences={{
        groups: silences,
        colorOf: colorOfState,
        heading: (
          <>
            Week ending {data.weeks[data.weeks.length - 1] ?? ''}, every area regardless of the selection. CDC's flags, in our words: <b>not-configured</b> — not reportable there (stop looking); <b>unavailable</b> — the jurisdiction could not send it (go ask); <b>withheld</b> — CDC has it and did not print it; <b>unknown</b> — nothing said.
          </>
        ),
      }}
      data={{
        table: 'cells',
        // the Sheet's window, answered by the session's own view-query port —
        // the served desk asks the same question through `/api/window`
        sheet: () => sessionSheetData(surface.session, { table: 'cells' }),
        checks,
      }}
      story={{ declared: rows.declared?.dashboard, author: 'the desk', figure: STORY_FIGURE, emptyNote: 'No bookmarks named on this lineage yet — name a bookmark in the time strip and it becomes a section here.' }}
      // THE ANALYST, with no process behind it: the turn runs in this tab on a
      // key the visitor supplies, over the very session these charts are drawn
      // from — so an act it lands appears here exactly as a person's would
      aside={[{ id: 'analyst', label: '🧭 Analyst', title: 'Analyst', render: (projection) => <BrowserAnalyst surface={surface} desk={projection} /> }]}
      reports={(desk, own) => [
        {
          id: 'grammar',
          title: 'Grammar',
          icon: '✍',
          badge: rows.grammar.verbs.length,
          content: <GrammarPanel grammar={rows.grammar} views={desk.state.views} encodings={desk.state.encodings} columns={desk.columns} links={desk.state.links} rules={desk.state.rules} policy={desk.state.encodingPolicy} labels={Object.fromEntries(desk.state.views.map((v) => [v.viewId, desk.label(v.viewId)]))} readOnly={desk.readOnly} onLink={(edge) => void desk.view.link(edge, `${desk.label(edge.source)} ${edge.kind} → ${desk.label(edge.target)}: ${edge.response ?? 'back to the rule'}`)} />,
        },
        ...own,
      ]}
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

  if (state.status === 'reading') return <Reading what="the CDC snapshot (8.4 MB) and the state outlines" />;
  if (state.status === 'broken') return <Broken sentence={state.sentence} />;
  return (
    <>
      <WhatIsMissing
        extra={
          <>
            {' '}
            The <b>analyst is here</b>, and it is the one part that needed a key rather than a process: open the <b>Analyst</b> panel and paste an Anthropic key of your own — it
            stays in this browser and goes nowhere but Anthropic — or leave it empty and watch the scripted turn drive the same tools.
          </>
        }
      />
      <StaticNndssDesk booted={state.booted} />
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
