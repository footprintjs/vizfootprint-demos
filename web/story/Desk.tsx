/**
 * THE DESK THE PAGE CARRIES — the same charts, in two lenses.
 *
 * The cockpit in `web/src/App.tsx` is the SERVER-backed desk: it polls
 * `/api/state`, fetches `/api/rows`, runs the analyst, edits charts, and shows
 * seven charts plus six report panels. None of that exists in a file you open
 * from `file://`, and most of it would be beside the point there: a story page
 * is something a person was SENT, and what they need is the charts the story is
 * about and a way to try their own question on them.
 *
 * So this is a smaller desk over the same session, built from the same parts:
 * the library's own chart components, and the same host-side aggregation
 * helpers `App.tsx` uses (`../src/derive.js`). Four charts, because the story
 * column is half a screen wide and a reader following a narrative wants the
 * charts the narrative is about, not an instrument panel.
 *
 * ONE component draws both lenses, and that is the point rather than a saving:
 * the story lens's figure and the explore lens's cockpit must be the same
 * charts bound to the same session, or the reader who opens a door lands
 * somewhere that does not look like where they were reading.
 */
import { useMemo } from 'react';
import {
  BranchMap,
  ChartFrame,
  CommitLog,
  SelectionChips,
  TimeTravelBar,
  VizBar,
  VizCockpit,
  VizLine,
  VizMap,
  boundField,
  keepPredicate,
  navigateDomain,
  selectionForView,
  useSessionView,
  type CockpitChart,
  type GeoFeatureCollection,
} from 'vizfootprint-ui';
import type { StoryLens } from 'vizfootprint-ui/story/page';
import { arrivesFrom, categoryCounts, categorySums, emitIntent, pickedFrom } from '../src/derive.js';
import type { NndssTables } from '../../src/nndss/etl.js';

const DEFAULT_DISEASE = 'Pertussis';
const DEFAULT_KIND = 'state';
const AREA_PALETTE = ['#4c6ef5', '#e8590c', '#2b8a3e', '#862e9c', '#c92a2a', '#0b7285', '#e67700', '#5f3dc4', '#087f5b', '#a61e4d', '#364fc7', '#d9480f'];
const colorOfArea = (name: string | undefined): string => {
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AREA_PALETTE[h % AREA_PALETTE.length] ?? '#888';
};
const STATE_COLOR: Record<string, string> = { present: '#2f7d5b', 'not-configured': '#5f6f83', unavailable: '#b8681a', withheld: '#7b5ea7', unknown: '#a83a3a' };

export interface StoryDeskProps {
  readonly lens: StoryLens;
  readonly tables: NndssTables;
  readonly geo: GeoFeatureCollection | null;
  /** `figure` — the pinned charts under the story; `cockpit` — the desk a reader acts on. */
  readonly as: 'figure' | 'cockpit';
}

