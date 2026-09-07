# src/source — the carrier this repo owns

One file, one job: fetch a table's bytes over http so a page with no server can
still declare its data the way the library asks.

## The law: a page's data is a DECLARED SOURCE, not a fetch call

A table says three things — a **format** (`csv`, `json`, `rows`), a **via**
(`inline`, `file`, `http`) and an **at**. The carrier for the via reads it and
vouches for a **version**. Nothing downstream knows the difference, which is
why the same definition serves the server and the static site.

```ts
const handle = await openSource({ format: 'csv', via: 'http', at: 'https://host/data/nndss/snapshot.csv' }, 'cells', [httpSource()]);
const snap = await handle.snapshot();   // { rows, version: 'etag:"9f1…"', retrievedAt }
```

## The law: the version is what the SERVER vouches for, never what we wish

An ETag exactly as sent (weak marker and quotes kept — `If-None-Match` compares
weakly, so a tidied tag would never match again), else `Last-Modified`, else a
hash of the bytes. The hash is last because it costs a read, and present
because a version is not optional: every commit the session lands stamps the
version its tables were true of.

```ts
await handle.snapshot({ sinceVersion: 'etag:"9f1…"' });   // → { unchanged: true, version } on a 304
```

## The law: every way a read can fail has a NAME from the library's vocabulary

`no-adapter` · `malformed` · `unavailable` · `unauthorized` · `disconnected` ·
`timeout` · `cancelled` · `too-large` — thrown as the library's own
`SourceRefusal`, so a host that already handles a file carrier's refusals
handles these unchanged. A 2xx with an empty body is `unavailable`, not an
empty table: the place answered without data, and a zero is not an absence.

```ts
// table "cells" http source https://host/data/nndss/snapshot.csv: unavailable (404)
```

## Why this file is here rather than imported

The library has this carrier — `vizfootprint/src/source/http.ts`, tested, and
compiled into `dist/source/http.js`. It has no way OUT: `package.json`'s
`exports` map lists `./source` and `./source/file` and no `./source/http`, and
the `source` barrel does not re-export `httpSource`. So this repo implements
the same published port using the library's own `SourceRefusal`, `decodeRows`
and `fnv1a`. When the library exports its carrier, delete this file and change
one import line — every caller already says `httpSource()`.
