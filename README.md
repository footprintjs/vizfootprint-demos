# vizfootprint-demo — public data, provenance-first

[vizfootprint](https://github.com/footprintjs/vizfootprint) on a real public dataset: the CDC's weekly
notifiable-disease tables (NNDSS), reproduced as a dashboard whose every
interaction is a commit, whose agent proposals are gated, and whose empty
cells keep their kind — with the interaction grammar on screen.

This repo is a **consumer**, not a showcase: it exists to exercise the
library's seams on data nobody here authored. What it proves, it proves
on CDC's own bytes.

## Live: <https://footprintjs.github.io/vizfootprint-demos/>

A static build of all four demos, published from this repo by
`.github/workflows/pages.yml` on every push to `main` — no server behind it,
which is exactly the point; see [Publish it](#publish-it--a-static-site-no-server-at-all)
for what that costs and what it doesn't.

- **[NNDSS](https://footprintjs.github.io/vizfootprint-demos/nndss/)** — the
  CDC's weekly notifiable-disease tables: coverage, diseases, the map, the
  trend, the co-occurrence network, the table itself.
- **[Grid](https://footprintjs.github.io/vizfootprint-demos/grid/)** — three
  weeks of the US electric grid, hour by hour, as the sparse directed network
  62 balancing authorities actually trade power over.
- **[Exoplanets](https://footprintjs.github.io/vizfootprint-demos/exo/)** — the
  same fact, published twice: the NASA Exoplanet Archive's one accepted number
  per planet beside every number any paper ever published for it. Five declared
  ACTS do all the arithmetic — an aggregate that mints a table at run time, two
  derived columns on it, a bring-over and a delta — so the number a reader sees
  and the commit that made it are the same thing. Mass against radius is drawn
  on **logarithmic axes**, declared on the view's frame, with what a logarithm
  cannot place counted rather than dropped; and the histogram over that minted
  table **can be clicked** — before the act that mints it has landed, the same
  click is refused in a sentence naming the act, which the page shows.
- **[Protein](https://footprintjs.github.io/vizfootprint-demos/prot/)** — one
  residue, four pictures, and two of them **arrive**. A protein–protein complex
  drawn in three dimensions by **Mol\***, somebody else's molecular viewer,
  joined to this interaction grammar through the library's renderer contract and
  nothing else — and drawn again as the two backbone angles of every residue. A
  click in either picture is the same row in the other and in the sheet. It is
  the first THIRD-PARTY chart in this repository, and the first desk whose
  picture is drawn from a file rather than from rows: what that costs — bytes
  that carry no version, on no commit — is said under the viewer rather than
  hidden.
  Then it becomes a **pipeline**. Two more stages run over the same committed
  bytes — one finds every non-covalent contact in the entry with Mol\*'s own
  interaction engine, the other rolls a solvent probe over it — and each lands
  its evidence as a commit, with its own chart. **Before a stage runs, its chart
  is refused at the read** and the cell prints the library's own sentence (*no
  column "interface_contacts" in table "residues"*) rather than a spinner;
  **step the time cursor back behind that commit and it is refused again, word
  for word.** The screen un-builds because the log does. Both engines run
  HEADLESS, in the stage, over their own parse: an analysis that needed a
  renderer could not run before the screen existed, and could not run in a test
  at all.
  Then the desk **opens on a question**. A search box takes an entry id (`1ay7`)
  or words (*barstar*), asks the archive's own full-text and data APIs from the
  browser, and opens whatever a reader picks — the address carries it
  (`?entry=1AY7`) so a page is what you share, and the committed entry stays the
  EXAMPLE, read off this repository's own bytes with no request at all. Going
  from one curated entry to any entry in the archive is **refusals, not charts**,
  and each one is a sentence read off the bytes or off the archive's answer: an
  id that does not exist (in the archive's own words), a search that matches
  nothing (its 204), a file the archive publishes in mmCIF only, an entry above
  this desk's declared atom ceiling *with nothing downloaded*, a deposition of
  116 models (*the desk reads the first*, and the rest reach neither the parse
  nor the viewer), the chains that are nucleic acid and therefore have no row,
  the insertion-coded residues the minted key cannot spell, and an entry with
  one chain — which has no interface, so that picture says so instead of drawing
  a bar of zero per residue.
  And the **stage stepper across the top IS the cursor**: a numbered circle per
  stage the desk declares, and clicking one moves the whole desk to the commit
  that stage landed — the rows are re-read at that cursor and every picture goes
  with them, including the two that lose their column and print the library's
  own refusal instead. Five states, and the fifth is what keeps the other four
  honest: *not run* (declared, dispatched nothing, claiming nothing), *running*,
  *landed* (a button), *refused* (carrying the act's own sentence verbatim) and
  *not available on this desk* — the sequence-conservation track, which needs a
  database search no browser can make, because both public services answer
  without an `access-control-allow-origin` header. Said, rather than left
  pending forever. A stage **expands to its acts**, which are the rows the trace
  panel used to be: one per act the run really dispatched, each clickable to its
  own commit, with **no greyed boxes for acts nobody dispatched** — a missing row
  is the truth and a promise is not. The recorder's own sentences ride under it,
  not re-worded.
  This is also the one page in this repository that does **not** wear the
  packaged `vizfootprint-studio/desk`: the layout above cannot be expressed
  inside it, so the page composes the parts a desk is made of instead (the chart
  frame, the selection chips, the saved pictures, the commit log, the gaps panel,
  the sheet) and **names the eight things the packaged desk shows and it does
  not** — the fine time cursor first, because that one is deferred on purpose and
  the consequence of deferring it (a reader's own gestures land on the same
  record with no strip to walk them) is said in the same breath.

All four run the real dashboard, the real ETL, the real definition — the one
thing the published pages cannot do unattended is hold a server-side model
key, so the **analyst** panel asks each visitor for their own (kept in that
browser only, sent only to Anthropic, and entirely optional — without one the
scripted turn still runs). Locally, with a server, it can use a key from the
environment instead; see [Run it](#run-it) and the two laws under
[`web/README.md`](web/README.md#the-law-one-analyst-two-drivers--and-the-visitors-key-is-the-visitors)
for the four differences in full.

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
| `data/exo/` | 1 · data | the two TAP queries, the two committed archive tables, the fetch's own record and the provenance the ETL's counts fill in |
| `src/exo/` | 1–4 | the archive's limit flags → absence, two CSVs → three tables, the declared dashboard, the FIVE declared acts, the surface, the card |
| `src/source/` | wire | the http carrier — the one the library has but does not export; its README says why |
| `server/` | wire | `/api/*` — vizfootprint-ui's polled state contract, plus the summary, chat and geo doors, and the Sheet's two: `GET /api/window` (one window of rows) and `POST /api/find` (where the next match is — the body is the library's `FindQuery`); the grid desk answers the same two under `/api/grid/`. Each parses strictly and answers the session verbatim: a query the door cannot read is a 400 with a sentence, never a default |
| `web/` | 3, 4, 6 | the front door, the cockpit, the Grammar panel, the jump box, the Analyst panel |
| `data/prot/` | 1 · data | one wwPDB entry (CC0), the fetch that downloaded it and the provenance record it wrote — the one committed file that is an ARTIFACT rather than a table |
| `src/prot/` | 1–4 | the PDB atom records → one residue table with every skipped record counted, the declared dashboard (one table, three views, a chart kind the library has never heard of), the surface — plus the ARCHIVE's three doors (`archive.ts`: search, one entry's record, the file; the gate that refuses a size before downloading it) and what this desk cannot say about an entry it was not built with (`entryNotes.ts`: one model only, and a sentence per skipped chain, insertion code and missing interface) |
| `web/site/` | 3, 4, 6 | the STATIC site: an index and the four desks, each reading its tables over http with no server behind it |
| `web/story/` | 6 | the SINGLE-FILE story page: its entry, its desk, and the captured desk it carries |
| `scripts/` | — | `story-capture.ts` — the CDC desk's story, off a running server; `exo-capture.ts` — the exoplanet walk, taken IN PROCESS because that demo has no server |
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
  - **What the model was served.** The acts under a reply say what the analyst
    *did*; they cannot say what it was *told*. Since agentfootprint 9.88 the
    agent commits a **receipt** per LLM call — hashes of the system text, every
    message and every tool schema, salted with the run; the schema rows check out from 9.89, which exports the digest they were hashed with — and the desk keeps a
    **recording** of every turn (what `recordRun` froze, detached, one per
    turn, beside the reasoning trace). A recording is large — roughly 20 MB for one scripted turn — and the desk holds every turn's until the chat is cleared, so a long session should set `NNDSS_KEEP_RECORDING=0` on the served desk or `keepRecording: false` in the browser desk to keep none. Press **What was served** under a reply
    and the Why Lens (`agentfootprint-lens`) opens on that turn; its **Served**
    tab, at the lens's own cursor, shows the request rebuilt from the log with
    each row checked against the receipt — Verified where the hashes agree, a
    named gap with its cause where the log cannot say. One cursor: the lens
    walks the turn, the desk only says which turn. The recording is a reader's
    copy — the reply is the same bytes with it on or off. The dial:
    `NNDSS_KEEP_RECORDING=0` on the served desk, `keepRecording: false` on
    `createBrowserDesk` / `createNndssAnalyst`; a turn whose recording is off
    or lost says so on its line. Over the wire it is one door,
    `GET /api/analyst/recording?turn=turn-N`, read when asked and never on a
    poll. `tests/served.test.ts` proves a receipt per call and every hashed row
    Verified on the scripted turn.
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
npm run web:dev         # http://localhost:5291 — and http://localhost:5291/prot/ for the served protein desk
npm test
```

### The protein desk has a SERVED page too, and it is local-only by design

`http://localhost:5291/prot/` (with `npm run serve` beside it) is the same
protein desk with a process behind it, and the process buys **exactly one
thing: stage 5, the hot spot recommendation.** Stages 1 to 4 run in the browser
on both pages — the archive, InterPro and the two Mol\* engines all answer a
page directly — and stage 5 needs a model, which needs a key, and *a key
shipped inside a page's own bytes is a key given away.*

So **the published desk goes on saying it cannot perform that stage**, with its
measured reason, and that is the architecture rather than a shortfall
(`src/prot/plan.ts` · step 5). The served page is for somebody who cloned the
project and wants to watch the whole pipeline: the door asks a model
(`server/prot-doors.ts`), the answer is a **recommendation** whose every rank
cites the ids of the facts this run's own stages established, a residue the
run's residue table has no row for is **refused by name**, and a standing
judge's reading of the same evidence is recorded beside the answer with its
disagreements shown rather than smoothed over. With no `ANTHROPIC_API_KEY` in
the environment the door says *that*, which is a different sentence from the
published build's — and `PROT_SCRIPTED=1 npm run serve` asks, by name, for the
scripted driver instead, so the whole stage can be watched with no key and no
network at all. It says which in three places at once (the mode, the model
string, the judge's own sentence), because a scripted ranking must never be
mistakable for one a model gave.

The other two demos have their own commands. The grid desk is served
(`npm run grid:dev`); the exoplanet desk was built for the static site and has
no server, so its dev command serves the static page and answers the committed
data from the repository itself:

```
npm run data:exo        # the two TAP queries → data/exo/{ps.csv, pscomppars.csv, FETCH.json}
npm run exo:generate    # read them back through the ETL → data/exo/PROVENANCE.json
npm run exo:capture     # walk the desk in process → web/site/exo/walk.json (the card's `walked` reader)
npm run exo:dev         # http://localhost:5294/exo/
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

`dist/site/` is five pages and 34 MB — 6 MB of code and 28 MB of tables plus
one 169 KB structure file: an index that offers the four demos, a desk each,
and `data/` copied in beside them. 2.9 MB of that code is the 3D molecular viewer,
and it is a chunk of its own that only the protein page loads — asserted
against the built bundle in `tests/prot-site.test.ts`, because a viewer the
other three desks paid for would be a cost nobody asked them for. There is no server behind it and nothing in it points at one.

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
| the definition | `nndssDef` / `gridDef` / `exoDef` | the same |
| the session | built in the server process | built in your browser (the exoplanet desk has no served twin: it was built for the static site) |
| the tables | `via: 'file'`, off disk | `via: 'http'`, off the site |
| the desk's session view | `pollingSource('/api/state')` | `sessionSource(session)` |
| the rows payload | `nndssRows` / `gridRows` / `exoRows` | the same |

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

Population: U.S. Census Bureau, Population Estimates Program (Vintage 2024,
file `NST-EST2024-ALLDATA`) — a work of the U.S. Government, public domain.
52 rows, one per place, in [`data/population/`](data/population/README.md)
(51 of them become denominators — see that README for the one the join refuses)
with its provenance beside it. It is the **denominator**: see "Cases per
hundred thousand people" below.

Grid data: U.S. Energy Information Administration — see
[`data/grid/README.md`](data/grid/README.md) for the acknowledgement EIA asks
for, which names the publication (the January–June 2025 six-month file) as
well as the month this repo downloaded it.

Exoplanets: the **NASA Exoplanet Archive**, queried over its TAP service — two
tables, one row per published measurement and one row per planet. The archive
publishes **no licence** for them; it asks for an acknowledgement, and this
repository carries it verbatim, from the archive's own
[Acknowledging the NASA Exoplanet Archive in Publications](https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html)
page:

> This research has made use of the NASA Exoplanet Archive, which is operated
> by the California Institute of Technology, under contract with the National
> Aeronautics and Space Administration under the Exoplanet Exploration Program.

The same page asks that work using data from a specific literature reference
acknowledge that reference directly, and that the archive be cited as
Christiansen et al. (2025), its published overview paper. The persistent
identifiers come from the archive's own
[DOI page](https://exoplanetarchive.ipac.caltech.edu/docs/doi.html): the
Planetary Systems Table is `10.26133/NEA12` and the Planetary Systems Composite
Parameters Table is `10.26133/NEA13`. Neither is composed here and no DOI is
invented. See [`data/exo/README.md`](data/exo/README.md) for the slice's one
judgement (published-confirmed solutions only, candidates dropped) and what it
loses.

## Cases per hundred thousand people

A count is not a rate. "Texas reported 900 cases" and "Wyoming reported 40" are
the same sentence about two very different places, and the desk had nothing to
divide by until `data/population/` was fetched.

The rate is **two ordinary acts across one declared relation** — never a lookup
inside a formula, because a lookup that named its own join would name one nobody
declared:

```ts
// the def declares the tie; the acts read it off that declaration
relations: [{ from: { table: 'cells', column: 'jurisdiction' }, to: { table: 'population', column: 'jurisdiction' } }]

// `loadSnapshot()` carries the population beside the cells, and the async
// builder lands both acts at boot, right after the graph's two — so the desk
// the server and the static site serve already has the column at its cursor
const surface = await buildNndssSurfaceAsync();
surface.rateRefusals;                         // [] — or the sentence an act was refused with
surface.cellsAtCursor.rows[0]['cases_per_100k'];

// the same two acts by hand, on a synchronous surface (declared, not yet landed)
await surface.session.declareAnalysis('bringPopulation', { cause });  // → jurisdiction_population on cells
await surface.session.declareAnalysis('casesPer100k', { cause });     // → cases / jurisdiction_population * 100000
```

Both land as `analyze` commits carrying their whole declaration, so a replay
rebuilds the column from the log alone, and the second is refused in a sentence
if it is asked for before the first has run.

**On the desk, the rate is a cell** — a bar per state for the picked disease,
summed over the kept weeks like the map, whose caption names the two commits
it came from and counts the jurisdictions that have no population row. The
`/api/rows` door serves the cells **at the cursor** (CDC's columns plus the two
the acts wrote) and the population table beside them; the static site copies
`data/population/` for the same reason it copies the graph. The story page
shapes its tables from the one CSV it carries and so declares no population,
no relation, no acts and no rate cell — `nndssDef` gates all four on the
table, never a view with nothing under it.

**What has no rate says so.** NNDSS files census divisions, roll-ups, the four
territories other than Puerto Rico, and one city beside the states, and the
estimates file carries none of them. Nor does **New York** get a rate, and that
one is a decision rather than a gap: CDC files New York City separately, so the
`New York` cells exclude the city while the Census row of that name counts it —
a matching name over a different population, which
[`data/population/README.md`](data/population/README.md) shows the arithmetic
for. Nineteen of the seventy reporting areas therefore get **no** rate rather
than a made-up one, and the bring-over act counts every row it could not
follow. A cell the source could not
report (`report_state: unavailable`, printed as `0`) has no rate either: a
reported nothing is not a zero, and the absence law is what keeps it that way.

`tests/population.test.ts` pins all of it, over the shipped snapshot as well as
over four rows you can count by hand.

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
