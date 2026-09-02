import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { kindOf, loadSnapshot, mmwrWeekEnd, nndssTables } from '../src/nndss/etl.js';

/**
 * The ETL over CDC's own bytes: MMWR weeks become real dates, every cell
 * keeps its state, silences never become series points (present cells of
 * every kind do, each naming its kind), and the snapshot
 * parses to the same tables every time.
 */
describe('mmwrWeekEnd — week 1 contains January 4th and weeks end on Saturday', () => {
  it('matches the MMWR calendar for 2025 and 2026', () => {
    expect(mmwrWeekEnd(2025, 1)).toBe('2025-01-04'); // Jan 4 2025 was a Saturday
    expect(mmwrWeekEnd(2026, 1)).toBe('2026-01-10'); // Jan 4 2026 was a Sunday → week 1 ends the 10th
    expect(mmwrWeekEnd(2025, 53)).toBe('2026-01-03'); // 2025 has 53 MMWR weeks
    expect(mmwrWeekEnd(2026, 33)).toBe('2026-08-22');
  });
});

describe('kindOf — from CDC columns, never the name', () => {
  it('location1 names a state; location2 alone names a region; a roll-up name makes a total', () => {
    expect(kindOf({ states: 'Texas', location1: 'Texas', location2: '' })).toBe('state');
    expect(kindOf({ states: 'Total', location1: '', location2: 'Total' })).toBe('total');
    expect(kindOf({ states: 'New England', location1: '', location2: 'New England' })).toBe('region');
  });
  it('the coordinate is not the classifier — South Atlantic carries one in CDC\'s file and is still a region', () => {
    expect(kindOf({ states: 'South Atlantic', location1: '', location2: 'South Atlantic' })).toBe('region');
  });
});

describe('nndssTables on a tiny CSV in the snapshot shape', () => {
  const csv = [
    'states,year,week,label,m1,m1_flag,m2,m2_flag,m3,m3_flag,m4,m4_flag,location1,location2,lon,lat',
    'Texas,2026,10,Pertussis,12,,40.0,,120,,90,,Texas,,-99.1,31.1',
    'Texas,2026,11,Pertussis,,-,40.0,,120,,90,,Texas,,-99.1,31.1',
    'Guam,2026,10,Pertussis,,N,,N,,N,,N,Guam,,144.7,13.4',
    'Vermont,2026,10,Pertussis,,U,3.0,,20,,15,,Vermont,,-72.6,44.1',
    'New England,2026,10,Pertussis,30,,80.0,,300,,250,,,New England,,',
  ].join('\n');
  const t = nndssTables(csv);

  it('keeps every cell with its state and flag, and dates the week', () => {
    expect(t.cells).toHaveLength(5);
    const tx10 = t.cells[0]!;
    expect(tx10).toMatchObject({ jurisdiction: 'Texas', kind: 'state', disease: 'Pertussis', week: 10, t: '2026-03-14', cases: 12, report_state: 'present', flag: null, ytd: 120 });
    expect(t.cells[1]).toMatchObject({ cases: 0, report_state: 'present', flag: '-' });
    expect(t.cells[2]).toMatchObject({ jurisdiction: 'Guam', cases: null, report_state: 'not-configured', flag: 'N', ytd: null, ytd_state: 'not-configured' });
    expect(t.cells[3]).toMatchObject({ jurisdiction: 'Vermont', cases: null, report_state: 'unavailable', flag: 'U' });
    expect(t.counts).toEqual({ present: 3, 'not-configured': 1, unavailable: 1, withheld: 0, unknown: 0 });
  });

  it('series points exist for every PRESENT cell, each naming its kind — a silence is a missing row', () => {
    expect(t.series).toEqual([
      { t: '2026-03-14', entity: 'Texas', entity_kind: 'state', metric: 'Pertussis', value: 12 },
      { t: '2026-03-21', entity: 'Texas', entity_kind: 'state', metric: 'Pertussis', value: 0 },
      { t: '2026-03-14', entity: 'New England', entity_kind: 'region', metric: 'Pertussis', value: 30 },
    ]);
    expect(t.grain).toEqual({ bucket: 'MMWR week', reducer: 'reported count', note: 'provisional; CDC revises weekly counts' });
    expect(t.jurisdictions.map((j) => [j.jurisdiction, j.kind])).toEqual([['Texas', 'state'], ['Guam', 'state'], ['Vermont', 'state'], ['New England', 'region']]);
  });
});

describe('the committed snapshot', () => {
  it('parses to the slice the provenance describes, deterministically', () => {
    const provenance = JSON.parse(readFileSync(new URL('../data/nndss/PROVENANCE.json', import.meta.url), 'utf8')) as { rows: number; labels: string[] };
    const a = loadSnapshot();
    expect(a.cells.length).toBe(provenance.rows); // the provenance and the snapshot move together
    expect(a.diseases).toEqual([...provenance.labels].sort());
    expect(a.weeks).toHaveLength(86);
    expect(a.jurisdictions).toHaveLength(70);
    expect(a.counts.present + a.counts['not-configured'] + a.counts.unavailable + a.counts.withheld + a.counts.unknown).toBe(provenance.rows);
    expect(a.counts.unavailable).toBeGreaterThan(0); // the slice carries the U silence in the current-week column
    expect(a.series.every((p) => Number.isFinite(p.value))).toBe(true);
    expect(JSON.stringify(loadSnapshot().counts)).toBe(JSON.stringify(a.counts));
  });
});
