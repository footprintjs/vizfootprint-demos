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
  build: { outDir: path.join(HERE, 'dist'), emptyOutDir: true },
});
