/**
 * THE GRID DOORS — the second demo on the wire, under a prefix of its own.
 *
 * Four claims: all FOUR tables come off one door; the graph's two are the ones
 * the surface froze, so a live selection cannot narrow them; the absence
 * vocabulary reaches the page as the ETL spelled it; and the CDC graph rides
 * across as COUNTS, never as a verdict — the page runs the rule.
 *
 * Plus the manners the CDC doors have: a mistyped GET is a missing DOOR and not
 * a wrong VERB, and `/api/grid/*` must be tried BEFORE `/api/*` or the CDC
 * doors swallow it.
 */
import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { graphReadingFor } from 'vizfootprint/def';
import { createGridDesk, serveGridDoors, type ContrastGraph, type GridDesk } from '../server/grid-doors.js';
import { serveDoors, type Desk } from '../server/doors.js';
import { ABSENCE_STATES } from '../src/grid/absence.js';
import { TINY_GRID } from './gridFixture.js';

/** The CDC demo's graph as the server counts it: 15 diseases, every pair joined. */
const CDC_CONTRAST: ContrastGraph = { label: 'the CDC disease co-occurrence graph', nodes: 15, edges: 105, interaction: true };

/** One request/response pair, answered — the status and the parsed body. */
async function ask(desk: GridDesk, method: string, path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  // BUFFERS, the way node's http server yields a body — the door concatenates
  // buffers, so a harness handing it strings would be testing a different door
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
  expect(await serveGridDoors(desk, req, res)).toBe(true);
  return { status, body: JSON.parse(text) as Record<string, unknown> };
}

const openDesk = (): Promise<GridDesk> => createGridDesk(TINY_GRID, {}, CDC_CONTRAST);

