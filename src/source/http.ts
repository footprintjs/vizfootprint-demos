/**
 * THE HTTP CARRIER — a URL fetched by the page itself.
 *
 * The library's source layer is a PORT: `SourceAdapter { via, open }`, and
 * `openSource(decl, table, adapters)` takes the carriers explicitly. The demo
 * already passes the library's own `fileSource` on the server. In the browser
 * there is no disk, so the same declaration — `{ format: 'csv', via: 'http',
 * at }` — needs a carrier that fetches.
 *
 * ── WHY this file exists in the DEMO and not in the library ─────────────────
 * The library HAS this carrier: `vizfootprint/src/source/http.ts`, written,
 * tested (`http.test.ts`), and compiled to `dist/source/http.js`. It is not
 * REACHABLE: `package.json`'s `exports` map declares `./source` and
 * `./source/file` and no `./source/http`, and `src/source/index.ts` does not
 * re-export `httpSource`. A consumer therefore cannot import it by any
 * specifier Node or Vite will resolve. So this module implements the same
 * published port, against the library's own vocabulary — `SourceRefusal`,
 * `decodeRows`, `fnv1a` are all exported — and the day the library adds the
 * one export line, this file is deleted and the import moves. Nothing else in
 * the demo has to change: every caller says `httpSource()` and passes it to
 * `openSource`.
 *
 * The rules below are the library's rules, followed deliberately so that the
 * swap is a swap and not a behaviour change.
 */
import { SourceRefusal, decodeRows, fnv1a, isSourceRefusal } from 'vizfootprint/source';
import type { SourceAdapter, SourceDecl, SourceSnapshot, SourceUnchanged } from 'vizfootprint/source';

export interface HttpSourceOptions {
  /** The fetch to use — default the global one, read at call time so a test can swap it. */
  readonly fetch?: typeof fetch;
  /** No answer — headers AND body — within this many ms is a `timeout` refusal. */
  readonly timeoutMs?: number;
  /** Headers sent with every request. */
  readonly headers?: Readonly<Record<string, string>>;
  /** A body beyond this many bytes is `too-large`. */
  readonly maxBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

/**
 * The conditional-read header for a version we hold. An ETag goes back EXACTLY
 * as the server sent it, weak marker and quotes included — RFC 9110 §13.1.2
 * compares `If-None-Match` weakly, and a version that had been tidied would
 * compare unequal to the one the server will send next time.
 */
function conditionalHeaders(sinceVersion: string | undefined): Record<string, string> {
  if (sinceVersion === undefined) return {};
  if (sinceVersion.startsWith('etag:')) return { 'if-none-match': sinceVersion.slice('etag:'.length) };
  if (sinceVersion.startsWith('last-modified:')) return { 'if-modified-since': sinceVersion.slice('last-modified:'.length) };
  return {};
}

/**
 * What the server VOUCHES FOR, in the order it is worth trusting: its own
 * entity tag, then its modification time, and only when it vouches for nothing
 * a hash of the bytes we read. The hash is last because it costs a read; it is
 * present because a version is not optional.
 */
function versionOf(res: Response, text: string): string {
  const etag = res.headers.get('etag');
  if (etag !== null) return `etag:${etag.trim()}`;
  const lastModified = res.headers.get('last-modified');
  if (lastModified !== null) return `last-modified:${lastModified}`;
  return `hash:${fnv1a(text)}`;
}

/** Release a body we will not read. Cleanup never changes the diagnosis, so a cancel that rejects is swallowed. */
async function drain(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* a fetch whose cancel rejects still leaves the refusal we already have */
  }
}

/** The carrier. One adapter, `via: 'http'`, declaring the two capabilities it truly has. */
export function httpSource(options: HttpSourceOptions = {}): SourceAdapter {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  return {
    via: 'http',
    open(decl: SourceDecl, { table }: { readonly table: string }) {
      const at = decl.at;
      if (typeof at !== 'string' || !/^https?:\/\//.test(at)) {
        return Promise.reject(new SourceRefusal('malformed', `table "${table}" http source: \`at\` must be an http(s) URL, and it is ${JSON.stringify(at)}`, table, 'http'));
      }
      const refuse = (reason: SourceRefusal['reason'], detail: string): SourceRefusal => new SourceRefusal(reason, `table "${table}" http source ${at}: ${detail}`, table, 'http');
      return Promise.resolve({
        capabilities: { live: false, pushdown: false },
        snapshot: (opts?: { readonly signal?: AbortSignal; readonly sinceVersion?: string }): Promise<SourceSnapshot | SourceUnchanged> => read({ ...decl, at }, refuse, opts, { fetch: options.fetch, headers: options.headers, timeoutMs, maxBytes }),
        close: (): Promise<void> => Promise.resolve(),
      });
    },
  };
}

