/**
 * A no-browser smoke over the real snapshot: build the surface, read the
 * facet, select a disease, run the analyses, run the proposals, try to put
 * the absence column on an axis. Prints what happened; exits non-zero if the
 * exit criterion is not met. `npx tsx scripts/smoke.ts`
 */
import { runScriptedProposals } from '../src/nndss/proposals.js';
import { buildNndssSurface } from '../src/nndss/surface.js';

async function main(): Promise<void> {
  const t0 = performance.now();
  const { session, tables } = buildNndssSurface();
  console.log(`surface built in ${String(Math.round(performance.now() - t0))} ms · cells ${String(tables.cells.length)} · series ${String(tables.series.length)}`);
  console.log('cell states:', tables.counts);

  const o = await session.overview();
  const facet = o.columns['cells']?.find((c) => c.field === 'report_state');
  console.log('views:', o.views.map((v) => v.viewId).join(', '));
  console.log('absence facet:', facet);

  const t1 = performance.now();
  const sel = await session.dispatch(
    { verb: 'select', viewId: 'diseases', field: 'disease', value: 'Pertussis', cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick pertussis' } },
    { as: 'user' },
  );
  console.log(`select pertussis: ok=${String(sel.ok)} → ${String((await session.selectedRows()).length)} cells in ${String(Math.round(performance.now() - t1))} ms`);

  for (const id of ['casesByDisease', 'casesByKind']) {
    const a = await session.declareAnalysis(id);
    console.log(`analysis ${id}: ok=${String(a.ok)}`, JSON.stringify(a.ok ? a.analysis.output : a).slice(0, 220));
  }

  const bad = await session.dispatch({ verb: 'reencode', viewId: 'weeks', channel: 'y', field: 'report_state', cause: { requestedBy: 'user', computedBy: 'user' } }, { as: 'user' });
  console.log('absence column onto y:', bad.ok ? 'ACCEPTED (defect)' : `refused — ${bad.rejection.detail.slice(0, 80)}`);

  const outcomes = await runScriptedProposals(session);
  for (const p of outcomes) console.log(`  ${p.admitted ? 'ADMIT ' : 'REFUSE'} ${p.id}${p.code ? ` | ${p.code} | ${(p.detail ?? '').slice(0, 80)}` : ''}`);

  const admitted = outcomes.filter((p) => p.admitted).length;
  if (facet === undefined || admitted !== 2 || bad.ok) {
    console.error('SMOKE FAILED');
    process.exit(1);
  }
  console.log('SMOKE OK');
}

void main();
