/**
 * THE NNDSS COCKPIT — vizfootprint over CDC's weekly table.
 *
 * This file used to be eleven hundred lines, and most of them were not about
 * CDC. They were about what a dashboard IS when everything on it is recorded: a
 * time strip, a chart band with a ✎ and a ✕ on every cell, an editor drawer,
 * notes, saved pictures, named paths, a fork toast, present mode, a commit log,
 * a branch map, a story stage. None of that is this demo's; all of it now lives
 * in `vizfootprint-studio/desk`, and what is left here is the four things that
 * really are NNDSS's own:
 *
 *   1. **its rows** — six endpoints the desk knows nothing about (`/api/rows`,
 *      which ships the whole table, `/api/geo`, `/api/proposals`, `/api/lint`,
 *      `/api/refresh`, `/api/summary`), and the derivation over them, which
 *      lives in `./cells.tsx` beside the cells it feeds;
 *   2. **its parameters** — the disease and kind defaults, the absence
 *      vocabulary's colours, the area palette, the table's columns, the story
 *      figure's cell ids (all in `./cells.tsx`);
 *   3. **its extensions** — the Grammar panel, the analyst, the front door;
 *   4. **its words** — the sentences that explain CDC's silences and CDC's
 *      proposals, which no shell could write.
 *
 * The desk projects; the host derives. See `vizfootprint-studio/README.md`.
 */
import { useEffect, useMemo, useState } from 'react';
import { chipWords, httpSheetData, type GeoFeatureCollection } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
// the sixth layer's renderer: storydeck's scroll lens, over this desk's live session
import 'storydeck/storydeck.css';
import { Desk, type DeskProjection, type DeskProposal } from 'vizfootprint-studio/desk';
import { createSessionView, pollingSource } from 'vizfootprint-ui';
import { STORY_FIGURE, colorOfState, useNndssCells, useSilences, type NndssCellRow, type NndssDeskData, type NndssEdgeRow, type NndssNodeRow, type NndssPopulationRow, type NndssSeriesRow } from './cells.js';
import { noteRefs, type ReplyRef } from './derive.js';
import { AnalystPanel } from './AnalystPanel.js';
import { GrammarPanel, type GrammarWire } from './GrammarPanel.js';
import { Home } from './Home.js';

