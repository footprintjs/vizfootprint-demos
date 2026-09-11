/**
 * The find door: a POST body parsed strictly as the library's `FindQuery`,
 * refused with a sentence when it cannot be read, and otherwise handed to the
 * session's find port verbatim — the window door's law, applied to a body. The
 * door adds nothing, hides nothing, and DROPS nothing: a field the library does
 * not declare is refused, never quietly ignored.
 */
import { describe, expect, it } from 'vitest';
import { answerFind, findQueryOf, FIND_TEXT_MAX } from '../server/doors.js';
import { buildNndssSurface } from '../src/nndss/surface.js';
import type { FindInViewResult, FindQuery, InteractionSession } from 'vizfootprint/session';

/** A session that only remembers what it was asked — enough to prove the door passes the question through. */
function fakeSession(answer: FindInViewResult): { readonly session: Pick<InteractionSession, 'findInView'>; readonly asked: FindQuery[] } {
  const asked: FindQuery[] = [];
  return {
    asked,
    session: {
      findInView: (query: FindQuery) => {
        asked.push(query);
        return Promise.resolve(answer);
      },
    },
  };
}

const HIT: FindInViewResult = { ok: true, position: 7, rowId: 'v1#7', ordinal: 1, matches: 3, version: 'v1', cursor: null };
const ASK = { text: 'Texas', from: 0, direction: 'forward' } as const;

describe('findQueryOf', () => {
  it('reads every part the Sheet sends, and hands back exactly those', () => {
    expect(findQueryOf({ table: 'cells', viewId: 'sheet', columns: ['jurisdiction', 'disease'], sort: [{ field: 'cases', dir: 'desc' }], text: 'Texas', from: 200, direction: 'backward' })).toEqual({
      table: 'cells',
      viewId: 'sheet',
      columns: ['jurisdiction', 'disease'],
      sort: [{ field: 'cases', dir: 'desc' }],
      text: 'Texas',
      from: 200,
      direction: 'backward',
    });
    // the three required parts alone are a whole question: the default table, every live clause, the text columns at the cursor
    expect(findQueryOf({ ...ASK })).toEqual(ASK);
  });

  it('refuses what it cannot read, each with its own sentence', () => {
    expect(findQueryOf({ from: 0, direction: 'forward' })).toEqual({ error: 'text is missing — a find needs something to look for' });
    expect(findQueryOf({ ...ASK, text: '' })).toEqual({ error: 'text was empty — a find needs something to look for' });
    expect(findQueryOf({ ...ASK, text: '   ' })).toEqual({ error: 'text was empty — a find needs something to look for' }); // whitespace is nothing to look for
    expect(findQueryOf({ ...ASK, text: 7 })).toEqual({ error: 'text must be a string — got 7' });
    expect(findQueryOf({ ...ASK, text: null })).toEqual({ error: 'text must be a string — got null' });
    expect(findQueryOf({ ...ASK, from: 2.5 })).toEqual({ error: 'from must be a whole number of rows at or above zero — got 2.5' });
    expect(findQueryOf({ ...ASK, from: -1 })).toEqual({ error: 'from must be a whole number of rows at or above zero — got -1' });
    expect(findQueryOf({ text: 'Texas', direction: 'forward' })).toEqual({ error: 'from must be a whole number of rows at or above zero — got nothing' });
    expect(findQueryOf({ ...ASK, direction: 'sideways' })).toEqual({ error: 'direction must be "forward" or "backward" — got "sideways"' });
    expect(findQueryOf({ text: 'Texas', from: 0 })).toEqual({ error: 'direction must be "forward" or "backward" — got nothing' });
    expect(findQueryOf({ ...ASK, table: '' })).toEqual({ error: 'table must name a declared table — or leave it out for the default one' });
    expect(findQueryOf({ ...ASK, table: 3 })).toEqual({ error: 'table must name a declared table — or leave it out for the default one' });
    expect(findQueryOf({ ...ASK, viewId: '' })).toEqual({ error: 'viewId must name a declared view — or leave it out for every live clause' });
    // a find's viewId has no `null` arm — "no window to fix" is the type's own reason — so null is not a name either
    expect(findQueryOf({ ...ASK, viewId: null })).toEqual({ error: 'viewId must name a declared view — or leave it out for every live clause' });
    const colShape = 'columns must be a non-empty JSON list of column names — or leave it out for the text columns the cursor sees';
    expect(findQueryOf({ ...ASK, columns: [] })).toEqual({ error: colShape });
    expect(findQueryOf({ ...ASK, columns: ['ok', 7] })).toEqual({ error: colShape });
    expect(findQueryOf({ ...ASK, columns: ['ok', ''] })).toEqual({ error: colShape });
    expect(findQueryOf({ ...ASK, columns: 'jurisdiction' })).toEqual({ error: colShape });
  });

  it('never coerces — a number sent as a string is a string, however much it looks like a row', () => {
    // the window door's law in its JSON form: `Number('5')` would read this as row 5, and the door does not
    expect(findQueryOf({ ...ASK, from: '5' })).toEqual({ error: 'from must be a whole number of rows at or above zero — got "5"' });
    expect(findQueryOf({ ...ASK, from: '' })).toEqual({ error: 'from must be a whole number of rows at or above zero — got ""' });
    expect(findQueryOf({ ...ASK, direction: 1 })).toEqual({ error: 'direction must be "forward" or "backward" — got 1' });
  });

  it('a text longer than one find may look for is refused, and the cap itself is fine', () => {
    const long = 'x'.repeat(FIND_TEXT_MAX + 1);
    expect(findQueryOf({ ...ASK, text: long })).toEqual({ error: `text is ${String(FIND_TEXT_MAX + 1)} characters — a find looks for at most ${String(FIND_TEXT_MAX)}` });
    expect(findQueryOf({ ...ASK, text: 'x'.repeat(FIND_TEXT_MAX) })).toEqual({ ...ASK, text: 'x'.repeat(FIND_TEXT_MAX) });
  });

  it('a field the library does not declare is refused, never dropped — a `dir` typed for `direction` must not vanish', () => {
    expect(findQueryOf({ ...ASK, dir: 'backward' })).toEqual({ error: 'no field "dir" on a find — the fields are table, viewId, columns, sort, text, from, direction' });
    expect(findQueryOf({ ...ASK, offset: 0, limit: 50 })).toEqual({ error: 'no field "offset", "limit" on a find — the fields are table, viewId, columns, sort, text, from, direction' });
  });

  it('reads a sort in the window door\'s exact grammar — one parser, so a position is the offset the window meant', () => {
    expect(findQueryOf({ ...ASK, sort: [{ field: 'cases', dir: 'asc', absent: 'first' }] })).toEqual({ ...ASK, sort: [{ field: 'cases', dir: 'asc', absent: 'first' }] });
    expect(findQueryOf({ ...ASK, sort: [] })).toEqual({ ...ASK, sort: [] }); // an empty list is source order, as it is on the window
    const shape = 'sort must be a list of {field, dir: "asc" | "desc", absent?: "first" | "last"} — nothing else';
    expect(findQueryOf({ ...ASK, sort: { field: 'cases' } })).toEqual({ error: shape });
    expect(findQueryOf({ ...ASK, sort: [{ field: 'cases', dir: 'sideways' }] })).toEqual({ error: shape });
    expect(findQueryOf({ ...ASK, sort: [{ field: '', dir: 'asc' }] })).toEqual({ error: shape });
    expect(findQueryOf({ ...ASK, sort: [{ field: 'cases', dir: 'asc', absent: 'middle' }] })).toEqual({ error: shape });
    expect(findQueryOf({ ...ASK, sort: [null] })).toEqual({ error: shape });
    expect(findQueryOf({ ...ASK, sort: '[{"field":"cases","dir":"desc"}]' })).toEqual({ error: shape }); // a body carries the list itself, not JSON text of it
  });
});

