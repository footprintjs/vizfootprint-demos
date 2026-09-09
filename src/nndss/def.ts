/**
 * THE DASHBOARD DEFINITION — layers 2–4 as data.
 *
 * Everything the agent and the cockpit will ever know about this dashboard
 * is declared here: the three ETL'd tables and which column carries the
 * cells' absence state — and, when the committed graph is handed in, the
 * `nodes` / `edges` tables and the two relations that join them; and, when the
 * denominator is handed in, the `population` table, the relation that joins it
 * to the cells, the two acts that derive a rate from it and the bar over that
 * column — the views
 * and who drives each, the visual channels a view may rebind, the analyses
 * that may run, the multiple-comparison budget.
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
import { layerAddress } from 'vizfootprint/def';
import type { LinkDecl } from 'vizfootprint/def';
import type { AnalysisSlot, DashboardDef, DataSourceDef, RelationDecl, ViewEncodingDecl } from 'vizfootprint/agent';
import type { ProseDecl } from 'vizfootprint/prose';
import type { ActorMeta } from 'vizfootprint/selection';
import { NNDSS_ANALYSES } from './analyses.js';
import { POPULATION_ANALYSES, POPULATION_RELATION, POPULATION_TABLE, populationTable, type PopulationRow } from './population.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from './absence.js';
import type { NndssTables } from './etl.js';
import type { NndssGraph } from './graph.js';

const ALPHA = 0.05;

const COVERAGE: ActorMeta = { actor: 'user', label: 'Coverage — which silence is which', does: 'pick a report state: which cells are present, not configured, unavailable or withheld' };
const DISEASES: ActorMeta = { actor: 'user', label: 'Reported cases by disease', does: 'pick a disease to focus the dashboard on it' };
// three kinds, because `JurisdictionKind` has three values: the territories and
// New York City are filed under `state`, the kind CDC files a place individually as
const KINDS: ActorMeta = { actor: 'user', label: 'Cells by area kind', does: 'pick an area kind: a place CDC files individually (state), a census division (region) or a national roll-up (total)' };
const WEEKS: ActorMeta = { actor: 'user', label: 'Reported cases by week', does: 'brush a range of weeks to narrow the time window' };
const TREND: ActorMeta = { actor: 'user', label: 'Trend per area', does: 'follow one area\'s weekly trend' };
const MAP: ActorMeta = { actor: 'user', label: 'Reported cases by state, on the map', does: 'click a state on the map to select it, shift-click for several' };
// the RATE: the one view over the column two acts derived — declared only where the population table is (see `nndssDef`)
// 'reporting jurisdiction', not 'state': the bars include the District of
// Columbia and Puerto Rico, which are a federal district and a territory
const RATE: ActorMeta = { actor: 'user', label: 'Cases per 100,000 people (Census Vintage 2024), by reporting jurisdiction', does: 'pick a jurisdiction by its rate — a bar with no population row is not there, not zero' };
const TABLE: ActorMeta = { actor: 'user', label: 'The cells, as CDC printed them', does: 'pick one row of the table: a jurisdiction and its cells' };
const NET: ActorMeta = { actor: 'user', label: 'Which diseases report together', does: 'hover a disease to light its ties, click it to select, shift-click for several, alt-click to select it and everything it reports with' };
// The SHEET (the data layer's second tab): every row the charts see, read through the same link
// graph as any chart — its own clause excluded, the others' applied. Grain [] : one mark per row.
const SHEET: ActorMeta = { actor: 'user', label: 'Sheet', does: 'scroll every row the charts see, and read the window it is showing' };
const ANALYST: ActorMeta = { actor: 'agent', label: 'Analyst' };

/** The rate view's id — spelled once, because the list below, the def, the cell and the acts' caption all name it. */
export const RATE_VIEW = 'rate';
// every view this def CAN declare — `net` only when a graph is handed in and
// `rate` only when the population is (see `nndssDef`), so the story page's
// def over one CSV declares the other nine.
export const NNDSS_VIEWS = ['coverage', 'diseases', 'kinds', 'map', RATE_VIEW, 'weeks', 'trend', 'table', 'sheet', 'net', 'analyst'] as const;

/** The dashboard's DECLARED words (title + summary) — the def's prose entry and the story's fallback read the same constant. */
export const DASHBOARD_WORDS = {
  title: 'NNDSS weekly desk',
  caption: "Reported cases by disease, area and week from the CDC's NNDSS tables, with every silence kept as a silence.",
} as const;

