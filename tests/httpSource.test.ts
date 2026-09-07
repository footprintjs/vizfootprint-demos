/**
 * THE HTTP CARRIER — the demo's own, against the library's published port.
 *
 * These tests exist because the static site's whole data path is this one
 * module: a page with no server declares its tables `via: 'http'` and this is
 * what reads them. Every assertion here is a promise the site depends on — the
 * rows arrive decoded, the version is what the SERVER vouched for, a second
 * read with that version is a 304 and not a re-download, and every way a read
 * can fail has a name rather than an empty table.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { openSource, isSourceRefusal } from 'vizfootprint/source';
import { httpSource } from '../src/source/http.js';

const CSV = 'disease,cases\nMumps,4\nPertussis,9\n';

let server: Server;
let base = '';

/** One small origin with a door per case. The ETag is real (a digest), because the point of the version is that the server chose it. */
beforeAll(async () => {
  const etag = `"${createHash('sha256').update(CSV).digest('hex').slice(0, 12)}"`;
  server = createServer((req, res) => {
    const path = req.url ?? '/';
    if (path === '/tagged.csv') {
      if (req.headers['if-none-match'] === etag) return res.writeHead(304, { etag }), res.end();
      return res.writeHead(200, { 'content-type': 'text/csv', etag }), res.end(CSV);
    }
    if (path === '/plain.csv') return res.writeHead(200, { 'content-type': 'text/csv' }), res.end(CSV);
    if (path === '/empty.csv') return res.writeHead(200, { 'content-type': 'text/csv' }), res.end('');
    if (path === '/locked.csv') return res.writeHead(403), res.end('no');
    return res.writeHead(404), res.end('no such file');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const addr = server.address();
  if (addr === null || typeof addr === 'string') throw new Error('the test server did not take a port');
  base = `http://127.0.0.1:${String(addr.port)}`;
});

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

/** One read, or the refusal it threw — the shape every test below asserts on. */
async function read(at: string, sinceVersion?: string): Promise<unknown> {
  const handle = await openSource({ format: 'csv', via: 'http', at }, 'cells', [httpSource()]);
  try {
    return await handle.snapshot(sinceVersion === undefined ? undefined : { sinceVersion });
  } finally {
    await handle.close();
  }
}

/** The refusal's reason, or a sentence saying what came back instead — a test that asserted on a message would pin prose, not behaviour. */
async function reasonOf(at: string): Promise<string> {
  try {
    await read(at);
    return 'nothing was refused';
  } catch (e) {
    return isSourceRefusal(e) ? e.reason : `a plain error: ${String(e)}`;
  }
}

describe('the http carrier reads a declared table', () => {
  it('decodes the rows the declaration asked for', async () => {
    const snap = (await read(`${base}/tagged.csv`)) as { rows: readonly Record<string, unknown>[] };
    expect(snap.rows).toEqual([
      { disease: 'Mumps', cases: 4 },
      { disease: 'Pertussis', cases: 9 },
    ]);
  });

  it('takes the version from what the server vouches for', async () => {
    const snap = (await read(`${base}/tagged.csv`)) as { version: string };
    expect(snap.version.startsWith('etag:"')).toBe(true);
  });

  it('hashes the bytes only when the server vouches for nothing', async () => {
    const snap = (await read(`${base}/plain.csv`)) as { version: string };
    expect(snap.version.startsWith('hash:')).toBe(true);
  });

  it('answers a version it already holds with `unchanged`, not a second copy of the rows', async () => {
    const first = (await read(`${base}/tagged.csv`)) as { version: string };
    expect(await read(`${base}/tagged.csv`, first.version)).toEqual({ unchanged: true, version: first.version });
  });
});

describe('every way a read can fail has a name', () => {
  it('calls a missing file unavailable', async () => {
    expect(await reasonOf(`${base}/gone.csv`)).toBe('unavailable');
  });

  // the zero-becomes-absence class: the place answered, and it answered with nothing
  it('calls a 200 with an empty body unavailable, never an empty table', async () => {
    expect(await reasonOf(`${base}/empty.csv`)).toBe('unavailable');
  });

  it('calls a 403 unauthorized', async () => {
    expect(await reasonOf(`${base}/locked.csv`)).toBe('unauthorized');
  });

  it('calls a locator that is not an http URL malformed', async () => {
    expect(await reasonOf('./data/nndss/snapshot.csv')).toBe('malformed');
  });
});
