/**
 * THE EXOPLANET PAGE, ALONE — a dev server and a build for the third demo on
 * its own.
 *
 * `web/site.vite.config.ts` builds all four pages of the published site
 * together, and that is what ships. This config exists for the other case: a
 * developer changing one chart on one desk, who should not rebuild the CDC
 * demo's 8 MB snapshot and the grid's 149,848 flow rows to see it.
 *
 *   npm run exo:dev     → http://localhost:5294/exo/   (this page, watched)
 *   npm run exo:page    → dist/exo/                     (this page, built)
 *
 * WHY IT IS THE STATIC PAGE and not a served twin: this demo has no server
 * doors. `web/grid.vite.config.ts` proxies `/api` to the demo server because
 * the grid desk has a served host; the exoplanet desk was built for the static
 * site from the start, so the only host it has is `web/site/exo/entry.tsx` and
 * this config points at exactly that. Nothing here may reach a process.
 *
 * ── The one thing this config must do that the site build does not ──────────
 * CARRY `data/` ITSELF, both ways. The page fetches its two CSVs at
 * site-relative paths (`data/exo/ps.csv`), and the published site's build copies
 * them beside its four pages (`committedData` in `site.vite.config.ts`). This
 * build has neither that plugin nor a server, so `repoData` below does both
 * halves for this one page: in dev it ANSWERS those paths out of the repository,
 * and in a build it COPIES the same files beside the page. Without it the page
 * would show the carrier's 404 refusal instead of a dashboard — a build that
 * cannot find its own data is not a build.
 *
 * Only the DECLARED list is reachable either way (`SITE_DATA_FILES` — the same
 * list the site build copies and the loaders fetch), narrowed to what THIS page
 * reads, so this is not a way to serve the repository over http.
 */
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_DATA_FILES } from '../src/data/files.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const PAGE = path.join(HERE, 'site', 'exo');
// storydeck is the third `file:` sibling (the Story tab's scroll lens ships as JSX source).
const STORYDECK = path.resolve(REPO, '..', 'storydeck');

/** Mounted at `/exo/` so this page's own URL matches the published site's, and a link written here holds there. */
const BASE = '/exo/';

/** The MIME types the committed data uses. Declared, because a CSV served as HTML is parsed as one line of nonsense. */
const TYPES: Readonly<Record<string, string>> = { '.csv': 'text/csv; charset=utf-8', '.json': 'application/json; charset=utf-8', '.geojson': 'application/json; charset=utf-8' };

/**
 * The files THIS page reads: its two tables and the two records that travel with
 * them. Read off the declared lists, never retyped — a file this page fetches
 * can therefore never be missing from what this config carries.
 */
const PAGE_FILES: readonly string[] = SITE_DATA_FILES.filter((file) => file.startsWith('data/exo/'));

/**
 * The repository's committed data — answered in dev, copied in a build.
 *
 * A path not in {@link PAGE_FILES} falls through to Vite and 404s like anything
 * else, so this cannot become a way to read the repository over http. A missing
 * file FAILS THE BUILD, for the reason the site config gives: a page that
 * shipped without its tables would look fine until somebody opened it, and then
 * say only that a URL answered 404.
 */
function repoData(): Plugin {
  const allowed = new Set<string>(PAGE_FILES);
  return {
    name: 'vizfootprint-demo:exo-data',
    writeBundle(): void {
      for (const file of PAGE_FILES) {
        const from = path.join(REPO, file);
        if (!existsSync(from)) throw new Error(`the exoplanet page needs ${file}, and it is not in this checkout — run \`npm run data:exo\` and \`npm run exo:generate\` before building`);
        const to = path.join(REPO, 'dist', 'exo', file);
        mkdirSync(path.dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
    },
    configureServer(server): void {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? '';
        // the page resolves `data/exo/ps.csv` against its base, so the request arrives under it
        const asked = url.startsWith(BASE) ? url.slice(BASE.length) : url.replace(/^\//, '');
        if (!allowed.has(asked)) {
          next();
          return;
        }
        const from = path.join(REPO, asked);
        if (!existsSync(from)) {
          next();
          return;
        }
        res.setHeader('content-type', TYPES[path.extname(asked)] ?? 'application/octet-stream');
        createReadStream(from).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: PAGE,
  base: BASE,
  plugins: [react(), repoData()],
  // Every `file:` sibling keeps its own React for its own tests, and storydeck's
  // components run inside ours. Two copies of React is the classic hook crash.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    // a port of its own, so this page and the other three dev servers can run at once
    port: 5294,
    strictPort: true,
    fs: { allow: [REPO, path.resolve(REPO, '..', 'vizfootprint'), STORYDECK] },
  },
  build: { outDir: path.join(REPO, 'dist', 'exo'), emptyOutDir: true },
});
