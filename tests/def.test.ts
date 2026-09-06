/**
 * The encoding plane on the CDC def: the roles and house rules are data the
 * library reads at build, at dispatch, and in the picker — one sentence each.
 */
import { describe, expect, it } from 'vitest';
import { buildDashboard, parseDashboardDef, validateDashboardDef } from 'vizfootprint/def';
import type { Cause } from 'vizfootprint/cause';
import { GRAPH_RELATIONS, nndssDef } from '../src/nndss/def.js';
import type { NndssTables } from '../src/nndss/etl.js';
import type { NndssGraph } from '../src/nndss/graph.js';

/** A graph small enough to read: two nodes, one edge — the def declares the tables, not the rows' truth. */
const graph: NndssGraph = {
  nodes: [
    { disease: 'Measles', cases_total: 3, jurisdictions_reporting: 1, weeks_reporting: 1 },
    { disease: 'Mumps', cases_total: 1, jurisdictions_reporting: 1, weeks_reporting: 1 },
  ],
  edges: [{ source: 'Measles', target: 'Mumps', weight: 1, jurisdictions: 1 }],
};

const tables = {
  cells: [
    { jurisdiction: 'Texas', kind: 'state', disease: 'Measles', cases: 3, report_state: 'present', flag: null, ytd: 30, prev52_max: 9, t: '2026-01-04', week_index: 1 },
    { jurisdiction: 'Ohio', kind: 'state', disease: 'Measles', cases: 0, report_state: 'unavailable', flag: 'N', ytd: 0, prev52_max: 2, t: '2026-01-04', week_index: 1 },
  ] as unknown as NndssTables['cells'],
  jurisdictions: [{ jurisdiction: 'Texas', kind: 'state', lat: 31, lon: -99 }] as unknown as NndssTables['jurisdictions'],
  series: [{ t: '2026-01-04', entity: 'Texas', metric: 'cases', value: 3, entity_kind: 'state', week_index: 1 }] as unknown as NndssTables['series'],
  grain: { bucket: 'week', reducer: 'sum' },
} as unknown as NndssTables; // the def reads cells/jurisdictions/series/grain; the derived tables are the surface's business
const userCause = (intent: string): Cause => ({ requestedBy: 'user', computedBy: 'user', intent });

