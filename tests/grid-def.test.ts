/**
 * THE GRID DEFINITION — four tables, two relations, and the words for the
 * silences, all as data.
 *
 * These pin what the def PROMISES: that it parses at all; that the four tables
 * arrive with the roles declared for them; that `authorities` carries a key and
 * both ends of a link point at it; that the absence vocabulary survives the
 * round trip from the ETL through the def to the session's own answer; and that
 * the house rules refuse the same way at build, at dispatch and in the picker.
 */
import { describe, expect, it } from 'vitest';
import { buildDashboard, parseDashboardDef, validateDashboardDef } from 'vizfootprint/def';
import type { Cause } from 'vizfootprint/cause';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/grid/absence.js';
import { EDGE_POSITION_COLUMNS, GRID_ANALYSES, GRID_LAYOUT_ITERATIONS, GRID_LAYOUT_SEED, GRID_RELATIONS, GRID_VIEWS, NETWORK_EDGES_ADDRESS, NETWORK_NODES_ADDRESS, NETWORK_VIEW, gridDef } from '../src/grid/def.js';
import { TINY_GRID } from './gridFixture.js';

const userCause = (intent: string): Cause => ({ requestedBy: 'user', computedBy: 'user', intent });

describe('the def declares four tables and two relations', () => {
  it('parses, validates, and names the tables in the order it declares them', async () => {
    const def = gridDef(TINY_GRID);
    expect(parseDashboardDef(def)).toMatchObject({ ok: true });
    expect(validateDashboardDef(def)).toEqual([]);
    const o = await buildDashboard(def).createSession().overview();
    expect(o.tables.map((t) => t.name)).toEqual(['hourly', 'authorities', 'links', 'interchange']);
    // the NODES table declares the key a relation may point at — EIA's own code
    expect(o.tables.find((t) => t.name === 'authorities')).toMatchObject({ key: 'authority' });
    expect(o.defaultTable).toBe('hourly');
    expect(o.views.map((v) => v.viewId).sort()).toEqual([...GRID_VIEWS].sort());
  });

  it('echoes both relations, with the kind the runtime writes out — and never edits the def\'s own array', async () => {
    const o = await buildDashboard(gridDef(TINY_GRID)).createSession().overview();
    expect(o.relations).toEqual(GRID_RELATIONS.map((r) => ({ ...r, kind: 'many-to-one' })));
    // projected, never re-derived: the def declares no kind at all
    expect(GRID_RELATIONS.every((r) => r.kind === undefined)).toBe(true);
    expect(GRID_RELATIONS.map((r) => `${r.from.table}.${r.from.column} → ${r.to.table}.${r.to.column}`)).toEqual([
      'links.from_authority → authorities.authority',
      'links.to_authority → authorities.authority',
    ]);
  });

  it('a relation must point at an identity — drop the key and the library refuses the def in its sentence', () => {
    const def = gridDef(TINY_GRID);
    const { key: _dropped, ...authorities } = def.data['authorities']!;
    expect(validateDashboardDef({ ...def, data: { ...def.data, authorities } })).toEqual([
      'relations[0].to "authorities.authority" — declare data["authorities"].key first; a relation points at an identity',
      'relations[1].to "authorities.authority" — declare data["authorities"].key first; a relation points at an identity',
    ]);
  });

  it('the columns arrive with the roles declared for them', async () => {
    const o = await buildDashboard(gridDef(TINY_GRID)).createSession().overview();
    expect(o.columns['hourly']!.find((c) => c.field === 'authority')).toMatchObject({ role: 'identifier', scale: 'discrete' });
    expect(o.columns['hourly']!.find((c) => c.field === 't')).toMatchObject({ type: 'date' });
    expect(o.columns['hourly']!.find((c) => c.field === 'interchange_gap')).toMatchObject({ role: 'measure', label: 'published interchange − summed flows' });
    // the WALL CLOCK is not a date: 6 p.m. in Florida and 6 p.m. in Oregon are different instants and the same peak
    expect(o.columns['hourly']!.find((c) => c.field === 't_local')!.type).not.toBe('date');
    expect(o.columns['authorities']!.find((c) => c.field === 'authority')).toMatchObject({ role: 'identifier' });
    expect(o.columns['links']!.find((c) => c.field === 'net_mwh')).toMatchObject({ role: 'measure' });
  });
});

