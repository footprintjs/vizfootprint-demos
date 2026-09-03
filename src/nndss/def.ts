/**
 * THE DASHBOARD DEFINITION — layers 2–4 as data.
 *
 * Everything the agent and the cockpit will ever know about this dashboard
 * is declared here: the three tables and which column carries each one's
 * absence state, the views and who drives each, the visual channels a view
 * may rebind, the analyses that may run, the multiple-comparison budget.
 * vizfootprint's validator refuses what it cannot enforce.
 *
 * ── Why `cells` is the default table ────────────────────────────────────────
 * The session's crossfilter, analyses and ledger read ONE table. The one
 * whose rows are the thing being counted is CDC's own cell — an area, a
 * disease, a week. `series` rides beside it for the trend line (every
 * present cell, with its area's kind) and `jurisdictions` for the map,
 * narrowed on the host by the same words a click on the cells views produces.
 *
 * ── The interconnection this demo is about ─────────────────────────────────
 * The disease bar DRIVES the trend line and the heat grid: pick a disease
 * and every other view narrows to it. Today that wiring is the library's
 * implicit crossfilter (every view filters every other, self excluded),
 * named as such in the Grammar panel; when declared links land it becomes
 * a matrix a person can read.
 */
import type { DashboardDef } from 'vizfootprint/agent';
import type { ActorMeta } from 'vizfootprint/mosaic';
import { NNDSS_ANALYSES } from './analyses.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from './absence.js';
import type { NndssTables } from './etl.js';

const ALPHA = 0.05;

const COVERAGE: ActorMeta = { actor: 'user', label: 'Coverage — which silence is which', does: 'pick a report state: which cells are present, not configured, unavailable or withheld' };
const DISEASES: ActorMeta = { actor: 'user', label: 'Reported cases by disease', does: 'pick a disease to focus the dashboard on it' };
const KINDS: ActorMeta = { actor: 'user', label: 'Cells by area kind', does: 'pick an area kind: states, regions, territories or the nation' };
const WEEKS: ActorMeta = { actor: 'user', label: 'Reported cases by week', does: 'brush a range of weeks to narrow the time window' };
const TREND: ActorMeta = { actor: 'user', label: 'Trend per area', does: 'follow one area\'s weekly trend' };
const MAP: ActorMeta = { actor: 'user', label: 'Reported cases by state, on the map', does: 'click a state on the map to select it, shift-click for several' };
const TABLE: ActorMeta = { actor: 'user', label: 'The cells, as CDC printed them', does: 'pick one row of the table: a jurisdiction and its cells' };
// The SHEET (the data layer's second tab): every row the charts see, read through the same link
// graph as any chart — its own clause excluded, the others' applied. Grain [] : one mark per row.
const SHEET: ActorMeta = { actor: 'user', label: 'Sheet', does: 'scroll every row the charts see, and read the window it is showing' };
const ANALYST: ActorMeta = { actor: 'agent', label: 'Analyst' };

export const NNDSS_VIEWS = ['coverage', 'diseases', 'kinds', 'map', 'weeks', 'trend', 'table', 'sheet', 'analyst'] as const;

/** The dashboard's DECLARED words (title + summary) — the def's prose entry and the story's fallback read the same constant. */
export const DASHBOARD_WORDS = {
  title: 'NNDSS weekly desk',
  caption: "Reported cases by disease, area and week from the CDC's NNDSS tables, with every silence kept as a silence.",
} as const;