describe('the def carries the encoding plane', () => {
  it('builds, and states three house rules beside the built-in absence law', async () => {
    const def = nndssDef(tables);
    expect(validateDashboardDef(def)).toEqual([]);
    const s = buildDashboard(def).createSession();
    const o = await s.overview();
    expect(o.rules.map((r) => r.id)).toEqual(['absence-never-magnitude', 'never-together#0', 'never-on#1', 'only-with#2']);
    expect(o.encodingPolicy).toEqual({ onInvalid: 'refuse', ruleScope: 'view' });
    const cells = o.columns['cells']!;
    expect(cells.find((c) => c.field === 'jurisdiction')).toMatchObject({ role: 'identifier', scale: 'discrete' });
    expect(cells.find((c) => c.field === 'report_state')).toMatchObject({ role: 'absence' });
    expect(cells.find((c) => c.field === 'ytd')).toMatchObject({ role: 'measure', label: 'year to date' });
  });
  it('refuses at dispatch with the house sentence, and the picker verdicts say the same', async () => {
    const s = buildDashboard(nndssDef(tables)).createSession();
    // every law that the resulting chart would break, the house rules first, the shape last
    const ytdColor = await s.dispatch({ verb: 'reencode', viewId: 'weeks', channel: 'color', field: 'ytd', cause: userCause('color by ytd') });
    expect(!ytdColor.ok && ytdColor.rejection.detail).toBe(
      "a week's count and a year-to-date total never share a chart (ytd with cases); a year-to-date total is never a hue; \"ytd\" is continuous; the color channel of a line needs a discrete column",
    );
    const pair = await s.dispatch({ verb: 'reencode', viewId: 'weeks', channel: 'x', field: 'ytd', cause: userCause('ytd on x') });
    expect(!pair.ok && pair.rejection.detail).toBe("a week's count and a year-to-date total never share a chart (ytd with cases)");
    const idOnY = await s.dispatch({ verb: 'reencode', viewId: 'weeks', channel: 'y', field: 'jurisdiction', cause: userCause('') });
    expect(!idOnY.ok && idOnY.rejection.detail).toContain('is string; the y channel of a line needs a number');
    const absence = await s.dispatch({ verb: 'reencode', viewId: 'weeks', channel: 'y', field: 'report_state', cause: userCause('') });
    expect(!absence.ok && absence.rejection.detail).toContain('absence is a category, never a magnitude');
    const weeks = (await s.overview()).views.find((v) => v.viewId === 'weeks')!;
    // `because` carries the FIRST refusing sentence — the house rule, before the shape
    expect(weeks.fits!['color']!.find((f) => f.field === 'ytd')!.because).toBe("a week's count and a year-to-date total never share a chart (ytd with cases)");
    const yOk = weeks.fits!['y']!.filter((f) => f.ok).map((f) => f.field);
    expect(yOk).toContain('cases');
    expect(yOk).toContain('prev52_max');
    expect(yOk).not.toContain('jurisdiction');
    expect(yOk).not.toContain('report_state');
    expect(weeks.fits!['y']!.find((f) => f.field === 'jurisdiction')!.because).toBe('"jurisdiction" is string; the y channel of a line needs a number');
  });
  it('a swap of x and y on the weeks line is one commit, judged as a whole', async () => {
    const s = buildDashboard(nndssDef(tables)).createSession();
    const swap = await s.dispatch({ verb: 'reencode', viewId: 'weeks', bindings: { x: 'week_index', y: 'cases' }, cause: userCause('week index on x') });
    expect(swap.ok).toBe(true);
    if (swap.ok) expect(swap.commit).toMatchObject({ viewId: 'encoding:weeks', field: '*' });
    expect(s.viewEncodings('weeks')).toEqual({ x: 'week_index', y: 'cases' });
  });
  it('with the graph: five tables, nodes keyed by disease, and the two relations echoed on the overview with their kind written out', async () => {
    const def = nndssDef(tables, graph);
    const parsed = parseDashboardDef(def);
    expect(parsed).toMatchObject({ ok: true });
    expect(validateDashboardDef(def)).toEqual([]);
    const o = await buildDashboard(def).createSession().overview();
    expect(o.tables.map((t) => t.name)).toEqual(['cells', 'jurisdictions', 'series', 'nodes', 'edges']);
    expect(o.tables.find((t) => t.name === 'nodes')).toMatchObject({ key: 'disease', declaredColumns: 4, source: { inline: 'rows', rows: 2 } });
    expect(o.tables.find((t) => t.name === 'edges')).toMatchObject({ declaredColumns: 4, source: { inline: 'rows', rows: 1 } });
    // projected, never re-derived: the runtime wrote the default kind out; the def's own array is untouched
    expect(o.relations).toEqual(GRAPH_RELATIONS.map((r) => ({ ...r, kind: 'many-to-one' })));
    expect(GRAPH_RELATIONS.every((r) => r.kind === undefined)).toBe(true);
    expect(o.columns['nodes']!.find((c) => c.field === 'disease')).toMatchObject({ role: 'identifier' });
    expect(o.columns['edges']!.find((c) => c.field === 'weight')).toMatchObject({ role: 'measure', label: 'jurisdiction-weeks where both report' });
  });
  it('without the graph (the story page\'s browser build): three tables and no relations — never two empty tables', async () => {
    const def = nndssDef(tables);
    expect(validateDashboardDef(def)).toEqual([]);
    expect('relations' in def).toBe(false);
    const o = await buildDashboard(def).createSession().overview();
    expect(o.tables.map((t) => t.name)).toEqual(['cells', 'jurisdictions', 'series']);
    expect(o.relations).toEqual([]);
  });
  it('a relation must point at an identity — drop the nodes key and the library refuses the def in its sentence', () => {
    const def = nndssDef(tables, graph);
    const { key: _dropped, ...nodes } = def.data['nodes']!;
    expect(validateDashboardDef({ ...def, data: { ...def.data, nodes } })).toEqual([
      'relations[0].to "nodes.disease" — declare data["nodes"].key first; a relation points at an identity',
      'relations[1].to "nodes.disease" — declare data["nodes"].key first; a relation points at an identity',
    ]);
  });
  it('a def that starts against a house rule is refused at build with the sentence', () => {
    const def = nndssDef(tables);
    const bad = { ...def, encodings: def.encodings!.map((e) => (e.viewId === 'weeks' ? { ...e, initial: { x: 't', y: 'cases', color: 'ytd' } } : e)) };
    expect(validateDashboardDef(bad)).toEqual([
      "encodings[3].initial.y: a week's count and a year-to-date total never share a chart (cases with ytd)",
      'encodings[3].initial.color: a year-to-date total is never a hue',
    ]);
    expect(() => buildDashboard(bad)).toThrow(/never a hue/);
  });
});
