/**
 * THE CARDS FILE — the one file under `data/` the static build WRITES rather
 * than copies, and the reader the front page trusts it through.
 *
 * `src/data/files.ts` lists the committed files the build carries beside the
 * pages; this names the one file the build MAKES there, from the same readers
 * the tests run (`defFeatures` over each surface's real build, `logFeatures`
 * over the trace a surface really ships). The front page fetches it exactly as
 * the desks fetch their CSVs — one site-relative path resolved against
 * `siteBase()` — so it names the same bytes whether the site is mounted at `/`
 * or under `/vizfootprint-demos/`.
 *
 * WHY THE PAGE DOES NOT BUILD THE CARDS ITSELF: a card is `defFeatures` over a
 * BUILT dashboard, and the CDC demo is two builds (with the graph, without it).
 * Building both in a visitor's browser to draw two chips would cost the 8 MB
 * snapshot twice before the page said a word. The build has the snapshot on
 * disk; it runs the readers once and the page reads the answer.
 *
 * THE LAW THIS FILE KEEPS: **a chip is read, never typed.** Nothing here names a
 * feature. `readSiteCards` checks that what came off the wire has the SHAPE the
 * studio's readers produce, so a page handed an HTML error body, or a stale file
 * from an older build, refuses in a sentence rather than drawing a gallery of
 * nothing — and it adds no fact of its own.
 *
 * This module imports NOTHING at runtime: the front page bundles it, and the
 * build's node door (`./cards.ts`) imports it, and neither may drag the other's
 * world in.
 */
import type { DemoSurface } from 'vizfootprint-studio/cards';

/** Where the build writes the cards, and where the page fetches them — site-relative, beside the tables. */
export const SITE_CARDS_FILE = 'data/cards.json';

/** What the build writes: when the readers ran, and every surface's card as the studio's own shape. */
export interface SiteCards {
  /** The instant the readers were run — a build time, not a release; two builds of one commit differ here and nowhere else. */
  readonly builtAt: string;
  readonly surfaces: readonly DemoSurface[];
}

/**
 * The payload the page may draw, or a sentence saying why it may not.
 *
 * ```ts
 * readSiteCards(await res.json()).surfaces.length;   // 3
 * readSiteCards('<!doctype html>');                  // throws: the cards file is not an object — got a string
 * ```
 */
export function readSiteCards(raw: unknown): SiteCards {
  const cards = objectOf(raw, 'the cards file');
  const builtAt = cards['builtAt'];
  if (typeof builtAt !== 'string') throw new Error(`the cards file names no builtAt — the build that wrote it did not say when its readers ran`);
  const surfaces = arrayOf(cards['surfaces'], 'the cards file', 'surfaces');
  return { builtAt, surfaces: surfaces.map((surface, i) => surfaceOf(surface, i)) };
}

// ── One surface, checked to the shape the readers produce ────────────────────

/** The reader-produced lists a card's chips are minted from — a surface missing one is a surface the studio would crash on. */
const DECLARES_LISTS = ['tables', 'views', 'chartKinds', 'channels', 'selectionKinds', 'relations', 'analyses', 'proseSubjects'] as const;

function surfaceOf(raw: unknown, index: number): DemoSurface {
  const where = `surface ${String(index)}`;
  const surface = objectOf(raw, where);
  const demo = stringOf(surface['demo'], where, 'demo');
  const name = stringOf(surface['surface'], where, 'surface');
  const declares = objectOf(surface['declares'], `${where} (${demo} / ${name})`, 'declares');
  stringOf(declares['revision'], `${where} (${demo} / ${name}) declares`, 'revision');
  for (const list of DECLARES_LISTS) arrayOf(declares[list], `${where} (${demo} / ${name}) declares`, list);
  objectOf(declares['links'], `${where} (${demo} / ${name}) declares`, 'links');
  objectOf(declares['encodingRules'], `${where} (${demo} / ${name}) declares`, 'encodingRules');
  if (surface['walked'] !== undefined) {
    const walked = objectOf(surface['walked'], `${where} (${demo} / ${name})`, 'walked');
    objectOf(walked['verbs'], `${where} (${demo} / ${name}) walked`, 'verbs');
    arrayOf(walked['selectionKinds'], `${where} (${demo} / ${name}) walked`, 'selectionKinds');
  }
  if (surface['byHand'] !== undefined) arrayOf(surface['byHand'], `${where} (${demo} / ${name})`, 'byHand');
  // the shape is the studio's; a copy typed here would be the second source of truth this feature refuses
  return surface as unknown as DemoSurface;
}

// ── Three shape checks, each a sentence ──────────────────────────────────────

function objectOf(raw: unknown, where: string, field?: string): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw as Record<string, unknown>;
  throw new Error(`${where} ${field === undefined ? 'is' : `has no ${field} —`} not an object — got ${kindOf(raw)}`);
}

function arrayOf(raw: unknown, where: string, field: string): readonly unknown[] {
  if (Array.isArray(raw)) return raw;
  throw new Error(`${where} has no ${field} list — got ${kindOf(raw)}`);
}

function stringOf(raw: unknown, where: string, field: string): string {
  if (typeof raw === 'string') return raw;
  throw new Error(`${where} has no ${field} — got ${kindOf(raw)}`);
}

const kindOf = (raw: unknown): string => (raw === null ? 'null' : Array.isArray(raw) ? 'an array' : `a ${typeof raw}`);
