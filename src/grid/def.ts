/**
 * THE GRID DASHBOARD DEFINITION — layers 2–4 as data, over EIA's hourly grid.
 *
 * The second demo's whole declaration: the FOUR tables `src/grid/etl.ts`
 * produces, which column of each carries its silence, the two relations that
 * make `links` an edge set pointing at `authorities`, the views and who drives
 * each, the channels a view may rebind, the two analyses that put the graph on
 * a frame, and the multiple-comparison budget. vizfootprint's validator refuses
 * what it cannot enforce.
 *
 * ── Why `hourly` is the default table ───────────────────────────────────────
 * The session's crossfilter, its analyses and its ledger all read ONE table,
 * and the row this dataset is really about is an AUTHORITY IN AN HOUR: what it
 * demanded, what it generated, what it traded, and which of those it actually
 * filed. `authorities` rides beside it as the node table, `links` as the static
 * edge set, `interchange` as the same trade at its finest grain.
 *
 * ── The contrast this demo exists to show ───────────────────────────────────
 * The CDC demo's disease graph is COMPLETE — every pair co-occurs — and the
 * library's reading rule (`graphReadingFor`, two studies named in its own
 * reason) tells that reader to go and read a matrix instead. This graph is
 * sparse: 70 authorities, 157 undirected pairs, about five neighbours each.
 * The same rule, over these counts, prefers the node-link. Neither verdict is
 * written down here — `web/src/gridCells.tsx` counts the marks, asks the rule,
 * and renders what comes back for BOTH graphs side by side.
 *
 * ── One name to know ────────────────────────────────────────────────────────
 * The node's key column is `authority` — EIA's own code, spelled the way
 * `etl.ts` spells it. Everything that points at a node (both relations, the
 * layout's `key`, the network's `key` channel) names that column and no other.
 */
import { layerAddress } from 'vizfootprint/def';
import type { LinkDecl } from 'vizfootprint/def';
import type { AnalysisSlot, DashboardDef, DataSourceDef, RelationDecl, ViewEncodingDecl } from 'vizfootprint/agent';
import type { ProseDecl } from 'vizfootprint/prose';
import type { ActorMeta } from 'vizfootprint/selection';
import { ABSENCE_FIELD, ABSENCE_STATES, PUBLISHED_STATES } from './absence.js';
import type { Absence } from './absence.js';
import type { GridTables } from './etl.js';

const ALPHA = 0.05;

// ── who drives what ───────────────────────────────────────────────────────────

const NET: ActorMeta = { actor: 'user', label: 'The grid, as a network', does: 'hover an authority to light its links, click it to select, shift-click for several, alt-click to select it and every authority it trades with' };
const DEMAND: ActorMeta = { actor: 'user', label: 'Demand, hour by hour', does: 'brush a range of hours to narrow the window' };
const AUTHORITIES: ActorMeta = { actor: 'user', label: 'Authorities by region', does: 'pick a region: NERC\'s own grouping of the balancing authorities' };
// The SHEET: every row the charts see, read through the same link graph as any
// chart — its own clause excluded, the others' applied. Grain [] : one mark per row.
const SHEET: ActorMeta = { actor: 'user', label: 'Sheet', does: 'scroll every hour the charts see, and read the window it is showing' };

/** Every view this def declares. `net` is the frame; its two layers have addresses of their own. */
export const GRID_VIEWS = ['net', 'demand', 'authorities', 'sheet'] as const;

/** The dashboard's DECLARED words — the def's prose entry and the page's fallback read the same constant. */
export const GRID_WORDS = {
  title: 'The US grid, hour by hour',
  caption: 'Three weeks of EIA\'s hourly electric grid: who used power, who made it, and who sent it to whom — with every silence kept as a silence.',
} as const;

// ── the two relations: a link points at an authority, twice ───────────────────

/**
 * Each end of a `links` row points at the `authorities` table's declared key.
 * Two distinct relations, because a directed link has two ends and they are not
 * the same fact: `from_authority` is who sent, `to_authority` is who received.
 * `kind` is left to the default the runtime writes out (`many-to-one`).
 *
 * These are also the PERMISSION the two analyses below run on: the layout reads
 * the ties off a second table, and the bring-over carries columns across, and
 * the library's law is that a relation is what lets one table read another.
 */
