import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadExoOverHttp } from '../src/exo/http.js';
import { REVIEW_SOURCE_VERSIONS } from '../src/exo/reviewReplay.js';

const BASE = 'https://example.test/vizfootprint-demos/';
const PS = readFileSync(new URL('../data/exo/ps.csv', import.meta.url), 'utf8');
const COMPOSITE = readFileSync(new URL('../data/exo/pscomppars.csv', import.meta.url), 'utf8');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function serveCommitted(options: { readonly ps?: string; readonly composite?: string; readonly status?: number } = {}): {
  readonly calls: { readonly url: string; readonly init: RequestInit | undefined }[];
  readonly responses: Map<string, Response>;
} {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const responses = new Map<string, Response>();
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    const isPs = url === `${BASE}data/exo/ps.csv`;
    expect(isPs || url === `${BASE}data/exo/pscomppars.csv`).toBe(true);
    const body = isPs ? options.ps ?? PS : options.composite ?? COMPOSITE;
    const response = new Response(body, {
      status: options.status ?? 200,
      headers: isPs
        ? { 'content-type': 'text/csv', etag: 'W/"published-ps"', 'last-modified': 'Thu, 10 Sep 2026 17:09:00 GMT' }
        : { 'content-type': 'text/csv', 'last-modified': 'Thu, 10 Sep 2026 17:10:00 GMT' },
    });
    vi.spyOn(response, 'text');
    responses.set(url, response);
    return response;
  };
  vi.stubGlobal('fetch', fakeFetch);
  return { calls, responses };
}

describe('the HTTP slice is bound to its committed byte fingerprints', () => {
  it('fetches each real committed CSV once, verifies it before decode, and preserves carrier versions', async () => {
    const served = serveCommitted();
    const loaded = await loadExoOverHttp(BASE);
    expect(served.calls.map((call) => call.url).sort()).toEqual([`${BASE}data/exo/ps.csv`, `${BASE}data/exo/pscomppars.csv`].sort());
    expect(served.calls.every((call) => call.init?.signal instanceof AbortSignal)).toBe(true);
    expect(loaded.tables.measurements).toHaveLength(20_598);
    expect(loaded.tables.planets).toHaveLength(6_360);
    expect(loaded.sources['ps.csv']).toMatchObject({
      format: 'csv', via: 'http', at: `${BASE}data/exo/ps.csv`, rows: 20_598,
      version: 'etag:W/"published-ps"', sha256: REVIEW_SOURCE_VERSIONS.ps,
    });
    expect(loaded.sources['pscomppars.csv']).toMatchObject({
      format: 'csv', via: 'http', at: `${BASE}data/exo/pscomppars.csv`, rows: 6_360,
      version: 'last-modified:Thu, 10 Sep 2026 17:10:00 GMT', sha256: REVIEW_SOURCE_VERSIONS.pscomppars,
    });
    expect(Number.isNaN(Date.parse(loaded.sources['ps.csv'].retrievedAt))).toBe(false);
    for (const response of served.responses.values()) expect(response.text).toHaveBeenCalledOnce();
  });

  it.each(['ps', 'composite'] as const)('refuses altered %s bytes before the carrier reads that CSV as text', async (file) => {
    // Even harmless extra whitespace changes the bytes that give row ids meaning.
    const served = serveCommitted(file === 'ps' ? { ps: `${PS}\n` } : { composite: `${COMPOSITE}\n` });
    await expect(loadExoOverHttp(BASE)).rejects.toMatchObject({ name: 'SourceRefusal', reason: 'malformed', message: expect.stringContaining('snapshot fingerprint mismatch') });
    const badAt = `${BASE}data/exo/${file === 'ps' ? 'ps.csv' : 'pscomppars.csv'}`;
    expect(served.responses.get(badAt)?.text).not.toHaveBeenCalled();
    expect(served.calls).toHaveLength(2);
  });

  it('rejects an actual changed value even when the server retains its ETag', async () => {
    const served = serveCommitted({ ps: PS.replace('13.89916', '99.89916') });
    expect(PS.includes('13.89916')).toBe(true);
    await expect(loadExoOverHttp(BASE)).rejects.toThrow('snapshot fingerprint mismatch');
    const response = served.responses.get(`${BASE}data/exo/ps.csv`);
    expect(response?.headers.get('etag')).toBe('W/"published-ps"');
    expect(response?.text).not.toHaveBeenCalled();
  });

  it('keeps the carrier refusal for failed HTTP requests', async () => {
    const served = serveCommitted({ status: 403 });
    await expect(loadExoOverHttp(BASE)).rejects.toMatchObject({ name: 'SourceRefusal', reason: 'unauthorized', message: expect.stringContaining('unauthorized (403)') });
    expect(served.calls).toHaveLength(2);
    for (const response of served.responses.values()) expect(response.text).not.toHaveBeenCalled();
  });

  it('fails closed if the browser cannot verify a fingerprint', async () => {
    const served = serveCommitted();
    vi.stubGlobal('crypto', {});
    await expect(loadExoOverHttp(BASE)).rejects.toMatchObject({ name: 'SourceRefusal', reason: 'no-adapter', message: expect.stringContaining('SHA-256 snapshot verification needs Web Crypto') });
    for (const response of served.responses.values()) expect(response.text).not.toHaveBeenCalled();
  });
});