interface ReadSettings {
  readonly fetch?: typeof fetch;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly maxBytes: number;
}

/** The request, under the timeout and the caller's signal — everything that can go wrong on the wire. */
async function fetchText(at: string, refuse: (reason: SourceRefusal['reason'], detail: string) => SourceRefusal, opts: { readonly signal?: AbortSignal; readonly sinceVersion?: string } | undefined, settings: ReadSettings): Promise<{ readonly res: Response; readonly text: string } | { readonly unchanged: string }> {
  const doFetch = settings.fetch ?? globalThis.fetch;
  // a missing runtime fetch is a missing CARRIER, not a network fault
  if (typeof doFetch !== 'function') throw refuse('no-adapter', 'no-adapter — this runtime has no fetch; pass one in httpSource({ fetch })');
  // WHY a function and not the property: `aborted` flips DURING the await below,
  // and a compiler that narrowed it at the guard would read the stale answer in
  // the catch — the difference between "cancelled" and "timeout".
  const cancelled = (): boolean => opts?.signal?.aborted === true;
  if (cancelled()) throw refuse('cancelled', 'cancelled — the request was aborted before it started');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  const onAbort = (): void => controller.abort();
  opts?.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await doFetch(at, { headers: { ...(settings.headers ?? {}), ...conditionalHeaders(opts?.sinceVersion) }, signal: controller.signal });
    if (res.status === 304 && opts?.sinceVersion !== undefined) {
      await drain(res);
      return { unchanged: opts.sinceVersion };
    }
    if (res.status === 401 || res.status === 403) {
      await drain(res);
      throw refuse('unauthorized', `unauthorized (${String(res.status)})`);
    }
    if (!res.ok) {
      await drain(res);
      throw refuse('unavailable', `unavailable (${String(res.status)})`);
    }
    // the one real guard, before a byte is read: what the server DECLARES it will send
    const declared = Number(res.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > settings.maxBytes) {
      await drain(res);
      throw refuse('too-large', `too-large — the server declares ${String(declared)} bytes, the cap is ${String(settings.maxBytes)}`);
    }
    return { res, text: await res.text() };
  } catch (e) {
    if (isSourceRefusal(e)) throw e;
    if (cancelled()) throw refuse('cancelled', 'cancelled — the request was aborted');
    if (controller.signal.aborted) throw refuse('timeout', `timeout — no answer within ${String(settings.timeoutMs)} ms`);
    throw refuse('disconnected', `disconnected — ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * One read: the bytes, the version, the rows — or one named refusal.
 *
 * WHY the decl and not a format argument: a carrier never learns a format. The
 * DECLARATION says what shape the bytes are, `decodeRows` is the one decoder,
 * and this function's whole job is to put the two together.
 */
async function read(decl: SourceDecl & { readonly at: string }, refuse: (reason: SourceRefusal['reason'], detail: string) => SourceRefusal, opts: { readonly signal?: AbortSignal; readonly sinceVersion?: string } | undefined, settings: ReadSettings): Promise<SourceSnapshot | SourceUnchanged> {
  const got = await fetchText(decl.at, refuse, opts, settings);
  if ('unchanged' in got) return { unchanged: true, version: got.unchanged };
  const { res, text } = got;
  // the place answered WITHOUT DATA — the zero-becomes-absence class, refused by name
  if (text.length === 0) throw refuse('unavailable', `unavailable (${String(res.status)} with an empty body)`);
  if (text.length > settings.maxBytes) throw refuse('too-large', `too-large — ${String(text.length)} UTF-16 units arrived (the server declared no length), the cap is ${String(settings.maxBytes)}`);
  const version = versionOf(res, text);
  // a server that vouches for nothing: the hash decides the conditional read AFTER
  // the read — the bytes moved or they did not, and the decode is saved either way
  if (opts?.sinceVersion !== undefined && opts.sinceVersion === version) return { unchanged: true, version };
  let payload: unknown = text;
  if (decl.format === 'rows') {
    try {
      payload = JSON.parse(text);
    } catch {
      throw refuse('malformed', 'format rows needs a JSON list of row objects, and the body is not JSON');
    }
  }
  const rows = decodeRows(decl.format, payload, decl.options);
  if ('rejected' in rows) throw refuse('malformed', rows.rejected);
  return { rows, version, retrievedAt: new Date().toISOString() };
}
