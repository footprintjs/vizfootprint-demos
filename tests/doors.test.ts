/**
 * THE DOORS' OWN MANNERS — the parts of `serveDoors` that are about the wire
 * rather than about the session.
 *
 * Four claims: a mistyped GET is a missing DOOR and not a wrong VERB (a client
 * told to change its method goes after the wrong bug); the rows door serves the
 * graph read ONCE at build, so a live selection cannot narrow it; the find door
 * is MOUNTED as a POST that answers the session's find port verbatim and a body
 * it cannot read with a 400; and a chat turn that throws before its own `try`
 * does not leave the desk wedged with a flag saying a turn is in flight forever.
 */
import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { serveDoors } from '../server/doors.js';
import type { Desk } from '../server/doors.js';
import { buildNndssSurfaceAsync } from '../src/nndss/surface.js';
import type { NndssTables } from '../src/nndss/etl.js';
import type { NndssGraph } from '../src/nndss/graph.js';

const TINY: NndssGraph = {
  nodes: [
    { disease: 'Measles', cases_total: 3, jurisdictions_reporting: 1, weeks_reporting: 1 },
    { disease: 'Mumps', cases_total: 1, jurisdictions_reporting: 1, weeks_reporting: 1 },
    { disease: 'Rubella', cases_total: 2, jurisdictions_reporting: 1, weeks_reporting: 1 },
  ],
  edges: [
    { source: 'Measles', target: 'Mumps', weight: 2, jurisdictions: 1 },
    { source: 'Mumps', target: 'Rubella', weight: 1, jurisdictions: 1 },
  ],
};

const TABLES = {
  cells: [{ jurisdiction: 'Texas', kind: 'state', disease: 'Measles', cases: 3, report_state: 'present', flag: null, ytd: 30, prev52_max: 9, t: '2026-01-04', week_index: 1 }] as unknown as NndssTables['cells'],
  jurisdictions: [{ jurisdiction: 'Texas', kind: 'state', lat: 31, lon: -99 }] as unknown as NndssTables['jurisdictions'],
  series: [{ t: '2026-01-04', entity: 'Texas', metric: 'cases', value: 3, entity_kind: 'state', week_index: 1 }] as unknown as NndssTables['series'],
  grain: { bucket: 'week', reducer: 'sum' },
} as unknown as NndssTables;

/** One request/response pair, answered — the status and the parsed body. */
async function ask(desk: Desk, method: string, path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  // BUFFERS, the way node's http server yields a body — the door concatenates
  // buffers, so a harness handing it strings would be testing a different door
  // (a string chunk made `readJson` throw, and every POST here was a 500 before
  // its door was ever reached)
  const req = Readable.from([Buffer.from(body === undefined ? '' : JSON.stringify(body))]) as unknown as IncomingMessage;
  req.method = method;
  req.url = path;
  req.headers = {};
  let status = 0;
  let text = '';
  const res = {
    writeHead: (code: number) => {
      status = code;
      return res;
    },
    end: (chunk?: string) => {
      text = chunk ?? '';
    },
  } as unknown as ServerResponse;
  expect(await serveDoors(desk, req, res)).toBe(true);
  return { status, body: JSON.parse(text) as Record<string, unknown> };
}

async function openDesk(): Promise<Desk> {
  const surface = await buildNndssSurfaceAsync(TABLES, TINY);
  return { surface, proposals: [], activity: [], provenance: {}, transcript: [], turnActive: false, analyst: { send: () => Promise.resolve({ text: '' }) } } as unknown as Desk;
}

describe('a door that is not there', () => {
  it('is a 404 naming the door, not a 405 telling the caller to change its verb', async () => {
    const desk = await openDesk();
    expect(await ask(desk, 'GET', '/api/rowz')).toEqual({ status: 404, body: { error: 'no door "rowz"' } });
    // a trailing slash makes a door name nobody serves, and it gets the same answer
    expect(await ask(desk, 'GET', '/api/geo/')).toEqual({ status: 404, body: { error: 'no door "geo/"' } });
    // …and a real POST door asked with the wrong verb still says so
    expect(await ask(desk, 'GET', '/api/dispatch')).toEqual({ status: 405, body: { error: 'dispatch is POST' } });
  });
});

