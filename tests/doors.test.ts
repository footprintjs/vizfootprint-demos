/**
 * THE DOORS' OWN MANNERS — the parts of `serveDoors` that are about the wire
 * rather than about the session.
 *
 * Three claims: a mistyped GET is a missing DOOR and not a wrong VERB (a client
 * told to change its method goes after the wrong bug); the rows door serves the
 * graph read ONCE at build, so a live selection cannot narrow it; and a chat
 * turn that throws before its own `try` does not leave the desk wedged with a
 * flag saying a turn is in flight forever.
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
  const req = Readable.from([body === undefined ? '' : JSON.stringify(body)]) as unknown as IncomingMessage;
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
    expect(failed.status).toBe(500);
    expect(desk.turnActive).toBe(false);
    // the second attempt fails the same way rather than being turned away with
    // "the analyst is mid-turn" over a turn that is not running
    const again = await ask(desk, 'POST', '/api/chat', { message: 'hello again' });
    expect(again.status).toBe(500);
    expect(again.body['error']).not.toContain('mid-turn');
  });
});
