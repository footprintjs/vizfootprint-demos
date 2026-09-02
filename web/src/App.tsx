/**
 * THE COCKPIT — vizfootprint over CDC's weekly table. Layers 3–6 as a person
 * sees them: charts fed HOST-side under the session's clauses (the host
 * aggregates, the chart never does), the time-travel bar with a jump box,
 * and four report panels: the Grammar, the Silences, the Proposals, the
 * Commit log.
 *
 * The rows come once from `/api/rows`; the session state is polled from
 * `/api/state`. The disease bar DRIVES the trend and the week line: pick a
 * disease and both narrow to it — today through the library's implicit
 * crossfilter, named as such in the Grammar panel.
 */
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  chipWords,
  ProseText,
  CommitLog,
  SelectionChips,
  SavedSelections,
  TimeTravelBar,
  VizBar,
  VizCockpit,
  VizLine,
  VizMap,
  VizTable,
  createSessionView,
  type GeoFeatureCollection,
  keepPredicate,
  brightPredicate,
  navigateDomain,
  pollingSource,
  selectionForView,
  useSessionView,
  Sources,
  orderedCheckpoints, currentBeatIndex, beatTarget,
  NoteCell, linkablesOf, mentionWorldOf,
} from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import { AnalystPanel } from './AnalystPanel.js';
import { GrammarPanel, type GrammarWire } from './GrammarPanel.js';
import { JumpBox } from './JumpBox.js';
import { ChartEditor } from 'vizfootprint-ui/editor';
import { toStory } from 'vizfootprint-ui/story';
import type { StoryPost } from 'vizfootprint-ui/story';

interface CellRow {
  readonly jurisdiction: string;
  readonly kind: string;
  readonly disease: string;
  readonly year: number;
  readonly week: number;
  readonly t: string;
  readonly cases: number | null;
  readonly report_state: string;
  readonly flag: string | null;
  readonly ytd: number | null;
  readonly prev52_max: number | null;
  readonly [k: string]: string | number | null;
}
interface SeriesRow {
  readonly t: string;
  readonly entity: string;
  readonly entity_kind: string;
  readonly metric: string;
  readonly value: number;
}
interface RowsPayload {
  readonly cells: readonly CellRow[];
  readonly series: readonly SeriesRow[];
  readonly grain: { readonly bucket?: string; readonly reducer?: string; readonly note?: string };
  readonly diseases: readonly string[];
  readonly weeks: readonly string[];
  readonly counts: Readonly<Record<string, number>>;
  readonly absence: { readonly field: string; readonly states: readonly string[] };
  readonly grammar: GrammarWire;
  /** The def's declared dashboard words — the story's fallback for beats no describe reached. */
  readonly declared?: { readonly dashboard?: { readonly title?: string; readonly caption?: string } };
}
interface Proposal {
  readonly id: string;
  readonly claim: string;
  readonly admitted: boolean;
  readonly code?: string;
  readonly detail?: string;
}