describe('the find door', () => {
  it('hands the parsed question to the session and answers its result verbatim', async () => {
    const { session, asked } = fakeSession(HIT);
    const answer = await answerFind(session, { table: 'cells', viewId: 'sheet', text: 'Texas', from: 3, direction: 'forward' });
    expect(asked[0]).toEqual({ table: 'cells', viewId: 'sheet', text: 'Texas', from: 3, direction: 'forward' });
    expect(answer).toEqual({ status: 200, body: HIT });
  });

  it('a body it could not read is a 400 with the sentence — the session is never asked a question the door could not read', async () => {
    const { session, asked } = fakeSession(HIT);
    const answer = await answerFind(session, { text: '', from: 0, direction: 'forward' });
    expect(answer.status).toBe(400);
    expect(answer.body).toEqual({ error: 'text was empty — a find needs something to look for' });
    expect(asked).toHaveLength(0);
  });

  it('the session\'s own refusal rides through with its code and its sentence', async () => {
    const { session } = fakeSession({ ok: false, reason: 'unsupported-find', rejected: 'the sql engine cannot find — filter instead' });
    expect(await answerFind(session, { ...ASK })).toEqual({ status: 200, body: { ok: false, reason: 'unsupported-find', rejected: 'the sql engine cannot find — filter instead' } });
  });

  it('over the REAL surface: a hit names a position and a row, a miss is null with an honest count, a ghost view is the session\'s refusal', async () => {
    const { session } = buildNndssSurface();
    const hit = (await answerFind(session, { table: 'cells', viewId: 'sheet', text: 'Texas', from: 0, direction: 'forward' })).body as Extract<FindInViewResult, { ok: true }>;
    expect(hit.ok).toBe(true);
    expect(hit.position).toBeGreaterThanOrEqual(0);
    expect(hit.matches).toBeGreaterThan(0);
    expect(hit.ordinal).toBe(1); // the first match forward from the top is match 1 of N
    expect(hit.rowId).toContain('#'); // `cells` declares no key, so the row's identity is a within-version position
    // the same text, walked BACKWARD from the top: no match that way, and the count says there are matches the other way
    const miss = (await answerFind(session, { table: 'cells', viewId: 'sheet', text: 'Texas', from: 0, direction: 'backward' })).body as Extract<FindInViewResult, { ok: true }>;
    expect(miss.ok).toBe(true);
    if (hit.position !== null && hit.position > 0) expect(miss.position).toBeNull();
    expect(miss.matches).toBe(hit.matches);
    // a text no cell holds: null, zero, and no row named
    const none = (await answerFind(session, { table: 'cells', viewId: 'sheet', text: 'no jurisdiction is called this', from: 0, direction: 'forward' })).body as Extract<FindInViewResult, { ok: true }>;
    expect(none).toMatchObject({ ok: true, position: null, matches: 0 });
    expect(none.rowId).toBeUndefined();
    // a view the def never declared is the session's own refusal, code and sentence, as a 200 — the door read the body fine
    const ghost = await answerFind(session, { table: 'cells', viewId: 'ghost', text: 'Texas', from: 0, direction: 'forward' });
    expect(ghost.status).toBe(200);
    expect(ghost.body).toMatchObject({ ok: false, reason: 'unknown-view' });
  });
});
