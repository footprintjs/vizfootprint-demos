/**
 * THE SERVED DESK, SERVED FOR A BROWSER — the local page and the door it needs,
 * in one process, with no key and no network.
 *
 * `./protSiteServer.ts` does this for the PUBLISHED page, which is static files
 * and nothing else. This page is the other one (`web/src/protServed.tsx`): it
 * performs stage 5, so it needs `/api/prot/*` answered under the SAME ORIGIN —
 * the committed bytes and the hot spots door — and that is exactly what
 * `server/prot-doors.ts` is. So this file is two things bolted together and
 * neither of them is a second implementation:
 *
 *   `serveProtDoors`  the real door, with the SCRIPTED driver
 *                     (`scriptedHotspotDriver`, asked for BY NAME). No key is
 *                     read, no model is called, and the wire says so in three
 *                     places at once.
 *   the built files   `web/dist`, from `npm run web:build` — the real bundle a
 *                     reader opens, not a dev server and not a stub.
 *
 * ── WHY A BROWSER AT ALL, AND WHY THIS ONE ─────────────────────────────────
 * *A script-driven door call is exactly what passed while the page failed last
 * time.* This desk has learned that twice, and both times silently: a dispatch
 * beside the session view landed a commit and moved no picture, and a card
 * carried a stale accessible name under a correct tag. Neither could be seen
 * from anywhere but a real browser driving the real page.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { PROT_API_ROOT, createProtDesk, scriptedHotspotDriver, serveProtDoors, type ProtDesk } from '../server/prot-doors.js';

/** Where `npm run web:build` writes. `web/vite.config.ts` · `build.outDir` is the one place that decides it. */
export const WEB_DIR = path.join(process.cwd(), 'web', 'dist');

/** The served protein page inside it — the file whose absence means there is nothing to serve. */
export const SERVED_PAGE = path.join(WEB_DIR, 'prot', 'index.html');

/** What a built file IS, by its extension — the `./protSiteServer.ts` vocabulary, and nothing guessed. */
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdb': 'text/plain; charset=utf-8',
  '.sto': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * BUILD IT WHEN THE PAGE IS NOT THERE — and say which happened, because a check
 * that quietly did nothing is the green-that-proves-nothing this file exists to
 * stop (`./protSiteServer.ts` · `buildSiteIfMissing` is the same guard for the
 * published page).
 */
export async function buildWebIfMissing(): Promise<'already built' | 'built now'> {
  if (existsSync(SERVED_PAGE)) return 'already built';
  const { build } = await import('vite');
  await build({ configFile: path.join(process.cwd(), 'web', 'vite.config.ts'), logLevel: 'warn' });
  if (!existsSync(SERVED_PAGE)) throw new Error(`the web build ran and wrote no ${path.relative(process.cwd(), SERVED_PAGE)} — nothing can be served`);
  return 'built now';
}

export interface ServedHandle {
  /** The origin the browser opens, with no trailing slash. */
  readonly url: string;
  /** The served protein page's own address, ready for `page.goto`. */
  readonly protUrl: string;
  /** The desk behind the door — so a test can read how many asks it answered. */
  readonly desk: ProtDesk;
  close(): Promise<void>;
}

/**
 * SERVE IT — the built page, the committed bytes and the hot spots door, at one
 * origin.
 *
 * The door goes FIRST, for the reason `server/server.ts` gives about the three
 * desks' doors: whatever claims `/api/` first wins, and a static handler in
 * front of it would answer 404 for every door.
 *
 * Port 0 by default: an ephemeral port cannot collide with a dev server
 * somebody is reading.
 */
export async function startServedProt({ port = 0 }: { readonly port?: number } = {}): Promise<ServedHandle> {
  // THE SCRIPTED DRIVER, ASKED FOR BY NAME — which is the whole of what keeps a
  // scripted ranking from being mistaken for one a model gave, and it is why
  // this suite needs no key (`server/prot-doors.ts` · `HotspotDriver`).
  const desk = createProtDesk(scriptedHotspotDriver());
  const server = http.createServer((req, res) => {
    const asked = (req.url ?? '/').split('?')[0] ?? '/';
    if (asked.startsWith(`${PROT_API_ROOT}/`)) {
      void serveProtDoors(desk, req, res, process.cwd())
        .then((handled) => {
          if (!handled) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end(`no door "${asked}"`);
          }
        })
        .catch((error: unknown) => {
          if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(error instanceof Error ? error.message : String(error));
        });
      return;
    }
    const rest = asked === '/' || asked.endsWith('/') ? `${asked.replace(/^\//, '')}index.html` : asked.replace(/^\//, '');
    // NO PATH IS JOINED FROM A REQUEST: the resolved file must still be inside
    // the built app, or a `..` in the address would read this repository
    const file = path.resolve(WEB_DIR, rest);
    if (!file.startsWith(WEB_DIR + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`${rest} is not in the built app`);
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'content-length': statSync(file).size });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const address = server.address();
  /* c8 ignore next -- `listen` has resolved, so the address is the object form */
  const actual = typeof address === 'object' && address !== null ? address.port : port;
  const url = `http://localhost:${String(actual)}`;
  return {
    url,
    protUrl: `${url}/prot/`,
    desk,
    close: () => new Promise<void>((resolve) => void server.close(() => resolve())),
  };
}

/** The built page's own bytes — so a test can assert what the bundle does and does not carry. */
export const servedPageHtml = (): string => readFileSync(SERVED_PAGE, 'utf8');
