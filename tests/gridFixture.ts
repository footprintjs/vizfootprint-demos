/**
 * A GRID SMALL ENOUGH TO COUNT BY HAND — the fixture the grid tests share.
 *
 * Three authorities, one of them `external` (named as a neighbour, files
 * nothing — the eight Canadian and Mexican interties in miniature), three
 * directed links, one of which is declared in every hour and never carries a
 * number. Four hourly rows, one of which EIA replaced: the authority filed
 * 900 MW and EIA published 400.
 *
 * Every silence the real slice has is here in one row each, so a test can name
 * the row it means instead of hunting for it in 30,746.
 *
 * Not a `.test.ts`, so vitest never runs it as a suite (`tests/**\/*.test.*`).
 */
import type { GridTables } from '../src/grid/etl.js';

export const HOURS = ['2025-05-19T00:00Z', '2025-05-19T01:00Z'] as const;

export const TINY_GRID: GridTables = {
  authorities: [
    { authority: 'AAA', name: 'Alpha Power', name_state: 'present', region: 'MIDW', region_name: 'Midwest', kind: 'reporting', hours: 2, first_hour: HOURS[0], last_hour: HOURS[1], demand_state: 'present', neighbours: 2 },
    { authority: 'BBB', name: 'Beta Electric', name_state: 'present', region: 'MIDW', region_name: 'Midwest', kind: 'reporting', hours: 2, first_hour: HOURS[0], last_hour: HOURS[1], demand_state: 'present', neighbours: 2 },
    // named as a neighbour and never reports: absent by design, not silent
    { authority: 'CCC', name: null, name_state: 'unknown', region: 'CAN', region_name: 'Canada', kind: 'external', hours: 0, first_hour: null, last_hour: null, demand_state: 'unknown', neighbours: 1 },
  ],
  links: [
    { from_authority: 'AAA', to_authority: 'BBB', to_kind: 'reporting', hours: 2, hours_reported: 2, first_hour: HOURS[0], last_hour: HOURS[1], net_mwh: 30, report_state: 'present' },
    // the two directions of ONE pair disagreeing about when it ended
    { from_authority: 'BBB', to_authority: 'AAA', to_kind: 'reporting', hours: 1, hours_reported: 1, first_hour: HOURS[0], last_hour: HOURS[0], net_mwh: -30, report_state: 'present' },
    // declared in every hour it has, and never carries a number
    { from_authority: 'AAA', to_authority: 'CCC', to_kind: 'external', hours: 2, hours_reported: 0, first_hour: HOURS[0], last_hour: HOURS[1], net_mwh: 0, report_state: 'unavailable' },
  ],
  hourly: [
    { authority: 'AAA', region: 'MIDW', t: HOURS[0], hour_index: 3312, t_local: '2025-05-18T19:00', local_hour: 19, demand: 100, demand_state: 'present', demand_reported: 100, generation: 130, generation_state: 'present', generation_reported: 130, interchange: 30, interchange_state: 'present', interchange_reported: 30, demand_forecast: 98, dibas_sum: 25, interchange_gap: 5 },
    { authority: 'AAA', region: 'MIDW', t: HOURS[1], hour_index: 3313, t_local: '2025-05-18T20:00', local_hour: 20, demand: 110, demand_state: 'present', demand_reported: 110, generation: 140, generation_state: 'present', generation_reported: 140, interchange: 30, interchange_state: 'present', interchange_reported: 30, demand_forecast: 104, dibas_sum: 30, interchange_gap: 0 },
    // EIA judged the filing wrong, imputed another number and published THAT — both are kept
    { authority: 'BBB', region: 'MIDW', t: HOURS[0], hour_index: 3312, t_local: '2025-05-18T19:00', local_hour: 19, demand: 400, demand_state: 'replaced', demand_reported: 900, generation: 370, generation_state: 'present', generation_reported: 370, interchange: -30, interchange_state: 'present', interchange_reported: -30, demand_forecast: 402, dibas_sum: -30, interchange_gap: 0 },
    { authority: 'BBB', region: 'MIDW', t: HOURS[1], hour_index: 3313, t_local: '2025-05-18T20:00', local_hour: 20, demand: 420, demand_state: 'present', demand_reported: 420, generation: 390, generation_state: 'present', generation_reported: 390, interchange: -30, interchange_state: 'present', interchange_reported: -30, demand_forecast: 418, dibas_sum: -30, interchange_gap: 0 },
  ],
  interchange: [
    { from_authority: 'AAA', to_authority: 'BBB', t: HOURS[0], hour_index: 3312, mw: 15, report_state: 'present' },
    { from_authority: 'AAA', to_authority: 'BBB', t: HOURS[1], hour_index: 3313, mw: 15, report_state: 'present' },
    { from_authority: 'BBB', to_authority: 'AAA', t: HOURS[0], hour_index: 3312, mw: -30, report_state: 'present' },
    // a link that was declared and never reported: an empty cell, never a zero
    { from_authority: 'AAA', to_authority: 'CCC', t: HOURS[0], hour_index: 3312, mw: null, report_state: 'unavailable' },
    { from_authority: 'AAA', to_authority: 'CCC', t: HOURS[1], hour_index: 3313, mw: null, report_state: 'unavailable' },
  ],
  hours: [...HOURS],
  counts: {
    demand: { present: 3, estimated: 0, replaced: 1, 'not-configured': 0, unavailable: 0, unknown: 0 },
    generation: { present: 4, estimated: 0, replaced: 0, 'not-configured': 0, unavailable: 0, unknown: 0 },
    interchange: { present: 4, estimated: 0, replaced: 0, 'not-configured': 0, unavailable: 0, unknown: 0 },
    flows: { present: 3, estimated: 0, replaced: 0, 'not-configured': 0, unavailable: 2, unknown: 0 },
    measuredZeroFlows: 0,
    linksNeverReported: 1,
    interchangeGaps: 1,
    hours: 2,
    authorities: 3,
    externalAuthorities: 1,
    links: 3,
  },
};
