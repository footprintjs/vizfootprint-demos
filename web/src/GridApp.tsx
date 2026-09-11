/**
 * THE GRID COCKPIT — vizfootprint over EIA's hourly electric grid.
 *
 * The same shape `App.tsx` has, and for the same reason: everything a dashboard
 * IS when everything on it is recorded — the time strip, the ✎ and the ✕ on
 * every cell, the editor drawer, notes, saved pictures, named paths, present
 * mode, the commit log, the branch map — lives in `vizfootprint-studio/desk`,
 * and what is left here is the four things that really are the grid's own:
 *
 *   1. **its rows** — two endpoints the desk knows nothing about
 *      (`/api/grid/rows`, which ships all four tables, and `/api/grid/lint`),
 *      and the derivation over them, which lives in `./gridCells.tsx` beside
 *      the cells it feeds;
 *   2. **its parameters** — the absence vocabulary's colours and the region
 *      palette (also `./gridCells.tsx`);
 *   3. **its doors** — the desk's session speaks to `/api/grid/*` rather than
 *      `/api/*`, which is one `endpoints` record and nothing else;
 *   4. **its words** — the sentences that explain EIA's silences, which no
 *      shell could write.
 *
 * The desk projects; the host derives. See `vizfootprint-studio/README.md`.
 */
import { useEffect, useMemo, useState } from 'react';
import { httpSheetData } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import { Desk } from 'vizfootprint-studio/desk';
import { createSessionView, pollingSource } from 'vizfootprint-ui';
import 'storydeck/storydeck.css';
import { GRID_STORY_FIGURE, colorOfState, useGridCells, useGridSilences, type ContrastGraph, type GridAuthorityRow, type GridDeskData, type GridHourlyRow, type GridLinkRow } from './gridCells.js';

/** The grid's doors: the same contract the CDC demo answers, under a prefix of its own. */
const GRID_ENDPOINTS = {
  state: '/api/grid/state',
  dispatch: '/api/grid/dispatch',
  seek: '/api/grid/seek',
  bookmark: '/api/grid/bookmark',
  paths: '/api/grid/paths',
  compare: '/api/grid/compare',
  bringOver: '/api/grid/bring-over',
  undo: '/api/grid/undo',
  saved: '/api/grid/saved',
} as const;

export interface GridRowsPayload {
  readonly authorities: readonly GridAuthorityRow[];
  readonly links: readonly GridLinkRow[];
  readonly hourly: readonly GridHourlyRow[];
  readonly interchange: readonly GridHourlyRow[];
  readonly netRefused: string | null;
  readonly hours: readonly string[];
  readonly counts: Record<string, unknown>;
  readonly absence: { readonly field: string; readonly states: readonly string[] };
  readonly declared?: { readonly dashboard?: { readonly title?: string; readonly caption?: string } };
  readonly contrast?: ContrastGraph;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} answered ${String(res.status)}`);
  return (await res.json()) as T;
}

/** The empty desk, before `/api/grid/rows` answers — the cells run over it unchanged, and draw nothing. */
const NO_ROWS: GridDeskData = { authorities: [], links: [], hourly: [], hours: [], absence: { field: 'demand_state', states: [] } };

export function GridApp(): JSX.Element {
  const [rows, setRows] = useState<GridRowsPayload | null>(null);
  const [checks, setChecks] = useState<readonly string[] | undefined>(undefined);
  const [checksError, setChecksError] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchJson<GridRowsPayload>('/api/grid/rows')
      .then((p) => live && setRows(p))
      .catch((e: unknown) => live && setProblem(`the rows did not arrive: ${e instanceof Error ? e.message : String(e)}`));
    // a refused checks door is said in words, never shown as "not asked yet"
    void fetchJson<{ checks?: string[] }>('/api/grid/lint')
      .then((r) => {
        if (!live) return;
        setChecks(r.checks ?? []);
        setChecksError(undefined);
      })
      .catch((e: unknown) => live && setChecksError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, []);

  const data = useMemo<GridDeskData>(
    () =>
      rows === null
        ? NO_ROWS
        : {
            authorities: rows.authorities,
            links: rows.links,
            hourly: rows.hourly,
            hours: rows.hours,
            absence: rows.absence,
            netRefused: rows.netRefused,
            ...(rows.contrast === undefined ? {} : { contrast: rows.contrast }),
          },
    [rows],
  );
  const silences = useGridSilences(data);
  const declaredWords = rows?.declared?.dashboard;

  const reset = async (): Promise<void> => {
    await fetchJson('/api/grid/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  };

  return (
    <Desk
      view={() => createSessionView(pollingSource({ intervalMs: 1000, endpoints: GRID_ENDPOINTS }), { as: 'user', defaultLayout: 'grid' })}
      charts={(desk) => useGridCells(desk, data)}
      notice={problem}
      onReset={reset}
      silences={{
        groups: silences,
        colorOf: colorOfState,
        heading: (
          <>
            Every hour of the window, regardless of the selection. EIA has no flag characters — it says these things with COLUMNS, and these are our words for them:{' '}
            <b>estimated</b> — the authority filed nothing and EIA supplied the number; <b>replaced</b> — the authority filed a number, EIA judged it wrong and published its own (both are kept);{' '}
            <b>not-configured</b> — this authority has no such figure to file at all (nine are generation-only); <b>unavailable</b> — it normally files this and this hour is missing;{' '}
            <b>unknown</b> — never invented, the word that refuses to guess. A measured <b>0</b> is not any of these: 5,971 flow cells carry one.
          </>
        ),
      }}
      data={{
        table: 'hourly',
        sheet: (columns) => httpSheetData({ endpoint: '/api/grid/window', findEndpoint: '/api/grid/find', table: 'hourly', columns }),
        checks,
        checksError,
      }}
      story={{
        ...(declaredWords !== undefined ? { declared: declaredWords } : {}),
        author: 'the desk',
        // the cell ids, from the file that owns them — a second copy here is a figure
        // that quietly stops matching the band the day a cell is renamed
        figure: GRID_STORY_FIGURE,
        emptyNote: 'No bookmarks named on this lineage yet — name a bookmark in the time strip and it becomes a section here.',
      }}
    />
  );
}