export function nndssDef(tables: NndssTables): DashboardDef {
  const absence = { field: ABSENCE_FIELD, states: [...ABSENCE_STATES] };
  return {
    meta: { title: 'NNDSS weekly — vizfootprint on CDC data' },
    data: {
      // The encoding plane's FACETS, stated: what each column IS to a chart. The absence
      // column's role is derived from `absence`; every other role is declared here or absent.
      cells: {
        // declared as an (inline) SOURCE so every commit carries the version it was true of — the same rows `rows:` would carry
        source: { format: 'rows', via: 'inline', at: tables.cells },
        absence,
        columns: {
          jurisdiction: { role: 'identifier', label: 'jurisdiction' },
          disease: { role: 'dimension' },
          kind: { role: 'dimension', label: 'area kind' },
          cases: { role: 'measure', label: 'cases this week' },
          ytd: { role: 'measure', label: 'year to date' },
          prev52_max: { role: 'measure', label: 'previous 52-week maximum' },
          week_index: { role: 'dimension', scale: 'continuous', label: 'week of the year' },
          t: { role: 'dimension', type: 'date', label: 'week' }, // an ISO string in the rows; a date to a chart
        },
      },
      jurisdictions: { rows: tables.jurisdictions, columns: { jurisdiction: { role: 'identifier' }, kind: { role: 'dimension' } } },
      // no absence on `series`: a row that exists is present by construction
      series: {
        rows: tables.series.map((p) => ({ ...p })),
        grain: tables.grain,
        columns: { t: { role: 'dimension', type: 'date' }, entity: { role: 'dimension' }, metric: { role: 'dimension' }, value: { role: 'measure' }, entity_kind: { role: 'dimension' } },
      },
    },
    actors: { coverage: COVERAGE, diseases: DISEASES, kinds: KINDS, map: MAP, weeks: WEEKS, trend: TREND, table: TABLE, sheet: SHEET, analyst: ANALYST },
    encodings: [
      { viewId: 'coverage', chartKind: 'bar', channels: ['category'], initial: { category: ABSENCE_FIELD } },
      { viewId: 'diseases', chartKind: 'bar', channels: ['category'], initial: { category: 'disease' } },
      { viewId: 'kinds', chartKind: 'bar', channels: ['category'], initial: { category: 'kind' } },
      { viewId: 'weeks', chartKind: 'line', channels: ['x', 'y', 'color'], initial: { x: 't', y: 'cases' } },
      { viewId: 'trend', chartKind: 'line', channels: ['x', 'y', 'color', 'facet'], initial: { x: 't', y: 'value', color: 'entity' } },
    ],
    analyses: NNDSS_ANALYSES,
    // Layer 4 — each view's GRAIN: the group keys its marks stand for ([] = one mark per row). An edge whose
    // source emits over one grain and whose target shows another CROSSES grains and must state its fold,
    // or the def door refuses it with the sentence; the default rule's crossing edges carry `crossfilter`.
    grains: [
      { viewId: 'coverage', keys: ['report_state'] },
      { viewId: 'diseases', keys: ['disease'] },
      { viewId: 'kinds', keys: ['kind'] },
      { viewId: 'map', keys: ['jurisdiction'] },
      { viewId: 'weeks', keys: ['t'] },
      { viewId: 'trend', keys: ['t', 'entity'] },
      { viewId: 'table', keys: ['jurisdiction'] },
      // the sheet stands for ROWS, not groups: grain [] is one mark per row of `cells`
      { viewId: 'sheet', keys: [] },
    ],
    // The sheet's honest capability envelope: it can emit a point (a row) and a match
    // (a header filter, when that lands) — never an interval, and never the compound cell.
    capabilities: [{ viewId: 'sheet', canProbe: true, encodings: ['point', 'match'] }],
    // Layer 4 — the LINKS between views, declared. Everything not listed here is the default
    // rule (every view filters every other, self excluded), written out by the library so the
    // matrix shows it. These four are the demo's story: the map LIGHTS the disease bar instead of
    // dropping diseases, a week brush MOVES the trend's window instead of filtering it, the map
    // MIRRORS its state into the table, and a table row deliberately does NOT reach the bar.
    links: [
      { source: 'map', kind: 'point', target: 'diseases', response: 'highlight', fold: 'cases of the lit states, summed per disease', label: 'the map lights the bar' },
      { source: 'map', kind: 'match', target: 'diseases', response: 'highlight', fold: 'cases of the lit states, summed per disease' },
      // `onClear: 'leave'` — when the week brush is cleared, the trend KEEPS the last window instead of snapping back
      { source: 'weeks', kind: 'interval', target: 'trend', response: 'navigate', onClear: 'leave', label: 'a week brush is the trend\'s window' },
      { source: 'map', kind: 'point', target: 'table', response: 'mirror', label: 'the same state, outlined' },
      { source: 'table', kind: 'point', target: 'diseases', response: 'none', label: 'a row never narrows the bar' },
      // an ENCODING edge: when the weekly line takes a color, the trend follows it (one hop, read through, never
      // landed for the trend) — into its FACET, where it is lawful, and into its COLOR, where the trend's own rule
      // ("a series value is only meaningful per entity") refuses it with that sentence and the trend keeps `entity`.
      // The weekly line starts with no color, so nothing follows until someone binds one: bind weeks.color to `kind`
      // (the picker or the analyst) and the Grammar panel shows both the follow and the refusal on the trend.
      {
        source: 'weeks',
        kind: 'encoding',
        target: 'trend',
        response: 'follow',
        channels: [
          { from: 'color', to: 'facet' },
          { from: 'color', to: 'color' },
        ],
        label: 'the trend follows the weekly line\'s hue — as a facet, and (refused) as its color',
      },
    ],
    // The encoding plane's HOUSE RULES, as data — the same sentences refuse a bad initial binding
    // at build, a bad rebind at dispatch (human picker or analyst tool), and grey the picker.
    encodingRules: {
      onInvalid: 'refuse',
      ruleScope: 'view',
      rules: [
        { rule: 'never-together', columns: ['cases', 'ytd'], sentence: 'a week\'s count and a year-to-date total never share a chart ({column} with {other})' },
        { rule: 'never-on', column: 'ytd', channels: ['color'], sentence: 'a year-to-date total is never a hue' },
        { rule: 'only-with', column: 'value', companion: 'entity', sentence: 'a series value is only meaningful per entity — keep "entity" on the chart' },
      ],
    },
    // The PROSE plane: the words two views carry, as records with an author. The map's long alt is the W3C's
    // two-part shape (a short alt that identifies the chart, a long description that carries the data), in the
    // CDC's own wording; the weekly line's `howToRead` is derived — the library writes the construction line itself, every
    // read (the map declares no encoding surface, so it has nothing to derive from).
    prose: [
      // The DASHBOARD's own words: the cockpit's title and its one-line summary (the caption). The summary is the
      // analyst's to keep fresh — when a selection moves it stale, the analyst proposes a new one for a person to accept.
      {
        viewId: 'dashboard',
        slots: {
          title: { text: DASHBOARD_WORDS.title, author: { kind: 'human', by: 'the dashboard author' } },
          caption: { text: DASHBOARD_WORDS.caption, author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
        },
      },
      {
        viewId: 'map',
        slots: {
          title: { text: 'Reported cases by state, this week', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
          altShort: { text: 'A map of the United States shaded by the number of reported cases in each state for the selected disease.', author: { kind: 'human' }, levels: ['construction'] },
          altLong: {
            text: 'Each state is shaded by its reported case count for the selected disease, summed over the weeks kept in view. A hatched state reported no present cell: a silence, never a zero. Territories and cities without a shape on the map are listed in the table instead.',
            author: { kind: 'human' },
            levels: ['construction'],
            // the map declares no encoding surface, so its basis names the columns it reads, not bindings
            basis: { columns: ['jurisdiction', 'cases', ABSENCE_FIELD] },
          },
        },
      },
      {
        viewId: 'weeks',
        slots: {
          title: { text: 'Reported cases per MMWR week', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
          altShort: { text: 'A line chart of reported cases by MMWR week for the selected disease, summed over the kept areas.', author: { kind: 'human' }, levels: ['construction'] },
          howToRead: { author: { kind: 'derived' } },
        },
      },
    ],
    fdr: { procedure: 'LORD++', alpha: ALPHA },
    defaultTable: 'cells',
  };
}
