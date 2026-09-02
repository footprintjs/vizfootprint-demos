/**
 * THE SCRIPTED PROPOSALS — beat 1 with no model in the loop. Six charts an
 * agent might propose over CDC's table; the session admits the ones that make
 * a claim over real columns and files a TYPED refusal for each of the others.
 * Every refusal is a rule the library already enforces — the script only lines
 * them up so a person can see them fire in one click.
 *
 *   A  admitted — this week's cases against the previous-52-week max (a real claim over two real columns)
 *   B  admitted — cases split by area kind
 *   1  refused  — the spec carries its own aggregate; the HOST owns aggregation
 *   2  refused  — it encodes `deaths`, a column CDC's weekly table does not publish
 *   3  refused  — it encodes no data field at all — there is no claim to ledger
 *   4  refused  — it re-uses chart A's id — one id, one proposal
 */
import type { InteractionSession } from '../../../vizfootprint/src/agent/index.js';

export interface ProposalOutcome {
  readonly id: string;
  readonly claim: string;
  readonly admitted: boolean;
  readonly code?: string;
  readonly detail?: string;
}

const AGENT_CAUSE = { requestedBy: 'agent', computedBy: 'agent', intent: 'scripted proposals (beat 1)' } as const;

const SCRIPT = [
  {
    id: 'this-week-vs-prior-max',
    claim: 'this week’s count relates to the previous 52-week maximum',
    spec: { mark: 'point', encoding: { x: { field: 'prev52_max', type: 'quantitative' }, y: { field: 'cases', type: 'quantitative' } } },
  },
  {
    id: 'cases-by-kind',
    claim: 'states, regions and totals report at different scales',
    spec: { mark: 'tick', encoding: { x: { field: 'cases', type: 'quantitative' }, color: { field: 'kind', type: 'nominal' } } },
  },
  {
    id: 'cells-per-disease-counted',
    claim: 'one disease carries most of the rows',
    spec: { mark: 'bar', encoding: { x: { field: 'disease', type: 'nominal' }, y: { aggregate: 'count', type: 'quantitative' } } },
  },
  {
    id: 'deaths-vs-cases',
    claim: 'deaths track cases',
    spec: { mark: 'point', encoding: { x: { field: 'cases', type: 'quantitative' }, y: { field: 'deaths', type: 'quantitative' } } },
  },
  {
    id: 'just-a-title',
    claim: 'something is rising somewhere',
    spec: { mark: 'text' },
  },
  {
    id: 'this-week-vs-prior-max',
    claim: 'this week’s count relates to the previous 52-week maximum (again)',
    spec: { mark: 'point', encoding: { x: { field: 'prev52_max', type: 'quantitative' }, y: { field: 'cases', type: 'quantitative' } } },
  },
] as const;

export async function runScriptedProposals(session: InteractionSession): Promise<ProposalOutcome[]> {
  const out: ProposalOutcome[] = [];
  for (const s of SCRIPT) {
    const res = await session.proposeChart({ id: s.id, spec: s.spec, claim: s.claim, cause: AGENT_CAUSE }, { as: 'agent' });
    out.push(res.ok ? { id: s.id, claim: s.claim, admitted: true } : { id: s.id, claim: s.claim, admitted: false, code: res.gap.code, detail: res.gap.detail });
  }
  return out;
}
