/**
 * The window door: `?table=&viewId=&columns=&sort=&offset=&limit=` parsed
 * strictly, refused with a sentence when it cannot be read, and otherwise
 * handed to the session's view-query port verbatim — the door adds nothing
 * and hides nothing.
 */
import { describe, expect, it } from 'vitest';
import { answerWindow, windowQueryOf, WINDOW_LIMIT_MAX } from '../server/doors.js';
import { buildNndssSurface } from '../src/nndss/surface.js';
import type { InteractionSession, ViewQuery, ViewQueryResult } from '../../vizfootprint/src/session/index.js';

const params = (qs: string): URLSearchParams => new URLSearchParams(qs);

/** A session that only remembers what it was asked — enough to prove the door passes the question through. */
function fakeSession(answer: ViewQueryResult): { readonly session: Pick<InteractionSession, 'viewQuery'>; readonly asked: ViewQuery[] } {
  const asked: ViewQuery[] = [];
  return {
    asked,
    session: {
      viewQuery: (query: ViewQuery = {}) => {
        asked.push(query);
        return Promise.resolve(answer);
      },
    },
  };
}

const WINDOW: ViewQueryResult = { ok: true, columns: ['jurisdiction'], rows: [{ jurisdiction: 'Texas' }], rowIds: ['v1#0'], positional: true, count: 90_300, start: 0, version: 'v1', cursor: null, clauses: [] };

describe('windowQueryOf', () => {
  it('an empty query is the default window: the default table, every live clause, the port\'s own limit', () => {
    expect(windowQueryOf(params(''))).toEqual({});
  });

  it('reads every part the Sheet sends', () => {
    expect(windowQueryOf(params(`table=cells&viewId=sheet&columns=${encodeURIComponent('["jurisdiction","cases"]')}&sort=${encodeURIComponent('[{"field":"cases","dir":"desc"}]')}&offset=200&limit=50`))).toEqual({
      table: 'cells',
      viewId: 'sheet',
      columns: ['jurisdiction', 'cases'],
      sort: [{ field: 'cases', dir: 'desc' }],
      offset: 200,
      limit: 50,
    });
  });

  it('refuses what it cannot read, each with its own sentence', () => {
    expect(windowQueryOf(params('table='))).toEqual({ error: 'table= was empty — name a declared table, or leave it out for the default one' });
    expect(windowQueryOf(params('viewId='))).toEqual({ error: 'viewId= was empty — name a declared view, or leave it out for every live clause' });
    expect(windowQueryOf(params('columns=jurisdiction,cases'))).toEqual({ error: 'columns= is not JSON — send a list like ["jurisdiction","cases"]' });
    const colShape = 'columns= must be a non-empty JSON list of column names — or leave it out for every column the cursor sees';
    expect(windowQueryOf(params(`columns=${encodeURIComponent('[]')}`))).toEqual({ error: colShape });
    expect(windowQueryOf(params(`columns=${encodeURIComponent('["ok",7]')}`))).toEqual({ error: colShape });
    expect(windowQueryOf(params(`columns=${encodeURIComponent('["ok",""]')}`))).toEqual({ error: colShape });
    expect(windowQueryOf(params(`columns=${encodeURIComponent('"jurisdiction"')}`))).toEqual({ error: colShape });
    expect(windowQueryOf(params('sort=not-json'))).toEqual({ error: 'sort= is not JSON — send a list like [{"field":"cases","dir":"desc"}]' });
    const shape = 'sort= must be a list of {field, dir: "asc" | "desc", absent?: "first" | "last"} — nothing else';
    expect(windowQueryOf(params(`sort=${encodeURIComponent('{"field":"cases"}')}`))).toEqual({ error: shape });
    expect(windowQueryOf(params(`sort=${encodeURIComponent('[{"field":"cases","dir":"sideways"}]')}`))).toEqual({ error: shape });
    expect(windowQueryOf(params(`sort=${encodeURIComponent('[{"field":"","dir":"asc"}]')}`))).toEqual({ error: shape });
    expect(windowQueryOf(params(`sort=${encodeURIComponent('[{"field":"cases","dir":"asc","absent":"middle"}]')}`))).toEqual({ error: shape });
    expect(windowQueryOf(params(`sort=${encodeURIComponent('[null]')}`))).toEqual({ error: shape });
    expect(windowQueryOf(params('offset=half'))).toEqual({ error: 'offset=half is not a whole number of rows' });
    expect(windowQueryOf(params('offset=-5'))).toEqual({ error: 'offset=-5 is not a whole number of rows' });
    expect(windowQueryOf(params('limit=2.5'))).toEqual({ error: 'limit=2.5 is not a whole number of rows' });
    expect(windowQueryOf(params('limit=0'))).toEqual({ error: 'limit=0 asks for no rows — ask for at least one' });
    expect(windowQueryOf(params(`limit=${String(WINDOW_LIMIT_MAX + 1)}`))).toEqual({ error: `limit=1001 is more than one window — ask for at most ${String(WINDOW_LIMIT_MAX)} rows` });
    expect(windowQueryOf(params(`limit=${String(WINDOW_LIMIT_MAX)}`))).toEqual({ limit: WINDOW_LIMIT_MAX }); // the cap itself is fine
  });

  it('a column whose name holds a comma survives the door — which a joined list could never promise', () => {
    expect(windowQueryOf(params(`columns=${encodeURIComponent('["a,b","c"]')}`))).toEqual({ columns: ['a,b', 'c'] });
  });

  it('keeps a sort key\'s absence rule when it states one', () => {
    expect(windowQueryOf(params(`sort=${encodeURIComponent('[{"field":"cases","dir":"asc","absent":"first"}]')}`))).toEqual({ sort: [{ field: 'cases', dir: 'asc', absent: 'first' }] });
  });
});

