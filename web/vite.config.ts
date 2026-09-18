/**
 * The web app's build — a plain Vite + React page that speaks to the demo
 * server over `/api` (proxied in dev, same-origin in a build). `vizfootprint`
 * and `vizfootprint-ui` are `file:` links to the sibling checkout, outside this
 * repo, so the dev server is allowed to read it — the whole checkout, because
 * the library's dist/ now sits beside the ui package rather than inside it.
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
  root: HERE,
  plugins: [react()],
  // Every `file:` sibling keeps its own React for its own tests, and storydeck's components run
  // inside ours. Two copies of React is the classic hook crash, so one copy is the contract.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    port: 5291,
    strictPort: true,
    proxy: { '/api': API },
    fs: { allow: [REPO, path.resolve(REPO, '..', 'vizfootprint'), STORYDECK] },
  },
  // THREE pages now, and the third is LOCAL-ONLY BY DESIGN. `web/prot/` is the
  // protein desk with a process behind it, and the process buys exactly one
  // thing: stage 5, the hot spot recommendation, which needs a model and
  // therefore a key (`web/src/protServed.tsx` · the file header, and
  // `src/prot/plan.ts` · step 5). It is NOT in the static site build
  // (`./site.vite.config.ts`), and the published protein desk goes on saying it
  // cannot perform that stage, with its measured reason — a key shipped inside
  // a page's own bytes is a key given away, which is the architecture and not a
  // shortfall. The `/api` proxy above is what this page needs and what the
  // published one must never have.
  //
  // The other two are the dashboard, and the wizard beside it (`web/make/`), so the
  // front door's "Make your own" link resolves in a built app as it does in dev.
  // The PUBLISHABLE wizard is a different build — `npm run make:page`, one file —
  // because the wizard publishes copies of the page it is running in, and this
  // one's code lives in a hashed asset beside it. It says so there rather than
  // handing anybody a file that opens blank; see `../make.vite.config.ts`.
  build: {
    outDir: path.join(HERE, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: { main: path.join(HERE, 'index.html'), make: path.join(HERE, 'make', 'index.html'), prot: path.join(HERE, 'prot', 'index.html') } },
  },
});
