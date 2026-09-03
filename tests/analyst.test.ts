import { describe, expect, it } from 'vitest';
import { createNndssAnalyst, scriptedNndssMock, type ActivityStep } from '../src/nndss/analyst.js';
import { buildNndssSurface } from '../src/nndss/surface.js';

/**
 * The analyst with the LLM stubbed: the SAME fixed tool surface, a scripted
 * turn that orients, selects, analyzes and names a bookmark. What lands must be
 * agent-badged commits in the one log — and a bookmark a person can seek to.
 */
describe('the NNDSS analyst (scripted provider)', () => {
  it('drives the dashboard through the verbs and its acts land in the log, badged agent', async () => {
    const { session, port } = buildNndssSurface();
    const acts: ActivityStep[] = [];
    const analyst = createNndssAnalyst(port, { provider: scriptedNndssMock(), onActivity: (s) => acts.push(s) });
    expect(analyst.tools).toEqual(['whats_here', 'dispatch', 'declare_analysis', 'why', 'fork', 'bookmark', 'paths', 'compare', 'propose_chart']);

    const turn = await analyst.send('Focus on pertussis by area and save the moment.');
    expect(turn.text).toMatch(/Pertussis by area/);
    expect(acts.map((a) => a.tool)).toEqual(['whats_here', 'dispatch', 'declare_analysis', 'bookmark']);
    for (const a of acts) expect(JSON.stringify(a.result)).not.toMatch(/"error"/);

    const records = session.commits('anywhere') as readonly { readonly actor?: string; readonly cause?: { readonly requestedBy?: string } }[];
    expect(records.length).toBeGreaterThanOrEqual(2); // select + analyze — the bookmark is a TAG beside the log, so it lands no commit
    expect(records.some((r) => r.actor === 'agent' || r.cause?.requestedBy === 'agent')).toBe(true);
    expect(session.bookmarkViews().map((c) => c.label)).toEqual(['Pertussis by area']);
    expect(analyst.trace()).toBeDefined();
  });
});