describe('GET /api/grid/rows serves all four tables', () => {
  it('hands over the hours, the flows, and the graph the surface froze', async () => {
    const desk = await openDesk();
    const { status, body } = await ask(desk, 'GET', '/api/grid/rows');
    expect(status).toBe(200);
    expect((body['hourly'] as unknown[]).length).toBe(4);
    expect((body['interchange'] as unknown[]).length).toBe(5);
    expect((body['authorities'] as unknown[]).length).toBe(3);
    expect((body['links'] as unknown[]).length).toBe(3);
    expect(body['netRefused']).toBeNull();
    // the positions the two acts wrote arrive with the rows, so the page never invents one
    const link = (body['links'] as Record<string, unknown>[])[0]!;
    expect(typeof link['from_authority_x']).toBe('number');
    expect(typeof link['to_authority_y']).toBe('number');
  });

  it('does not narrow under a live selection — the graph was read where no clause could exist', async () => {
    const desk = await openDesk();
    // a view's clause reaches EVERY table, and `links` has no `region` column — a
    // per-request read here would answer the next reload with a refusal about it
    const picked = await desk.surface.session.dispatch({ verb: 'select', viewId: 'authorities', field: 'region', value: 'MIDW', cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick a region' } });
    expect(picked.ok).toBe(true);
    const after = await ask(desk, 'GET', '/api/grid/rows');
    expect(after.body['netRefused']).toBeNull();
    expect((after.body['authorities'] as unknown[]).length).toBe(3);
    expect((after.body['links'] as unknown[]).length).toBe(3);
  });

  it('carries the absence vocabulary as the ETL spells it, and the declared words', async () => {
    const { body } = await ask(await openDesk(), 'GET', '/api/grid/rows');
    expect(body['absence']).toEqual({ field: 'demand_state', states: ABSENCE_STATES });
    expect(body['declared']).toMatchObject({ dashboard: { title: 'The US grid, hour by hour' } });
    // the six words reach the page intact, `replaced` and all — the row that says
    // the authority filed one number and EIA published another
    const hourly = body['hourly'] as Record<string, unknown>[];
    expect(hourly.find((r) => r['demand_state'] === 'replaced')).toMatchObject({ authority: 'BBB', demand: 400, demand_reported: 900 });
    const links = body['links'] as Record<string, unknown>[];
    expect(links.find((l) => l['report_state'] === 'unavailable')).toMatchObject({ from_authority: 'AAA', to_authority: 'CCC', hours: 2, hours_reported: 0 });
  });

  it('ships the OTHER demo\'s graph as counts, never as a verdict — the page runs the rule', async () => {
    const { body } = await ask(await openDesk(), 'GET', '/api/grid/rows');
    expect(body['contrast']).toEqual(CDC_CONTRAST);
    // nothing on the wire says which picture to draw; the words come from the library
    expect(JSON.stringify(body['contrast'])).not.toContain('matrix');
    const contrast = body['contrast'] as ContrastGraph;
    expect(graphReadingFor({ nodes: contrast.nodes, edges: contrast.edges, interaction: contrast.interaction }).prefer).toBe('matrix');
  });
});

describe('the grid doors have the CDC doors\' manners', () => {
  it('a door that is not there is a 404 naming it; a POST door asked with a GET says so', async () => {
    const desk = await openDesk();
    expect(await ask(desk, 'GET', '/api/grid/rowz')).toEqual({ status: 404, body: { error: 'no door "rowz"' } });
    expect(await ask(desk, 'GET', '/api/grid/dispatch')).toEqual({ status: 405, body: { error: 'dispatch is POST' } });
  });

  it('answers the sheet\'s window off the session\'s own port', async () => {
    const { status, body } = await ask(await openDesk(), 'GET', '/api/grid/window?table=hourly&limit=2');
    expect(status).toBe(200);
    expect((body['rows'] as unknown[]).length).toBe(2);
  });

  it('a path that is not ours is not ours — `serveGridDoors` answers false and the CDC doors get their turn', async () => {
    const desk = await openDesk();
    const req = Readable.from(['']) as unknown as IncomingMessage;
    req.method = 'GET';
    req.url = '/api/state';
    req.headers = {};
    const res = { writeHead: () => res, end: () => undefined } as unknown as ServerResponse;
    expect(await serveGridDoors(desk, req, res)).toBe(false);
  });

  it('…and the ORDER is load-bearing: `serveDoors` claims everything under /api/, grid included', async () => {
    // this is why `server.ts` tries the grid first. Asked directly, the CDC doors
    // answer `/api/grid/rows` as a door of their own that does not exist.
    const req = Readable.from(['']) as unknown as IncomingMessage;
    req.method = 'GET';
    req.url = '/api/grid/rows';
    req.headers = {};
    let text = '';
    const res = {
      writeHead: () => res,
      end: (chunk?: string) => {
        text = chunk ?? '';
      },
    } as unknown as ServerResponse;
    const cdcDesk = { surface: {}, provenance: {} } as unknown as Desk;
    expect(await serveDoors(cdcDesk, req, res)).toBe(true);
    expect(JSON.parse(text)).toEqual({ error: 'no door "grid/rows"' });
  });
});

describe('POST /api/grid/reset', () => {
  it('builds a fresh surface over the SAME tables, and the two layout acts land again', async () => {
    const desk = await openDesk();
    await desk.surface.session.dispatch({ verb: 'select', viewId: 'authorities', field: 'region', value: 'MIDW', cause: { requestedBy: 'user', computedBy: 'user', intent: 'pick a region' } });
    expect(desk.surface.session.commits('anywhere').length).toBe(3); // two acts + the pick
    const { status, body } = await ask(desk, 'POST', '/api/grid/reset', {});
    expect([status, body]).toEqual([200, { ok: true }]);
    // the data stayed; the log is back to the two commits that put the grid on a frame
    expect(desk.surface.tables.authorities).toHaveLength(3);
    expect(desk.surface.session.commits('anywhere').map((r) => r.viewId)).toEqual(['analysis:gridLayout', 'analysis:gridEndpoints']);
  });
});
