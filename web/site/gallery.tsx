/**
 * THE FRONT PAGE'S GALLERY — what each surface covers, read off a file the
 * build wrote, never off a list somebody typed into this page.
 *
 * The page you are reading once carried hand-written cards: a heading, a
 * sentence, and a row of numbers per desk. Every one of those numbers was a
 * fact about a build that could change without this file changing. Now the
 * cards are the studio's `DemoGallery` over `data/cards.json`, and that file
 * is `defFeatures` over each surface's real build and `logFeatures` over the
 * one trace a surface really ships (`src/site/cards.ts`), written by the same
 * build that published this page.
 *
 * WHY A FETCH AND NOT AN IMPORT: the cards are the readers over BUILT
 * dashboards, and the CDC demo is two builds over the 8 MB snapshot. Building
 * them here to draw a few chips would cost a visitor that snapshot twice before
 * the page said a word. The build had it on disk; the page reads the answer at
 * the same address discipline the desks use for their tables — one
 * site-relative path against `siteBase()`.
 *
 * THE THREE STATES, said out loud rather than degraded quietly (`./boot.tsx`):
 * reading, broken, ready. A broken gallery prints the reader's own sentence and
 * offers no cards, because the two desk links above it still open and a gallery
 * that drew a typed stand-in would be the drift the readers exist to prevent.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoGallery } from 'vizfootprint-studio/cards';
import { SITE_CARDS_FILE, readSiteCards, type SiteCards } from '../../src/site/cardsFile.js';
import { readableInstant } from '../src/front.js';
import { sentenceOf, siteBase, type BootState } from './boot.js';

/** The cards, over http, through the page's own reader — the same address discipline as the desks' CSVs. */
async function fetchCards(): Promise<SiteCards> {
  const at = new URL(SITE_CARDS_FILE, siteBase());
  const res = await fetch(at);
  if (!res.ok) throw new Error(`${at.href} answered ${String(res.status)} ${res.statusText} — the build writes this file beside the tables, so a site without it was built without its cards`);
  return readSiteCards(await res.json());
}

function Gallery(): JSX.Element {
  const [state, setState] = useState<BootState<SiteCards>>({ status: 'reading' });

  useEffect(() => {
    let live = true;
    void fetchCards()
      .then((value) => live && setState({ status: 'ready', value }))
      .catch((e: unknown) => live && setState({ status: 'broken', sentence: sentenceOf(e) }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status === 'reading') return <p className="note">Reading the cards the build wrote…</p>;
  if (state.status === 'broken') {
    return (
      <p className="note broken" role="alert">
        The gallery could not read its cards — {state.sentence}. The three desks above still open; nothing here was going to be typed in the cards' place.
      </p>
    );
  }
  return (
    <>
      <DemoGallery surfaces={state.value.surfaces} heading="What each surface covers" />
      <p className="note">Read off the builds and the one recorded walk at {readableInstant(state.value.builtAt)}, by the build that published this page.</p>
    </>
  );
}

const mount = document.getElementById('gallery');
if (mount === null) throw new Error('the page has no #gallery to mount into');
createRoot(mount).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
