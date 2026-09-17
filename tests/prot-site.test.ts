/**
 * THE FOURTH DESK MUST NOT MAKE THE OTHER THREE PAY FOR A 3D VIEWER.
 *
 * Mol* unpacks to about 80 MB and bundles to megabytes. The protein desk is one
 * page of a five-page build, and the CDC, grid and exoplanet desks must load
 * none of it. The library's contract does not enforce that — nothing in a
 * renderer protocol can — so it is enforced HERE, at two levels:
 *
 * 1. IN THE SOURCE, always. Exactly one module may name `molstar`:
 *    `web/src/molstarViewer.ts`, the adapter. Everything else reaches it
 *    through the DYNAMIC import inside `molstarRenderer`'s mount, which is what
 *    gives rollup a chunk boundary to cut at.
 * 2. IN THE BUNDLE, when there is one. `npm run site:build` writes
 *    `dist/site/`, and the walk below follows each page's STATIC import closure
 *    (rollup writes `from"./x.js"` for a static import and `import("./y.js")`
 *    for a dynamic one, so the two are distinguishable) and asserts that the
 *    viewer's chunk is in NO page's static closure and is named by exactly one
 *    page's dynamic import.
 *
 * `dist/` is git-ignored, so a fresh checkout has no bundle. This suite says
 * which of the two checks it ran rather than passing in silence — a skipped
 * check that looks like a green one is the thing this repository refuses.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PROT_FILES, SITE_DATA_FILES } from '../src/data/files.js';

const REPO = process.cwd();
const SITE = join(REPO, 'dist', 'site');
const ASSETS = join(SITE, 'assets');

/**
 * How a built chunk is recognised as the viewer's: by the DYNAMIC import that
 * cut it, not by a string inside it.
 *
 * A marker like `mol-plugin` does not survive bundling (the module paths are
 * gone), and one that does — a molscript property name — would rot on a Mol*
 * upgrade. The import specifier is structural: rollup names the chunk after the
 * module the dynamic import names, so this prefix is the boundary itself.
 */
const VIEWER_CHUNK = 'molstarViewer';

/** The five pages of the build, each by the HTML file the config names. */
const PAGES = ['index.html', 'nndss/index.html', 'grid/index.html', 'exo/index.html', 'prot/index.html'] as const;

describe('the source keeps Mol* behind one door', () => {
  it('exactly one module names molstar, and it is the adapter', () => {
    const web = join(REPO, 'web', 'src');
    const named = readdirSync(web)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .filter((f) => readFileSync(join(web, f), 'utf8').includes("from 'molstar/"));
    expect(named).toEqual(['molstarViewer.ts']);
  });

  it('the renderer reaches that adapter by a DYNAMIC import, which is the chunk boundary', () => {
    const renderer = readFileSync(join(REPO, 'web', 'src', 'molstarRenderer.ts'), 'utf8');
    expect(renderer).toContain("await import('./molstarViewer.js')");
    // …and by no static one: a static import here would pull the viewer into
    // every chunk that draws a chart
    expect(renderer).not.toContain("from './molstarViewer.js'");
  });

  it('the structure file is in the list the build copies', () => {
    expect(SITE_DATA_FILES).toContain(PROT_FILES.structure);
    expect(existsSync(join(REPO, PROT_FILES.structure))).toBe(true);
  });
});

describe('the built site, when this checkout has one', () => {
  const built = existsSync(ASSETS);

  it('names whether the bundle check could run at all', () => {
    // NOT a skip: this states which of the two levels was checked, so a green
    // run never hides an unchecked invariant
    expect(typeof built).toBe('boolean');
    if (!built) console.log('dist/site is absent — the bundle checks below are not run; the source-level door above is. Run `npm run site:build` for the rest.');
  });

  it.runIf(built)('carries all five pages', () => {
    for (const page of PAGES) expect(existsSync(join(SITE, page))).toBe(true);
  });

  it.runIf(built)('cut the viewer into a chunk of its own, and no page loads it statically', () => {
    /** Every chunk one page loads without a dynamic import, followed transitively. */
    const closureOf = (page: string): readonly string[] => {
      const html = readFileSync(join(SITE, page), 'utf8');
      const seen = new Set<string>();
      const queue = [...html.matchAll(/(?:src|href)="[^"]*assets\/([^"]+\.js)"/g)].map((m) => m[1]!);
      while (queue.length > 0) {
        const file = queue.shift()!;
        if (seen.has(file) || !existsSync(join(ASSETS, file))) continue;
        seen.add(file);
        const code = readFileSync(join(ASSETS, file), 'utf8');
        // STATIC imports only: `import(...)` with parentheses is the dynamic form
        // and is exactly the boundary this test exists to prove
        for (const m of code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) queue.push(m[1]!);
      }
      return [...seen];
    };
    const isViewer = (file: string): boolean => file.startsWith(VIEWER_CHUNK);

    // THE CHUNK EXISTS, and it is big — which is the whole reason for this test
    const chunks = readdirSync(ASSETS).filter((f) => f.endsWith('.js') && isViewer(f));
    expect(chunks).toHaveLength(1);
    // a FLOOR and not a pin: the exact size moves with every Mol* release, but a
    // viewer that fitted in a hundred kilobytes would mean the chunk is not it
    expect(readFileSync(join(ASSETS, chunks[0]!), 'utf8').length).toBeGreaterThan(100_000);

    // no page STATICALLY loads it — not even the protein page, which reaches it
    // through the renderer's dynamic import when a mount happens
    for (const page of PAGES) {
      expect(closureOf(page).filter(isViewer), `${page} statically loads the 3D viewer`).toEqual([]);
    }
    // …and the protein page's own chunk is the one that names it
    const protChunks = closureOf('prot/index.html');
    const dynamic = protChunks.flatMap((file) => [...readFileSync(join(ASSETS, file), 'utf8').matchAll(/import\("\.\/([^"]+\.js)"\)/g)].map((m) => m[1]!));
    expect(dynamic.filter(isViewer)).toEqual([chunks[0]]);
    // and no OTHER page names it, dynamically or otherwise
    for (const page of ['nndss/index.html', 'grid/index.html', 'exo/index.html'] as const) {
      const named = closureOf(page).flatMap((file) => [...readFileSync(join(ASSETS, file), 'utf8').matchAll(/import\("\.\/([^"]+\.js)"\)/g)].map((m) => m[1]!));
      expect(named.filter(isViewer), `${page} names the 3D viewer chunk`).toEqual([]);
    }
  });
});
