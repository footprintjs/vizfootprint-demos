/**
 * The demo server — Node's built-in http, TWO live surfaces (the NNDSS desk and
 * the EIA grid) in one process, the doors.
 *
 *   npm run serve          → http://localhost:5290/api/state
 *                          → http://localhost:5290/api/grid/rows
 *
 * In development the web app (`npm run web:dev`, port 5291) proxies `/api`
 * here; a production build is served from `web/dist` by this process.
 */
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesk, serveDoors } from './doors.js';
import { createGridDesk, serveGridDoors } from './grid-doors.js';
import { createProtDesk, serveProtDoors } from './prot-doors.js';
import { MODEL } from '../src/nndss/analyst.js';
import { loadGraphAsync, loadSnapshotAsync } from '../src/nndss/snapshot.js';
import { loadGridAsync } from '../src/grid/snapshot.js';
import { loadEnv } from './env.js';

const PORT = Number(process.env['PORT'] ?? 5290);
const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

loadEnv(); // the repo's own .env, if any — names only ever reach the log, never values
// the CDC snapshot through the library's source layer: a declared file source, with the provenance the file system vouches for
const snapshot = await loadSnapshotAsync();
// the graph the generator derived from that snapshot, through the same carrier — two more files the desk can vouch for by version
const graph = await loadGraphAsync();
const desk = await createDesk(snapshot.tables, [], { 'snapshot.csv': snapshot.source, ...snapshot.sources, ...graph.sources }, graph.graph); // what the carrier vouched for, beside the library's own per-table provenance
console.log(`  source: snapshot.csv via file — ${String(snapshot.source.rows)} rows, ${snapshot.source.version}, read ${snapshot.source.retrievedAt}`);
// The denominator through the same carrier, and what the two rate acts left on
// the log — a refusal is printed, never swallowed. PLACES is the table the join reads, ROWS is what the carrier parsed: `populationRowsFrom`
// drops any row with no name, no positive population, or a name covering different people than
// CDC's row of it, so printing the file's row count under the word "places" would name a
// denominator the desk does not have. The two numbers beside each other show what was dropped.
const people = snapshot.sources['population.csv'];
console.log(`  population: ${String(snapshot.tables.population?.length ?? 0)} places of ${String(people.rows)} rows, ${people.version} · rate: ${desk.surface.rateRefusals.length === 0 ? 'both acts landed' : desk.surface.rateRefusals.join('; ')}`);
// the same law on the same line as the acts it reports: `layOutGraph` returns its refusals
// rather than throwing so a caller can print them, and a clean-looking graph line beside a
// line that volunteers its own refusals is the operator learning it from the page instead
console.log(`  graph: nodes ${String(graph.graph.nodes.length)} · edges ${String(graph.graph.edges.length)} — ${graph.sources['graph/nodes.csv'].version}, ${graph.sources['graph/edges.csv'].version} · layout: ${desk.surface.layoutRefusals.length === 0 ? 'both acts landed' : desk.surface.layoutRefusals.join('; ')}`);

// THE SECOND DEMO, in the same process: EIA's hourly grid through the same
// carrier, its four tables behind `/api/grid/*`. The CDC graph rides across as
// COUNTS — 15 diseases, 105 undirected pairs — so the grid page can put the
// library's reading rule to both graphs and render both answers rather than
// carrying a verdict somebody typed.
const grid = await loadGridAsync();
const gridDesk = await createGridDesk(grid.tables, grid.sources, {
  label: 'the CDC disease co-occurrence graph',
  nodes: graph.graph.nodes.length,
  edges: graph.graph.edges.length,
  interaction: true,
});
console.log(`  grid: ${String(grid.tables.authorities.length)} authorities · ${String(grid.tables.links.length)} directed links · ${String(grid.tables.hourly.length)} hours — ${grid.sources['balance.csv'].version}, ${grid.sources['interchange.csv'].version}`);

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = (req.url ?? '/').split('?')[0] ?? '/';
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(WEB_DIST, rel);
  // WHY `isFile` and not `existsSync`: `web/dist/make/` and `web/dist/assets/` are
  // DIRECTORIES the built site's own URLs name, `existsSync` says yes to them, and
  // `readFileSync` on one throws EISDIR. A directory is not a 500, it is a 404.
  if (!file.startsWith(WEB_DIST) || statSync(file, { throwIfNoEntry: false })?.isFile() !== true) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(existsSync(WEB_DIST) ? 'not found' : 'no web build yet — run `npm run web:dev` for the dev server, or `npm run web:build`');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

