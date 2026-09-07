/**
 * THE WORKED EXAMPLE — this demo's two surfaces, side by side, so the difference
 * is visible.
 *
 * `npm run cards` builds BOTH definitions off the real snapshot — the desk's,
 * with the co-occurrence graph, and the story page's, without it — reads the
 * story page's captured 32-commit trace, and writes one static HTML file with a
 * card for each. Then it prints, to the terminal, what the filter answers: which
 * surface carries the network view, and which carries none.
 *
 * WHY IT IS WORTH BUILDING TWICE: a gallery card that merged these two would
 * advertise a network a reader opening the story page cannot walk. The whole
 * point of a per-surface card is only visible when the two are next to each
 * other, so this is what "next to each other" looks like.
 *
 * WHY THE PAGE DRAWS `DemoCard` AND NOT `DemoGallery`: two reasons, both real.
 * A static file cannot filter — a picker that never moves is furniture — and a
 * plain `tsx` script has no bundler to dedupe React, so the gallery's `useState`
 * would meet this repo's second copy of React and crash (the failure
 * `web/vite.config.ts` and `vitest.config.ts` both dedupe away). The FILTER is
 * demonstrated below, in the terminal, where it actually runs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoCard, chipsOf, choicesOf, narrowTo } from 'vizfootprint-studio/cards';
import type { DemoSurface } from 'vizfootprint-studio/cards';
import { loadGraph, loadSnapshot } from '../src/nndss/snapshot.js';
import { nndssSurfaces, type CapturedWalk } from '../src/nndss/cards.js';

const CAPTURE = new URL('../web/story/desk.json', import.meta.url);
const OUT_DIR = new URL('../web/dist/', import.meta.url);
const OUT = new URL('cards.html', OUT_DIR);

/** The captured walk the story page ships with — the same file `story:capture` writes and the page bundles. */
function captured(): CapturedWalk {
  return JSON.parse(readFileSync(CAPTURE, 'utf8')) as CapturedWalk;
}

/** What only the desk has — the sentence this whole feature exists to make sayable. */
function onlyOn(surface: DemoSurface, other: DemoSurface): readonly string[] {
  const theirs = new Set(chipsOf(other).map((chip) => chip.id));
  return chipsOf(surface)
    .filter((chip) => !theirs.has(chip.id))
    .map((chip) => `${chip.facet}: ${chip.label}`);
}

function page(surfaces: readonly DemoSurface[]): string {
  const body = renderToStaticMarkup(
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12, alignItems: 'start' }}>
      {surfaces.map((surface) => (
        <DemoCard key={surface.surface} surface={surface} />
      ))}
    </div>,
  );
  return [
    '<!doctype html><meta charset="utf-8">',
    '<title>What the CDC demo covers</title>',
    '<style>body{margin:0;padding:24px;background:#f6f7f9;font:13px/1.5 ui-sans-serif,system-ui,sans-serif;color:#17212b}h1{font-size:18px;margin:0 0 4px}p.lead{margin:0 0 18px;font-size:12.5px;opacity:.75;max-width:70ch}</style>',
    '<h1>What this demo covers — one demo, two surfaces</h1>',
    '<p class="lead">Every chip below was read off the surface it sits on: the left card off the definition built WITH the co-occurrence graph, the right off the same definition built without it, and off the 32 commits somebody really left on the story page. Nothing here was typed by hand except the one group that says so.</p>',
    body,
  ].join('\n');
}

function main(): void {
  const surfaces = nndssSurfaces({ tables: loadSnapshot(), graph: loadGraph(), captured: captured() });
  const [desk, story] = surfaces as readonly [DemoSurface, DemoSurface];

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, page(surfaces), 'utf8');
  console.log(`wrote ${OUT.pathname}`);

  for (const surface of surfaces) {
    const f = surface.declares;
    console.log(
      `\n${surface.surface}  ${f.revision}\n` +
        `  tables ${String(f.tables.length)} · views ${String(f.views.length)} · charts [${f.chartKinds.join(', ')}] · selections [${f.selectionKinds.join(', ')}]\n` +
        `  links declared ${String(f.links.declared)} · relations ${String(f.relations.length)} · analyses ${String(f.analyses.length)}`,
    );
  }

  console.log(`\nonly on the desk: ${onlyOn(desk, story).join(' · ')}`);
  console.log(`only on the story page: ${onlyOn(story, desk).join(' · ') || '(nothing — the desk is the superset)'}`);

  console.log(`\nthe filter offers ${String(choicesOf(surfaces).length)} features across these two surfaces:`);
  for (const id of ['declares:chart:network', 'declares:selection:neighbourhood', 'walked:verb:describe', 'declares:chart:bar', 'declares:chart:sunburst']) {
    console.log(`  narrowTo "${id}" → ${narrowTo(surfaces, id).map((s) => s.surface).join(', ') || 'nothing carries it'}`);
  }
}

main();
