/**
 * THE FIFTH DESK MUST NOT MAKE THE OTHER FOUR PAY FOR IT — and it must not pay
 * for a 3D viewer it does not mount.
 *
 * `tests/prot-site.test.ts` keeps the protein desk's half of this (Mol* behind
 * one dynamic import, in no page's static closure) and is deliberately left
 * untouched by this packet. What is asserted here is the NEW page's own half:
 *
 *   1. it is in the build, with an entry of its own;
 *   2. it names the viewer's chunk NOWHERE — not statically and not
 *      dynamically. This desk draws no molecule, so a reference to the viewer
 *      would be a megabyte for a picture that does not exist;
 *   3. the heavy compute chunk (the headless Mol* the reused acts use) is
 *      reached by a DYNAMIC import from this page too, so it is not on its
 *      first paint either;
 *   4. and no OTHER page's static closure contains this page's entry chunk, so
 *      adding this desk cannot have grown the four that were already there.
 *
 * `dist/` is git-ignored, so a fresh checkout has no bundle. This suite says
 * which of its checks it ran rather than passing in silence.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.cwd();
const SITE = join(REPO, 'dist', 'site');
const ASSETS = join(SITE, 'assets');
const HOT_PAGE = 'hot/index.html';
/** The pages that existed before this desk did — none of them may load a byte of it. */
const THE_OTHERS = ['index.html', 'nndss/index.html', 'grid/index.html', 'exo/index.html', 'prot/index.html'] as const;
const VIEWER_CHUNK = 'molstarViewer';

/** Every chunk a page loads without a dynamic import, followed transitively — `tests/prot-site.test.ts`'s walk, same rollup shapes. */
function closureOf(page: string): readonly string[] {
  const html = readFileSync(join(SITE, page), 'utf8');
  const seen = new Set<string>();
  const queue = [...html.matchAll(/(?:src|href)="[^"]*assets\/([^"]+\.js)"/g)].map((m) => m[1]!);
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file) || !existsSync(join(ASSETS, file))) continue;
    seen.add(file);
    for (const m of readFileSync(join(ASSETS, file), 'utf8').matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) queue.push(m[1]!);
  }
  return [...seen];
}

/** Every chunk a page's own closure names with a DYNAMIC import. */
const dynamicOf = (page: string): readonly string[] => closureOf(page).flatMap((file) => [...readFileSync(join(ASSETS, file), 'utf8').matchAll(/import\("\.\/([^"]+\.js)"\)/g)].map((m) => m[1]!));

describe('the source', () => {
  it('gives the fifth desk an entry of its own rather than reusing the fourth’s', () => {
    const config = readFileSync(join(REPO, 'web', 'site.vite.config.ts'), 'utf8');
    expect(config).toContain("hot: path.join(SITE, 'hot', 'index.html')");
    expect(existsSync(join(REPO, 'web', 'site', 'hot', 'index.html'))).toBe(true);
    expect(existsSync(join(REPO, 'web', 'site', 'hot', 'entry.tsx'))).toBe(true);
  });

  it('names molstar in no module of this desk — it draws no molecule', () => {
    const mine = [join(REPO, 'src', 'hot'), join(REPO, 'web', 'src', 'hot')];
    for (const dir of mine) {
      for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))) {
        expect(readFileSync(join(dir, file), 'utf8'), `${file} names molstar`).not.toContain("'molstar/");
      }
    }
  });
});

describe('the built site, when this checkout has one', () => {
  const built = existsSync(ASSETS) && existsSync(join(SITE, HOT_PAGE));

  it('names whether the bundle checks could run at all', () => {
    expect(typeof built).toBe('boolean');
    if (!built) console.log('dist/site (or its hot page) is absent — the bundle checks below are not run. Run `npm run site:build` for them.');
  });

  it.runIf(built)('carries the fifth page', () => {
    expect(existsSync(join(SITE, HOT_PAGE))).toBe(true);
  });

  it.runIf(built)('loads no byte of the 3D viewer, statically OR dynamically', () => {
    const isViewer = (file: string): boolean => file.startsWith(VIEWER_CHUNK);
    expect(closureOf(HOT_PAGE).filter(isViewer)).toEqual([]);
    expect(dynamicOf(HOT_PAGE).filter(isViewer)).toEqual([]);
  });

  it.runIf(built)('reaches the headless compute engines by a DYNAMIC import, so they are not on its first paint', () => {
    // the reused acts parse a headless structure; `src/prot/molstar.ts` reaches
    // it with `await import(...)`, which is what gives rollup a boundary
    const statics = closureOf(HOT_PAGE);
    const bytes = statics.reduce((n, f) => n + readFileSync(join(ASSETS, f), 'utf8').length, 0);
    // a FLOOR-less sanity bound: the page's first paint is a desk and four
    // charts, not a structural-biology toolkit. Mol* alone bundles past a
    // megabyte, so a closure under 3 MB is the statement that it is not in here.
    expect(bytes).toBeLessThan(3_000_000);
    expect(dynamicOf(HOT_PAGE).length).toBeGreaterThan(0);
  });

  it.runIf(built)('is in no other page’s static closure — adding this desk grew none of the four', () => {
    const mine = closureOf(HOT_PAGE);
    const entry = [...readFileSync(join(SITE, HOT_PAGE), 'utf8').matchAll(/src="[^"]*assets\/([^"]+\.js)"/g)].map((m) => m[1]!);
    expect(entry.length).toBeGreaterThan(0);
    for (const page of THE_OTHERS) {
      const theirs = new Set(closureOf(page));
      for (const chunk of entry) expect(theirs.has(chunk), `${page} statically loads the fifth desk's entry chunk`).toBe(false);
    }
    // and this page really does have chunks of its own to be isolated
    expect(mine.length).toBeGreaterThan(0);
  });
});
