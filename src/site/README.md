# `src/site/` — the front page's cards, read at build time

The published site's front page carries a card per **surface**: what that
surface's build can do, what somebody did on it, and the one table a person
had to write. Nothing in this folder names a feature. The cards are the
library's own readers over the real builds, run once by the static build and
written beside the tables the desks already fetch.

```ts
import { siteCards, writeSiteCards } from './cards.js';          // node — the build
import { SITE_CARDS_FILE, readSiteCards } from './cardsFile.js'; // import-free — the page too

writeSiteCards('dist/site');                                     // → dist/site/data/cards.json
readSiteCards(await (await fetch(new URL(SITE_CARDS_FILE, siteBase()))).json()).surfaces; // 3 cards
```

## The law: a chip is read, never typed

Each surface is built the way it really builds — `nndssDef(tables, graph)` for
the CDC desk, `nndssDef(tables)` for the CDC story page, `gridDef(tables)` for
the grid desk — and `defFeatures` reads the build. `logFeatures` reads the one
trace a surface really ships (the story page's 32-commit capture); a desk with
no capture says *no trace has been captured* in the studio's words rather than
carrying an invented one. The CDC desk's gesture table (`NNDSS_GESTURES`) is
attached where it exists; the grid desk has none, and none is written here.

The only thing `cards.ts` adds is `SITE_HREFS` — **where** a published surface
opens, relative to the index, the same relative-path discipline as the CSVs. A
surface this site does not publish (the story page) gets no link, not a made-up
one. `tests/site-cards.test.ts` holds every chip on every card to a reader or
to the hand table, and holds the site's cards to the demo modules' cards chip
for chip.

## The law: one demo is not one dashboard

The CDC demo is two cards. Its desk declares a network view over two layers,
a neighbourhood selection and link, a relation, and two graph analyses
(`layout`, `bringOver`); its story page declares none of those and alone
carries a walk — a walk that never touched a network. A card that merged them
would advertise a network on the page a reader opens. The filter narrows to
surfaces for the same reason: `declares:chart:network` answers *both desks*,
never *the CDC demo*.

## Where the code lives

| file | one job |
|---|---|
| `cardsFile.ts` | the file name, the payload type, and the reader the page trusts it through — imports nothing, so the page bundles it |
| `cards.ts` | the node door: build every surface, run the readers, add the site's links, write the file — and read it back through the page's reader before writing, so a file the page would refuse fails the build |

`web/site.vite.config.ts` calls `writeSiteCards` at `writeBundle` and serves
`siteCards()` from memory under `site:dev`; `web/site/gallery.tsx` fetches the
file and draws `vizfootprint-studio/cards`' `DemoGallery` over it.