/**
 * The graph's two edges on the MAP: each end of an edge row points at a disease — the
 * `nodes` table's declared key (the library's law: a relation points at an identity).
 * Two distinct edges (source → disease, target → disease), `kind` left to the default
 * the runtime writes out. Data the overview echoes; nothing in the session acts on it yet.
 */
export const GRAPH_RELATIONS: readonly RelationDecl[] = [
  { from: { table: 'edges', column: 'source' }, to: { table: 'nodes', column: 'disease' }, label: 'one end of the pair' },
  { from: { table: 'edges', column: 'target' }, to: { table: 'nodes', column: 'disease' }, label: 'the other end of the pair' },
];

// ── the network view: two tables on one frame ────────────────────────────────

/** The node-link's view id, and the two layers under it — one address each (`net~nodes`, `net~edges`). */
export const NETWORK_VIEW = 'net';
export const NETWORK_NODES_LAYER = 'nodes';
export const NETWORK_EDGES_LAYER = 'edges';

/**
 * The layout's SEED and its pass count — data, never a clock. The same seed over
 * the same rows gives byte-identical positions, which is what makes the picture
 * on screen a thing a replay can promise.
 */
export const GRAPH_LAYOUT_SEED = 7;
// 60 passes is the library's default (30) doubled. Nobody has measured where
// THIS graph settles, so treat it as a knob and not a floor: if a pass count is
// ever claimed to be a minimum, it needs a bench that says so.
export const GRAPH_LAYOUT_ITERATIONS = 60;

/**
 * The two acts that put the graph on a frame, DECLARED — so the record of what
 * was done to the positions is in the definition, not in a script.
 *
 * `graphLayout` is a seeded stress layout over the nodes table, reading the
 * ties off `edges` (the permission is `GRAPH_RELATIONS` — a relation is what
 * lets one analysis read a second table). It writes `x` and `y` onto the nodes
 * table at the act's own slot. `graphEndpoints` then brings those two columns
 * ACROSS the same relations onto the edges table, as `source_x` / `source_y` /
 * `target_x` / `target_y`, so a link knows where both its ends are without a
 * lookup at draw time.
 *
 * WHY they are declared here and dispatched by the surface rather than computed
 * in the page: a position that is not on the trace is a position a replay
 * cannot promise. Both land as ordinary `analyze` commits, at the top of the
 * log, with the seed they used — a reader can see where every coordinate on
 * screen came from, and a replay rebuilds them from the record's bytes.
 */
export const GRAPH_ANALYSES: Readonly<Record<string, AnalysisSlot>> = {
  graphLayout: { builtin: 'layout', algo: 'stress', table: 'nodes', edges: 'edges', key: 'disease', from: 'source', to: 'target', seed: GRAPH_LAYOUT_SEED, iterations: GRAPH_LAYOUT_ITERATIONS },
  graphEndpoints: { builtin: 'bringOver', table: 'edges', from: 'nodes', columns: ['x', 'y'] },
};

/**
 * ONE frame, TWO tables. The edges layer draws under the nodes layer, each over
 * its own table, both against the one pair of scales the chart computes over
 * the union of their positions.
 *
 * WHY the node key needs a channel of its own: `x` and `y` refuse role
 * `identifier` everywhere (one mark per row on an axis is a list, not a chart),
 * and a node's identity IS an identifier — so the `network` kind names a `key`
 * channel of its own — one that refuses only the roles that are evidence AGAINST
 * an identity (a measure, the silence). The edge layer binds the four columns
 * `graphEndpoints` wrote, plus the two endpoint names a hover reads.
 */
const NET_ENCODING: ViewEncodingDecl = {
  viewId: NETWORK_VIEW,
  chartKind: 'network',
  channels: ['x', 'y'],
  layers: [
    { layerId: NETWORK_EDGES_LAYER, table: 'edges', chartKind: 'network', channels: ['source', 'target', 'sourceX', 'sourceY', 'targetX', 'targetY'], initial: { source: 'source', target: 'target', sourceX: 'source_x', sourceY: 'source_y', targetX: 'target_x', targetY: 'target_y' }, label: 'Co-occurrences' },
    { layerId: NETWORK_NODES_LAYER, table: 'nodes', chartKind: 'network', channels: ['x', 'y', 'key'], initial: { x: 'x', y: 'y', key: 'disease' }, label: 'Diseases' },
  ],
};