const STATE_COLOR: Record<string, string> = { present: '#2f7d5b', 'not-configured': '#5f6f83', unavailable: '#b8681a', withheld: '#7b5ea7', unknown: '#a83a3a' };
const colorOfState = (s: string): string => STATE_COLOR[s] ?? '#888';
/** One steady colour per area name, so a line keeps its colour as the set of lines changes. */
const AREA_PALETTE = ['#4c6ef5', '#e8590c', '#2b8a3e', '#862e9c', '#c92a2a', '#0b7285', '#e67700', '#5f3dc4', '#087f5b', '#a61e4d', '#364fc7', '#d9480f'];
const colorOfArea = (name: string | undefined): string => {
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AREA_PALETTE[h % AREA_PALETTE.length] ?? '#888';
};
const DEFAULT_DISEASE = 'Pertussis';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} answered ${String(res.status)}`);
  return (await res.json()) as T;
}

function useView() {
  const view = useMemo(() => createSessionView(pollingSource({ intervalMs: 1000 }), { as: 'user', defaultLayout: 'grid' }), []);
  useEffect(() => () => view.dispose(), [view]);
  return view;
}

export function App(): JSX.Element {
  const view = useView();
  const state = useSessionView(view);
  const [rows, setRows] = useState<RowsPayload | null>(null);
  const [proposals, setProposals] = useState<readonly Proposal[]>([]);
  // the Sources tab's doors: the data checks (lintData sentences) and a refresh in flight
  const [checks, setChecks] = useState<readonly string[] | undefined>(undefined);
  const [checksError, setChecksError] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  // a refused checks door is said in words, never shown as "not asked yet"
  const fetchChecks = () =>
    fetchJson<{ checks?: string[] }>('/api/lint')
      .then((r) => {
        setChecks(r.checks ?? []);
        setChecksError(undefined);
      })
      .catch((e: unknown) => setChecksError(e instanceof Error ? e.message : String(e)));
  const refreshSources = (tables?: readonly string[]) => {
    setRefreshing(true);
    fetchJson('/api/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(tables !== undefined ? { tables } : {}) })
      .catch((e: unknown) => setProblem(`the refresh did not run: ${e instanceof Error ? e.message : String(e)}`))
      .then(() => fetchChecks())
      .finally(() => setRefreshing(false));
  };
  const [geo, setGeo] = useState<GeoFeatureCollection | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [mode, setMode] = useState<'explore' | 'present'>('explore');
  // Present mode as a slideshow: the dashboard is the slide, prev/next seek the named checkpoints, interactions stay off
  const [showing, setShowing] = useState(false);
  const [analystTurns, setAnalystTurns] = useState(0);
  // the in-place editor: a side drawer (never a modal) so a change is seen happening on the charts
  const [editing, setEditing] = useState<string | null>(null);
  const [asideTab, setAsideTab] = useState<'analyst' | 'edit'>('edit');
  const [asideOpen, setAsideOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchJson<RowsPayload>('/api/rows')
      .then((p) => live && setRows(p))
      .catch((e: unknown) => live && setProblem(`the rows did not arrive: ${e instanceof Error ? e.message : String(e)}`));
    void fetchJson<GeoFeatureCollection>('/api/geo')
      .then((g) => live && setGeo(g))
      .catch((e: unknown) => live && setProblem(`the map shapes did not arrive: ${e instanceof Error ? e.message : String(e)}`));
    void fetchChecks();
    void fetchJson<{ proposals?: Proposal[] }>('/api/proposals')
      .then((p) => live && setProposals(p.proposals ?? []))
      .catch((e: unknown) => live && setProblem(`the proposals did not arrive: ${e instanceof Error ? e.message : String(e)}`));
    return () => {
      live = false;
    };
  }, []);

  const cells = rows?.cells ?? [];
  const series = rows?.series ?? [];
  const absenceField = rows?.absence.field ?? 'report_state';
  const absenceStates = rows?.absence.states ?? [];
  const columns = state.columns[state.defaultTable] ?? [];
  // the encoding plane's verdicts per view — the picker greys with the session's own sentences
  const fitsOf = (viewId: string) => state.views.find((v) => v.viewId === viewId)?.fits;
  // encoding links: render what each view SHOWS (followed channels laid over its own); edits still go to `encodings`
  const shown = state.effectiveEncodings ?? state.encodings;
  // the prose plane: a view's words at the cursor, each with its author and whether it went stale — shown, never hidden
  const proseOf = (viewId: string) => state.views.find((v) => v.viewId === viewId)?.prose ?? [];
  const words = (viewId: string): ReactNode => {
    // alt text is the chart's accessible name (ariaLabel) — shown once, to assistive tech; the visible words are the rest
    const lines = proseOf(viewId).filter((p) => p.slot !== 'altShort' && p.slot !== 'altLong');
    if (lines.length === 0) return null;
    return (
      <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.45, whiteSpace: 'normal' }}>
        {lines.map((p) => (
          <div
            key={p.slot}
            style={{ color: p.status === 'stale' ? '#a8661a' : undefined, opacity: p.status === 'derived' ? 0.7 : 0.9 }}
            title={p.status === 'stale' ? `stale — moved: ${p.changed.join(', ')}` : `${p.author.kind}${p.author.by ? ' · ' + p.author.by : ''}${p.author.model ? ' · ' + p.author.model : ''}`}
          >
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, opacity: 0.6, marginRight: 4 }}>{p.slot}</span>{' '}
            <ProseText text={p.text} refs={p.refs} describeCommit={(id) => { const c = state.commits.find((x) => x.id === id); return c ? `${c.label}${c.intent ? ' — ' + c.intent : ''}` : undefined; }} onSeek={(id) => void view.seek(id)} onBeat={(label) => { const b = state.checkpoints.find((x) => x.label === label); if (b?.commitId) void view.seek(b.commitId); }} />
            {p.status === 'stale' ? <span style={{ fontSize: 11, opacity: 0.8 }}> stale · {p.changed.join(', ')} moved</span> : null}
            {p.status === 'derived' ? <span style={{ fontSize: 11, opacity: 0.7 }}> derived</span> : null}
            {p.author.kind === 'agent' ? <span style={{ fontSize: 11, opacity: 0.7 }}> by the analyst</span> : null}
          </div>
        ))}
      </div>
    );
  };
  // Layer 4: the link graph decides what each clause does at each view — filter, highlight, navigate, mirror, or nothing
  const selFor = (self: string | null) => selectionForView(state.selections, self, 'intersect', state.links, state.cleared);
  // the prose plane's altShort is the chart's accessible name; absent = the chart names itself
  // an empty altShort is a choice (a decorative chart) and stays empty; no slot at all = the chart names itself
  const altShortOf = (viewId: string): string | undefined => proseOf(viewId).find((p) => p.slot === 'altShort')?.text;
  // SET-1: which views hold a LIVE clause (the ✕ pill on the chart), and the def's labels for the chips
  const liveViews = useMemo(() => new Set(state.selections.filter((s) => s.value !== undefined).map((s) => s.viewId)), [state.selections]); // null is a live IS-NULL point
  const viewLabels = useMemo(() => Object.fromEntries(state.views.map((v) => [v.viewId, v.label ?? v.viewId])), [state.views]);
  const clearable = (id: string) => ({ active: liveViews.has(id), onClear: () => void view.clear(id, `clear ${viewLabels[id] ?? id}`) });

  // the disease the person picked (the diseases view's point clause), else the default
  const pickedDisease = useMemo(() => {
    const clause = state.selections.find((s) => s.viewId === 'diseases');
    return typeof clause?.value === 'string' ? clause.value : DEFAULT_DISEASE;
  }, [state.selections]);

  // the kind the host SUMS over — the kinds view's point clause, else states
  // (summing states + regions + roll-ups would count every case three times)
  const sumKind = useMemo(() => {
    const clause = state.selections.find((s) => s.viewId === 'kinds');
    return typeof clause?.value === 'string' ? clause.value : 'state';
  }, [state.selections]);

  const coverageData = useMemo(() => {
    const keep = keepPredicate(selFor('coverage'));
    return absenceStates.map((category) => ({ category, count: cells.filter((r) => r[absenceField] === category && keep(r)).length }));
  }, [cells, absenceStates, absenceField, state.selections]);

  // reported cases per disease over the kept cells of ONE kind — the host sums, the chart draws
  const diseaseData = useMemo(() => {
    const keep = keepPredicate(selFor('diseases'));
    const sums = new Map<string, number>();
    for (const c of cells) {
      if (c.kind !== sumKind || c.cases === null || !keep(c)) continue;
      sums.set(c.disease, (sums.get(c.disease) ?? 0) + c.cases);
    }
    // a disease with no present cell in view gets NO bar — a missing bar is a silence, a zero would be a lie
    return (rows?.diseases ?? []).flatMap((category) => (sums.has(category) ? [{ category, count: sums.get(category)! }] : []));
  }, [cells, rows?.diseases, sumKind, state.selections, state.links]);

  // the HIGHLIGHT share of each disease bar: the same sums over the rows a highlight edge keeps bright
  // (the map lighting the bar) — only when such an edge is live, so the overlay never repeats the base
  const diseaseHighlight = useMemo(() => {
    const sel = selFor('diseases');
    if (![...sel.clauses.values()].some((c) => c.response === 'highlight')) return undefined;
    const bright = brightPredicate(sel);
    const sums = new Map<string, number>();
    for (const c of cells) {
      if (c.kind !== sumKind || c.cases === null || !bright(c)) continue;
      sums.set(c.disease, (sums.get(c.disease) ?? 0) + c.cases);
    }
    return [...sums.entries()].map(([category, count]) => ({ category, count }));
  }, [cells, sumKind, state.selections, state.links]);

  const kindData = useMemo(() => {
    const keep = keepPredicate(selFor('kinds'));
    return ['state', 'region', 'total'].map((category) => ({ category, count: cells.filter((r) => r.kind === category && keep(r)).length }));
  }, [cells, state.selections]);

  // reported cases per week over the kept cells of the same ONE kind
  const weekData = useMemo(() => {
    const keep = keepPredicate(selFor('weeks'));
    const byWeek = new Map<string, number>();
    for (const c of cells) {
      if (c.kind !== sumKind || c.cases === null || !keep(c)) continue;
      byWeek.set(c.t, (byWeek.get(c.t) ?? 0) + c.cases);
    }
    return [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, value]) => ({ date, value, series: `kept ${sumKind}s` }));
  }, [cells, sumKind, state.selections]);

  // the trend for the picked disease — present cells only (a silence is a missing point).
  // Fifty-eight state lines are spaghetti, so until a kind or an area is chosen the
  // line shows the regions; the other views' clauses narrow it like any other view.
  const areaChosen = state.selections.some((s) => (s.viewId === 'kinds' || s.viewId === 'table' || s.viewId === 'map') && s.value != null); // a map pick is an area chosen too
  const trendData = useMemo(() => {
    const keep = keepPredicate(selFor('trend'));
    return series
      .filter((s) => s.metric === pickedDisease)
      .map((s) => ({ t: s.t, jurisdiction: s.entity, kind: s.entity_kind, disease: s.metric, [absenceField]: 'present', value: s.value }))
      .filter((r) => keep(r) && (areaChosen || r.kind === 'region'))
      .map((r) => ({ date: r.t, value: r.value, series: r.jurisdiction }));
  }, [series, pickedDisease, absenceField, areaChosen, state.selections]);

  // the picked disease per STATE, summed over the kept weeks — a state with no present cell gets no datum (the map hatches it)
  const mapData = useMemo(() => {
    const keep = keepPredicate(selFor('map'));
    const sums = new Map<string, number>();
    for (const c of cells) {
      if (c.kind !== 'state' || c.disease !== pickedDisease || c.cases === null || !keep(c)) continue;
      sums.set(c.jurisdiction, (sums.get(c.jurisdiction) ?? 0) + c.cases);
    }
    return [...sums.entries()].map(([region, value]) => ({ region, value }));
  }, [cells, pickedDisease, state.selections]);

  // places that report to NNDSS but have no shape on this map — read off the data, never hand-listed
  const noShape = useMemo(() => {
    if (geo === null) return [];
    const shapes = new Set(geo.features.map((f) => String(f.properties?.['name'] ?? '')));
    const places = new Set(cells.filter((c) => c.kind === 'state').map((c) => c.jurisdiction));
    return [...places].filter((p) => !shapes.has(p)).sort();
  }, [geo, cells]);

  const latestWeek = rows?.weeks[rows.weeks.length - 1] ?? '';
  const tableRows = useMemo(() => cells.filter((c) => c.disease === pickedDisease && c.t === latestWeek), [cells, pickedDisease, latestWeek]);

  const keepAll = keepPredicate(selFor(null));
  const keptCount = useMemo(() => cells.filter((r) => keepAll(r)).length, [cells, state.selections]);

  const silences = useMemo(
    () =>
      absenceStates
        .filter((s) => s !== 'present')
        .map((s) => {
          const inState = cells.filter((c) => c.report_state === s && c.t === latestWeek);
          const byArea = new Map<string, string[]>();
          for (const c of inState) byArea.set(c.jurisdiction, [...(byArea.get(c.jurisdiction) ?? []), c.disease]);
          return { state: s, total: inState.length, areas: [...byArea.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12) };
        }),
    [cells, absenceStates, latestWeek],
  );

  const propose = async (): Promise<void> => {
    try {
      const body = await fetchJson<{ proposals?: Proposal[] }>('/api/proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      setProposals(body.proposals ?? []);
      await view.refresh();
    } catch (e: unknown) {
      setProblem(`the proposals did not run: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const readOnly = mode === 'present';
  // The DASHBOARD's own words: its caption is the one-line summary of the whole desk, kept by the analyst (who proposes;
  // a person accepts). Shown under the time strip with its status; a stale summary says what moved.
  const dashCaption = state.dashboard?.prose.find((p) => p.slot === 'caption');
  const dashDrafts = (state.dashboard?.proposals ?? []).filter((p) => p.slot === 'caption' && p.status === 'open');
  const summary: ReactNode =
    dashCaption === undefined && dashDrafts.length === 0 ? null : (
      <div role="note" style={{ flexBasis: '100%', fontSize: 12.5, lineHeight: 1.45, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }} aria-label="dashboard summary">
        {dashCaption !== undefined ? (
          <span style={{ color: dashCaption.status === 'stale' ? '#a8661a' : undefined, opacity: 0.9 }} title={`${dashCaption.author.kind}${dashCaption.author.by ? ' · ' + dashCaption.author.by : ''}${dashCaption.author.model ? ' · ' + dashCaption.author.model : ''}`}>
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, opacity: 0.6, marginRight: 4 }}>summary</span>{' '}
            <ProseText text={dashCaption.text} refs={dashCaption.refs} describeCommit={(id) => { const c = state.commits.find((x) => x.id === id); return c ? `${c.label}${c.intent ? ' — ' + c.intent : ''}` : undefined; }} onSeek={(id) => void view.seek(id)} onBeat={(label) => { const b = state.checkpoints.find((x) => x.label === label); if (b?.commitId) void view.seek(b.commitId); }} />
            {dashCaption.status === 'stale' ? <span style={{ fontSize: 11, opacity: 0.8 }}> stale · {dashCaption.changed.join(', ')} moved</span> : null}
            {dashCaption.author.kind === 'agent' ? <span style={{ fontSize: 11, opacity: 0.7 }}> by the analyst</span> : null}
          </span>
        ) : null}
        {dashDrafts.map((p) => (
          <span key={p.proposal} style={{ fontSize: 12, background: '#fff7e6', border: '1px solid #f0d9a8', borderRadius: 6, padding: '2px 8px' }}>
            <span style={{ opacity: 0.7, marginRight: 4 }}>proposed:</span>
            {p.text}
            {!readOnly ? (
              <>
                {' '}
                <button type="button" onClick={() => void view.acceptProposal('dashboard', 'caption', p.proposal)} style={{ font: 'inherit', fontSize: 11.5, marginLeft: 6, cursor: 'pointer' }}>
                  accept
                </button>
                <button type="button" onClick={() => { const reason = window.prompt('Decline because…'); if (reason) void view.declineProposal('dashboard', 'caption', p.proposal, reason); }} style={{ font: 'inherit', fontSize: 11.5, marginLeft: 4, cursor: 'pointer' }}>
                  decline
                </button>
              </>
            ) : null}
          </span>
        ))}
      </div>
    );
  // The STORY layer: the named beats along the head's lineage as a storydeck post (figures are the host's — none here yet).
  // The fallback words are the def's DECLARED ones, never the live caption — the live words would misdate every earlier beat.
  const declaredWords = rows?.declared?.dashboard;
  const story = useMemo(() => toStory(state, { declared: declaredWords ?? {}, author: 'the desk', date: new Date().toISOString().slice(0, 10) }), [state, declaredWords]);
  const grain = rows?.grain;

  // open the editor for one chart (from its ✎ or the menu)
  const editChart = (viewId: string): void => {
    setEditing(viewId);
    setAsideTab('edit');
    setAsideOpen(true);
  };
  // the slideshow's beats: the named checkpoints along the head's lineage, the dashboard's caption as the slide's words
  const beats = orderedCheckpoints(state.checkpoints, state.commits, state.head);
  const rawBeatIndex = currentBeatIndex(state.checkpoints, state.commits, state.cursor, state.head); // -1 = the cursor is off the story
  const beatIndex = Math.max(0, rawBeatIndex);
  // a seek is asynchronous: two fast presses target from the beat already asked for, never the one still on screen
  const pendingBeat = useRef<number | null>(null);
  useEffect(() => {
    if (pendingBeat.current === rawBeatIndex) pendingBeat.current = null;
  }, [rawBeatIndex]);
  const goBeat = (i: number): Promise<void> => {
    const b = beats[i];
    if (b === undefined) return Promise.resolve();
    pendingBeat.current = i;
    // a seek that fails must not leave a target the presenter never reached
    return view.seek(beatTarget(b) as string).then(() => undefined, () => { pendingBeat.current = null; });
  };
  const stepBeat = (by: number): void => void goBeat((pendingBeat.current ?? beatIndex) + by);
  // entering the show from a cursor that reaches no beat begins at the first beat — never a slide the dashboard is not showing
  const startShow = (): void => {
    setMode('present');
    if (rawBeatIndex < 0) void goBeat(0).then(() => setShowing(true)); // the slide bar names a beat only once the charts show it
    else setShowing(true);
  };
  const slideshow = showing && mode === 'present' && beats.length > 0 ? {
    active: true,
    title: beats[beatIndex]?.label ?? '',
    ...(dashCaption !== undefined ? { words: dashCaption.text } : {}),
    index: beatIndex,
    count: beats.length,
    onPrev: () => stepBeat(-1),
    onNext: () => stepBeat(1),
    onExit: () => setShowing(false),
  } : undefined;
  // THE TEXT TOOL: notes are prose subjects (`note:<id>`); every save is a describe the session answers; links are mentions resolved against the session
  // (the world and the picker list are keyed on the slices they read, so an idle poll does not rebuild them)
  const noteWorld = useMemo(() => mentionWorldOf(state), [state.commits, state.checkpoints, state.saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const noteLinks = useMemo(() => linkablesOf(state), [state.commits, state.checkpoints, state.saved, state.selections]); // eslint-disable-line react-hooks/exhaustive-deps
  const describeNote = (id: string, slot: 'title' | 'caption', record: Readonly<Record<string, unknown>> | null) =>
    view.describe(`note:${id}`, slot, record, record === null ? `clear the ${slot} of note ${id}` : `write note ${id}`);
  // a new note is opened, not committed: nothing lands until its first Save, so the log never holds words nobody wrote
  const [freshNotes, setFreshNotes] = useState<readonly string[]>([]);
  // a note id only has to be unique on this desk; `crypto.randomUUID` is secure-context only, so a plain-http demo falls back
  const freshNoteId = (): string => `n${typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
  const newNote = (): void => setFreshNotes((f) => [...f, freshNoteId()]);
  // an analyst reply becomes a note: its words and its refs, the analyst (and its model) as author, the cursor and the live selections as its basis — so it goes stale honestly; no claim level is invented for it
  const addReplyToDashboard = (line: { readonly text: string; readonly refs?: readonly { readonly span: readonly [number, number]; readonly commit: string; readonly label?: string }[] }, model?: string): void => {
    const refs = (line.refs ?? []).map((r) => ({ span: r.span, commit: r.commit, ...(r.label !== undefined ? { label: r.label } : {}) }));
    const basis = { ...(typeof state.cursor === 'string' ? { atCommit: state.cursor } : {}), ...(state.filters !== undefined ? { filters: state.filters } : {}) };
    void view
      .describe(`note:${freshNoteId()}`, 'caption', { text: line.text, author: { kind: 'agent', ...(model !== undefined ? { model } : {}) }, ...(Object.keys(basis).length > 0 ? { basis } : {}), ...(refs.length > 0 ? { refs } : {}) }, 'add the analyst reply to the dashboard')
      .then((r) => { if (!r.ok) setProblem(r.sentence); }) // a refused note (a ref to a commit off this path, say) is said out loud, never dropped
      .catch((e: unknown) => setProblem(`the note did not land: ${e instanceof Error ? e.message : String(e)}`));
  };
  const noteProps = { world: noteWorld, linkables: noteLinks, by: 'you', readOnly, onDescribe: describeNote, onSeek: (id: string) => void view.seek(id), onBeat: (label: string) => { const b = state.checkpoints.find((x) => x.label === label); if (b?.commitId) void view.seek(b.commitId); }, describeCommit: (id: string) => { const c = state.commits.find((x) => x.id === id); return c ? `${c.label}${c.intent ? ' — ' + c.intent : ''}` : undefined; } };
  const savedNoteIds = new Set((state.notes ?? []).map((n) => n.id));
  const noteCells = [
    ...(state.notes ?? []).map((n) => ({ id: `note:${n.id}`, render: () => <NoteCell note={n} {...noteProps} /> })),
    ...freshNotes.filter((id) => !savedNoteIds.has(id)).map((id) => ({
      id: `note:${id}`,
      render: () => (
        <NoteCell
          note={{ id, prose: [], proposals: [] }}
          fresh
          onDiscard={() => setFreshNotes((f) => f.filter((x) => x !== id))}
          {...noteProps}
          // once it has been saved it is the SESSION's note, not a fresh id: dropping it here keeps a seek back
          // before its first commit from re-opening a blank editor beside the words that are simply not there yet
          onDescribe={async (noteId, slot, record) => {
            const r = await describeNote(noteId, slot, record);
            if (r.ok) setFreshNotes((f) => f.filter((x) => x !== id));
            return r;
          }}
        />
      ),
    })),
  ];
  // the cockpit menu: the host's acts, in the host's words — the two floating buttons that overlapped the report chips live here now
  // the selection to save: the one the cursor stands on, else the last live one (the wire promises no recency order)
  const liveSelection = state.selections.find((sel) => sel.commitId === state.cursor) ?? state.selections[state.selections.length - 1];
  // START FRESH: the reset door builds a new desk over the SAME tables — the
  // data stays exactly where it was, the commit log is emptied. Asked first,
  // because a cleared log cannot be walked back to.
  const startFresh = (): void => {
    if (!window.confirm('Clear every commit and start fresh? The data stays; the log is emptied.')) return;
    void fetchJson('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(() => {
        setProposals([]); // the server threw its own away with the desk
        setAnalystTurns(0); // a fresh analyst has said nothing yet
        setAsideOpen(false); // the drawer's transcript belonged to the session that just ended
        setFreshNotes([]); // the unsaved notes were opened against a log that no longer exists
        return view.refresh(); // show the empty log now, not at the next poll
      })
      .catch((e: unknown) => setProblem(`the reset did not run: ${e instanceof Error ? e.message : String(e)}`));
  };
  const menuItems = [
    { id: 'analyst', label: `Analyst${analystTurns > 0 ? ` (${analystTurns})` : ''}`, icon: '🧭', onSelect: () => { setAsideTab('analyst'); setAsideOpen(true); } },
    { id: 'edit', label: 'Edit a chart', icon: '✎', onSelect: () => editChart(editing ?? state.views.find((v) => v.viewId === 'weeks')?.viewId ?? state.views[0]?.viewId ?? 'weeks'), hint: 'or hover a chart and press its ✎' },
    { id: 'save', label: 'Save selection', icon: '💾', disabled: liveSelection?.commitId === undefined || readOnly, hint: liveSelection === undefined ? 'nothing is selected' : `keep the ${viewLabels[liveSelection.viewId] ?? liveSelection.viewId} selection by name`, onSelect: () => { const id = liveSelection?.commitId; if (liveSelection === undefined || id === undefined) return; const name = window.prompt(`Save the ${viewLabels[liveSelection.viewId] ?? liveSelection.viewId} selection as…`); if (name) void view.saveSelection(id, name); } },
    { id: 'present', label: mode === 'present' ? 'Back to Explore' : 'Present the beats', icon: '▶', disabled: mode !== 'present' && beats.length === 0, hint: mode !== 'present' && beats.length === 0 ? 'name a checkpoint first — the beats are the slides' : undefined, onSelect: () => { if (mode === 'present') { setShowing(false); setMode('explore'); } else startShow(); } },
    { id: 'add-chart', label: 'Add a chart', icon: '＋', disabled: true, hint: 'next packet: an accepted proposal joins the cockpit', onSelect: () => undefined },
    { id: 'text', label: 'Text tool', icon: '¶', disabled: readOnly, hint: 'a note on the dashboard — its words link to selections, checkpoints and commits', onSelect: newNote },
    { id: 'reset', label: 'Start fresh', icon: '↺', disabled: readOnly, hint: 'clear every commit and begin again — the data stays, the log is emptied', onSelect: startFresh },
  ];
  return (
    <>
    <VizCockpit
      readOnly={readOnly}
      status={<WindowReadout />}
      menu={menuItems}
      slideshow={slideshow}
      aside={{
        open: asideOpen,
        title: asideTab === 'analyst' ? 'Analyst' : `Edit ${editing !== null ? (viewLabels[editing] ?? editing) : ''}`,
        onClose: () => setAsideOpen(false),
        children: (
          <>
            <div role="tablist" aria-label="side panel" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['analyst', 'edit'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={asideTab === t} onClick={() => setAsideTab(t)} style={{ font: 'inherit', fontSize: 12.5, padding: '4px 10px', borderRadius: 6, border: '1px solid #d8dee4', background: asideTab === t ? '#dcefec' : '#fff', cursor: 'pointer' }}>
                  {t === 'analyst' ? '🧭 Analyst' : '✎ Edit'}
                </button>
              ))}
            </div>
            {asideTab === 'analyst' ? (
              <AnalystPanel
                readOnly={readOnly}
                onTurn={(turns) => {
                  setAnalystTurns(turns);
                  void view.refresh();
                }}
                onScreen={{ selections: state.selections.map((sel) => `${viewLabels[sel.viewId] ?? sel.viewId}: ${chipWords(sel)}`), cursor: state.cursor }}
                describeCommit={(id) => { const c = state.commits.find((x) => x.id === id); return c ? `${c.label}${c.intent ? ' — ' + c.intent : ''}` : undefined; }}
                onSeek={(id) => void view.seek(id)}
                onAddToDashboard={readOnly ? undefined : addReplyToDashboard}
              />
            ) : null}
            {asideTab === 'edit' ? (
              <>
      <label style={{ display: 'block', fontSize: 12.5, marginBottom: 10 }}>
        Chart{' '}
        <select value={editing ?? ''} onChange={(e) => setEditing(e.target.value)} style={{ font: 'inherit', fontSize: 13 }}>
          {state.views.filter((v) => v.viewId !== 'analyst').map((v) => (
            <option key={v.viewId} value={v.viewId}>
              {viewLabels[v.viewId] ?? v.viewId}
            </option>
          ))}
        </select>
      </label>
      {editing !== null && state.views.some((v) => v.viewId === editing) ? (
        <ChartEditor
          view={state.views.find((v) => v.viewId === editing)!}
          links={state.links}
          labels={viewLabels}
          by="you"
          readOnly={readOnly}
          onDescribe={(id, slot, record) => void view.describe(id, slot, record)}
          onReencode={(id, ch, field) => void view.reencode(id, ch, field)}
          onLink={(edge) => void view.link(edge, `${viewLabels[edge.source] ?? edge.source} ${edge.kind} → ${viewLabels[edge.target] ?? edge.target}: ${edge.response ?? 'back'}`)}
          onAccept={(id, slot, proposal) => void view.acceptProposal(id, slot, proposal)}
          onDecline={(id, slot, proposal, reason) => void view.declineProposal(id, slot, proposal, reason)}
        />
      ) : null}
              </>
            ) : null}
          </>
        ),
      }}
      layout={state.layout}
      onLayoutChange={(change) => void view.setLayout(change)}
      top={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <TimeTravelBar
            compact
            mode={mode}
            onModeChange={setMode}
            commits={state.commits}
            cursor={state.cursor}
            head={state.head}
            checkpoints={state.checkpoints}
            branches={state.branches}
            viewingPast={state.viewingPast}
            onSeek={(id) => void view.seek(id)}
            onStepBack={() => void view.stepBack()}
            onStepForward={() => void view.stepForward()}
            onCheckpoint={(label) => void view.checkpoint(label)}
            onPlay={startShow}
            onReturnToNow={() => void view.returnToNow()}
          />
          <JumpBox commitIds={state.commits.map((c) => c.id)} onSeek={(id) => void view.seek(id)} />
          {summary}
          <SelectionChips
            selections={state.selections}
            cleared={state.cleared}
            links={state.links}
            labels={viewLabels}
            readOnly={readOnly}
            onClear={(id) => void view.clear(id, `clear ${viewLabels[id] ?? id}`)}
            onClearAll={() => void view.clearAll()}
            onSetPolarity={(id, exclude) => void view.setPolarity(id, exclude, `${exclude ? 'exclude' : 'keep'} the ${viewLabels[id] ?? id} selection`)}
            onSave={(id) => {
              const name = window.prompt(`Save the ${viewLabels[id] ?? id} selection as…`);
              if (name && name.trim()) void view.saveSelection(id, name.trim());
            }}
          />
          <SavedSelections saved={state.saved ?? []} selections={state.selections} labels={viewLabels} readOnly={readOnly} onApply={(c) => void view.bringOver(c)} />
        </div>
      }
      toast={problem === null ? null : <div role="alert" style={{ padding: 10, fontSize: 13 }}>⚠ {problem}</div>}
      charts={[
        {
          id: 'coverage',
          onEdit: () => editChart('coverage'),
          weight: 2,
          ...clearable('coverage'),
          caption: `Coverage — ${String(keptCount)} of ${String(cells.length)} cells in view · which silence is which (click to select)`,
          render: ({ width, height }) => (
            <VizBar viewId="coverage" data={coverageData} field={absenceField} colorOf={colorOfState} selection={selFor('coverage')} columns={columns} fits={fitsOf('coverage')} encoding={shown['coverage'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('coverage', e, 'select report state')} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
          ),
        },
        {
          id: 'diseases',
          onEdit: () => editChart('diseases'),
          weight: 4,
          ...clearable('diseases'),
          caption: `Reported cases by disease, summed over kept ${sumKind}s (a disease with no present cell has no bar) — click one to drive the trend, the week line and the table (now: ${pickedDisease})`,
          render: ({ width, height }) => (
            <VizBar viewId="diseases" data={diseaseData} highlight={diseaseHighlight} field="disease" selection={selFor('diseases')} columns={columns} fits={fitsOf('diseases')} encoding={shown['diseases'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('diseases', e, 'pick disease')} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
          ),
        },
        {
          id: 'kinds',
          onEdit: () => editChart('kinds'),
          weight: 1.5,
          ...clearable('kinds'),
          caption: 'Cells by area kind — states, regions, roll-ups (click to select)',
          render: ({ width, height }) => (
            <VizBar viewId="kinds" data={kindData} field="kind" selection={selFor('kinds')} columns={columns} fits={fitsOf('kinds')} encoding={shown['kinds'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('kinds', e, 'select area kind')} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
          ),
        },
        {
          id: 'map',
          onEdit: () => editChart('map'),
          weight: 4,
          ...clearable('map'),
          caption: (
            <>
              {`${pickedDisease} — reported cases per state, summed over kept weeks · a hatched state has no present cell (a silence, never a zero)${noShape.length > 0 ? ` · no shape here, see the table: ${noShape.join(', ')}` : ''}`}
              {words('map')}
            </>
          ),
          render: ({ width, height }) =>
            geo === null ? (
              <div role="status" style={{ padding: 12, opacity: 0.7 }}>
                the map shapes have not arrived yet
              </div>
            ) : (
              <VizMap viewId="map" geo={geo} coordinates="planar" regionField="jurisdiction" data={mapData} valueLabel="cases" ariaLabel={altShortOf('map')} selection={selFor('map')} width={width} height={height} onEmit={(e) => void view.emit('map', e, 'select state on the map')} />
            ),
        },
        {
          id: 'weeks',
          onEdit: () => editChart('weeks'),
          weight: 3,
          ...clearable('weeks'),
          caption: (
            <>
              {`Reported cases per ${grain?.bucket ?? 'week'}, summed over kept ${sumKind}s · ${grain?.note ?? ''}`}
              {words('weeks')}
            </>
          ),
          render: ({ width, height }) => (
            <VizLine viewId="weeks" data={weekData} dateField="t" valueField="cases" ariaLabel={altShortOf('weeks')} columns={columns} fits={fitsOf('weeks')} encoding={shown['weeks'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('weeks', e, 'brush weeks')} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
          ),
        },
        {
          id: 'trend',
          onEdit: () => editChart('trend'),
          weight: 3,
          ...clearable('trend'),
          caption: `${pickedDisease} per ${areaChosen ? 'kept area' : 'region (the default until you pick a kind or an area)'}, ${grain?.bucket ?? 'week'} — a missing point is a silence, never a zero`,
          render: ({ width, height }) => (
            <VizLine
              viewId="trend"
              data={trendData}
              dateField="t"
              valueField="value"
              colorOf={colorOfArea}
              columns={columns}
              fits={fitsOf('trend')}
              encoding={shown['trend'] ?? {}}
              xDomain={navigateDomain(selFor('trend'))?.range as readonly [string | null, string | null] | undefined}
              width={width}
              height={height}
              onEmit={(e) => void view.emit('trend', e, 'brush the trend')}
              onReencode={(v, c, f) => void view.reencode(v, c, f)}
            />
          ),
        },
        {
          id: 'table',
          onEdit: () => editChart('table'),
          weight: 3,
          ...clearable('table'),
          caption: `${pickedDisease}, week ending ${latestWeek} — the cells as CDC printed them, with their flag (click a row to select)`,
          render: ({ width, height }) => (
            <VizTable viewId="table" data={tableRows} columns={['jurisdiction', 'kind', 'cases', absenceField, 'flag', 'ytd', 'prev52_max']} idField="jurisdiction" selection={selFor('table')} width={width} height={height} onEmit={(e) => void view.emit('table', e, 'select area')} />
          ),
        },
        // notes join after the charts — the same place a saved arrangement puts anything it has not seen (orderCharts puts unknown ids last), so a new note lands in one place either way
        ...noteCells,
      ]}
      reports={[
        {
          id: 'grammar',
          title: 'Grammar',
          icon: '✍',
          badge: rows?.grammar.verbs.length ?? 0,
          content: (
            <GrammarPanel
              grammar={rows?.grammar ?? null}
              views={state.views}
              encodings={state.encodings}
              columns={columns}
              links={state.links}
              rules={state.rules}
              policy={state.encodingPolicy}
              labels={viewLabels}
              readOnly={readOnly}
              onLink={(edge) => void view.link(edge, `${viewLabels[edge.source] ?? edge.source} ${edge.kind} → ${viewLabels[edge.target] ?? edge.target}: ${edge.response ?? 'back to the rule'}`)}
            />
          ),
        },
        {
          id: 'silences',
          title: 'The silences',
          icon: '🔇',
          badge: silences.reduce((n, s) => n + s.total, 0),
          content: (
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 8px' }}>
                Week ending {latestWeek}, every area regardless of the selection. CDC's flags, in our words: <b>not-configured</b> — not reportable there (stop looking); <b>unavailable</b> — the jurisdiction could not send it (go ask);{' '}
                <b>withheld</b> — CDC has it and did not print it; <b>unknown</b> — nothing said.
              </p>
              {silences.map((s) => (
                <div key={s.state} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, color: colorOfState(s.state), textTransform: 'uppercase', fontSize: 11, letterSpacing: '.06em' }}>
                    {s.state} · {s.total} cells
                  </div>
                  {s.total === 0 ? (
                    <div style={{ opacity: 0.7 }}>none this week</div>
                  ) : (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {s.areas.map(([area, diseases]) => (
                        <li key={area}>
                          <b>{area}</b> — {diseases.join(', ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'proposals',
          title: 'Agent proposals',
          icon: '⚖️',
          badge: proposals.length,
          content: (
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 8px' }}>Six charts an agent might propose over CDC's table. The session admits the ones that make a claim over real columns and files a typed refusal for the rest — with the reason.</p>
              <button type="button" onClick={() => void propose()} disabled={readOnly} style={{ marginBottom: 10 }}>
                Propose six charts
              </button>
              {proposals.length === 0 ? null : (
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {proposals.map((p, i) => (
                    <li key={`${p.id}-${String(i)}`} style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: p.admitted ? colorOfState('present') : colorOfState('unknown') }}>{p.admitted ? 'admitted' : 'refused'}</span> <code>{p.id}</code> — <i>{p.claim}</i>
                      {p.admitted ? null : (
                        <div style={{ opacity: 0.85 }}>
                          <code>{p.code}</code>: {p.detail}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ),
        },
        {
          id: 'commits',
          title: 'Commit log',
          icon: '🧾',
          badge: state.commits.length,
          content: <CommitLog commits={state.commits} onSeek={(id) => void view.seek(id)} />,
        },
        {
          id: 'sources',
          title: 'Sources',
          icon: '🗂',
          badge: state.tables?.length ?? 0,
          content: <Sources tables={state.tables ?? []} sources={state.sources} columns={state.columns} journal={state.journal} journalTotal={state.journalTotal} checks={checks} checksError={checksError} onRefresh={refreshSources} refreshing={refreshing} readOnly={readOnly} />,
        },
        {
          id: 'story',
          title: 'Story',
          icon: '📖',
          badge: story.meta.beatCount,
          content: <StoryReport post={story} />,
        },
      ]}
    />

    </>
  );
}

/** The Story report: one section per named beat along the lineage, its words and the steps since the previous beat, plus the post as JSON for storydeck. */
function StoryReport({ post }: { readonly post: StoryPost }): ReactNode {
  const [copied, setCopied] = useState(false);
  if (post.sections.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>No beats named on this lineage yet — name a checkpoint in the time strip and it becomes a section here.</p>;
  }
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
      <p style={{ margin: '0 0 8px', opacity: 0.8 }}>
        <b>{post.meta.title}</b> · {post.meta.beatCount} beat{post.meta.beatCount === 1 ? '' : 's'} on {post.meta.path ?? "the head's lineage"}. Every beat is a section: its words as they stood, and the acts since the previous beat. Copy the JSON into storydeck's <code>assemblePost</code> for Read, Scroll and Watch.
      </p>
      {post.beats.map((b) => (
        <div key={b.key} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>
            {b.index + 1}. {b.label} <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, opacity: 0.6 }}>at #{b.at}</span>
          </div>
          {b.words.caption !== undefined ? <div style={{ opacity: 0.85 }}>{b.words.caption}</div> : null}
          {b.steps.length > 0 ? (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {b.steps.map((s) => (
                <li key={s.commitId}>
                  {s.sentence}
                  {s.actor !== 'user' ? <span style={{ opacity: 0.6 }}> ({s.actor})</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            .writeText(JSON.stringify(post, null, 2))
            .then(() => setCopied(true))
            .catch(() => setCopied(false)); // a denied clipboard stays honest: the button never claims a copy
        }}
        style={{ font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}
      >
        {copied ? 'Copied the post JSON' : 'Copy the post JSON for storydeck'}
      </button>
    </div>
  );
}

/** What the browser says about itself — so a screenshot carries the window size and zoom it was taken at (a layout question answers itself). */
function WindowReadout(): ReactNode {
  const read = () => `window ${window.innerWidth}×${window.innerHeight} · pixel ratio ${window.devicePixelRatio}`;
  const [text, setText] = useState(read);
  useEffect(() => {
    const onResize = () => setText(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return <span style={{ fontSize: 11, opacity: 0.55, fontFamily: 'ui-monospace, Menlo, monospace' }}>{text}</span>;
}
