/**
 * THE STATIC SITE'S BUILD — the demos as pages that stand alone.
 *
 * On GitHub Pages there is no process, so nothing may point at `/api`. Each
 * desk declares its tables `via: 'http'` at the committed CSVs and fetches
 * them like any other asset; this config's only jobs are to say where the site
 * will be mounted and to put those files where the pages will look.
 *
 * Six pages, one deployable: the index that offers the demos, and a desk
 * each. They are one build rather than six because the index links to its
 * siblings by relative path, which is what makes the whole site movable.
 *
 * THE FIFTH DESK (`hot`) opens the SAME PDB entry as the fourth and is a
 * different dashboard over it — hot spots scored by arithmetic rather than
 * ranked by a model (`src/hot/def.ts`). It has an entry of its own rather than
 * reusing `prot`'s, because a shared entry would be one bundle deciding at run
 * time which desk it is. It mounts no 3D viewer, so it names the viewer's chunk
 * nowhere — asserted in `tests/hot-site.test.ts`.
 *
 * THE FOURTH DESK CARRIES A THIRD-PARTY VIEWER (Mol*), and it is reached by a
 * DYNAMIC IMPORT inside the renderer's mount (`web/src/molstarRenderer.ts`), so
 * rollup gives it a chunk of its own and the other four desks load none of it.
 * That is a property worth keeping: it is asserted in `tests/prot-site.test.ts`
 * against the built bundle.
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
 * The story page carries its data inline and is one file on purpose. These
 * four carry 27.8 MB between them; inlining that would be a file nobody can open. The
 * data is copied beside the pages instead, which is exactly the case the
 * library's story-page ceiling tells a host to reach for `via: 'http'` for.
 */
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_DATA_FILES } from '../src/data/files.js';
import { SITE_CARDS_FILE } from '../src/site/cardsFile.js';
import { siteCards, writeSiteCards } from '../src/site/cards.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SITE = path.join(HERE, 'site');
const OUT = path.join(REPO, 'dist', 'site');
// storydeck is the third `file:` sibling (the Story tab's scroll lens ships as JSX source).
const STORYDECK = path.resolve(REPO, '..', 'storydeck');

/** Where the site will be mounted. A base must end in a slash, or every relative asset resolves one level up. */
const BASE = ((raw: string) => (raw.endsWith('/') ? raw : `${raw}/`))(process.env['SITE_BASE'] ?? '/vizfootprint-demo/');

/**
 * What the dev route says a committed file IS, by its extension.
 *
 * A PDB entry is `text/plain`: the format has no media type of its own that
 * anything here would honour, and the page reads it as text. Anything not
 * listed is served as bytes rather than guessed at.
 */
const DATA_TYPES: Readonly<Record<string, string>> = {
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdb': 'text/plain; charset=utf-8',
};

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
    writeBundle(): void {
      for (const file of SITE_DATA_FILES) {
        const from = path.join(REPO, file);
        if (!existsSync(from)) throw new Error(`the static site needs ${file}, and it is not in this checkout — run the fetch script that writes it before building`);
        const to = path.join(OUT, file);
        mkdirSync(path.dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
    },
    /**
     * THE SAME REGISTRY, UNDER `site:dev`.
     *
     * This plugin used to be `apply: 'build'`, and under the dev server the
     * data was therefore served by NOBODY: vite's root is `web/site` and every
     * committed file lives outside it, so a page's fetch fell through to the
     * SPA fallback and came back as `index.html` with a 200. A CSV carrier
     * parses that HTML into nonsense rows without a word; the protein desk's
     * own door caught it, because a PDB entry must begin with a HEADER record
     * and it says so by name (`src/prot/http.ts`). That refusal is what made
     * this a two-minute diagnosis from a browser.
     *
     * So the arm exists, and it serves EXACTLY {@link SITE_DATA_FILES} — one
     * owner for the list the build copies, the loaders fetch and this route
     * answers, which is the only way dev and production can agree about what a
     * page may read. A path outside the list is not served here at all
     * (`next()`), and a listed file missing from the checkout is a 404 WITH A
     * SENTENCE rather than a fallback page: a loader can print the sentence,
     * and it cannot print HTML it mistook for data.
     */
    configureServer(server): void {
      server.middlewares.use((req, res, next) => {
        const asked = (req.url ?? '').split('?')[0] ?? '';
        const file = asked.startsWith(BASE) ? asked.slice(BASE.length) : undefined;
        if (file === undefined || !SITE_DATA_FILES.includes(file)) {
          next();
          return;
        }
        const from = path.join(REPO, file);
        if (!existsSync(from)) {
          res.statusCode = 404;
          res.setHeader('content-type', 'text/plain');
          res.end(`${file} is declared by a page of this site and is not in this checkout — run the fetch script in its data folder`);
          return;
        }
        res.setHeader('content-type', DATA_TYPES[path.extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(from));
      });
    },
  };
}

/**
 * THE CARDS, INTO THE BUILT SITE.
 *
 * `src/site/cards.ts` builds every surface the way it really builds and runs
 * the library's two readers over it; this plugin decides only WHEN and WHERE.
 * In a build the file lands beside the copied tables — `writeBundle`, the same
 * moment `committedData` runs — and under `site:dev` the same bytes are served
 * from memory at the same address, computed on the first request, so the front
 * page fetches one path in both.
 *
 * WHY THIS CONFIG NOW LOADS THE LIBRARY, when `committedData` went out of its
 * way not to: a file NAME must never depend on evaluating a dashboard, and it
 * still does not — `SITE_CARDS_FILE` comes from an import-free module the page
 * shares. The cards themselves ARE the library's readers over the built
 * definitions; there is no cheaper honest way to get them, and a site whose
 * pages bundle the library could not be built without it anyway.
 */
function demoCards(): Plugin {
  let inMemory: string | undefined;
  return {
    name: 'vizfootprint-demo:cards',
    writeBundle(): void {
      const to = writeSiteCards(OUT);
      console.log(`cards: wrote ${path.relative(REPO, to)}`);
    },
    configureServer(server): void {
      server.middlewares.use((req, res, next) => {
        if (req.url !== `${BASE}${SITE_CARDS_FILE}`) {
          next();
          return;
        }
        inMemory ??= JSON.stringify(siteCards());
        res.setHeader('content-type', 'application/json');
        res.end(inMemory);
      });
    },
  };
}

export default defineConfig({
  root: SITE,
  base: BASE,
  plugins: [react(), committedData(), demoCards()],
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
    rollupOptions: {
      input: {
        index: path.join(SITE, 'index.html'),
        nndss: path.join(SITE, 'nndss', 'index.html'),
        grid: path.join(SITE, 'grid', 'index.html'),
        exo: path.join(SITE, 'exo', 'index.html'),
        prot: path.join(SITE, 'prot', 'index.html'),
        // THE FIFTH DESK — its own entry, exactly as `prot` is its own, and
        // never a second page reusing `prot`'s. It opens the same PDB entry and
        // is a DIFFERENT dashboard over it (`src/hot/def.ts`), so sharing an
        // input would have meant one bundle deciding at run time which desk it
        // is, which is the one thing a static site cannot pay for.
        hot: path.join(SITE, 'hot', 'index.html'),
      },
    },
  },
});