/**
 * Where a WALK reaches, and where it deliberately does not.
 *
 * The walk is spoken on the edges layer (its clause is over that table: either
 * endpoint in the walked set), and the two things that must be said about it are
 * both routing: the nodes layer MIRRORS it — that is the ego net on screen — and
 * every other view is out of its reach, because a clause naming `source` and
 * `target` has nothing to say about a table of CDC cells. The layers of one
 * frame get no default edge between them (`vizfootprint/links`, `sharesFrame`),
 * so the mirror has to be declared; the rest have one, so it has to be cut.
 *
 * `views` is what THIS def declared, not `NNDSS_VIEWS`: a link into a view the
 * def did not declare (the rate view on a def with no population) is exactly
 * what the def door refuses, and the cut is owed only to views that exist.
 */
function walkLinks(views: readonly string[]): readonly LinkDecl[] {
  const source = layerAddress(NETWORK_VIEW, NETWORK_EDGES_LAYER);
  const kind = 'neighbourhood' as const;
  return [
    { source, kind, target: layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER), response: 'mirror', label: 'the walked neighbourhood, lit on the nodes' },
    ...views.filter((viewId) => viewId !== NETWORK_VIEW).map((target) => ({
      source,
      kind,
      target,
      response: 'none' as const,
      label: 'a walk is about the ties, and says nothing about the cells',
    })),
  ];
}

/**
 * The network's words, as a function of the GRAPH the def was handed — the way
 * `graphTables(graph)` already is.
 *
 * WHY not a constant: the long description states a fact about the rows ("every
 * pair co-occurs"), and `nndssDef` accepts any graph. A constant would tell a
 * screen-reader user the graph is complete over a graph that is not, and the
 * caption beside it COUNTS the same density (web/src/cells.tsx) — so the sighted
 * reader would get the counted truth and the blind reader a hard-coded claim.
 *
 * The basis names `disease` and nothing else: a prose basis is judged against
 * the DEFAULT table, and `source`, `target` and `weight` live on `edges`.
 */