describe('the absence words survive the round trip', () => {
  it('every table that has a silence column declares it, and the session gives that column role "absence"', async () => {
    const def = gridDef(TINY_GRID);
    // the ETL's own field name reaches the def unchanged
    expect(def.data['hourly']!.absence).toEqual({ field: ABSENCE_FIELD, states: [...ABSENCE_STATES] });
    expect(def.data['links']!.absence).toMatchObject({ field: 'report_state' });
    expect(def.data['interchange']!.absence).toMatchObject({ field: 'report_state' });
    const o = await buildDashboard(def).createSession().overview();
    expect(o.columns['hourly']!.find((c) => c.field === ABSENCE_FIELD)).toMatchObject({ role: 'absence' });
    expect(o.columns['links']!.find((c) => c.field === 'report_state')).toMatchObject({ role: 'absence' });
    expect(o.columns['interchange']!.find((c) => c.field === 'report_state')).toMatchObject({ role: 'absence' });
    expect(o.columns['authorities']!.find((c) => c.field === 'demand_state')).toMatchObject({ role: 'absence' });
  });

  it('all six words, in the ETL\'s order, and none invented', () => {
    expect(ABSENCE_STATES).toEqual(['present', 'estimated', 'replaced', 'not-configured', 'unavailable', 'unknown']);
    // there is no `withheld` here: CDC has one because it knows a count and chooses
    // not to print it, and EIA never does that in these files
    expect(ABSENCE_STATES).not.toContain('withheld');
  });

  it('an absence is a category, never a magnitude — the library\'s own law, on this data', async () => {
    const s = buildDashboard(gridDef(TINY_GRID)).createSession();
    const magnitude = await s.dispatch({ verb: 'reencode', viewId: 'demand', channel: 'y', field: ABSENCE_FIELD, cause: userCause('demand state on y') });
    expect(!magnitude.ok && magnitude.rejection.detail).toContain('absence is a category, never a magnitude');
  });
});

describe('the house rules refuse the same way at build, at dispatch and in the picker', () => {
  it('names three rules beside the built-in absence law', async () => {
    const o = await buildDashboard(gridDef(TINY_GRID)).createSession().overview();
    expect(o.rules.map((r) => r.id)).toEqual(['absence-never-magnitude', 'never-together#0', 'never-on#1', 'only-with#2']);
    expect(o.encodingPolicy).toEqual({ onInvalid: 'refuse', ruleScope: 'view' });
  });

  it('refuses at dispatch with the house sentence, and the picker verdict says the same', async () => {
    const s = buildDashboard(gridDef(TINY_GRID)).createSession();
    // the rule bites where the two are TOGETHER: the line already draws `demand` on
    // y, so the residue arriving on any other channel of the same chart is the case
    // the sentence is about (rebinding y would replace `demand`, not join it)
    const residue = await s.dispatch({ verb: 'reencode', viewId: 'demand', channel: 'color', field: 'interchange_gap', cause: userCause('the residue as a hue') });
    expect(!residue.ok && residue.rejection.detail).toContain(
      'a load and a bookkeeping residue never share a scale (interchange_gap with demand) — one is megawatts of demand, the other is what EIA\'s two interchange figures differ by',
    );
    const demand = (await s.overview()).views.find((v) => v.viewId === 'demand')!;
    // `because` carries the FIRST refusing sentence — the house rule, before the shape
    expect(demand.fits!['color']!.find((f) => f.field === 'interchange_gap')!.because).toBe(
      'a load and a bookkeeping residue never share a scale (interchange_gap with demand) — one is megawatts of demand, the other is what EIA\'s two interchange figures differ by',
    );
  });

  it('a def that starts against a house rule is refused at build with the sentence', () => {
    const def = gridDef(TINY_GRID);
    const bad = { ...def, encodings: def.encodings!.map((e) => (e.viewId === 'demand' ? { ...e, initial: { x: 't', y: 'demand', color: 'hour_index' } } : e)) };
    expect(validateDashboardDef(bad)).toContain('encodings[1].initial.color: an hour index is a clock, never a hue');
    expect(() => buildDashboard(bad)).toThrow(/never a hue/);
  });
});

