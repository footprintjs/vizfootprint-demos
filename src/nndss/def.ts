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
import type { DashboardDef } from '../../../vizfootprint/src/agent/index.js';
import type { ActorMeta } from '../../../vizfootprint/src/mosaic/index.js';
import { groupByAnalysis } from '../../../vizfootprint/src/analysis/index.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from './absence.js';
import type { NndssTables } from './etl.js';

const ALPHA = 0.05;

const COVERAGE: ActorMeta = { actor: 'user', label: 'Coverage — which silence is which' };
const DISEASES: ActorMeta = { actor: 'user', label: 'Cells by disease' };
const KINDS: ActorMeta = { actor: 'user', label: 'Cells by area kind' };
const WEEKS: ActorMeta = { actor: 'user', label: 'Reported cases by week' };
const TREND: ActorMeta = { actor: 'user', label: 'Trend per state' };
const TABLE: ActorMeta = { actor: 'user', label: 'The cells, as CDC printed them' };
const ANALYST: ActorMeta = { actor: 'agent', label: 'Analyst' };

export const NNDSS_VIEWS = ['coverage', 'diseases', 'kinds', 'weeks', 'trend', 'table', 'analyst'] as const;

export function nndssDef(tables: NndssTables): DashboardDef {
  const absence = { field: ABSENCE_FIELD, states: [...ABSENCE_STATES] };
  return {
    meta: { title: 'NNDSS weekly — vizfootprint on CDC data' },
    data: {
      cells: { rows: tables.cells, absence },
      jurisdictions: { rows: tables.jurisdictions },
      // no absence on `series`: a row that exists is present by construction
      series: { rows: tables.series.map((p) => ({ ...p })), grain: tables.grain },
    },
    actors: { coverage: COVERAGE, diseases: DISEASES, kinds: KINDS, weeks: WEEKS, trend: TREND, table: TABLE, analyst: ANALYST },
    encodings: [
      { viewId: 'coverage', chartKind: 'bar', channels: ['category'], initial: { category: ABSENCE_FIELD } },
      { viewId: 'diseases', chartKind: 'bar', channels: ['category'], initial: { category: 'disease' } },
      { viewId: 'kinds', chartKind: 'bar', channels: ['category'], initial: { category: 'kind' } },
      { viewId: 'weeks', chartKind: 'line', channels: ['x', 'y', 'color'], initial: { x: 't', y: 'cases' } },
      { viewId: 'trend', chartKind: 'line', channels: ['x', 'y', 'color', 'facet'], initial: { x: 't', y: 'value', color: 'entity' } },
    ],
    analyses: {
      // cases by disease (sum over PRESENT cells — the host's groupBy sees null as absent, never as 0)
      casesByDisease: groupByAnalysis({ by: 'disease', measure: 'cases' }),
      casesByKind: groupByAnalysis({ by: 'kind', measure: 'cases' }),
    },
    fdr: { procedure: 'LORD++', alpha: ALPHA },
    defaultTable: 'cells',
  };
}
