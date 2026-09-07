/**
 * THE NNDSS DESK — this definition's own arithmetic, and the cells it draws
 * with it: seven, and an eighth where the surface carries the graph.
 *
 * `vizfootprint-studio/desk` brings the dashboard: the time strip, the band, the
 * editor, the notes, the panels, the story. It brings no rows and no opinion
 * about what a bar means. This file is the other half — everything that is about
 * CDC's weekly table rather than about dashboards — and it is deliberately ONE
 * file, because it used to be two:
 *
 *   · `web/src/App.tsx` declared the cockpit's cells;
 *   · `web/story/Desk.tsx` re-declared five of them for the story page, with
 *     the palette and the defaults copied and the captions slightly different.
 *
 * Two spellings of one dashboard is exactly the drift the library spends its
 * whole surface preventing, and it had reached the demo. So the cells live here
 * once and both surfaces mount them: the cockpit's band, and the pinned figure
 * a reader scrolls. **The story page and the desk render from the same cells.**
 *
 * ## Why the arithmetic is here and not in the shell
 *
 * The desk projects; the host derives (`vizfootprint-studio/README.md`). Every
 * `useMemo` below folds 90,300 rows under a selection that reaches this view
 * THROUGH THE LINK GRAPH — and the memo is not an optimisation, it is the
 * budget: one pass per cell per change, at 50 ms, over a table this size. A
 * shell that summed on the host's behalf could not know any of that.
 */
import { useMemo, type ReactNode } from 'react';
import {
  VizBar,
  VizLine,
  VizMap,
  VizNetwork,
  VizTable,
  brightPredicate,
  keepPredicate,
  layerAddress,
  navigateDomain,
  type GeoFeatureCollection,
  type NetworkEdge,
  type NetworkNode,
} from 'vizfootprint-ui';
import type { DeskChart, DeskProjection, DeskSilence } from 'vizfootprint-studio/desk';
import { arrivesFrom, capNote, categoryCounts, categorySums, columnVocabulary, emitIntent, pickedFrom, type Vocabulary } from './derive.js';

// ── the NNDSS parameter list ────────────────────────────────────────────────
// Everything below this line is what makes this desk THIS desk. It is short on
// purpose: the shell asked for exactly these and nothing else.

/** The disease every view shows until one is picked. */
export const DEFAULT_DISEASE = 'Pertussis';
/**
 * How many nodes a complete graph needs before "read it as a matrix instead" is
 * advice rather than nonsense. Ghoniem/Fekete/Castagliola's crossover sits in
 * the low tens of nodes at high density; below that a node-link is the easier
 * read whatever the density says, and this demo's committed graph carries 15.
 */
const HAIRBALL_NODES = 8;
/** The one area kind every sum is over until the kinds view says otherwise. */
export const DEFAULT_KIND = 'state';
/** The absence vocabulary's colours — CDC's silences, kept apart by sight as well as by name. */
export const STATE_COLOR: Record<string, string> = { present: '#2f7d5b', 'not-configured': '#5f6f83', unavailable: '#b8681a', withheld: '#7b5ea7', unknown: '#a83a3a' };
export const colorOfState = (s: string): string => STATE_COLOR[s] ?? '#888';
/** One steady colour per area name, so a line keeps its colour as the set of lines changes. */
const AREA_PALETTE = ['#4c6ef5', '#e8590c', '#2b8a3e', '#862e9c', '#c92a2a', '#0b7285', '#e67700', '#5f3dc4', '#087f5b', '#a61e4d', '#364fc7', '#d9480f'];
export const colorOfArea = (name: string | undefined): string => {
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AREA_PALETTE[h % AREA_PALETTE.length] ?? '#888';
};
/** The columns the table cell prints — CDC's cells as CDC printed them. */
const TABLE_COLUMNS = (absenceField: string): readonly string[] => ['jurisdiction', 'kind', 'cases', absenceField, 'flag', 'ytd', 'prev52_max'];
/**
 * WHICH CELLS THE STORY FIGURE SHOWS. Four of them: a story column is half
 * a screen wide, and a reader following a narrative wants the charts the
 * narrative is about, not the whole instrument panel.
 */
export const STORY_FIGURE = ['diseases', 'map', 'trend', 'weeks'] as const;