export const GRID_RELATIONS: readonly RelationDecl[] = [
  { from: { table: 'links', column: 'from_authority' }, to: { table: 'authorities', column: 'authority' }, label: 'the sending end of the link' },
  { from: { table: 'links', column: 'to_authority' }, to: { table: 'authorities', column: 'authority' }, label: 'the receiving end of the link' },
];

// ── the network view: two tables on one frame ────────────────────────────────

/** The node-link's view id, and the two layers under it — one address each (`net~nodes`, `net~edges`). */
export const NETWORK_VIEW = 'net';
export const NETWORK_NODES_LAYER = 'nodes';
export const NETWORK_EDGES_LAYER = 'edges';

/**
 * The layout's SEED — DATA, never a clock.
 *
 * A seeded layout over the same rows gives byte-identical positions, which is
 * the whole reason a replay can promise the picture a reader saw. Read the
 * clock instead and every reload is a different grid, every screenshot is
 * unreproducible, and the commit that says "positions, seed 19" says nothing.
 * 19 has no meaning beyond being written down.
 */
export const GRID_LAYOUT_SEED = 19;
/**
 * How many SGD passes. The library's default is 30; this graph is sparse and
 * has 70 nodes, so 80 is generous rather than measured. Treat it as a KNOB and
 * not a floor: nobody has benched where this graph settles, and a pass count
 * claimed as a minimum would need a bench that says so.
 */
export const GRID_LAYOUT_ITERATIONS = 80;

/**
 * THE TWO ACTS THAT PUT THE GRID ON A FRAME, declared — so the record of what
 * was done to the positions is in the definition and not in a script.
 *
 * `gridLayout` is a seeded stress layout over `authorities`, reading the ties
 * off `links` (permitted by `GRID_RELATIONS`; a relation is what lets one
 * analysis read a second table). It writes `x` and `y` onto the authorities.
 * `gridEndpoints` then brings those two columns ACROSS the same two relations
 * onto `links`, as `from_authority_x` / `from_authority_y` /
 * `to_authority_x` / `to_authority_y` — one produced column per relation ×
 * name — so an edge knows where BOTH its ends are without a lookup at draw
 * time.
 *
 * WHY declared here and dispatched by the surface rather than computed in the
 * page: a position that is not on the trace is a position a replay cannot
 * promise. Both land as ordinary `analyze` commits, at the top of the log, with
 * the seed they used.
 */
export const GRID_ANALYSES: Readonly<Record<string, AnalysisSlot>> = {
  gridLayout: { builtin: 'layout', algo: 'stress', table: 'authorities', edges: 'links', key: 'authority', from: 'from_authority', to: 'to_authority', seed: GRID_LAYOUT_SEED, iterations: GRID_LAYOUT_ITERATIONS },
  gridEndpoints: { builtin: 'bringOver', table: 'links', from: 'authorities', columns: ['x', 'y'] },
};

/** The four columns `gridEndpoints` writes — named once, so the encoding below and the page agree. */
export const EDGE_POSITION_COLUMNS = { sourceX: 'from_authority_x', sourceY: 'from_authority_y', targetX: 'to_authority_x', targetY: 'to_authority_y' } as const;

/**
 * ONE frame, TWO tables. The edges layer draws under the nodes layer, each over
 * its own table, both against the one pair of scales the chart computes over
 * the union of their positions.
 *
 * The node key needs a channel of its own because `x` and `y` refuse role
 * `identifier` everywhere (one mark per row on an axis is a list, not a chart)
 * and a node's identity IS an identifier — so the `network` kind names a `key`
 * channel that refuses only the roles that are evidence AGAINST an identity.
 */
