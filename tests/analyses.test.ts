import { describe, expect, it } from 'vitest';
import { NNDSS_ANALYSES, NNDSS_ANALYSIS_IDS } from '../src/nndss/analyses.js';
import { buildNndssSurface } from '../src/nndss/surface.js';

/**
 * The declared analyses over the real snapshot, through the session — the
 * way the analyst runs them. The load-bearing law: a silence is dropped,
 * never a zero, so a group's count is the count of PRESENT cells.
 */
const cause = { requestedBy: 'agent', computedBy: 'agent', intent: 'test' } as const;
type TableOut = { readonly as: string; readonly rows: readonly Record<string, unknown>[] };

describe('the declared analyses', () => {
  it('every id the analyst is told about is declared and ready', async () => {
    const { session } = buildNndssSurface();
    const declared = (await session.overview()).analyses as readonly { readonly id: string }[];
    for (const id of NNDSS_ANALYSIS_IDS) expect(declared.map((a) => a.id)).toContain(id);
  });

  it('a group summary counts PRESENT cells only — a disease\'s silent cells are dropped, never zeros', async () => {
    const { session, tables } = buildNndssSurface();
    // the disease with the most silences in the slice — chosen from the data, not by name
    const silentBy = new Map<string, number>();
    for (const c of tables.cells) if (c.cases === null) silentBy.set(c.disease, (silentBy.get(c.disease) ?? 0) + 1);
    const disease = [...silentBy.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    await session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: disease, cause });
    const r = await session.dispatch({ verb: 'analyze', analysisId: 'casesByKind', cause });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const result = r.analysis?.result as { readonly ok: boolean; readonly output?: TableOut };
    expect(result.ok).toBe(true);
    const rows = result.output!.rows;
    const present = tables.cells.filter((c) => c.disease === disease && c.cases !== null);
    const silent = tables.cells.filter((c) => c.disease === disease && c.cases === null);
    expect(silent.length).toBeGreaterThan(0); // the slice really carries silences for this disease
    for (const kind of ['state', 'region', 'total']) {
      const row = rows.find((x) => x['kind'] === kind);
      const expected = present.filter((c) => c.kind === kind).length;
      if (expected === 0) expect(row).toBeUndefined();
      else expect(row?.['count']).toBe(expected);
    }
    expect(NNDSS_ANALYSES.casesByKind.def.honesty?.notes).toMatch(/PRESENT cells only/);
  });

  it('the trend line fits over the week index and the 52-week test lands one ledger row', async () => {
    const { session } = buildNndssSurface();
    await session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: 'Pertussis', cause });
    const trend = await session.dispatch({ verb: 'analyze', analysisId: 'trendOverWeeks', cause });
    expect(trend.ok).toBe(true);
    if (trend.ok) expect((trend.analysis?.result as { ok: boolean }).ok).toBe(true);
    const test = await session.dispatch({ verb: 'analyze', analysisId: 'casesVsPrev52Max', cause });
    expect(test.ok).toBe(true);
    if (test.ok) expect(test.analysis?.hypothesis).toBeDefined();
    expect(JSON.stringify((await session.overview()).fdr)).toMatch(/casesVsPrev52Max|corr:prev52_max:cases/);
  });
});