/**
 * The network view, and the ADDRESS its marks speak under. Every circle on that
 * frame belongs to the nodes LAYER, so a click there is an act on `net~nodes` —
 * and the clause it lands is the one that view must read back, never `net`.
 *
 * Both halves come from the DEF, which declares them: a page that re-spelled
 * 'nodes' here would keep selecting under an address the def no longer owns the
 * moment the layer is renamed, and nothing would typecheck differently.
 */
import { NETWORK_VIEW, NETWORK_NODES_LAYER } from '../../src/nndss/def.js';
export { NETWORK_VIEW };
export const NETWORK_NODES = layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER);

// ── the rows this desk is drawn over ────────────────────────────────────────

export interface NndssCellRow {
  readonly jurisdiction: string;
  readonly kind: string;
  readonly disease: string;
  readonly t: string;
  readonly cases: number | null;
  readonly [k: string]: string | number | null;
}
/**
 * One row of the graph's `nodes` table AT THE CURSOR: the committed columns plus
 * the `x` / `y` the layout act wrote. Both positions are optional in the TYPE
 * because they are optional in the WORLD — a surface that carries the graph but
 * has not run the act has the rows and no coordinates, and the cell says so
 * rather than inventing a circle's home.
 */
export interface NndssNodeRow {
  readonly disease: string;
  readonly x?: number | null;
  readonly y?: number | null;
  readonly [k: string]: string | number | null | undefined;
}
/** One row of the `edges` table at the cursor: the pair, plus the four positions `bringOver` carried across the relations. */
export interface NndssEdgeRow {
  readonly source: string;
  readonly target: string;
  readonly source_x?: number | null;
  readonly source_y?: number | null;
  readonly target_x?: number | null;
  readonly target_y?: number | null;
  readonly [k: string]: string | number | null | undefined;
}
export interface NndssSeriesRow {
  readonly t: string;
  readonly entity: string;
  readonly entity_kind: string;
  readonly metric: string;
  readonly value: number;
}

/**
 * What the desk is drawn over, however it arrived — off `/api/rows` in the
 * cockpit, out of the payload block in the single-file story page. ONE shape, so
 * the cells cannot tell which surface they are on.
 */
export interface NndssDeskData {
  readonly cells: readonly NndssCellRow[];
  readonly series: readonly NndssSeriesRow[];
  /**
   * The graph's two tables, when this surface carries them. Absent is a real
   * answer — the story page builds its def over the one CSV it was sent — and an
   * absent graph draws NO network cell rather than an empty frame.
   */
  readonly nodes?: readonly NndssNodeRow[];
  readonly edges?: readonly NndssEdgeRow[];
  /** The sentence the session refused the graph's windows with, when it did. */
  readonly netRefused?: string | null;
  readonly diseases: readonly string[];
  readonly weeks: readonly string[];
  /** The declared absence column and its vocabulary. */
  readonly absence: { readonly field: string; readonly states: readonly string[] };
  readonly grain: { readonly bucket?: string; readonly reducer?: string; readonly note?: string };
  /** The state outlines, when this surface has them. */
  readonly geo: GeoFeatureCollection | null;
}

// ── the silences: the host's own arithmetic, handed to the desk's panel ─────

/**
 * How much of each silence there is in the latest week, and where — every area
 * regardless of the selection, because a silence is a fact about the table and
 * not about what is currently on screen.
 */
export function useSilences(data: NndssDeskData): readonly DeskSilence[] {
  const { cells, absence, weeks } = data;
  const latestWeek = weeks[weeks.length - 1] ?? '';
  return useMemo(
    () =>
      absence.states
        .filter((s) => s !== 'present')
        .map((s) => {
          const inState = cells.filter((c) => c[absence.field] === s && c.t === latestWeek);
          const byArea = new Map<string, string[]>();
          for (const c of inState) byArea.set(c.jurisdiction, [...(byArea.get(c.jurisdiction) ?? []), c.disease]);
          return { state: s, total: inState.length, areas: [...byArea.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12) };
        }),
    [cells, absence.states, absence.field, latestWeek],
  );
}

// ── the cells ─────────────────────────────────────────────────────────

/**
 * The cells, over the desk's projection.
 *
 * Called once, from the desk's own body, so the memos below are real hooks and
 * behave like hooks — which is the point: without them every fold re-runs on
 * every poll of a 90,300-row table.
 */