export function StoryDesk({ lens, tables, geo, as }: StoryDeskProps): JSX.Element {
  const { view } = lens;
  const state = useSessionView(view);
  const cells = tables.cells;
  const series = tables.series;
  const columns = state.columns[state.defaultTable] ?? [];
  const shown = state.effectiveEncodings ?? state.encodings;
  const bound = (viewId: string, channel: string, fallback: string): string => boundField(shown[viewId] ?? {}, channel, fallback);
  const selFor = (self: string | null) => selectionForView(state.selections, self, 'intersect', state.links, state.cleared);
  const fitsOf = (viewId: string) => state.views.find((v) => v.viewId === viewId)?.fits;
  const viewLabels = useMemo(() => Object.fromEntries(state.views.map((v) => [v.viewId, v.label ?? v.viewId])), [state.views]);

  const diseasesField = bound('diseases', 'category', 'disease');
  const weeksX = bound('weeks', 'x', 't');
  const weeksY = bound('weeks', 'y', 'cases');
  const trendX = bound('trend', 'x', 't');
  const trendY = bound('trend', 'y', 'value');
  const trendSeries = bound('trend', 'color', 'entity');
  const coverageField = bound('coverage', 'category', 'report_state');

  // Reported cases per category of whatever the bar encodes, over the kept cells of ONE area kind
  // — the host sums, the chart draws (the same split `App.tsx` makes).
  const diseaseData = useMemo(() => {
    const sel = selFor('diseases');
    const keep = keepPredicate(sel);
    const kind = pickedFrom(sel, 'kinds', 'kind', DEFAULT_KIND);
    const sums = categorySums(cells, diseasesField, 'cases', (r) => r['kind'] === kind && keep(r));
    const categories = diseasesField === 'disease' ? tables.diseases : [...new Set(cells.map((c) => String(c[diseasesField] ?? '')))];
    return categories.flatMap((category) => (sums.has(category) ? [{ category, count: sums.get(category)! }] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, tables.diseases, diseasesField, state.selections, state.links, state.cleared]);

  const coverageData = useMemo(() => {
    const keep = keepPredicate(selFor('coverage'));
    const categories = [...new Set(cells.map((c) => String(c[coverageField] ?? '')))];
    return categoryCounts(cells, coverageField, keep, categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, coverageField, state.selections, state.links, state.cleared]);

  const weekData = useMemo(() => {
    const sel = selFor('weeks');
    const keep = keepPredicate(sel);
    const sumKind = pickedFrom(sel, 'kinds', 'kind', DEFAULT_KIND);
    const byWeek = new Map<string, number>();
    for (const c of cells) {
      if (c.kind !== sumKind || !keep(c)) continue;
      const value = c[weeksY];
      const bucket = c[weeksX];
      if (typeof value !== 'number' || bucket === null || bucket === undefined) continue; // a silence is never a zero
      const key = String(bucket);
      byWeek.set(key, (byWeek.get(key) ?? 0) + value);
    }
    return [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, value]) => ({ date, value, series: `kept ${sumKind}s` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, weeksX, weeksY, state.selections, state.links, state.cleared]);

  const trendData = useMemo(() => {
    const sel = selFor('trend');
    const keep = keepPredicate(sel);
    const pickedDisease = pickedFrom(sel, 'diseases', 'disease', DEFAULT_DISEASE);
    const areaChosen = arrivesFrom(sel, ['kinds', 'table', 'map']);
    const flat: Record<string, string | number>[] = series
      .filter((s) => s.metric === pickedDisease)
      .map((s) => ({ t: s.t, entity: s.entity, entity_kind: s.entity_kind, metric: s.metric, value: s.value, jurisdiction: s.entity, kind: s.entity_kind, disease: s.metric, report_state: 'present' }));
    return flat
      .filter((r) => keep(r) && (areaChosen || r['kind'] === 'region'))
      .flatMap((r) => {
        const date = r[trendX];
        const value = r[trendY];
        if (typeof value !== 'number' || date === undefined) return [];
        return [{ date: String(date), value, series: String(r[trendSeries] ?? '') }];
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, trendX, trendY, trendSeries, state.selections, state.links, state.cleared]);

  const mapData = useMemo(() => {
    const sel = selFor('map');
    const keep = keepPredicate(sel);
    const pickedDisease = pickedFrom(sel, 'diseases', 'disease', DEFAULT_DISEASE);
    const sums = new Map<string, number>();
    for (const c of cells) {
      if (c.kind !== 'state' || c.disease !== pickedDisease || c.cases === null || !keep(c)) continue;
      sums.set(c.jurisdiction, (sums.get(c.jurisdiction) ?? 0) + c.cases);
    }
    return [...sums.entries()].map(([region, value]) => ({ region, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, state.selections, state.links, state.cleared]);

  const liveViews = new Set(state.selections.filter((s) => s.value !== null).map((s) => s.viewId)); // cleared is `null`, whatever the kind
  const clearable = (id: string) => ({ active: liveViews.has(id), onClear: () => void view.clear(id, `clear ${viewLabels[id] ?? id}`) });

  const charts: CockpitChart[] = [
    {
      id: 'diseases',
      weight: 4,
      ...clearable('diseases'),
      caption: `Reported cases by ${diseasesField}, summed over kept ${pickedFrom(selFor('diseases'), 'kinds', 'kind', DEFAULT_KIND)}s — click one to drive the map, the trend and the week line`,
      render: ({ width, height }) => (
        <VizBar viewId="diseases" data={diseaseData} field={diseasesField} selection={selFor('diseases')} columns={columns} fits={fitsOf('diseases')} encoding={shown['diseases'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('diseases', e, emitIntent('pick', e))} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
      ),
    },
    {
      id: 'map',
      weight: 4,
      ...clearable('map'),
      caption: `${pickedFrom(selFor('map'), 'diseases', 'disease', DEFAULT_DISEASE)} — reported cases per state, summed over kept weeks · a hatched state has no present cell (a silence, never a zero)`,
      render: ({ width, height }) =>
        geo === null ? (
          <div role="status" style={{ padding: 12, opacity: 0.7 }}>
            this page carries no map shapes
          </div>
        ) : (
          <VizMap viewId="map" geo={geo} coordinates="planar" regionField="jurisdiction" data={mapData} valueLabel="cases" selection={selFor('map')} width={width} height={height} onEmit={(e) => void view.emit('map', e, emitIntent('select', e))} />
        ),
    },
    {
      id: 'trend',
      weight: 3,
      ...clearable('trend'),
      caption: `${pickedFrom(selFor('trend'), 'diseases', 'disease', DEFAULT_DISEASE)} — ${trendY} per ${arrivesFrom(selFor('trend'), ['kinds', 'table', 'map']) ? 'kept area' : 'region (the default until you pick an area)'}, by week — a missing point is a silence, never a zero`,
      render: ({ width, height }) => (
        <VizLine viewId="trend" data={trendData} dateField={trendX} valueField={trendY} colorOf={colorOfArea} columns={columns} fits={fitsOf('trend')} encoding={shown['trend'] ?? {}} xDomain={navigateDomain(selFor('trend'))?.range as readonly [string | null, string | null] | undefined} width={width} height={height} onEmit={(e) => void view.emit('trend', e, emitIntent('brush', e))} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
      ),
    },
    {
      id: 'weeks',
      weight: 3,
      ...clearable('weeks'),
      caption: `${weeksY} per ${weeksX === 't' ? (tables.grain.bucket ?? 'week') : weeksX}, summed over kept states · ${tables.grain.note ?? ''}`,
      render: ({ width, height }) => (
        <VizLine viewId="weeks" data={weekData} dateField={weeksX} valueField={weeksY} columns={columns} fits={fitsOf('weeks')} encoding={shown['weeks'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('weeks', e, emitIntent('brush', e))} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
      ),
    },
    {
      id: 'coverage',
      weight: 2,
      ...clearable('coverage'),
      caption: `Coverage — cells by ${coverageField} (click to select)`,
      render: ({ width, height }) => (
        <VizBar viewId="coverage" data={coverageData} field={coverageField} colorOf={(s) => STATE_COLOR[s] ?? '#888'} selection={selFor('coverage')} columns={columns} fits={fitsOf('coverage')} encoding={shown['coverage'] ?? {}} width={width} height={height} onEmit={(e) => void view.emit('coverage', e, emitIntent('select', e))} onReencode={(v, c, f) => void view.reencode(v, c, f)} />
      ),
    },
  ];

  if (as === 'figure') {
    // the four the story is about, at the size a story column gives them. `display: flex` because
    // `.vzf-chart-frame` is `flex: 1` — a block parent gives it a zero height and nothing draws.
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 8 }}>
        {(['diseases', 'map', 'trend', 'weeks'] as const).map((id) => {
          const cell = charts.find((c) => c.id === id);
          return cell === undefined ? null : (
            <div key={id} style={{ height: 190, minWidth: 0, display: 'flex' }}>
              <ChartFrame>{cell.render}</ChartFrame>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <VizCockpit
      charts={charts}
      layout={state.layout}
      onLayoutChange={(change) => void view.setLayout(change)}
      top={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <TimeTravelBar
            compact
            commits={state.commits}
            cursor={state.cursor}
            head={state.head}
            bookmarks={state.bookmarks}
            branches={state.branches}
            viewingPast={state.viewingPast}
            {...(state.paths.current !== null ? { pathName: state.paths.current } : {})}
            onSeek={(id) => void view.seek(id)}
            onStepBack={() => void view.stepBack()}
            onStepForward={() => void view.stepForward()}
            onNameBookmark={(label) => void view.bookmark(label)}
            onReturnToNow={() => void view.returnToNow()}
          />
          <SelectionChips
            selections={state.selections}
            cleared={state.cleared}
            links={state.links}
            labels={viewLabels}
            onClear={(id) => void view.clear(id, `clear ${viewLabels[id] ?? id}`)}
            onClearAll={() => void view.clearAll()}
            onSetPolarity={(id, exclude) => void view.setPolarity(id, exclude, `${exclude ? 'exclude' : 'keep'} the ${viewLabels[id] ?? id} selection`)}
          />
        </div>
      }
      reports={[
        {
          id: 'commits',
          title: 'Commit log',
          icon: '🧾',
          badge: state.commits.length,
          content: <CommitLog commits={state.commits} onSeek={(id) => void view.seek(id)} />,
        },
        {
          id: 'branches',
          title: 'Paths',
          icon: '⎇',
          badge: state.paths.list.length,
          content: (
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 8px' }}>
                Every line of work on this page. The author's is the one the story tells; yours is the one your acts land on.
              </p>
              <BranchMap
                commits={state.commits}
                cursor={state.cursor}
                head={state.head}
                bookmarks={state.bookmarks}
                paths={state.paths.list}
                archivedPaths={state.paths.archivedList}
                onSeek={(id) => void view.seek(id)}
                onNewPath={(id: string) => void view.newPathAt(id)}
              />
            </div>
          ),
        },
      ]}
    />
  );
}
