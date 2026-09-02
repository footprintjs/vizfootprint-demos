/**
 * The web app's build — a plain Vite + React page that speaks to the demo
 * server over `/api` (proxied in dev, same-origin in a build). `vizfootprint-ui`
 * is a `file:` link to the sibling checkout, outside this repo, so the dev
 * server is allowed to read it.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const API = process.env['DEMO_API'] ?? 'http://localhost:5290';

export default defineConfig({
  root: HERE,
  plugins: [react()],
  server: {
    port: 5291,
    strictPort: true,
    proxy: { '/api': API },
    fs: { allow: [REPO, path.resolve(REPO, '..', 'vizfootprint', 'ui')] },
  },
  build: { outDir: path.join(HERE, 'dist'), emptyOutDir: true },
});
