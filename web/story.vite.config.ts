/**
 * THE STORY PAGE'S BUILD — file two of the recipe.
 *
 * `npm run story:page` → `dist/story/index.html`: one file, no server, opens
 * from `file://`.
 *
 * Two things this config does that an ordinary Vite build does not:
 *
 *   1. **It inlines everything.** `vite-plugin-singlefile` is the standard for
 *      that and it is used as-is; hand-rolling the inlining of a hashed asset
 *      graph is how a build starts quietly dropping a chunk. The library ships
 *      the PAGE, the host owns the Vite invocation — which is why this file
 *      lives here and not in `vizfootprint-ui`.
 *
 *   2. **It writes the payload the page reads.** The log, the bookmarks and the
 *      saved pictures come off `web/story/desk.json` (captured from a running
 *      desk by `npm run story:capture`); the DATA is the committed CSV and the
 *      state shapes, read here and carried inline. Both go through the
 *      library's own codec — `vizfootprint-ui/story/payload`, the door that
 *      loads in plain Node — so what the build writes and what the page reads
 *      cannot drift.
 *
 * The ceiling is the library's and it is a REFUSAL, not a warning: past ten
 * megabytes compressed the build stops and says to declare the table
 * `via: 'http'` beside the page instead. A file nobody can open is not a build
 * that succeeded.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { encodeStoryPayload, formatBytes, storyPayloadScript } from 'vizfootprint-ui/story/payload';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const STORYDECK = path.resolve(REPO, '..', 'storydeck');
const read = (...parts: string[]): string => readFileSync(path.resolve(REPO, ...parts), 'utf8');

/** The one plugin that is ours: assemble the payload, measure it, and put it in the document. */
function storyPayload(): Plugin {
  return {
    name: 'vzf-story-payload',
    async transformIndexHtml(html) {
      const desk = JSON.parse(read('web', 'story', 'desk.json')) as { log: []; bookmarks: []; saved: []; capturedAt?: string; from?: string };
      const csv = read('data', 'nndss', 'snapshot.csv');
      const geo = JSON.parse(read('data', 'geo', 'us-states.geo.json')) as unknown;
      const encoded = await encodeStoryPayload({
        log: desk.log,
        bookmarks: desk.bookmarks,
        saved: desk.saved,
        meta: {
          builtAt: new Date().toISOString().slice(0, 10),
          data: { via: 'inline', label: `the committed CDC snapshot, ${csv.split('\n').length - 2} rows, and the state outlines` },
          // no `notes`: the front matter's slot for what a page cannot vouch for, and this capture
          // vouches for everything it carries — every stamp came off the desk's own wire
        },
        data: { csv, geo },
      });
      const { sizes } = encoded;
      // MEASURED, and printed, so a host sees the file it is making rather than finding out later
      console.log(
        `\n  story payload: ${formatBytes(sizes.json)} of JSON → ${formatBytes(sizes.compressed)} gzipped → ${formatBytes(sizes.inlined)} inlined (ceiling ${formatBytes(sizes.ceiling)})`,
      );
      console.log(`  from ${String(desk.from ?? 'a captured desk')} at ${String(desk.capturedAt ?? 'an unrecorded time')}: ${String(desk.log.length)} commits, ${String(desk.bookmarks.length)} bookmarks\n`);
      if (!encoded.ok) throw new Error(encoded.sentence); // a file nobody can open is not a build that succeeded
      return html.replace('</body>', `${storyPayloadScript(encoded.text)}\n  </body>`);
    },
  };
}

export default defineConfig({
  root: path.join(HERE, 'story'),
  plugins: [react(), storyPayload(), viteSingleFile()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { fs: { allow: [REPO, path.resolve(REPO, '..', 'vizfootprint'), STORYDECK] } },
  build: { outDir: path.join(REPO, 'dist', 'story'), emptyOutDir: true, assetsInlineLimit: 100 * 1024 * 1024 },
});
