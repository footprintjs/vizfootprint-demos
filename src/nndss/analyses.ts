/**
 * THE DECLARED ANALYSES — every number the analyst may claim, declared here,
 * run by the session over the CURRENT selection, landed as an `analyze`
 * commit. The agent never computes a statistic itself; a question none of
 * these can answer comes back as a typed gap — what to build next.
 *
 * ── Present cells only ──────────────────────────────────────────────────────
 * The `cells` table carries CDC's silences as rows (a `report_state`, no
 * `cases`). The library's built-ins sum `Number(row.measure)`, which would
 * turn a silence into a zero. `presentOnly` wraps each built-in so it runs
 * over the present cells of the selection and says so in its honesty notes.
 */
import type { AnalysisModule, AnalysisOutput } from 'vizfootprint/analysis';
import { correlationAnalysis, groupByAnalysis, regressionAnalysis } from 'vizfootprint/analysis';
import { WEEK_INDEX_FIELD } from './etl.js';

type Rows = readonly Record<string, unknown>[];

const isPresent = (row: Record<string, unknown>, measure: string): boolean => typeof row[measure] === 'number' && Number.isFinite(row[measure] as number);

/** The same analysis over the PRESENT cells of its input — a silence is dropped, never a zero. */
export function presentOnly<O extends AnalysisOutput>(module: AnalysisModule<Rows, O>, measure: string): AnalysisModule<Rows, O> {
  const present = (rows: Rows): Rows => rows.filter((r) => isPresent(r, measure));
  const base = module.def;
  const notes = [base.honesty?.notes, `over PRESENT cells only — a silence (no ${measure}) is dropped, never a zero`].filter((n) => n !== undefined).join('; ');
  const def = {
    ...base,
    // WHY the second argument is forwarded: `toRunInput(input, related)` carries
    // the rows of every table the analysis `reads` (packet 3). Dropping it here
    // would hand a wrapped analysis an empty related set and silently change
    // what it computed — this wrapper narrows the OWN rows, nothing else.
    toRunInput: (rows: Rows, related: Parameters<typeof base.toRunInput>[1]) => base.toRunInput(present(rows), related),
    precheck: base.precheck ? (rows: Rows) => base.precheck!(present(rows)) : undefined,
    honesty: { ...base.honesty, notes },
  };
  return { ...module, def, run: (rows, opts) => module.run(present(rows), opts) };
}

export const NNDSS_ANALYSES = {
  /** Present cells and mean weekly cases per disease. */
  casesByDisease: presentOnly(groupByAnalysis({ by: 'disease', measure: 'cases', name: 'by_disease' }), 'cases'),
  /** … per area kind (state / region / total). */
  casesByKind: presentOnly(groupByAnalysis({ by: 'kind', measure: 'cases', name: 'by_kind' }), 'cases'),
  /** … per area. */
  casesByArea: presentOnly(groupByAnalysis({ by: 'jurisdiction', measure: 'cases', name: 'by_area' }), 'cases'),
  /** … per MMWR week. */
  casesByWeek: presentOnly(groupByAnalysis({ by: 't', measure: 'cases', name: 'by_week' }), 'cases'),
  /** A straight line through cases over the week index — the direction of the kept cells; degenerate under 10 points. */
  trendOverWeeks: presentOnly(regressionAnalysis({ x: WEEK_INDEX_FIELD, y: 'cases', layer: 'trend_line' }), 'cases'),
  /** Does this week's count track the previous 52-week high? A TEST — one row in the FDR ledger. */
  casesVsPrev52Max: presentOnly(correlationAnalysis({ x: 'prev52_max', y: 'cases' }), 'cases'),
} as const;

export type NndssAnalysisId = keyof typeof NNDSS_ANALYSES;
export const NNDSS_ANALYSIS_IDS = Object.keys(NNDSS_ANALYSES) as readonly NndssAnalysisId[];
