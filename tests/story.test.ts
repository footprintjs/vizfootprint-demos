/**
 * THE STORY PAGE — what the capture reads off the desk, and whether what it
 * wrote actually opens.
 *
 * Two halves, and the second is the one that matters. `deskStory` is a plain
 * mapping and is tested as one. But a build that produces a file nobody can
 * open is a build that passed its own tests and failed, so the rest of this
 * file takes the CAPTURED desk (`web/story/desk.json` — the same bytes the
 * build inlines) and walks it through the page's own boot sequence: restore the
 * pictures, replay the log, restore the bookmarks, tell the story. If the
 * exported page can be opened, this passes; if it cannot, this fails here
 * rather than in somebody's browser.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildDashboard } from 'vizfootprint/agent';
import { parseCSVTyped } from 'vizfootprint/data';
import { createSessionView, sessionSource } from 'vizfootprint-ui';
import { toStory } from 'vizfootprint-ui/story';
import { decodeStoryPayload, encodeStoryPayload, STORY_PAYLOAD_CEILING_BYTES } from 'vizfootprint-ui/story/payload';
import { CAPTURE_NOTE, deskStory, type NndssPageData } from '../src/nndss/story.js';
import { nndssTablesFromRows } from '../src/nndss/etl.js';
import { DASHBOARD_WORDS, nndssDef } from '../src/nndss/def.js';

const WIRE = {
  records: [{ id: 's1', parent: null, viewId: 'diseases', kind: 'point', field: 'disease', value: 'Gonorrhea' }],
  bookmarks: [{ id: 'b1', label: 'Gonorrhea across the states', commitId: 's1', at: 's1', ts: 0 }],
  saved: [{ id: 'p1', name: 'test', conditions: [{ viewId: 'diseases', kind: 'point', field: 'disease', value: 'Gonorrhea' }], by: 'user', at: '2026-09-04T03:54:30.213Z' }],
};

describe('deskStory — the wire, in the shapes the page boots from', () => {
  it('turns the cockpit\'s view of a bookmark into a restorable record, and SAYS what it stamped', () => {
    const story = deskStory(WIRE, '2026-09-05T00:00:00.000Z');
    expect('error' in story).toBe(false);
    if ('error' in story) return;
    expect(story.log).toHaveLength(1);
    expect(story.bookmarks).toEqual([{ id: 'b1', name: 'Gonorrhea across the states', commitId: 's1', by: 'user', at: '2026-09-05T00:00:00.000Z' }]);
    expect(story.saved).toHaveLength(1);
    // the one thing the wire does not carry is the one thing the page prints about itself
    expect(story.notes).toEqual([CAPTURE_NOTE]);
  });

  it('takes the moment a bookmark NAMES, falling back to the bookmark commit an older log carries', () => {
    const story = deskStory({ ...WIRE, bookmarks: [{ id: 'b1', label: 'old', commitId: 's9', at: null, ts: 0 }] }, 'now');
    expect('error' in story ? [] : story.bookmarks.map((b) => b.commitId)).toEqual(['s9']);
  });

  it('skips a bookmark with no name or no moment rather than inventing one', () => {
    const story = deskStory({ ...WIRE, bookmarks: [{ label: '', commitId: 's1' }, { label: 'nameless moment' }, { id: 'b2', label: 'kept', at: 's1' }] }, 'now');
    expect('error' in story ? [] : story.bookmarks.map((b) => b.name)).toEqual(['kept']);
  });

  it('admits nothing when there were no bookmarks to stamp', () => {
    const story = deskStory({ ...WIRE, bookmarks: [] }, 'now');
    expect('error' in story ? null : story.notes).toEqual([]);
  });

  it('refuses a body that is not a desk state, in words', () => {
    expect(deskStory('not a desk', 'now')).toEqual({ error: '/api/state did not answer with an object' });
    expect(deskStory({ bookmarks: [] }, 'now')).toEqual({ error: '/api/state answered without a `records` array — that is the log, and there is no story without it' });
  });
});

describe('the captured desk actually opens', () => {
  const captured = JSON.parse(readFileSync(new URL('../web/story/desk.json', import.meta.url), 'utf8')) as ReturnType<typeof deskStory> & { log: []; bookmarks: []; saved: [] };

  it('replays into a fresh session, restores its beats, and tells the story the desk told', async () => {
    const tables = nndssTablesFromRows(parseCSVTyped(readFileSync(new URL('../data/nndss/snapshot.csv', import.meta.url), 'utf8')).rows);
    const session = buildDashboard(nndssDef(tables)).createSession();

    // the page's own order: the pictures BEFORE the log that cites them, the bookmarks after it
    expect(session.restoreSaved(captured.saved).refused).toEqual([]);
    const replayed = await session.replay(captured.log);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.landed).toBe(captured.log.length);
    expect(session.restoreBookmarks(captured.bookmarks).refused).toEqual([]);

    const view = createSessionView(sessionSource(session), { as: 'user' });
    await view.refresh();
    const post = toStory(view.getState(), { declared: DASHBOARD_WORDS, author: 'the desk' });
    expect(post.sections).toHaveLength(captured.bookmarks.length);
    // the last beat's words cite two moments, and the story landed both on the beats that tell them
    const last = post.sections[post.sections.length - 1];
    expect(last?.refs?.map((r) => r.commit)).toEqual(['s27', 's28']);
    expect(last?.refs?.every((r) => r.at !== undefined)).toBe(true);
    expect(last?.dropped ?? []).toEqual([]);
  }, 60_000);

  it('fits in one file: the payload the build inlines, round-tripped and under the ceiling', async () => {
    const csv = readFileSync(new URL('../data/nndss/snapshot.csv', import.meta.url), 'utf8');
    const geo = JSON.parse(readFileSync(new URL('../data/geo/us-states.geo.json', import.meta.url), 'utf8')) as unknown;
    const encoded = await encodeStoryPayload<NndssPageData>({
      log: captured.log,
      bookmarks: captured.bookmarks,
      saved: captured.saved,
      meta: { builtAt: '2026-09-05', data: { via: 'inline' } },
      data: { csv, geo },
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.sizes.compressed).toBeLessThan(STORY_PAYLOAD_CEILING_BYTES);
    const back = await decodeStoryPayload<NndssPageData>(encoded.text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    // the bytes the page runs its ETL over are the bytes the build read off disk
    expect(back.payload.data?.csv.length).toBe(csv.length);
    expect(back.payload.log).toHaveLength(captured.log.length);
  }, 60_000);
});
