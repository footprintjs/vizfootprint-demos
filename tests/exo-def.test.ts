/**
 * THE EXOPLANET DEFINITION — three tables, three relations, five acts, all as
 * data.
 *
 * These pin what the def PROMISES: that it parses and validates at all; that
 * the three tables arrive with the roles declared for them; that `measurements`
 * carries the absence vocabulary INCLUDING `carries: ['limit']`, which is the
 * one declaration that lets a bound keep its number; that the five acts are the
 * records this repo says they are, in the order their dependencies need; and
 * that the two views whose tables cannot be declared at build time are declared
 * honestly instead of pretended into an encoding.
 */
import { describe, expect, it } from 'vitest';
import { buildDashboard, parseDashboardDef, validateDashboardDef } from 'vizfootprint/def';
import { ABSENCE_FIELD, ABSENCE_STATES, CARRIES, CARRIES_NOTE, PRESENT } from '../src/exo/absence.js';
import { exoTables } from '../src/exo/etl.js';
import {
  ACCEPTED_RADIUS_COLUMN,
  DELTA_COLUMN,
  DISAGREES_COLUMN,
  EXO_ACT_ORDER,
  EXO_ANALYSES,
  EXO_RELATIONS,
  EXO_VIEWS,
  MASS_RADIUS_WINDOW,
  RADII_PER_PLANET,
  SCATTER_ADDRESS,
  SPREAD_COLUMN,
  exoDef,
} from '../src/exo/def.js';
import { TINY_PS, TINY_PSCOMPPARS } from './exoFixture.js';

const TINY = exoTables(TINY_PS, TINY_PSCOMPPARS);

describe('the def declares three tables and three relations', () => {
  it('parses, validates, and names the tables in the order it declares them', async () => {
    const def = exoDef(TINY);
    expect(parseDashboardDef(def)).toMatchObject({ ok: true });
    expect(validateDashboardDef(def)).toEqual([]);
    const o = await buildDashboard(def).createSession().overview();
    expect(o.tables.map((t) => t.name)).toEqual(['measurements', 'planets', 'references']);
    expect(o.tables.find((t) => t.name === 'planets')).toMatchObject({ key: 'pl_name' });
    expect(o.tables.find((t) => t.name === 'references')).toMatchObject({ key: 'ref' });
    expect(o.defaultTable).toBe('measurements');
    expect(o.views.map((v) => v.viewId).sort()).toEqual([...EXO_VIEWS].sort());
  });

  it('echoes all three relations, with the kind the runtime writes out — and never edits the def\'s own array', async () => {
    const o = await buildDashboard(exoDef(TINY)).createSession().overview();
    expect(o.relations).toEqual(EXO_RELATIONS.map((r) => ({ ...r, kind: 'many-to-one' })));
    // projected, never re-derived: the def declares no kind at all
    expect(EXO_RELATIONS.every((r) => r.kind === undefined)).toBe(true);
    expect(EXO_RELATIONS.map((r) => `${r.from.table}.${r.from.column} → ${r.to.table}.${r.to.column}`)).toEqual([
      'measurements.pl_name → planets.pl_name',
      'measurements.ref → references.ref',
      // the edge this demo exists for: where the accepted number came from
      'planets.radius_ref → references.ref',
    ]);
  });

  it('a relation must point at an identity — drop the composite\'s key and the library refuses the def', () => {
    const def = exoDef(TINY);
    const data = { ...def.data, planets: { ...def.data['planets'], key: undefined } } as typeof def.data;
    expect(validateDashboardDef({ ...def, data }).join(' ')).toMatch(/planets/);
  });
});

describe('the absence words are declared per column, and the acts say what a bound may not enter', () => {
  it('declares no table-level absence on `measurements` — the declaration speaks for the ROW, and these rows carry three silences', () => {
    const measurements = exoDef(TINY).data['measurements'];
    expect(measurements?.absence).toBeUndefined();
    // both state columns are declared absence WORDS instead, which is what holds a state off every magnitude channel
    expect(measurements?.columns?.['radius_state']).toMatchObject({ role: 'absence' });
    expect(measurements?.columns?.['mass_state']).toMatchObject({ role: 'absence' });
    // and the gap that forced it is written down rather than worked around in silence
    expect(CARRIES_NOTE).toMatch(/per-column absence declaration/);
    expect(CARRIES).toEqual(['limit']);
    expect(ABSENCE_STATES).toEqual(['present', 'limit', 'not-measured', 'unknown']);
  });

  it('the session reports the declared role for the headline state column', async () => {
    const o = await buildDashboard(exoDef(TINY)).createSession().overview();
    expect(o.columns['measurements']?.find((c) => c.field === ABSENCE_FIELD)).toMatchObject({ role: 'absence' });
  });

  it('the aggregate carries the filter that keeps a BOUND out of a range of measurements', () => {
    const aggregate = EXO_ANALYSES['radiiPerPlanet'] as unknown as { readonly where: { readonly op: string; readonly args: readonly unknown[] } };
    expect(aggregate.where).toEqual({ op: 'eq', args: [{ col: ABSENCE_FIELD }, { lit: PRESENT }] });
  });

  it('the delta answers NOTHING on a row whose radius is a bound — said in the tree, not left to a law', () => {
    const delta = EXO_ANALYSES['radiusDelta'] as unknown as { readonly column: { readonly expr: { readonly op: string; readonly args: readonly unknown[] } } };
    expect(delta.column.expr.op).toBe('if');
    expect(delta.column.expr.args[0]).toEqual({ op: 'eq', args: [{ col: ABSENCE_FIELD }, { lit: PRESENT }] });
    expect(delta.column.expr.args[2]).toEqual({ lit: null });
  });

  it('the composite declares NO table-level absence either — its radius word speaks for one figure', () => {
    expect(exoDef(TINY).data['planets']?.absence).toBeUndefined();
    expect(exoDef(TINY).data['planets']?.columns?.['radius_state']).toMatchObject({ role: 'absence' });
  });
});