describe('the window door', () => {
  it('hands the parsed question to the session and answers its result verbatim', async () => {
    const { session, asked } = fakeSession(WINDOW);
    const answer = await answerWindow(session, params('table=cells&viewId=sheet&offset=100&limit=30'));
    expect(asked[0]).toEqual({ table: 'cells', viewId: 'sheet', offset: 100, limit: 30 });
    expect(answer).toEqual({ status: 200, body: WINDOW });
  });

  it('a query it could not read is a 400 with the sentence — never a default window nobody asked for', async () => {
    const { session, asked } = fakeSession(WINDOW);
    const answer = await answerWindow(session, params('limit=0'));
    expect(answer.status).toBe(400);
    expect(answer.body).toEqual({ error: 'limit=0 asks for no rows — ask for at least one' });
    expect(asked).toHaveLength(0); // the session is never asked a question the door could not read
  });

  it('the session\'s own refusal rides through with its code and its sentence', async () => {
    const { session } = fakeSession({ ok: false, reason: 'unknown-view', rejected: 'no declared view "ghost"' });
    expect(await answerWindow(session, params('viewId=ghost'))).toEqual({ status: 200, body: { ok: false, reason: 'unknown-view', rejected: 'no declared view "ghost"' } });
  });

  it('over the REAL surface: the sheet\'s window is the rows the charts see, and CDC\'s cells table has no row key', async () => {
    const { session } = buildNndssSurface();
    const answer = await answerWindow(session, params('table=cells&viewId=sheet&limit=5'));
    expect(answer.status).toBe(200);
    const body = answer.body as Extract<ViewQueryResult, { ok: true }>;
    expect(body.ok).toBe(true);
    expect(body.rows).toHaveLength(5);
    expect(body.count).toBeGreaterThan(1000);
    expect(body.columns).toContain('report_state');
    // no `key` is declared on `cells`, so a row id is a within-version position — the window names no key
    // column either, and the Sheet says so rather than guessing one
    expect(body.positional).toBe(true);
    expect(body.key).toBeUndefined();
    expect(body.rowIds[0]).toContain('#0');
    // a clause from another view reaches the sheet through the default crossfilter edge
    await session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: body.rows[0]!['disease'], cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick a disease' } });
    const narrowed = (await answerWindow(session, params('table=cells&viewId=sheet&limit=5'))).body as Extract<ViewQueryResult, { ok: true }>;
    expect(narrowed.count).toBeLessThan(body.count);
    expect(narrowed.clauses.map((c) => c.from)).toContain('diseases');
  });
});
