/**
 * THE GRID PAGE'S BUILD — the second demo, beside the dashboard and the wizard.
 *
 * `npm run grid:page` → `dist/grid/index.html` plus its assets, served the way
 * the CDC page is: over `/api`, proxied in dev to the demo server on 5290,
 * same-origin in a build. The grid's four tables answer under `/api/grid/*` in
 * that same process, so nothing new has to be started.
 *
 * WHY a config of its own rather than a second `rollupOptions.input` on
 * `vite.config.ts`: that build's two pages (the dashboard and the wizard) are
 * one deployable — the front door's "Make your own" link has to resolve inside
 * it. The grid is a second DEMO over a second dataset; giving it its own root
 * and its own outDir is what keeps "which page am I looking at?" answerable
 * from the URL, and is the shape `story.vite.config.ts` and
 * `make.vite.config.ts` already set for a page that is not the dashboard.
 *
 * Not single-file: unlike the story page and the wizard, this one TALKS TO THE
 * SERVER — its four tables are 30.7 MB of JSON off `/api/grid/rows` (measured,
 * not guessed), and a page that carried them inline would be a file nobody can
 * open rather than a build that succeeded. The single-file plugin is what the
 * story page uses precisely because it carries its data; this page does not.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const API = process.env['DEMO_API'] ?? 'http://localhost:5290';
// storydeck is the third `file:` sibling (the Story tab's scroll lens ships as JSX source).
const STORYDECK = path.resolve(REPO, '..', 'storydeck');

export default defineConfig({
  root: path.join(HERE, 'grid'),
  plugins: [react()],
  // Every `file:` sibling keeps its own React for its own tests, and storydeck's
  // components run inside ours. Two copies of React is the classic hook crash.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    // a port of its own, so this page and the CDC dev server can run at once
    port: 5292,
    strictPort: true,
    proxy: { '/api': API },
    fs: { allow: [REPO, path.resolve(REPO, '..', 'vizfootprint'), STORYDECK] },
  },
  build: { outDir: path.join(REPO, 'dist', 'grid'), emptyOutDir: true },
});