describe('the five acts are records, in the order their dependencies need', () => {
  it('declares an aggregate, two derives on the table it mints, a bring-over, and a derive on the parent', () => {
    expect(EXO_ANALYSES['radiiPerPlanet']).toMatchObject({ builtin: 'aggregate', name: RADII_PER_PLANET, table: 'measurements', groupBy: ['pl_name'] });
    expect((EXO_ANALYSES['radiiPerPlanet'] as unknown as { readonly measures: readonly { readonly as: string }[] }).measures.map((m) => m.as)).toEqual(['radii', 'refs', 'r_min', 'r_max']);
    expect(EXO_ANALYSES['radiusSpread']).toMatchObject({ builtin: 'derive', table: RADII_PER_PLANET, name: SPREAD_COLUMN });
    expect(EXO_ANALYSES['radiusDisagrees']).toMatchObject({ builtin: 'derive', table: RADII_PER_PLANET, name: DISAGREES_COLUMN });
    expect(EXO_ANALYSES['acceptedRadius']).toEqual({ builtin: 'bringOver', table: 'measurements', from: 'planets', columns: ['pl_rade'] });
    expect(EXO_ANALYSES['radiusDelta']).toMatchObject({ builtin: 'derive', table: 'measurements', name: DELTA_COLUMN });
  });

  it('the delta reads the column the bring-over really produces — `<relation column>_<column>`', () => {
    expect(ACCEPTED_RADIUS_COLUMN).toBe('pl_name_pl_rade');
    const delta = EXO_ANALYSES['radiusDelta'] as unknown as { readonly column: { readonly expr: { readonly args: readonly [unknown, { readonly args: readonly { readonly col: string }[] }, unknown] } } };
    expect(delta.column.expr.args[1].args.map((a) => a.col)).toEqual(['pl_rade', ACCEPTED_RADIUS_COLUMN]);
  });

  it('the order names every act once, with the table each reads', () => {
    expect(EXO_ACT_ORDER.map((a) => a.id)).toEqual(Object.keys(EXO_ANALYSES));
    expect(EXO_ACT_ORDER.map((a) => a.table)).toEqual(['measurements', RADII_PER_PLANET, RADII_PER_PLANET, 'measurements', 'measurements']);
    expect(EXO_ACT_ORDER.every((a) => a.intent.length > 20)).toBe(true);
  });
});

describe('what the views can and cannot say, declared', () => {
  it('the scatter is a one-LAYER frame, because a view may not name a table and this one draws the composite', () => {
    const scatter = exoDef(TINY).encodings?.find((e) => e.viewId === 'mass_radius');
    expect(scatter?.layers).toEqual([{ layerId: 'planets', table: 'planets', chartKind: 'scatter', channels: ['x', 'y'], initial: { x: 'pl_bmasse', y: 'pl_rade' }, label: 'Planets, as the composite table accepts them' }]);
    expect(SCATTER_ADDRESS).toBe('mass_radius~planets');
  });

  it('the histogram declares NO encoding and no voice — its table does not exist until an act cuts it', () => {
    const def = exoDef(TINY);
    expect(def.encodings?.map((e) => e.viewId)).toEqual(['mass_radius', 'by_year']);
    expect(def.capabilities?.find((c) => c.viewId === 'spread')).toEqual({ viewId: 'spread', canProbe: false });
    // …and it declares no edge at all: the def door refuses an edge out of a view with no voice
    expect(def.links?.filter((l) => l.source === 'spread')).toEqual([]);
    const speaking = { ...def, links: [...(def.links ?? []), { source: 'spread', kind: 'point' as const, target: 'sheet', response: 'none' as const }] };
    expect(validateDashboardDef(speaking).join(' ')).toMatch(/does not emit point — its voice is silent/);
  });

  it('the two edges that DO carry a clause state their fold, because both cross grains', () => {
    const carrying = exoDef(TINY).links?.filter((l) => l.response === 'filter') ?? [];
    expect(carrying.map((l) => `${l.source} → ${String(l.target)}`)).toEqual(['mass_radius~planets → sheet', 'by_year → sheet']);
    expect(carrying.every((l) => typeof l.fold === 'string' && l.fold.length > 10)).toBe(true);
  });

  it('the drawn window is declared, never chosen in a cell', () => {
    expect(MASS_RADIUS_WINDOW).toEqual({ mass: { from: 0, to: 1000 }, radius: { from: 0, to: 30 } });
  });

  it('the house rules refuse the same way at build and in the picker', () => {
    const def = exoDef(TINY);
    expect(def.encodingRules?.onInvalid).toBe('refuse');
    expect(def.encodingRules?.rules?.map((r) => r.rule)).toEqual(['never-together', 'never-on', 'never-on', 'only-with']);
    // bind a radius against its own uncertainty and the def door says so, in the sentence
    const scatter = { viewId: 'mass_radius', chartKind: 'scatter', channels: ['x', 'y'], layers: [{ layerId: 'planets', table: 'planets', chartKind: 'scatter', channels: ['x', 'y'], initial: { x: 'pl_rade', y: 'pl_radeerr1' } }] };
    expect(validateDashboardDef({ ...def, encodings: [scatter] }).join(' ')).toMatch(/never share a scale/);
  });
});