const NET_ENCODING: ViewEncodingDecl = {
  viewId: NETWORK_VIEW,
  chartKind: 'network',
  channels: ['x', 'y'],
  layers: [
    {
      layerId: NETWORK_EDGES_LAYER,
      table: 'links',
      chartKind: 'network',
      channels: ['source', 'target', 'sourceX', 'sourceY', 'targetX', 'targetY'],
      initial: { source: 'from_authority', target: 'to_authority', sourceX: EDGE_POSITION_COLUMNS.sourceX, sourceY: EDGE_POSITION_COLUMNS.sourceY, targetX: EDGE_POSITION_COLUMNS.targetX, targetY: EDGE_POSITION_COLUMNS.targetY },
      label: 'Directed links',
    },
    { layerId: NETWORK_NODES_LAYER, table: 'authorities', chartKind: 'network', channels: ['x', 'y', 'key'], initial: { x: 'x', y: 'y', key: 'authority' }, label: 'Balancing authorities' },
  ],
};

/** The nodes layer's address — where a click on a circle lands. */
export const NETWORK_NODES_ADDRESS = layerAddress(NETWORK_VIEW, NETWORK_NODES_LAYER);
/** The EDGES layer's address — where a WALK is spoken, because its clause is over that table (either endpoint in the walked set). */
export const NETWORK_EDGES_ADDRESS = layerAddress(NETWORK_VIEW, NETWORK_EDGES_LAYER);

/**
 * Where a WALK reaches, and where it deliberately does not.
 *
 * The walk is spoken on the edges layer (its clause is over `links`: either
 * endpoint in the walked set), and the two things that must be said about it
 * are both routing. The nodes layer MIRRORS it — that is the ego net on screen
 * — and every other view is out of its reach, because a clause naming
 * `from_authority` and `to_authority` has nothing to say about a table of
 * hours. The layers of one frame get no default edge between them, so the
 * mirror has to be declared; the rest have one, so it has to be cut.
 */
function walkLinks(): readonly LinkDecl[] {
  const source = NETWORK_EDGES_ADDRESS;
  const kind = 'neighbourhood' as const;
  return [
    { source, kind, target: NETWORK_NODES_ADDRESS, response: 'mirror', label: 'the walked neighbourhood, lit on the authorities' },
    ...GRID_VIEWS.filter((viewId) => viewId !== NETWORK_VIEW).map((target) => ({
      source,
      kind,
      target,
      response: 'none' as const,
      label: 'a walk is about who trades with whom, and says nothing about an hour',
    })),
  ];
}

/**
 * The network's words, as a function of the TABLES the def was handed — the way
 * the CDC def's are.
 *
 * WHY not a constant: the long description states a fact about the rows (how
 * many pairs of the possible ones are drawn), and `gridDef` accepts any tables.
 * A constant would tell a screen-reader user one density over a graph with
 * another, while the caption beside it counts the real one — so the sighted
 * reader would get the counted truth and the blind reader a hard-coded claim.
 *
 * The basis names `authority` and nothing else: a prose basis is judged against
 * the DEFAULT table, and `from_authority` / `to_authority` live on `links`.
 */