/**
 * THE THIRD DESK'S DOORS, and they exist for ONE stage.
 *
 * The protein desk is the client-only one: it performs stages 1 to 4 in a
 * browser and the published build says out loud that it cannot perform stage 5,
 * because a static page cannot hold the key that would call a model
 * (`src/prot/plan.ts` · step 5). **This process is the local half of that
 * sentence.** It holds no protein session — the page holds the dashboard, the
 * commit log and the rows, and lands the ranking as an act on its own log —
 * so all this desk carries is a DRIVER, and whether there is one at all is
 * decided by what this environment offered (`./prot-doors.ts` ·
 * `chooseHotspotDriver`, the one line here that reads a key).
 */
const protDesk = createProtDesk();
console.log(`  hot spots (stage 5): ${protDesk.driver.mode === 'live' ? `live (ANTHROPIC_API_KEY present) · model ${protDesk.driver.model} · ${protDesk.driver.judge.weaker ? 'a weaker standing judge, on the same family of model' : 'a calibrated standing judge'}` : protDesk.driver.mode === 'scripted' ? 'scripted, because PROT_SCRIPTED=1 asked for it — no model is asked and the wire says so' : 'no key, so the stage cannot run here and says so rather than showing a scripted ranking (PROT_SCRIPTED=1 asks for that by name)'}`);

// THE GRID'S DOORS COME FIRST, and the order is load-bearing: `serveDoors`
// claims everything under `/api/`, so `/api/grid/rows` reaching it would be
// answered `no door "grid/rows"` rather than reaching the grid at all. The
// protein desk's doors are in front of it for exactly the same reason.
const server = http.createServer((req, res) => {
  void serveProtDoors(protDesk, req, res)
    .then((handled) => (handled ? true : serveGridDoors(gridDesk, req, res)))
    .then((handled) => (handled ? true : serveDoors(desk, req, res)))
    .then((handled) => {
      if (!handled) serveStatic(req, res);
    })
    // WHY the chain must end in a catch: both door functions catch inside
    // themselves, so `serveStatic` is the one throw that reaches here — and an
    // unhandled rejection on a voided chain is a process EXIT under Node's
    // default, not a 500. One request would take both desks, the analyst
    // session and the grid down with it. A server that will not start is worse
    // than a surface that says why, and so is one that will not stay up.
    .catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`  ${req.method ?? 'GET'} ${req.url ?? '/'} — ${detail}`);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(detail);
    });
});

server.listen(PORT, () => {
  const { tables } = desk.surface;
  console.log(`\n  vizfootprint-demo · NNDSS → http://localhost:${String(PORT)}`);
  console.log(`  cells ${String(tables.cells.length)} · series ${String(tables.series.length)} · diseases ${String(tables.diseases.length)} · weeks ${String(tables.weeks.length)}`);
  console.log(`  states: ${Object.entries(tables.counts).map(([k, v]) => `${k} ${String(v)}`).join(' · ')}`);
  console.log(`  analyst: ${desk.mode === 'live' ? `live (ANTHROPIC_API_KEY present) · model ${MODEL}` : 'mock — scripted turn (put ANTHROPIC_API_KEY in .env for live)'}`);
  const g = gridDesk.surface.tables;
  console.log(`  grid → http://localhost:${String(PORT)}/api/grid/rows · ${String(g.authorities.length)} authorities · ${String(g.links.length)} links · ${String(g.interchange.length)} flows\n`);
});