export function useNndssCells(desk: DeskProjection, data: NndssDeskData): readonly DeskChart[] {
  const { cells, series, geo, grain } = data;
  const absenceField = data.absence.field;
  const absenceStates = data.absence.states;
  const { state, view, columns, shown } = desk;

  /**
   * WHICH FIELD A CHART'S CHANNEL ENCODES — the session's answer, not a constant
   * written here at build time. Every binding below reads through this, so BOTH
   * sides of the chart follow it: the host aggregation that makes the marks, and
   * the field the chart names on its axis. (They must move together — an axis
   * that changed while the marks did not would be a lie.)
   */
  const bound = (viewId: string, channel: string, fallback: string): string => desk.bound(viewId, channel, fallback);
  const coverageField = bound('coverage', 'category', absenceField);
  const diseasesField = bound('diseases', 'category', 'disease');
  const kindsField = bound('kinds', 'category', 'kind');
  const weeksX = bound('weeks', 'x', 't');
  const weeksY = bound('weeks', 'y', 'cases');
  const trendX = bound('trend', 'x', 't');
  const trendY = bound('trend', 'y', 'value');
  const trendSeries = bound('trend', 'color', 'entity');
  const selFor = desk.selFor;

  /**
   * The vocabulary of a categorical axis when no DECLARED list names it: the
   * distinct values the column actually carries, in first-seen order, CAPPED.
   * Counted once per column per snapshot — the cache is keyed on the rows
   * themselves, so it is thrown away when they change and never otherwise.
   * Uncached and uncapped, re-encoding a bar to a 900-value column cost ~766 ms
   * and drew 900 bars nobody can read.
   */
  const vocabCache = useMemo(() => new Map<string, Vocabulary>(), [cells]);
  const vocabOf = (field: string): Vocabulary => {
    const hit = vocabCache.get(field);
    if (hit !== undefined) return hit;
    const fresh = columnVocabulary(cells, field);
    vocabCache.set(field, fresh);
    return fresh;
  };
  /**
   * The cap, said on screen where it bites — never a silent truncation. The
   * DRAWN count is passed in because it is not always the number the cap
   * allowed: a category with no reported cell gets no bar.
   */
  const capWords = (field: string, drawn: number): string => {
    const note = capNote(vocabOf(field), field, drawn);
    return note === null ? '' : ` · ${note}`;
  };
  /**
   * THE NOUN A CAPTION USES FOR A CHANNEL — the column NAME the session has that
   * channel bound to, never a word written here at build time. It is the raw
   * column name on purpose: that is exactly what the axis label beside it says,
   * so the two cannot drift.
   */
  const noun = (field: string): string => field;

  /**
   * THE DISEASE A VIEW IS SHOWING — read through the LINK GRAPH, like every other
   * consumer. Reading `state.selections` directly skips the graph: a link the
   * person had switched OFF would still move the map, the trend, the table and
   * four captions while the log said the link was off. The clause has to be ON
   * the disease column too — re-encode that bar to jurisdictions and its clause
   * names a STATE, and reading that as a disease puts "California" everywhere.
   */
  const diseaseFor = (viewId: string): string => {
    const arrived = selFor(viewId);
    // TWO sources for one column: the bar and the network both pick a disease, and
    // the network's clause lands under its LAYER's address. Read the bar alone and
    // a click on a circle narrows every fold to that disease while the captions
    // stay pinned to another — the map and the trend intersect to nothing under a
    // caption naming a disease nobody chose. The bar wins when it has a pick.
    return pickedFrom(arrived, 'diseases', 'disease', pickedFrom(arrived, NETWORK_NODES, 'disease', DEFAULT_DISEASE));
  };
  /** The kind a view SUMS over — else states (summing states + regions + roll-ups would count every case three times). */
  const kindFor = (viewId: string): string => pickedFrom(selFor(viewId), 'kinds', 'kind', DEFAULT_KIND);
  /** "Has an area been chosen?" is the same question as any other: what reaches this view through the link graph. */
  const areaChosenIn = (viewId: string): boolean => arrivesFrom(selFor(viewId), ['kinds', 'table', 'map']);

  // the slices every fold below is keyed on: what is selected, what the links do with it, what was cleared
  const sel = [state.selections, state.links, state.cleared] as const;

  // cells per category of whatever column the bar encodes. The DECLARED silence
  // states name the categories only while it still encodes the absence field — a
  // re-encoded bar takes its vocabulary from the data (a declared list belonging
  // to another column would invent bars this column never had).
  const coverageData = useMemo(() => {
    const keep = keepPredicate(selFor('coverage'));
    const categories = coverageField === absenceField ? absenceStates : vocabOf(coverageField).values;
    // ONE pass over the cells, whatever the number of bars: a filter per bar is
    // O(categories × rows), and 70 jurisdictions over 90,300 cells took 58 ms on
    // every selection change (the budget is 50).
    return categoryCounts(cells, coverageField, keep, categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor/vocabOf read the slices already listed
  }, [cells, absenceStates, absenceField, coverageField, ...sel]);

  // reported cases per category of whatever column the bar encodes, over the kept
  // cells of ONE kind — the host sums, the chart draws
  const diseaseData = useMemo(() => {
    const s = selFor('diseases');
    const keep = keepPredicate(s);
    const kind = pickedFrom(s, 'kinds', 'kind', DEFAULT_KIND);
    const sums = categorySums(cells, diseasesField, 'cases', (r) => r['kind'] === kind && keep(r));
    // a category with no present cell in view gets NO bar — a missing bar is a silence, a zero would be a lie
    const categories = diseasesField === 'disease' ? data.diseases : vocabOf(diseasesField).values;
    return categories.flatMap((category) => (sums.has(category) ? [{ category, count: sums.get(category)! }] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor/vocabOf read the slices already listed
  }, [cells, data.diseases, diseasesField, ...sel]);

  // the HIGHLIGHT share of each disease bar: the same sums over the rows a highlight edge keeps bright
  // (the map lighting the bar) — only when such an edge is live, so the overlay never repeats the base
  const diseaseHighlight = useMemo(() => {
    const s = selFor('diseases');
    if (![...s.clauses.values()].some((c) => c.response === 'highlight')) return undefined;
    const bright = brightPredicate(s);
    const kind = pickedFrom(s, 'kinds', 'kind', DEFAULT_KIND);
    const sums = categorySums(cells, diseasesField, 'cases', (r) => r['kind'] === kind && bright(r));
    return [...sums.entries()].map(([category, count]) => ({ category, count }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  }, [cells, diseasesField, ...sel]);

  const kindData = useMemo(() => {
    const keep = keepPredicate(selFor('kinds'));
    // the three declared area kinds name the categories only while the bar still encodes `kind`
    const categories = kindsField === 'kind' ? ['state', 'region', 'total'] : vocabOf(kindsField).values;
    return categoryCounts(cells, kindsField, keep, categories); // ONE pass, whatever the number of bars
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor/vocabOf read the slices already listed
  }, [cells, kindsField, ...sel]);

  // the y column summed per bucket of the x column, over the kept cells of the same
  // ONE kind — both columns are the session's bindings, so a re-encode moves the line
  const weekData = useMemo(() => {
    const s = selFor('weeks');
    const keep = keepPredicate(s);
    const sumKind = pickedFrom(s, 'kinds', 'kind', DEFAULT_KIND);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  }, [cells, weeksX, weeksY, ...sel]);

  // the trend for the picked disease — present cells only (a silence is a missing point).
  // Fifty-eight state lines are spaghetti, so until a kind or an area is chosen the
  // line shows the regions; the other views' clauses narrow it like any other view.
  const trendData = useMemo(() => {
    const s = selFor('trend');
    const keep = keepPredicate(s);
    const pickedDisease = pickedFrom(s, 'diseases', 'disease', DEFAULT_DISEASE);
    const areaChosen = arrivesFrom(s, ['kinds', 'table', 'map']);
    // one flat record per series row, carrying BOTH the series table's own names
    // (t · entity · value) and the cell table's (jurisdiction · kind · disease), so a
    // clause and a re-encoded channel can each name the column they know
    const flat: Record<string, string | number>[] = series
      .filter((p) => p.metric === pickedDisease)
      .map((p) => ({ t: p.t, entity: p.entity, entity_kind: p.entity_kind, metric: p.metric, value: p.value, jurisdiction: p.entity, kind: p.entity_kind, disease: p.metric, [absenceField]: 'present' }));
    return flat
      .filter((r) => keep(r) && (areaChosen || r['kind'] === 'region'))
      .flatMap((r) => {
        const date = r[trendX];
        const value = r[trendY];
        if (typeof value !== 'number' || date === undefined) return []; // an unbound channel draws nothing, never a guess
        return [{ date: String(date), value, series: String(r[trendSeries] ?? '') }];
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  }, [series, absenceField, trendX, trendY, trendSeries, ...sel]);

  // the picked disease per STATE, summed over the kept weeks — a state with no present cell gets no datum (the map hatches it)
  const mapData = useMemo(() => {
    const s = selFor('map');
    const keep = keepPredicate(s);
    const pickedDisease = pickedFrom(s, 'diseases', 'disease', DEFAULT_DISEASE);
    const sums = new Map<string, number>();
    for (const c of cells) {
      if (c.kind !== 'state' || c.disease !== pickedDisease || c.cases === null || !keep(c)) continue;
      sums.set(c.jurisdiction, (sums.get(c.jurisdiction) ?? 0) + c.cases);
    }
    return [...sums.entries()].map(([region, value]) => ({ region, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  }, [cells, ...sel]);

  // places that report to NNDSS but have no shape on this map — read off the data, never hand-listed
  const noShape = useMemo(() => {
    if (geo === null) return [];
    const shapes = new Set(geo.features.map((f) => String(f.properties?.['name'] ?? '')));
    const places = new Set(cells.filter((c) => c.kind === 'state').map((c) => c.jurisdiction));
    return [...places].filter((p) => !shapes.has(p)).sort();
  }, [geo, cells]);

  const latestWeek = data.weeks[data.weeks.length - 1] ?? '';
  const tableRows = useMemo(() => {
    const pickedDisease = diseaseFor('table');
    return cells.filter((c) => c.disease === pickedDisease && c.t === latestWeek);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- diseaseFor reads the slices already listed
  }, [cells, latestWeek, ...sel]);

  /** A coordinate is a coordinate only when it is a real number — a null, a NaN or a missing column is a position nobody wrote. */
  const placed = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

  /**
   * The node marks: one per row that HAS a position. A row with none is not
   * drawn — the layout act is what puts a disease somewhere, and a circle at the
   * origin would be this file guessing on its behalf.
   */
  const netNodes = useMemo<readonly NetworkNode[]>(
    () =>
      (data.nodes ?? []).flatMap((r) => {
        const { x, y } = r;
        if (!placed(x) || !placed(y)) return [];
        return [{ id: String(r.disease), x, y, row: r }];
      }),
    [data.nodes],
  );

  /**
   * The links, with BOTH ends already placed — the four columns `bringOver`
   * carried across the declared relations. Nothing here looks a position up by
   * id: that lookup is exactly what the act exists to have already done.
   */
  const netEdges = useMemo<readonly NetworkEdge[]>(
    () =>
      (data.edges ?? []).flatMap((r) => {
        const { source_x: sx, source_y: sy, target_x: tx, target_y: ty } = r;
        // an edge missing ANY of its four is not half-drawn: a line to a place nobody wrote is a lie about where its far end is
        if (!placed(sx) || !placed(sy) || !placed(tx) || !placed(ty)) return [];
        return [{ source: String(r.source), target: String(r.target), sx, sy, tx, ty }];
      }),
    [data.edges],
  );

  /**
   * How dense this graph is, in the words the papers use. It is COUNTED, never
   * asserted: a node-link is only a reading while the ties are sparse enough to
   * follow, and at full density the honest advice is to read the matrix.
   */
  const possibleTies = (netNodes.length * (netNodes.length - 1)) / 2;
  /** Every row the surface carried, drawn — so a completeness claim is about the GRAPH and not about the subset that had positions. */
  const wholeGraphDrawn = netNodes.length === (data.nodes ?? []).length && netEdges.length === (data.edges ?? []).length;
  const percent = possibleTies === 0 ? 0 : (netEdges.length / possibleTies) * 100;
  const densityWords =
    possibleTies === 0
      ? ''
      : // the hairball advice belongs to a graph big enough for the drawing to
        // actually fail: two circles and one line is complete and perfectly
        // readable, and telling that reader to switch to a matrix is nonsense
        wholeGraphDrawn && netEdges.length === possibleTies && netNodes.length >= HAIRBALL_NODES
        ? ' · EVERY pair co-occurs, so this is a complete graph and the drawing is a hairball — the weights read as a matrix (source × target, shaded by jurisdiction-weeks), never as lines'
        : // never rounded to an absolute: 19,850 of 19,900 ties is not 100% (and
          // would withhold the hairball reading exactly where it is needed), and
          // 20 of 4,950 is not 0% with twenty lines on screen
          ` · ${percent < 0.5 ? 'under 1' : percent > 99.5 ? 'over 99' : String(Math.round(percent))}% of the possible ties`;
  /** What the surface carried and the layout act never placed — said on screen, because the counts above are of the DRAWN marks. */
  const unplacedWords =
    (data.nodes ?? []).length - netNodes.length + ((data.edges ?? []).length - netEdges.length) === 0
      ? ''
      : ` · ${String((data.nodes ?? []).length - netNodes.length)} diseases and ${String((data.edges ?? []).length - netEdges.length)} ties carry no position and are not drawn`;

  const keptCount = useMemo(() => {
    const keepAll = keepPredicate(selFor(null));
    return cells.filter((r) => keepAll(r)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  }, [cells, ...sel]);

  const emit = (viewId: string, verb: string) => (e: Parameters<typeof view.emit>[1]) => void view.emit(viewId, e, emitIntent(verb, e));
  const reencode = (v: string, c: string, f: string): void => void view.reencode(v, c, f);

  return [
    {
      id: 'coverage',
      weight: 2,
      caption: `Coverage — ${String(keptCount)} of ${String(cells.length)} cells in view · ${coverageField === absenceField ? 'which silence is which' : `cells by ${noun(coverageField)}`} (click to select)${coverageField === absenceField ? '' : capWords(coverageField, coverageData.length)}`,
      render: ({ width, height }) => (
        <VizBar viewId="coverage" data={coverageData} field={coverageField} colorOf={colorOfState} selection={selFor('coverage')} columns={columns} fits={desk.fitsOf('coverage')} encoding={shown['coverage'] ?? {}} width={width} height={height} onEmit={emit('coverage', 'select')} onReencode={reencode} />
      ),
    },
    {
      id: 'diseases',
      weight: 4,
      caption: `Reported cases by ${noun(diseasesField)}, summed over kept ${kindFor('diseases')}s (a ${noun(diseasesField)} with no present cell has no bar) — click one to drive the trend, the week line and the table wherever the links carry it (now: ${diseaseFor('diseases')})${diseasesField === 'disease' ? '' : capWords(diseasesField, diseaseData.length)}`,
      render: ({ width, height }) => (
        <VizBar viewId="diseases" data={diseaseData} highlight={diseaseHighlight} field={diseasesField} selection={selFor('diseases')} columns={columns} fits={desk.fitsOf('diseases')} encoding={shown['diseases'] ?? {}} width={width} height={height} onEmit={emit('diseases', 'pick')} onReencode={reencode} />
      ),
    },
    {
      id: 'kinds',
      weight: 1.5,
      caption: `Cells by ${kindsField === 'kind' ? 'area kind — states, regions, roll-ups' : noun(kindsField)} (click to select)${kindsField === 'kind' ? '' : capWords(kindsField, kindData.length)}`,
      render: ({ width, height }) => (
        <VizBar viewId="kinds" data={kindData} field={kindsField} selection={selFor('kinds')} columns={columns} fits={desk.fitsOf('kinds')} encoding={shown['kinds'] ?? {}} width={width} height={height} onEmit={emit('kinds', 'select')} onReencode={reencode} />
      ),
    },
    {
      id: 'map',
      weight: 4,
      caption: (
        <>
          {`${diseaseFor('map')} — reported cases per state, summed over kept weeks · a hatched state has no present cell (a silence, never a zero)${noShape.length > 0 ? ` · no shape here, see the table: ${noShape.join(', ')}` : ''}`}
          {desk.words('map')}
        </>
      ),
      render: ({ width, height }): ReactNode =>
        geo === null ? (
          <div role="status" style={{ padding: 12, opacity: 0.7 }}>
            the map shapes have not arrived yet
          </div>
        ) : (
          <VizMap viewId="map" geo={geo} coordinates="planar" regionField="jurisdiction" data={mapData} valueLabel="cases" ariaLabel={desk.altShort('map')} selection={selFor('map')} width={width} height={height} onEmit={emit('map', 'select')} />
        ),
    },
    {
      id: 'weeks',
      weight: 3,
      caption: (
        <>
          {`${noun(weeksY)} per ${weeksX === 't' ? (grain.bucket ?? 'week') : noun(weeksX)}, summed over kept ${kindFor('weeks')}s · ${grain.note ?? ''}`}
          {desk.words('weeks')}
        </>
      ),
      render: ({ width, height }) => (
        <VizLine viewId="weeks" data={weekData} dateField={weeksX} valueField={weeksY} ariaLabel={desk.altShort('weeks')} columns={columns} fits={desk.fitsOf('weeks')} encoding={shown['weeks'] ?? {}} width={width} height={height} onEmit={emit('weeks', 'brush')} onReencode={reencode} />
      ),
    },
    {
      id: 'trend',
      weight: 3,
      caption: `${diseaseFor('trend')} — ${noun(trendY)} per ${areaChosenIn('trend') ? 'kept area' : 'region (the default until you pick a kind or an area)'}, by ${trendX === 't' ? (grain.bucket ?? 'week') : noun(trendX)} — a missing point is a silence, never a zero`,
      render: ({ width, height }) => (
        <VizLine
          viewId="trend"
          data={trendData}
          dateField={trendX}
          valueField={trendY}
          colorOf={colorOfArea}
          columns={columns}
          fits={desk.fitsOf('trend')}
          encoding={shown['trend'] ?? {}}
          xDomain={navigateDomain(selFor('trend'))?.range as readonly [string | null, string | null] | undefined}
          width={width}
          height={height}
          onEmit={emit('trend', 'brush')}
          onReencode={reencode}
        />
      ),
    },
    // The NETWORK: two tables on ONE frame, drawn only where this surface carries
    // the graph. Absent is a real answer (the story page builds its def over the
    // one CSV it was sent), and no cell is honester than an empty one.
    ...(data.nodes === undefined
      ? []
      : [
          {
            id: NETWORK_VIEW,
            // the marks belong to the nodes LAYER, so the desk's ✕ and its clear
            // follow that address and not the frame's id
            clauseId: NETWORK_NODES,
            weight: 4,
            caption: (
              <>
                {netNodes.length === 0
                  ? // the body below is about to say nothing landed; a caption
                    // promising a commit and a hover over it would be two
                    // answers to one question, and the wrong one is the louder
                    `${String((data.nodes ?? []).length)} diseases carried, none placed — no position has landed on this session, so there is nothing to hover`
                  : `${String(netNodes.length)} diseases · ${String(netEdges.length)} of ${String(possibleTies)} possible ties${densityWords}${unplacedWords} · positions from a seeded stress layout landed as a commit, and each link's two ends brought over the declared relations — hover a disease to keep it and its ties bright, click to select`}
                {desk.words(NETWORK_VIEW)}
              </>
            ),
            render: ({ width, height }: { width: number; height: number }): ReactNode =>
              netNodes.length === 0 ? (
                <div role="status" style={{ padding: 12, opacity: 0.7 }}>
                  {data.netRefused ?? 'the layout act has not landed on this session — the nodes carry no x and y yet, so there is nowhere honest to draw them'}
                </div>
              ) : (
                <VizNetwork
                  viewId={NETWORK_VIEW}
                  nodes={netNodes}
                  edges={netEdges}
                  keyField="disease"
                  ariaLabel={desk.altShort(NETWORK_VIEW)}
                  selection={selFor(NETWORK_NODES)}
                  width={width}
                  height={height}
                  onEmit={emit(NETWORK_NODES, 'select')}
                />
              ),
          },
        ]),
    {
      id: 'table',
      weight: 3,
      caption: `${diseaseFor('table')}, week ending ${latestWeek} — the cells as CDC printed them, with their flag (click a row to select)`,
      render: ({ width, height }) => (
        <VizTable viewId="table" data={tableRows} columns={TABLE_COLUMNS(absenceField)} idField="jurisdiction" selection={selFor('table')} width={width} height={height} onEmit={emit('table', 'select')} />
      ),
    },
  ];
}