function netProse(tables: GridTables): ProseDecl {
  const nodes = tables.authorities.length;
  const possible = (nodes * (nodes - 1)) / 2;
  const undirected = new Set(tables.links.map((l) => [String(l.from_authority), String(l.to_authority)].sort().join(' '))).size;
  const share = possible === 0 ? 0 : Math.round((undirected / possible) * 1000) / 10;
  return {
    viewId: NETWORK_VIEW,
    slots: {
      title: { text: 'The grid, as a network', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
      altShort: { text: 'A node-link diagram of the US balancing authorities, joined where power flows directly between them.', author: { kind: 'human' }, levels: ['construction'] },
      altLong: {
        text:
          `Every balancing authority is a circle, placed by a seeded stress layout over the links; a line joins two authorities that are directly interconnected. ` +
          `${String(undirected)} of the ${String(possible)} possible pairs are joined — ${String(share)}% — which is what makes this graph a drawing rather than a hairball. ` +
          `Eight of the circles are Canadian and Mexican operators that never report anything themselves; they are named as neighbours and nothing else. ` +
          `Hover an authority to keep it and its links bright.`,
        author: { kind: 'human' },
        levels: ['construction'],
        basis: { columns: ['authority'] },
      },
    },
  };
}

// ── the four tables, declared ────────────────────────────────────────────────

/**
 * The six absence words, on whichever column of a table carries them — and
 * which of those words still hold a NUMBER on that table (`carries`).
 *
 * The library's data door refuses a table that says two things at once: a row
 * whose state column calls it silent and whose value column holds a figure. Two
 * of EIA's words are not silences at all — an `estimated` figure is EIA's own
 * number for an hour nobody filed, and a `replaced` one is the number EIA
 * published beside the number the authority filed — so the tables that use them
 * say so, and the check stops refusing rows that are honest. Default none: a
 * table that names nothing is judged the old way, every word but `present` a
 * silence. `carries` is per TABLE for a reason, and `report_state` is the case:
 * on `interchange` an `unavailable` hour genuinely carries nothing (`mw` is
 * null), while on the folded `links` table the same word leaves the row's own
 * counts standing.
 */
const absenceOn = (field: string, carries?: readonly Absence[]): NonNullable<DataSourceDef['absence']> => ({
  field,
  states: [...ABSENCE_STATES],
  ...(carries === undefined ? {} : { carries: [...carries] }),
});

/** The words that hold a figure besides `present` — read off the states in which a figure EXISTS, so the two lists can never drift. */
const CARRIES: readonly Absence[] = PUBLISHED_STATES.filter((state) => state !== 'present');

function gridSources(tables: GridTables): Record<string, DataSourceDef> {
  return {
    // THE HOURS — the default table. One row per (authority, hour). Every figure
    // appears twice over: what EIA PUBLISHED and what the authority FILED, with a
    // word for the difference. Both are kept, because the two disagreeing is the story.
    hourly: {
      // declared as an (inline) SOURCE so every commit carries the version it was true of
      source: { format: 'rows', via: 'inline', at: tables.hourly },
      // demand_state is the headline word, and `demand` is the figure it speaks for:
      // an estimated or replaced row HAS one, so it is not a silence
      absence: absenceOn(ABSENCE_FIELD, CARRIES),
      columns: {
        authority: { role: 'identifier', label: 'balancing authority' },
        region: { role: 'dimension' },
        t: { role: 'dimension', type: 'date', label: 'hour ending, UTC' }, // an ISO string in the rows; a date to a chart
        hour_index: { role: 'dimension', scale: 'continuous', label: 'hours since 2025-01-01T00:00Z' },
        // a WALL CLOCK with no zone marker: 6 p.m. in Florida and 6 p.m. in Oregon are
        // different instants and the same daily peak, so calling it a date would be a lie
        t_local: { role: 'dimension', label: 'the authority\'s own clock' },
        local_hour: { role: 'dimension', scale: 'continuous', label: 'hour of the local day' },
        demand: { role: 'measure', label: 'demand, MW (as published)' },
        demand_reported: { role: 'measure', label: 'demand, MW (as the authority filed it)' },
        generation: { role: 'measure', label: 'net generation, MW' },
        generation_state: { role: 'dimension', label: 'the word for the generation cell' },
        generation_reported: { role: 'measure', label: 'net generation as filed' },
        interchange: { role: 'measure', label: 'net interchange, MW' },
        interchange_state: { role: 'dimension', label: 'the word for the interchange cell' },
        interchange_reported: { role: 'measure', label: 'net interchange as filed' },
        demand_forecast: { role: 'measure', label: 'the authority\'s day-ahead forecast' },
        dibas_sum: { role: 'measure', label: 'EIA\'s own sum of this hour\'s flows' },
        // EIA's published interchange minus EIA's own sum of the flows. It is often not
        // zero, and that is the fact — never smoothed away.
        interchange_gap: { role: 'measure', label: 'published interchange − summed flows' },
      },
    },
    // THE NODES. `key` is what a relation may point at, and it is EIA's own code.
    authorities: {
      rows: tables.authorities.map((r) => ({ ...r })),
      key: 'authority',
      // NO table-level absence here, deliberately. A table's absence column speaks
      // for the ROW — the library reads a row it calls silent as having no value in
      // any column — and `demand_state` speaks for one FIGURE, `demand`, which lives
      // an hour at a time on `hourly` and not on this table at all. The numbers on
      // this row are observations that stand whatever that word says: an external
      // authority filed 0 hours and has 5 neighbours, both counted, both true. It is
      // still declared an ABSENCE WORD below, so the library's own law still holds it
      // off every magnitude channel — a state is a category, never a number.
      columns: {
        authority: { role: 'identifier', label: 'EIA code' },
        demand_state: { role: 'absence', label: 'whether it ever filed demand — the figure itself is on `hourly`' },
        name: { role: 'dimension', label: 'name (null where the published list has no entry — never the code echoed back)' },
        name_state: { role: 'dimension', label: 'whether the name was found' },
        region: { role: 'dimension' },
        region_name: { role: 'dimension' },
        // `external` is a silence too deep for a cell to carry: eight Canadian and
        // Mexican operators are named as neighbours and file nothing, ever.
        kind: { role: 'dimension', label: 'reporting, or external (named only as a neighbour)' },
        hours: { role: 'measure', label: 'hourly rows filed in the window' },
        first_hour: { role: 'dimension', label: 'the first hour it filed' },
        last_hour: { role: 'dimension', label: 'the last hour it filed' },
        neighbours: { role: 'measure', label: 'authorities it is directly interconnected with' },
      },
    },
    // THE EDGES, DERIVED: one row per directed pair, so no view has to fold
    // 150,000 rows to learn who is connected to whom. It is also where "this link
    // is declared in every hour and never carries a number" lives.
    links: {
      rows: tables.links.map((r) => ({ ...r })),
      // `report_state` speaks for the FLOW, and the flow is `interchange.mw`, an hour
      // at a time. What this folded row carries is counts — how many hours EIA wrote
      // for the pair, how many of them carried a number, the megawatt-hours summed
      // over those — and they are there whatever the word says. So on THIS table
      // `unavailable` carries a value, and says so; on `interchange`, where the word
      // sits beside `mw` itself, it carries nothing and stays a plain silence.
      absence: absenceOn('report_state', ['unavailable']),
      columns: {
        from_authority: { role: 'dimension', label: 'the sender' },
        to_authority: { role: 'dimension', label: 'the receiver' },
        to_kind: { role: 'dimension', label: 'whether the far end reports at all' },
        hours: { role: 'measure', label: 'hours EIA wrote a row for this pair' },
        hours_reported: { role: 'measure', label: 'of those, how many carried a number' },
        first_hour: { role: 'dimension' },
        last_hour: { role: 'dimension' },
        net_mwh: { role: 'measure', label: 'net MWh out of the sender' },
      },
    },
    // THE EDGES AT THEIR FINEST GRAIN: one row per (from, to, hour).
    interchange: {
      rows: tables.interchange.map((r) => ({ ...r })),
      absence: absenceOn('report_state'),
      columns: {
        from_authority: { role: 'dimension' },
        to_authority: { role: 'dimension' },
        t: { role: 'dimension', type: 'date', label: 'hour ending, UTC' },
        hour_index: { role: 'dimension', scale: 'continuous' },
        // positive is a flow OUT of `from_authority`; an exact 0 is a MEASURED zero,
        // which is why `present` and `unavailable` can never be merged
        mw: { role: 'measure', label: 'megawatts out of the sender' },
      },
    },
  };
}

/**
 * The def over the four ETL'd tables.
 *
 * Unlike the CDC def, nothing here is optional: the node table and the edge
 * table come out of the SAME ETL as the hours, so a grid def either has all
 * four or has no data at all.
 */
export function gridDef(tables: GridTables): DashboardDef {
  return {
    meta: { title: 'US grid — vizfootprint on EIA data' },
    data: gridSources(tables),
    relations: GRID_RELATIONS,
    actors: { net: NET, demand: DEMAND, authorities: AUTHORITIES, sheet: SHEET },
    encodings: [
      NET_ENCODING,
      { viewId: 'demand', chartKind: 'line', channels: ['x', 'y', 'color'], initial: { x: 't', y: 'demand' } },
      { viewId: 'authorities', chartKind: 'bar', channels: ['category'], initial: { category: 'region' } },
    ],
    analyses: { ...GRID_ANALYSES },
    // Layer 4 — each view's GRAIN: the group keys its marks stand for ([] = one
    // mark per row). An edge whose source emits over one grain and whose target
    // shows another CROSSES grains and must state its fold, or the def door
    // refuses it with the sentence.
    grains: [
      // the network's marks stand for AUTHORITIES — one circle per node row. The
      // frame's grain is not a layer's (the library gives a layer none: a grain is
      // a VIEW's, judged there).
      { viewId: NETWORK_VIEW, keys: ['authority'] },
      { viewId: 'demand', keys: ['t'] },
      { viewId: 'authorities', keys: ['region'] },
      // the sheet stands for ROWS, not groups: grain [] is one mark per row of `hourly`
      { viewId: 'sheet', keys: [] },
    ],
    // The honest capability envelope. The sheet can emit a point (a row) and a
    // match (a header filter) — never an interval, and never a compound cell. A
    // node-link speaks a point (a node), a match (shift-click) and a
    // NEIGHBOURHOOD (alt-click: the node and everything it trades with) and
    // nothing else. Undeclared, the default gives a view every kind BUT the walk,
    // which is never assumed: nothing about an undeclared view says it has an
    // edge to walk. A capability on the FRAME narrows its layers, so one entry does.
    capabilities: [
      { viewId: 'sheet', canProbe: true, encodings: ['point', 'match'] },
      { viewId: NETWORK_VIEW, canProbe: true, encodings: ['point', 'match', 'neighbourhood'] },
    ],
    // Layer 4 — the LINKS between views, declared. Everything not listed here is
    // the default rule (every view filters every other, self excluded), written
    // out by the library so the matrix shows it. These three are the demo's
    // story, and then the walk's routing.
    links: [
      // pick a circle and the line becomes that authority's own demand curve
      { source: NETWORK_NODES_ADDRESS, kind: 'point', target: 'demand', response: 'filter', fold: 'the picked authority\'s hours, summed per hour', label: 'a node on the network is whose demand the line draws' },
      // a region LIGHTS its authorities rather than dropping the rest: the shape of
      // the grid is the point of the picture, and a network with two thirds of its
      // circles removed is a different graph
      { source: 'authorities', kind: 'point', target: NETWORK_NODES_ADDRESS, response: 'highlight', fold: 'the authorities of the picked region, lit in place', label: 'a region lights its authorities, and never removes the others' },
      // `onClear: 'leave'` — clear the brush and the sheet KEEPS the last window
      // instead of snapping back to 30,746 rows
      { source: 'demand', kind: 'interval', target: 'sheet', response: 'filter', onClear: 'leave', fold: 'the hours inside the brush', label: 'a brush on the line is the sheet\'s window' },
      ...walkLinks(),
    ],
    // The encoding plane's HOUSE RULES, as data — the same sentences refuse a bad
    // initial binding at build, a bad rebind at dispatch, and grey the picker.
    encodingRules: {
      onInvalid: 'refuse',
      ruleScope: 'view',
      rules: [
        { rule: 'never-together', columns: ['demand', 'interchange_gap'], sentence: 'a load and a bookkeeping residue never share a scale ({column} with {other}) — one is megawatts of demand, the other is what EIA\'s two interchange figures differ by' },
        { rule: 'never-on', column: 'hour_index', channels: ['color'], sentence: 'an hour index is a clock, never a hue' },
        { rule: 'only-with', column: 'mw', companion: 'to_authority', sentence: 'a megawatt flow is only meaningful per pair — keep "to_authority" on the chart' },
      ],
    },
    // The PROSE plane: the words two views carry, as records with an author.
    prose: [
      {
        viewId: 'dashboard',
        slots: {
          title: { text: GRID_WORDS.title, author: { kind: 'human', by: 'the dashboard author' } },
          caption: { text: GRID_WORDS.caption, author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
        },
      },
      {
        viewId: 'demand',
        slots: {
          title: { text: 'Demand, hour by hour', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
          altShort: { text: 'A line chart of demand in megawatts per UTC hour, summed over the authorities in view.', author: { kind: 'human' }, levels: ['construction'] },
          // the library writes the construction line itself, every read
          howToRead: { author: { kind: 'derived' } },
        },
      },
      netProse(tables),
    ],
    fdr: { procedure: 'LORD++', alpha: ALPHA },
    defaultTable: 'hourly',
  };
}
