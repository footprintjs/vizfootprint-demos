# vizfootprint-demo — public data, provenance-first

[vizfootprint](../vizfootprint) on a real public dataset: the CDC's weekly
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
| `data/geo/` | 1 · data | US state boundaries (Census-derived, via `us-atlas`), converted and committed with provenance |
| `src/nndss/` | 1–5 | flags → absence, CSV → tables, the declared dashboard, the declared analyses, the surface, the scripted proposals, the analyst |
| `server/` | wire | `/api/*` — vizfootprint-ui's polled state contract, plus the chat and geo doors |
| `web/` | 3, 4, 6 | the cockpit, the Grammar panel, the jump box, the Analyst panel |
| `tests/` | — | vitest |

## What you see

Six views on one screen, every one fed by the host under the session's
clauses (the host sums, the chart draws), and four report chips:

| view | what it shows | what a click does |
|---|---|---|
| **coverage** (bar) | cells by `report_state` — which silence is which | selects a report state |
| **diseases** (bar) | reported cases by disease, summed over the kept cells of ONE kind (states unless the kinds view says otherwise) | picks the disease that drives the trend, the week line and the table |
| **kinds** (bar) | cells by area kind — state, region, roll-up | names the kind every sum is over |
| **weeks** (line) | reported cases per MMWR week, summed over the same one kind | brush = a `filter` on `t` |
| **map** (choropleth) | the picked disease per state, summed over kept weeks; a hatched state has no present cell; places without a shape are named in the caption | selects a state |
| **trend** (line) | the picked disease per region until a kind or an area is chosen, then per kept area — a missing point is a silence, never a zero | brush = a `filter` on `t` |
| **table** | the picked disease at the latest week, the cells as CDC printed them, with their flag | selects an area |

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

```
npm install
npm run data:fetch      # only to refresh the snapshot — it is committed
npm run data:geo        # only to regenerate the map shapes — they are committed
npm run serve           # http://localhost:5290/api/state  (put ANTHROPIC_API_KEY in .env for a live analyst)
npm run web:dev         # http://localhost:5291
npm test
```

`vizfootprint-ui` is a `file:` link to the sibling checkout; rebuild it
(`cd ../vizfootprint && npm run build:ui`) after any library change.

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

Map shapes: U.S. Census Bureau cartographic boundary files (1:10M) via the
[`us-atlas`](https://github.com/topojson/us-atlas) package — the boundary
data is a work of the U.S. Government, public domain; see
`data/geo/PROVENANCE.json`.

## The encoding plane (which column on which channel)

The second plane of the interaction grammar. The def states what each column **is** to a chart (`columns`: a role such as identifier, dimension, measure; the absence column's role is derived) and the **house rules** (`encodingRules`): a week's count and a year-to-date total never share a chart; a year-to-date total is never a hue; a series value is only meaningful per entity. The library adds one law every def inherits: the absence column never carries a magnitude.

One validator serves three doors with the same sentence: a def that starts against a rule **throws at build**; a rebind that breaks one — from the picker or from the analyst's tool — **is refused as a gap**; the picker greys the column and shows why. The Grammar panel lists the rules, and each channel says how many columns fit right now.

A swap of two axes is one act: `reencode` with `bindings` lands **one commit**, judged as a whole, so a chart never passes through an illegal middle state, and undo restores both channels.

What the demo does not show yet: coercion (the def says `refuse`), and a rule that follows a rebind across charts (an encoding link) — see the library's `src/encoding/README.md`.
