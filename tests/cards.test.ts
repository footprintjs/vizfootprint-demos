/**
 * ONE DEMO IS NOT ONE DASHBOARD — over the two surfaces this demo really has.
 *
 * The desk's definition is built WITH the co-occurrence graph and the story
 * page's WITHOUT it, from the same `nndssDef`; the story page's card also
 * carries the 32 commits somebody really left on it. This suite pins the
 * difference, because a card that merged the two would advertise a network a
 * reader opening the story page cannot walk.
 *
 * `npm run cards` writes the same two cards to `web/dist/cards.html`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { chipsOf, choicesOf, narrowRefusal, narrowTo, unseenOf } from 'vizfootprint-studio/cards';
import type { DemoSurface } from 'vizfootprint-studio/cards';
import { loadGraph, loadSnapshot } from '../src/nndss/snapshot.js';
import { NNDSS_GESTURES, nndssSurfaces, type CapturedWalk } from '../src/nndss/cards.js';
import capture from '../web/story/desk.json' with { type: 'json' };

let surfaces: readonly DemoSurface[];
let desk: DemoSurface;
let story: DemoSurface;

beforeAll(() => {
  surfaces = nndssSurfaces({ tables: loadSnapshot(), graph: loadGraph(), captured: capture as unknown as CapturedWalk });
  [desk, story] = surfaces as readonly [DemoSurface, DemoSurface];
}, 60_000);

const idsOf = (surface: DemoSurface): readonly string[] => chipsOf(surface).map((chip) => chip.id);

describe('the two surfaces', () => {
  it('are two builds with two revisions, off one definition function', () => {
    expect(desk.demo).toBe(story.demo);
    expect(desk.declares.revision).not.toBe(story.declares.revision);
    expect(desk.declares.tables).toHaveLength(5);
    expect(story.declares.tables).toHaveLength(3);
    expect(desk.declares.views).toHaveLength(10);
    expect(story.declares.views).toHaveLength(9);
  });

  it('gives the network — and everything that hangs off it — to the desk alone', () => {
    expect(desk.declares.chartKinds).toEqual(['bar', 'line', 'network']);
    expect(story.declares.chartKinds).toEqual(['bar', 'line']);
    expect(desk.declares.selectionKinds).toContain('neighbourhood');
    expect(story.declares.selectionKinds).not.toContain('neighbourhood');
    expect(desk.declares.views.find((view) => view.viewId === 'net')?.layers).toHaveLength(2);
    expect(story.declares.views.some((view) => view.viewId === 'net')).toBe(false);
    expect(desk.declares.relations).toHaveLength(2);
    expect(story.declares.relations).toHaveLength(0);
    expect(desk.declares.analyses).toHaveLength(8);
    expect(story.declares.analyses).toHaveLength(6);
    expect(desk.declares.links.declared).toBe(16);
    expect(story.declares.links.declared).toBe(6);
  });

  it('narrows to the ONE surface that can do the thing, never to the demo', () => {
    expect(narrowTo(surfaces, 'declares:chart:network').map((s) => s.surface)).toEqual(['desk']);
    expect(narrowTo(surfaces, 'declares:selection:neighbourhood').map((s) => s.surface)).toEqual(['desk']);
    expect(narrowTo(surfaces, 'declares:chart:bar')).toHaveLength(2);
    expect(narrowRefusal(surfaces, 'declares:chart:sunburst')).toContain('no surface here carries');
    // every choice on offer lands on at least one card
    for (const choice of choicesOf(surfaces)) expect(narrowTo(surfaces, choice.id).length).toBeGreaterThan(0);
  });
});

describe('the captured walk on the story page', () => {
  it('reports the five verbs that landed, and refuses to speak for the three it cannot see', () => {
    const walked = story.walked!;
    expect(walked.commits).toBe(32);
    for (const verb of ['select', 'filter', 'analyze', 'reencode', 'describe'] as const) expect(walked.verbs[verb]).toBe('landed');
    expect(walked.verbs.annotate).toBe('not-landed');
    expect(walked.verbs.link).toBe('not-landed');
    for (const verb of ['navigate', 'fork', 'bookmark'] as const) expect(walked.verbs[verb]).toBe('unseen');
    expect(unseenOf(walked).map((note) => note.verb)).toEqual(['navigate', 'fork', 'bookmark']);
  });

  it('never touched the network — the walk is the story page’s, and its build has none', () => {
    expect(story.walked!.selectionKinds).toEqual(['interval', 'point']);
    expect(idsOf(story)).not.toContain('walked:selection:neighbourhood');
  });

  it('counts a correlation id WITHOUT calling it an agent — the five ids sit on ordinary user selections', () => {
    expect(story.walked!.correlated).toBe(5);
    expect(story.walked!.agentCorrelated).toBe(0);
    expect(idsOf(story)).not.toContain('walked:trace:agent acted');
    // somebody did branch, and that IS in the log
    expect(story.walked!.lanes).toBe(2);
    expect(idsOf(story)).toContain('walked:trace:branched');
  });

  it('has no walk on the desk card — this demo captured one trace, and the card says which', () => {
    expect(desk.walked).toBeUndefined();
    expect(idsOf(desk).some((id) => id.startsWith('walked:'))).toBe(false);
  });
});

describe('the hand-written half', () => {
  it('is one table, read by the card and by the Grammar panel', () => {
    const unwired = NNDSS_GESTURES.filter((note) => note.gesture === null).map((note) => note.verb);
    expect(unwired).toEqual(['annotate']);
    expect(idsOf(desk)).toContain('by hand:unwired:annotate');
    expect(idsOf(desk)).toContain('by hand:gesture:select');
  });

  it('sits on the desk card only — which gestures the cockpit offers is the desk’s answer, not the story page’s', () => {
    expect(idsOf(story).some((id) => id.startsWith('by hand:'))).toBe(false);
  });
});