function netProse(graph: NndssGraph): ProseDecl {
  const possible = (graph.nodes.length * (graph.nodes.length - 1)) / 2;
  const density =
    graph.edges.length === possible
      ? 'Every pair in this snapshot co-occurs at least once, so the graph is complete and the drawing is a hairball: the weights are legible as a matrix (source by target, shaded by jurisdiction-weeks) and not as lines.'
      : `${String(graph.edges.length)} of the ${String(possible)} possible ties are drawn; the weights are also legible as a matrix (source by target, shaded by jurisdiction-weeks).`;
  return {
    viewId: NETWORK_VIEW,
    slots: {
      title: { text: 'Which diseases report together', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
      altShort: { text: 'A node-link diagram of the diseases, joined where both reported cases in the same state and week.', author: { kind: 'human' }, levels: ['construction'] },
      altLong: {
        text: `Every disease is a circle, placed by a seeded stress layout over the co-occurrence ties; a line joins two diseases that both reported cases in at least one state-week. ${density} Hover a disease to keep it and its ties bright.`,
        author: { kind: 'human' },
        levels: ['construction'],
        basis: { columns: ['disease'] },
      },
    },
  };
}

/** The graph's two tables as the def declares them — inline rows the node half read off the committed CSVs, with their facets. */
function graphTables(graph: NndssGraph): Readonly<Record<'nodes' | 'edges', DataSourceDef>> {
  return {
    nodes: {
      rows: graph.nodes,
      key: 'disease', // the row identity a relation may point at
      columns: {
        disease: { role: 'identifier' },
        // the figures are over the LEAF reporting areas only (graph.ts `GRAPH_KINDS`): a region or total row is CDC's sum of these, never added again
        cases_total: { role: 'measure', label: 'cases, every week, leaf areas only' },
        jurisdictions_reporting: { role: 'measure', label: 'leaf areas reporting cases' },
        weeks_reporting: { role: 'measure', label: 'weeks with cases' },
      },
    },
    edges: {
      rows: graph.edges,
      columns: {
        source: { role: 'dimension', label: 'disease' },
        target: { role: 'dimension', label: 'the other disease' },
        weight: { role: 'measure', label: 'jurisdiction-weeks where both report' },
        jurisdictions: { role: 'measure', label: 'leaf areas where both report' },
      },
    },
  };
}

/**
 * The relations this def declares, from the two OPTIONAL tables that carry
 * them: the graph's two edges onto the diseases, and the cells' one edge onto
 * the population.
 *
 * WHY one function rather than two spreads: `relations` is a LIST, and a def
 * that spread two of them would keep only the second — the exact quiet bug a
 * reader would not see. Empty stays absent, because a def that declares an
 * empty list of relations is saying something it does not mean.
 */
function relationsOf(graph: NndssGraph | undefined, population: readonly PopulationRow[] | undefined): RelationDecl[] {
  return [...(graph === undefined ? [] : GRAPH_RELATIONS), ...(population === undefined ? [] : [POPULATION_RELATION])];
}

/**
 * The def over the three ETL'd tables — and over each OPTIONAL table a caller
 * hands in: the graph's `nodes` / `edges`, joined by `GRAPH_RELATIONS`, and the
 * `population` denominator, joined by `POPULATION_RELATION`.
 *
 * WHY both are optional: the story page builds this def in a browser over the
 * ONE CSV it carries (`web/story/entry.tsx`) — no graph and no denominator —
 * and each missing table takes its own declarations with it rather than leaving
 * a table with no rows. So a def built with neither declares the three ETL'd
 * tables and no relations; the node and http doors load both beside the
 * snapshot, and that def declares six tables and three relations.
 */
export function nndssDef(tables: NndssTables, graph?: NndssGraph): DashboardDef {
  const absence = { field: ABSENCE_FIELD, states: [...ABSENCE_STATES] };
  // WHY an EMPTY table is narrowed to `undefined` here rather than tested for
  // at four gates: the question every gate below asks is "is there a
  // denominator", and a zero-row table answers yes to `!== undefined`. A
  // regenerated file whose every row was dropped would declare the table, the
  // relation, both acts and the bar — a rate view with nothing under it, which
  // is what the sentence below promises never to declare.
  const population = tables.population === undefined || tables.population.length === 0 ? undefined : tables.population;
  const relations = relationsOf(graph, population);
  const hasPopulation = population !== undefined;
  // WHY the network's four declarations are all gated on the graph, and the
  // rate's on the population — two different laws, not one borrowed twice. The
  // network's layers read `nodes` and `edges`, and a view over a table this def
  // did not declare is what the def door refuses. The rate bar reads
  // `cases_per_100k` on `cells`, a column two acts can only land when a
  // `population` table is there to carry a denominator across. No graph, no
  // view; no denominator, no rate — never a view with nothing under it.
  const actors = { coverage: COVERAGE, diseases: DISEASES, kinds: KINDS, map: MAP, ...(hasPopulation ? { [RATE_VIEW]: RATE } : {}), weeks: WEEKS, trend: TREND, table: TABLE, sheet: SHEET, ...(graph === undefined ? {} : { net: NET }), analyst: ANALYST };
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
      // the disease co-occurrence graph (data/nndss/graph): nodes keyed by disease, edges pointing at them
      ...(graph === undefined ? {} : graphTables(graph)),
      // the denominator (data/population): one row per place, keyed by the name
      // CDC files it under, so a rate can be a declared column and not a lookup
      ...(population === undefined ? {} : { [POPULATION_TABLE]: populationTable(population) }),
    },
    ...(relations.length === 0 ? {} : { relations }),
    actors,
    encodings: [
      { viewId: 'coverage', chartKind: 'bar', channels: ['category'], initial: { category: ABSENCE_FIELD } },
      { viewId: 'diseases', chartKind: 'bar', channels: ['category'], initial: { category: 'disease' } },
      { viewId: 'kinds', chartKind: 'bar', channels: ['category'], initial: { category: 'kind' } },
      // one bar per place; the height is the derived column, summed by the host over the kept weeks
      ...(hasPopulation ? [{ viewId: RATE_VIEW, chartKind: 'bar', channels: ['category'], initial: { category: 'jurisdiction' } }] : []),
      { viewId: 'weeks', chartKind: 'line', channels: ['x', 'y', 'color'], initial: { x: 't', y: 'cases' } },
      { viewId: 'trend', chartKind: 'line', channels: ['x', 'y', 'color', 'facet'], initial: { x: 't', y: 'value', color: 'entity' } },
      ...(graph === undefined ? [] : [NET_ENCODING]),
    ],
    analyses: {
      ...NNDSS_ANALYSES,
      ...(graph === undefined ? {} : GRAPH_ANALYSES),
      // gated on the table for the same reason the network's four are gated on
      // the graph: an act over a table this def did not declare is what the door
      // refuses, and a refusal at boot is worse than an act nobody declared
      ...(population === undefined ? {} : POPULATION_ANALYSES),
    },
    // Layer 4 — each view's GRAIN: the group keys its marks stand for ([] = one mark per row). An edge whose
    // source emits over one grain and whose target shows another CROSSES grains and must state its fold,
    // or the def door refuses it with the sentence; the default rule's crossing edges carry `crossfilter`.
    grains: [
      { viewId: 'coverage', keys: ['report_state'] },
      { viewId: 'diseases', keys: ['disease'] },
      { viewId: 'kinds', keys: ['kind'] },
      { viewId: 'map', keys: ['jurisdiction'] },
      // the rate's marks stand for PLACES, the map's grain — a bar per jurisdiction
      ...(hasPopulation ? [{ viewId: RATE_VIEW, keys: ['jurisdiction'] }] : []),
      { viewId: 'weeks', keys: ['t'] },
      { viewId: 'trend', keys: ['t', 'entity'] },
      { viewId: 'table', keys: ['jurisdiction'] },
      // the sheet stands for ROWS, not groups: grain [] is one mark per row of `cells`
      { viewId: 'sheet', keys: [] },
      // the network's marks stand for DISEASES — one circle per node row — so an
      // edge from a per-cell view into it crosses grains and names its fold.
      // Gated with the actor: `validateGrains` refuses a grain on a view the def
      // did not declare, and the frame's grain is not a layer's (the library
      // gives a layer none: a grain is a VIEW's, judged there).
      ...(graph === undefined ? [] : [{ viewId: NETWORK_VIEW, keys: ['disease'] }]),
    ],
    // The sheet's honest capability envelope: it can emit a point (a row) and a match
    // (a header filter, when that lands) — never an interval, and never the compound cell.
    // …and the network's: a node-link speaks a point (a node), a match
    // (shift-click, SET-1) and a NEIGHBOURHOOD (alt-click: the node and
    // everything it links to) and nothing else — it cannot brush an interval and
    // has no compound cell to emit. Undeclared, R14's default gives it every kind
    // BUT the walk, which is never assumed (`vizfootprint/links`, voice.ts):
    // nothing about an undeclared view says it has an edge to walk, so a
    // node-link that does must say so. A capability on the FRAME narrows its
    // layers, so one entry is enough.
    capabilities: [
      { viewId: 'sheet', canProbe: true, encodings: ['point', 'match'] },
      ...(graph === undefined ? [] : [{ viewId: NETWORK_VIEW, canProbe: true, encodings: ['point', 'match', 'neighbourhood'] as const }]),
    ],
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
      // THE WALK'S ROUTING, declared because the default rule cannot know it. A
      // neighbourhood clause names the EDGES table's two endpoint columns
      // (`source`, `target`) — columns no other table here has — so the default
      // "every view filters every other" would send it at the cells views and
      // every one of their windows would be refused for a column that was never
      // theirs. It reaches exactly one place, and it MIRRORS there: the nodes
      // layer lights the ego net the walk recorded (the answer is on the commit,
      // so time travel shows the set that walk found, not today's).
      ...(graph === undefined ? [] : walkLinks(Object.keys(actors))),
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
      // the RATE's words, because the one number on this desk that is a
      // DIVISION must carry its period and its denominator wherever it is read,
      // and a React caption travels with neither the def nor an export
      ...(hasPopulation
        ? [{
            viewId: RATE_VIEW,
            slots: {
              title: { text: 'Cases per 100,000 people, by reporting jurisdiction', author: { kind: 'human' as const, by: 'the dashboard author' }, levels: ['construction' as const] },
              altShort: { text: 'A bar chart of reported cases per 100,000 people for the selected disease, one bar per jurisdiction that has a population estimate.', author: { kind: 'human' as const }, levels: ['construction' as const] },
              altLong: {
                text: "Cases for the selected disease, summed over the weeks kept in view, divided by the U.S. Census Bureau's Vintage 2024 estimate (as of July 1, 2024) for that place, times 100,000. With no week filter this is a cumulative rate over every MMWR week in the snapshot — 2025 and 2026 — and never an annual incidence rate; the denominator is one 2024 estimate for both case years, because no later vintage was published when the file was fetched. A jurisdiction with no estimate has no bar at all: a silence, never a zero. A bar built on a handful of cases is unstable, so read it with its case count from the table beside it.",
                author: { kind: 'human' as const },
                levels: ['construction' as const],
                // the basis names DECLARED columns of the default table: `cases_per_100k`
                // and `jurisdiction_population` are landed by acts, not declared here
                basis: { columns: ['jurisdiction', 'cases'] },
              },
            },
          }]
        : []),
      ...(graph === undefined ? [] : [netProse(graph)]),
    ],
    fdr: { procedure: 'LORD++', alpha: ALPHA },
    defaultTable: 'cells',
  };
}
