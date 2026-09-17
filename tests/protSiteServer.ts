/**
 * THE BUILT SITE, SERVED — what a real browser needs before it can be asked
 * whether the pictures follow the cursor.
 *
 * `tests/prot-site.test.ts` already walks `dist/site` as FILES. This module
 * serves the same directory over http so a headless Chromium can open the
 * protein page the way a visitor does: one static server, the pages and the
 * committed data underneath it, no `/api` and no process the page could reach.
 * It is the demo's twin of the library's own `ui/gallery/serve.mjs`, which the
 * library's Playwright smokes drive.
 *
 * ── THE BASE IS READ, NEVER ASSUMED ─────────────────────────────────────────
 * The site builds for two mounts — `/vizfootprint-demo/` for GitHub Pages and
 * `/` for a local check (`web/site.vite.config.ts` · `SITE_BASE`) — and the
 * artifact in a checkout may be either. So {@link baseOf} reads the base back
 * off a built page's own asset URLs rather than guessing, and the server maps
 * `<base><path>` to `dist/site/<path>`. A helper that assumed one of the two
 * would answer 404 for every asset of a site built the other way, and the test
 * would report a blank page instead of a wrong one.
 *
 * ── IT BUILDS WHEN THERE IS NOTHING TO SERVE ────────────────────────────────
 * `dist/` is git-ignored, so a fresh checkout has no bundle — and a browser
 * assertion that skipped itself there would be exactly the green-that-proves-
 * nothing this packet exists to stop. {@link buildSiteIfMissing} runs the real
 * build through Vite's own API when the protein page is absent (about seven
 * seconds on the machine this was written on) and says which of the two it did.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

/** Where the static build lands — `web/site.vite.config.ts` · `OUT`, the one place that decides it. */
export const SITE_DIR = path.join(process.cwd(), 'dist', 'site');

/** The protein page inside it — the file whose absence means there is nothing to serve. */
export const PROT_PAGE = path.join(SITE_DIR, 'prot', 'index.html');

/**
 * What a built file IS, by its extension.
 *
 * `.pdb` is `text/plain` for the same reason the dev route says so
 * (`web/site.vite.config.ts` · `DATA_TYPES`): the format has no media type
 * anything here would honour, and the page reads it as text. Anything unlisted
 * is served as bytes rather than guessed at — a guess would be this file
 * deciding what a page may parse.
 */
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdb': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * THE BASE THE SITE WAS BUILT FOR, read off a built page.
 *
 * Vite rewrites every asset reference to `<base>assets/<file>`, so the text
 * before `assets/` IS the base. A page with no asset reference is a page that
 * did not build, and saying that is more use than defaulting to a base that
 * would 404 on every request.
 */
export function baseOf(html: string): string {
  const found = /(?:src|href)="([^"]*?)assets\//.exec(html);
  if (found === null) throw new Error('the built protein page references no asset under `assets/`, so the base it was built for cannot be read — rebuild the site');
  return found[1] === '' ? '/' : found[1]!;
}

/**
 * BUILD THE SITE WHEN THE PAGE IS NOT THERE — and say which happened, because a
 * check that quietly did nothing is the failure this whole file guards against.
 *
 * The build is the repository's own (`web/site.vite.config.ts`, through Vite's
 * API rather than a second spelling of it), at the `/` mount — a local check has
 * no repository subpath in front of it, and {@link baseOf} means a checkout that
 * already holds the Pages build is served just as well.
 */
export async function buildSiteIfMissing(): Promise<'already built' | 'built now'> {
  if (existsSync(PROT_PAGE)) return 'already built';
  const { build } = await import('vite');
  const was = process.env['SITE_BASE'];
  process.env['SITE_BASE'] = '/';
  try {
    await build({ configFile: path.join(process.cwd(), 'web', 'site.vite.config.ts'), logLevel: 'warn' });
  } finally {
    if (was === undefined) delete process.env['SITE_BASE'];
    else process.env['SITE_BASE'] = was;
  }
  if (!existsSync(PROT_PAGE)) throw new Error(`the site build ran and wrote no ${path.relative(process.cwd(), PROT_PAGE)} — nothing can be served`);
  return 'built now';
}

export interface SiteHandle {
  /** The origin the browser opens, with no trailing slash. */
  readonly url: string;
  /** The base the artifact was built for, with its trailing slash — the prefix every page and asset sits under. */
  readonly base: string;
  /** The protein page's own address, ready for `page.goto`. */
  readonly protUrl: string;
  close(): Promise<void>;
}

/**
 * SERVE IT — the pages, the chunks and the committed data, at whatever base the
 * artifact carries.
 *
 * Port 0 by default: an ephemeral port cannot collide with a dev server
 * somebody is reading.
 */
export async function startProtSite({ port = 0 }: { readonly port?: number } = {}): Promise<SiteHandle> {
  const base = baseOf(readFileSync(PROT_PAGE, 'utf8'));
  const server = http.createServer((req, res) => {
    const asked = (req.url ?? '/').split('?')[0] ?? '/';
    // under the base, and nowhere else: a request that does not carry it is not
    // a request this site could ever have made
    const within = asked.startsWith(base) ? asked.slice(base.length) : null;
    if (within === null) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`this server mounts the built site at ${base} and ${asked} is not under it`);
      return;
    }
    const rest = within === '' || within.endsWith('/') ? `${within}index.html` : within;
    // NO PATH IS JOINED FROM A REQUEST: the resolved file must still be inside
    // the built site, or a `..` in the address would read this repository
    const file = path.resolve(SITE_DIR, rest);
    if (!file.startsWith(SITE_DIR + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`${rest} is not in the built site`);
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
    base,
    protUrl: `${url}${base}prot/`,
    close: () => new Promise<void>((resolve) => void server.close(() => resolve())),
  };
}
