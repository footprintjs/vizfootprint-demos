/**
 * THE WIZARD'S BUILD — one file, because the wizard publishes copies of itself.
 *
 * `npm run make:page` → `dist/make/index.html`: everything inlined, opens from
 * `file://`, no server.
 *
 * That is not a nicety here, it is the requirement. `vizfootprint-studio/make`
 * publishes a dashboard by copying THE PAGE IT IS RUNNING IN and writing a
 * payload block into it — the engine, the charts and React are already there, so
 * nothing has to be bundled twice. A page whose code lives in a hashed asset
 * beside it would copy as a page missing its code, and the wizard refuses to
 * publish from one, naming the files it found. `vite-plugin-singlefile` is what
 * makes this page one it will publish from.
 *
 * The dev server (`npm run web:dev`, then /make/index.html) serves the same
 * entry as modules — the wizard works there, and its refusal to publish is the
 * honest answer rather than a fault.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const STORYDECK = path.resolve(REPO, '..', 'storydeck');

export default defineConfig({
  root: path.join(HERE, 'make'),
  plugins: [react(), viteSingleFile()],
  // every `file:` sibling keeps its own React; two copies is the classic hook crash
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { fs: { allow: [REPO, path.resolve(REPO, '..', 'vizfootprint'), STORYDECK] } },
  build: { outDir: path.join(REPO, 'dist', 'make'), emptyOutDir: true, assetsInlineLimit: 100 * 1024 * 1024 },
});