describe('POST /api/find — the Sheet\'s find, mounted', () => {
  it('answers the session\'s find port verbatim: a hit on the one row, and a miss with an honest zero', async () => {
    const desk = await openDesk();
    const hit = await ask(desk, 'POST', '/api/find', { table: 'cells', viewId: 'sheet', text: 'Texas', from: 0, direction: 'forward' });
    expect(hit.status).toBe(200);
    expect(hit.body).toMatchObject({ ok: true, position: 0, ordinal: 1, matches: 1 });
    const miss = await ask(desk, 'POST', '/api/find', { table: 'cells', viewId: 'sheet', text: 'Ohio', from: 0, direction: 'forward' });
    expect(miss.body).toMatchObject({ ok: true, position: null, matches: 0 });
  });

  it('a body it cannot read is a 400 with the parser\'s sentence, and a GET at the door says it is POST', async () => {
    const desk = await openDesk();
    expect(await ask(desk, 'POST', '/api/find', { text: 'Texas', from: 0, direction: 'sideways' })).toEqual({ status: 400, body: { error: 'direction must be "forward" or "backward" — got "sideways"' } });
    // a key the library's `FindQuery` never declared is refused at the door, not dropped on the way to the session
    expect(await ask(desk, 'POST', '/api/find', { text: 'Texas', from: 0, direction: 'forward', limit: 50 })).toEqual({ status: 400, body: { error: 'no field "limit" on a find — the fields are table, viewId, columns, sort, text, from, direction' } });
    expect(await ask(desk, 'GET', '/api/find')).toEqual({ status: 405, body: { error: 'find is POST' } });
  });
});

describe('GET /api/analyst/recording — one turn, whole, or a sentence', () => {
  it('a desk that keeps no recordings says so; a desk that keeps them answers the turn it has and names the one it has not', async () => {
    const none = await openDesk();
    expect(await ask(none, 'GET', '/api/analyst/recording?turn=turn-1')).toEqual({ status: 404, body: { error: 'this desk keeps no recordings (NNDSS_KEEP_RECORDING=0)' } });
    const desk = { ...(await openDesk()), recordings: new Map([['turn-1', { snapshot: { commitLog: [] }, events: [], structure: null }]]) } as unknown as Desk;
    expect(await ask(desk, 'GET', '/api/analyst/recording?turn=turn-1')).toEqual({ status: 200, body: { snapshot: { commitLog: [] }, events: [], structure: null } });
    expect(await ask(desk, 'GET', '/api/analyst/recording?turn=turn-2')).toEqual({ status: 404, body: { error: 'no recording is kept for turn "turn-2"' } });
  });
});

describe('GET /api/rows serves the graph the surface froze', () => {
  it('does not narrow under a live selection, and never refuses about a column nobody asked for', async () => {
    const desk = await openDesk();
    const before = await ask(desk, 'GET', '/api/rows');
    expect((before.body['nodes'] as unknown[]).length).toBe(3);
    expect(before.body['netRefused']).toBeNull();
    // a view's clause reaches EVERY table, and `edges` has no `disease` column —
    // a per-request read here would answer this reload with a refusal about it
    const picked = await desk.surface.session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: 'Measles', cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick a disease' } });
    expect(picked.ok).toBe(true);
    const after = await ask(desk, 'GET', '/api/rows');
    expect(after.body['netRefused']).toBeNull();
    expect((after.body['nodes'] as unknown[]).length).toBe(3);
    expect((after.body['edges'] as unknown[]).length).toBe(2);
  });

  it('projects the encodings off the def the session runs on, network included', async () => {
    const desk = await openDesk();
    const rows = await ask(desk, 'GET', '/api/rows');
    const grammar = rows.body['grammar'] as { encodings: readonly { viewId: string }[] };
    expect(grammar.encodings.map((e) => e.viewId)).toContain('net');
    expect(grammar.encodings).toEqual(desk.surface.dashboard.def.encodings);
  });
});

describe('a chat turn that throws before its own try', () => {
  it('leaves no flag standing — chat, the analyst and the RESET door all still answer', async () => {
    const desk = await openDesk();
    // `onScreenNow` walks the whole session; a throw there used to leave
    // `turnActive` true forever, closing the one door that could recover the desk
    (desk.surface.session as unknown as { overview: () => never }).overview = () => {
      throw new Error('the walk fell over');
    };
    const failed = await ask(desk, 'POST', '/api/chat', { message: 'hello' });
    // a failed turn is an OUTCOME (`runTurn` catches it and both hosts show the
    // same sentence), and the door's status for one is 502 — with the walk's own
    // words, which proves the body reached the chat door at all
    expect(failed.status).toBe(502);
    expect(failed.body['error']).toBe('the walk fell over');
    expect(desk.turnActive).toBe(false);
    // the second attempt fails the same way rather than being turned away with
    // "the analyst is mid-turn" over a turn that is not running
    const again = await ask(desk, 'POST', '/api/chat', { message: 'hello again' });
    expect(again.status).toBe(502);
    expect(again.body['error']).toBe('the walk fell over');
    expect(again.body['error']).not.toContain('mid-turn');
  });
});