describe('the two analyses are DATA, and the seed is not a clock', () => {
  it('declares a seeded stress layout over the authorities, reading the links', () => {
    expect(GRID_ANALYSES['gridLayout']).toEqual({
      builtin: 'layout',
      algo: 'stress',
      table: 'authorities',
      edges: 'links',
      key: 'authority',
      from: 'from_authority',
      to: 'to_authority',
      seed: GRID_LAYOUT_SEED,
      iterations: GRID_LAYOUT_ITERATIONS,
    });
    // a seed is a NUMBER written down, so the same rows give the same picture
    expect(typeof GRID_LAYOUT_SEED).toBe('number');
  });

  it('declares a bring-over that carries x and y ACROSS the relations onto the links', () => {
    expect(GRID_ANALYSES['gridEndpoints']).toEqual({ builtin: 'bringOver', table: 'links', from: 'authorities', columns: ['x', 'y'] });
    // one produced column per relation × name: `<relationColumn>_<column>`
    expect(EDGE_POSITION_COLUMNS).toEqual({ sourceX: 'from_authority_x', sourceY: 'from_authority_y', targetX: 'to_authority_x', targetY: 'to_authority_y' });
  });

  it('both are JSON — a def whose analyses are records is a def something that cannot write TypeScript could author', () => {
    expect(JSON.parse(JSON.stringify(GRID_ANALYSES))).toEqual(GRID_ANALYSES);
  });
});

describe('the links between views are declared, and the walk is routed by hand', () => {
  it('writes the default rule out beside the declared edges, so nothing is implicit', async () => {
    const o = await buildDashboard(gridDef(TINY_GRID)).createSession().overview();
    expect(o.links.default).toBe('crossfilter');
    const declared = o.links.edges.filter((e) => e.origin === 'declared');
    // three of the demo's own story, plus the walk's four (one mirror, three refusals)
    expect(declared).toHaveLength(7);
    expect(o.links.edges.some((e) => e.origin === 'default')).toBe(true);
  });

  it('a walk MIRRORS onto the authorities and reaches nowhere else — a clause over two endpoint columns has nothing to say about an hour', async () => {
    const o = await buildDashboard(gridDef(TINY_GRID)).createSession().overview();
    const walks = o.links.edges.filter((e) => e.kind === 'neighbourhood' && e.source === NETWORK_EDGES_ADDRESS);
    expect(walks.find((e) => e.target === NETWORK_NODES_ADDRESS)?.response).toBe('mirror');
    for (const view of GRID_VIEWS) {
      if (view === NETWORK_VIEW) continue;
      expect(walks.find((e) => e.target === view)?.response).toBe('none');
    }
  });

  it('the network can walk; the sheet deliberately cannot brush', async () => {
    const o = await buildDashboard(gridDef(TINY_GRID)).createSession().overview();
    const voiceOf = (viewId: string): readonly string[] => o.links.views.find((v) => v.viewId === viewId)?.voice ?? [];
    expect(voiceOf(NETWORK_VIEW)).toContain('neighbourhood');
    expect(voiceOf('sheet')).toEqual(['point', 'match']);
    // nothing about an undeclared view says it has an edge to walk, so a view that does must say so
    expect(voiceOf('demand')).not.toContain('neighbourhood');
  });
});
