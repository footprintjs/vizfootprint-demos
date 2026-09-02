/**
 * The demo server — Node's built-in http, one live surface, the doors.
 *
 *   npm run serve          → http://localhost:5290/api/state
 *
 * In development the web app (`npm run web:dev`, port 5291) proxies `/api`
 * here; a production build is served from `web/dist` by this process.
 */
import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesk, serveDoors } from './doors.js';
import { MODEL } from '../src/nndss/analyst.js';
import { loadSnapshotAsync } from '../src/nndss/etl.js';
import { loadEnv } from './env.js';

const PORT = Number(process.env['PORT'] ?? 5290);
const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

loadEnv(); // the repo's own .env, if any — names only ever reach the log, never values
// the CDC snapshot through the library's source layer: a declared file source, with the provenance the file system vouches for
const snapshot = await loadSnapshotAsync();
const desk = createDesk(snapshot.tables, [], { 'snapshot.csv': snapshot.source }); // what the carrier vouched for, beside the library's own per-table provenance
console.log(`  source: snapshot.csv via file — ${String(snapshot.source.rows)} rows, ${snapshot.source.version}, read ${snapshot.source.retrievedAt}`);

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = (req.url ?? '/').split('?')[0] ?? '/';
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(WEB_DIST, rel);
  if (!file.startsWith(WEB_DIST) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(existsSync(WEB_DIST) ? 'not found' : 'no web build yet — run `npm run web:dev` for the dev server, or `npm run web:build`');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

const server = http.createServer((req, res) => {
  void serveDoors(desk, req, res).then((handled) => {
    if (!handled) serveStatic(req, res);
  });
});

server.listen(PORT, () => {
  const { tables } = desk.surface;
  console.log(`\n  vizfootprint-demo · NNDSS → http://localhost:${String(PORT)}`);
  console.log(`  cells ${String(tables.cells.length)} · series ${String(tables.series.length)} · diseases ${String(tables.diseases.length)} · weeks ${String(tables.weeks.length)}`);
  console.log(`  states: ${Object.entries(tables.counts).map(([k, v]) => `${k} ${String(v)}`).join(' · ')}`);
  console.log(`  analyst: ${desk.mode === 'live' ? `live (ANTHROPIC_API_KEY present) · model ${MODEL}` : 'mock — scripted turn (put ANTHROPIC_API_KEY in .env for live)'}\n`);
});