export interface RowsPayload {
  readonly cells: readonly NndssCellRow[];
  readonly series: readonly NndssSeriesRow[];
  /** The graph's two tables AT THE CURSOR — the committed rows plus the columns the layout and bring-over acts wrote. */
  readonly nodes: readonly NndssNodeRow[];
  readonly edges: readonly NndssEdgeRow[];
  /** The sentence the session refused those windows with, when it did. */
  readonly netRefused: string | null;
  /** The denominator, one row per place, when the surface declares it — the rate itself rides on `cells`, landed by two acts. */
  readonly population?: readonly NndssPopulationRow[];
  /** The sentence the rate acts were refused with, or their window was, when they were. */
  readonly rateRefused: string | null;
  readonly grain: { readonly bucket?: string; readonly reducer?: string; readonly note?: string };
  readonly diseases: readonly string[];
  readonly weeks: readonly string[];
  readonly counts: Readonly<Record<string, number>>;
  readonly absence: { readonly field: string; readonly states: readonly string[] };
  readonly grammar: GrammarWire;
  /** The def's declared dashboard words — the story's fallback for bookmarks no describe reached. */
  readonly declared?: { readonly dashboard?: { readonly title?: string; readonly caption?: string } };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} answered ${String(res.status)}`);
  return (await res.json()) as T;
}

/** The empty desk, before `/api/rows` answers — the cells run over it unchanged, and draw nothing. */
const NO_ROWS: NndssDeskData = { cells: [], series: [], diseases: [], weeks: [], absence: { field: 'report_state', states: [] }, grain: {}, geo: null };

export function App(): JSX.Element {
  // The front door is the desk's `front` slot, and this boolean is what keeps
  // its one law: the dashboard's own reads must not run behind a landing page.
  // The desk mounts nothing of itself until the reader goes in; this stops the
  // HOST's six endpoints from being asked either.
  const [entered, setEntered] = useState(false);
  const [rows, setRows] = useState<RowsPayload | null>(null);
  const [geo, setGeo] = useState<GeoFeatureCollection | null>(null);
  const [proposals, setProposals] = useState<readonly DeskProposal[]>([]);
  // the Sources tab's doors: the data checks (lintData sentences) and a refresh in flight
  const [checks, setChecks] = useState<readonly string[] | undefined>(undefined);
  const [checksError, setChecksError] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [analystTurns, setAnalystTurns] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  // a refused checks door is said in words, never shown as "not asked yet"
  const fetchChecks = (): Promise<void> =>
    fetchJson<{ checks?: string[] }>('/api/lint')
      .then((r) => {
        setChecks(r.checks ?? []);
        setChecksError(undefined);
      })
      .catch((e: unknown) => setChecksError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    if (!entered) return;
    let live = true;
    void fetchJson<RowsPayload>('/api/rows')
      .then((p) => live && setRows(p))
      .catch((e: unknown) => live && setProblem(`the rows did not arrive: ${e instanceof Error ? e.message : String(e)}`));
    void fetchJson<GeoFeatureCollection>('/api/geo')
      .then((g) => live && setGeo(g))
      .catch((e: unknown) => live && setProblem(`the map shapes did not arrive: ${e instanceof Error ? e.message : String(e)}`));
    void fetchChecks();
    void fetchJson<{ proposals?: DeskProposal[] }>('/api/proposals')
      .then((p) => live && setProposals(p.proposals ?? []))
      .catch((e: unknown) => live && setProblem(`the proposals did not arrive: ${e instanceof Error ? e.message : String(e)}`));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one read per entry
  }, [entered]);

  const data = useMemo<NndssDeskData>(() => (rows === null ? { ...NO_ROWS, geo } : { cells: rows.cells, series: rows.series, nodes: rows.nodes, edges: rows.edges, netRefused: rows.netRefused, population: rows.population, rateRefused: rows.rateRefused, diseases: rows.diseases, weeks: rows.weeks, absence: rows.absence, grain: rows.grain, geo }), [rows, geo]);
  const silences = useSilences(data);
  const declaredWords = rows?.declared?.dashboard;

  const refreshSources = (tables?: readonly string[]): void => {
    setRefreshing(true);
    void fetchJson('/api/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(tables !== undefined ? { tables } : {}) })
      .catch((e: unknown) => setProblem(`the refresh did not run: ${e instanceof Error ? e.message : String(e)}`))
      .then(() => fetchChecks())
      .finally(() => setRefreshing(false));
  };

  // the desk refreshes the session for us once this settles — proposing lands commits
  const propose = (): Promise<void> =>
    fetchJson<{ proposals?: DeskProposal[] }>('/api/proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then((body) => setProposals(body.proposals ?? []))
      .catch((e: unknown) => setProblem(`the proposals did not run: ${e instanceof Error ? e.message : String(e)}`));

  /**
   * START FRESH, the host's half: the reset door builds a new desk over the SAME
   * tables — the data stays exactly where it was, the commit log is emptied. The
   * desk asks first and clears what the desk owns; this clears what the SERVER
   * and this file own.
   */
  const reset = async (): Promise<void> => {
    await fetchJson('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    setProposals([]); // the server threw its own away with the desk
    setAnalystTurns(0); // a fresh analyst has said nothing yet
  };

  /**
   * An analyst reply becomes a NOTE: its words and its refs, the analyst (and
   * its model) as author, the cursor and the live selections as its basis — so it
   * goes stale honestly; no claim level is invented for it.
   */
  const addReply = (desk: DeskProjection) => (line: { readonly text: string; readonly refs?: readonly ReplyRef[] }, model?: string): void => {
    // a ref names EITHER a commit or a BEAT (a bookmark lands no commit of its
    // own, so it is cited by its tag) — see `noteRefs`
    const refs = noteRefs(line.refs);
    const s = desk.state;
    const basis = { ...(typeof s.cursor === 'string' ? { atCommit: s.cursor } : {}), ...(s.filters !== undefined ? { filters: s.filters } : {}) };
    void desk.view
      .describe(`note:${Math.random().toString(36).slice(2, 10)}`, 'caption', { text: line.text, author: { kind: 'agent', ...(model !== undefined ? { model } : {}) }, ...(Object.keys(basis).length > 0 ? { basis } : {}), ...(refs.length > 0 ? { refs } : {}) }, 'add the analyst reply to the dashboard')
      .then((r) => {
        if (!r.ok) setProblem(r.sentence);
      }) // a refused note (a ref to a commit off this path, say) is said out loud, never dropped
      .catch((e: unknown) => setProblem(`the note did not land: ${e instanceof Error ? e.message : String(e)}`));
  };

  return (
    <Desk
      view={() => createSessionView(pollingSource({ intervalMs: 1000 }), { as: 'user', defaultLayout: 'grid' })}
      front={(enter) => (
        <Home
          onEnter={() => {
            setEntered(true);
            enter();
          }}
        />
      )}
      charts={(desk) => useNndssCells(desk, data)}
      notice={problem}
      onReset={reset}
      silences={{
        groups: silences,
        colorOf: colorOfState,
        heading: (
          <>
            Week ending {data.weeks[data.weeks.length - 1] ?? ''}, every area regardless of the selection. CDC's flags, in our words: <b>not-configured</b> — not reportable there (stop looking); <b>unavailable</b> — the jurisdiction could not send it (go ask); <b>withheld</b> — CDC has it and did not print it; <b>unknown</b> — nothing said.
          </>
        ),
      }}
      proposals={{
        rows: proposals,
        proposeLabel: 'Propose six charts',
        heading: <>Six charts an agent might propose over CDC's table. The session admits the ones that make a claim over real columns and files a typed refusal for the rest — with the reason.</>,
        onPropose: propose,
      }}
      data={{
        table: 'cells',
        // the TABLE is the desk's second argument, never a name written here: it
        // asks for `cells` and for every table an act CUT, and a port pinned to
        // one name would answer the wrong rows under the right tab
        sheet: (columns, table) => httpSheetData({ endpoint: '/api/window', table, columns }),
        checks,
        checksError,
        onRefresh: refreshSources,
        refreshing,
      }}
      story={{
        ...(declaredWords !== undefined ? { declared: declaredWords } : {}),
        author: 'the desk',
        figure: STORY_FIGURE,
        emptyNote: 'No bookmarks named on this lineage yet — name a bookmark in the time strip and it becomes a section here.',
      }}
      aside={[
        {
          id: 'analyst',
          label: '🧭 Analyst',
          title: 'Analyst',
          render: (desk) => (
            <AnalystPanel
              readOnly={desk.readOnly}
              onTurn={(turns) => {
                setAnalystTurns(turns);
                void desk.view.refresh();
              }}
              onScreen={{ selections: desk.state.selections.map((sel) => `${desk.label(sel.viewId)}: ${chipWords(sel)}`), cursor: desk.state.cursor }}
              describeCommit={desk.describeCommit}
              onSeek={(id) => void desk.view.seek(id)}
              onBookmark={desk.seekBookmark}
              onAddToDashboard={desk.readOnly ? undefined : addReply(desk)}
            />
          ),
        },
      ]}
      menu={(desk, own) => {
        const analyst = { id: 'analyst', label: `Analyst${analystTurns > 0 ? ` (${String(analystTurns)})` : ''}`, icon: '🧭', onSelect: () => desk.openAside('analyst') };
        const addChart = { id: 'add-chart', label: 'Add a chart', icon: '＋', disabled: true, hint: 'next packet: an accepted proposal joins the cockpit', onSelect: () => undefined };
        // the placeholder sits where it will sit when it works — after Present, before the Text tool
        const at = own.findIndex((o) => o.id === 'present');
        return [analyst, ...own.slice(0, at + 1), addChart, ...own.slice(at + 1)];
      }}
      reports={(desk, own) => [
        {
          id: 'grammar',
          title: 'Grammar',
          icon: '✍',
          badge: rows?.grammar.verbs.length ?? 0,
          content: (
            <GrammarPanel
              grammar={rows?.grammar ?? null}
              views={desk.state.views}
              encodings={desk.state.encodings}
              columns={desk.columns}
              links={desk.state.links}
              rules={desk.state.rules}
              policy={desk.state.encodingPolicy}
              labels={Object.fromEntries(desk.state.views.map((v) => [v.viewId, desk.label(v.viewId)]))}
              readOnly={desk.readOnly}
              onLink={(edge) => void desk.view.link(edge, `${desk.label(edge.source)} ${edge.kind} → ${desk.label(edge.target)}: ${edge.response ?? 'back to the rule'}`)}
            />
          ),
        },
        ...own,
      ]}
    />
  );
}
