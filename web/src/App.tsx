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
import { useEffect, useMemo, useState } from 'react';
import {
  CommitLog,
  TimeTravelBar,
  VizBar,
  VizCockpit,
  VizLine,
  VizTable,
  createSessionView,
  keepPredicate,
  pollingSource,
  selectionForView,
  useSessionView,
} from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import { GrammarPanel, type GrammarWire } from './GrammarPanel.js';
import { JumpBox } from './JumpBox.js';

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
  const view = useMemo(() => createSessionView(pollingSource({ intervalMs: 1000 }), { as: 'user' }), []);
  useEffect(() => () => view.dispose(), [view]);
  return view;
}

export function App(): JSX.Element {
  const view = useView();
  const state = useSessionView(view);
  const [rows, setRows] = useState<RowsPayload | null>(null);
  const [proposals, setProposals] = useState<readonly Proposal[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [mode, setMode] = useState<'explore' | 'present'>('explore');

  useEffect(() => {
    let live = true;
    void fetchJson<RowsPayload>('/api/rows')
      .then((p) => live && setRows(p))
      .catch((e: unknown) => live && setProblem(`the rows did not arrive: ${e instanceof Error ? e.message : String(e)}`));
    void fetchJson<{ proposals?: Proposal[] }>('/api/proposals')
      .then((p) => live && setProposals(p.proposals ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const cells = rows?.cells ?? [];
  const series = rows?.series ?? [];
  const absenceField = rows?.absence.field ?? 'report_state';
  const absenceStates = rows?.absence.states ?? [];
  const columns = state.columns[state.defaultTable] ?? [];
  const selFor = (self: string | null) => selectionForView(state.selections, self);

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
    return (rows?.diseases ?? []).map((category) => ({ category, count: sums.get(category) ?? 0 }));
  }, [cells, rows?.diseases, sumKind, state.selections]);

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
  const areaChosen = state.selections.some((s) => s.viewId === 'kinds' || s.viewId === 'table');
  const trendData = useMemo(() => {
    const keep = keepPredicate(selFor('trend'));
    return series
      .filter((s) => s.metric === pickedDisease)
      .map((s) => ({ t: s.t, jurisdiction: s.entity, kind: s.entity_kind, disease: s.metric, [absenceField]: 'present', value: s.value }))
      .filter((r) => keep(r) && (areaChosen || r.kind === 'region'))
      .map((r) => ({ date: r.t, value: r.value, series: r.jurisdiction }));
  }, [series, pickedDisease, absenceField, areaChosen, state.selections]);

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
  const grain = rows?.grain;

  return (
    <VizCockpit
      readOnly={readOnly}
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
            onReturnToNow={() => void view.returnToNow()}
          />
          <JumpBox commitIds={state.commits.map((c) => c.id)} onSeek={(id) => void view.seek(id)} />
        </div>
      }
      toast={problem === null ? null : <div role="alert" style={{ padding: 10, fontSize: 13 }}>⚠ {problem}</div>}
      charts={[
        {
          id: 'coverage',
          weight: 2,
          caption: `Coverage — ${String(keptCount)} of ${String(cells.length)} cells in view · which silence is which (click to select)`,
          render: ({ width, height }) => (
            <VizBar viewId="coverage" data={coverageData} field={absenceField} colorOf={colorOfState} selection={selFor('coverage')} columns={columns} encoding={state.encodings['coverage'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('coverage', e, 'select report state')} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
          ),
        },
        {
          id: 'diseases',
          weight: 4,
          caption: `Reported cases by disease, summed over kept ${sumKind}s — click one to drive the trend, the week line and the table (now: ${pickedDisease})`,
          render: ({ width, height }) => (
            <VizBar viewId="diseases" data={diseaseData} field="disease" selection={selFor('diseases')} columns={columns} encoding={state.encodings['diseases'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('diseases', e, 'pick disease')} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
          ),
        },
        {
          id: 'kinds',
          weight: 1.5,
          caption: 'Cells by area kind — states, regions, roll-ups (click to select)',
          render: ({ width, height }) => (
            <VizBar viewId="kinds" data={kindData} field="kind" selection={selFor('kinds')} columns={columns} encoding={state.encodings['kinds'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('kinds', e, 'select area kind')} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
          ),
        },
        {
          id: 'weeks',
          weight: 3,
          caption: `Reported cases per ${grain?.bucket ?? 'week'}, summed over kept ${sumKind}s · ${grain?.note ?? ''}`,
          render: ({ width, height }) => <VizLine viewId="weeks" data={weekData} dateField="t" valueField="cases" columns={columns} encoding={state.encodings['weeks'] ?? {}} width={width} height={height} />,
        },
        {
          id: 'trend',
          weight: 3,
          caption: `${pickedDisease} per ${areaChosen ? 'kept area' : 'region (the default until you pick a kind or an area)'}, ${grain?.bucket ?? 'week'} — a missing point is a silence, never a zero`,
          render: ({ width, height }) => <VizLine viewId="trend" data={trendData} dateField="t" valueField="value" colorOf={colorOfArea} columns={columns} encoding={state.encodings['trend'] ?? {}} width={width} height={height} />,
        },
        {
          id: 'table',
          weight: 3,
          caption: `${pickedDisease}, week ending ${latestWeek} — the cells as CDC printed them, with their flag (click a row to select)`,
          render: ({ width, height }) => (
            <VizTable viewId="table" data={tableRows} columns={['jurisdiction', 'kind', 'cases', absenceField, 'flag', 'ytd', 'prev52_max']} idField="jurisdiction" selection={selFor('table')} width={width} height={height} onEmit={(e) => void view.emit('table', e, 'select area')} />
          ),
        },
      ]}
      reports={[
        {
          id: 'grammar',
          title: 'Grammar',
          icon: '✍',
          badge: rows?.grammar.verbs.length ?? 0,
          content: <GrammarPanel grammar={rows?.grammar ?? null} views={state.views} encodings={state.encodings} columns={columns} />,
        },
        {
          id: 'silences',
          title: 'The silences',
          icon: '🔇',
          badge: silences.reduce((n, s) => n + s.total, 0),
          content: (
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 8px' }}>
                Week ending {latestWeek}. CDC's flags, in our words: <b>not-configured</b> — not reportable there (stop looking); <b>unavailable</b> — the jurisdiction could not send it (go ask);{' '}
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
      ]}
    />
  );
}
