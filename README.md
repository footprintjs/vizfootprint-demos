# vizfootprint-demo — public data, provenance-first

[vizfootprint](https://github.com/footprintjs/vizfootprint) on a real public dataset: the CDC's weekly
notifiable-disease tables (NNDSS), reproduced as a dashboard whose every
interaction is a commit, whose agent proposals are gated, and whose empty
cells keep their kind — with the interaction grammar on screen.

This repo is a **consumer**, not a showcase: it exists to exercise the
library's seams on data nobody here authored. What it proves, it proves
on CDC's own bytes.

## Why NNDSS

A weekly NNDSS cell that carries no number carries a flag instead, and
CDC's flags already say which silence it is — `N` not reportable in that
jurisdiction, `U` unavailable, `NP` withheld, `-` no cases (a real zero).
That is the absence vocabulary this library insists on, published weekly
by a federal agency. See [`src/nndss/absence.ts`](src/nndss/absence.ts).

## Layout

| folder | layer | one job |
|---|---|---|
| `data/nndss/` | 1 · data | the fetch script, the committed snapshot, and its provenance (source, date, rows, license) |
| `data/nndss/graph/` | 1 · data | the disease co-occurrence graph derived from the snapshot by `npm run graph:generate` — `nodes` / `edges` tables the def joins with two relations, with provenance and a byte-stability promise |
| `data/geo/` | 1 · data | US state boundaries (Census-derived, via `us-atlas`), converted and committed with provenance |
| `src/nndss/` | 1–5 | flags → absence, CSV → tables, the declared dashboard, the declared analyses, the surface, the scripted proposals, the analyst |
| `src/source/` | wire | the http carrier — the one the library has but does not export; its README says why |
| `server/` | wire | `/api/*` — vizfootprint-ui's polled state contract, plus the summary, chat and geo doors |
| `web/` | 3, 4, 6 | the front door, the cockpit, the Grammar panel, the jump box, the Analyst panel |
| `web/site/` | 3, 4, 6 | the STATIC site: an index and the two desks, each reading its tables over http with no server behind it |
| `web/story/` | 6 | the SINGLE-FILE story page: its entry, its desk, and the captured desk it carries |
| `scripts/` | — | `story-capture.ts` — the desk's story, off a running server |
| `tests/` | — | vitest |

## What you see

The dashboard's views on one screen — coverage, diseases, kinds, the map,
weeks, the trend, the network and the table — every one fed by the host under
the session's clauses (the host sums, the chart draws), and four report chips:

| view | what it shows | what a click does |
|---|---|---|
| **coverage** (bar) | cells by `report_state` — which silence is which | selects a report state |
| **diseases** (bar) | reported cases by disease, summed over the kept cells of ONE kind (states unless the kinds view says otherwise) | picks the disease that drives the trend, the week line and the table |
| **kinds** (bar) | cells by area kind — state, region, roll-up | names the kind every sum is over |
| **weeks** (line) | reported cases per MMWR week, summed over the same one kind | brush = a `filter` on `t` |
| **map** (choropleth) | the picked disease per state, summed over kept weeks; a hatched state has no present cell; places without a shape are named in the caption | selects a state |
| **trend** (line) | the picked disease per region until a kind or an area is chosen, then per kept area — a missing point is a silence, never a zero | brush = a `filter` on `t` |
| **net** (node-link, two layers) | the disease co-occurrence graph: one circle per disease, one line per pair that both reported cases in the same state-week | hover lights a disease and its ties; click selects it, shift-click adds |
| **table** | the picked disease at the latest week, the cells as CDC printed them, with their flag | selects an area |

### Where the network's positions come from

Nowhere on the page. Two acts land on the session before the first request is
served, and both are ordinary `analyze` commits at the top of the log:

```ts
// src/nndss/def.ts — the acts, DECLARED, so the record says what was done
graphLayout:    { builtin: 'layout',    algo: 'stress', table: 'nodes', edges: 'edges', key: 'disease', from: 'source', to: 'target', seed: 7, iterations: 60 }
graphEndpoints: { builtin: 'bringOver', table: 'edges', from: 'nodes', columns: ['x', 'y'] }
```

The first writes `x` and `y` onto the `nodes` table; the second carries those
two columns ACROSS the two declared relations (`edges.source → nodes.disease`,
`edges.target → nodes.disease`) onto the `edges` table as `source_x`,
`source_y`, `target_x`, `target_y`. Both are plain derived columns afterwards:
filterable, visible at the cursor, carrying the act that made them.

**Why not a script that writes the coordinates into the CSV**: a position that
is not on the trace is a position a replay cannot promise. The seed is data, so
the same rows give the same picture; `tests/network.test.ts` replays the log
into a fresh session and gets every coordinate back.

**What the picture says, honestly**: 15 diseases and 105 ties — and 105 is
exactly 15 × 14 / 2, so every pair co-occurs at least once. The graph is
COMPLETE, which makes the node-link a hairball; the caption on the cell says so
and points at the reading that survives at this density — the weights as a
matrix, source × target, shaded by jurisdiction-weeks. Every word of that is
COUNTED and not asserted: the density is measured off the drawn marks, the
declared `altLong` is a function of the graph the def was handed (hand a
partial one in and it names the ties it has instead), the caption says what the
layout act never placed, and with nothing placed at all the caption says THAT
rather than promising a commit the frame below it is refusing.

**And the graph is read ONCE, where no clause exists.** A view's clause reaches
every table, and the graph's two share almost no column with the other three —
so a per-request read would answer a reload-after-a-selection either with a
refusal about a column nobody asked for or with a node-link whose links point at
nodes that are not there. `buildNndssSurfaceAsync` reads both windows straight
after the two acts and carries the answer on the surface; the desk narrows in
the browser afterwards, the way every other cell does.

- **Analyst** — an agent on the same dashboard (layer 5). It drives the views
  through the same verbs, never computes a number itself (every statistic is
  one of the declared analyses in `src/nndss/analyses.ts`, run by the session
  over present cells only), and every act lands as an `agent`-badged commit.
  Under each reply, the acts it took are listed framed by the grammar — verb,
  what it touched, landed / refused — derived from the tool calls, never from
  its prose. Ask it to "save this as a beat" and it names a checkpoint.
  Without a key it runs one scripted turn; with `ANTHROPIC_API_KEY` in `.env`
  it is live (Anthropic over fetch, no SDK).
- **Grammar** — the verbs off the wire (the library's own list), each with the
  gesture that produces it here; per view: driver, what it emits, which
  channels it may rebind and what they are bound to now; the wiring word
  (`implicit-crossfilter`); the absence column and its words.
- **The silences** — this week's `not-configured` / `unavailable` /
  `withheld` / `unknown` cells by area, in our words for CDC's flags.
- **Agent proposals** — six charts an agent might propose; the session admits
  the ones that make a claim over real columns and refuses the rest with a
  typed reason (an absence column on a magnitude channel is one).
- **Commit log** — every act, with its cause, and `go to #` beside the
  time-travel bar: seek to any commit on the lineage by number (a cursor
  move, never a rewrite); a number on another path is refused in a sentence.

Every act lands as a commit; ⚑ names the position as a story beat; acting
while viewing the past forks a branch.

The links between views are data too. `src/nndss/def.ts` declares four
edges over the default rule (every view filters every other): the map
lights the disease bar instead of narrowing it, a week brush moves the
trend's window instead of filtering it, the map mirrors its state into the
table, and a table row never reaches the bar. The Grammar panel shows the
whole graph as a matrix — rows are a source view and what it emits, columns
are targets, a cell is the response — and you can edit any cell there.
Every edit is a `link` commit like any act, so undo, time travel and the
analyst all see it; "back to the rule" un-declares an edit.

Selection gestures (the library's SET-1 grammar): click a mark to select
it, click it again to clear; shift-click adds a mark to the view's set;
drag across bars selects the run between them; the chips under the time
bar name every live selection in words — ✕ clears one, "exclude" flips it
to everything-but-these (a dashed outline), "clear all" clears them all.
Each of those is a commit with a cause, like any act, so undo, time travel
and the analyst see them.

## Run it

### First: this repo needs its library beside it

`package.json` depends on `vizfootprint`, `vizfootprint-ui`,
`vizfootprint-studio` and `storydeck` through `file:` links to **sibling
checkouts**. Nothing here resolves from the npm registry, so `npm install` in
a lone clone will fail — that is not a bug, it is what a `file:` dependency
means. The library is public; clone it next to this one:

```
git clone https://github.com/footprintjs/vizfootprint.git
git clone https://github.com/footprintjs/storydeck.git
git clone <this repo>            # all three side by side, same parent folder
cd vizfootprint && npm install && npm run build && npm run build:ui && npm run build -w vizfootprint-studio
cd ../storydeck && npm install
cd ../vizfootprint-demo && npm install
```

The parent folder ends up holding `vizfootprint/`, `storydeck/` and
`vizfootprint-demo/` as siblings, which is exactly what `file:../vizfootprint`
says. `vizfootprint-studio` is not a fourth clone — it lives inside the
library's checkout, as its own npm workspace, which is why building it is a
third command (`build:ui` is a different workspace and does not reach it).
`storydeck` ships source, not a build, but it is a `file:` sibling rather
than a workspace of either side, so it still needs `npm install` run inside
its own checkout — nothing else here installs its one dependency
(`markdown-it`) for it. Continuous integration does the same thing in the
same order: check out the repositories side by side, build the library, its
ui and its studio, install storydeck's own dependency, then build this
site; see `.github/workflows/pages.yml`.

```
npm install
npm run data:fetch      # only to refresh the snapshot — it is committed
npm run data:geo        # only to regenerate the map shapes — they are committed
npm run serve           # http://localhost:5290/api/state  (put ANTHROPIC_API_KEY in .env for a live analyst)
npm run web:dev         # http://localhost:5291
npm test
```

`vizfootprint-ui` and `vizfootprint-studio` are `file:` links to the sibling
checkout; rebuild them (`cd ../vizfootprint && npm run build:ui && npm run
build -w vizfootprint-studio`) after any library change.

## Publish it — a static site, no server at all

```
npm run site:build                # → dist/site/  (base /vizfootprint-demo/, this script's own default)
SITE_BASE=/ npm run site:build    # → the same site, mounted at the root
```

That default names the local working copy, singular — this repository
publishes as `vizfootprint-demos`, plural, which is a different path. Rather
than hardcode the real name a second place, `.github/workflows/pages.yml`
reads it from GitHub's own `configure-pages` action and passes it as
`SITE_BASE`, so the deployed site is always mounted at wherever this
repository actually lives.

`dist/site/` is three pages and 18.5 MB — 1.0 MB of code and 17.5 MB of
tables: an index that offers the two demos, a desk each, and `data/` copied in
beside them. There is no server behind it and
nothing in it points at one.

**How a desk gets its rows without a server.** The library's source layer is a
declaration, not a fetch call: a table says a **format**, a **via** and an
**at**, and the carrier for that via reads it and vouches for a **version**.
The served desks declare `via: 'file'` and the file carrier reads the disk.
The static pages declare the *same tables* `via: 'http'` at the committed CSVs
under the site's own base, and the http carrier fetches them — so a page on
GitHub Pages ends up stamping its commits with the ETag or `Last-Modified` the
Pages CDN vouched for. One word changes. Everything downstream — the ETL, the
definition, the validated dashboard, the two layout acts, the charts — is the
same code the server runs.

| | served | static |
|---|---|---|
| the definition | `nndssDef` / `gridDef` | the same |
| the session | built in the server process | built in your browser |
| the tables | `via: 'file'`, off disk | `via: 'http'`, off the site |
| the desk's session view | `pollingSource('/api/state')` | `sessionSource(session)` |
| the rows payload | `nndssRows` / `gridRows` | the same |

**What a reader loses, said rather than degraded.** Each static desk opens
with the sentence: no **analyst** (it needs a model key and a process to hold
the conversation), no **durable log** (commits live in the tab and go on
reload), no **refresh** (the files are what the repository committed). Every
other act is real — selections, undo, named paths, bookmarks, compare, the
Sheet, the commit log, the branch map. The served path is not deleted: `npm
run serve` + `npm run web:dev` is still how the analyst is developed, and both
paths build from one definition per demo.

**The base is a knob** because GitHub Pages serves a project site at
`/<repo>/` and a local check serves it at `/`. `SITE_BASE` sets it, Vite
writes it into `import.meta.env.BASE_URL`, and `web/site/boot.tsx` resolves it
against the page's own location — which is also why the data files are copied
to `<base>data/…` rather than referenced by a relative string.

**Continuous integration** does exactly what a person cloning by hand does,
in the same order: check out `footprintjs/vizfootprint`, `footprintjs/storydeck`
and this repository **side by side**, `npm install && npm run build && npm
run build:ui && npm run build -w vizfootprint-studio` in the library, `npm
install` in storydeck, `npm install && npm run site:build` here, then
publish `dist/site/`. Nothing resolves from the npm registry, because the
library is not on it — the two sibling checkouts are pinned to a commit
each, named in the workflow file, so a change landing on either sibling's
`main` cannot alter this build
without a line changing here too.

## Send the desk to somebody — one file, no server

```
npm run story:capture   # GETs /api/state from the running desk → web/story/desk.json (32 commits, 6 bookmarks)
npm run story:page      # → dist/story/index.html — open it from file://, with the network off
```

`dist/story/index.html` is the whole thing: the definition and the engine bundled, and the log, the
bookmarks, the saved pictures, the committed CDC snapshot and the state outlines carried inline in one
gzip+base64 script block (8.60 MB of JSON → 984 kB gzipped → 1.28 MB in a 2.15 MB file). Scrolling it
replays the acts on live charts; every citation seeks; and every beat has an **explore from here** door
that forks a path of your own at that commit and opens the cockpit there, so your acts never land on
the author's lineage.

The two files that make it are the recipe, and the recipe is the documentation:
`web/story/entry.tsx` (imports the def — a definition is data except its analyses, which are code, so
a page has to import one rather than carry it) and `web/story.vite.config.ts`
(`vite-plugin-singlefile`, plus one hook that writes the payload through the library's own codec).
See [`vizfootprint-ui/story/page`](https://github.com/footprintjs/vizfootprint/blob/main/ui/src/story/page/README.md) for the ceiling — past
ten megabytes compressed the build refuses and tells you to declare the table `via: 'http'` instead —
and for the boot's order and its three honest states.

The capture only ever GETs: a capture that dispatched would be a reader changing the thing it came to
read. It stamps one thing it cannot read off the wire — a bookmark's author and time, which
`/api/state` does not carry — and the page prints that admission in its own front matter.

## Rules the ETL makes (and states)

- **Kind** comes from CDC's location columns, never the name and never the
  coordinate: `location1` names a place (a state, a territory, a city),
  `location2` alone names a census division (a region), a roll-up name
  (`U.S. Residents`, `Total`, …) makes a total. South Atlantic carries a
  coordinate in CDC's file (a point in South Dakota) and is still a region.
- **Series** points exist for every PRESENT cell of every kind, each naming
  its kind; a silence is a missing row. A region's count is CDC's own row,
  not a sum the host made.
- **MMWR weeks** become the Saturday that ends them (week 1 contains
  January 4th); `week_index` counts whole weeks from the first, so a trend
  can regress over time as a number.
- **Analyses run over PRESENT cells only.** The library's group-by sums
  `Number(cases)`, which would turn a silence into a zero; every declared
  analysis here is wrapped to drop silent cells first, and says so in its
  honesty notes.
- **The map** is the Census's Albers-USA projection with Alaska and Hawaii as
  insets (50 states + DC). Puerto Rico, Guam, American Samoa, the Northern
  Mariana Islands, the U.S. Virgin Islands and New York City report to NNDSS
  but have no shape there; the cockpit derives that list from the data and
  prints it in the map's caption.

## Data

Source: [NNDSS Weekly Data](https://data.cdc.gov/NNDSS/NNDSS-Weekly-Data/x9gk-5huc)
on data.cdc.gov (Office of Public Health Data, Surveillance, and Technology,
CDC). A work of the United States Government — public domain. The committed
snapshot is a slice (a handful of diseases, two MMWR years); its exact
query, retrieval time and row count are in `data/nndss/PROVENANCE.json`.

Two things the CDC asks anyone who reuses this material to say, and they are
both true here:

- **Nothing here is endorsed by anybody.** Using the CDC's data does not mean
  the CDC, the agency inside it that published these tables, the Department of
  Health and Human Services, or the United States government endorses this
  repository, this library, or anything said in either. They have not seen it.
- **You do not have to come here for the data.** The same tables are published
  by the CDC itself, free of charge, at the link above. The snapshot in
  `data/nndss/` is a convenience copy of a slice, not a source of record — if
  the two ever disagree, the CDC's copy is the one that is right.

Map shapes: U.S. Census Bureau cartographic boundary files (1:10M) via the
[`us-atlas`](https://github.com/topojson/us-atlas) package. Two facts, not
one: the **geometry** is the Census Bureau's, a work of the U.S. Government
and public domain; the **package** that simplified and projected it is
Michael Bostock's us-atlas, licensed ISC, whose copyright notice has to
travel with the file it produced and therefore sits beside it in
[`data/geo/LICENSE-us-atlas`](data/geo/LICENSE-us-atlas). See also
`data/geo/PROVENANCE.json`.

Grid data: U.S. Energy Information Administration — see
[`data/grid/README.md`](data/grid/README.md) for the acknowledgement EIA asks
for, which names the publication (the January–June 2025 six-month file) as
well as the month this repo downloaded it.

## Licence, and what it covers

The **code** is MIT — see [`LICENSE`](LICENSE). The **data** under `data/` is
not ours to license: each folder's README and `PROVENANCE.json` name whose it
is and on what terms, and `LICENSE` closes with the same list.

`package.json` says `"private": true`. That is a guard against an accidental
`npm publish`, nothing more — this is a demo consumer, not a package, and it
has no business on the registry whatever the repository's visibility.

## The encoding plane (which column on which channel)

The second plane of the interaction grammar. The def states what each column **is** to a chart (`columns`: a role such as identifier, dimension, measure; the absence column's role is derived) and the **house rules** (`encodingRules`): a week's count and a year-to-date total never share a chart; a year-to-date total is never a hue; a series value is only meaningful per entity. The library adds one law every def inherits: the absence column never carries a magnitude.

One validator serves three doors with the same sentence: a def that starts against a rule **throws at build**; a rebind that breaks one — from the picker or from the analyst's tool — **is refused as a gap**; the picker greys the column and shows why. The Grammar panel lists the rules, and each channel says how many columns fit right now.

A swap of two axes is one act: `reencode` with `bindings` lands **one commit**, judged as a whole, so a chart never passes through an illegal middle state, and undo restores both channels.

**Encoding links.** One edge of kind `encoding` is declared: when the weekly line takes a color, the trend follows it — into its facet, where it is lawful, and into its color, where the trend's own rule refuses it ("a series value is only meaningful per entity") and the trend keeps `entity`. Nothing lands for the trend: its effective bindings are read through the edge, so undo and time travel on the weekly line carry it. Bind the weekly line's color to `kind` (the picker or the analyst) and the Grammar panel shows "⇠ follows weeks" on the facet and "⇠ refused to follow" on the color; the matrix shows the pairs beside the `follow` cell, and setting it to `none` un-follows as a commit.

**The prose plane.** The map and the weekly line carry their words as records: a title, a short alt that identifies the chart, a long visible description in the CDC's wording, and (on the line) a how-to-read slot the library derives from the chart's bindings every read. The analyst can caption a chart with `describe`, but only with a basis and never with a cause; a caption whose basis no longer matches the screen is shown as stale, naming what moved, never hidden or rewritten.

**The editor.** The "✎ Edit a chart" button opens a side drawer (never a modal, so the charts stay in view): pick a chart and edit its words, its channels and its links. Each edit is an act that lands as a commit — the same `describe`, `reencode` and `link` the analyst uses — so undo and time travel carry it, and a refused edit shows the session's own sentence. The drawer is `vizfootprint-ui/editor`, its own entry point.

What the demo does not show yet: coercion (the def says `refuse`).
