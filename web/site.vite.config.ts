/**
 * THE STATIC SITE'S BUILD — the two demos as pages that stand alone.
 *
 * On GitHub Pages there is no process, so nothing may point at `/api`. Each
 * desk declares its tables `via: 'http'` at the committed CSVs and fetches
 * them like any other asset; this config's only jobs are to say where the site
 * will be mounted and to put those files where the pages will look.
 *
 * Three pages, one deployable: the index that offers the two demos, and a desk
 * each. They are one build rather than three because the index links to its
 * siblings by relative path, which is what makes the whole site movable.
 *
 * ── The base ────────────────────────────────────────────────────────────────
 * GitHub Pages serves a project site at `/<repo>/`, a local check serves it at
 * `/`, and the same source has to build for both. `SITE_BASE` is that one
 * knob; the default is the repository's own subpath, because the deploy is the
 * case that cannot be re-run by hand if it is wrong.
 *
 *   npm run site:build                     → /vizfootprint-demo/
 *   SITE_BASE=/ npm run site:build         → /
 *
 * Vite writes the value into `import.meta.env.BASE_URL`, and `web/site/boot.tsx`
 * resolves it against the page's location to get the absolute URL the http
 * carrier requires.
 *
 * ── NOT single-file ─────────────────────────────────────────────────────────
 * The story page carries its data inline and is one file on purpose. These two
 * carry 17 MB between them; inlining that would be a file nobody can open. The
 * data is copied beside the pages instead, which is exactly the case the
 * library's story-page ceiling tells a host to reach for `via: 'http'` for.
 */
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_DATA_FILES } from '../src/data/files.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SITE = path.join(HERE, 'site');
const OUT = path.join(REPO, 'dist', 'site');
// storydeck is the third `file:` sibling (the Story tab's scroll lens ships as JSX source).
const STORYDECK = path.resolve(REPO, '..', 'storydeck');

/** Where the site will be mounted. A base must end in a slash, or every relative asset resolves one level up. */
const BASE = ((raw: string) => (raw.endsWith('/') ? raw : `${raw}/`))(process.env['SITE_BASE'] ?? '/vizfootprint-demo/');

/**
 * THE COMMITTED FILES, INTO THE BUILT SITE.
 *
 * Not Vite's `publicDir`: that copies a whole folder, and `data/grid/raw/` is
 * 149 MB of bulk downloads this repository deliberately does not commit. The
 * list is declared in `src/data/files.ts` — the same list the browser loaders
 * fetch — so a file can never be fetched by a page and missing from the build.
 *
 * A missing file FAILS THE BUILD. A site that shipped without its snapshot
 * would look fine until someone opened it, and then say only that a URL
 * answered 404.
 */
function committedData(): Plugin {
  return {
    name: 'vizfootprint-demo:data',
    apply: 'build',
    writeBundle(): void {
      for (const file of SITE_DATA_FILES) {
        const from = path.join(REPO, file);
        if (!existsSync(from)) throw new Error(`the static site needs ${file}, and it is not in this checkout — run the fetch script that writes it before building`);
        const to = path.join(OUT, file);
        mkdirSync(path.dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
    },
  };
}

export default defineConfig({
  root: SITE,
  base: BASE,
  plugins: [react(), committedData()],
  // Every `file:` sibling keeps its own React for its own tests, and storydeck's
  // components run inside ours. Two copies of React is the classic hook crash.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    // a port of its own, so this and the two served pages can run at once. There
    // is no `/api` proxy here on purpose: this build must never reach a server.
    port: 5293,
    strictPort: true,
    fs: { allow: [REPO, path.resolve(REPO, '..', 'vizfootprint'), STORYDECK] },
  },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    rollupOptions: { input: { index: path.join(SITE, 'index.html'), nndss: path.join(SITE, 'nndss', 'index.html'), grid: path.join(SITE, 'grid', 'index.html') } },
  },
});
