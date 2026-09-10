/**
 * THE SITE'S CARDS — every surface the published site can speak for, assembled
 * at BUILD time from the readers, and written where the front page fetches.
 *
 * THE LAW IT FOLLOWS: **a demo's feature list is read, never typed.** This file
 * names no feature. It builds each surface the way that surface really builds
 * (`../nndss/cards.ts` calls `nndssDef` twice — with the graph for the desk,
 * without it for the story page; `../grid/cards.ts` and `../exo/cards.ts` call
 * theirs once), runs `defFeatures` over each build, runs `logFeatures` over the
 * one trace a surface really ships, and attaches the one hand-written table that
 * exists. The only things this file adds are WHERE each published surface opens
 * on this site — a link is an address, not a feature.
 *
 * THE SECOND LAW: **one demo is not one dashboard.** The CDC demo is two cards
 * here — the desk this site publishes under `./nndss/`, and the story page,
 * whose 32-commit trace is the only recorded walk this repository has. The
 * story page itself is a separate build (`npm run story:page`) and is not
 * published on this site, so its card carries no link; the page it describes is
 * still a different dashboard from the desk, and a card that folded it into the
 * desk's would claim that walk happened on a build with a network view. The
 * walk never touched one.
 *
 * WHY BUILD TIME: the readers need the built dashboards, and the CDC demo's
 * two builds each open the 90,300-row snapshot while the exoplanet desk's opens
 * 20,598 published measurements. The build has them on disk and runs the readers
 * once; a visitor's browser reads the answer as one small JSON file beside the
 * tables it already fetches (`./cardsFile.ts`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DemoSurface } from 'vizfootprint-studio/cards';
import { exoSurfaces, type ExoCardsInput } from '../exo/cards.js';
import { loadExo } from '../exo/snapshot.js';
import { gridSurfaces, type GridCardsInput } from '../grid/cards.js';
import { loadGrid } from '../grid/snapshot.js';
import { nndssSurfaces, type CapturedWalk, type NndssCardsInput } from '../nndss/cards.js';
import { loadGraph, loadSnapshot } from '../nndss/snapshot.js';
import { SITE_CARDS_FILE, readSiteCards, type SiteCards } from './cardsFile.js';

/** The story page's captured walk — the file `story:capture` writes and the story page bundles. */
export const CAPTURED_WALK = new URL('../../web/story/desk.json', import.meta.url);

/**
 * The exoplanet desk's captured walk — the file `exo:capture` writes.
 *
 * Unlike the CDC one, it is captured with NO SERVER: that demo has no served
 * host, so `scripts/exo-capture.ts` opens the surface in process, walks it, and
 * writes the log it left. Absent from a checkout, the exoplanet card simply says
 * nobody has walked it — which is a different sentence from claiming a walk.
 */
export const EXO_WALK = new URL('../../web/site/exo/walk.json', import.meta.url);

/**
 * Where each PUBLISHED surface opens, relative to the site's index — the same
 * relative-path discipline the desks' own CSV fetches keep, so the links hold
 * wherever the site is mounted. Keyed by demo and surface, because that pair is
 * what names a card; a surface not in this table is not published here and its
 * card carries no link.
 */
export const SITE_HREFS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'CDC NNDSS weekly': { desk: './nndss/' },
  'US grid, hour by hour': { desk: './grid/' },
  'Exoplanets, published twice': { desk: './exo/' },
};

export interface SiteCardsInput {
  readonly nndss: NndssCardsInput;
  readonly grid: GridCardsInput;
  readonly exo: ExoCardsInput;
}

/** The captured walk, read off disk. */
export function capturedWalk(at: URL = CAPTURED_WALK): CapturedWalk {
  return JSON.parse(readFileSync(at, 'utf8')) as CapturedWalk;
}

/**
 * The exoplanet walk, read off disk — or `undefined` when nobody has captured
 * one in this checkout.
 *
 * WHY undefined rather than a throw: `logFeatures` is only ever asked about a
 * trace that exists, and a card with no `walked` reader says "no trace has been
 * captured for this surface" in the studio's own words. A build that failed
 * because a walk had not been recorded would make the capture a prerequisite of
 * publishing, which it is not.
 */
export function exoWalk(at: URL = EXO_WALK): CapturedWalk | undefined {
  if (!existsSync(at)) return undefined;
  return JSON.parse(readFileSync(at, 'utf8')) as CapturedWalk;
}

/** Everything the readers need, off the committed files — the snapshot, the graph, the grid slice, the captured walk. */
export function loadSiteCardsInput(): SiteCardsInput {
  return {
    nndss: { tables: loadSnapshot(), graph: loadGraph(), captured: capturedWalk() },
    grid: { tables: loadGrid() },
    exo: { tables: loadExo(), ...((walk) => (walk === undefined ? {} : { captured: walk }))(exoWalk()) },
  };
}

/**
 * The surfaces of this site, in the order the gallery draws them: the CDC
 * desk, the CDC story page, the grid desk, the exoplanet desk.
 *
 * ```ts
 * const [cdcDesk, cdcStory, gridDesk, exoDesk] = siteSurfaces(loadSiteCardsInput());
 * cdcDesk.href;    // './nndss/'
 * cdcStory.href;   // undefined — not published on this site
 * cdcStory.walked; // the 32-commit trace
 * exoDesk.walked;  // the walk `exo:capture` recorded, when a checkout has one
 * ```
 */
export function siteSurfaces(input: SiteCardsInput): readonly DemoSurface[] {
  return [...nndssSurfaces(input.nndss), ...gridSurfaces(input.grid), ...exoSurfaces(input.exo)].map(publishedAt);
}

/** The surface with this site's link on it — or exactly as the demo handed it over, when this site does not publish it. */
function publishedAt(surface: DemoSurface): DemoSurface {
  const href = SITE_HREFS[surface.demo]?.[surface.surface];
  if (href === undefined) {
    // the demo module's own href names the SERVED desk's root; on this site that address is nothing
    const { href: _served, ...unpublished } = surface;
    return unpublished;
  }
  return { ...surface, href };
}

/** The file's whole content. `now` is a parameter so a test can pin the instant. */
export function siteCards(input: SiteCardsInput = loadSiteCardsInput(), now: () => string = () => new Date().toISOString()): SiteCards {
  return { builtAt: now(), surfaces: siteSurfaces(input) };
}

/**
 * Write the cards under the built site's root, where the page will fetch them.
 *
 * The bytes are read back through the page's own reader before they are
 * written: a file the page would refuse must fail the BUILD, not the visitor.
 * Returns the path written.
 */
export function writeSiteCards(siteRoot: string, cards: SiteCards = siteCards()): string {
  const text = JSON.stringify(cards, null, 2);
  readSiteCards(JSON.parse(text));
  const to = path.join(siteRoot, SITE_CARDS_FILE);
  mkdirSync(path.dirname(to), { recursive: true });
  writeFileSync(to, text, 'utf8');
  return to;
}
